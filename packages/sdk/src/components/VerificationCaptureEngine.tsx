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
  InlineStepUpEvidence,
  FaceMeshSignals,
  FramesManifestEntry,
  SuspicionData,
} from '../types';
import { getEngineStyles, USESENSE_FONTS_URL } from './styles';
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
import { SuspicionEngine } from '../capture/suspicion-engine';
import { computeScreenDetectionSignals } from '../capture/screen-detection';
import { runStepUp } from '../capture/step-up-orchestrator';
import { SDK_VERSION } from '../version';
// SNR (Screen-Nonce Reflection) was reverted server-side on staging; the
// client code is now fully removed (Phase 1 ticket X-9). sessionData.challenge
// is always falsy post-revert so the former conditional branches in this
// component were dead paths.

// ── Constants ───────────────────────────────────────────────────────────

const BASELINE_DURATION = 2000;
const FACE_GUIDE_AUTO_ADVANCE = 8;

function computeFrameSharpness(video: HTMLVideoElement): number {
  try {
    const w = 64, h = 48;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 50;
    ctx.drawImage(video, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const lums = new Float32Array(w * h);
    for (let i = 0, pi = 0; i < data.length; i += 4, pi++) {
      lums[pi] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    let edgeSum = 0, edgeSumSq = 0;
    const edgeCount = (w - 1) * (h - 1);
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        const pi = y * w + x;
        const e = Math.abs(lums[pi] - lums[pi + 1]) + Math.abs(lums[pi] - lums[pi + w]);
        edgeSum += e; edgeSumSq += e * e;
      }
    }
    const edgeMean = edgeSum / edgeCount;
    return edgeSumSq / edgeCount - edgeMean * edgeMean;
  } catch { return 50; }
}
const DEFAULT_PRIMARY = '#4F7CFF';

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

const CHALLENGE_BRIEFS: Record<string, { title: string; description: string; tip: string }> = {
  head_turn: {
    title: 'Head Turn Challenge',
    description: 'You will be asked to turn your head in different directions.\nFollow the on-screen arrows.',
    tip: 'Make sure you are in a well-lit area with your face clearly visible.',
  },
  follow_dot: {
    title: 'Follow the Dot',
    description: 'A dot will move around the screen.\nFollow it with your gaze without moving your head.',
    tip: 'Stay still and move only your eyes.',
  },
  speak_phrase: {
    title: 'Speak a Phrase',
    description: 'You will be asked to read a short phrase aloud clearly.',
    tip: 'Make sure you are in a quiet environment with your microphone enabled.',
  },
};

export const VerificationCaptureEngine: React.FC<VerificationCaptureEngineProps> = ({
  sessionData,
  environment: environmentProp,
  apiBaseUrl,
  primaryColor = DEFAULT_PRIMARY,
  logoUrl,
  displayName,
  sessionType: _sessionType,
  onComplete,
  onError,
  onCancel,
  onPhaseChange,
  liveSenseV4Enabled = false,
}) => {
  const environment = environmentProp ?? 'sandbox';

  // ── State ─────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<CapturePhase>('intro');
  const [started, setStarted] = useState(false);
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
  const [_isRecording, setIsRecording] = useState(false);
  const [_framesCollected, setFramesCollected] = useState(0);
  const [stepUpPhase, setStepUpPhase] = useState<'idle' | 'intro' | 'flash' | 'rmas' | 'complete'>('idle');
  const [flashOverlayColor, setFlashOverlayColor] = useState<string | null>(null);
  const [rmasState, setRmasState] = useState<{ label: string; step: number; total: number; countdown: number } | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRefBlurred = useRef<HTMLVideoElement>(null);
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
  const prevLumRef = useRef<Float32Array | null>(null);
  const stepFrameMapRef = useRef<Record<string, number[]>>({});
  const waypointFrameMapRef = useRef<Record<string, number[]>>({});
  const phaseRef = useRef<CapturePhase>('initializing');
  const suspicionEngineRef = useRef<SuspicionEngine | null>(null);
  const stepUpEvidenceRef = useRef<InlineStepUpEvidence | null>(null);
  const sessionStartedAtRef = useRef(Date.now());
  const captureStartedAtMsRef = useRef(0);
  const frameLuminancesRef = useRef<number[]>([]);
  // Keep phaseRef in sync
  const updatePhase = useCallback((p: CapturePhase, label: string) => {
    phaseRef.current = p;
    setPhase(p);
    setPhaseLabel(label);
    onPhaseChange?.(p, label);
    console.log(`[UseSense] Phase: ${p} -- ${label}`);
  }, [onPhaseChange]);

  // ── Load brand fonts ──────────────────────────────────────────────────
  useEffect(() => {
    const id = 'usesense-fonts';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = USESENSE_FONTS_URL;
      document.head.appendChild(link);
    }
  }, []);

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
  const grabFrame = useCallback(async (capturePhase: 'baseline' | 'zoom' | 'challenge'): Promise<CapturedFrame | null> => {
    if (isFrameBudgetExhausted(framesRef.current.length)) return null;
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    const frame = await captureOneFrame(video, framesRef.current.length, captureStartTimeRef.current);
    if (!frame) return null;

    // v4: tag the frame with its capture phase so the server's SfM
    // perspective validator can filter to the zoom subset.
    frame.phase = capturePhase;
    framesRef.current.push(frame);
    setFramesCollected(framesRef.current.length);

    // MediaPipe signal extraction
    let signal: FrameSignal | null = null;
    if (isFaceMeshReady()) {
      signal = extractFrameSignal(video, frame.index, capturePhase);
      if (signal) meshSignalsRef.current.push(signal);
    }

    // Feed suspicion engine
    if (suspicionEngineRef.current) {
      const sharpness = computeFrameSharpness(video);
      const headPose = signal?.headPose ?? { yaw: 0, pitch: 0, roll: 0 };
      suspicionEngineRef.current.push(headPose, frame.luminance, sharpness);
      frameLuminancesRef.current.push(frame.luminance);
    }

    return frame;
  }, []);

  // ── Environment quality (brightness + blur + motion) ─────────────────
  const startEnvChecks = useCallback(() => {
    if (envIntervalRef.current) clearInterval(envIntervalRef.current);
    envIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      const W = 160; const H = 120;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;
      const pixelCount = W * H;

      // Build luminance array + brightness stats
      const lums = new Float32Array(pixelCount);
      let totalLum = 0;
      let overexposed = 0;
      for (let i = 0, pi = 0; i < data.length; i += 4, pi++) {
        const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        lums[pi] = l;
        totalLum += l;
        if (l > 245) overexposed++;
      }
      const avgLum = totalLum / pixelCount;
      const glare = (overexposed / pixelCount) * 100;

      // Blur detection: variance of horizontal+vertical finite differences
      // (Laplacian proxy -- high variance = sharp, low variance = blurry)
      let edgeSum = 0;
      let edgeSumSq = 0;
      const edgeCount = (W - 1) * (H - 1);
      for (let y = 0; y < H - 1; y++) {
        for (let x = 0; x < W - 1; x++) {
          const pi = y * W + x;
          const dx = Math.abs(lums[pi] - lums[pi + 1]);
          const dy = Math.abs(lums[pi] - lums[pi + W]);
          const e = dx + dy;
          edgeSum += e;
          edgeSumSq += e * e;
        }
      }
      const edgeMean = edgeSum / edgeCount;
      const blurScore = edgeSumSq / edgeCount - edgeMean * edgeMean; // variance

      // Motion detection: mean absolute difference from previous frame
      let motionScore = 0;
      const prev = prevLumRef.current;
      if (prev) {
        for (let pi = 0; pi < pixelCount; pi++) {
          motionScore += Math.abs(lums[pi] - prev[pi]);
        }
        motionScore /= pixelCount;
      }
      prevLumRef.current = lums;

      if (avgLum < 45) setEnvWarning('Too dark \u2014 move to a brighter area');
      else if (glare > 15) setEnvWarning('Too bright \u2014 avoid direct light');
      else if (blurScore < 20) setEnvWarning('Hold still \u2014 image is blurry');
      else if (prev && motionScore > 8) setEnvWarning('Hold still \u2014 too much movement');
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
      if (videoRefBlurred.current) {
        videoRefBlurred.current.srcObject = stream;
        await videoRefBlurred.current.play();
      }
      console.log('[UseSense] Camera access granted');

      // Update permissions_state now that camera (and mic) access is confirmed.
      if (channelIntegrityRef.current?.permissions_state) {
        channelIntegrityRef.current.permissions_state.camera = 'granted';
        if (needsAudio) {
          channelIntegrityRef.current.permissions_state.microphone = 'granted';
        }
      }
      const challengeType = sessionData.policy.challenge_type;
      if (challengeType !== 'none' && CHALLENGE_BRIEFS[challengeType]) {
        updatePhase('challenge-brief', 'Ready to start');
      } else {
        startFaceGuide();
      }
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

  // ── v4 Zoom phase ─────────────────────────────────────────────────────
  // Constitutive perspective-distortion capture. Spec section 6.3.2 set
  // 1.2-1.8s as a hardware lower bound; staging-tested UX from watchtower
  // hosted-enrolment showed users need ~7s end-to-end (800ms prep so the
  // prompt registers, then 6s of motion-tracked capture) to actually
  // complete the zoom motion deliberately. Tighter windows produce
  // perspective_score=0 from insufficient parallax.
  const ZOOM_PREP_MS = 800;
  const ZOOM_DURATION = 6000;
  const runZoomPhase = useCallback(async () => {
    if (!liveSenseV4Enabled) return;
    updatePhase('zoom', 'Bring the phone closer to fill the oval');
    // Prep beat: the prompt is visible but we do not yet capture frames
    // for the SfM bundle. Lets the user read and start their motion
    // before frames are scored.
    await sleep(ZOOM_PREP_MS);
    if (abortRef.current) return;
    const fps = sessionData.upload.target_fps || 4;
    const interval = getFrameInterval(fps);
    const start = performance.now();
    while (performance.now() - start < ZOOM_DURATION && !abortRef.current) {
      await grabFrame('zoom');
      await sleep(interval);
    }
  }, [liveSenseV4Enabled, sessionData, updatePhase, grabFrame]);

  // ── Baseline ──────────────────────────────────────────────────────────
  const runBaseline = useCallback(async () => {
    updatePhase('baseline', 'Keep your face still...');
    setProgress(0);
    captureStartTimeRef.current = performance.now();
    captureStartedAtMsRef.current = Date.now();

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

    // SNR (Screen-Nonce Reflection) was reverted server-side on staging and
    // the client code was removed in X-9. sessionData.challenge is always
    // falsy post-revert; the block that used to run the SNR controller here
    // is intentionally deleted.

    // v4: insert a constitutive zoom-motion phase between baseline and the
    // active challenge. Additive -- existing challenges still run.
    if (liveSenseV4Enabled) {
      await runZoomPhase();
    }

    const challengeType = sessionData.policy.challenge_type;
    if (challengeType === 'none') {
      // Check step-up before upload
      const stepUpPolicy = sessionData.policy.inline_step_up;
      const stepUpEnabled = stepUpPolicy?.enabled !== false;
      if (stepUpEnabled && suspicionEngineRef.current?.shouldTrigger()) {
        await doInlineStepUp();
      }
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
    // Check step-up before upload
    const stepUpPolicy = sessionData.policy.inline_step_up;
    if (stepUpPolicy?.enabled !== false && suspicionEngineRef.current?.shouldTrigger()) {
      await doInlineStepUp();
    }
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
    const stepUpPolicyDot = sessionData.policy.inline_step_up;
    if (stepUpPolicyDot?.enabled !== false && suspicionEngineRef.current?.shouldTrigger()) {
      await doInlineStepUp();
    }
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
    const stepUpPolicySpeak = sessionData.policy.inline_step_up;
    if (stepUpPolicySpeak?.enabled !== false && suspicionEngineRef.current?.shouldTrigger()) {
      await doInlineStepUp();
    }
    runUpload();
  }, [sessionData, updatePhase, grabFrame]);

  // ── Inline Step-Up ────────────────────────────────────────────────────
  const doInlineStepUp = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const policy = sessionData.policy.inline_step_up;
    const score = suspicionEngineRef.current?.getScore() ?? 0;
    const evidence = await runStepUp(
      score,
      policy?.suspicion_threshold ?? 55,
      policy?.preferred_challenge ?? 'auto',
      video,
      {
        setFlashOverlayColor,
        setRMASState: setRmasState,
        setStepUpPhase: (phase) => {
          setStepUpPhase(phase);
          const labels: Record<string, string> = {
            intro: 'Additional verification...',
            flash: 'Hold still...',
            rmas: 'Follow the prompts',
            complete: 'Verification complete',
          };
          updatePhase(('step-up-' + phase) as CapturePhase, labels[phase]);
        },
      }
    );
    stepUpEvidenceRef.current = evidence;
    // Resume capture for 500ms of additional frames
    const fps = sessionData.upload.target_fps || 3;
    const interval = getFrameInterval(fps);
    const resumeEnd = performance.now() + 500;
    while (performance.now() < resumeEnd && !abortRef.current) {
      await grabFrame('challenge');
      await sleep(interval);
    }
    setStepUpPhase('idle');
  }, [sessionData, updatePhase, grabFrame]);

  // ── Upload ────────────────────────────────────────────────────────────
  const runUpload = useCallback(async () => {
    if (abortRef.current) return;
    updatePhase('uploading', 'Uploading verification data...');
    if (envIntervalRef.current) { clearInterval(envIntervalRef.current); envIntervalRef.current = null; }

    try {
      // Build challenge_response
      const challengeType = sessionData.policy.challenge_type;
      // Timestamps are absolute Date.now() values (set in captureOneFrame)
      const frameTimestamps = framesRef.current.map(f => f.timestamp);
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

          // Binding challenge from session creation response
          const bindingChallenge = sessionData.geometric_coherence?.mesh_binding_challenge;

          for (const signal of meshSignalsRef.current) {
            // FaceLandmarker returns 478 landmarks (1434 floats); FaceMesh returns 468 (1404).
            // Accept either -- all landmark indices we use are within the first 468.
            if (signal.landmarks && signal.landmarks.length >= 1404) {
              const fit = fitOnDevice3DMM(signal.landmarks);
              if (fit) {
                fits.push(fit);
                const frameHash = framesRef.current[signal.frameIndex]?.hash || '';

                // Truncate to 468*3=1404 floats so the server digest matches
                // (FaceLandmarker gives 478*3=1434; we only use the first 468).
                const landmarksForDigest = signal.landmarks.slice(0, 1404);

                // computeMeshDigest requires {s, p, d, l} -- all four fields.
                const meshDigest = await computeMeshDigest(
                  fit.shapeParams,
                  fit.pose,
                  fit.depthPlausibility,
                  landmarksForDigest
                );
                const bindingProof = bindingChallenge && frameHash
                  ? await computeBindingProof(bindingChallenge, frameHash, meshDigest).catch((e) => {
                      console.warn('[UseSense] Binding proof failed:', e);
                      return '';
                    })
                  : '';

                const vf: VerificationFrame = {
                  frameIndex: signal.frameIndex,
                  timestamp: signal.timestamp,
                  shapeParams: fit.shapeParams,
                  pose: fit.pose,
                  depthPlausibility: fit.depthPlausibility,
                  geometricRatios: fit.geometricRatios,
                  poseRatios2D: fit.poseRatios2D,
                  landmarks: landmarksForDigest,
                  frameHash,
                  meshDigest,
                  bindingProof,
                  poseNormalizationMethod: 'mediapipe_zyx_v2',
                };

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
              attestation: { platform: 'web' as const },
            };
            console.log(`[UseSense] Mesh package: ${vFrames.length} frames, GC score: ${score}`);
          }
        } catch (err) {
          console.warn('[UseSense] Mesh package assembly failed:', err);
        }
      }

      // Populate frame-timing and camera fields that are only known at upload time
      const integrity = channelIntegrityRef.current || {} as WebIntegritySignals;
      integrity.frame_timestamps = frameTimestamps;
      integrity.avg_frame_interval_ms =
        frameTimestamps.length >= 2
          ? Math.round(
              (frameTimestamps[frameTimestamps.length - 1] - frameTimestamps[0]) /
                (frameTimestamps.length - 1)
            )
          : 0;
      integrity.camera_permission_granted = !!streamRef.current;
      integrity.camera_resolution = videoRef.current
        ? `${videoRef.current.videoWidth}x${videoRef.current.videoHeight}` : undefined;
      if (streamRef.current && integrity.permissions_state) {
        integrity.permissions_state.camera = 'granted';
      }
      // v4.1: screen detection signals
      integrity.screen_detection = computeScreenDetectionSignals(frameLuminancesRef.current, null);

      const frameHashes = framesRef.current.map(f => f.hash);

      // v4.1: Build face_mesh_signals
      const faceMeshSignals: FaceMeshSignals | null = meshSignalsRef.current.length > 0 ? {
        model: 'mediapipe_face_landmarker_v2',
        frame_count: meshSignalsRef.current.length,
        frames: meshSignalsRef.current.map(s => ({
          frame_index: s.frameIndex,
          timestamp_ms: s.timestamp,
          headPose: s.headPose,
          leftEAR: s.leftEAR,
          rightEAR: s.rightEAR,
          bbox: s.bbox,
        })),
      } : null;

      // v4.1: Build frames_manifest
      const framesManifest: FramesManifestEntry[] = framesRef.current.map(f => ({
        frame_index: f.index,
        capture_timestamp_ms: f.timestamp,
        resolution_w: f.resolution.w,
        resolution_h: f.resolution.h,
      }));

      // v4.1: Suspicion data (always include)
      const suspicionData: SuspicionData = suspicionEngineRef.current?.getSnapshot() ?? {
        final_score: 0, triggered: false,
        snapshot: { score: 0, signals: [], framesAnalyzed: 0, reliable: false, timestamp: Date.now() },
      };

      // v4.2: On-device antispoof classifier is not shipped yet; the backend
      // runs the classifier server-side and stays authoritative. The on-device
      // path will be reintroduced in its own change (it pulls a heavy WASM
      // model dependency the zero-dependency SDK does not yet carry).
      const deepClassifierOnDevice: SignalMetadata['deep_classifier_on_device'] = null;

      const metadata: SignalMetadata = {
        session_id: sessionData.session_id,
        sdk_version: SDK_VERSION,
        platform: 'web',
        source: 'sdk',
        capture_config: {
          captureDurationMs: sessionData.upload.capture_duration_ms,
          targetFps: sessionData.upload.target_fps,
          maxFrames: sessionData.upload.max_frames,
        },
        timestamps: {
          session_started_at_ms: sessionStartedAtRef.current,
          capture_started_at_ms: captureStartedAtMsRef.current,
          capture_ended_at_ms: Date.now(),
        },
        frames_manifest: framesManifest,
        frame_hashes: frameHashes,
        channel_integrity: integrity,
        challenge_response: challengeResponse,
        face_mesh_signals: faceMeshSignals,
        verification_package: meshPackage,
        suspicion: suspicionData,
        inline_step_up: stepUpEvidenceRef.current,
        deep_classifier_on_device: deepClassifierOnDevice,
        // v4: per-frame phase tags + zoom-motion summary
        ...(liveSenseV4Enabled
          ? {
              frame_phases: framesRef.current.map(f => f.phase ?? 'other'),
              zoom_motion: {
                frames_total: framesRef.current.length,
                frames_in_zoom: framesRef.current.filter(f => f.phase === 'zoom').length,
                expected_duration_ms: ZOOM_DURATION,
                sdk_version: SDK_VERSION,
              },
            }
          : {}),
      } as SignalMetadata & { frame_phases?: string[]; zoom_motion?: Record<string, unknown> };

      console.log('[UseSense] Upload metadata summary:', {
        channel_integrity_fields: Object.keys(integrity).length,
        has_user_agent: !!integrity.user_agent,
        challenge_type: challengeResponse?.type ?? 'none',
        verification_package_frames: meshPackage?.frames?.length ?? 0,
        frame_hashes_count: frameHashes.length,
        frame_count: framesRef.current.length,
        suspicion_score: suspicionData.final_score,
        suspicion_frames_analyzed: suspicionData.snapshot.framesAnalyzed,
        suspicion_signals: suspicionData.snapshot.signals.map(s => `${s.name}=${s.score}`),
        inline_step_up: stepUpEvidenceRef.current ? 'present' : 'null',
      });

      const frameBytes = framesRef.current.map(f => f.bytes);

      await uploadSignals({
        apiBaseUrl,
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
  }, [sessionData, environment, apiBaseUrl, updatePhase, onError]);

  // ── Complete ──────────────────────────────────────────────────────────
  const runComplete = useCallback(async () => {
    if (abortRef.current) return;
    updatePhase('completing', 'Verifying...');
    try {
      const decision = await completeSession({
        apiBaseUrl,
        environment,
        sessionId: sessionData.session_id,
        sessionToken: sessionData.session_token,
        nonce: sessionData.nonce,
      });

      console.log('[UseSense] Decision:', decision.decision);

      // Stop camera before notifying host
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      // Notify host immediately so they can prepare to show results
      onComplete(decision);

      setResult(decision);
      updatePhase('done', 'Complete');
    } catch (err: any) {
      console.error('[UseSense] Complete failed:', err);
      onError(err.message || 'Verification failed');
    }
  }, [sessionData, environment, apiBaseUrl, updatePhase, onComplete, onError]);

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
    suspicionEngineRef.current = new SuspicionEngine(sessionData.policy.inline_step_up?.suspicion_threshold ?? 55);
    stepUpEvidenceRef.current = null;
    frameLuminancesRef.current = [];
    setStepUpPhase('idle');
    setFlashOverlayColor(null);
    setRmasState(null);
    requestCamera();
  }, [requestCamera, sessionData]);

  // ── Init (runs only after user taps Start on the intro screen) ───────
  useEffect(() => {
    if (!started) return;
    let mounted = true;

    async function init() {
      updatePhase('initializing', 'Getting ready...');

      // Run in parallel: web integrity + MediaPipe
      const [signals] = await Promise.all([
        collectWebIntegritySignals().catch((err) => {
          console.error('[UseSense] Signal collection failed:', err);
          return {} as any;
        }),
        initFaceMesh().catch(() => {}),
      ]);

      // Initialize suspicion engine
      const stepUpThreshold = sessionData.policy.inline_step_up?.suspicion_threshold ?? 55;
      suspicionEngineRef.current = new SuspicionEngine(stepUpThreshold);

      // Always store signals in the ref -- refs don't trigger re-renders so
      // this is safe even after unmount and won't cause React warnings.
      channelIntegrityRef.current = signals;
      console.log(
        `[UseSense] Channel integrity collected: ${Object.keys(signals).length} fields`,
        signals.user_agent ? '(ok)' : '(EMPTY -- collection may have failed)'
      );

      if (!mounted) return;
      requestCamera();
    }

    init().catch((err: any) => {
      if (!mounted) return;
      onError(err?.message || 'Initialization failed');
    });
    return () => { mounted = false; };
  }, [started]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Attach stream once video elements mount ───────────────────────────
  // showCamera gates rendering of the <video> elements, so videoRef / videoRefBlurred
  // are null when requestCamera first runs. This effect attaches the stream once
  // the elements appear in the DOM.
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    if (videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
    if (videoRefBlurred.current && !videoRefBlurred.current.srcObject) {
      videoRefBlurred.current.srcObject = stream;
      videoRefBlurred.current.play().catch(() => {});
    }
  }); // runs after every render -- intentionally no dep array

  // ── Render helpers ────────────────────────────────────────────────────
  const showCamera = ['face-guide', 'baseline', 'countdown', 'challenge', 'step-up-intro', 'step-up-flash', 'step-up-rmas', 'step-up-complete'].includes(phase);

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
          <button className="usesense-btn usesense-btn--primary" onClick={onCancel ?? (() => onComplete(result!))}>
            Finish
          </button>
        </div>
      </div>
    );
  };

  // ── JSX ───────────────────────────────────────────────────────────────
  const challengeType = sessionData.policy.challenge_type;
  const challengeBrief = CHALLENGE_BRIEFS[challengeType];
  const sessionLabel = _sessionType === 'authentication' ? 'Authentication' : 'Enrollment';
  const isLightPhase = phase === 'intro' || phase === 'done';

  return (
    <div className={`usesense-engine${isLightPhase ? ' usesense-engine--light' : ''}`}>
      <style>{getEngineStyles(primaryColor)}</style>

      {logoUrl && <img className="usesense-logo" src={logoUrl} alt={displayName || 'Logo'} />}

      {/* ── Intro screen ──────────────────────────────────────────────── */}
      {phase === 'intro' && (
        <>
          {onCancel && (
            <button className="usesense-back-btn" onClick={onCancel}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
          )}
          <div className="usesense-env-badge">{environment === 'production' ? 'Live Mode' : 'Sandbox'}</div>
          <div className="usesense-intro">
            <div className="usesense-intro-title">Identity {sessionLabel}</div>
            <div className="usesense-intro-desc">
              Complete a quick biometric check to {_sessionType === 'authentication' ? 'verify' : 'enroll'} your identity.
              You will need to allow camera access and follow the on-screen prompts.
            </div>
            <div className="usesense-intro-icon">
              <CameraIcon />
            </div>
            <div className="usesense-intro-card">
              <div className="usesense-intro-card-title">What to expect:</div>
              <ol className="usesense-intro-steps">
                <li>Camera access will be requested</li>
                <li>Position your face in the guide oval</li>
                <li>Follow prompts &mdash; you may be asked to turn your head or follow a dot</li>
              </ol>
            </div>
            <div className="usesense-intro-trust">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 14, height: 14 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              End-to-end encrypted &middot; Three-pillar verification &middot; {environment === 'production' ? 'Live Mode' : 'Sandbox'}
            </div>
            <button
              className="usesense-btn usesense-btn--primary usesense-btn--full"
              onClick={() => setStarted(true)}
            >
              Start {sessionLabel}
            </button>
          </div>
        </>
      )}

      {/* Cancel button on dark loading/brief phases */}
      {onCancel && (phase === 'challenge-brief' || phase === 'initializing' || phase === 'camera-request' || phase === 'camera-error') && (
        <button className="usesense-cancel-btn" onClick={onCancel}>Cancel</button>
      )}

      {/* ── Initializing ──────────────────────────────────────────────── */}
      {phase === 'initializing' && (
        <div className="usesense-result">
          <div className="usesense-spinner" />
          <div className="usesense-result-title" style={{ marginTop: '24px' }}>Getting ready...</div>
        </div>
      )}

      {/* ── Camera request ────────────────────────────────────────────── */}
      {phase === 'camera-request' && (
        <div className="usesense-result">
          <div className="usesense-result-icon" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <CameraIcon />
          </div>
          <div className="usesense-result-title">Allow Camera Access</div>
          <div className="usesense-result-subtitle">
            We need access to your camera for identity verification
          </div>
        </div>
      )}

      {/* ── Camera error ──────────────────────────────────────────────── */}
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

      {/* ── Challenge brief ───────────────────────────────────────────── */}
      {phase === 'challenge-brief' && challengeBrief && (
        <div className="usesense-result">
          <div className="usesense-challenge-brief-title">{challengeBrief.title}</div>
          <div className="usesense-challenge-brief-desc">
            {challengeBrief.description.split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </div>
          <div className="usesense-challenge-brief-tip">{challengeBrief.tip}</div>
          <button
            className="usesense-btn usesense-btn--primary usesense-btn--full"
            onClick={startFaceGuide}
            style={{ marginTop: '8px' }}
          >
            Got it &mdash; Start
          </button>
        </div>
      )}

      {/* ── Camera phases ─────────────────────────────────────────────── */}
      {showCamera && (
        <>
          <div className="usesense-camera-container">
            <video ref={videoRefBlurred} className="usesense-camera-video usesense-camera-video--blurred" autoPlay playsInline muted />
            <video ref={videoRef} className="usesense-camera-video usesense-camera-video--clear" autoPlay playsInline muted />

            {/* Cancel pill top-left */}
            {onCancel && (
              <button className="usesense-cancel-pill" onClick={onCancel} style={{ zIndex: 30 }}>See results</button>
            )}

            {/* Verifying badge top-right during active recording */}
            {(phase === 'baseline' || phase === 'challenge') && (
              <div className="usesense-verifying-badge" style={{ zIndex: 30 }}>
                <div className="usesense-recording-dot" />
                Verifying
              </div>
            )}

            {/* Face oval */}
            {(phase === 'face-guide' || phase === 'baseline') && (
              <div className={[
                'usesense-face-oval',
                faceGuideStatus?.ready ? 'usesense-face-oval--ready' : '',
                phase === 'baseline' ? 'usesense-face-oval--baseline' : '',
              ].join(' ')} />
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

            {/* Direction arrow card with label */}
            {phase === 'challenge' && challengeDirection && (
              <div key={challengeDirection} className="usesense-direction-arrow">
                <ArrowSvg direction={challengeDirection} />
                <span className="usesense-direction-label">
                  Look {challengeDirection.charAt(0).toUpperCase() + challengeDirection.slice(1)}
                </span>
              </div>
            )}

            {/* Environment warning */}
            {envWarning && <div className="usesense-env-warning">{envWarning}</div>}

            {/* v4.1: Flash reflection overlay */}
            {flashOverlayColor && (
              <div className="usesense-flash-overlay" style={{ backgroundColor: flashOverlayColor }} />
            )}

            {/* v4.1: Step-up intro overlay */}
            {stepUpPhase === 'intro' && (
              <div className="usesense-step-up-overlay">
                <div className="usesense-step-up-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </div>
                <div className="usesense-step-up-title">Additional Verification</div>
                <div className="usesense-step-up-message">We need to verify your presence with a quick check. This will only take a few seconds.</div>
              </div>
            )}

            {/* v4.1: Step-up complete overlay */}
            {stepUpPhase === 'complete' && (
              <div className="usesense-step-up-overlay">
                <div className="usesense-step-up-icon" style={{ color: '#00D4AA' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div className="usesense-step-up-title">Verification Complete</div>
              </div>
            )}

            {/* v4.1: RMAS action prompt */}
            {rmasState && (
              <div className="usesense-rmas-card">
                <div className="usesense-rmas-step">{rmasState.step} of {rmasState.total}</div>
                <div className="usesense-rmas-label">{rmasState.label}</div>
                <div className="usesense-rmas-countdown-bar">
                  <div className="usesense-rmas-countdown-fill" style={{ width: `${rmasState.countdown}%` }} />
                </div>
              </div>
            )}

            {/* v4.1: Flash status text */}
            {stepUpPhase === 'flash' && (
              <div className="usesense-step-up-status">Hold still -- verifying...</div>
            )}
          </div>

          {/* Status area */}
          <div className="usesense-status-area">
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
                I&apos;m Ready
              </button>
            )}

            {(phase === 'baseline' || phase === 'challenge') && (
              <div className="usesense-status-hint" style={{ marginTop: '6px' }}>Follow the instructions</div>
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

      {/* ── Uploading / Completing ────────────────────────────────────── */}
      {(phase === 'uploading' || phase === 'completing') && (
        <>
          {onCancel && (
            <button className="usesense-cancel-btn" onClick={onCancel}>Cancel</button>
          )}
          <div className="usesense-result">
            <div className="usesense-spinner" />
            <div className="usesense-result-title" style={{ marginTop: '24px' }}>
              {phase === 'uploading' ? 'Almost done' : 'Verifying...'}
            </div>
            <div className="usesense-result-subtitle">
              {phase === 'uploading' ? 'Finishing up \u2014 this will only take a moment.' : 'Analyzing your identity\u2026'}
            </div>
          </div>
        </>
      )}

      {/* ── Done ──────────────────────────────────────────────────────── */}
      {phase === 'done' && renderResult()}

      <div className="usesense-footer">Powered by UseSense &middot; SDK v{SDK_VERSION}</div>
    </div>
  );
};
