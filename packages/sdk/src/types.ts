/**
 * UseSense Web SDK v4.1.0 -- Type Definitions
 *
 * Aligned with the Unified Technical Specification v4.1.
 */

import type { CameraInventory, CaptureSourceEvidence } from './capture/capture-source';

// ============================================================================
// Core Enums / Union Types
// ============================================================================

import type { EngineTheme } from './components/styles';
import type { FlowAppearance } from './flows/theme';
import type { FlowCopy } from './flows/copy';

/**
 * The dashboard brand the server sends with a session (session create,
 * token exchange, Flow init-session) and a Flow run view. Every key is
 * optional and present only when configured. See BRAND-v1 and
 * docs/branding-precedence.md in Watchtower.
 */
export interface SessionBranding {
  display_name?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  redirect_url?: string | null;
  appearance?: FlowAppearance | null;
  copy?: FlowCopy | null;
}
import type { EvidenceUpload } from './capture/evidence';

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
  | 'zoom'
  | 'countdown'
  | 'challenge'
  | 'step-up-round'
  | 'step-up-intro'
  | 'step-up-flash'
  | 'step-up-rmas'
  | 'step-up-complete'
  /** Guided capture: the "One more quick check" sheet before a round-2 extra check. */
  | 'extra-check-brief'
  /** Guided capture: the extra check's green "Done" tick, before the upload sheet. */
  | 'extra-check-done'
  /** Guided capture: Speak Digits could not use the microphone ("Microphone needed"). */
  | 'mic-denied'
  /** Guided capture: the upload ran out of retries; the scan is kept for "Try again". */
  | 'upload-failed'
  | 'uploading'
  | 'completing'
  /**
   * Terminal failure after capture (upload or completion failed). Without this
   * the engine stayed on 'uploading' when a request failed, leaving the user on
   * an "Almost done" spinner indefinitely while only the host's onError fired.
   */
  | 'failed'
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
 * The optional `evidence` block from session create, Flow init-session and
 * token exchange (capture-test-kit/EVIDENCE-v1.md section 1). Every key is
 * optional and unknown keys are ignored; a contract other than
 * "evidence-v1" is treated as absent.
 */
export interface EvidenceSessionBlock {
  contract?: string;
  colour_sequence?: {
    id?: string;
    colours?: string[];
    segment_ms?: number;
    lead_in_ms?: number;
    opacity?: number;
  } | null;
  closer_step?: { enabled?: boolean; target_scale?: number; min_scale?: number } | null;
  binding_v2?: { enabled?: boolean } | null;
  landmarks?: { required?: boolean; format?: string } | null;
  [key: string]: unknown;
}

/**
 * Session data returned by the server from POST /v1/sessions.
 * Pass this to the SDK via the `sessionData` prop or `startWithSession()`.
 */
export interface CaptureSessionData {
  session_id: string;
  session_token: string;
  nonce: string;
  /**
   * Environment the session was created in, as stamped by the server from the
   * API key used. Optional for wire-compatibility with older backends; when
   * present the capture engine prefers it over any local default.
   */
  environment?: Environment;
  expires_at?: string;
  policy: PolicyData;
  upload: UploadConfig;
  geometric_coherence?: GeometricCoherenceConfig | null;
  /**
   * LiveSense evidence contract (EVIDENCE-v1) issued with the session.
   * Optional: older servers never send it, and the capture then uploads
   * exactly as before. Pass the server's object through unchanged.
   */
  evidence?: EvidenceSessionBlock | null;
  /**
   * The dashboard brand for this session (org, and the Flow's own brand in
   * a Flow), sent by the server on session create and token exchange. The
   * capture screens resolve it under any code-level brand (BRAND-v1).
   */
  branding?: SessionBranding | null;
  /**
   * Kept as unknown for wire-format compatibility. The server never issues
   * this field post-revert; the client runs the legacy flow unchanged when
   * it is absent. Removed the SNRChallengeEnvelope type import in X-9.
   */
  challenge?: unknown;
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
  /**
   * Capture-clock time of the frame (integer ms since the camera opened),
   * set by the capture engine. EVIDENCE-v1's one clock.
   */
  captureMs?: number;
  frameIndex: number;
  phase: 'baseline' | 'zoom' | 'challenge';
  landmarks: number[];
  headPose: { yaw: number; pitch: number; roll: number };
  facialTransformationMatrix?: ArrayLike<number>;
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
  /** Upload position of the JPEG this entry describes (EVIDENCE-v1 section 3). */
  frameIndex: number;
  /** With an evidence block: capture-clock ms (since the camera opened); otherwise Unix ms. */
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
  /** 'matrix_zyx_v3' (pose from transformMatrix) with an evidence block; 'mediapipe_zyx_v2' otherwise. */
  poseNormalizationMethod: string;
  /** EVIDENCE-v1: facial transformation matrix, 16 values row-major, 5 decimals. */
  transformMatrix?: number[];
  /** EVIDENCE-v1: eye blendshapes from the same landmarker result, 3 decimals. */
  blendshapes?: { eyeBlinkLeft: number; eyeBlinkRight: number };
}

export interface VerificationPackage {
  frames: VerificationFrame[];
  /**
   * Cross-frame shape consistency (0-100), or null when it could not be
   * measured (fewer than two frames with usable shape params). null and 0 are
   * different claims: 0 means the frames genuinely disagreed, which is what a
   * spoof produces.
   */
  crossFrameConsistency: number | null;
  /**
   * Which metric produced crossFrameConsistency. 'cv_v1' is the server's
   * coefficient-of-variation metric, which tells the server it can trust the
   * value verbatim instead of recomputing it. See usesense-watchtower#795.
   */
  crossFrameConsistencyMethod?: 'cv_v1';
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

  /**
   * Video-input inventory from enumerateDevices(), collected without opening
   * the camera (labels only once camera permission is held). Client-reported
   * evidence for the server's virtual-camera check (G03).
   */
  camera_inventory?: CameraInventory;
  /**
   * Capture-source evidence for the camera that fed the capture (label,
   * deviceId hash, settings, capabilities, inventory). Set at upload.
   * Client-reported; the server re-checks it and never trusts it alone.
   */
  capture_source?: CaptureSourceEvidence;

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
  /** What this SDK can do (e.g. "step_up_v1"), for sessions the integrator's backend created. */
  client_capabilities?: string[];

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
   * v4.2: Per-frame spoof probabilities from the on-device antispoof
   * classifier. Null when antispoofOnDeviceEnabled is false, the model is
   * unavailable, or no frames were scored. Backend treats null as "use the
   * server classifier".
   */
  deep_classifier_on_device?: DeepClassifierOnDevice | null;
  /**
   * LiveSense evidence contract (EVIDENCE-v1 section 2): capability, the
   * colour sequence as shown, and the web closer-step skip. Round 1 only, and
   * only when the session carried an evidence block.
   */
  evidence?: EvidenceUpload;
}

/** Per-frame output from the on-device antispoof classifier. */
export interface OnDeviceClassifierSample {
  frameIndex: number;
  spoofProbability: number;
  latencyMs: number;
  modelVersion: string;
  backbone: string;
}

export interface DeepClassifierOnDevice {
  modelVersion: string;
  backbone: string;
  threshold: number;
  samples: OnDeviceClassifierSample[];
}

// ============================================================================
// API Responses
// ============================================================================

export interface CreateSessionResponse extends CaptureSessionData {
  expires_at: string;
}

export interface UploadSignalsResponse {
  /**
   * Present when a server Step-up rule matched round 1: run this challenge in
   * the same session, upload it with round=2, then complete.
   */
  step_up?: {
    round: number;
    challenge: HeadTurnChallenge | FollowDotChallenge | Record<string, unknown>;
    upload?: { max_frames?: number; round_param?: string };
  };
  /** Set on a round-2 upload. */
  round?: number;
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

  /**
   * Environment for API calls.
   *
   * If omitted, the SDK uses `sessionData.environment` (returned by session
   * creation) and falls back to `'production'`. Pass this explicitly only to
   * override that. Note it must match the environment of the API key that
   * created the session -- a mismatch makes the session unresolvable.
   */
  environment?: Environment;

  /** API base URL. Defaults to https://api.usesense.ai/v1 */
  apiBaseUrl?: string;

  /**
   * Primary brand colour (hex), legacy field. Above the dashboard's
   * appearance, below `appearance.colors.primary` (BRAND-v1 section 2).
   * Unset: the dashboard's colour, else #4F7CFF.
   */
  primaryColor?: string;

  /** Logo URL for the page screens (legacy; `appearance.logo.url` wins). */
  logoUrl?: string;

  /** Display name: the header when there is no logo, and `{app}` in copy. Else the dashboard's. */
  displayName?: string;

  /**
   * White-label appearance for every capture screen (BRAND-v1): page
   * colours per mode, fonts, shape, logo, result illustrations, loader and
   * camera accents. Code layer: merged over the session's dashboard
   * `branding.appearance` field by field. Omit to inherit the dashboard
   * brand, then the Sense look.
   */
  appearance?: FlowAppearance;

  /**
   * White-label copy. The capture screens read `copy.capture` (BRAND-v1
   * section 5), merged over the dashboard's copy key by key. A blank value
   * keeps the default.
   */
  copy?: FlowCopy;

  /**
   * Dashboard brand the host already has, e.g. a Flow run view's
   * `branding`. Layered over `sessionData.branding` and under the code
   * fields above. Most integrations leave this unset.
   */
  branding?: SessionBranding | null;

  /**
   * Design tokens for the capture UI (legacy). Prefer `appearance`. A theme
   * from `flowThemeToEngineTheme` carries its source appearance, which is
   * used as-is; a hand-built one applies its colours in both modes.
   */
  theme?: EngineTheme;

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

  /**
   * Called when the camera stream is lost mid-capture (a video track ends or
   * the stream goes inactive) during the align, scan, countdown, challenge or
   * step-up phases. The engine stops capturing, never uploads the partial
   * capture, and shows its camera-error screen; a host that runs its own
   * retry screen (e.g. with a retry limit) can unmount the engine here.
   */
  onStreamInterrupted?: () => void;

  /**
   * Show the engine's intro screen before the camera starts. Default true.
   * When false the engine starts initialising as soon as it mounts, for hosts
   * that render their own primer.
   */
  showIntro?: boolean;

  /**
   * Show the engine's result screen after a decision. Default true. When
   * false the engine renders nothing once onComplete has fired, for hosts
   * that own the completion screen.
   */
  showResultScreen?: boolean;

  /**
   * Offer "Try again" (with tips) on the rejected result screen. Default
   * false: a rejection points the person back to the app. Turn it on only
   * when your flow allows another attempt. Pair with `onRetry` to start the
   * new attempt on a fresh session; without it the engine captures again on
   * the same session.
   */
  allowRetryOnReject?: boolean;

  /**
   * Called when the person taps "Try again" on the rejected result screen
   * (only shown with `allowRetryOnReject`). Create a new session and remount
   * the engine with it.
   */
  onRetry?: () => void;

  /**
   * v4.2: Opt in to the on-device antispoof classifier. See
   * UseSenseSDKConfig.antispoofOnDeviceEnabled for the full contract.
   */
  antispoofOnDeviceEnabled?: boolean;

  /**
   * v4: opt the capture engine into the LiveSense v4 flow (zoom-motion phase
   * + per-frame phase tags + v4 SDK header).
   */
  liveSenseV4Enabled?: boolean;

  /**
   * Guided capture (LiveSense capture redesign, Phase 1). Default true.
   *
   * When on, capture is blocked until the face is found, alone, inside the
   * oval, at the right distance, facing the screen, well lit, sharp, with
   * eyes open and still. One hint shows at a time, the scan starts by itself,
   * movement pauses it instead of restarting it, a dim face gets a screen
   * fill light, and a shutter button appears if auto start keeps failing or
   * MediaPipe cannot load. It changes the experience only: what is uploaded
   * and how it is scored are unchanged.
   *
   * Set false to keep the previous "I'm Ready" flow.
   */
  guidedCaptureEnabled?: boolean;
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

  /**
   * White-label appearance for the capture screens (BRAND-v1). Merged over
   * the dashboard brand the server sends with the session, field by field.
   * Legacy `primaryColor` / `logoUrl` sit between the two.
   */
  appearance?: FlowAppearance;

  /** White-label copy; the capture screens read `copy.capture` (BRAND-v1 section 5). */
  copy?: FlowCopy;

  /**
   * Design tokens (legacy, same as the React engine's `theme` prop). Prefer
   * `appearance`.
   */
  theme?: EngineTheme;

  /** Callbacks */
  onResult?: (result: CaptureResult) => void;
  onError?: (error: string) => void;
  onPhaseChange?: (phase: CapturePhase, label: string) => void;

  /**
   * v4.2: Opt in to the on-device antispoof classifier. When enabled the SDK
   * lazy-loads onnxruntime-web, downloads the bundled CelebA-Spoof ONNX model,
   * and scores each captured face frame locally. Per-frame spoof probabilities
   * are uploaded as signals.deep_classifier_on_device. When disabled (default)
   * the watchtower backend runs the classifier server-side.
   *
   * Loading the WASM runtime and model costs ~300-500 ms on first use. Gate
   * behind a capability check (wasmSimd / webgpu) in your host integration.
   */
  antispoofOnDeviceEnabled?: boolean;

  /**
   * Opt the session into the LiveSense v4 capture flow. When true the SDK:
   *   - sends `x-usesense-sdk-version: v4` on session creation
   *   - inserts a constitutive zoom-motion phase into the capture flow
   *   - tags every captured frame with its capture phase
   * The org must also have features.livesense_v4_enabled=true.
   */
  liveSenseV4Enabled?: boolean;

  /**
   * Guided capture (quality gate, auto start, pause instead of restart, fill
   * light, shutter fallback, contour scan). Default true. Set false to keep
   * the previous "I'm Ready" flow. See
   * VerificationCaptureEngineProps.guidedCaptureEnabled.
   */
  guidedCaptureEnabled?: boolean;

  /**
   * Offer "Try again" on the rejected result screen. Default false. See
   * VerificationCaptureEngineProps.allowRetryOnReject.
   */
  allowRetryOnReject?: boolean;
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

/** Metadata for a server step-up round (round 2): only what that round needs. */
export interface StepUpRoundMetadata {
  session_id: string;
  sdk_version: string;
  platform: string;
  source: string;
  step_up_round: 2;
  client_capabilities: string[];
  challenge_response: Record<string, unknown>;
  frame_hashes: string[];
  frames_manifest: FramesManifestEntry[];
  face_mesh_signals: FaceMeshSignals | null;
  timestamps: { capture_started_at_ms: number; capture_ended_at_ms: number };
  /**
   * The same signals as round 1, in the same keys, for this round's frames,
   * so the server runs the same checks on the extra check (after-the-scan
   * rules, the anti-spoof classifier, the second-face check).
   */
  channel_integrity?: WebIntegritySignals;
  suspicion?: SuspicionData;
  verification_package?: SignalMetadata['verification_package'];
  deep_classifier_on_device?: SignalMetadata['deep_classifier_on_device'];
}
