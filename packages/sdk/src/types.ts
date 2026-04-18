/**
 * UseSense Web SDK v4.1.0 -- Type Definitions
 *
 * Aligned with the Unified Technical Specification v4.1.
 */

// ============================================================================
// Core Enums / Union Types
// ============================================================================

export type SessionType = 'enrollment' | 'authentication';

export type Environment = 'sandbox' | 'production';

export type ChallengeType = 'none' | 'follow_dot' | 'head_turn' | 'speak_phrase';

export type Decision = 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';

export type CapturePhase =
  | 'intro'
  | 'initializing'
  | 'camera-request'
  | 'camera-error'
  | 'challenge-brief'
  | 'face-guide'
  | 'baseline'
  | 'countdown'
  | 'challenge'
  | 'step-up-intro'
  | 'step-up-flash'
  | 'step-up-rmas'
  | 'step-up-complete'
  | 'uploading'
  | 'completing'
  | 'done';

// ============================================================================
// Session Data (passed from backend to SDK)
// ============================================================================

/** Inline Step-Up policy from session creation response. */
export interface InlineStepUpPolicy {
  enabled: boolean;
  suspicion_threshold: number;
  preferred_challenge: 'auto' | 'flash_reflection' | 'rmas';
}

export interface PolicyData {
  challenge_type: ChallengeType;
  challenge?: FollowDotChallenge | HeadTurnChallenge | null;
  audio_challenge?: SpeakPhraseChallenge | null;
  requires_stepup?: boolean;
  requires_audio?: boolean;
  policy_source?: string;
  capture_fps_hint?: number;
  inline_step_up?: InlineStepUpPolicy;
  /** Server-side GC policy (informational, SDK reads but does not act on directly). */
  geometricCoherence?: Record<string, any>;
  /** Server-side screen illumination policy. */
  screenIllumination?: Record<string, any>;
  /** Server-side mesh integrity policy. */
  meshIntegrity?: Record<string, any>;
}

export interface UploadConfig {
  max_frames: number;
  target_fps: number;
  capture_duration_ms: number;
}

export interface GeometricCoherenceConfig {
  dual_path_enabled?: boolean;
  on_device_3dmm_required?: boolean;
  screen_illumination_enabled?: boolean;
  mesh_binding_challenge?: string | null;
}

/**
 * Session data returned by the server from POST /v1/sessions.
 * Pass this to the SDK via the `sessionData` prop or `startWithSession()`.
 */
export interface CaptureSessionData {
  session_id: string;
  session_token: string;
  nonce: string;
  expires_at?: string;
  policy: PolicyData;
  upload: UploadConfig;
  geometric_coherence?: GeometricCoherenceConfig | null;
  /**
   * SNR Phase 1 challenge envelope. Present only on web sessions created
   * with `assurance_level='high'` while `SNR_P1_ENABLED` is on server-side.
   * When absent, the SDK runs the legacy capture flow unchanged.
   *
   * The SDK treats the entire object as opaque and uploads it untouched
   * as part of the signals payload. See packages/sdk/src/snr/.
   */
  challenge?: import('./snr/SNRChallengeController').SNRChallengeEnvelope;
}

// ============================================================================
// Server-Side Init (create-token / exchange-token)
// ============================================================================

/** Response from POST /v1/sessions/create-token (called by integrator backend). */
export interface CreateTokenResponse {
  client_token: string;
  expires_at: string;
}

/** Response from POST /v1/sessions/exchange-token (called by SDK client). */
export interface ExchangeTokenResponse extends CaptureSessionData {
  expires_at: string;
}

// ============================================================================
// Challenge Specs (server-driven)
// ============================================================================

export interface FollowDotWaypoint {
  x: number;
  y: number;
  duration_ms: number;
  index: number;
}

export interface FollowDotChallenge {
  type: 'follow_dot';
  seed: string;
  waypoints: FollowDotWaypoint[];
  dot_size_px?: number;
  total_duration_ms?: number;
  frames_per_step?: number;
  capture_fps_hint?: number;
  generated_at?: string;
}

export interface HeadTurnStep {
  direction: 'left' | 'right' | 'up' | 'down' | 'center';
  duration_ms: number;
  index: number;
}

export interface HeadTurnChallenge {
  type: 'head_turn';
  seed: string;
  sequence: HeadTurnStep[];
  total_duration_ms?: number;
  frames_per_step?: number;
  capture_fps_hint?: number;
}

export interface SpeakPhraseChallenge {
  type: 'speak_phrase';
  seed: string;
  phrase: string;
  phrase_language?: string;
  total_duration_ms: number;
}

// ============================================================================
// Capture Result (returned to host via onComplete)
// ============================================================================

export interface PillarVerdict {
  score?: number;
  verdict?: string;
}

export interface CaptureResult {
  session_id: string;
  session_type?: SessionType;
  decision: Decision;
  identity_id?: string;
  channel_trust_score?: number;
  liveness_score?: number;
  dedupe_risk_score?: number;
  pillar_verdicts?: {
    channel_trust?: string | PillarVerdict;
    liveness?: string | PillarVerdict;
    dedupe?: string | PillarVerdict;
  };
  reasons?: string[];
  timestamp?: string;
  [key: string]: any;
}

// ============================================================================
// Face Guide
// ============================================================================

export interface FaceGuideStatus {
  faceDetected: boolean;
  faceCentered: boolean;
  faceDistance: 'too_close' | 'too_far' | 'good';
  faceVisible: boolean;
  message: string;
  ready: boolean;
}

// ============================================================================
// MediaPipe / On-Device Mesh
// ============================================================================

export interface FrameSignal {
  timestamp: number;
  frameIndex: number;
  phase: 'baseline' | 'challenge';
  landmarks: number[];
  headPose: { yaw: number; pitch: number; roll: number };
  facialTransformationMatrix?: number[];
  blendshapes?: Array<{ categoryName: string; score: number }>;
  leftEAR: number;
  rightEAR: number;
  bbox: { x: number; y: number; w: number; h: number };
}

export interface OnDevice3DMMFit {
  shapeParams: number[];
  pose: { yaw: number; pitch: number; roll: number };
  depthPlausibility: number;
  geometricRatios: number[];
  poseRatios2D: number[];
}

export interface VerificationFrame {
  frameIndex: number;
  timestamp: number;
  shapeParams: number[];
  pose: { yaw: number; pitch: number; roll: number };
  depthPlausibility: number;
  geometricRatios: number[];
  poseRatios2D: number[];
  /** Flat landmark array [x0,y0,z0, x1,y1,z1, ...] required for server-side digest verification. */
  landmarks: number[];
  frameHash: string;
  meshDigest: string;
  bindingProof: string;
  poseNormalizationMethod: string;
}

export interface VerificationPackage {
  frames: VerificationFrame[];
  crossFrameConsistency: number;
  preliminaryScore: number;
  attestation: {
    platform: 'web';
  };
}

// ============================================================================
// Face Mesh Signals (uploaded alongside verification_package)
// ============================================================================

export interface FaceMeshFrameSignal {
  frame_index: number;
  timestamp_ms: number;
  headPose: { yaw: number; pitch: number; roll: number };
  leftEAR: number;
  rightEAR: number;
  bbox: { x: number; y: number; w: number; h: number };
}

export interface FaceMeshSignals {
  model: string;
  frame_count: number;
  frames: FaceMeshFrameSignal[];
}

// ============================================================================
// Web Integrity Signals (DeepSense) -- must match backend channel_integrity spec
// ============================================================================

export interface FeatureSupportSignals {
  supports_webgl: boolean;
  supports_webgl2: boolean;
  supports_web_audio: boolean;
  supports_webrtc: boolean;
  supports_media_recorder: boolean;
  supports_wasm: boolean;
  supports_service_worker: boolean;
  supports_intersection_observer: boolean;
  supports_web_crypto: boolean;
  supports_shared_array_buffer: boolean;
}

export interface PermissionsStateSignals {
  camera: string;
  microphone: string;
  geolocation: string;
  notifications: string;
}

export interface BatterySignals {
  charging: boolean;
  level: number;
}

export interface ConnectionSignals {
  effective_type: string | null;
  downlink: number | null;
  rtt: number | null;
  save_data: boolean | null;
}

export interface ScreenDetectionSignals {
  luminance_histogram_spread: number;
  edge_energy_ratio: number;
  frame_luminance_cv: number;
  color_channel_uniformity: number;
}

export interface WebIntegritySignals {
  // Channel identifier
  channel_type?: string;

  // Identity / automation
  user_agent: string;
  webdriver: boolean;
  do_not_track: string | null;
  automation_detected?: boolean;

  // Document state
  cookie_enabled: boolean;
  has_focus: boolean;
  visibility_state: string;

  // Hardware
  hardware_concurrency: number | null;
  device_memory: number | null;
  max_touch_points: number | null;

  // Screen / viewport
  screen_resolution: string;
  screen_available: string;
  color_depth: number | null;
  viewport_size: string;
  device_pixel_ratio: number;

  // Locale
  timezone: string | null;
  timezone_offset: number;
  language: string;
  languages: string[];

  // Fingerprinting
  canvas_hash: number | null;
  webgl_vendor: string | null;
  webgl_renderer: string | null;
  webgl_extensions?: string[];
  audio_fingerprint?: number | null;

  // Frame timing (populated at upload time)
  avg_frame_interval_ms: number;
  frame_timestamps: number[];

  // Camera outcome (populated at upload time)
  camera_permission_granted?: boolean;
  camera_resolution?: string;

  // Screen detection (v4.1)
  screen_detection?: ScreenDetectionSignals;

  // Nested objects
  feature_support: FeatureSupportSignals;
  permissions_state: PermissionsStateSignals;
  battery?: BatterySignals;
  connection?: ConnectionSignals;

  // Collection timestamp
  collected_at?: string;
}

// ============================================================================
// Suspicion Engine (Chapter 7)
// ============================================================================

export interface SuspicionSignal {
  name: string;
  score: number;
  weight: number;
  detail: string;
}

export interface SuspicionSnapshot {
  score: number;
  signals: SuspicionSignal[];
  framesAnalyzed: number;
  reliable: boolean;
  timestamp: number;
}

export interface SuspicionData {
  final_score: number;
  triggered: boolean;
  snapshot: SuspicionSnapshot;
}

// ============================================================================
// Inline Step-Up Evidence (Chapter 7)
// ============================================================================

export interface FlashResult {
  color: string;
  durationMs: number;
  baselineRgb: [number, number, number];
  flashRgb: [number, number, number];
  colorDelta: number;
  reflectionDetected: boolean;
}

export interface FlashReflectionEvidence {
  type: 'flash_reflection';
  flashes: FlashResult[];
  passed: boolean;
  confidence: number;
  overallColorDelta: number;
}

export interface RMASAction {
  actionType: string;
  label: string;
  windowMs: number;
  completed: boolean;
  reactionTimeMs: number | null;
}

export interface RMASEvidence {
  type: 'rmas';
  actions: RMASAction[];
  passed: boolean;
  confidence: number;
  actionsCompleted: number;
  actionsTotal: number;
}

export interface InlineStepUpEvidence {
  challengesRun: string[];
  triggerSuspicionScore: number;
  flashReflection: FlashReflectionEvidence | null;
  rmas: RMASEvidence | null;
  passed: boolean;
  hardReject: boolean;
  timestamp: string;
}

// ============================================================================
// Challenge Response (for metadata upload)
// ============================================================================

export interface ChallengeResponseBase {
  type: ChallengeType;
  seed: string;
  completed: boolean;
  started_at: string | null;
  completed_at: string | null;
  frame_timestamps?: number[];
}

export interface FollowDotChallengeResponse extends ChallengeResponseBase {
  type: 'follow_dot';
  waypoint_frames: Record<string, number[]>;
}

export interface HeadTurnChallengeResponse extends ChallengeResponseBase {
  type: 'head_turn';
  step_frames: Record<string, number[]>;
}

export interface SpeakPhraseChallengeResponse extends ChallengeResponseBase {
  type: 'speak_phrase';
}

export interface NoneChallengeResponse {
  type: 'none';
  completed: boolean;
}

export type ChallengeResponse =
  | FollowDotChallengeResponse
  | HeadTurnChallengeResponse
  | SpeakPhraseChallengeResponse
  | NoneChallengeResponse
  | null;

// ============================================================================
// Frames Manifest
// ============================================================================

export interface FramesManifestEntry {
  frame_index: number;
  capture_timestamp_ms: number;
  resolution_w: number;
  resolution_h: number;
}

// ============================================================================
// Metadata Payload (uploaded to /signals) -- v4.1 schema
// ============================================================================

export interface SignalMetadata {
  session_id: string;
  sdk_version: string;
  platform: string;
  source: string;

  capture_config: {
    captureDurationMs: number;
    targetFps: number;
    maxFrames: number;
  };

  timestamps: {
    session_started_at_ms: number;
    capture_started_at_ms: number;
    capture_ended_at_ms: number;
  };

  frames_manifest: FramesManifestEntry[];
  frame_hashes: string[];

  channel_integrity: WebIntegritySignals;
  challenge_response: ChallengeResponse;
  face_mesh_signals: FaceMeshSignals | null;
  verification_package: VerificationPackage | null;

  suspicion: SuspicionData;
  inline_step_up: InlineStepUpEvidence | null;
  /**
   * SNR Phase 1 challenge evidence. Present only when the session was
   * issued an SNR challenge (`CaptureSessionData.challenge`). Shape lives
   * at `snr/upload.ts:SNRUploadPayload` so the SDK and server stay in
   * sync on wire format without a circular import from there.
   */
  snr?: import('./snr/upload').SNRUploadPayload;
}

// ============================================================================
// API Responses
// ============================================================================

export interface CreateSessionResponse extends CaptureSessionData {
  expires_at: string;
}

export interface UploadSignalsResponse {
  received?: boolean;
  success?: boolean;
  frames_received?: number;
  frames_count?: number;
  stored?: boolean;
  audio_received?: boolean;
  metadata_received?: boolean;
  total_size_bytes?: number;
  session_id?: string;
}

export interface CompleteSessionResponse extends CaptureResult {}

// ============================================================================
// Component Props
// ============================================================================

export interface VerificationCaptureEngineProps {
  /** Session data from your backend (Pattern A) or from SDK session creation */
  sessionData: CaptureSessionData;

  /** Environment for API calls. If omitted, inferred from the API key prefix. */
  environment?: Environment;

  /** API base URL. Defaults to https://api.usesense.ai/v1 */
  apiBaseUrl?: string;

  /** Primary brand color (hex). Default: #4F7CFF */
  primaryColor?: string;

  /** Logo URL to display during capture */
  logoUrl?: string;

  /** Organization display name */
  displayName?: string;

  /** Session type (for result screen messaging) */
  sessionType?: SessionType;

  /** Called when verification completes with a decision */
  onComplete: (result: CaptureResult) => void;

  /** Called on any error */
  onError: (error: string) => void;

  /** Called when the user cancels. If omitted, no Cancel button is shown. */
  onCancel?: () => void;

  /** Called on phase transitions */
  onPhaseChange?: (phase: CapturePhase, label: string) => void;
}

// ============================================================================
// SDK Configuration (Vanilla JS API)
// ============================================================================

export interface UseSenseSDKConfig {
  /** API key for direct session creation (Pattern B). Omit for Pattern A. */
  apiKey?: string;

  /** API base URL */
  apiBaseUrl?: string;

  /** Environment */
  environment?: Environment;

  /** DOM element to mount the SDK into */
  mountTo?: HTMLElement | null;

  /** Session type */
  sessionType?: SessionType;

  /** Identity ID (required for authentication) */
  identityId?: string;

  /** External user ID (for enrollment) */
  externalUserId?: string;

  /** Optional metadata passed to session creation */
  metadata?: Record<string, any>;

  /** Primary brand color */
  primaryColor?: string;

  /** Logo URL */
  logoUrl?: string;

  /** Organization display name */
  displayName?: string;

  /** Callbacks */
  onResult?: (result: CaptureResult) => void;
  onError?: (error: string) => void;
  onPhaseChange?: (phase: CapturePhase, label: string) => void;
}

// ============================================================================
// Error Types
// ============================================================================

export type ErrorCode =
  | 'CAMERA_PERMISSION_DENIED'
  | 'CAMERA_NOT_FOUND'
  | 'CAMERA_IN_USE'
  | 'MIC_PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'SESSION_EXPIRED'
  | 'SESSION_NOT_FOUND'
  | 'INVALID_TOKEN'
  | 'NONCE_MISMATCH'
  | 'INSUFFICIENT_CREDITS'
  | 'IDENTITY_BLOCKLISTED'
  | 'IDENTITY_NOT_FOUND'
  | 'INVALID_REQUEST'
  | 'INVALID_UPLOAD'
  | 'UPLOAD_TIMEOUT'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export class UseSenseError extends Error {
  code: ErrorCode;
  details?: any;

  constructor(code: ErrorCode, message: string, details?: any) {
    super(message);
    this.name = 'UseSenseError';
    this.code = code;
    this.details = details;
  }
}
