import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uploadSignals, UPLOAD_RETRY } from '../api-client';

describe('UPLOAD_RETRY timing invariants (parity with iOS and Android)', () => {
  const { idleTimeoutMs, backoffsMs, stallWindowMs, uploadBudgetMs } = UPLOAD_RETRY;
  const longestBackoff = Math.max(...backoffsMs);
  const totalBackoff = backoffsMs.reduce((a, b) => a + b, 0);

  it('a stalled attempt fails and its retry starts before the stall window ends', () => {
    expect(idleTimeoutMs + longestBackoff).toBeLessThan(stallWindowMs);
  });

  it('four stalled attempts plus every backoff stay inside the upload budget', () => {
    expect(backoffsMs).toEqual([1000, 2000, 4000]);
    expect((backoffsMs.length + 1) * idleTimeoutMs + totalBackoff).toBeLessThan(uploadBudgetMs);
  });

  it('the idle limit leaves room for the server (it answers /signals in 1-5 s)', () => {
    expect(idleTimeoutMs).toBe(20000);
    expect(idleTimeoutMs).toBeGreaterThanOrEqual(15000);
  });
});

/** A fake XMLHttpRequest: each instance follows the next scripted behaviour. */
type Script = 'stall' | 'ok' | 'slow-ok';
class FakeXHR {
  static scripts: Script[] = [];
  static sent: FakeXHR[] = [];
  headers: Record<string, string> = {};
  readyState = 0;
  status = 0;
  responseText = '';
  upload: { onprogress?: (e: any) => void; onload?: (e: any) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  onabort?: () => void;
  onprogress?: () => void;
  onreadystatechange?: () => void;
  aborted = false;
  open() { this.readyState = 1; }
  setRequestHeader(k: string, v: string) { this.headers[k] = v; }
  getResponseHeader() { return null; }
  abort() { this.aborted = true; this.onabort?.(); }
  send() {
    FakeXHR.sent.push(this);
    const script = FakeXHR.scripts.shift() ?? 'ok';
    const total = 1000;
    if (script === 'stall') {
      // Sends 30% then nothing more (the device's half-sent body).
      setTimeout(() => this.upload.onprogress?.({ lengthComputable: true, loaded: 300, total }), 100);
      return;
    }
    // 'slow-ok': 10% every 5 s (50 s in all, never 20 s idle), then a reply.
    const step = script === 'slow-ok' ? 5000 : 10;
    for (let i = 1; i <= 10; i++) {
      setTimeout(() => this.upload.onprogress?.({ lengthComputable: true, loaded: i * 100, total }), i * step);
    }
    setTimeout(() => {
      this.upload.onload?.({ loaded: total });
      this.readyState = 4;
      this.status = 200;
      this.responseText = JSON.stringify({ received: true });
      this.onload?.();
    }, 10 * step + 1500);
  }
}

describe('uploadSignals retries a stalled attempt', () => {
  const params = () => ({
    apiBaseUrl: 'https://api.example.test/v1',
    environment: 'production' as const,
    sessionId: 'ses_1',
    sessionToken: 'tok',
    nonce: 'n',
    frames: [new Uint8Array([1, 2, 3])],
    metadata: {} as any,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    FakeXHR.scripts = [];
    FakeXHR.sent = [];
    vi.stubGlobal('XMLHttpRequest', FakeXHR);
    // Plain JSON metadata: CompressionStream's stream doesn't settle under fake timers.
    vi.stubGlobal('CompressionStream', undefined);
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fails an attempt after 20 s with no bytes, retries after 1 s with the same idempotency key', async () => {
    FakeXHR.scripts = ['stall', 'ok'];
    const attempts: number[] = [];
    const done = uploadSignals({ ...params(), onAttempt: (a) => attempts.push(a) });
    await vi.advanceTimersByTimeAsync(100 + UPLOAD_RETRY.idleTimeoutMs - 50);
    expect(FakeXHR.sent).toHaveLength(1);
    expect(FakeXHR.sent[0].aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(FakeXHR.sent[0].aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeXHR.sent).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(done).resolves.toEqual({ received: true });
    expect(attempts).toEqual([0, 1]);
    const key = FakeXHR.sent[0].headers['x-idempotency-key'];
    expect(key).toBeTruthy();
    expect(FakeXHR.sent[1].headers['x-idempotency-key']).toBe(key);
  });

  it('a slow upload that keeps moving is never cut off', async () => {
    FakeXHR.scripts = ['slow-ok'];
    const done = uploadSignals(params());
    await vi.advanceTimersByTimeAsync(60000);
    await expect(done).resolves.toEqual({ received: true });
    expect(FakeXHR.sent).toHaveLength(1);
  });

  it('gives up after 3 retries, inside the upload budget', async () => {
    FakeXHR.scripts = ['stall', 'stall', 'stall', 'stall'];
    const done = uploadSignals(params());
    const failed = expect(done).rejects.toThrow(/stalled/);
    const worst = 4 * (UPLOAD_RETRY.idleTimeoutMs + 100) + 7000;
    await vi.advanceTimersByTimeAsync(worst);
    await failed;
    expect(FakeXHR.sent).toHaveLength(4);
    expect(worst).toBeLessThan(UPLOAD_RETRY.uploadBudgetMs);
  });

  it('traces bytes per 10% step and the wait for the server', async () => {
    FakeXHR.scripts = ['ok'];
    const done = uploadSignals(params());
    await vi.advanceTimersByTimeAsync(5000);
    await done;
    const lines = (console.debug as any).mock.calls.map((c: any[]) => c[0] as string);
    expect(lines.filter((l: string) => /bytes \(\d+%\)/.test(l)).length).toBe(9);
    expect(lines.some((l: string) => /body sent 1000 bytes in [\d.]+s, waiting for the server/.test(l))).toBe(true);
  });
});
