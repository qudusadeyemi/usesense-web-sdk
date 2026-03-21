/**
 * UseSense Web SDK Types
 * Aligned with Server v1.10.8 API specification — Two-Phase Capture
 */

export type SessionType = 'enrollment' | 'authentication';

export type Environment = 'sandbox' | 'production';

export type AudioMode = 'never' | 'risk_based' | 'always';

export type StepUpPolicy = 'risk_based' | 'always' | 'never';

export type ChallengeType = 'none' | 'head_turn' | 'follow_dot' | 'speak_phrase';

export type Decision = 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';

export type SessionStatus = 'created' | 'uploaded' | 'evaluating' | 'completed';

// ============================================================================
// Configuration Types
// ============================================================================

export interface BrandingConfig {
  logoUrl?: string;
  primaryColor?: string;
  buttonRadius?: number;
  fontFamily?: string;
}

export interface SDKOptions {
  audioEnabled?: AudioMode;
  stepUpPolicy?: StepUpPolicy;
  captureDurationMs?: number;
  targetFps?: number;
  maxFrames?: number;
  maxUploadSizeMb?: number;
  webAuthnEnabled?: boolean;
}

export interface UseSenseConfig {
  apiBaseUrl: string;
  apiKey: string;
  /**
   * Supabase anonymous key required by the Edge Functions gateway.
   * This is a public key (not secret) that authenticates requests to the
   * Supabase gateway layer. Defaults to the UseSense production anon key.
   */
  gatewayKey?: string;
  environment?: Environment;
  branding?: BrandingConfig;
  options?: SDKOptions;
}

// ============================================================================
// Backend API Types
// ============================================================================

export interface CreateSessionRequest {
  session_type: SessionType;
  platform: 'web';
  identity_id?: string | null;
  external_user_id?: string;
  metadata?: Record<string, any>;
}

// ── Challenge Specs (server-driven) ──

export interface FollowDotWaypoint {
  x: number;
  y: number;
  duration_ms: number;
  index: number;
}

export interface FollowDotChallenge {
  type: 'follow_dot';
  seed: string;
  generated_at?: string;
  waypoints: FollowDotWaypoint[];
  dot_size_px: number;
  total_duration_ms: number;
  // NEW -- v1.10.7 capture guidance
  frames_per_step?: number;       // minimum frames to tag per waypoint (default: 3)
  capture_fps_hint?: number;      // recommended fps during challenge (default: 10)
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
  total_duration_ms: number;
  // NEW -- v1.10.7 capture guidance
  frames_per_step?: number;       // minimum frames to tag per step (default: 3)
  capture_fps_hint?: number;      // recommended fps during challenge (default: 10)
}

export interface SpeakPhraseChallenge {
  type: 'speak_phrase';
  seed: string;
  phrase: string;
  phrase_language?: string;
  total_duration_ms: number;
}

export type ChallengeSpec = FollowDotChallenge | HeadTurnChallenge | SpeakPhraseChallenge | null;

export interface SessionPolicy {
  requires_audio: boolean;
  requires_stepup: boolean;
  challenge_type: string;
  challenge: ChallengeSpec;
  audio_challenge: SpeakPhraseChallenge | null;
  policy_source?: string;
}

export interface UploadConfig {
  max_frames: number;
  target_fps: number;
  capture_duration_ms: number;
}

export interface CreateSessionResponse {
  session_id: string;
  session_token: string;
  expires_at: string;
  nonce: string;
  policy: SessionPolicy;
  upload: UploadConfig;
}

// ── Pillar Verdicts ──

export interface PillarVerdict {
  score: number;
  verdict: 'pass' | 'borderline' | 'fail';
}

export interface PillarVerdicts {
  deepsense: PillarVerdict;
  livesense: PillarVerdict;
  dedupe: PillarVerdict;
}

export interface RuleOverride {
  ruleId: string;
  ruleName: string;
  matrixDecision: Decision;
  finalDecision: Decision;
  priority: number;
}

export interface VerdictMetadata {
  source?: string;
  logic?: 'weakest_link' | 'majority' | 'weighted_composite';
  hardGateTripped?: boolean;
  thresholdsApplied?: Record<string, { approve: number; review: number }>;
  ruleOverride?: RuleOverride;
}

export interface IntegrityFlag {
  category: string;
  flag: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  detected: boolean;
}

export interface LiveSenseCategory {
  name: string;
  maxPoints: number;
  earnedPoints: number;
  details?: string;
}

export interface LiveSenseFlag {
  id: string;
  label: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  detected: boolean;
  detail?: string;
}

export interface LiveSenseAnalysis {
  score: number;
  confidence: 'high' | 'medium' | 'low';
  framesAnalyzed: number;
  categories: LiveSenseCategory[];
  flags: LiveSenseFlag[];
}

export interface ChallengeStepValidation {
  index: number;
  label: string;
  expected?: any;
  observed?: any;
  framesUsed: number;
  compliant: boolean;
  confidence: number;
  detail?: string;
}

export interface ChallengeValidation {
  challengeType: string;
  issued: boolean;
  responseReceived: boolean;
  seedMatch: boolean;
  completed: boolean;
  steps: ChallengeStepValidation[];
  stepsCompliant: number;
  stepsTotal: number;
  complianceRatio: number;
  overallScore: number;
  verdict: 'pass' | 'partial' | 'fail' | 'not_applicable';
  detail?: string;
}

export interface DedupeMatch {
  identity: string;
  similarity: number;
  sameOrg: boolean;
  name?: string;
  email?: string;
  externalUserId?: string;
  enrolledAt?: string;
}

export interface DedupeAnalysis {
  mode: 'enrollment' | 'authentication';
  duplicateSearchPerformed: boolean;
  duplicateMatches: DedupeMatch[];
  highestDuplicateSimilarity: number;
  crossIdentityRisk: number;
  faceQualityScore?: number;
  verifyConfidence?: number | null;
  components?: Record<string, any>;
}

export interface FinalDecisionObject {
  session_id: string;
  organization_id?: string;
  session_type?: SessionType;
  identity_id?: string;
  decision: Decision;
  matrix_decision?: Decision;
  rule_applied?: string;
  channel_trust_score: number;
  liveness_score: number;
  dedupe_risk_score: number;
  pillar_verdicts?: PillarVerdicts;
  verdict_metadata?: VerdictMetadata;
  reasons?: string[];
  timestamp: string;
  signature?: string;
  debug?: any;
  integrity_flags?: IntegrityFlag[];
  webgl_analysis?: any;
  network_analysis?: any;
  device_velocity?: any;
  livesense_analysis?: LiveSenseAnalysis;
  challenge_validation?: ChallengeValidation;
  dedupe_analysis?: DedupeAnalysis;
  pending_enrollment?: any;
}

/**
 * Redacted decision object — the only decision shape that the SDK exposes
 * to the host application via onComplete / runVerificationSession.
 *
 * All scoring, pillar verdicts, reason strings, and analysis details are
 * stripped to prevent attackers from inspecting or reverse-engineering the
 * verification checks on the client side.
 *
 * The full (unredacted) FinalDecisionObject is available server-side only
 * via the session webhook or dashboard API.
 */
export interface RedactedDecisionObject {
  session_id: string;
  session_type?: SessionType;
  identity_id?: string;
  decision: Decision;
  timestamp: string;
}

export interface SessionStatusResponse {
  session_id: string;
  status: SessionStatus;
  result?: FinalDecisionObject | null;
}

// ============================================================================
// Signal Upload Types
// ============================================================================

export interface UploadSignalsResponse {
  received: boolean;
  session_id: string;
  frames_count: number;
  audio_received: boolean;
  metadata_received: boolean;
  total_size_bytes: number;
}

// ============================================================================
// Web Integrity Types (matches server metadata.json schema)
// ============================================================================

export interface PermissionsState {
  camera: string;
  microphone: string;
}

export interface BatteryInfo {
  charging: boolean;
  level: number;
}

export interface ConnectionInfo {
  effectiveType: string;
  downlink: number;
  rtt: number;
}

export interface FeatureSupport {
  supports_webgl: boolean;
  supports_web_audio: boolean;
  supports_webrtc: boolean;
  supports_media_recorder: boolean;
  supports_wasm: boolean;
  supports_service_worker: boolean;
}

export interface WebIntegritySignals {
  webdriver: boolean;
  permissions_state: PermissionsState;
  webgl_renderer: string | null;
  webgl_vendor: string | null;
  canvas_hash: number;
  screen_resolution: string;
  hardware_concurrency: number;
  device_memory: number;
  color_depth: number;
  cookie_enabled: boolean;
  has_focus: boolean;
  visibility_state: string;
  timezone: string;
  timezone_offset_mismatch?: boolean;
  languages: string[];
  do_not_track: string | null;
  viewport_size: string;
  battery: BatteryInfo | null;
  connection: ConnectionInfo | null;
  feature_support: FeatureSupport;
}

// ============================================================================
// Challenge Response Types (for metadata.json)
// ============================================================================

export interface FollowDotChallengeResponse {
  type: 'follow_dot';
  seed: string;
  completed: boolean;
  waypoint_frames: Record<string, number[]>;
  started_at: string | null;
  completed_at: string | null;
  frame_timestamps: number[];
}

export interface HeadTurnChallengeResponse {
  type: 'head_turn';
  seed: string;
  completed: boolean;
  step_frames: Record<string, number[]>;
  started_at: string | null;
  completed_at: string | null;
  frame_timestamps: number[];
}

export interface SpeakPhraseChallengeResponse {
  type: 'speak_phrase';
  seed: string;
  completed: boolean;
  started_at: string | null;
  completed_at: string | null;
}

export type ChallengeResponse =
  | FollowDotChallengeResponse
  | HeadTurnChallengeResponse
  | SpeakPhraseChallengeResponse
  | null;

export interface WebAuthnData {
  credential_id: string;
  authenticator_data?: string;
  attestation_object_present: boolean;
}

// ============================================================================
// Metadata Payload (metadata.json uploaded to server)
// ============================================================================

export interface MetadataPayload {
  web_integrity: WebIntegritySignals;
  challenge_response: ChallengeResponse;
  webauthn_data: WebAuthnData | null;
}

// ============================================================================
// Capture Types (internal SDK use)
// ============================================================================

export interface FrameMetadata {
  frame_index: number;
  capture_timestamp_ms: number;
  performance_timestamp_ms?: number;
  frame_blob_size_bytes: number;
  resolution_w: number;
  resolution_h: number;
  frame_hash?: string;
}

export interface AudioMetadata {
  audio_mime_type: string;
  audio_duration_ms: number;
  audio_start_timestamp_ms: number;
  audio_end_timestamp_ms: number;
  audio_blob_size_bytes: number;
}

// ============================================================================
// Error Types
// ============================================================================

export type ErrorCode =
  | 'CAMERA_PERMISSION_DENIED'
  | 'MIC_PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'SESSION_EXPIRED'
  | 'UNAUTHORIZED'
  | 'GATEWAY_AUTH_FAILED'
  | 'INVALID_TOKEN'
  | 'SESSION_NOT_FOUND'
  | 'IDENTITY_NOT_FOUND'
  | 'INVALID_REQUEST'
  | 'QUOTA_EXCEEDED'
  | 'USER_CANCELLED'
  | 'FACE_NOT_DETECTED'
  | 'LOW_LIGHT'
  | 'TIMEOUT'
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

// ============================================================================
// Event Types
// ============================================================================

export type EventType =
  | 'session_created'
  | 'permissions_requested'
  | 'permissions_granted'
  | 'permissions_denied'
  | 'capture_started'
  | 'frame_captured'
  | 'capture_completed'
  | 'audio_record_started'
  | 'audio_record_completed'
  | 'challenge_started'
  | 'challenge_completed'
  | 'upload_started'
  | 'upload_progress'
  | 'upload_completed'
  | 'complete_started'
  | 'decision_received'
  | 'web_integrity_collected'
  | 'image_quality_check'
  | 'error';

export interface UseSenseEvent {
  type: EventType;
  timestamp: number;
  data?: any;
}

export type EventCallback = (event: UseSenseEvent) => void;

// ============================================================================
// Public API Types
// ============================================================================

export interface StartEnrollmentParams {
  externalUserId?: string;
  metadata?: Record<string, any>;
}

export interface StartAuthenticationParams {
  identityId: string;
  metadata?: Record<string, any>;
}

export interface RunVerificationParams {
  session_id: string;
  session_token: string;
}

export interface VerificationResult {
  success: boolean;
  decision?: RedactedDecisionObject;
  error?: UseSenseError;
}

// ============================================================================
// Component Props
// ============================================================================

export interface UseSenseVerificationProps {
  client: UseSenseClient;
  sessionType: SessionType;
  identityId?: string;
  externalUserId?: string;
  metadata?: Record<string, any>;
  onEvent?: EventCallback;
  onComplete?: (result: RedactedDecisionObject) => void;
  onError?: (error: UseSenseError) => void;
}

// ============================================================================
// Client Interface
// ============================================================================

export interface UseSenseClient {
  config: UseSenseConfig;
  startEnrollment(params: StartEnrollmentParams): Promise<CreateSessionResponse>;
  startAuthentication(params: StartAuthenticationParams): Promise<CreateSessionResponse>;
  runVerificationSession(params: RunVerificationParams): Promise<RedactedDecisionObject>;
  setMockScenario(scenario: string): void;
}