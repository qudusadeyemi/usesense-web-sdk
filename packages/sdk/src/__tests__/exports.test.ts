import { describe, it, expect } from 'vitest';
import * as SDK from '../index';

describe('@usesense/web-sdk v4.1.0 exports', () => {
  it('exports VerificationCaptureEngine component', () => {
    expect(SDK.VerificationCaptureEngine).toBeDefined();
  });

  it('exports UseSenseSDK class', () => {
    expect(SDK.UseSenseSDK).toBeDefined();
    expect(typeof SDK.UseSenseSDK).toBe('function');
  });

  it('exports API client functions', () => {
    expect(SDK.createSession).toBeDefined();
    expect(SDK.uploadSignals).toBeDefined();
    expect(SDK.completeSession).toBeDefined();
    expect(SDK.exchangeToken).toBeDefined();
    expect(typeof SDK.createSession).toBe('function');
    expect(typeof SDK.uploadSignals).toBe('function');
    expect(typeof SDK.completeSession).toBe('function');
    expect(typeof SDK.exchangeToken).toBe('function');
  });

  it('exports capture utilities', () => {
    expect(SDK.collectWebIntegritySignals).toBeDefined();
    expect(SDK.initFaceMesh).toBeDefined();
    expect(SDK.isFaceMeshReady).toBeDefined();
    expect(SDK.disposeFaceMesh).toBeDefined();
    expect(SDK.evaluateFaceGuide).toBeDefined();
    expect(SDK.extractFrameSignal).toBeDefined();
    expect(SDK.fitOnDevice3DMM).toBeDefined();
    expect(SDK.computeCrossFrameConsistency).toBeDefined();
    expect(SDK.computePreliminaryGCScore).toBeDefined();
  });

  it('exports v4.1 modules', () => {
    expect(SDK.SuspicionEngine).toBeDefined();
    expect(SDK.computeScreenDetectionSignals).toBeDefined();
    expect(SDK.runFlashReflection).toBeDefined();
    expect(SDK.runRMAS).toBeDefined();
    expect(SDK.runStepUp).toBeDefined();
  });

  it('exports crypto utilities', () => {
    expect(SDK.hashFrame).toBeDefined();
    expect(SDK.computeMeshDigest).toBeDefined();
    expect(SDK.computeBindingProof).toBeDefined();
    expect(SDK.hexToBytes).toBeDefined();
    expect(SDK.bytesToHex).toBeDefined();
  });

  it('exports error utilities', () => {
    expect(SDK.createError).toBeDefined();
    expect(SDK.getCameraErrorMessage).toBeDefined();
    expect(SDK.getUserMessage).toBeDefined();
  });

  it('exports document extraction surface', () => {
    expect(typeof SDK.startDocumentExtraction).toBe('function');
    expect(typeof SDK.submitDocumentImage).toBe('function');
    expect(typeof SDK.getDocument).toBe('function');
    expect(typeof SDK.prepareDocumentImage).toBe('function');
    expect(typeof SDK.computeResizeTarget).toBe('function');
    expect(typeof SDK.MAX_PRE_BASE64_BYTES).toBe('number');
    expect(typeof SDK.DocumentImageTooLargeError).toBe('function');
  });

  it('exports document capture surface', () => {
    expect(typeof SDK.DocumentCapture).toBe('function');
    expect(typeof SDK.aspectRatioForDocument).toBe('function');
    expect(typeof SDK.computeFrameRect).toBe('function');
    expect(typeof SDK.STABILITY_THRESHOLDS).toBe('object');
  });
});

describe('crypto utilities', () => {
  it('hexToBytes converts hex string to Uint8Array', () => {
    const bytes = SDK.hexToBytes('deadbeef');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(4);
    expect(bytes[0]).toBe(0xde);
    expect(bytes[1]).toBe(0xad);
    expect(bytes[2]).toBe(0xbe);
    expect(bytes[3]).toBe(0xef);
  });

  it('bytesToHex converts Uint8Array to hex string', () => {
    const hex = SDK.bytesToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    expect(hex).toBe('deadbeef');
  });

  it('hexToBytes and bytesToHex are inverse operations', () => {
    const original = 'a1b2c3d4e5f6';
    const roundtrip = SDK.bytesToHex(SDK.hexToBytes(original));
    expect(roundtrip).toBe(original);
  });

  it('computeMeshDigest produces a 64-char hex string', async () => {
    const pose = { yaw: -3.2, pitch: 1.1, roll: 0.4 };
    const digest = await SDK.computeMeshDigest([0.1, 0.2, 0.3], pose, 71, [0.5, 0.3, -0.02]);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('computeMeshDigest is deterministic', async () => {
    const pose = { yaw: 0, pitch: 0, roll: 0 };
    const lm = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
    const a = await SDK.computeMeshDigest([1, 2], pose, 50, lm);
    const b = await SDK.computeMeshDigest([1, 2], pose, 50, lm);
    expect(a).toBe(b);
  });

  it('computeMeshDigest changes when depthPlausibility changes', async () => {
    const pose = { yaw: 0, pitch: 0, roll: 0 };
    const lm = [0.1, 0.2, 0.3];
    const a = await SDK.computeMeshDigest([1], pose, 50, lm);
    const b = await SDK.computeMeshDigest([1], pose, 99, lm);
    expect(a).not.toBe(b);
  });

  it('computeMeshDigest changes when landmarks change', async () => {
    const pose = { yaw: 0, pitch: 0, roll: 0 };
    const a = await SDK.computeMeshDigest([1], pose, 50, [0.1, 0.2, 0.3]);
    const b = await SDK.computeMeshDigest([1], pose, 50, [0.9, 0.8, 0.7]);
    expect(a).not.toBe(b);
  });

  it('computeMeshDigest uses "none" for empty landmarks', async () => {
    const pose = { yaw: 0, pitch: 0, roll: 0 };
    const a = await SDK.computeMeshDigest([], pose, 0, []);
    const b = await SDK.computeMeshDigest([], pose, 0, []);
    expect(a).toBe(b);
    const c = await SDK.computeMeshDigest([], pose, 0, [0.1, 0.2, 0.3]);
    expect(a).not.toBe(c);
  });

  it('computeBindingProof uses hex-decoded key (not ASCII challenge bytes)', async () => {
    const challenge = 'a'.repeat(64); // 32 bytes of 0xaa
    const pose = { yaw: 0, pitch: 0, roll: 0 };
    const digest = await SDK.computeMeshDigest([1], pose, 50, [0.1]);
    const proof = await SDK.computeBindingProof(challenge, 'abc123', digest);
    expect(proof).toMatch(/^[0-9a-f]{64}$/);
    const challenge2 = 'b'.repeat(64);
    const proof2 = await SDK.computeBindingProof(challenge2, 'abc123', digest);
    expect(proof).not.toBe(proof2);
  });
});

describe('error utilities', () => {
  it('createError creates a UseSenseError with code and message', () => {
    const error = SDK.createError('NETWORK_ERROR', 'Connection failed');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toBe('Connection failed');
    expect(error.name).toBe('UseSenseError');
  });

  it('getUserMessage returns user-friendly message for known error codes', () => {
    const error = SDK.createError('CAMERA_PERMISSION_DENIED', 'Camera denied');
    const message = SDK.getUserMessage(error);
    expect(message).toContain('camera');
    expect(message).toContain('Camera');
  });

  it('getCameraErrorMessage maps browser error names', () => {
    expect(SDK.getCameraErrorMessage({ name: 'NotAllowedError' })).toContain(
      'denied'
    );
    expect(SDK.getCameraErrorMessage({ name: 'NotFoundError' })).toContain(
      'No camera'
    );
    expect(SDK.getCameraErrorMessage({ name: 'NotReadableError' })).toContain(
      'in use'
    );
  });
});

describe('MediaPipe utilities', () => {
  it('isFaceMeshReady returns false before initialization', () => {
    expect(SDK.isFaceMeshReady()).toBe(false);
  });

  it('fitOnDevice3DMM returns null for invalid input', () => {
    expect(SDK.fitOnDevice3DMM([])).toBeNull();
    expect(SDK.fitOnDevice3DMM([1, 2, 3])).toBeNull();
  });

  it('fitOnDevice3DMM returns shape data for valid 1404-length input', () => {
    // 468 landmarks x 3 coords = 1404
    const landmarks = new Array(1404).fill(0).map(() => Math.random() * 0.5);
    const result = SDK.fitOnDevice3DMM(landmarks);
    expect(result).not.toBeNull();
    expect(result!.shapeParams).toBeDefined();
    expect(result!.shapeParams.length).toBe(12);
    expect(result!.pose).toBeDefined();
    expect(typeof result!.pose.yaw).toBe('number');
    expect(typeof result!.pose.pitch).toBe('number');
    expect(typeof result!.pose.roll).toBe('number');
    expect(typeof result!.depthPlausibility).toBe('number');
    expect(result!.geometricRatios.length).toBe(6);
    expect(result!.poseRatios2D.length).toBe(5);
  });

  it('computeCrossFrameConsistency returns 0 for fewer than 2 fits', () => {
    expect(SDK.computeCrossFrameConsistency([])).toBe(0);
    const fit = {
      shapeParams: [1, 2, 3],
      pose: { yaw: 0, pitch: 0, roll: 0 },
      depthPlausibility: 50,
      geometricRatios: [1],
      poseRatios2D: [1],
    };
    expect(SDK.computeCrossFrameConsistency([fit])).toBe(0);
  });

  it('computeCrossFrameConsistency returns high score for identical fits', () => {
    const fit = {
      shapeParams: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      pose: { yaw: 0, pitch: 0, roll: 0 },
      depthPlausibility: 50,
      geometricRatios: [1, 1, 1, 1, 1, 1],
      poseRatios2D: [1, 1, 1, 1, 1],
    };
    const score = SDK.computeCrossFrameConsistency([fit, fit, fit]);
    expect(score).toBe(100);
  });
});

describe('SuspicionEngine', () => {
  it('starts with score 0', () => {
    const engine = new SDK.SuspicionEngine(55);
    expect(engine.getScore()).toBe(0);
    expect(engine.shouldTrigger()).toBe(false);
  });

  it('accumulates score from signal data', () => {
    const engine = new SDK.SuspicionEngine(55);
    // Push enough frames with "screen-like" stable data
    for (let i = 0; i < 20; i++) {
      engine.push({ yaw: 0, pitch: 0, roll: 0 }, 128, 30);
    }
    expect(engine.getScore()).toBeGreaterThan(0);
  });

  it('getSnapshot returns valid SuspicionData', () => {
    const engine = new SDK.SuspicionEngine(55);
    for (let i = 0; i < 10; i++) {
      engine.push({ yaw: i * 0.1, pitch: 0, roll: 0 }, 128 + i * 0.5, 50 + i);
    }
    const snapshot = engine.getSnapshot();
    expect(snapshot.final_score).toBeGreaterThanOrEqual(0);
    expect(snapshot.final_score).toBeLessThanOrEqual(100);
    expect(snapshot.snapshot.signals.length).toBe(4);
    expect(snapshot.snapshot.framesAnalyzed).toBeGreaterThan(0);
  });

  it('does not trigger below threshold with live-like data', () => {
    const engine = new SDK.SuspicionEngine(55);
    // Push frames with natural tremor and variation
    for (let i = 0; i < 20; i++) {
      const yaw = (Math.random() - 0.5) * 2;
      const lum = 100 + Math.random() * 40;
      const sharp = 60 + Math.random() * 30;
      engine.push({ yaw, pitch: 0, roll: 0 }, lum, sharp);
    }
    expect(engine.shouldTrigger()).toBe(false);
  });
});
