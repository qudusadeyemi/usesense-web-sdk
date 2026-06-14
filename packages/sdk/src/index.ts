/**
 * UseSense Web SDK v4.1.0
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

// ── LiveSense v4: Zoom Motion UI (X-2) ──────────────────────────────────
export {
  ZoomPrompt,
  ZOOM_PROMPT_TRANSITION_MS,
  ZOOM_PROMPT_ENLARGED_SCALE,
} from './components/ZoomPrompt';
export type {
  ZoomPromptProps,
  ZoomOvalState,
  ZoomGuidanceTone,
} from './components/ZoomPrompt';

// ── LiveSense v4 Capture Engine (X-5 + X-7) ─────────────────────────────
export { V4CaptureEngine } from './components/V4CaptureEngine';
export type {
  V4CaptureEngineProps,
  V4Phase,
  V4Verdict,
} from './components/V4CaptureEngine';

// ── Vanilla JS SDK ──────────────────────────────────────────────────────
export { UseSenseSDK } from './sdk';

// ── Flows ───────────────────────────────────────────────────────────────
// Coexists with Sessions: parallel entry point, not a replacement. See
// guides/flows/sessions-vs-flows in the API docs for when to use which.
export { flows, FlowRunner, createFlowsClient, FlowError } from './flows';
export type {
  CameraFacing, CaptureHints,
  FlowsClient, FlowsClientOptions, InitSessionResponse, UploadDocumentResponse,
  FlowErrorCode, FlowOutcome, FlowRunResult, FlowRunState, FlowRunView,
  FormField, FormFieldError, FormFieldType,
  InfoAction, InfoBullet, InfoBulletIcon, InfoCta, InfoSecondaryCta,
  PendingAction, RunFlowOptions,
} from './flows';

// ── API Client ──────────────────────────────────────────────────────────
export { createSession, uploadSignals, completeSession, exchangeToken } from './api-client';
export type { SdkVersion } from './api-client';

// ── Capture Utilities ───────────────────────────────────────────────────
export { collectWebIntegritySignals } from './capture/web-integrity';
export {
  initFaceMesh,
  isFaceMeshReady,
  disposeFaceMesh,
  preloadMediaPipeAssets,
  evaluateFaceGuide,
  extractFrameSignal,
  fitOnDevice3DMM,
  computeCrossFrameConsistency,
  computePreliminaryGCScore,
} from './capture/media-pipe';

// ── MediaPipe Model Info (canonical sha256, version, CDN URL) ──────────
// Generated/synced by the mediapipe-sdk-sync workflow in usesense-watchtower.
export { MediaPipeModelInfo } from './mediapipe-model-info';

// ── Suspicion Engine ────────────────────────────────────────────────────
export { SuspicionEngine } from './capture/suspicion-engine';

// ── LiveSense v4: Zoom Motion Controller (X-3) ──────────────────────────
export { ZoomMotionController } from './capture/zoom-motion';
export type {
  ZoomObservation,
  ZoomState,
  ZoomFailureReason,
  ZoomMotionStats,
  ZoomMotionConfig,
  ZoomTransitionListener,
  FaceBoundingBox,
  HeadPoseDegrees,
} from './capture/zoom-motion';

// ── LiveSense v4: High-rate frame capture (X-4) ─────────────────────────
export {
  V4FrameCapture,
  V4_JPEG_QUALITY,
  V4_TARGET_FRAME_INTERVAL_MS,
  V4_MAX_FRAMES,
  V4_MIN_FRAMES,
} from './capture/v4-capture';
export type {
  V4CapturedFrame,
  V4CaptureConfig,
  V4CaptureStats,
  V4FrameListener,
} from './capture/v4-capture';

// ── Screen Detection ────────────────────────────────────────────────────
export { computeScreenDetectionSignals } from './capture/screen-detection';

// SNR Phase 1 client code removed in X-9. Server-side revert predates this.

// ── Inline Step-Up ──────────────────────────────────────────────────────
export { runFlashReflection } from './capture/flash-reflection';
export { runRMAS } from './capture/rmas';
export { runStepUp } from './capture/step-up-orchestrator';

// ── Crypto Utilities ────────────────────────────────────────────────────
export {
  hashFrame,
  computeMeshDigest,
  computeBindingProof,
  hexToBytes,
  bytesToHex,
} from './utils/crypto';

// ── LiveSense v4: Hash Chain + Signer (X-6) ─────────────────────────────
export {
  HashChainBuilder,
  WebAuthnSigner,
  EphemeralKeySigner,
  createChainSigner,
  isWebAuthnPlatformAvailable,
  buildChainUploadPayload,
} from './capture/hash-chain';
export type {
  ChainSigner,
  ChainAssuranceLevel,
  ChainUploadPayload,
  ChainSignerFactoryOptions,
  WebAuthnCredentialLike,
} from './capture/hash-chain';

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
  InlineStepUpPolicy,

  // Server-side init
  CreateTokenResponse,
  ExchangeTokenResponse,

  // Challenge specs
  FollowDotChallenge,
  FollowDotWaypoint,
  HeadTurnChallenge,
  HeadTurnStep,
  SpeakPhraseChallenge,

  // Results
  PillarVerdict,
  CaptureResult,

  // Face guide
  FaceGuideStatus,

  // MediaPipe / Mesh
  FrameSignal,
  OnDevice3DMMFit,
  VerificationFrame,
  VerificationPackage,
  FaceMeshFrameSignal,
  FaceMeshSignals,

  // Web integrity
  WebIntegritySignals,
  ScreenDetectionSignals,

  // Suspicion
  SuspicionSignal,
  SuspicionSnapshot,
  SuspicionData,

  // Inline Step-Up
  FlashResult,
  FlashReflectionEvidence,
  RMASAction,
  RMASEvidence,
  InlineStepUpEvidence,

  // Challenge responses
  ChallengeResponse,
  FollowDotChallengeResponse,
  HeadTurnChallengeResponse,
  SpeakPhraseChallengeResponse,
  NoneChallengeResponse,

  // Metadata
  SignalMetadata,
  FramesManifestEntry,

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
