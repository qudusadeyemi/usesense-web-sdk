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
    const landmarks = new Array(1404).fill(0).map((_, i) => Math.random() * 0.5);
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
