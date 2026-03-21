/**
 * UseSense Web SDK v2.0.0
 *
 * Drop-in biometric verification widget that matches the exact experience
 * of the hosted enrollment and verification flows.
 *
 * @example React Component (recommended)
 * ```tsx
 * import { VerificationCaptureEngine } from '@usesense/web-sdk';
 *
 * <VerificationCaptureEngine
 *   sessionData={sessionData}
 *   environment="production"
 *   anonKey="your-anon-key"
 *   onComplete={(result) => console.log(result)}
 *   onError={(error) => console.error(error)}
 * />
 * ```
 *
 * @example Vanilla JavaScript
 * ```js
 * import { UseSenseSDK } from '@usesense/web-sdk';
 *
 * const sdk = new UseSenseSDK({ apiKey: '...', environment: 'production' });
 * sdk.on('complete', (result) => console.log(result));
 * sdk.start();
 * ```
 */

// ── Main React Component ────────────────────────────────────────────────
export { VerificationCaptureEngine } from './components/VerificationCaptureEngine';

// ── Vanilla JS SDK ──────────────────────────────────────────────────────
export { UseSenseSDK } from './sdk';

// ── API Client ──────────────────────────────────────────────────────────
export { createSession, uploadSignals, completeSession } from './api-client';

// ── Capture Utilities ───────────────────────────────────────────────────
export { collectWebIntegritySignals } from './capture/web-integrity';
export {
  initFaceMesh,
  isFaceMeshReady,
  disposeFaceMesh,
  evaluateFaceGuide,
  extractFrameSignal,
  fitOnDevice3DMM,
  computeCrossFrameConsistency,
  computePreliminaryGCScore,
} from './capture/media-pipe';

// ── Crypto Utilities ────────────────────────────────────────────────────
export {
  hashFrame,
  computeMeshDigest,
  computeBindingProof,
  hexToBytes,
  bytesToHex,
} from './utils/crypto';

// ── Error Utilities ─────────────────────────────────────────────────────
export { createError, getCameraErrorMessage, getUserMessage } from './utils/errors';

// ── Environment Utilities ────────────────────────────────────────────────
export { detectEnvironmentFromKey } from './utils/env';

// ── Types ───────────────────────────────────────────────────────────────
export type {
  // Core
  SessionType,
  Environment,
  ChallengeType,
  Decision,
  CapturePhase,

  // Session data
  CaptureSessionData,
  PolicyData,
  UploadConfig,
  GeometricCoherenceConfig,

  // Challenge specs
  FollowDotChallenge,
  FollowDotWaypoint,
  HeadTurnChallenge,
  HeadTurnStep,
  SpeakPhraseChallenge,

  // Results
  CaptureResult,

  // Face guide
  FaceGuideStatus,

  // MediaPipe / Mesh
  FrameSignal,
  OnDevice3DMMFit,
  VerificationFrame,
  VerificationPackage,

  // Web integrity
  WebIntegritySignals,

  // Challenge responses
  ChallengeResponse,
  FollowDotChallengeResponse,
  HeadTurnChallengeResponse,
  SpeakPhraseChallengeResponse,
  NoneChallengeResponse,

  // Metadata
  SignalMetadata,

  // API
  CreateSessionResponse,
  UploadSignalsResponse,
  CompleteSessionResponse,

  // Component props
  VerificationCaptureEngineProps,

  // SDK config
  UseSenseSDKConfig,

  // Errors
  ErrorCode,
  UseSenseError,
} from './types';
