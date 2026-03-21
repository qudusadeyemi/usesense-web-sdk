/**
 * UseSense Web SDK
 *
 * A production-quality SDK for human verification flows
 * with comprehensive signal collection for LiveSense and DeepSense.
 *
 * Server v1.10.8 compatible — Two-Phase Capture
 */

// Main client
export { createUseSenseClient } from './client';

// React component
export { UseSenseVerification } from './components/UseSenseVerification';

// Two-phase capture result type (for advanced integrations)
export type { TwoPhaseCaptureResult } from './components/screens/ChallengeScreen';

// Image quality analysis (for advanced integrations)
export { ImageQualityAnalyzer } from './capture/image-quality';
export type {
  ImageQualityReport,
  BlurAnalysis,
  LightingAnalysis,
  QualityGuidance,
  QualityLevel,
} from './capture/image-quality';

// Quality indicator component
export { QualityIndicator } from './components/QualityIndicator';

// Types
export type {
  UseSenseConfig,
  UseSenseClient,
  BrandingConfig,
  SDKOptions,
  SessionType,
  Environment,
  AudioMode,
  StepUpPolicy,
  ChallengeType,
  Decision,
  SessionStatus,
  CreateSessionRequest,
  CreateSessionResponse,
  SessionPolicy,
  UploadConfig,
  ChallengeSpec,
  FollowDotChallenge,
  FollowDotWaypoint,
  HeadTurnChallenge,
  HeadTurnStep,
  SpeakPhraseChallenge,
  RedactedDecisionObject,
  SessionStatusResponse,
  UploadSignalsResponse,
  MetadataPayload,
  WebIntegritySignals,
  ChallengeResponse,
  FollowDotChallengeResponse,
  HeadTurnChallengeResponse,
  SpeakPhraseChallengeResponse,
  StartEnrollmentParams,
  StartAuthenticationParams,
  RunVerificationParams,
  VerificationResult,
  UseSenseVerificationProps,
  EventType,
  UseSenseEvent,
  EventCallback,
  UseSenseError,
  ErrorCode,
} from './types';

// Error utilities
export { createError, getUserMessage } from './utils/errors';

// Redaction utility (for advanced integrations that need to redact manually)
export { redactDecision } from './utils/redact';

// Feature detection
export { isWebAuthnSupported } from './integrity/webauthn';