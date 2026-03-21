import {
  CreateSessionRequest,
  CreateSessionResponse,
  FinalDecisionObject,
  SessionStatusResponse,
  MetadataPayload,
  SessionPolicy,
  ChallengeSpec,
  UploadConfig,
  UploadSignalsResponse,
  FollowDotChallenge,
  HeadTurnChallenge,
  SpeakPhraseChallenge,
} from './types';
import { handleNetworkError } from './utils/errors';

/**
 * Default Supabase anonymous key for the UseSense Edge Functions gateway.
 * This is a public key (not secret) -- it only grants access to the
 * Supabase gateway layer. It must be sent on every request in two places:
 *   Authorization: Bearer <SUPABASE_ANON_KEY>
 *   apikey: <SUPABASE_ANON_KEY>
 */
const DEFAULT_GATEWAY_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6ZnNycXNqZ3hjcHN4eXB4am9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMDQ5MjgsImV4cCI6MjA4Njc4MDkyOH0._PM_8RU9a6-l10mchYv5eipIhwWwt4gh8G1vdJgWcXw';

/**
 * API client for UseSense backend
 * Server v1.10.8 -- Supabase Edge Functions gateway + Two-Phase Capture
 *
 * Auth model:
 *   - Every request needs gateway headers: Authorization + apikey (both carry the Supabase anon key)
 *   - Create Session: org API key goes in X-API-Key header
 *   - Upload / Complete / Status: session token goes in X-Session-Token header
 *   - Environment is passed as ?env= query parameter
 */
export class UseSenseAPI {
  private enableMockMode = false;
  private gatewayKey: string;
  /**
   * Session nonce from CreateSessionResponse.
   * Sent as X-Nonce header on Upload and Complete requests for
   * cryptographic binding — prevents replay / session hijack.
   */
  private sessionNonce: string | null = null;
  public mockScenario:
    | 'success'
    | 'failure'
    | 'manual_review'
    | 'step-up-head-turn'
    | 'step-up-follow-dot'
    | 'step-up-speak-phrase'
    | 'challenge' = 'success';

  constructor(
    private apiBaseUrl: string,
    private apiKey: string,
    private environment: 'sandbox' | 'production' = 'sandbox',
    gatewayKey?: string
  ) {
    // Trim whitespace from keys — common copy-paste issue
    this.apiKey = apiKey.trim();
    this.apiBaseUrl = apiBaseUrl.trim().replace(/\/+$/, ''); // strip trailing slashes
    this.gatewayKey = (gatewayKey?.trim()) || DEFAULT_GATEWAY_KEY;

    if (
      this.apiKey.includes('demo') ||
      this.apiKey.includes('mock') ||
      this.apiKey === 'sk_demo_temp_key'
    ) {
      this.enableMockMode = true;
      console.log('[UseSense SDK] Mock mode enabled for demo/testing');
    } else {
      console.log('[UseSense SDK] Live mode - connecting to backend:', this.apiBaseUrl);
      console.log('[UseSense SDK] Environment:', environment);
      console.log('[UseSense SDK] API Key: first10=%s last4=%s length=%d',
        this.apiKey.substring(0, 10), this.apiKey.slice(-4), this.apiKey.length);
      console.log('[UseSense SDK] Gateway Key: first10=%s last4=%s length=%d',
        this.gatewayKey.substring(0, 10), this.gatewayKey.slice(-4), this.gatewayKey.length);
    }
  }

  /**
   * Build gateway headers required on EVERY request to the Supabase Edge Functions.
   * Authorization carries the Supabase anon key (NOT the session token or API key).
   * apikey is a secondary check used by the Supabase gateway.
   */
  private getGatewayHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.gatewayKey}`,
      'apikey': this.gatewayKey,
    };
  }

  /**
   * Append ?env=sandbox|production to a URL
   */
  private withEnv(url: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}env=${this.environment}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Create Session
  // ─────────────────────────────────────────────────────────────────────────

  async createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
    if (this.enableMockMode) {
      console.log('[UseSense SDK] Mock mode - returning simulated session response');
      return this.createMockSessionResponse(request);
    }

    console.log('[UseSense SDK] LIVE MODE - Creating session');

    try {
      const url = this.withEnv(`${this.apiBaseUrl}/v1/sessions`);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        ...this.getGatewayHeaders(),
      };

      // Log outgoing request details (redacted) for debugging
      console.log('[UseSense SDK] POST', url);
      console.log('[UseSense SDK] Outgoing headers:', {
        'Content-Type': headers['Content-Type'],
        'X-API-Key': `${this.apiKey.substring(0, 10)}...${this.apiKey.slice(-4)} (len=${this.apiKey.length})`,
        'Authorization': `Bearer ${this.gatewayKey.substring(0, 10)}...`,
        'apikey': `${this.gatewayKey.substring(0, 10)}...`,
      });
      console.log('[UseSense SDK] Request body:', JSON.stringify(request));

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      console.log('[UseSense SDK] Response status:', response.status);

      if (!response.ok) {
        // v1.17.8: Read raw body BEFORE handleErrorResponse for diagnostics
        const rawClone = response.clone();
        const rawText = await rawClone.text().catch(() => '(unreadable)');
        console.error('[UseSense SDK] *** RAW SERVER RESPONSE ***', response.status, rawText);

        const error = await this.handleErrorResponse(response);
        console.error('[UseSense SDK] Session creation failed:', error);
        throw error;
      }

      const data = await response.json();
      console.log('[UseSense SDK] Session created:', {
        session_id: data.session_id,
        expires_at: data.expires_at,
        challenge_type: data.policy?.challenge_type,
        policy_source: data.policy?.policy_source,
      });

      // Store the nonce for cryptographic binding on subsequent requests
      if (data.nonce) {
        this.sessionNonce = data.nonce;
        console.log('[UseSense SDK] Nonce bound:', data.nonce.substring(0, 12) + '...');
      }

      return data;
    } catch (error) {
      if (error instanceof TypeError) {
        console.error('[UseSense SDK] Network error - backend unreachable:', this.apiBaseUrl);
        throw handleNetworkError(
          new Error(`Cannot connect to backend at ${this.apiBaseUrl}. Please verify the Backend URL is correct.`),
          'create session'
        );
      }
      throw handleNetworkError(error, 'create session');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Upload Signals
  // ─────────────────────────────────────────────────────────────────────────

  async uploadSignals(
    sessionId: string,
    sessionToken: string,
    frames: Blob[],
    metadata: MetadataPayload,
    audio?: Blob
  ): Promise<UploadSignalsResponse> {
    if (this.enableMockMode) {
      console.log('[UseSense SDK] Mock mode - simulating signal upload');
      return {
        received: true,
        session_id: sessionId,
        frames_count: frames.length,
        audio_received: !!audio,
        metadata_received: true,
        total_size_bytes: frames.reduce((sum, f) => sum + f.size, 0),
      };
    }

    console.log('[UseSense SDK] LIVE MODE - Uploading signals');

    try {
      const formData = new FormData();

      // Add frames
      frames.forEach((frame, index) => {
        formData.append('frames[]', frame, `frame_${index}.jpg`);
      });

      // Add metadata as JSON blob
      const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
      formData.append('metadata', metadataBlob, 'metadata.json');

      // Add audio if present
      if (audio) {
        formData.append('audio', audio, 'audio.webm');
      }

      const idempotencyKey = `${sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      // v1.17.5: Nonce dual-delivery — send in both header AND query param
      const nonceParam = this.sessionNonce
        ? `&nonce=${encodeURIComponent(this.sessionNonce)}`
        : '';
      const url = this.withEnv(`${this.apiBaseUrl}/v1/sessions/${sessionId}/signals`) + nonceParam;
      console.log('[UseSense SDK] POST', url);

      // NOTE: Do NOT set Content-Type -- the browser sets it automatically
      // with the correct multipart boundary when using FormData.
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getGatewayHeaders(),        // Authorization + apikey = Supabase anon key
          'X-Session-Token': sessionToken,     // Session auth -- NOT in Authorization!
          'X-Idempotency-Key': idempotencyKey,
          ...(this.sessionNonce ? { 'X-Nonce': this.sessionNonce } : {}),
        },
        body: formData,
      });

      console.log('[UseSense SDK] Upload response status:', response.status);

      if (!response.ok) {
        const error = await this.handleErrorResponse(response);
        console.error('[UseSense SDK] Signal upload failed:', error);
        throw error;
      }

      const result: UploadSignalsResponse = await response.json();
      console.log('[UseSense SDK] Signals uploaded:', {
        frames_count: result.frames_count,
        audio_received: result.audio_received,
        total_size_bytes: result.total_size_bytes,
      });

      if (!result.received) {
        throw new Error('Signals upload not confirmed by server');
      }

      return result;
    } catch (error) {
      if (error instanceof TypeError) {
        throw handleNetworkError(
          new Error(`Cannot upload signals to ${this.apiBaseUrl}. Connection failed.`),
          'upload signals'
        );
      }
      throw handleNetworkError(error, 'upload signals');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Complete Session
  // ─────────────────────────────────────────────────────────────────────────

  async completeSession(sessionId: string, sessionToken: string): Promise<FinalDecisionObject> {
    if (this.enableMockMode) {
      console.log('[UseSense SDK] Mock mode - returning simulated decision');
      return this.createMockDecisionResponse(sessionId);
    }

    console.log('[UseSense SDK] LIVE MODE - Completing session');

    try {
      const idempotencyKey = `${sessionId}_complete_${Date.now()}`;
      // v1.17.5: Nonce dual-delivery — send in both header AND query param
      const completeNonceParam = this.sessionNonce
        ? `&nonce=${encodeURIComponent(this.sessionNonce)}`
        : '';
      const url = this.withEnv(`${this.apiBaseUrl}/v1/sessions/${sessionId}/complete`) + completeNonceParam;
      console.log('[UseSense SDK] POST', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getGatewayHeaders(),        // Authorization + apikey = Supabase anon key
          'X-Session-Token': sessionToken,     // Session auth
          'X-Idempotency-Key': idempotencyKey,
          ...(this.sessionNonce ? { 'X-Nonce': this.sessionNonce } : {}),
        },
        // No body
      });

      console.log('[UseSense SDK] Complete response status:', response.status);

      if (!response.ok) {
        const error = await this.handleErrorResponse(response);
        console.error('[UseSense SDK] Complete session failed:', error);
        throw error;
      }

      const result: FinalDecisionObject = await response.json();
      console.log('[UseSense SDK] Decision:', result.decision, '| Matrix:', result.matrix_decision);
      return result;
    } catch (error) {
      throw handleNetworkError(error, 'complete session');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Get Session Status
  // ─────────────────────────────────────────────────────────────────────────

  async getSessionStatus(sessionId: string, sessionToken: string): Promise<SessionStatusResponse> {
    try {
      const url = this.withEnv(`${this.apiBaseUrl}/v1/sessions/${sessionId}/status`);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.getGatewayHeaders(),        // Authorization + apikey = Supabase anon key
          'X-Session-Token': sessionToken,     // Session auth
        },
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      return await response.json();
    } catch (error) {
      throw handleNetworkError(error, 'get session status');
    }
  }

  /**
   * Poll session until completed or timeout
   */
  async pollUntilComplete(
    sessionId: string,
    sessionToken: string,
    maxAttempts: number = 30,
    intervalMs: number = 1000
  ): Promise<FinalDecisionObject> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await this.getSessionStatus(sessionId, sessionToken);

      if (status.status === 'completed' && status.result) {
        return status.result;
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw handleNetworkError(
      new Error('Session evaluation timeout'),
      'poll session status'
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Error handling
  // ─────────────────────────────────────────────────────────────────────────

  private async handleErrorResponse(response: Response): Promise<Error> {
    let errorData: any = {};
    let rawBody = '';

    try {
      rawBody = await response.text();
      try {
        errorData = JSON.parse(rawBody);
      } catch {
        errorData = { message: rawBody || response.statusText };
      }
    } catch {
      errorData = { message: response.statusText };
    }

    // Robust message extraction — handles all known response shapes:
    //  - Supabase gateway:  { msg: "Invalid API key", hint: "..." }
    //  - Edge Function obj: { error: { code: "...", message: "..." } }
    //  - Edge Function str: { error: "Invalid API key" }
    //  - Plain message:     { message: "..." }
    //  - Bare string body:  "Unauthorized"
    const serverError = (typeof errorData.error === 'object' && errorData.error !== null)
      ? errorData.error
      : errorData;
    const serverCode = (typeof serverError === 'object' ? serverError.code : '') || '';

    // Extract message from every known field / shape
    const serverMessage: string =
      (typeof serverError === 'string' ? serverError : '') ||
      (typeof serverError === 'object' ? (serverError.message || serverError.msg) : '') ||
      errorData.msg ||
      errorData.message ||
      (typeof errorData.error === 'string' ? errorData.error : '') ||
      '';

    // Log the full raw response for debugging
    console.warn('[UseSense SDK] Raw response body:', rawBody);
    console.warn('[UseSense SDK] Parsed error data:', JSON.stringify(errorData, null, 2));

    // Detect Supabase gateway-level auth failure vs Edge Function auth failure
    const msgLower = serverMessage.toLowerCase();
    const isSupabaseGatewayError =
      response.status === 401 &&
      !serverCode &&
      (msgLower.includes('invalid api key') ||
       msgLower.includes('invalid claim') ||
       msgLower.includes('jwt') ||
       msgLower.includes('apikey') ||
       !!errorData.hint);

    let errorMessage: string;
    let errorCode: string;

    switch (response.status) {
      case 400:
        errorMessage = serverMessage || 'Invalid request. Please check the request parameters.';
        errorCode = serverCode || 'INVALID_REQUEST';
        break;
      case 401:
        if (serverCode === 'session_expired') {
          errorMessage = serverMessage || 'Session has expired. Please start a new verification session.';
          errorCode = 'SESSION_EXPIRED';
        } else if (serverCode === 'invalid_token') {
          errorMessage = serverMessage || 'Invalid session token.';
          errorCode = 'INVALID_TOKEN';
        } else if (serverCode === 'session_not_found') {
          errorMessage = serverMessage || 'Session not found.';
          errorCode = 'SESSION_NOT_FOUND';
        } else if (isSupabaseGatewayError) {
          errorMessage = `Gateway authentication failed — the Supabase anon key was rejected ("${serverMessage}"). Your UseSense API key was NOT checked. The default gateway key may be expired or rotated. Please provide a valid gateway key in the config.`;
          errorCode = 'GATEWAY_AUTH_FAILED';
        } else if (serverMessage) {
          errorMessage = `Authentication failed: ${serverMessage}`;
          errorCode = serverCode || 'UNAUTHORIZED';
        } else {
          const rawHint = rawBody ? ` (Server response: ${rawBody.substring(0, 200)})` : '';
          errorMessage = `Authentication failed. The server returned 401 with no details.${rawHint} Check that both the API key (X-API-Key) and gateway key (Supabase anon key) are correct for this environment.`;
          errorCode = 'UNAUTHORIZED';
        }
        break;
      case 404:
        if (serverCode === 'identity_not_found') {
          errorMessage = serverMessage || 'Identity not found in this organization/environment.';
          errorCode = 'IDENTITY_NOT_FOUND';
        } else {
          errorMessage = serverMessage || 'Endpoint not found. Please verify the Backend URL is correct.';
          errorCode = 'NOT_FOUND';
        }
        break;
      case 429:
        errorMessage = serverMessage || 'Rate limit exceeded. Please try again later.';
        errorCode = 'QUOTA_EXCEEDED';
        break;
      case 500:
        errorMessage = serverMessage || 'Backend server error. Please try again or contact support.';
        errorCode = serverCode || 'SERVER_ERROR';
        break;
      case 503:
        errorMessage = 'Backend service unavailable. Please try again in a few moments.';
        errorCode = 'SERVICE_UNAVAILABLE';
        break;
      default:
        errorMessage = serverMessage || `API error: ${response.status} ${response.statusText}`;
        errorCode = serverCode || `HTTP_${response.status}`;
    }

    console.error(`[UseSense SDK] API Error ${response.status}:`, {
      code: errorCode,
      message: errorMessage,
      serverResponse: errorData,
      rawBody: rawBody.substring(0, 500),
      isGatewayError: isSupabaseGatewayError,
    });

    const error: any = new Error(errorMessage);
    error.status = response.status;
    error.code = errorCode;
    error.data = errorData;

    return error;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mock responses
  // ─────────────────────────────────────────────────────────────────────────

  private createMockSessionResponse(_request: CreateSessionRequest): CreateSessionResponse {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const nonce = `nonce_${Math.random().toString(36).substr(2, 9)}`;

    let challenge: ChallengeSpec = null;
    let audioChallenge: SpeakPhraseChallenge | null = null;
    let requiresAudio = false;
    let requiresStepup = false;
    let challengeType = 'none';

    const mockFollowDot: FollowDotChallenge = {
      type: 'follow_dot',
      seed: `seed_${Math.random().toString(36).substr(2, 12)}`,
      generated_at: new Date().toISOString(),
      waypoints: [
        { x: 0.2, y: 0.3, duration_ms: 1500, index: 0 },
        { x: 0.8, y: 0.7, duration_ms: 1500, index: 1 },
        { x: 0.5, y: 0.2, duration_ms: 1500, index: 2 },
        { x: 0.1, y: 0.9, duration_ms: 1500, index: 3 },
        { x: 0.9, y: 0.5, duration_ms: 1500, index: 4 },
      ],
      dot_size_px: 20,
      total_duration_ms: 7500,
      // v1.17.6 -- frames_per_step lowered 3->2
      frames_per_step: 2,
      capture_fps_hint: 10,
    };

    const mockHeadTurn: HeadTurnChallenge = {
      type: 'head_turn',
      seed: `seed_${Math.random().toString(36).substr(2, 12)}`,
      sequence: [
        { direction: 'left', duration_ms: 2000, index: 0 },
        { direction: 'right', duration_ms: 2000, index: 1 },
        { direction: 'center', duration_ms: 1500, index: 2 },
      ],
      total_duration_ms: 5500,
      // v1.17.6 -- frames_per_step lowered 3->2
      frames_per_step: 2,
      capture_fps_hint: 10,
    };

    const mockSpeakPhrase: SpeakPhraseChallenge = {
      type: 'speak_phrase',
      seed: `seed_${Math.random().toString(36).substr(2, 12)}`,
      phrase: 'The sun rises in the east',
      phrase_language: 'en',
      total_duration_ms: 5000,
    };

    if (this.mockScenario === 'step-up-head-turn') {
      challenge = mockHeadTurn;
      requiresStepup = true;
      challengeType = 'head_turn';
    } else if (this.mockScenario === 'step-up-follow-dot') {
      challenge = mockFollowDot;
      requiresStepup = true;
      challengeType = 'follow_dot';
    } else if (this.mockScenario === 'step-up-speak-phrase') {
      audioChallenge = mockSpeakPhrase;
      requiresAudio = true;
      requiresStepup = true;
      challengeType = 'speak_phrase';
    } else if (this.mockScenario === 'challenge') {
      const options = [mockFollowDot, mockHeadTurn, mockSpeakPhrase];
      const pick = options[Math.floor(Math.random() * options.length)];
      challenge = pick.type === 'speak_phrase' ? null : pick;
      audioChallenge = pick.type === 'speak_phrase' ? (pick as SpeakPhraseChallenge) : null;
      requiresStepup = true;
      requiresAudio = pick.type === 'speak_phrase';
      challengeType = pick.type;
    }

    const policy: SessionPolicy = {
      requires_audio: requiresAudio,
      requires_stepup: requiresStepup,
      challenge_type: challengeType,
      challenge,
      audio_challenge: audioChallenge,
      policy_source: 'default',
    };

    // v1.17.6: Adaptive FPS computation matching server formula
    let captureDuration = 2500;
    const HARD_MAX_FRAMES = 30;
    const BASELINE_MS = 2000;

    if (challenge) {
      const COUNTDOWN_MS = 3000;
      const challengeDurationMs = challenge.total_duration_ms || 0;
      const totalCaptureMs = BASELINE_MS + COUNTDOWN_MS + challengeDurationMs;
      const nominalFps = challenge.capture_fps_hint || 10;
      const adaptiveTargetFps = Math.max(2, Math.min(nominalFps, Math.floor(HARD_MAX_FRAMES / (totalCaptureMs / 1000))));

      captureDuration = Math.max(2500, challengeDurationMs + 500);

      const upload: UploadConfig = {
        max_frames: HARD_MAX_FRAMES,
        target_fps: adaptiveTargetFps,
        capture_duration_ms: captureDuration,
      };

      return {
        session_id: sessionId,
        session_token: `sess_tok_${sessionId}`,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        nonce,
        policy,
        upload,
      };
    }

    // No challenge — enrollment-only
    const upload: UploadConfig = {
      max_frames: HARD_MAX_FRAMES,
      target_fps: 10,
      capture_duration_ms: captureDuration,
    };

    return {
      session_id: sessionId,
      session_token: `sess_tok_${sessionId}`,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      nonce,
      policy,
      upload,
    };
  }

  private createMockDecisionResponse(sessionId: string): FinalDecisionObject {
    let decision: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';
    let livenessScore: number;
    let trustScore: number;
    let dedupeRisk: number;
    let reasons: string[];

    if (this.mockScenario === 'failure') {
      decision = 'REJECT';
      livenessScore = Math.floor(Math.random() * 30) + 20;
      trustScore = Math.floor(Math.random() * 30) + 20;
      dedupeRisk = Math.floor(Math.random() * 30) + 60;
      reasons = ['Low liveness score detected', 'Suspected spoof or photo injection', 'Weakest Link: livesense pillar failed'];
    } else if (this.mockScenario === 'manual_review') {
      decision = 'MANUAL_REVIEW';
      livenessScore = Math.floor(Math.random() * 15) + 55;
      trustScore = Math.floor(Math.random() * 15) + 55;
      dedupeRisk = Math.floor(Math.random() * 15) + 30;
      reasons = ['Borderline liveness score', 'Manual review required', 'Weakest Link: livesense pillar borderline'];
    } else if (this.mockScenario.startsWith('step-up-') || this.mockScenario === 'challenge') {
      decision = 'APPROVE';
      livenessScore = Math.floor(Math.random() * 10) + 80;
      trustScore = Math.floor(Math.random() * 10) + 80;
      dedupeRisk = Math.floor(Math.random() * 10) + 5;
      reasons = ['Challenge completed successfully', 'All three pillars passed', 'Identity record created'];
    } else {
      decision = 'APPROVE';
      livenessScore = Math.floor(Math.random() * 8) + 90;
      trustScore = Math.floor(Math.random() * 8) + 90;
      dedupeRisk = Math.floor(Math.random() * 5) + 2;
      reasons = ['Face enrolled (quality: 85, dedupe risk: low)', 'Weakest Link: all three pillars passed', 'Identity record created -- enrollment approved'];
    }

    const dedupeScore = 100 - dedupeRisk;

    return {
      session_id: sessionId,
      organization_id: 'org_mock_demo',
      session_type: 'enrollment',
      identity_id: `ident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      decision,
      matrix_decision: decision,
      rule_applied: 'default_weakest_link',
      channel_trust_score: trustScore,
      liveness_score: livenessScore,
      dedupe_risk_score: dedupeRisk,
      pillar_verdicts: {
        deepsense: {
          score: trustScore,
          verdict: trustScore >= 65 ? 'pass' : trustScore >= 40 ? 'borderline' : 'fail',
        },
        livesense: {
          score: livenessScore,
          verdict: livenessScore >= 75 ? 'pass' : livenessScore >= 50 ? 'borderline' : 'fail',
        },
        dedupe: {
          score: dedupeScore,
          verdict: dedupeScore >= 70 ? 'pass' : dedupeScore >= 45 ? 'borderline' : 'fail',
        },
      },
      verdict_metadata: {
        source: 'default',
        logic: 'weakest_link',
        hardGateTripped: false,
      },
      reasons,
      timestamp: new Date().toISOString(),
      signature: `sha256:mock_${Math.random().toString(36).substr(2, 16)}`,
      debug: {
        face_quality: { Brightness: 85.2, Sharpness: 92.1 },
        frames_analyzed: 37,
        environment: 'sandbox',
      },
      integrity_flags: [
        { category: 'Automation', flag: 'WebDriver Detected', severity: 'critical', detected: false },
        { category: 'Permissions', flag: 'Camera Permission Denied', severity: 'high', detected: false },
        { category: 'Network', flag: 'VPN/Proxy Detected', severity: 'high', detected: false },
      ],
    };
  }
}