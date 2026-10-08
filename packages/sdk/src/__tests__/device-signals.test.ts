import { describe, expect, it, vi } from 'vitest';
import { collectDeviceBinding, deviceBindingFrom, DEVICE_FINGERPRINT_KEYS, waitForForeground, type ForegroundEnv } from '../flows/device-signals';

function fakeEnv(state: { visible: boolean; focused: boolean }) {
  const docListeners = new Map<string, Set<() => void>>();
  const winListeners = new Map<string, Set<() => void>>();
  const on = (m: Map<string, Set<() => void>>) => (t: string, f: () => void) => { if (!m.has(t)) m.set(t, new Set()); m.get(t)!.add(f); };
  const off = (m: Map<string, Set<() => void>>) => (t: string, f: () => void) => { m.get(t)?.delete(f); };
  const env = {
    doc: {
      get visibilityState() { return state.visible ? 'visible' : 'hidden'; },
      hasFocus: () => state.focused,
      addEventListener: on(docListeners),
      removeEventListener: off(docListeners),
    },
    win: { addEventListener: on(winListeners), removeEventListener: off(winListeners) },
  } as unknown as ForegroundEnv;
  return {
    env,
    show() { state.visible = true; docListeners.get('visibilitychange')?.forEach((f) => f()); },
    focus() { state.focused = true; winListeners.get('focus')?.forEach((f) => f()); },
    listeners: () => (docListeners.get('visibilitychange')?.size ?? 0) + (winListeners.get('focus')?.size ?? 0),
  };
}

describe('waitForForeground', () => {
  it('resolves at once when the page is visible and focused', async () => {
    const f = fakeEnv({ visible: true, focused: true });
    await expect(waitForForeground(f.env)).resolves.toBeUndefined();
  });

  it('waits for a background tab to become visible, then focused', async () => {
    const f = fakeEnv({ visible: false, focused: false });
    let done = false;
    const p = waitForForeground(f.env, 10_000).then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);
    f.show();
    await Promise.resolve();
    expect(done).toBe(false);
    f.focus();
    await p;
    expect(done).toBe(true);
    expect(f.listeners()).toBe(0);
  });

  it('collects anyway after the focus grace period', async () => {
    vi.useFakeTimers();
    const f = fakeEnv({ visible: true, focused: false });
    let done = false;
    const p = waitForForeground(f.env, 1500).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(1499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
    expect(f.listeners()).toBe(0);
    vi.useRealTimers();
  });
});

describe('device binding for face init-session', () => {
  it('picks only the fingerprint keys, keeping their raw values', () => {
    const signals = {
      canvas_hash: 1234567, webgl_extensions: ['EXT_a'], screen_resolution: '1470x956', platform: 'MacIntel',
      timezone: null, has_focus: true, visibility_state: 'visible', battery_level: 0.4,
    };
    expect(deviceBindingFrom(signals)).toEqual({
      components: { canvas_hash: 1234567, webgl_extensions: ['EXT_a'], screen_resolution: '1470x956', platform: 'MacIntel', timezone: null },
    });
  });

  it('sends nothing when there is nothing to fingerprint', () => {
    expect(deviceBindingFrom(null)).toBeNull();
    expect(deviceBindingFrom({ battery_level: 1 })).toBeNull();
  });

  it('never holds up the face step: a slow or failing collection sends no binding', async () => {
    vi.useFakeTimers();
    const slow = collectDeviceBinding(() => new Promise(() => {}), 100);
    vi.advanceTimersByTime(100);
    await expect(slow).resolves.toBeNull();
    vi.useRealTimers();
    await expect(collectDeviceBinding(() => Promise.reject(new Error('no webgl')))).resolves.toBeNull();
    await expect(collectDeviceBinding(async () => ({ platform: 'MacIntel' }))).resolves.toEqual({ components: { platform: 'MacIntel' } });
  });

  it('matches the server key list', () => {
    expect([...DEVICE_FINGERPRINT_KEYS]).toEqual([
      'canvas_hash', 'webgl_renderer', 'webgl_vendor', 'webgl_extensions',
      'screen_resolution', 'hardware_concurrency', 'device_memory', 'max_touch_points',
      'platform', 'color_depth', 'timezone', 'audio_fingerprint',
    ]);
  });
});
