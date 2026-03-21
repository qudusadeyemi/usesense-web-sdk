import React, { useState, useCallback, useRef } from 'react';
import {
  UseSenseVerificationProps,
  CreateSessionResponse,
  FinalDecisionObject,
  UseSenseError,
  MetadataPayload,
  ChallengeResponse,
  FollowDotChallengeResponse,
  HeadTurnChallengeResponse,
  FrameMetadata,
} from '../types';
import { VideoCapture } from '../capture/video';
import { AudioCapture } from '../capture/audio';
import { collectWebIntegritySignals } from '../integrity/web-signals';
import { createWebAuthnCredential, generateChallenge, isWebAuthnSupported } from '../integrity/webauthn';
import { createError } from '../utils/errors';
import { redactDecision } from '../utils/redact';
import { baseStyles, getThemeStyles } from './styles';
import { ImageQualityReport } from '../capture/image-quality';

// Import screens
import { IntroScreen } from './screens/IntroScreen';
import { PermissionScreen } from './screens/PermissionScreen';
import { CaptureScreen } from './screens/CaptureScreen';
import { ChallengeScreen, TwoPhaseCaptureResult } from './screens/ChallengeScreen';
import { UploadingScreen } from './screens/UploadingScreen';
import { SuccessScreen } from './screens/SuccessScreen';
import { FailureScreen } from './screens/FailureScreen';
import { DeniedScreen } from './screens/DeniedScreen';
import { BlockedScreen } from './screens/BlockedScreen';

type ScreenState =
  | 'intro'
  | 'permission-camera'
  | 'permission-microphone'
  | 'capture-setup'
  | 'capturing'
  | 'challenge'
  | 'uploading'
  | 'success'
  | 'denied'
  | 'manual-review'
  | 'failure'
  | 'blocked';

export const UseSenseVerification: React.FC<UseSenseVerificationProps> = ({
  client,
  sessionType,
  identityId,
  externalUserId,
  metadata,
  onEvent,
  onComplete,
  onError,
}) => {
  const [screen, setScreen] = useState<ScreenState>('intro');
  const [session, setSession] = useState<CreateSessionResponse | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<UseSenseError | null>(null);
  const [decision, setDecision] = useState<FinalDecisionObject | null>(null);
  const [guidance] = useState<string>('');
  const [capturedFrames, setCapturedFrames] = useState<Blob[]>([]);
  const [frameMetadata, setFrameMetadata] = useState<FrameMetadata[]>([]);
  const [introLoading, setIntroLoading] = useState(false);

  const config = client.config;
  const options = config.options!;
  const branding = config.branding!;

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Handle quality reports from capture/challenge screens and forward them
   * as `image_quality_check` SDK events so the host can observe quality metrics.
   */
  const handleQualityReport = useCallback((report: ImageQualityReport) => {
    onEvent?.({
      type: 'image_quality_check',
      timestamp: Date.now(),
      data: {
        overallScore: report.overallScore,
        overallLevel: report.overallLevel,
        isAcceptable: report.isAcceptable,
        blur: {
          sharpnessScore: report.blur.sharpnessScore,
          level: report.blur.level,
          isBlurry: report.blur.isBlurry,
        },
        lighting: {
          lightingScore: report.lighting.lightingScore,
          level: report.lighting.level,
          isTooDark: report.lighting.isTooDark,
          isTooBright: report.lighting.isTooBright,
        },
        guidance: report.guidance[0]?.message || null,
      },
    });
  }, [onEvent]);

  /**
   * Does the current session require an integrated two-phase capture?
   * Only head_turn and follow_dot challenges need the SDK to own the capture
   * loop with per-step frame tagging. speak_phrase uses the legacy
   * "capture-then-challenge" path since its validation is audio-based.
   */
  const needsIntegratedCapture = (): boolean => {
    if (!session) return false;
    if (!session.policy.requires_stepup || !session.policy.challenge) return false;
    const t = session.policy.challenge.type;
    return t === 'head_turn' || t === 'follow_dot';
  };

  // Guard refs to prevent duplicate transitions
  const captureReadyFired = useRef(false);

  // ─── Session Initialisation ──────────────────────────────────────────────

  const handleIntroStart = () => {
    setIntroLoading(true);
    initializeSession();
  };

  const initializeSession = async () => {
    try {
      let sessionResponse: CreateSessionResponse;

      if (sessionType === 'enrollment') {
        sessionResponse = await client.startEnrollment({
          externalUserId,
          metadata,
        });
      } else {
        if (!identityId) {
          throw createError('UNKNOWN_ERROR', 'Identity ID required for authentication');
        }
        sessionResponse = await client.startAuthentication({
          identityId,
          metadata,
        });
      }

      console.log('[UseSense] Session created:', sessionResponse.session_id);
      console.log('[UseSense] Challenge type:', sessionResponse.policy.challenge_type);
      console.log('[UseSense] Upload config:', sessionResponse.upload);
      setSession(sessionResponse);
      setIntroLoading(false);
      onEvent?.({ type: 'session_created', timestamp: Date.now(), data: sessionResponse });
      setScreen('permission-camera');
    } catch (err) {
      console.error('[UseSense] Session creation failed:', err);
      setIntroLoading(false);
      handleError(err as UseSenseError);
    }
  };

  // ─── Permissions ─────────────────────────────────────────────────────────

  const handleCameraPermission = async () => {
    try {
      onEvent?.({ type: 'permissions_requested', timestamp: Date.now(), data: { type: 'camera' } });
      const videoCapture = new VideoCapture();
      const stream = await videoCapture.requestCameraAccess(options.targetFps);
      setVideoStream(stream);
      onEvent?.({ type: 'permissions_granted', timestamp: Date.now(), data: { type: 'camera' } });

      if (options.audioEnabled === 'always' || session?.policy.requires_audio) {
        setScreen('permission-microphone');
      } else {
        setScreen('capture-setup');
      }
    } catch (err) {
      onEvent?.({ type: 'permissions_denied', timestamp: Date.now(), data: { type: 'camera' } });
      handleError(err as UseSenseError);
    }
  };

  const handleMicrophonePermission = async () => {
    try {
      onEvent?.({ type: 'permissions_requested', timestamp: Date.now(), data: { type: 'microphone' } });
      const audioCapture = new AudioCapture();
      const stream = await audioCapture.requestMicrophoneAccess();
      setAudioStream(stream);
      onEvent?.({ type: 'permissions_granted', timestamp: Date.now(), data: { type: 'microphone' } });
      setScreen('capture-setup');
    } catch (err) {
      onEvent?.({ type: 'permissions_denied', timestamp: Date.now(), data: { type: 'microphone' } });
      handleError(err as UseSenseError);
    }
  };

  // ─── Capture-Setup Ready ─────────────────────────────────────────────────

  const handleCaptureReady = () => {
    if (captureReadyFired.current) return;
    captureReadyFired.current = true;

    setTimeout(() => {
      if (needsIntegratedCapture()) {
        // v1.10.8 -- Two-phase capture: skip the old blind capture step
        // and go directly to the ChallengeScreen which owns both phases.
        console.log('[UseSense] Routing to integrated two-phase capture (v1.10.8)');
        setScreen('challenge');
      } else {
        // Legacy path: no challenge, or speak_phrase
        startCapture();
      }
    }, 1500);
  };

  // ─── Legacy Capture (no challenge / speak_phrase) ────────────────────────

  const startCapture = async () => {
    if (!session || !videoStream) return;

    setScreen('capturing');
    onEvent?.({ type: 'capture_started', timestamp: Date.now() });

    try {
      const videoCapture = new VideoCapture();
      const videoElement = document.createElement('video');
      videoCapture.initializeVideo(videoStream, videoElement);
      await videoCapture.waitForVideoReady();

      // v1.10.7 -- Use server-provided upload config (now challenge-aware)
      const captureDuration = session.upload?.capture_duration_ms || options.captureDurationMs!;
      const targetFps = session.upload?.target_fps || options.targetFps!;
      const maxFrames = session.upload?.max_frames || options.maxFrames!;

      console.log('[UseSense SDK] Capture config (legacy path):', {
        duration_ms: captureDuration,
        target_fps: targetFps,
        max_frames: maxFrames,
        source: session.upload ? 'server (challenge-aware)' : 'client config',
      });

      const { frames, metadata: frameMeta } = await videoCapture.captureFrames(
        captureDuration,
        targetFps,
        maxFrames,
        ({ metadata: meta }) => {
          onEvent?.({ type: 'frame_captured', timestamp: Date.now(), data: { frame_index: meta.frame_index } });
        },
      );

      setCapturedFrames(frames);
      setFrameMetadata(frameMeta);
      onEvent?.({ type: 'capture_completed', timestamp: Date.now(), data: { frame_count: frames.length } });

      // Check if a speak_phrase or audio challenge follows
      const hasAudioChallenge = session.policy.requires_audio && session.policy.audio_challenge;
      if (hasAudioChallenge) {
        setScreen('challenge');
      } else {
        finishVerification(frames, frameMeta);
      }
    } catch (err) {
      handleError(err as UseSenseError);
    }
  };

  // ─── Challenge Complete Handler ──────────────────────────────────────────

  const handleChallengeComplete = async (challengeData?: TwoPhaseCaptureResult | any) => {
    onEvent?.({ type: 'challenge_completed', timestamp: Date.now(), data: challengeData });

    if (challengeData?.frames && Array.isArray(challengeData.frames)) {
      // v1.10.8 -- Two-phase capture: frames came from the ChallengeScreen
      console.log(
        `[UseSense] Two-phase capture delivered ${challengeData.frames.length} frames`,
      );
      finishVerification(
        challengeData.frames,
        challengeData.frameMetadata || [],
        challengeData,
      );
    } else {
      // Legacy speak_phrase or old path
      finishVerification(capturedFrames, frameMetadata, challengeData);
    }
  };

  // ─── Upload & Complete ───────────────────────────────────────────────────

  const finishVerification = async (
    frames: Blob[],
    _frameMeta: FrameMetadata[] | any[],
    challengeData?: any,
  ) => {
    if (!session) return;

    setScreen('uploading');

    try {
      // Capture audio if available
      let audioBlob: Blob | undefined;
      if (audioStream) {
        onEvent?.({ type: 'audio_record_started', timestamp: Date.now() });
        const audioCapture = new AudioCapture();
        audioCapture.startRecording(audioStream);
        const captureDuration = session.upload?.capture_duration_ms || options.captureDurationMs!;
        await new Promise(resolve => setTimeout(resolve, captureDuration));
        const audioResult = await audioCapture.stopRecording();
        audioBlob = audioResult.blob;
        onEvent?.({ type: 'audio_record_completed', timestamp: Date.now() });
      }

      // Collect web integrity signals
      const webIntegrity = await collectWebIntegritySignals();
      console.log('[UseSense SDK] Web Integrity Signals Collected');
      onEvent?.({ type: 'web_integrity_collected', timestamp: Date.now(), data: webIntegrity });

      // Collect WebAuthn
      let webauthnData = null;
      if (options.webAuthnEnabled && isWebAuthnSupported()) {
        try {
          const challenge = generateChallenge();
          const rpId = new URL(config.apiBaseUrl).hostname;
          webauthnData = await createWebAuthnCredential(rpId, session.session_id, challenge);
        } catch (e) {
          console.warn('[UseSense] WebAuthn collection failed:', e);
        }
      }

      // ── Build challenge_response ──────────────────────────────────────
      let challengeResponse: ChallengeResponse = null;

      if (challengeData && session.policy.challenge) {
        const spec = session.policy.challenge;

        if (spec.type === 'follow_dot') {
          const waypointFrames: Record<string, number[]> = {};
          (spec as any).waypoints.forEach((wp: any) => {
            waypointFrames[String(wp.index)] = challengeData.waypoint_frames?.[wp.index] || [];
          });
          challengeResponse = {
            type: 'follow_dot',
            seed: spec.seed,
            completed: true,
            waypoint_frames: waypointFrames,
            started_at: challengeData.started_at || new Date().toISOString(),
            completed_at: challengeData.completed_at || new Date().toISOString(),
            frame_timestamps: challengeData.frame_timestamps || [],
          } satisfies FollowDotChallengeResponse;
        } else if (spec.type === 'head_turn') {
          const stepFrames: Record<string, number[]> = {};
          (spec as any).sequence.forEach((s: any) => {
            stepFrames[String(s.index)] = challengeData.step_frames?.[s.index] || [];
          });
          challengeResponse = {
            type: 'head_turn',
            seed: spec.seed,
            completed: true,
            step_frames: stepFrames,
            started_at: challengeData.started_at || new Date().toISOString(),
            completed_at: challengeData.completed_at || new Date().toISOString(),
            frame_timestamps: challengeData.frame_timestamps || [],
          } satisfies HeadTurnChallengeResponse;
        }
      }

      // speak_phrase
      if (session.policy.audio_challenge && session.policy.audio_challenge.type === 'speak_phrase') {
        challengeResponse = {
          type: 'speak_phrase',
          seed: session.policy.audio_challenge.seed,
          completed: true,
          started_at: challengeData?.started_at || new Date().toISOString(),
          completed_at: challengeData?.completed_at || new Date().toISOString(),
        };
      }

      // ── Build metadata payload ────────────────────────────────────────
      const metadataPayload: MetadataPayload = {
        web_integrity: webIntegrity,
        challenge_response: challengeResponse,
        webauthn_data: webauthnData,
      };

      // ── Upload ────────────────────────────────────────────────────────
      onEvent?.({ type: 'upload_started', timestamp: Date.now() });
      const api = (client as any).api || (client as any).getAPI();
      await api.uploadSignals(session.session_id, session.session_token, frames, metadataPayload, audioBlob);
      onEvent?.({ type: 'upload_completed', timestamp: Date.now() });

      // ── Complete ──────────────────────────────────────────────────────
      onEvent?.({ type: 'complete_started', timestamp: Date.now() });
      const finalDecision = await api.completeSession(session.session_id, session.session_token);

      // Redact before emitting to host — only safe fields leave the SDK
      const redacted = redactDecision(finalDecision);
      onEvent?.({ type: 'decision_received', timestamp: Date.now(), data: redacted });

      // Store full decision internally for screen routing only
      setDecision(finalDecision);

      switch (finalDecision.decision) {
        case 'APPROVE':
          setScreen('success');
          break;
        case 'REJECT':
          setScreen('denied');
          break;
        case 'MANUAL_REVIEW':
          setScreen('manual-review');
          break;
        default:
          setScreen('success');
          break;
      }
    } catch (err) {
      handleError(err as UseSenseError);
    } finally {
      videoStream?.getTracks().forEach(track => track.stop());
      audioStream?.getTracks().forEach(track => track.stop());
    }
  };

  // ─── Error Handling ──────────────────────────────────────────────────────

  const handleError = (err: UseSenseError) => {
    setError(err);

    if (err.code === 'QUOTA_EXCEEDED') {
      setScreen('blocked');
    } else if (err.code === 'CAMERA_PERMISSION_DENIED' || err.code === 'MIC_PERMISSION_DENIED') {
      setScreen('denied');
    } else {
      setScreen('failure');
    }

    onEvent?.({ type: 'error', timestamp: Date.now(), data: err });
    onError?.(err);
  };

  // ─── Retry / Continue ────────────────────────────────────────────────────

  const handleRetry = () => {
    setScreen('intro');
    setSession(null);
    setVideoStream(null);
    setAudioStream(null);
    setError(null);
    setDecision(null);
    setCapturedFrames([]);
    setFrameMetadata([]);
    setIntroLoading(false);
    captureReadyFired.current = false;
  };

  const handleContinue = () => {
    if (decision) {
      // Redact before calling onComplete — strip sensitive scoring/pillar data
      onComplete?.(redactDecision(decision));
    }
  };

  // ─── Screen Renderer ─────────────────────────────────────────────────────

  const renderScreen = () => {
    const logoUrl = branding.logoUrl;

    switch (screen) {
      case 'intro':
        return (
          <IntroScreen
            sessionType={sessionType}
            environment={config.environment}
            logoUrl={logoUrl}
            onStart={handleIntroStart}
            loading={introLoading}
          />
        );

      case 'permission-camera':
        return (
          <PermissionScreen
            type="camera"
            onRequest={handleCameraPermission}
            logoUrl={logoUrl}
          />
        );

      case 'permission-microphone':
        return (
          <PermissionScreen
            type="microphone"
            onRequest={handleMicrophonePermission}
            logoUrl={logoUrl}
          />
        );

      case 'capture-setup':
      case 'capturing':
        return videoStream ? (
          <CaptureScreen
            stream={videoStream}
            isCapturing={screen === 'capturing'}
            guidance={guidance}
            onReady={handleCaptureReady}
            logoUrl={logoUrl}
            onQualityReport={handleQualityReport}
          />
        ) : null;

      case 'challenge': {
        const challengeSpec = session?.policy.challenge;
        const audioSpec = session?.policy.audio_challenge;
        const effectiveType = challengeSpec?.type || audioSpec?.type || 'none';

        // Determine if this challenge uses the integrated two-phase capture
        const useIntegrated =
          (effectiveType === 'head_turn' || effectiveType === 'follow_dot') &&
          needsIntegratedCapture();

        return videoStream && effectiveType !== 'none' ? (
          <ChallengeScreen
            type={effectiveType as any}
            stream={videoStream}
            challengeSpec={challengeSpec}
            audioSpec={audioSpec}
            uploadConfig={session?.upload}
            integratedCapture={useIntegrated}
            onComplete={handleChallengeComplete}
            logoUrl={logoUrl}
            onQualityReport={handleQualityReport}
          />
        ) : null;
      }

      case 'uploading':
        return <UploadingScreen logoUrl={logoUrl} />;

      case 'success':
        return decision ? (
          <SuccessScreen
            decision={decision}
            onContinue={handleContinue}
            logoUrl={logoUrl}
          />
        ) : null;

      case 'failure':
        return error ? (
          <FailureScreen
            error={error}
            onRetry={handleRetry}
            logoUrl={logoUrl}
          />
        ) : null;

      case 'denied':
        return decision ? (
          <DeniedScreen
            decision={decision}
            onContinue={handleContinue}
            logoUrl={logoUrl}
          />
        ) : null;

      case 'manual-review':
        return decision ? (
          <SuccessScreen
            decision={decision}
            onContinue={handleContinue}
            logoUrl={logoUrl}
          />
        ) : null;

      case 'blocked':
        return <BlockedScreen logoUrl={logoUrl} />;

      default:
        return null;
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: baseStyles }} />
      <div className="usesense-container" style={getThemeStyles(branding.primaryColor) as React.CSSProperties}>
        {renderScreen()}
      </div>
    </>
  );
};