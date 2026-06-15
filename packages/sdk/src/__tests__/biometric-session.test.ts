/**
 * Tracer-bullet test for runBiometricSession (v1).
 *
 * Exercises challenge_type='none', no step-up. Mocks browser globals
 * (navigator, document, performance.now, fetch) and SDK modules that hit
 * MediaPipe, frame capture, and the api-client. Asserts the UI event
 * sequence + that completeSession's decision is returned.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CaptureResult, CaptureSessionData } from '../types';
import type { UiEvent } from '../session/ui-event';

// ── Stub browser globals BEFORE importing the module under test ──────────

function stub(key: string, value: any) {
  Object.defineProperty(global, key, { value, writable: true, configurable: true });
}

stub('navigator', {
  userAgent: 'TestBrowser/1.0',
  platform: 'Linux x86_64',
  language: 'en-US',
  languages: ['en-US'],
  webdriver: false,
  doNotTrack: null,
  cookieEnabled: true,
  maxTouchPoints: 0,
  hardwareConcurrency: 4,
  deviceMemory: 8,
  mediaDevices: {
    getUserMedia: vi.fn(async () => ({
      getTracks: () => [{ stop: vi.fn() }],
    })),
  },
  permissions: null,
  getBattery: () => Promise.resolve({ charging: true, level: 0.8 }),
});
stub('screen', { width: 1920, height: 1080, colorDepth: 24, availWidth: 1920, availHeight: 1080 });
stub('window', {
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
  Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: 'UTC' }) }) },
  matchMedia: () => ({ matches: false }),
  isSecureContext: true,
});
stub('document', {
  hasFocus: () => true,
  visibilityState: 'visible',
  cookie: '',
  createElement: () => ({
    getContext: () => null,
    width: 0,
    height: 0,
    toBlob: (cb: any) => cb(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })),
  }),
});
stub('performance', { now: () => Date.now() });
stub('crypto', {
  randomUUID: () => '00000000-0000-0000-0000-000000000000',
  subtle: { digest: async () => new ArrayBuffer(32) },
});

// ── Mocks for SDK modules ────────────────────────────────────────────────

vi.mock('../capture/media-pipe', () => ({
  initFaceMesh: vi.fn(async () => {}),
  isFaceMeshReady: vi.fn(() => false),
  evaluateFaceGuide: vi.fn(),
  extractFrameSignal: vi.fn(),
}));

vi.mock('../capture/frame-capture', async () => {
  const actual = await vi.importActual<any>('../capture/frame-capture');
  let idx = 0;
  return {
    ...actual,
    captureOneFrame: vi.fn(async () => ({
      index: idx++,
      bytes: new Uint8Array([1, 2, 3]),
      hash: 'deadbeef',
      timestamp: Date.now(),
      luminance: 128,
      resolution: { w: 640, h: 480 },
    })),
    // sleep() is no longer used by runBiometricSession (clock.sleep is) but
    // re-export the real implementation for any callers that still want it.
  };
});

vi.mock('../api-client', () => ({
  uploadSignals: vi.fn(async () => ({ received: true })),
  completeSession: vi.fn(
    async (): Promise<CaptureResult> => ({
      session_id: 'sess_test',
      decision: 'APPROVE',
      liveness_score: 0.95,
    })
  ),
}));

// Import AFTER mocks are wired.
import { runBiometricSession, StraightLinePathUnsupported } from '../session/biometric-session';
import { uploadSignals, completeSession } from '../api-client';
import { createFakeClock } from '../session/clock';

// ── Helpers ──────────────────────────────────────────────────────────────

function fakeVideo(): HTMLVideoElement {
  return {
    readyState: 4,
    videoWidth: 640,
    videoHeight: 480,
    srcObject: null,
    play: vi.fn(async () => {}),
  } as unknown as HTMLVideoElement;
}

function makeSessionData(challengeType: string = 'none'): CaptureSessionData {
  return {
    session_id: 'sess_test',
    session_token: 'tok_test',
    nonce: 'nonce_test',
    policy: {
      challenge_type: challengeType as any,
      inline_step_up: { enabled: false, suspicion_threshold: 55, preferred_challenge: 'auto' },
    },
    upload: { max_frames: 30, target_fps: 4, capture_duration_ms: 2000 },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('runBiometricSession (tracer bullet)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs the happy path and exits baseline on duration when fps is low', async () => {
    const events: UiEvent[] = [];
    const video = fakeVideo();
    const clock = createFakeClock();

    let resolveReady: () => void = () => {};
    const ready = new Promise<void>((r) => { resolveReady = r; });

    // Low fps: 1 frame per 1000ms. In 2000ms baseline window we expect
    // <=3 frames, well under MAX_FRAMES (30). Duration branch must gate.
    const sd = makeSessionData();
    sd.upload.target_fps = 1;

    const sessionPromise = runBiometricSession({
      sessionData: sd,
      environment: 'sandbox',
      video,
      blurredVideo: null,
      onUiEvent: (e) => events.push(e),
      awaitUserReady: () => ready,
      signalUserReady: () => resolveReady(),
      clock,
    });

    // Click "I'm Ready" right away (skips face-guide auto-advance).
    resolveReady();

    // Drive the clock past BASELINE_DURATION_MS (2000) in 250ms steps so
    // each frame-tick sleep wakes deterministically.
    for (let t = 0; t <= 2500; t += 250) {
      await clock.advance(250);
    }

    const result = await sessionPromise;

    expect(result.decision).toBe('APPROVE');
    expect(uploadSignals).toHaveBeenCalledOnce();
    expect(completeSession).toHaveBeenCalledOnce();

    // Probe: duration branch must have gated, NOT MAX_FRAMES.
    const uploadCall = (uploadSignals as any).mock.calls[0][0];
    expect(uploadCall.frames.length).toBeGreaterThan(0);
    expect(uploadCall.frames.length).toBeLessThan(30);

    const phases = events
      .filter((e: UiEvent): e is Extract<UiEvent, { type: 'phase' }> => e.type === 'phase')
      .map((e) => e.phase);
    expect(phases).toEqual([
      'initializing',
      'camera-request',
      'face-guide',
      'baseline',
      'uploading',
      'completing',
      'done',
    ]);
  });

  it('exits baseline on MAX_FRAMES when fps is high', async () => {
    const video = fakeVideo();
    const clock = createFakeClock();

    let resolveReady: () => void = () => {};
    const ready = new Promise<void>((r) => { resolveReady = r; });

    // High fps: 30fps -> 33ms interval. 30 frames fit in ~1000ms,
    // before the 2000ms duration cap.
    const sd = makeSessionData();
    sd.upload.target_fps = 30;

    const sessionPromise = runBiometricSession({
      sessionData: sd,
      environment: 'sandbox',
      video,
      blurredVideo: null,
      onUiEvent: () => {},
      awaitUserReady: () => ready,
      signalUserReady: () => resolveReady(),
      clock,
    });

    resolveReady();

    // Advance generously; loop should hit MAX_FRAMES before 2000ms.
    for (let t = 0; t <= 3000; t += 33) {
      await clock.advance(33);
    }

    await sessionPromise;
    const uploadCall = (uploadSignals as any).mock.calls[0][0];
    expect(uploadCall.frames.length).toBe(30);
  });

  it('throws StraightLinePathUnsupported for non-"none" challenge types', async () => {
    await expect(
      runBiometricSession({
        sessionData: makeSessionData('head_turn'),
        environment: 'sandbox',
        video: fakeVideo(),
        blurredVideo: null,
        onUiEvent: () => {},
        awaitUserReady: () => Promise.resolve(),
        signalUserReady: () => {},
        clock: createFakeClock(),
      })
    ).rejects.toBeInstanceOf(StraightLinePathUnsupported);
  });

  it('throws StraightLinePathUnsupported when inline_step_up is enabled', async () => {
    const sd = makeSessionData();
    sd.policy.inline_step_up = { enabled: true, suspicion_threshold: 55, preferred_challenge: 'auto' };
    await expect(
      runBiometricSession({
        sessionData: sd,
        environment: 'sandbox',
        video: fakeVideo(),
        blurredVideo: null,
        onUiEvent: () => {},
        awaitUserReady: () => Promise.resolve(),
        signalUserReady: () => {},
        clock: createFakeClock(),
      })
    ).rejects.toBeInstanceOf(StraightLinePathUnsupported);
  });
});
