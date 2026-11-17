import { describe, it, expect, vi } from 'vitest';
import { deviceCheck, type DeviceCheckOptions } from '../device-check';
import * as SDK from '../index';
import { SDK_VERSION } from '../version';

type Call = { url: string; init: RequestInit; body: Record<string, unknown> };

function respond(status: number, body: unknown = status === 202 ? { received: true } : {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** A fetch mock that answers from a queue and records every call. */
function mockFetch(...answers: Array<Response | Error | 'hang'>) {
  const calls: Call[] = [];
  const fetcher = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {}, body: JSON.parse(String(init?.body ?? '{}')) });
    const next = answers.shift() ?? respond(202);
    if (next === 'hang') {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    }
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  return { fetcher: fetcher as unknown as typeof fetch, calls };
}

const SIGNALS = {
  canvas_hash: 'c1', webgl_renderer: 'ANGLE', timezone: 'Africa/Lagos', webdriver: false,
  camera_inventory: { video_input_count: 1, labels: [], virtual_label_matches: [] },
};
const INVENTORY = { video_input_count: 2, labels: ['FaceTime HD Camera', 'OBS Virtual Camera'], virtual_label_matches: ['obs'] };

function make(fetcher: typeof fetch, over: Partial<DeviceCheckOptions> = {}) {
  const collectSignals = vi.fn(async () => ({ ...SIGNALS }));
  const collectInventory = vi.fn(async () => ({ ...INVENTORY }));
  const check = deviceCheck({
    deviceCheckId: 'dc_abc12345',
    token: 'dct_' + 'a'.repeat(48),
    nonce: 'dn_nonce1',
    fetcher,
    collectSignals,
    collectInventory,
    waitForForeground: false,
    retryDelayMs: 1,
    ...over,
  });
  return { check, collectSignals, collectInventory };
}

describe('deviceCheck: payload', () => {
  it('start posts the signals with Bearer auth, nonce, phase and client', async () => {
    const { fetcher, calls } = mockFetch(respond(202));
    const { check } = make(fetcher);
    const r = await check.start();
    expect(r).toMatchObject({ ok: true, phase: 'start', received: true, status: 202, attempts: 1 });
    expect(r.deviceBinding).toEqual({ components: { canvas_hash: 'c1', webgl_renderer: 'ANGLE', timezone: 'Africa/Lagos' } });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.usesense.ai/v1/sdk/device-checks/dc_abc12345/signals');
    expect(calls[0].init.method).toBe('POST');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer dct_' + 'a'.repeat(48));
    expect(headers['content-type']).toBe('application/json');
    expect(calls[0].body).toEqual({
      nonce: 'dn_nonce1', phase: 'start', channel_integrity: SIGNALS, client: { sdk: 'web', version: SDK_VERSION },
    });
  });

  it('finish posts the camera inventory as channel_integrity.camera_inventory', async () => {
    const { fetcher, calls } = mockFetch(respond(202), respond(202));
    const { check } = make(fetcher);
    await check.start();
    const r = await check.finish();
    expect(r).toMatchObject({ ok: true, phase: 'finish', received: true });
    expect(calls[1].body).toMatchObject({ nonce: 'dn_nonce1', phase: 'finish', channel_integrity: { camera_inventory: INVENTORY } });
  });

  it('finish sends an empty channel_integrity when the inventory is unreadable', async () => {
    const { fetcher, calls } = mockFetch(respond(202));
    const { check } = make(fetcher, { collectInventory: async () => null });
    await check.finish();
    expect(calls[0].body.channel_integrity).toEqual({});
  });

  it('uses apiBaseUrl, or baseUrl as an alias, without a trailing slash', async () => {
    const a = mockFetch();
    await make(a.fetcher, { apiBaseUrl: 'https://sandbox.example.com/' }).check.start();
    expect(a.calls[0].url).toBe('https://sandbox.example.com/v1/sdk/device-checks/dc_abc12345/signals');
    const b = mockFetch();
    await make(b.fetcher, { baseUrl: 'https://alt.example.com' }).check.start();
    expect(b.calls[0].url).toBe('https://alt.example.com/v1/sdk/device-checks/dc_abc12345/signals');
  });

  it('never carries a score from a 202', async () => {
    const { fetcher } = mockFetch(respond(202, { received: true, score: 91 }));
    const r = await make(fetcher).check.start();
    expect(r).not.toHaveProperty('score');
  });

  it('sends start once, and finish waits for an in-flight start', async () => {
    const { fetcher, calls } = mockFetch(respond(202), respond(202));
    const { check, collectSignals } = make(fetcher);
    const [a, b, c] = await Promise.all([check.start(), check.start(), check.finish()]);
    expect(a).toBe(b);
    expect(c.ok).toBe(true);
    expect(collectSignals).toHaveBeenCalledTimes(1);
    expect(calls.map((x) => x.body.phase)).toEqual(['start', 'finish']);
  });

  it('waits for the foreground before collecting', async () => {
    const listeners: Record<string, () => void> = {};
    const doc = {
      visibilityState: 'hidden' as DocumentVisibilityState,
      hasFocus: () => true,
      addEventListener: (t: string, fn: () => void) => { listeners[t] = fn; },
      removeEventListener: () => undefined,
    };
    const env = { doc, win: { addEventListener: () => undefined, removeEventListener: () => undefined } };
    const { fetcher, calls } = mockFetch();
    const { check, collectSignals } = make(fetcher, { waitForForeground: true, foregroundEnv: env as never });
    const p = check.start();
    await new Promise((r) => setTimeout(r, 5));
    expect(collectSignals).not.toHaveBeenCalled();
    doc.visibilityState = 'visible';
    listeners.visibilitychange();
    await p;
    expect(collectSignals).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
  });
});

describe('deviceCheck: errors', () => {
  const cases: Array<[number, string, string]> = [
    [401, 'invalid_token', 'invalid_token'],
    [401, 'token_expired', 'token_expired'],
    [400, 'nonce_mismatch', 'nonce_mismatch'],
    [409, 'already_started', 'already_started'],
    [409, 'not_started', 'not_started'],
    [404, 'not_found', 'not_found'],
    [401, '', 'invalid_token'],
    [418, 'teapot', 'unknown'],
  ];
  for (const [status, serverCode, expected] of cases) {
    it(`maps ${status} ${serverCode || '(no code)'} to ${expected}, without retrying`, async () => {
      const { fetcher, calls } = mockFetch(respond(status, { error: 'nope', code: serverCode }));
      const r = await make(fetcher).check.start();
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toEqual({ code: expected, message: 'nope', retryable: false });
      expect(r.status).toBe(status);
      expect(calls).toHaveLength(1);
    });
  }

  it('resolves rather than throws when the signals cannot be collected', async () => {
    const { fetcher, calls } = mockFetch();
    const r = await make(fetcher, { collectSignals: async () => { throw new Error('boom'); } }).check.start();
    expect(r).toMatchObject({ ok: false, error: { code: 'collection_failed' } });
    expect(calls).toHaveLength(0);
  });

  it('refuses missing options without a request', async () => {
    const { fetcher, calls } = mockFetch();
    const r = await make(fetcher, { token: '' }).check.start();
    expect(r).toMatchObject({ ok: false, error: { code: 'invalid_options', retryable: false } });
    expect(calls).toHaveLength(0);
  });

  it('a failed start may be sent again; a received one is not', async () => {
    const { fetcher, calls } = mockFetch(respond(400, { code: 'nonce_mismatch' }), respond(202));
    const { check } = make(fetcher);
    expect((await check.start()).ok).toBe(false);
    expect((await check.start()).ok).toBe(true);
    expect((await check.start()).ok).toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe('deviceCheck: retry and timeout', () => {
  it('retries a 503 once with backoff and succeeds', async () => {
    const { fetcher, calls } = mockFetch(respond(503, { code: 'scoring_failed', error: 'x' }), respond(202));
    const r = await make(fetcher, { retryDelayMs: 20 }).check.start();
    expect(r).toMatchObject({ ok: true, attempts: 2 });
    expect(calls).toHaveLength(2);
    expect(calls[1].body).toEqual(calls[0].body);
  });

  it('gives up after one retry on repeated 503s', async () => {
    const { fetcher, calls } = mockFetch(respond(503, { code: 'scoring_failed', error: 'x' }), respond(503, { code: 'scoring_failed', error: 'y' }));
    const r = await make(fetcher).check.start();
    expect(r).toMatchObject({ ok: false, status: 503, attempts: 2, error: { code: 'scoring_failed', retryable: true } });
    expect(calls).toHaveLength(2);
  });

  it('retries a network failure once', async () => {
    const { fetcher, calls } = mockFetch(new TypeError('Failed to fetch'), new TypeError('Failed to fetch'));
    const r = await make(fetcher).check.start();
    expect(r).toMatchObject({ ok: false, status: null, attempts: 2, error: { code: 'network_error', retryable: true } });
    expect(calls).toHaveLength(2);
  });

  it('treats already_started after a lost first response as received', async () => {
    const { fetcher } = mockFetch(new TypeError('Failed to fetch'), respond(409, { code: 'already_started' }));
    const r = await make(fetcher).check.start();
    expect(r).toMatchObject({ ok: true, received: true, attempts: 2 });
  });

  it('aborts a request after timeoutMs and reports a timeout', async () => {
    const { fetcher, calls } = mockFetch('hang', 'hang');
    const r = await make(fetcher, { timeoutMs: 20 }).check.start();
    expect(r).toMatchObject({ ok: false, status: null, error: { code: 'timeout', retryable: true } });
    expect(calls).toHaveLength(2);
    expect(calls[0].init.signal?.aborted).toBe(true);
  });
});

describe('deviceCheck: export', () => {
  it('is exported from the package entry', () => {
    expect(SDK.deviceCheck).toBe(deviceCheck);
    expect(typeof SDK.DEVICE_CHECK_TIMEOUT_MS).toBe('number');
  });
});
