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

// ── Mixed-Mode Verification Flow ────────────────────────────────────────
export { VerificationFlow } from './components/VerificationFlow';
export type { VerificationFlowProps } from './components/VerificationFlow';
export type {
  FlowStep,
  FlowStepResult,
  FlowState,
  FlowStatus,
  MixedFlowResult,
} from './flow/types';
export {
  init as initFlowMachine,
  currentStep as currentFlowStep,
  recordResult as recordFlowResult,
  cancel as cancelFlow,
  isComplete as isFlowComplete,
  toResult as flowToResult,
  progress as flowProgress,
  InvalidFlowError,
} from './flow/flow-machine';

// ── Vanilla JS SDK ──────────────────────────────────────────────────────
export { UseSenseSDK } from './sdk';

// ── API Client ──────────────────────────────────────────────────────────
export { createSession, uploadSignals, completeSession, exchangeToken } from './api-client';

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

// ── Screen Detection ────────────────────────────────────────────────────
export { computeScreenDetectionSignals } from './capture/screen-detection';

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

// ── Error Utilities ─────────────────────────────────────────────────────
export { createError, getCameraErrorMessage, getUserMessage } from './utils/errors';

// ── Environment Utilities ────────────────────────────────────────────────
export { detectEnvironmentFromKey } from './utils/env';

// ── Document Extraction ─────────────────────────────────────────────────
export {
  startDocumentExtraction,
  submitDocumentImage,
  getDocument,
} from './documents';
export type {
  DocumentType,
  DocumentSide,
  DocumentStatus,
  DocumentSession,
  DocumentImage,
  DocumentExtraction,
  DocumentResult,
  StartDocumentExtractionParams,
  SubmitDocumentImageParams,
  GetDocumentParams,
} from './documents';
export {
  prepareDocumentImage,
  computeResizeTarget,
  MAX_PRE_BASE64_BYTES,
  DocumentImageTooLargeError,
} from './prepare-document-image';
export type {
  PrepareDocumentImageParams,
  ResizeInput,
  ResizeTarget,
} from './prepare-document-image';
export { DocumentCapture } from './document-capture';
export type { DocumentCaptureProps } from './document-capture';
export {
  aspectRatioForDocument,
  computeFrameRect,
  STABILITY_THRESHOLDS,
} from './document-capture-helpers';
export type {
  StabilityMetrics,
  StabilityThresholds,
  FrameRect,
} from './document-capture-helpers';

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
