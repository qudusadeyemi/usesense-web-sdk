import React, { useEffect, useState, useCallback, useRef } from 'react';
import type {
  VerificationCaptureEngineProps,
  CapturePhase,
  CaptureResult,
  FaceGuideStatus,
  FollowDotChallenge,
  HeadTurnChallenge,
  SpeakPhraseChallenge,
  FrameSignal,
  OnDevice3DMMFit,
  VerificationFrame,
  SignalMetadata,
  WebIntegritySignals,
} from '../types';
import { getEngineStyles } from './styles';
import { collectWebIntegritySignals } from '../capture/web-integrity';
import {
  initFaceMesh,
  isFaceMeshReady,
  disposeFaceMesh,
  evaluateFaceGuide,
  extractFrameSignal,
  fitOnDevice3DMM,
  computeCrossFrameConsistency,
  computePreliminaryGCScore,
} from '../capture/media-pipe';
import {
  captureOneFrame,
  getFrameInterval,
  sleep,
  isFrameBudgetExhausted,
} from '../capture/frame-capture';
import type { CapturedFrame } from '../capture/frame-capture';
import { recordAudio } from '../capture/audio-capture';
import { computeMeshDigest, computeBindingProof } from '../utils/crypto';
import { getCameraErrorMessage } from '../utils/errors';
import { uploadSignals } from '../api-client';
import { completeSession } from '../api-client';

// ── Constants ───────────────────────────────────────────────────────────

const BASELINE_DURATION = 2000;
const FACE_GUIDE_AUTO_ADVANCE = 8;
const SDK_VERSION = '2.0.0';
const DEFAULT_PRIMARY = '#4f46e5';

// ── SVG Icons ───────────────────────────────────────────────────────────

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

function ArrowSvg({ direction }: { direction: string }) {
  switch (direction) {
    case 'left':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>;
    case 'right':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
    case 'up':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>;
    case 'down':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>;
    default: // center
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /></svg>;
  }
}

// ── Component ───────────────────────────────────────────────────────────

export const VerificationCaptureEngine: React.FC<VerificationCaptureEngineProps> = ({
  sessionData,
  environment,
  anonKey,
  apiBaseUrl,
  primaryColor = DEFAULT_PRIMARY,
  logoUrl,
  displayName,
  sessionType: _sessionType,
  onComplete,
  onError,
  onPhaseChange,
}) => {
  // ── State ─────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<CapturePhase>('initializing');
  const [phaseLabel, setPhaseLabel] = useState('Initializing...');
  const [progress, setProgress] = useState(0);
  const [countdownNumber, setCountdownNumber] = useState<number | null>(null);
  const [faceGuideStatus, setFaceGuideStatus] = useState<FaceGuideStatus | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [envWarning, setEnvWarning] = useState<string | null>(null);
  const [dotPosition, setDotPosition] = useState<{ x: number; y: number } | null>(null);
  const [challengeDirection, setChallengeDirection] = useState<string | null>(null);
  const [speakPhrase, setSpeakPhrase] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [framesCollected, setFramesCollected] = useState(0);

  // ── Refs ──────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<CapturedFrame[]>([]);
  const meshSignalsRef = useRef<FrameSignal[]>([]);
  const channelIntegrityRef = useRef<WebIntegritySignals | null>(null);
  const baselineFrameCountRef = useRef(0);
  const captureStartTimeRef = useRef(0);
  const challengeStartedAtRef = useRef('');
  const challengeCompletedAtRef = useRef('');
  const audioRef = useRef<Blob | null>(null);
  const abortRef = useRef(false);
  const consecutiveReadyRef = useRef(0);
  const faceGuideIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const envIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepFrameMapRef = useRef<Record<string, number[]>>({});
  const waypointFrameMapRef = useRef<Record<string, number[]>>({});
  const phaseRef = useRef<CapturePhase>('initializing');

  // Keep phaseRef in sync
  const updatePhase = useCallback((p: CapturePhase, label: string) => {
    phaseRef.current = p;
    setPhase(p);
    setPhaseLabel(label);
    onPhaseChange?.(p, label);
    console.log(`[UseSense] Phase: ${p} -- ${label}`);
  }, [onPhaseChange]);

  // ── Cleanup ───────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (faceGuideIntervalRef.current) clearInterval(faceGuideIntervalRef.current);
      if (envIntervalRef.current) clearInterval(envIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      disposeFaceMesh();
    };
  }, []);

  // ── Capture helper ────────────────────────────────────────────────────
  const grabFrame = useCallback(async (capturePhase: 'baseline' | 'challenge'): Promise<CapturedFrame | null> => {
    if (isFrameBudgetExhausted(framesRef.current.length)) return null;
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    const frame = await captureOneFrame(video, framesRef.current.length, captureStartTimeRef.current);
    if (!frame) return null;

    framesRef.current.push(frame);
    setFramesCollected(framesRef.current.length);

    // MediaPipe signal extraction
    if (isFaceMeshReady()) {
      const signal = extractFrameSignal(video, frame.index, capturePhase);
      if (signal) meshSignalsRef.current.push(signal);
    }

    return frame;
  }, []);

  // ── Environment quality ───────────────────────────────────────────────
  const startEnvChecks = useCallback(() => {
    if (envIntervalRef.current) clearInterval(envIntervalRef.current);
    envIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, 160, 120);
      const data = ctx.getImageData(0, 0, 160, 120).data;
      let totalLum = 0;
      let overexposed = 0;
      const pixelCount = 160 * 120;
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        totalLum += lum;
        if (lum > 245) overexposed++;
      }
      const avgLum = totalLum / pixelCount;
      const glare = (overexposed / pixelCount) * 100;
      if (avgLum < 45) setEnvWarning('Too dark -- move to a brighter area');
      else if (glare > 15) setEnvWarning('Too bright -- avoid direct light');
      else setEnvWarning(null);
    }, 500);
  }, []);

  // ── Camera request ────────────────────────────────────────────────────
  const requestCamera = useCallback(async () => {
    updatePhase('camera-request', 'Requesting camera access...');
    try {
      const needsAudio = sessionData.policy.challenge_type === 'speak_phrase';
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user', frameRate: { ideal: 30 } },
        audio: needsAudio,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      console.log('[UseSense] Camera access granted');
      startFaceGuide();
    } catch (err: any) {
      console.error('[UseSense] Camera error:', err);
      setCameraError(getCameraErrorMessage(err));
      updatePhase('camera-error', 'Camera error');
    }
  }, [sessionData, updatePhase, startEnvChecks]);

  // ── Face guide ────────────────────────────────────────────────────────
  const startFaceGuide = useCallback(() => {
    updatePhase('face-guide', 'Position your face in the oval');
    consecutiveReadyRef.current = 0;
    startEnvChecks();

    if (faceGuideIntervalRef.current) clearInterval(faceGuideIntervalRef.current);
    faceGuideIntervalRef.current = setInterval(() => {
      if (abortRef.current || phaseRef.current !== 'face-guide') return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const status = isFaceMeshReady()
        ? evaluateFaceGuide(video)
        : { faceDetected: true, faceCentered: true, faceDistance: 'good' as const, faceVisible: true, message: 'Position your face in the oval', ready: false };

      setFaceGuideStatus(status);

      if (status.ready) {
        consecutiveReadyRef.current++;
        if (consecutiveReadyRef.current >= FACE_GUIDE_AUTO_ADVANCE) {
          advanceToBaseline();
        }
      } else {
        consecutiveReadyRef.current = 0;
      }
    }, 250);
  }, [updatePhase, startEnvChecks]);

  const advanceToBaseline = useCallback(() => {
    if (faceGuideIntervalRef.current) {
      clearInterval(faceGuideIntervalRef.current);
      faceGuideIntervalRef.current = null;
    }
    runBaseline();
  }, []);

  // ── Baseline ──────────────────────────────────────────────────────────
  const runBaseline = useCallback(async () => {
    updatePhase('baseline', 'Keep your face still...');
    setProgress(0);
    captureStartTimeRef.current = performance.now();

    const fps = sessionData.upload.target_fps || 4;
    const interval = getFrameInterval(fps);
    const start = performance.now();

    while (performance.now() - start < BASELINE_DURATION && !abortRef.current) {
      await grabFrame('baseline');
      const elapsed = performance.now() - start;
      setProgress(Math.min((elapsed / BASELINE_DURATION) * 50, 50));
      await sleep(interval);
    }

    baselineFrameCountRef.current = framesRef.current.length;

    const challengeType = sessionData.policy.challenge_type;
    if (challengeType === 'none') {
      runUpload();
    } else {
      runCountdown();
    }
  }, [sessionData, updatePhase, grabFrame]);

  // ── Countdown ─────────────────────────────────────────────────────────
  const runCountdown = useCallback(async () => {
    updatePhase('countdown', 'Get ready...');
    const fps = sessionData.upload.target_fps || 4;
    const interval = getFrameInterval(fps);

    for (const n of [3, 2, 1]) {
      if (abortRef.current) return;
      setCountdownNumber(n);
      const stepEnd = performance.now() + 1000;
      while (performance.now() < stepEnd && !abortRef.current) {
        await grabFrame('baseline');
        await sleep(interval);
      }
    }
    setCountdownNumber(null);
    runChallenge();
  }, [sessionData, updatePhase, grabFrame]);

  // ── Challenge dispatch ────────────────────────────────────────────────
  const runChallenge = useCallback(async () => {
    const challengeType = sessionData.policy.challenge_type;
    challengeStartedAtRef.current = new Date().toISOString();

    switch (challengeType) {
      case 'head_turn':
        await runHeadTurn();
        break;
      case 'follow_dot':
        await runFollowDot();
        break;
      case 'speak_phrase':
        await runSpeakPhrase();
        break;
      default:
        runUpload();
    }
  }, [sessionData]);

  // ── Head Turn ─────────────────────────────────────────────────────────
  const runHeadTurn = useCallback(async () => {
    updatePhase('challenge', 'Follow the instructions');
    const spec = sessionData.policy.challenge as HeadTurnChallenge;
    if (!spec?.sequence) { runUpload(); return; }

    const fps = sessionData.upload.target_fps || 4;
    const interval = getFrameInterval(fps);
    const sequence = spec.sequence;
    stepFrameMapRef.current = {};
    sequence.forEach(s => { stepFrameMapRef.current[String(s.index)] = []; });

    const dirLabels: Record<string, string> = {
      left: 'Turn your head LEFT', right: 'Turn your head RIGHT',
      up: 'Tilt your head UP', down: 'Tilt your head DOWN',
      center: 'Look straight ahead',
    };

    for (let si = 0; si < sequence.length; si++) {
      if (abortRef.current) return;
      const step = sequence[si];
      setChallengeDirection(step.direction);
      setPhaseLabel(dirLabels[step.direction] || 'Follow the instructions');
      setProgress(50 + (si / sequence.length) * 50);

      const stepEnd = performance.now() + step.duration_ms;
      while (performance.now() < stepEnd && !abortRef.current) {
        const frame = await grabFrame('challenge');
        if (frame) stepFrameMapRef.current[String(step.index)].push(frame.index);
        await sleep(interval);
      }
    }

    setChallengeDirection(null);
    setProgress(100);
    challengeCompletedAtRef.current = new Date().toISOString();
    runUpload();
  }, [sessionData, updatePhase, grabFrame]);

  // ── Follow Dot ────────────────────────────────────────────────────────
  const runFollowDot = useCallback(async () => {
    updatePhase('challenge', 'Follow the dot with your eyes');
    const spec = sessionData.policy.challenge as FollowDotChallenge;
    if (!spec?.waypoints) { runUpload(); return; }

    const fps = sessionData.upload.target_fps || 4;
    const interval = getFrameInterval(fps);
    const waypoints = spec.waypoints;
    waypointFrameMapRef.current = {};
    waypoints.forEach(wp => { waypointFrameMapRef.current[String(wp.index)] = []; });

    for (let wi = 0; wi < waypoints.length; wi++) {
      if (abortRef.current) return;
      const wp = waypoints[wi];
      setDotPosition({ x: wp.x * 100, y: wp.y * 100 });
      setProgress(50 + (wi / waypoints.length) * 50);

      const wpEnd = performance.now() + wp.duration_ms;
      while (performance.now() < wpEnd && !abortRef.current) {
        const frame = await grabFrame('challenge');
        if (frame) waypointFrameMapRef.current[String(wp.index)].push(frame.index);
        await sleep(interval);
      }
    }

    setDotPosition(null);
    setProgress(100);
    challengeCompletedAtRef.current = new Date().toISOString();
    runUpload();
  }, [sessionData, updatePhase, grabFrame]);

  // ── Speak Phrase ──────────────────────────────────────────────────────
  const runSpeakPhrase = useCallback(async () => {
    const audioSpec = sessionData.policy.audio_challenge as SpeakPhraseChallenge | undefined;
    const phrase = audioSpec?.phrase || '3 7 2 9 1';
    const duration = audioSpec?.total_duration_ms || 5000;

    updatePhase('challenge', 'Please say the phrase below');
    setSpeakPhrase(phrase);
    setIsRecording(true);

    const fps = sessionData.upload.target_fps || 4;
    const interval = getFrameInterval(fps);

    // Record audio + capture frames in parallel
    const stream = streamRef.current;
    const audioPromise = stream ? recordAudio(stream, duration) : Promise.resolve(null);

    const start = performance.now();
    while (performance.now() - start < duration && !abortRef.current) {
      await grabFrame('challenge');
      const elapsed = performance.now() - start;
      setProgress(50 + (elapsed / duration) * 50);
      await sleep(interval);
    }

    const audioBlob = await audioPromise;
    audioRef.current = audioBlob;
    setIsRecording(false);
    setSpeakPhrase(null);
    setProgress(100);
    challengeCompletedAtRef.current = new Date().toISOString();
    runUpload();
  }, [sessionData, updatePhase, grabFrame]);

  // ── Upload ────────────────────────────────────────────────────────────
  const runUpload = useCallback(async () => {
    updatePhase('uploading', 'Uploading verification data...');
    if (envIntervalRef.current) { clearInterval(envIntervalRef.current); envIntervalRef.current = null; }

    try {
      // Build challenge_response
      const challengeType = sessionData.policy.challenge_type;
      const frameTimestamps = framesRef.current.map(f => Math.round(f.timestamp));
      let challengeResponse: any = null;

      if (challengeType === 'head_turn') {
        const spec = sessionData.policy.challenge as HeadTurnChallenge;
        challengeResponse = {
          type: 'head_turn',
          seed: spec?.seed || '',
          completed: true,
          step_frames: stepFrameMapRef.current,
          started_at: challengeStartedAtRef.current,
          completed_at: challengeCompletedAtRef.current,
          frame_timestamps: frameTimestamps,
        };
      } else if (challengeType === 'follow_dot') {
        const spec = sessionData.policy.challenge as FollowDotChallenge;
        challengeResponse = {
          type: 'follow_dot',
          seed: spec?.seed || '',
          completed: true,
          waypoint_frames: waypointFrameMapRef.current,
          started_at: challengeStartedAtRef.current,
          completed_at: challengeCompletedAtRef.current,
          frame_timestamps: frameTimestamps,
        };
      } else if (challengeType === 'speak_phrase') {
        const spec = sessionData.policy.audio_challenge as SpeakPhraseChallenge | undefined;
        challengeResponse = {
          type: 'speak_phrase',
          seed: spec?.seed || '',
          completed: true,
          started_at: challengeStartedAtRef.current,
          completed_at: challengeCompletedAtRef.current,
        };
      } else {
        challengeResponse = { type: 'none', completed: true };
      }

      // Build on_device_mesh_package
      let meshPackage: any = null;
      if (meshSignalsRef.current.length > 0) {
        try {
          const vFrames: VerificationFrame[] = [];
          const fits: OnDevice3DMMFit[] = [];

          for (const signal of meshSignalsRef.current) {
            if (signal.landmarks?.length === 1404) {
              const fit = fitOnDevice3DMM(signal.landmarks);
              if (fit) {
                fits.push(fit);
                const frameHash = framesRef.current[signal.frameIndex]?.hash || '';
                const vf: VerificationFrame = {
                  frameIndex: signal.frameIndex,
                  timestamp: signal.timestamp,
                  shapeParams: fit.shapeParams,
                  pose: fit.pose,
                  depthPlausibility: fit.depthPlausibility,
                  frameHash,
                  geometricRatios: fit.geometricRatios,
                  poseRatios2D: fit.poseRatios2D,
                  poseNormalizationMethod: 'mediapipe_zyx_v2',
                };

                // Binding proof
                const bindingChallenge = sessionData.geometric_coherence?.mesh_binding_challenge;
                if (bindingChallenge && frameHash) {
                  try {
                    const meshDigest = await computeMeshDigest(fit.shapeParams, fit.pose);
                    vf.bindingProof = await computeBindingProof(bindingChallenge, frameHash, meshDigest);
                  } catch (e) {
                    console.warn('[UseSense] Binding proof failed:', e);
                  }
                }

                vFrames.push(vf);
              }
            }
          }

          if (vFrames.length > 0) {
            const consistency = computeCrossFrameConsistency(fits);
            const score = computePreliminaryGCScore(fits, consistency);
            meshPackage = {
              frames: vFrames,
              crossFrameConsistency: consistency,
              preliminaryScore: score,
              attestation: { platform: 'web' as const, token: null },
            };
            console.log(`[UseSense] Mesh package: ${vFrames.length} frames, GC score: ${score}`);
          }
        } catch (err) {
          console.warn('[UseSense] Mesh package assembly failed:', err);
        }
      }

      // Add frame_timestamps to channel_integrity
      const integrity = channelIntegrityRef.current || {} as WebIntegritySignals;
      integrity.frame_timestamps = frameTimestamps;

      const metadata: SignalMetadata = {
        channel_integrity: integrity,
        challenge_response: challengeResponse,
        on_device_mesh_package: meshPackage,
      };

      const frameBytes = framesRef.current.map(f => f.bytes);

      await uploadSignals({
        apiBaseUrl,
        anonKey,
        environment,
        sessionId: sessionData.session_id,
        sessionToken: sessionData.session_token,
        nonce: sessionData.nonce,
        frames: frameBytes,
        metadata,
        audioBlob: audioRef.current,
      });

      console.log('[UseSense] Upload successful');
      runComplete();
    } catch (err: any) {
      console.error('[UseSense] Upload failed:', err);
      onError(err.message || 'Upload failed');
    }
  }, [sessionData, environment, anonKey, apiBaseUrl, updatePhase, onError]);

  // ── Complete ──────────────────────────────────────────────────────────
  const runComplete = useCallback(async () => {
    updatePhase('completing', 'Verifying...');
    try {
      const decision = await completeSession({
        apiBaseUrl,
        anonKey,
        environment,
        sessionId: sessionData.session_id,
        sessionToken: sessionData.session_token,
        nonce: sessionData.nonce,
      });

      console.log('[UseSense] Decision:', decision.decision);
      setResult(decision);
      updatePhase('done', 'Complete');

      // Stop camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    } catch (err: any) {
      console.error('[UseSense] Complete failed:', err);
      onError(err.message || 'Verification failed');
    }
  }, [sessionData, environment, anonKey, apiBaseUrl, updatePhase, onError]);

  // ── Retry ─────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    framesRef.current = [];
    meshSignalsRef.current = [];
    stepFrameMapRef.current = {};
    waypointFrameMapRef.current = {};
    baselineFrameCountRef.current = 0;
    audioRef.current = null;
    setFramesCollected(0);
    setProgress(0);
    setResult(null);
    setCameraError(null);
    setEnvWarning(null);
    setDotPosition(null);
    setChallengeDirection(null);
    setSpeakPhrase(null);
    setIsRecording(false);
    setCountdownNumber(null);
    abortRef.current = false;
    requestCamera();
  }, [requestCamera]);

  // ── Init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function init() {
      updatePhase('initializing', 'Getting ready...');

      // Run in parallel: web integrity + MediaPipe
      const [signals] = await Promise.all([
        collectWebIntegritySignals(),
        initFaceMesh().catch(() => {}),
      ]);

      if (!mounted) return;
      channelIntegrityRef.current = signals;
      requestCamera();
    }

    init();
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render helpers ────────────────────────────────────────────────────
  const showCamera = ['face-guide', 'baseline', 'countdown', 'challenge'].includes(phase);

  const renderResult = () => {
    if (!result) return null;
    const d = result.decision;
    const isApprove = d === 'APPROVE';
    const isReject = d === 'REJECT';
    const iconClass = isApprove ? 'usesense-result-icon--success' : isReject ? 'usesense-result-icon--failure' : 'usesense-result-icon--review';
    const title = isApprove ? 'Verification Successful' : isReject ? 'Verification Failed' : 'Pending Review';
    const subtitle = isApprove
      ? 'Your identity has been confirmed.'
      : isReject
        ? 'We could not verify your identity.'
        : 'Your verification is being reviewed.';

    return (
      <div className="usesense-result">
        <div className={`usesense-result-icon ${iconClass}`}>
          {isApprove ? <CheckIcon /> : isReject ? <XIcon /> : <ClockIcon />}
        </div>
        <div className="usesense-result-title">{title}</div>
        <div className="usesense-result-subtitle">{subtitle}</div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          {isReject && (
            <button className="usesense-btn usesense-btn--secondary" onClick={handleRetry}>Retry</button>
          )}
          <button className="usesense-btn usesense-btn--primary" onClick={() => onComplete(result)}>
            {isReject ? 'Cancel' : 'Done'}
          </button>
        </div>
      </div>
    );
  };

  // ── JSX ───────────────────────────────────────────────────────────────
  return (
    <div className="usesense-engine">
      <style>{getEngineStyles(primaryColor)}</style>

      {logoUrl && <img className="usesense-logo" src={logoUrl} alt={displayName || 'Logo'} />}

      {/* Initializing */}
      {phase === 'initializing' && (
        <div className="usesense-result">
          <div className="usesense-spinner" />
          <div className="usesense-status-text" style={{ marginTop: '16px' }}>Getting ready...</div>
        </div>
      )}

      {/* Camera request */}
      {phase === 'camera-request' && (
        <div className="usesense-result">
          <div className="usesense-result-icon" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <CameraIcon />
          </div>
          <div className="usesense-result-title">Camera Access Required</div>
          <div className="usesense-result-subtitle">
            We need access to your camera for identity verification
          </div>
        </div>
      )}

      {/* Camera error */}
      {phase === 'camera-error' && (
        <div className="usesense-result">
          <div className="usesense-result-icon usesense-result-icon--failure">
            <AlertIcon />
          </div>
          <div className="usesense-result-title">Camera Access Required</div>
          <div className="usesense-result-subtitle">{cameraError}</div>
          <button className="usesense-btn usesense-btn--primary" onClick={handleRetry} style={{ marginTop: '16px' }}>
            Retry Camera
          </button>
        </div>
      )}

      {/* Camera phases */}
      {showCamera && (
        <>
          <div className="usesense-camera-container">
            <video ref={videoRef} className="usesense-camera-video" autoPlay playsInline muted />
            <div className="usesense-vignette" />

            {/* Face oval */}
            {(phase === 'face-guide' || phase === 'baseline') && (
              <div className={[
                'usesense-face-oval',
                faceGuideStatus?.ready ? 'usesense-face-oval--ready' : '',
                phase === 'baseline' ? 'usesense-face-oval--baseline' : '',
              ].join(' ')} />
            )}

            {/* Face guide feedback */}
            {phase === 'face-guide' && faceGuideStatus && (
              <div className={`usesense-guide-feedback ${faceGuideStatus.ready ? 'usesense-guide-feedback--ready' : ''}`}>
                {faceGuideStatus.message}
              </div>
            )}

            {/* Countdown */}
            {phase === 'countdown' && countdownNumber !== null && (
              <div className="usesense-countdown-overlay">
                <div key={countdownNumber} className="usesense-countdown-number">{countdownNumber}</div>
                <div className="usesense-countdown-label">Get ready...</div>
              </div>
            )}

            {/* Follow dot */}
            {phase === 'challenge' && dotPosition && (
              <div className="usesense-follow-dot" style={{ left: `${dotPosition.x}%`, top: `${dotPosition.y}%` }} />
            )}

            {/* Direction arrow */}
            {phase === 'challenge' && challengeDirection && (
              <div key={challengeDirection} className="usesense-direction-arrow">
                <ArrowSvg direction={challengeDirection} />
              </div>
            )}

            {/* Environment warning */}
            {envWarning && <div className="usesense-env-warning">{envWarning}</div>}
          </div>

          {/* Status area */}
          <div className="usesense-status-area">
            {phase === 'challenge' && isRecording && (
              <div className="usesense-recording-indicator">
                <div className="usesense-recording-dot" />
                Recording
              </div>
            )}

            <div className="usesense-status-text">{phaseLabel}</div>

            {phase === 'challenge' && speakPhrase && (
              <div className="usesense-phrase-display">{speakPhrase}</div>
            )}

            {phase === 'face-guide' && (
              <button
                className="usesense-btn usesense-btn--primary"
                disabled={!faceGuideStatus?.ready}
                onClick={advanceToBaseline}
                style={{ marginTop: '16px' }}
              >
                Continue
              </button>
            )}
          </div>

          {/* Progress */}
          {(phase === 'baseline' || phase === 'challenge') && (
            <div className="usesense-progress">
              <div className="usesense-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
        </>
      )}

      {/* Uploading / Completing */}
      {(phase === 'uploading' || phase === 'completing') && (
        <div className="usesense-result">
          <div className="usesense-spinner" />
          <div className="usesense-status-text" style={{ marginTop: '16px' }}>
            {phase === 'uploading' ? 'Uploading verification data...' : 'Verifying...'}
          </div>
          <div className="usesense-status-hint">{framesCollected} frames captured</div>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && renderResult()}

      <div className="usesense-footer">Powered by UseSense &middot; SDK v{SDK_VERSION}</div>
    </div>
  );
};
