/**
 * Runtime tests for collectWebIntegritySignals.
 *
 * The test environment is Node (no DOM), so we stub the required globals
 * before importing the collector. Each field is explicitly asserted so that
 * regressions against the backend channel_integrity spec are caught immediately.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';

// ── Stub browser globals ─────────────────────────────────────────────────────

function stubBrowserGlobals() {
  const defineRW = (key: string, value: any) =>
    Object.defineProperty(global, key, {
      value,
      writable: true,
      configurable: true,
    });

  defineRW('navigator', {
    userAgent: 'TestBrowser/1.0',
    platform: 'Linux x86_64',
    language: 'en-US',
    languages: ['en-US', 'en'],
    webdriver: false,
    doNotTrack: null,
    cookieEnabled: true,
    maxTouchPoints: 0,
    hardwareConcurrency: 4,
    deviceMemory: 8,
    mediaDevices: { getUserMedia: () => {} },
    permissions: null,
    getBattery: () => Promise.resolve({ charging: true, level: 0.82 }),
  });

  defineRW('screen', {
    width: 1920,
    height: 1080,
    colorDepth: 24,
    availWidth: 1920,
    availHeight: 1040,
  });

  defineRW('document', {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          getContext: () => null,
          width: 0,
          height: 0,
          toDataURL: () => 'data:image/png;base64,test',
        };
      }
      return {};
    },
    hasFocus: () => true,
    visibilityState: 'visible',
  });

  defineRW('AudioContext', undefined);
  defineRW('RTCPeerConnection', function RTCPeerConnection() {});
  defineRW('WebAssembly', { compile: () => {} });
  defineRW('MediaRecorder', function MediaRecorder() {});
  defineRW('IntersectionObserver', function IntersectionObserver() {});
  defineRW('SharedArrayBuffer', undefined);
  defineRW('indexedDB', {});
  defineRW('localStorage', {
    setItem: () => {},
    removeItem: () => {},
  });
  defineRW('Intl', {
    DateTimeFormat: () => ({
      resolvedOptions: () => ({ timeZone: 'America/New_York' }),
    }),
  });
  defineRW('performance', { now: () => Date.now() });
  defineRW('crypto', {
    randomUUID: () => 'test-uuid',
    subtle: {},
  });
  defineRW('window', {
    devicePixelRatio: 2,
    innerWidth: 1280,
    innerHeight: 720,
    navigator: (global as any).navigator,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('collectWebIntegritySignals -- backend spec compliance', () => {
  let collectWebIntegritySignals: () => Promise<any>;

  beforeAll(async () => {
    stubBrowserGlobals();
    ({ collectWebIntegritySignals } = await import('../capture/web-integrity'));
  });

  it('top-level identity and document state fields', async () => {
    const s = await collectWebIntegritySignals();

    expect(s.user_agent).toBe('TestBrowser/1.0');
    expect(typeof s.webdriver).toBe('boolean');
    expect(s.do_not_track).toBeNull();
    expect(s.cookie_enabled).toBe(true);
    expect(s.has_focus).toBe(true);
    expect(s.visibility_state).toBe('visible');
  });

  it('hardware and screen fields', async () => {
    const s = await collectWebIntegritySignals();

    expect(s.hardware_concurrency).toBe(4);
    expect(s.device_memory).toBe(8);
    expect(s.max_touch_points).toBe(0);
    expect(s.screen_resolution).toBe('1920x1080');
    expect(s.screen_available).toBe('1920x1040');
    expect(s.color_depth).toBe(24);
    expect(s.viewport_size).toBe('1280x720');
    expect(s.device_pixel_ratio).toBe(2);
  });

  it('locale fields', async () => {
    const s = await collectWebIntegritySignals();

    expect(s.timezone).toBe('America/New_York');
    expect(typeof s.timezone_offset).toBe('number');
    expect(s.language).toBe('en-US');
    expect(s.languages).toEqual(['en-US', 'en']);
  });

  it('feature_support is a nested object with all required keys', async () => {
    const s = await collectWebIntegritySignals();

    expect(s.feature_support).toBeDefined();
    expect(typeof s.feature_support.supports_webgl).toBe('boolean');
    expect(typeof s.feature_support.supports_webgl2).toBe('boolean');
    expect(typeof s.feature_support.supports_web_audio).toBe('boolean');
    expect(s.feature_support.supports_webrtc).toBe(true);         // RTCPeerConnection stubbed
    expect(s.feature_support.supports_media_recorder).toBe(true); // MediaRecorder stubbed
    expect(s.feature_support.supports_wasm).toBe(true);           // WebAssembly stubbed
    expect(typeof s.feature_support.supports_service_worker).toBe('boolean');
    expect(s.feature_support.supports_intersection_observer).toBe(true); // stubbed
    expect(s.feature_support.supports_web_crypto).toBe(true);     // crypto.subtle stubbed
    expect(s.feature_support.supports_shared_array_buffer).toBe(false); // undefined
  });

  it('feature_support does NOT contain old flat keys', async () => {
    const s = await collectWebIntegritySignals();

    // These old keys must NOT appear at the top level any more
    expect((s as any).supports_webgl).toBeUndefined();
    expect((s as any).supports_webaudio).toBeUndefined();
    expect((s as any).supports_cookie).toBeUndefined();
    expect((s as any).pixel_ratio).toBeUndefined();
    expect((s as any).battery_charging).toBeUndefined();
    expect((s as any).connection_rtt).toBeUndefined();
  });

  it('permissions_state is a nested object with all four keys', async () => {
    const s = await collectWebIntegritySignals();

    expect(s.permissions_state).toBeDefined();
    // Permissions API is null in our stub, so all should be 'unsupported'
    expect(s.permissions_state.camera).toBe('unsupported');
    expect(s.permissions_state.microphone).toBe('unsupported');
    expect(s.permissions_state.geolocation).toBe('unsupported');
    expect(s.permissions_state.notifications).toBe('unsupported');
  });

  it('battery is a nested object when getBattery is available', async () => {
    vi.resetModules();
    const { collectWebIntegritySignals: collect } = await import('../capture/web-integrity');
    const s = await collect();

    expect(s.battery).toBeDefined();
    expect(s.battery!.charging).toBe(true);
    expect(s.battery!.level).toBeCloseTo(0.82, 2);
    // Must NOT be flat keys
    expect((s as any).battery_charging).toBeUndefined();
    expect((s as any).battery_level).toBeUndefined();
    expect((s as any).supports_battery).toBeUndefined();
  });

  it('battery is omitted when getBattery is unavailable', async () => {
    Object.defineProperty(global, 'navigator', {
      value: { ...(global as any).navigator, getBattery: undefined },
      writable: true,
      configurable: true,
    });

    vi.resetModules();
    const { collectWebIntegritySignals: collect } = await import('../capture/web-integrity');
    const s = await collect();

    expect(s.battery).toBeUndefined();
  });

  it('connection is a nested object when Network Info API is available', async () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...(global as any).navigator,
        connection: {
          effectiveType: '4g',
          downlink: 10,
          rtt: 50,
          saveData: false,
        },
      },
      writable: true,
      configurable: true,
    });

    vi.resetModules();
    const { collectWebIntegritySignals: collect } = await import('../capture/web-integrity');
    const s = await collect();

    expect(s.connection).toBeDefined();
    expect(s.connection!.effective_type).toBe('4g');
    expect(s.connection!.downlink).toBe(10);
    expect(s.connection!.rtt).toBe(50);
    expect(s.connection!.save_data).toBe(false);
    // Must NOT be flat keys
    expect((s as any).connection_rtt).toBeUndefined();
    expect((s as any).connection_effective_type).toBeUndefined();
  });

  it('connection is omitted when Network Info API is unavailable', async () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...(global as any).navigator,
        connection: undefined,
        mozConnection: undefined,
        webkitConnection: undefined,
      },
      writable: true,
      configurable: true,
    });

    vi.resetModules();
    const { collectWebIntegritySignals: collect } = await import('../capture/web-integrity');
    const s = await collect();

    expect(s.connection).toBeUndefined();
  });

  it('frame timing fields start at defaults (populated by component later)', async () => {
    vi.resetModules();
    const { collectWebIntegritySignals: collect } = await import('../capture/web-integrity');
    const s = await collect();

    expect(s.avg_frame_interval_ms).toBe(0);
    expect(Array.isArray(s.frame_timestamps)).toBe(true);
    expect(s.frame_timestamps.length).toBe(0);
  });

  it('canvas_hash is a number', async () => {
    vi.resetModules();
    const { collectWebIntegritySignals: collect } = await import('../capture/web-integrity');
    const s = await collect();
    expect(typeof s.canvas_hash).toBe('number');
  });
});
