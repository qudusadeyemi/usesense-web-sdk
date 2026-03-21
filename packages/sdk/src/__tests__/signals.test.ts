/**
 * Runtime tests for collectWebIntegritySignals.
 *
 * The test environment is Node (no DOM), so we stub the required globals
 * before importing the collector. Each field is explicitly asserted so that
 * regressions are caught immediately.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';

// ── Stub browser globals ─────────────────────────────────────────────────────

function stubBrowserGlobals(overrides: Record<string, any> = {}) {
  const base: Record<string, any> = {
    navigator: {
      userAgent: 'TestBrowser/1.0',
      platform: 'Linux x86_64',
      language: 'en-US',
      languages: ['en-US', 'en'],
      webdriver: false,
      cookieEnabled: true,
      maxTouchPoints: 0,
      hardwareConcurrency: 4,
      deviceMemory: 8,
      mediaDevices: { getUserMedia: () => {} },
      permissions: null, // skip async perm queries
      getBattery: () =>
        Promise.resolve({ charging: true, level: 0.82 }),
    },
    screen: {
      width: 1920,
      height: 1080,
      colorDepth: 24,
      availWidth: 1920,
      availHeight: 1040,
    },
    window: {
      devicePixelRatio: 2,
      innerWidth: 1280,
      innerHeight: 720,
      callPhantom: undefined,
      _phantom: undefined,
      __nightmare: undefined,
      domAutomation: undefined,
      domAutomationController: undefined,
    },
    document: {
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
    },
    AudioContext: undefined,
    WebAssembly: { compile: () => {} },
    MediaRecorder: function MediaRecorder() {},
    indexedDB: {},
    localStorage: {
      setItem: () => {},
      removeItem: () => {},
    },
    Intl: {
      DateTimeFormat: () => ({
        resolvedOptions: () => ({ timeZone: 'America/New_York' }),
      }),
    },
    performance: { now: () => Date.now() },
    crypto: { randomUUID: () => 'test-uuid' },
    ...overrides,
  };

  // Merge window onto global
  Object.assign(global, base.window);

  const defineRW = (key: string, value: any) =>
    Object.defineProperty(global, key, { value, writable: true, configurable: true });

  defineRW('navigator', base.navigator);
  defineRW('screen', base.screen);
  defineRW('document', base.document);
  defineRW('AudioContext', base.AudioContext);
  defineRW('WebAssembly', base.WebAssembly);
  defineRW('MediaRecorder', base.MediaRecorder);
  defineRW('indexedDB', base.indexedDB);
  defineRW('localStorage', base.localStorage);
  defineRW('Intl', base.Intl);
  defineRW('performance', base.performance);
  defineRW('crypto', base.crypto);
  defineRW('window', { ...base.window, navigator: base.navigator });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('collectWebIntegritySignals', () => {
  let collectWebIntegritySignals: () => Promise<any>;

  beforeAll(async () => {
    stubBrowserGlobals();
    ({ collectWebIntegritySignals } = await import('../capture/web-integrity'));
  });

  it('returns all required top-level fields', async () => {
    const signals = await collectWebIntegritySignals();

    // Identity
    expect(signals.user_agent).toBe('TestBrowser/1.0');
    expect(signals.platform).toBe('Linux x86_64');
    expect(signals.language).toBe('en-US');
    expect(signals.languages).toEqual(['en-US', 'en']);
    expect(typeof signals.webdriver).toBe('boolean');
    expect(typeof signals.automation_detected).toBe('boolean');

    // Screen
    expect(signals.screen_width).toBe(1920);
    expect(signals.screen_height).toBe(1080);
    expect(signals.screen_resolution).toBe('1920x1080');
    expect(signals.color_depth).toBe(24);
    expect(signals.pixel_ratio).toBe(2);
    expect(signals.avail_width).toBe(1920);
    expect(signals.avail_height).toBe(1040);

    // Window
    expect(signals.inner_width).toBe(1280);
    expect(signals.inner_height).toBe(720);

    // Locale
    expect(signals.timezone).toBe('America/New_York');
    expect(typeof signals.timezone_offset).toBe('number');

    // Hardware
    expect(signals.hardware_concurrency).toBe(4);
    expect(signals.device_memory).toBe(8);
    expect(signals.max_touch_points).toBe(0);
  });

  it('collects all feature-support flags', async () => {
    const signals = await collectWebIntegritySignals();

    expect(typeof signals.supports_webgl).toBe('boolean');
    expect(typeof signals.supports_webgl2).toBe('boolean');
    expect(typeof signals.supports_webaudio).toBe('boolean');
    expect(typeof signals.supports_webrtc).toBe('boolean');
    expect(signals.supports_wasm).toBe(true);
    expect(signals.supports_media_recorder).toBe(true);   // MediaRecorder is stubbed
    expect(signals.supports_service_worker).toBe(false);  // not in node globals
    expect(typeof signals.supports_indexeddb).toBe('boolean');
    expect(signals.supports_cookie).toBe(true);
    expect(typeof signals.supports_touch).toBe('boolean');
  });

  it('collects battery signals', async () => {
    const signals = await collectWebIntegritySignals();

    expect(signals.supports_battery).toBe(true);          // getBattery is stubbed
    expect(signals.battery_charging).toBe(true);
    expect(signals.battery_level).toBeCloseTo(0.82, 2);
  });

  it('returns null battery fields when Battery API is unavailable', async () => {
    // Override navigator without getBattery
    Object.defineProperty(global, 'navigator', {
      value: { ...(global as any).navigator, getBattery: undefined },
      writable: true, configurable: true,
    });

    // Re-import fresh module
    vi.resetModules();
    const { collectWebIntegritySignals: collect } = await import('../capture/web-integrity');
    const signals = await collect();

    expect(signals.supports_battery).toBe(false);
    expect(signals.battery_charging).toBeNull();
    expect(signals.battery_level).toBeNull();
  });

  it('collects network info when connection is available', async () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...(global as any).navigator,
        connection: { type: 'wifi', effectiveType: '4g', downlink: 10, rtt: 50 },
      },
      writable: true, configurable: true,
    });

    vi.resetModules();
    const { collectWebIntegritySignals: collect } = await import('../capture/web-integrity');
    const signals = await collect();

    expect(signals.connection_type).toBe('wifi');
    expect(signals.connection_effective_type).toBe('4g');
    expect(signals.connection_downlink).toBe(10);
    expect(signals.connection_rtt).toBe(50);
  });

  it('nulls network fields when connection API is unavailable', async () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...(global as any).navigator,
        connection: undefined,
        mozConnection: undefined,
        webkitConnection: undefined,
      },
      writable: true, configurable: true,
    });

    vi.resetModules();
    const { collectWebIntegritySignals: collect } = await import('../capture/web-integrity');
    const signals = await collect();

    expect(signals.connection_type).toBeNull();
    expect(signals.connection_effective_type).toBeNull();
    expect(signals.connection_downlink).toBeNull();
    expect(signals.connection_rtt).toBeNull();
  });

  it('collects canvas_hash as a number', async () => {
    vi.resetModules();
    const { collectWebIntegritySignals: collect } = await import('../capture/web-integrity');
    const signals = await collect();
    expect(typeof signals.canvas_hash).toBe('number');
  });

  it('includes collected_at ISO timestamp', async () => {
    vi.resetModules();
    const { collectWebIntegritySignals: collect } = await import('../capture/web-integrity');
    const signals = await collect();
    expect(signals.collected_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
