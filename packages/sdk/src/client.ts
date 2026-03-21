import {
  UseSenseConfig,
  UseSenseClient,
  StartEnrollmentParams,
  StartAuthenticationParams,
  RunVerificationParams,
  CreateSessionResponse,
  RedactedDecisionObject,
  CreateSessionRequest,
  MetadataPayload,
  EventCallback,
  ChallengeResponse,
} from './types';
import { UseSenseAPI } from './api';
import { VideoCapture } from './capture/video';
import { AudioCapture } from './capture/audio';
import { collectWebIntegritySignals } from './integrity/web-signals';
import { createWebAuthnCredential, generateChallenge, isWebAuthnSupported } from './integrity/webauthn';
import { EventEmitter } from './utils/events';
import { redactDecision } from './utils/redact';

/**
 * Create a UseSense client instance
 */
export function createUseSenseClient(config: UseSenseConfig): UseSenseClient {
  return new UseSenseClientImpl(config);
}

/**
 * UseSense client implementation
 */
class UseSenseClientImpl implements UseSenseClient {
  public config: UseSenseConfig;
  private api: UseSenseAPI;
  private eventEmitter: EventEmitter;

  constructor(config: UseSenseConfig) {
    this.config = {
      ...config,
      environment: config.environment || this.deriveEnvironmentFromApiKey(config.apiKey),
      branding: {
        primaryColor: '#4F63F5',
        buttonRadius: 12,
        ...config.branding,
      },
      options: {
        audioEnabled: 'risk_based',
        stepUpPolicy: 'risk_based',
        captureDurationMs: 2500,
        targetFps: 15,
        maxFrames: 40,
        maxUploadSizeMb: 10,
        webAuthnEnabled: false,
        ...config.options,
      },
    };

    this.api = new UseSenseAPI(
      config.apiBaseUrl,
      config.apiKey,
      this.config.environment!,
      config.gatewayKey
    );
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Derive environment from API key prefix
   * pk_ = production, sk_ = sandbox, dk_ = development (sandbox)
   */
  private deriveEnvironmentFromApiKey(apiKey: string): 'production' | 'sandbox' {
    if (apiKey.startsWith('pk_')) {
      return 'production';
    }
    // sk_ = sandbox, dk_ = development, anything else = sandbox
    return 'sandbox';
  }

  /**
   * Set mock scenario for demo/testing
   */
  setMockScenario(scenario: string) {
    this.api.mockScenario = scenario as any;
  }

  /**
   * Get the API instance (for advanced use cases)
   */
  getAPI() {
    return this.api;
  }

  /**
   * Start an enrollment session
   */
  async startEnrollment(params: StartEnrollmentParams): Promise<CreateSessionResponse> {
    const request: CreateSessionRequest = {
      session_type: 'enrollment',
      platform: 'web',
      external_user_id: params.externalUserId,
      metadata: {
        user_agent: navigator.userAgent,
        platform: 'web',
        channel: 'web',
        ...params.metadata,
      },
    };

    const response = await this.api.createSession(request);
    this.eventEmitter.emit('session_created', { session_id: response.session_id });

    return response;
  }

  /**
   * Start an authentication session
   */
  async startAuthentication(params: StartAuthenticationParams): Promise<CreateSessionResponse> {
    const request: CreateSessionRequest = {
      session_type: 'authentication',
      platform: 'web',
      identity_id: params.identityId,
      metadata: {
        user_agent: navigator.userAgent,
        platform: 'web',
        channel: 'web',
        ...params.metadata,
      },
    };

    const response = await this.api.createSession(request);
    this.eventEmitter.emit('session_created', { session_id: response.session_id });

    return response;
  }

  /**
   * Run a complete verification session (headless mode)
   * Returns a RedactedDecisionObject — sensitive scoring/pillar data is
   * stripped before it reaches the host application.
   */
  async runVerificationSession(params: RunVerificationParams): Promise<RedactedDecisionObject> {
    const { session_id, session_token } = params;
    const options = this.config.options!;

    const videoCapture = new VideoCapture();
    const audioCapture = new AudioCapture();

    try {
      // 1. Request camera permissions
      this.eventEmitter.emit('permissions_requested', { type: 'camera' });
      const videoStream = await videoCapture.requestCameraAccess(options.targetFps);
      this.eventEmitter.emit('permissions_granted', { type: 'camera' });

      let audioStream: MediaStream | null = null;
      if (options.audioEnabled === 'always') {
        this.eventEmitter.emit('permissions_requested', { type: 'microphone' });
        audioStream = await audioCapture.requestMicrophoneAccess();
        this.eventEmitter.emit('permissions_granted', { type: 'microphone' });
      }

      // 2. Collect web integrity signals
      const webIntegrity = await collectWebIntegritySignals();

      // 3. Collect WebAuthn data if enabled
      let webauthnData = null;
      if (options.webAuthnEnabled && isWebAuthnSupported()) {
        try {
          const challenge = generateChallenge();
          const rpId = new URL(this.config.apiBaseUrl).hostname;
          webauthnData = await createWebAuthnCredential(rpId, session_id, challenge);
        } catch (e) {
          console.warn('[UseSense] WebAuthn collection failed:', e);
        }
      }

      // 4. Capture video frames
      this.eventEmitter.emit('capture_started', {});

      const videoElement = document.createElement('video');
      videoElement.style.display = 'none';
      document.body.appendChild(videoElement);

      videoCapture.initializeVideo(videoStream, videoElement);
      await videoCapture.waitForVideoReady();

      const { frames } = await videoCapture.captureFrames(
        options.captureDurationMs!,
        options.targetFps!,
        options.maxFrames!,
        ({ metadata }) => {
          this.eventEmitter.emit('frame_captured', { frame_index: metadata.frame_index });
        }
      );

      this.eventEmitter.emit('capture_completed', { frame_count: frames.length });
      document.body.removeChild(videoElement);

      // 5. Capture audio if needed
      let audioBlob: Blob | undefined;
      if (audioStream) {
        this.eventEmitter.emit('audio_record_started', {});
        audioCapture.startRecording(audioStream);
        await new Promise(resolve => setTimeout(resolve, options.captureDurationMs!));
        const audioResult = await audioCapture.stopRecording();
        audioBlob = audioResult.blob;
        this.eventEmitter.emit('audio_record_completed', {});
      }

      // 6. Build metadata payload (new format)
      const challengeResponse: ChallengeResponse = null;
      const metadata: MetadataPayload = {
        web_integrity: webIntegrity,
        challenge_response: challengeResponse,
        webauthn_data: webauthnData,
      };

      // 7. Upload signals
      this.eventEmitter.emit('upload_started', {});
      await this.api.uploadSignals(session_id, session_token, frames, metadata, audioBlob);
      this.eventEmitter.emit('upload_completed', {});

      // 8. Complete session
      this.eventEmitter.emit('complete_started', {});
      const decision = await this.api.completeSession(session_id, session_token);

      // Redact before exposing to the host — only safe fields leave the SDK
      const redacted = redactDecision(decision);
      this.eventEmitter.emit('decision_received', redacted);

      return redacted;
    } catch (error) {
      this.eventEmitter.emit('error', error);
      throw error;
    } finally {
      videoCapture.stop();
      audioCapture.stop();
    }
  }

  /**
   * Register event listener
   */
  on(type: any, callback: EventCallback): () => void {
    return this.eventEmitter.on(type, callback);
  }

  /**
   * Get event emitter (internal use)
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }
}