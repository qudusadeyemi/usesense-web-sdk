import { describe, it, expect } from 'vitest';
import * as SDK from '../index';

describe('@usesense/web-sdk v2.0.0 exports', () => {
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
    expect(typeof SDK.createSession).toBe('function');
    expect(typeof SDK.uploadSignals).toBe('function');
    expect(typeof SDK.completeSession).toBe('function');
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
    // Two calls with empty landmarks should produce the same digest
    const a = await SDK.computeMeshDigest([], pose, 0, []);
    const b = await SDK.computeMeshDigest([], pose, 0, []);
    expect(a).toBe(b);
    // And different from a call with actual landmarks
    const c = await SDK.computeMeshDigest([], pose, 0, [0.1, 0.2, 0.3]);
    expect(a).not.toBe(c);
  });

  it('computeBindingProof uses hex-decoded key (not ASCII challenge bytes)', async () => {
    // A 64-char hex challenge represents 32 raw bytes.
    // Using TextEncoder on the hex string would give a 64-byte key -- wrong.
    const challenge = 'a'.repeat(64); // 32 bytes of 0xaa
    const pose = { yaw: 0, pitch: 0, roll: 0 };
    const digest = await SDK.computeMeshDigest([1], pose, 50, [0.1]);
    const proof = await SDK.computeBindingProof(challenge, 'abc123', digest);
    expect(proof).toMatch(/^[0-9a-f]{64}$/);
    // Proof must differ if we use a different challenge
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
