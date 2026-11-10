import { buildStepUpRoundMetadata, readStepUpInstruction, SDK_CAPABILITIES, type StepUpInstruction } from '../capture/step-up-round';
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  StepUpRoundMetadata,
} from '../types';
import { getEngineStyles, resolveEngineTokens, USESENSE_FONTS_URL } from './styles';
import { FacePrimerBody, PrimerFrame, FACE_PRIMER_COPY } from './FacePrimer';
import { UploadProgress, ariaPercent } from '../capture/upload-progress';
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
  trackFace,
  getFaceTriangles,
} from '../capture/media-pipe';
import {
  QualityGate,
  HintScheduler,
  finishGateResult,
  STILLNESS_ANCHORS_NO_CHIN,
  evaluatePixelOnlyGate,
  hintFor,
  hintableResult,
  shouldTurnOnFillLight,
  isSteadyForCoverWatch,
  withCoverWatch,
  poseFromMatrix,
  resolveCaptureColors,
  GATE_HINTS,
  SCAN_TIMING,
  type GateResult,
  type Hint,
  type FaceAreaStats,
  type Point2,
} from '../capture/quality-gate';
import { CaptureCanvas, CAPTURE_VISUAL_SPEC, captureOval, type ScreenLandmark } from '../capture/contour-scan';
import { CoverWatch } from '../capture/face-cover';
import {
  ChallengeRunner,
  stepFrameQuota,
  SETTLED_FRAMES_PER_STEP,
  type ChallengeDisplay,
  QuietDetector,
  EXTRA_CHECK_COLORS,
  EXTRA_CHECK_COPY,
  EXTRA_CHECK_TIMING,
  SESSION_TTL_MS,
  extraCheckSentence,
  meterBars,
  digitsText,
  resultScreen,
  classifyFailure,
  classifyCameraError,
  primerCopy,
  shouldRunInlineStepUp,
  inlineStepUpGuidance,
  relaxGateForChallenge,
  type EndScreen,
} from '../capture/extra-check';
import { BottomSheet, ChallengeOverlay, EndPage, LeaveDialog, StoryPage, type ChallengeOverlayState } from './ExtraCheck';
import { requestChallengeFallback, ChallengeFallbackError } from '../api-client';

/**
 * Debug-only test hooks. Replaced at build time: false in the published
 * package (tsup removes every branch guarded by it); true only in the debug
 * build (`USESENSE_DEBUG=1`) used by the screenshot rig.
 */
declare const __USESENSE_DEBUG__: boolean;
/** Shape of window.__USESENSE_CAPTURE_DEBUG__ in debug builds. */
interface CaptureDebugHooks {
  /** Hold the capture in this state (align never auto-starts; scan never finishes). */
  forceState?: 'align' | 'scan' | 'upload';
  /** Seconds after the camera starts at which the preview freezes. */
  freezeAt?: number;
  /** Ring progress (scan) / bar fraction (upload) to show, 0-1. */
  forceProgress?: number;
  /** Show this guidance instead of the gate's (reference ?hint= ids; 'ready' = all pass). */
  forceHint?: string;
  /** Set by the engine once the forced state is rendered on the frozen frame. */
  ready?: boolean;
  /** Set by the engine: the latest gate verdict and video size, for the rig. */
  last?: { phase: string; firstFailing: string | null; faces: number; video: string; measurements: unknown };
  /** Set by the engine: the scan's covered-face change-watch score and region. */
  cover?: unknown;
  /** Extra check: report the face as out of the oval (pause screens). */
  forceFaceOff?: boolean;
  /** Extra check: this head pose (degrees) instead of the measured one. */
  forcePose?: { yaw: number; pitch: number };
  /** Extra check: hold the challenge at this point (no progress, no upload). */
  holdChallenge?: boolean;
  /** Speak Digits: use this mic level instead of the measured one (0 = silent). */
  forceMicLevel?: number;
  /** Extra check: make the gate fail this check (e.g. 'covered') during the challenge. */
  forceChallengeFail?: string;
  /** Inline step-up: trigger it on this capture, with this challenge. */
  forceInlineStepUp?: 'auto' | 'flash_reflection' | 'rmas';
}
function debugHooks(): CaptureDebugHooks | undefined {
  if (!__USESENSE_DEBUG__) return undefined;
  return typeof window !== 'undefined' ? (window as any).__USESENSE_CAPTURE_DEBUG__ : undefined;
}
import {
  sampleFaceRegions,
  coverMapper,
  sampleRegion,
  lumaMotion,
  prefersReducedMotion,
  haptic,
} from '../capture/gate-dom';
import {
  captureOneFrame,
  getFrameInterval,
  sleep,
  isFrameBudgetExhausted,
  isFrozenFeed,
} from '../capture/frame-capture';
import type { CapturedFrame } from '../capture/frame-capture';
import { recordAudio } from '../capture/audio-capture';
import { computeMeshDigest, computeBindingProof } from '../utils/crypto';
import { getCameraErrorMessage } from '../utils/errors';
import { uploadSignals } from '../api-client';
import { completeSession } from '../api-client';
import { SuspicionEngine } from '../capture/suspicion-engine';
import { collectCaptureSourceEvidence, type CaptureSourceEvidence } from '../capture/capture-source';
import {
  ColourSequencePlayer,
  POSE_METHOD_LEGACY,
  POSE_METHOD_V3,
  buildEvidenceUpload,
  captureClockMs,
  frameEvidenceFields,
  parseEvidenceConfig,
  selectMeshSignals,
  setWhiteBalanceLock,
  type EvidenceConfig,
} from '../capture/evidence';

/** Surface name in capture-source evidence; the same value Watchtower's hosted engine sent. */
const CAPTURE_SOURCE_SURFACE = 'verification_capture_engine';
/** Phases in which losing the camera aborts the capture. */
const STREAM_ACTIVE_PHASES: CapturePhase[] = [
  'face-guide', 'baseline', 'zoom', 'countdown', 'challenge',
  'extra-check-brief', 'extra-check-done',
  'step-up-round', 'step-up-intro', 'step-up-flash', 'step-up-rmas', 'step-up-complete',
];
import { computeScreenDetectionSignals } from '../capture/screen-detection';
import { runStepUp } from '../capture/step-up-orchestrator';
import { SDK_VERSION } from '../version';
// SNR (Screen-Nonce Reflection) was reverted server-side on staging; the
// client code is now fully removed (Phase 1 ticket X-9). sessionData.challenge
// is always falsy post-revert so the former conditional branches in this
// component were dead paths.

// ── Constants ───────────────────────────────────────────────────────────

const BASELINE_DURATION = 2000;
/** Banked time the scan runs on after the last colour, so its frames land. */
const COLOUR_TAIL_MS = 150;
/**
 * Frame interval while a colour is up. A 600 ms segment leaves 450 ms after
 * the server's 150 ms rise; 200 ms gives it two frames.
 */
const COLOUR_FRAME_INTERVAL_MS = 200;
/** How long "One more quick check" shows before a server step-up challenge starts. */
const STEP_UP_BRIEF_MS = 1500;
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
    title: 'Head turn challenge',
    description: 'You will be asked to turn your head in different directions.\nFollow the on-screen arrows.',
    tip: 'Make sure you are in a well-lit area with your face clearly visible.',
  },
  follow_dot: {
    title: 'Follow the dot',
    description: 'A dot will move around the screen.\nFollow it with your gaze without moving your head.',
    tip: 'Stay still and move only your eyes.',
  },
  speak_phrase: {
    title: 'Speak a phrase',
    description: 'You will be asked to read a short phrase aloud clearly.',
    tip: 'Make sure you are in a quiet environment with your microphone enabled.',
  },
};

/** The side arrow for a Head Turn step (none for "look straight ahead"). */
function arrowFor(d: string | null | undefined): 'left' | 'right' | 'up' | 'down' | null {
  return d === 'left' || d === 'right' || d === 'up' || d === 'down' ? d : null;
}

/** Bytes as a short human string, for the upload progress line. */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

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
  onStreamInterrupted,
  showIntro = true,
  showResultScreen = true,
  allowRetryOnReject = false,
  onRetry,
  liveSenseV4Enabled = false,
  guidedCaptureEnabled = true,
  theme,
}) => {
  const guided = guidedCaptureEnabled !== false;
  // Precedence: explicit prop > the environment the server stamped on the
  // session > production.
  //
  // This used to default to 'sandbox'. Because the engine sends `?env=` on
  // every upload, a production session mounted without an explicit prop had its
  // signals looked up in the sandbox scope, 401'd, and the run hung on the
  // "Almost done" spinner. Sandbox is never a safe guess: guessing wrong in
  // that direction breaks live traffic, and `sessionData.environment` now
  // carries the authoritative answer from session creation.
  const environment = environmentProp ?? sessionData.environment ?? 'production';

  // ── State ─────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<CapturePhase>(showIntro ? 'intro' : 'initializing');
  // Without the intro screen the engine starts as soon as it mounts.
  const [started, setStarted] = useState(!showIntro);
  const [phaseLabel, setPhaseLabel] = useState('Initializing...');
  const [progress, setProgress] = useState(0);
  const [countdownNumber, setCountdownNumber] = useState<number | null>(null);
  const [faceGuideStatus, setFaceGuideStatus] = useState<FaceGuideStatus | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [envWarning, setEnvWarning] = useState<string | null>(null);
  // Upload progress for the "Almost done" screen. A bare spinner makes a slow
  // uplink indistinguishable from a hung one, and subjects force-quit rather
  // than wait: one measured production upload took 193s and succeeded.
  const [uploadProgress, setUploadProgress] = useState<{ loaded: number; total: number; percent: number } | null>(null);
  const [dotPosition, setDotPosition] = useState<{ x: number; y: number } | null>(null);
  const [challengeDirection, setChallengeDirection] = useState<string | null>(null);
  const [speakPhrase, setSpeakPhrase] = useState<string | null>(null);
  const [_isRecording, setIsRecording] = useState(false);
  const [_framesCollected, setFramesCollected] = useState(0);
  const [stepUpPhase, setStepUpPhase] = useState<'idle' | 'intro' | 'flash' | 'rmas' | 'complete'>('idle');
  const [flashOverlayColor, setFlashOverlayColor] = useState<string | null>(null);
  const [rmasState, setRmasState] = useState<{ label: string; step: number; total: number; countdown: number } | null>(null);
  // ── Guided capture (quality gate) state ───────────────────────────────
  /** MediaPipe failed to load: no face gate, so the shutter is the way in. */
  const [meshFailed, setMeshFailed] = useState(false);
  /** The one hint on screen (null = none). */
  const [hint, setHint] = useState<Hint | null>(null);
  /** Every check passes right now. */
  const [gateOk, setGateOk] = useState(false);
  const [showShutter, setShowShutter] = useState(false);
  const [fillLight, setFillLight] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // Upload sheet bar (eased per stage; see capture/upload-progress.ts).
  const uploadBarRef = useRef(new UploadProgress());
  const [uploadBar, setUploadBar] = useState(0);
  // ── Extra check (guided) ──────────────────────────────────────────────
  /** The guidance and ring state of the running extra check. */
  const [xc, setXc] = useState<{ text: string; sub?: string; paused: boolean } | null>(null);
  const [xcOverlay, setXcOverlay] = useState<ChallengeOverlayState>({});
  /** The container size, for the overlay (set when an extra check starts). */
  const [stageSize, setStageSize] = useState<{ W: number; H: number }>({ W: 0, H: 0 });
  /** The round-2 sheet's sentence. */
  const [xcSentence, setXcSentence] = useState('');
  /** Which full-page end screen to show in the 'failed' / 'camera-error' phases. */
  const [endScreen, setEndScreen] = useState<EndScreen>('error');
  const [leaveOpen, setLeaveOpen] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRefBlurred = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<CapturedFrame[]>([]);
  /** Reused encode surface; retains the last captured frame for screen detection. */
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const meshSignalsRef = useRef<FrameSignal[]>([]);
  const channelIntegrityRef = useRef<WebIntegritySignals | null>(null);
  const baselineFrameCountRef = useRef(0);
  const captureStartTimeRef = useRef(0);
  const challengeStartedAtRef = useRef('');
  const challengeCompletedAtRef = useRef('');
  const audioRef = useRef<Blob | null>(null);
  const abortRef = useRef(false);
  // Capture attempt generation. A retry bumps it, so a capture chain still
  // asleep from the previous attempt stops instead of running alongside.
  const genRef = useRef(0);
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
  // Server step-up (round 2): the challenge the server asked for after round 1
  // uploaded, and how many frames that round may use.
  const stepUpRef = useRef<StepUpInstruction | null>(null);
  // Capture-source evidence from the live track (G03), sent at upload as
  // channel_integrity.capture_source. Client-reported.
  const captureSourceRef = useRef<CaptureSourceEvidence | null>(null);
  // The camera was lost mid-capture: nothing more is captured or uploaded.
  const streamInterruptedRef = useRef(false);
  const onStreamInterruptedRef = useRef(onStreamInterrupted);
  onStreamInterruptedRef.current = onStreamInterrupted;
  // Guided capture
  const containerRef = useRef<HTMLDivElement>(null);
  const ovalRef = useRef<HTMLDivElement>(null);
  const contourCanvasRef = useRef<HTMLCanvasElement>(null);
  const contourRef = useRef<CaptureCanvas | null>(null);
  /** Debug rig: when the camera started, and whether the preview is frozen. */
  const streamStartedAtRef = useRef(0);
  const frozenAtRef = useRef(0);
  const fillLightOnRef = useRef(false);
  const pixelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gateRef = useRef(new QualityGate());
  const hintSchedRef = useRef(new HintScheduler());
  const hintRef = useRef<Hint | null>(null);
  const gateOkRef = useRef(false);
  /** Latest gate verdict, read by the scan loop to pause / resume. */
  const scanOkRef = useRef(false);
  const lastTrackAtRef = useRef(0);
  const trackIntervalRef = useRef(30);
  const lastPixelAtRef = useRef(0);
  const lastPixelStatsRef = useRef<FaceAreaStats | undefined>(undefined);
  const lastMotionRef = useRef<number | undefined>(undefined);
  const prevCentreLumaRef = useRef<Float32Array | null>(null);
  const fillLightAtRef = useRef<number | null>(null);
  /** When the align screen first opened (for the 20 s shutter fallback). */
  const alignStartedAtRef = useRef(0);
  /** Continuous all-pass time on the align screen, ms. */
  const passAccumRef = useRef(0);
  const lastAlignTickRef = useRef(0);
  const readyBuzzedRef = useRef(false);
  const pausedWindowsRef = useRef(0);
  const shutterModeRef = useRef(false);
  const showShutterRef = useRef(false);
  const scanProgressRef = useRef(0);
  /** When the guided scan began (tracker clock), for the relief v3 camera blur. */
  const scanSeenAtRef = useRef<number | null>(null);
  /** Covered-face change watch for the running scan (COVER-v1.md section 2). */
  const coverWatchRef = useRef(new CoverWatch());
  const coverWatchScanRef = useRef(false);
  const regionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  /**
   * EVIDENCE-v1: the session's evidence block (null = old server: upload as
   * before), the colour player for this attempt, and the tint layer it drives.
   */
  const evidenceRef = useRef<EvidenceConfig | null>(null);
  evidenceRef.current = useMemo(() => parseEvidenceConfig(sessionData.evidence), [sessionData.evidence]);
  const colourPlayerRef = useRef<ColourSequencePlayer | null>(null);
  const tintElRef = useRef<HTMLDivElement | null>(null);
  /** The colour on screen now, read by the tracker's change watch. */
  const tintOnRef = useRef(false);
  const cameraBlurOnRef = useRef(false);
  const lastSecondFaceLogRef = useRef(0);
  const advanceRef = useRef<() => void>(() => {});
  // Extra check: the session policy as it stands (a microphone fallback
  // replaces it with the server's Follow Dot policy).
  const policyRef = useRef(sessionData.policy);
  /** The running extra check's tracker and what the tracker loop last saw. */
  const xcRef = useRef<{
    kind: 'head_turn' | 'follow_dot' | 'speak_phrase';
    /** Head Turn / Follow Dot: the closed-loop timeline (iOS ChallengeRunner). */
    runner?: ChallengeRunner;
    display?: ChallengeDisplay;
    /** Speak Digits: what the digits loop last decided. */
    state: { progress: number; paused: boolean; capture: boolean; index: number; text: string; sub?: string; done: boolean } | null;
    faceOk: boolean;
    /** The gate's hint while the challenge is paused (names the failing check). */
    hint?: Hint | null;
    /** What is on screen (to set state only on change). */
    shown?: string;
    progress: number;
    done: boolean;
  } | null>(null);
  /**
   * The scan's quality gate, run during the challenge too (same checks, pose
   * relaxed toward the step, stillness for Speak Digits only), with its own
   * hint schedule. The covered-face watch is the scan's, re-baselined.
   */
  const xcGateRef = useRef(new QualityGate());
  /** Extra fields for the challenge response (step_events, preview_mirrored). */
  const challengeExtrasRef = useRef<Record<string, unknown>>({});
  const xcHintSchedRef = useRef(new HintScheduler());
  /** Speak Digits: the latest mic level and the quiet detector. */
  const micLevelRef = useRef(0);
  const micLevelsRef = useRef<number[]>([]);
  /** The leave dialog is open: the extra check waits. */
  const leaveOpenRef = useRef(false);
  /** What "Try again" on an end page or the upload-failed sheet does. */
  const retryActionRef = useRef<() => void>(() => {});
  /** Round 2: Continue on the "One more quick check" sheet. */
  const continueRef = useRef<() => void>(() => {});
  /** Round 1 has been uploaded (leaving now cannot restart this session). */
  const uploadedRef = useRef(false);
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
      colourPlayerRef.current?.cancel();
      disposeFaceMesh();
    };
  }, []);

  // ── Capture helper ────────────────────────────────────────────────────
  // One grab at a time. Two overlapping grabs used to read the same
  // framesRef length as their index, so the package said [0, 0, 2, 2]
  // (Web 4.9.1, EVIDENCE-v1 section 3), and the second encode overwrote the
  // canvas the first one's landmarks were read from.
  const grabChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const grabFrameNow = async (capturePhase: 'baseline' | 'zoom' | 'challenge'): Promise<CapturedFrame | null> => {
    if (isFrameBudgetExhausted(framesRef.current.length)) return null;
    if (stepUpRef.current && framesRef.current.length >= stepUpRef.current.maxFrames) return null;
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    // Encode into a persistent canvas so the last frame's pixels survive the
    // call. computeScreenDetectionSignals needs them; passing null there is
    // why three of its four signals shipped as a hardcoded 0.5.
    if (!frameCanvasRef.current) frameCanvasRef.current = document.createElement('canvas');
    const canvas = frameCanvasRef.current;
    const frame = await captureOneFrame(
      video,
      framesRef.current.length,
      captureStartTimeRef.current,
      canvas
    );
    if (!frame) return null;
    if (isFrameBudgetExhausted(framesRef.current.length)) return null;

    // The index is the upload position, taken when the frame joins the
    // buffer (a discard may have emptied it during the encode).
    frame.index = framesRef.current.length;
    // v4: tag the frame with its capture phase so the server's SfM
    // perspective validator can filter to the zoom subset.
    frame.phase = capturePhase;
    framesRef.current.push(frame);
    setFramesCollected(framesRef.current.length);

    // MediaPipe signal extraction, on the canvas the JPEG was encoded from:
    // the landmarks describe exactly the uploaded picture (unmirrored, full
    // frame), not a later video frame.
    let signal: FrameSignal | null = null;
    if (isFaceMeshReady()) {
      signal = extractFrameSignal(video, frame.index, capturePhase, canvas);
      if (signal) {
        signal.captureMs = captureClockMs(frame.drawnAt, streamStartedAtRef.current) ?? undefined;
        meshSignalsRef.current.push(signal);
      }
    }

    // Feed suspicion engine
    if (suspicionEngineRef.current) {
      const sharpness = computeFrameSharpness(video);
      const headPose = signal?.headPose ?? { yaw: 0, pitch: 0, roll: 0 };
      suspicionEngineRef.current.push(headPose, frame.luminance, sharpness);
      frameLuminancesRef.current.push(frame.luminance);
    }

    return frame;
  };
  const grabFrameNowRef = useRef(grabFrameNow);
  grabFrameNowRef.current = grabFrameNow;
  const grabFrame = useCallback((capturePhase: 'baseline' | 'zoom' | 'challenge'): Promise<CapturedFrame | null> => {
    const run = grabChainRef.current.then(
      () => grabFrameNowRef.current(capturePhase),
      () => grabFrameNowRef.current(capturePhase),
    );
    grabChainRef.current = run.catch(() => null);
    return run;
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
      // Guided capture asks for the microphone only when Speak Digits starts,
      // so a refusal can fall back to a head movement instead of failing the
      // camera request with it.
      const needsAudio = !guided && policyRef.current.challenge_type === 'speak_phrase';
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
      streamStartedAtRef.current = performance.now();
      console.log('[UseSense] Camera access granted');

      // Capture-source evidence from the track that will feed the capture.
      // Non-blocking: a failure leaves it null and never delays capture.
      captureSourceRef.current = null;
      collectCaptureSourceEvidence(stream, CAPTURE_SOURCE_SURFACE)
        .then((ev) => { if (streamRef.current === stream) captureSourceRef.current = ev; })
        .catch(() => { captureSourceRef.current = null; });

      // Watch for the camera being lost mid-capture (unplugged, revoked, taken
      // by another app). Abort rather than upload a partial capture.
      streamInterruptedRef.current = false;
      const handleStreamLost = () => {
        if (streamRef.current !== stream || streamInterruptedRef.current) return;
        if (!STREAM_ACTIVE_PHASES.includes(phaseRef.current)) return;
        streamInterruptedRef.current = true;
        abortRef.current = true;
        console.error('[UseSense] Camera stream interrupted mid-capture');
        setCameraError('Your camera was disconnected during capture. Please try again.');
        setEndScreen('camera_stopped');
        retryActionRef.current = () => handleRetryRef.current();
        updatePhase('camera-error', 'Camera disconnected');
        onStreamInterruptedRef.current?.();
      };
      stream.getTracks().forEach((t) => t.addEventListener('ended', handleStreamLost));
      stream.addEventListener?.('inactive', handleStreamLost);

      // Update permissions_state now that camera (and mic) access is confirmed.
      if (channelIntegrityRef.current?.permissions_state) {
        channelIntegrityRef.current.permissions_state.camera = 'granted';
        if (needsAudio) {
          channelIntegrityRef.current.permissions_state.microphone = 'granted';
        }
      }
      const challengeType = policyRef.current.challenge_type;
      // Guided capture: the primer already said "Two quick steps"; the
      // movement follows straight on from the scan, so there is no brief.
      if (!guided && challengeType !== 'none' && CHALLENGE_BRIEFS[challengeType]) {
        updatePhase('challenge-brief', 'Ready to start');
      } else {
        startFaceGuide();
      }
    } catch (err: any) {
      console.error('[UseSense] Camera error:', err);
      setCameraError(getCameraErrorMessage(err));
      setEndScreen(classifyCameraError(err));
      retryActionRef.current = () => handleRetryRef.current();
      updatePhase('camera-error', 'Camera error');
    }
  }, [sessionData, updatePhase, startEnvChecks]);

  // ── Face guide ────────────────────────────────────────────────────────
  const startFaceGuide = useCallback(() => {
    updatePhase('face-guide', 'Position your face in the oval');
    uploadBarRef.current.reset();
    consecutiveReadyRef.current = 0;
    if (guided) {
      // The tracker (rAF loop below) drives the gate, hints, auto start and
      // the shutter fallback. The 20 s clock runs from the first time the
      // align screen opens, across returns from a discarded scan.
      if (!alignStartedAtRef.current) alignStartedAtRef.current = performance.now();
      passAccumRef.current = 0;
      readyBuzzedRef.current = false;
      lastAlignTickRef.current = performance.now();
      return;
    }
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
  const runZoomPhase = useCallback(async (gen: number = genRef.current) => {
    // Stale once the camera is lost, the engine unmounts, or a retry starts a new attempt.
    const stale = () => abortRef.current || gen !== genRef.current;
    if (!liveSenseV4Enabled) return;
    updatePhase('zoom', 'Bring the phone closer to fill the oval');
    // Prep beat: the prompt is visible but we do not yet capture frames
    // for the SfM bundle. Lets the user read and start their motion
    // before frames are scored.
    await sleep(ZOOM_PREP_MS);
    if (stale()) return;
    const fps = sessionData.upload.target_fps || 4;
    const interval = getFrameInterval(fps);
    const start = performance.now();
    while (performance.now() - start < ZOOM_DURATION && !stale()) {
      await grabFrame('zoom');
      await sleep(interval);
    }
  }, [liveSenseV4Enabled, sessionData, updatePhase, grabFrame]);

  // ── Colour sequence (EVIDENCE-v1 section 6) ───────────────────────────
  /**
   * The colour player for this attempt, made on first use; null when the
   * server sent no sequence or the guided scan is off. One sequence id per
   * session. The tint is written straight to the DOM inside the
   * requestAnimationFrame callback whose timestamp becomes the segment's
   * start, so the colour is painted on that frame (a React render could land
   * a frame later).
   */
  const getColourPlayer = (): ColourSequencePlayer | null => {
    const sequence = evidenceRef.current?.colourSequence;
    if (!guided || !sequence) return null;
    if (!colourPlayerRef.current) {
      const player = new ColourSequencePlayer(
        sequence,
        (t) => captureClockMs(t, streamStartedAtRef.current || null),
        { lockWhiteBalance: (lock) => setWhiteBalanceLock(streamRef.current?.getVideoTracks()[0], lock) },
      );
      player.host = {
        showTint: (colour, opacity) => {
          tintOnRef.current = colour !== null;
          const el = tintElRef.current;
          if (!el) return;
          el.style.backgroundColor = colour ?? 'transparent';
          el.style.opacity = colour ? String(opacity) : '0';
        },
      };
      colourPlayerRef.current = player;
    }
    return colourPlayerRef.current;
  };

  // ── Baseline ──────────────────────────────────────────────────────────
  /** Drop the frames banked by a scan that paused too long. */
  const discardBankedFrames = useCallback(() => {
    framesRef.current = [];
    meshSignalsRef.current = [];
    frameLuminancesRef.current = [];
    setFramesCollected(0);
    suspicionEngineRef.current = new SuspicionEngine(sessionData.policy.inline_step_up?.suspicion_threshold ?? 55);
  }, [sessionData]);

  /**
   * Guided scan: bank BASELINE_DURATION of good time. Any gate failure pauses
   * it (no frames banked, the ring holds) and it resumes when the gate passes
   * again. A pause over 1.5 s discards the banked frames, counts one paused
   * window and returns to the align screen. After a shutter tap the gate still
   * pauses the scan but never discards, so shaky hands can still finish.
   * Returns false when the scan did not finish.
   */
  const bankGuidedBaseline = useCallback(async (gen: number = genRef.current): Promise<boolean> => {
    // Stale once the camera is lost, the engine unmounts, or a retry starts a new attempt.
    const stale = () => abortRef.current || gen !== genRef.current;
    const fps = sessionData.upload.target_fps || 4;
    const interval = getFrameInterval(fps);
    let good = 0;
    let prev = performance.now();
    let pausedAt: number | null = null;
    scanProgressRef.current = 0;
    contourRef.current?.startSweep(prev);
    if (__USESENSE_DEBUG__) {
      const dbg = debugHooks();
      if (dbg?.forceState === 'scan' || dbg?.forceState === 'upload') {
        // Debug rig: hold the scan at a fixed progress (no banking, no upload).
        scanProgressRef.current = dbg.forceProgress ?? 0.5;
        if (dbg.forceState === 'upload') {
          await sleep(400);
          updatePhase('uploading', 'Uploading verification data...');
        }
        await new Promise<never>(() => {});
      }
    }
    // EVIDENCE-v1 section 6: the server's colours play inside the scan. A
    // gate pause stops them; the scan holds until the sequence has shown
    // (at most COLOUR_MAX_RUNS plays), and frames bank faster while a colour
    // is up so every segment has frames inside it.
    const player = getColourPlayer();
    let colourEnd: number | null = null;
    let shown = 0;
    while (true) {
      if (stale()) { player?.cancel(); return false; }
      const now = performance.now();
      const ok = scanOkRef.current;
      if (ok) {
        if (pausedAt !== null) pausedAt = null;
        // Cap the step so a stalled (backgrounded) tab does not count as
        // banked time; 1 s leaves room for a slow phone's encode + interval.
        good += Math.min(now - prev, 1000);
        await grabFrame('baseline');
      } else if (pausedAt === null) {
        pausedAt = now;
      } else if (!shutterModeRef.current && now - pausedAt > SCAN_TIMING.maxPauseMs) {
        pausedWindowsRef.current++;
        console.log(`[UseSense] Scan paused > ${SCAN_TIMING.maxPauseMs} ms; discarding (paused window ${pausedWindowsRef.current})`);
        // The frames go, so their colour segments go too.
        player?.resetForNewWindow();
        discardBankedFrames();
        scanProgressRef.current = 0;
        setProgress(0);
        startFaceGuide();
        return false;
      }
      prev = now;
      let needed = BASELINE_DURATION;
      if (player) {
        const passing = scanOkRef.current;
        if (!passing && player.isPlaying) {
          player.interrupt('gate_pause');
          colourEnd = null;
          console.log('[UseSense] colour: paused by the gate');
        } else if (passing && player.canPlay) {
          colourEnd = good + player.remainingMs() + COLOUR_TAIL_MS;
          console.log(`[UseSense] colour: play ${player.runs + 1} from colour ${player.nextIndex + 1} at ${Math.round(good)} ms`);
          player.play();
        }
        if (player.isPlaying && colourEnd !== null) needed = Math.max(BASELINE_DURATION, colourEnd);
      }
      shown = Math.max(shown, Math.min(1, good / needed));
      scanProgressRef.current = shown;
      setProgress(Math.min(shown * 50, 50));
      if (good >= needed) break;
      const step = player?.isPlaying ? Math.min(interval, COLOUR_FRAME_INTERVAL_MS) : interval;
      await sleep(ok ? step : 50);
    }
    if (player?.isPlaying) player.interrupt('scan_ended');
    if (player) {
      const r = player.record;
      console.log(`[UseSense] colour: completed=${r.completed} segments=${r.segments.length} awb_locked=${r.awb_locked}${r.interrupted_reason ? ` interrupted=${r.interrupted_reason}` : ''}`);
    }
    scanProgressRef.current = 1;
    haptic([20, 60, 20]); // scan complete
    return true;
  }, [sessionData, grabFrame, discardBankedFrames]);

  const runBaseline = useCallback(async (gen: number = genRef.current) => {
    // Stale once the camera is lost, the engine unmounts, or a retry starts a new attempt.
    const stale = () => abortRef.current || gen !== genRef.current;
    updatePhase('baseline', guided ? 'Hold still' : 'Keep your face still...');
    setProgress(0);
    captureStartTimeRef.current = performance.now();
    captureStartedAtMsRef.current = Date.now();

    const fps = sessionData.upload.target_fps || 4;
    const interval = getFrameInterval(fps);
    const start = performance.now();

    if (guided) {
      if (!(await bankGuidedBaseline(gen))) return;
    } else {
      while (performance.now() - start < BASELINE_DURATION && !stale()) {
        await grabFrame('baseline');
        const elapsed = performance.now() - start;
        setProgress(Math.min((elapsed / BASELINE_DURATION) * 50, 50));
        await sleep(interval);
      }
    }

    // Camera lost or unmounted mid-scan: nothing more runs, nothing uploads.
    if (stale()) return;
    baselineFrameCountRef.current = framesRef.current.length;

    // SNR (Screen-Nonce Reflection) was reverted server-side on staging and
    // the client code was removed in X-9. sessionData.challenge is always
    // falsy post-revert; the block that used to run the SNR controller here
    // is intentionally deleted.

    // v4: insert a constitutive zoom-motion phase between baseline and the
    // active challenge. Additive -- existing challenges still run.
    if (liveSenseV4Enabled) {
      await runZoomPhase(gen);
    }

    const challengeType = policyRef.current.challenge_type;
    if (guided && challengeType !== 'none') {
      // Extra check before the scan: the movement follows straight on from
      // the scan on the same screen, with no sheet and no countdown.
      startGuidedChallengeRef.current(gen, 1);
      return;
    }
    if (challengeType === 'none') {
      // Check step-up before upload
      if (inlineStepUpDue()) {
        await doInlineStepUp(gen);
        if (stale()) return;
      }
      runUpload(gen);
    } else {
      runCountdown(gen);
    }
  }, [sessionData, updatePhase, grabFrame, bankGuidedBaseline]);

  // ── Countdown ─────────────────────────────────────────────────────────
  const runCountdown = useCallback(async (gen: number = genRef.current) => {
    // Stale once the camera is lost, the engine unmounts, or a retry starts a new attempt.
    const stale = () => abortRef.current || gen !== genRef.current;
    updatePhase('countdown', 'Get ready...');
    const fps = sessionData.upload.target_fps || 4;
    const interval = getFrameInterval(fps);

    for (const n of [3, 2, 1]) {
      if (stale()) return;
      setCountdownNumber(n);
      const stepEnd = performance.now() + 1000;
      while (performance.now() < stepEnd && !stale()) {
        await grabFrame('baseline');
        await sleep(interval);
      }
    }
    setCountdownNumber(null);
    if (stale()) return;
    runChallenge(gen);
  }, [sessionData, updatePhase, grabFrame]);

  // ── Challenge dispatch ────────────────────────────────────────────────
  const runChallenge = useCallback(async (gen: number = genRef.current) => {
    // Stale once the camera is lost, the engine unmounts, or a retry starts a new attempt.
    const stale = () => abortRef.current || gen !== genRef.current;
    if (stale()) return;
    const challengeType = policyRef.current.challenge_type;
    challengeStartedAtRef.current = new Date().toISOString();

    switch (challengeType) {
      case 'head_turn':
        await runHeadTurn(gen);
        break;
      case 'follow_dot':
        await runFollowDot(gen);
        break;
      case 'speak_phrase':
        await runSpeakPhrase(gen);
        break;
      default:
        runUpload(gen);
    }
  }, [sessionData]);

  // ── Head Turn ─────────────────────────────────────────────────────────
  const runHeadTurn = useCallback(async (gen: number = genRef.current) => {
    // Stale once the camera is lost, the engine unmounts, or a retry starts a new attempt.
    const stale = () => abortRef.current || gen !== genRef.current;
    updatePhase('challenge', 'Follow the instructions');
    const spec = (stepUpRef.current?.challenge ?? policyRef.current.challenge) as HeadTurnChallenge;
    if (!spec?.sequence) { if (stepUpRef.current) runStepUpUpload(gen); else runUpload(gen); return; }

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
      if (stale()) return;
      const step = sequence[si];
      setChallengeDirection(step.direction);
      setPhaseLabel(dirLabels[step.direction] || 'Follow the instructions');
      setProgress(50 + (si / sequence.length) * 50);

      const stepEnd = performance.now() + step.duration_ms;
      while (performance.now() < stepEnd && !stale()) {
        const frame = await grabFrame('challenge');
        if (frame) stepFrameMapRef.current[String(step.index)].push(frame.index);
        await sleep(interval);
      }
    }

    setChallengeDirection(null);
    if (stale()) return;
    setProgress(100);
    challengeCompletedAtRef.current = new Date().toISOString();
    if (stepUpRef.current) { runStepUpUpload(gen); return; }
    // Check step-up before upload
    if (inlineStepUpDue()) {
      await doInlineStepUp(gen);
    }
    runUpload(gen);
  }, [sessionData, updatePhase, grabFrame]);

  // ── Follow Dot ────────────────────────────────────────────────────────
  const runFollowDot = useCallback(async (gen: number = genRef.current) => {
    // Stale once the camera is lost, the engine unmounts, or a retry starts a new attempt.
    const stale = () => abortRef.current || gen !== genRef.current;
    updatePhase('challenge', 'Follow the dot with your eyes');
    const spec = (stepUpRef.current?.challenge ?? policyRef.current.challenge) as FollowDotChallenge;
    if (!spec?.waypoints) { if (stepUpRef.current) runStepUpUpload(gen); else runUpload(gen); return; }

    const fps = sessionData.upload.target_fps || 4;
    const interval = getFrameInterval(fps);
    const waypoints = spec.waypoints;
    waypointFrameMapRef.current = {};
    waypoints.forEach(wp => { waypointFrameMapRef.current[String(wp.index)] = []; });

    for (let wi = 0; wi < waypoints.length; wi++) {
      if (stale()) return;
      const wp = waypoints[wi];
      setDotPosition({ x: wp.x * 100, y: wp.y * 100 });
      setProgress(50 + (wi / waypoints.length) * 50);

      const wpEnd = performance.now() + wp.duration_ms;
      while (performance.now() < wpEnd && !stale()) {
        const frame = await grabFrame('challenge');
        if (frame) waypointFrameMapRef.current[String(wp.index)].push(frame.index);
        await sleep(interval);
      }
    }

    setDotPosition(null);
    if (stale()) return;
    setProgress(100);
    challengeCompletedAtRef.current = new Date().toISOString();
    if (stepUpRef.current) { runStepUpUpload(gen); return; }
    if (inlineStepUpDue()) {
      await doInlineStepUp(gen);
    }
    runUpload(gen);
  }, [sessionData, updatePhase, grabFrame]);

  // ── Speak Phrase ──────────────────────────────────────────────────────
  const runSpeakPhrase = useCallback(async (gen: number = genRef.current) => {
    // Stale once the camera is lost, the engine unmounts, or a retry starts a new attempt.
    const stale = () => abortRef.current || gen !== genRef.current;
    const audioSpec = policyRef.current.audio_challenge as SpeakPhraseChallenge | undefined;
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
    while (performance.now() - start < duration && !stale()) {
      await grabFrame('challenge');
      const elapsed = performance.now() - start;
      setProgress(50 + (elapsed / duration) * 50);
      await sleep(interval);
    }

    const audioBlob = await audioPromise;
    audioRef.current = audioBlob;
    setIsRecording(false);
    setSpeakPhrase(null);
    if (stale()) return;
    setProgress(100);
    challengeCompletedAtRef.current = new Date().toISOString();
    if (inlineStepUpDue()) {
      await doInlineStepUp(gen);
    }
    runUpload(gen);
  }, [sessionData, updatePhase, grabFrame]);

  // ── Inline Step-Up ────────────────────────────────────────────────────
  /**
   * Whether the client inline step-up (suspicion engine, then Flash
   * Reflection / RMAS) runs now: the policy has not turned it off and the
   * suspicion engine triggered. Every call site goes through this, guided or
   * not, and it always runs before the round-1 upload.
   */
  const inlineStepUpDue = (): boolean => {
    const forced = __USESENSE_DEBUG__ && !!debugHooks()?.forceInlineStepUp;
    return shouldRunInlineStepUp(policyRef.current.inline_step_up ?? sessionData.policy.inline_step_up, forced || !!suspicionEngineRef.current?.shouldTrigger());
  };

  const doInlineStepUp = useCallback(async (gen: number = genRef.current) => {
    // Stale once the camera is lost, the engine unmounts, or a retry starts a new attempt.
    const stale = () => abortRef.current || gen !== genRef.current;
    if (stale()) return;
    const video = videoRef.current;
    if (!video) return;
    const policy = sessionData.policy.inline_step_up;
    const score = suspicionEngineRef.current?.getScore() ?? 0;
    const forcedChallenge = __USESENSE_DEBUG__ ? debugHooks()?.forceInlineStepUp : undefined;
    console.log(`[UseSense] Inline step-up: suspicion ${score}`);
    const evidence = await runStepUp(
      score,
      policy?.suspicion_threshold ?? 55,
      forcedChallenge ?? policy?.preferred_challenge ?? 'auto',
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
    while (performance.now() < resumeEnd && !stale()) {
      await grabFrame('challenge');
      await sleep(interval);
    }
    setStepUpPhase('idle');
  }, [sessionData, updatePhase, grabFrame]);

  // ── Frozen feed ───────────────────────────────────────────────────────
  /**
   * Before an upload: if every frame of this round is the same picture, the
   * camera feed froze. The server would reject it as a possible replay, and
   * the person would see "Something went wrong"; instead this ends on "The
   * camera stopped / Try again" (a fresh camera), like a lost stream. Returns
   * true when it stopped the upload.
   */
  const stopIfFrozen = (): boolean => {
    const frozen = isFrozenFeed(
      framesRef.current.map((f) => f.hash),
      meshSignalsRef.current.map((sig) => sig.landmarks),
    );
    if (!frozen) return false;
    console.warn(`[UseSense] Camera feed froze: ${framesRef.current.length} identical frames; not uploading`);
    abortRef.current = true;
    setCameraError('Your camera stopped sending a live picture. Please try again.');
    setEndScreen('camera_stopped');
    retryActionRef.current = () => handleRetryRef.current();
    updatePhase('camera-error', 'Camera disconnected');
    onStreamInterruptedRef.current?.();
    return true;
  };

  // ── Signals shared by both upload rounds ──────────────────────────────
  // Round 2 carries the same signals as round 1, in the same keys, so the
  // server can run the same checks (after-the-scan rules, the anti-spoof
  // classifier, the second-face check) on the extra check's frames.

  /** The on-device mesh package (verification_package) for the frames in framesRef. */
  const buildMeshPackage = async (): Promise<any> => {
    // Build on_device_mesh_package
    let meshPackage: any = null;
    if (meshSignalsRef.current.length > 0) {
      try {
        const vFrames: VerificationFrame[] = [];
        const fits: OnDevice3DMMFit[] = [];

        // Binding challenge from session creation response
        const bindingChallenge = sessionData.geometric_coherence?.mesh_binding_challenge;

        // EVIDENCE-v1 section 3: one entry per uploaded frame, keyed by its
        // upload position, ascending, no duplicates. A frame with no mesh
        // has no entry.
        const uploadHashes = framesRef.current.map((f) => f.hash);
        const evidence = evidenceRef.current;
        for (const signal of selectMeshSignals(meshSignalsRef.current, uploadHashes)) {
          // FaceLandmarker returns 478 landmarks (1434 floats); FaceMesh returns 468 (1404).
          // Accept either -- all landmark indices we use are within the first 468.
          if (signal.landmarks && signal.landmarks.length >= 1404) {
            const fit = fitOnDevice3DMM(signal.landmarks);
            if (fit) {
              fits.push(fit);
              const frameHash = uploadHashes[signal.frameIndex];

              // With an evidence block (sections 4 and 5): all 478 points,
              // rounded to 5 decimals BEFORE the digest; the matrix pose
              // (matrix_zyx_v3) with its matrix; the eye blendshapes; the
              // capture clock. Without one (an older server): as before, 468
              // points and the 3DMM fit's pose.
              const ev = evidence
                ? frameEvidenceFields({
                    landmarks: signal.landmarks,
                    matrix: signal.facialTransformationMatrix,
                    blendshapes: signal.blendshapes,
                  })
                : null;
              const landmarksForDigest = ev ? ev.landmarks : signal.landmarks.slice(0, 1404);
              const pose = ev?.pose ?? fit.pose;

              // computeMeshDigest requires {s, p, d, l} -- all four fields.
              const meshDigest = await computeMeshDigest(
                fit.shapeParams,
                pose,
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
                timestamp: ev && typeof signal.captureMs === 'number' ? signal.captureMs : signal.timestamp,
                shapeParams: fit.shapeParams,
                pose,
                depthPlausibility: fit.depthPlausibility,
                geometricRatios: fit.geometricRatios,
                poseRatios2D: fit.poseRatios2D,
                landmarks: landmarksForDigest,
                frameHash,
                meshDigest,
                bindingProof,
                poseNormalizationMethod: ev?.pose ? POSE_METHOD_V3 : POSE_METHOD_LEGACY,
                ...(ev?.transformMatrix ? { transformMatrix: ev.transformMatrix } : {}),
                ...(ev?.blendshapes ? { blendshapes: ev.blendshapes } : {}),
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
            // Tells the server this is its own coefficient-of-variation
            // metric, so a 0 means "genuinely inconsistent" and null means
            // "could not measure". Without this marker the server recomputes,
            // which is the correct fallback for legacy clients. See
            // usesense-watchtower#795.
            crossFrameConsistencyMethod: 'cv_v1' as const,
            preliminaryScore: score,
            attestation: { platform: 'web' as const },
          };
          console.log(`[UseSense] Mesh package: ${vFrames.length} frames, GC score: ${score}`);
        }
      } catch (err) {
        console.warn('[UseSense] Mesh package assembly failed:', err);
      }
    }
    return meshPackage;
  };

  /** channel_integrity for this round's frames (integrity signals, capture source, screen detection). */
  const buildChannelIntegrity = async (frameTimestamps: number[]): Promise<WebIntegritySignals> => {
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
    // G03: capture-source evidence. Re-read at upload when the early read
    // has not landed, so the report describes the stream in use.
    try {
      const cs = captureSourceRef.current
        ?? await collectCaptureSourceEvidence(streamRef.current, CAPTURE_SOURCE_SURFACE);
      if (cs) integrity.capture_source = cs;
    } catch (err) {
      console.warn('[UseSense] capture_source collection failed:', err);
    }
    // v4.1: screen detection signals
    // Pass the real last-frame canvas. This used to be null, so
    // luminance_histogram_spread, edge_energy_ratio and
    // color_channel_uniformity all returned their 0.5 fallback and the
    // server saw a constant instead of a measurement.
    integrity.screen_detection = computeScreenDetectionSignals(
      frameLuminancesRef.current,
      frameCanvasRef.current
    );
    return integrity;
  };

  // ── Upload ────────────────────────────────────────────────────────────
  const runUpload = useCallback(async (gen: number = genRef.current) => {
    // Stale once the camera is lost, the engine unmounts, or a retry starts a new attempt.
    const stale = () => abortRef.current || gen !== genRef.current;
    if (stale()) return;
    if (guided && sessionExpired()) { failGuided(new Error('Session expired'), () => runUploadRef.current(gen)); return; }
    if (stopIfFrozen()) return;
    updatePhase('uploading', 'Uploading verification data...');
    uploadBarRef.current.advance('sending', performance.now());
    if (envIntervalRef.current) { clearInterval(envIntervalRef.current); envIntervalRef.current = null; }

    try {
      // Build challenge_response
      const challengeType = policyRef.current.challenge_type;
      // Timestamps are absolute Date.now() values (set in captureOneFrame)
      const frameTimestamps = framesRef.current.map(f => f.timestamp);
      let challengeResponse: any = null;

      if (challengeType === 'head_turn') {
        const spec = policyRef.current.challenge as HeadTurnChallenge;
        challengeResponse = {
          type: 'head_turn',
          seed: spec?.seed || '',
          completed: true,
          step_frames: stepFrameMapRef.current,
          ...challengeExtrasRef.current,
          started_at: challengeStartedAtRef.current,
          completed_at: challengeCompletedAtRef.current,
          frame_timestamps: frameTimestamps,
        };
      } else if (challengeType === 'follow_dot') {
        const spec = policyRef.current.challenge as FollowDotChallenge;
        challengeResponse = {
          type: 'follow_dot',
          seed: spec?.seed || '',
          completed: true,
          waypoint_frames: waypointFrameMapRef.current,
          ...challengeExtrasRef.current,
          started_at: challengeStartedAtRef.current,
          completed_at: challengeCompletedAtRef.current,
          frame_timestamps: frameTimestamps,
        };
      } else if (challengeType === 'speak_phrase') {
        const spec = policyRef.current.audio_challenge as SpeakPhraseChallenge | undefined;
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

      const meshPackage = await buildMeshPackage();

      const integrity = await buildChannelIntegrity(frameTimestamps);

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
        client_capabilities: SDK_CAPABILITIES,
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
        // EVIDENCE-v1 section 2: capability, the colour sequence as shown and
        // the web closer-step skip. Only when the server issued the contract.
        ...(evidenceRef.current
          ? {
              evidence: buildEvidenceUpload({
                meshAvailable: isFaceMeshReady(),
                colour: colourPlayerRef.current?.record ?? null,
              }),
            }
          : {}),
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
        evidence: metadata.evidence
          ? `colour ${metadata.evidence.colour?.segments.length ?? 'none'} segments, capability ${JSON.stringify(metadata.evidence.capability)}`
          : 'not issued',
      });

      const frameBytes = framesRef.current.map(f => f.bytes);

      const uploadResponse = await uploadSignals({
        apiBaseUrl,
        environment,
        sessionId: sessionData.session_id,
        sessionToken: sessionData.session_token,
        nonce: sessionData.nonce,
        frames: frameBytes,
        metadata,
        audioBlob: audioRef.current,
        onProgress: setUploadProgress,
      });

      console.log('[UseSense] Upload successful');
      uploadedRef.current = true;
      uploadBarRef.current.advance('checking', performance.now());
      // A server Step-up rule may ask for one more challenge in this session.
      const stepUp = readStepUpInstruction(uploadResponse);
      if (stepUp && streamRef.current && !streamInterruptedRef.current) {
        startStepUpRound(stepUp, gen);
        return;
      }
      runComplete(gen);
    } catch (err: any) {
      console.error('[UseSense] Upload failed:', err);
      if (stale()) return;
      if (guided) { failGuided(err, () => runUploadRef.current(gen)); return; }
      // Move to a terminal phase before notifying the host. Leaving the phase
      // on 'uploading' is what stranded users on the "Almost done" spinner.
      const message = err.message || 'Upload failed';
      setFailureMessage(message);
      updatePhase('failed', 'Upload failed');
      onError(message);
    }
  }, [sessionData, environment, apiBaseUrl, updatePhase, onError]);

  // ── Server step-up (round 2) ──────────────────────────────────────────
  // Round 1 uploaded and a server Step-up rule asked for one more challenge.
  // The camera stream is still open: show it again, run the requested
  // challenge on a fresh frame buffer, upload it as round 2, then complete.
  const startStepUpRound = useCallback(async (stepUp: StepUpInstruction, gen: number = genRef.current) => {
    // Stale once the camera is lost, the engine unmounts, or a retry starts a new attempt.
    const stale = () => abortRef.current || gen !== genRef.current;
    if (stale()) return;
    stepUpRef.current = stepUp;
    framesRef.current = [];
    meshSignalsRef.current = [];
    // Round 2's signals describe round 2's frames (same keys as round 1).
    frameLuminancesRef.current = [];
    suspicionEngineRef.current = new SuspicionEngine(sessionData.policy.inline_step_up?.suspicion_threshold ?? 55);
    stepFrameMapRef.current = {};
    waypointFrameMapRef.current = {};
    setUploadProgress(null);
    captureStartedAtMsRef.current = Date.now();
    if (guided) {
      // "One more quick check" sheet over the blurred scan screen; Continue
      // runs the challenge on the scan screen (purple ring).
      const c = stepUp.challenge;
      setXcSentence(extraCheckSentence(c.type, c.type === 'head_turn' ? (c as HeadTurnChallenge).sequence : undefined));
      continueRef.current = () => {
        if (stale() || phaseRef.current !== 'extra-check-brief') return;
        startGuidedChallengeRef.current(gen, 2);
      };
      updatePhase('extra-check-brief', 'One more quick check');
      return;
    }
    updatePhase('step-up-round', 'One more quick check. Get ready...');
    await sleep(STEP_UP_BRIEF_MS);
    if (stale()) return;
    challengeStartedAtRef.current = new Date().toISOString();
    if (stepUp.challenge.type === 'head_turn') await runHeadTurn(gen);
    else await runFollowDot(gen);
  }, [updatePhase]);

  const runStepUpUpload = useCallback(async (gen: number = genRef.current) => {
    // Stale once the camera is lost, the engine unmounts, or a retry starts a new attempt.
    const stale = () => abortRef.current || gen !== genRef.current;
    const stepUp = stepUpRef.current;
    // abortRef is also set when the camera was lost mid-capture.
    if (stale() || !stepUp) return;
    if (stopIfFrozen()) return;
    updatePhase('uploading', 'Uploading verification data...');
    uploadBarRef.current.advance('sending', performance.now());
    try {
      const frameMap = stepUp.challenge.type === 'head_turn' ? stepFrameMapRef.current : waypointFrameMapRef.current;
      const timestamps2 = framesRef.current.map(f => f.timestamp);
      const verificationPackage = await buildMeshPackage();
      const integrity2 = await buildChannelIntegrity(timestamps2);
      const suspicion2: SuspicionData = suspicionEngineRef.current?.getSnapshot() ?? {
        final_score: 0, triggered: false,
        snapshot: { score: 0, signals: [], framesAnalyzed: 0, reliable: false, timestamp: Date.now() },
      };
      const metadata: StepUpRoundMetadata = buildStepUpRoundMetadata({
        sessionId: sessionData.session_id,
        sdkVersion: SDK_VERSION,
        challenge: stepUp.challenge,
        frameMap,
        startedAt: challengeStartedAtRef.current,
        completedAt: challengeCompletedAtRef.current,
        frames: framesRef.current,
        meshSignals: meshSignalsRef.current,
        captureStartedAtMs: captureStartedAtMsRef.current,
        captureEndedAtMs: Date.now(),
        responseExtras: challengeExtrasRef.current,
        channelIntegrity: integrity2,
        suspicion: suspicion2,
        verificationPackage,
      });
      console.log('[UseSense] Round 2 metadata summary:', JSON.stringify({
        frames: framesRef.current.length,
        channel_integrity_fields: Object.keys(integrity2).length,
        capture_source: !!integrity2.capture_source,
        verification_package_frames: verificationPackage?.frames?.length ?? 0,
        suspicion_frames_analyzed: suspicion2.snapshot.framesAnalyzed,
      }));
      await uploadSignals({
        apiBaseUrl,
        environment,
        sessionId: sessionData.session_id,
        sessionToken: sessionData.session_token,
        nonce: sessionData.nonce,
        frames: framesRef.current.map(f => f.bytes),
        metadata,
        onProgress: setUploadProgress,
        round: 2,
      });
      console.log('[UseSense] Step-up round uploaded');
      uploadBarRef.current.advance('checking', performance.now());
      runComplete(gen);
    } catch (err: any) {
      console.error('[UseSense] Step-up upload failed:', err);
      if (stale()) return;
      if (guided) { failGuided(err, () => runStepUpUploadRef.current(gen)); return; }
      const message = err.message || 'Upload failed';
      setFailureMessage(message);
      updatePhase('failed', 'Upload failed');
      onError(message);
    }
  }, [sessionData, environment, apiBaseUrl, updatePhase, onError]);

  // ── Complete ──────────────────────────────────────────────────────────
  const runComplete = useCallback(async (gen: number = genRef.current) => {
    // Stale once the camera is lost, the engine unmounts, or a retry starts a new attempt.
    const stale = () => abortRef.current || gen !== genRef.current;
    if (stale()) return;
    updatePhase('completing', 'Verifying...');
    uploadBarRef.current.advance('checking', performance.now());
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
      uploadBarRef.current.advance('done', performance.now());
      onComplete(decision);

      setResult(decision);
      updatePhase('done', 'Complete');
    } catch (err: any) {
      console.error('[UseSense] Complete failed:', err);
      if (stale()) return;
      if (guided) { failGuided(err, () => runCompleteRef.current(gen), true); return; }
      const message = err.message || 'Verification failed';
      setFailureMessage(message);
      updatePhase('failed', 'Verification failed');
      onError(message);
    }
  }, [sessionData, environment, apiBaseUrl, updatePhase, onComplete, onError]);

  // ── Retry ─────────────────────────────────────────────────────────────
  /**
   * Reset everything one capture attempt owns and stop its camera. Bumping
   * the generation stops any capture chain still running from the attempt.
   */
  const resetAttempt = useCallback(() => {
    uploadBarRef.current.reset();
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
    setFailureMessage(null);
    setEnvWarning(null);
    setDotPosition(null);
    setChallengeDirection(null);
    setSpeakPhrase(null);
    setIsRecording(false);
    setCountdownNumber(null);
    genRef.current++;
    abortRef.current = false;
    streamInterruptedRef.current = false;
    captureSourceRef.current = null;
    // A retry starts a fresh stream; stop the old one so its tracks free up.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    suspicionEngineRef.current = new SuspicionEngine(sessionData.policy.inline_step_up?.suspicion_threshold ?? 55);
    stepUpEvidenceRef.current = null;
    frameLuminancesRef.current = [];
    setStepUpPhase('idle');
    setFlashOverlayColor(null);
    setRmasState(null);
    // Guided capture: a fresh attempt gets a fresh gate and clocks.
    gateRef.current.reset();
    hintSchedRef.current.reset();
    hintRef.current = null;
    setHint(null);
    gateOkRef.current = false;
    setGateOk(false);
    scanOkRef.current = false;
    alignStartedAtRef.current = 0;
    pausedWindowsRef.current = 0;
    shutterModeRef.current = false;
    showShutterRef.current = false;
    setShowShutter(false);
    fillLightAtRef.current = null;
    fillLightOnRef.current = false;
    setFillLight(false);
    prevCentreLumaRef.current = null;
    stepUpRef.current = null;
    scanProgressRef.current = 0;
    // A new attempt plays the colour sequence again from the first colour.
    colourPlayerRef.current?.cancel();
    colourPlayerRef.current = null;
    // Extra check
    xcRef.current = null;
    setXc(null);
    setXcOverlay({});
    leaveOpenRef.current = false;
    setLeaveOpen(false);
    micLevelsRef.current = [];
  }, [sessionData]);

  // ── Retry ─────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    resetAttempt();
    requestCamera();
  }, [resetAttempt, requestCamera]);

  // ── Guided failures (end pages and the upload-failed sheet) ──────────
  /** The verification is past its 15 minutes (or the server's expires_at). */
  const sessionExpired = (): boolean => {
    const at = sessionData.expires_at ? Date.parse(sessionData.expires_at) : NaN;
    const deadline = Number.isFinite(at) ? at : sessionStartedAtRef.current + SESSION_TTL_MS;
    return Date.now() > deadline;
  };

  /**
   * A request failed in guided capture. A network failure during an upload
   * keeps the scan and shows "Couldn't send your scan" (Try again re-sends
   * it); otherwise an end page: offline, timed out, or our error. Only a
   * page the person cannot fix here is reported to the host as onError.
   */
  const failGuided = (err: unknown, retry: () => void, completing = false) => {
    const kind = classifyFailure(err, typeof navigator === 'undefined' || navigator.onLine !== false);
    const message = (err as any)?.message || (completing ? 'Verification failed' : 'Upload failed');
    setFailureMessage(message);
    if (kind === 'offline' && !completing) {
      retryActionRef.current = retry;
      updatePhase('upload-failed', "Couldn't send your scan");
      return;
    }
    if (kind === 'expired') {
      setEndScreen('expired');
      retryActionRef.current = () => (onRetry ?? onCancel ?? handleRetryRef.current)();
      updatePhase('failed', 'Timed out');
      onError(message);
      return;
    }
    setEndScreen(kind === 'offline' ? 'offline' : 'error');
    retryActionRef.current = retry;
    updatePhase('failed', completing ? 'Verification failed' : 'Upload failed');
    onError(message);
  };

  // ── Guided extra check ───────────────────────────────────────────────
  /** A challenge starts with a fresh gate, hint schedule and covered-face baseline. */
  const resetChallengeGate = () => {
    xcGateRef.current.reset();
    xcHintSchedRef.current.reset();
    coverWatchRef.current.reset();
    coverWatchScanRef.current = false;
  };

  /** Size the overlay to the camera container. */
  const measureStage = () => {
    const c = containerRef.current;
    if (c) setStageSize({ W: c.clientWidth, H: c.clientHeight });
  };

  /** The green "Done" tick, then the upload (round 1 or round 2). */
  const finishGuidedChallenge = async (gen: number, round: 1 | 2) => {
    const stale = () => abortRef.current || gen !== genRef.current;
    if (stale()) return;
    challengeCompletedAtRef.current = new Date().toISOString();
    // Client inline step-up (on-device attack check): after the policy's
    // movement and before the upload, so a server round 2 always comes after
    // it. Its own "Done" closes it; no second tick.
    if (round === 1 && inlineStepUpDue()) {
      xcRef.current = null;
      setXc(null);
      setXcOverlay({});
      await doInlineStepUp(gen);
      if (stale()) return;
    } else {
      setXc({ text: EXTRA_CHECK_COPY.done, paused: false });
      setXcOverlay({ tick: true });
      haptic([20, 60, 20]);
      updatePhase('extra-check-done', EXTRA_CHECK_COPY.done);
      await sleep(EXTRA_CHECK_TIMING.doneMs);
      if (stale()) return;
    }
    while (leaveOpenRef.current && !stale()) await sleep(100);
    if (stale()) return;
    xcRef.current = null;
    setXc(null);
    setXcOverlay({});
    if (round === 2) runStepUpUploadRef.current(gen);
    else runUploadRef.current(gen);
  };

  /**
   * Run the extra check on the scan screen. Round 1: the policy's challenge,
   * straight on from the scan. Round 2: the server's step-up, after the
   * sheet. The tracker loop (trackOnce) measures the face and moves the
   * tracker; this loop banks frames while it is not paused.
   */
  const startGuidedChallenge = async (gen: number, round: 1 | 2) => {
    const stale = () => abortRef.current || gen !== genRef.current;
    if (stale()) return;
    const policy = policyRef.current;
    const spec: any = round === 2 ? stepUpRef.current?.challenge : policy.challenge;
    const type = round === 2 ? spec?.type : policy.challenge_type;
    measureStage();
    resetChallengeGate();
    if (round === 2) uploadBarRef.current.reset();
    if (type === 'speak_phrase') { await runGuidedDigitsRef.current(gen); return; }
    if (type === 'head_turn' && Array.isArray(spec?.sequence) && spec.sequence.length) {
      stepFrameMapRef.current = {};
      (spec as HeadTurnChallenge).sequence.forEach((st) => { stepFrameMapRef.current[String(st.index)] = []; });
      xcRef.current = { kind: 'head_turn', runner: new ChallengeRunner({ kind: 'head_turn', steps: spec.sequence }), state: null, faceOk: true, progress: 0, done: false };
    } else if (type === 'follow_dot' && Array.isArray(spec?.waypoints) && spec.waypoints.length) {
      waypointFrameMapRef.current = {};
      (spec as FollowDotChallenge).waypoints.forEach((wp) => { waypointFrameMapRef.current[String(wp.index)] = []; });
      xcRef.current = { kind: 'follow_dot', runner: new ChallengeRunner({ kind: 'follow_dot', waypoints: spec.waypoints }), state: null, faceOk: true, progress: 0, done: false };
    } else {
      // Nothing this SDK can draw: carry on and let the server decide.
      console.warn(`[UseSense] Extra check "${type}" has no steps; skipping`);
      if (round === 2) runStepUpUploadRef.current(gen); else runUploadRef.current(gen);
      return;
    }
    challengeStartedAtRef.current = new Date().toISOString();
    challengeExtrasRef.current = {};
    // Maps the challenge's monotonic clock to epoch ms for step_events.
    const clockOffset = Date.now() - performance.now();
    const x0 = xcRef.current;
    const runner = x0.runner!;
    const first = runner.display();
    x0.display = first;
    setXc({ text: first.text, sub: first.sub, paused: false });
    setXcOverlay(x0.kind === 'head_turn' ? { arrow: arrowFor(first.arrow) } : { dot: first.dot, trail: first.trail });
    updatePhase('challenge', first.text);
    const fps = sessionData.upload.target_fps || 4;
    const interval = getFrameInterval(fps);
    const map = x0.kind === 'head_turn' ? stepFrameMapRef.current : waypointFrameMapRef.current;
    // Every step gets its share of the frames left (iOS device run: a
    // 30-frame budget ran out by the third of four steps).
    const cap = Math.min(30, round === 2 ? (stepUpRef.current?.maxFrames ?? 20) : (sessionData.upload.max_frames || 30));
    let lastStep = -1;
    let stepStart = framesRef.current.length;
    let quota = cap;
    let nextFrameAt = 0;
    while (!stale()) {
      const x = xcRef.current;
      if (!x || x !== x0) return;
      if (runner.finished) break;
      if (runner.stepIndex !== lastStep) {
        lastStep = runner.stepIndex;
        stepStart = framesRef.current.length;
        quota = stepFrameQuota(cap - stepStart, runner.stepCount - runner.stepIndex);
      }
      // As in the scan: frames bank only while every check passes; within
      // the step's share; and only on target (Follow Dot: or a couple once
      // the dot has settled).
      const framesThisStep = framesRef.current.length - stepStart;
      const reason = runner.bankReason;
      const allowed = reason === 'on_target' || (reason === 'settled' && framesThisStep < SETTLED_FRAMES_PER_STEP);
      const now = performance.now();
      const capture = x.faceOk && allowed && framesThisStep < quota && now >= nextFrameAt
        && !leaveOpenRef.current && !(__USESENSE_DEBUG__ && debugHooks()?.holdChallenge);
      if (capture) {
        nextFrameAt = now + interval;
        const idx = runner.specStepIndex;
        const f = await grabFrame('challenge');
        if (f) (map[String(idx)] ??= []).push(f.index);
      }
      await sleep(50);
    }
    if (stale()) return;
    challengeExtrasRef.current = {
      step_events: runner.stepEvents(clockOffset),
      // The preview is mirrored (a dot moving right on screen means the person
      // turns their own right). Said explicitly, as iOS does.
      ...(x0.kind === 'follow_dot' ? { preview_mirrored: true } : {}),
    };
    console.log('[UseSense] Extra check steps:', JSON.stringify(challengeExtrasRef.current.step_events));
    if (stale()) return;
    await finishGuidedChallenge(gen, round);
  };

  /** Speak Digits refused the microphone: "Microphone needed". */
  const showMicDenied = (gen: number, err?: unknown) => {
    if (abortRef.current || gen !== genRef.current) return;
    console.warn('[UseSense] Microphone unavailable:', (err as any)?.name || err);
    const perms = channelIntegrityRef.current?.permissions_state;
    if (perms) perms.microphone = 'denied';
    xcRef.current = null;
    setXc(null);
    setXcOverlay({});
    updatePhase('mic-denied', 'Microphone needed');
  };

  /** "Do a head movement instead": the server swaps Speak Digits for Follow Dot. */
  const fallBackToMovement = async (gen: number) => {
    const stale = () => abortRef.current || gen !== genRef.current;
    if (stale()) return;
    try {
      const r = await requestChallengeFallback({
        apiBaseUrl,
        environment,
        sessionId: sessionData.session_id,
        sessionToken: sessionData.session_token,
        reason: 'microphone_unavailable',
      });
      if (stale()) return;
      policyRef.current = r.policy;
      audioRef.current = null;
      console.log(`[UseSense] Challenge fallback: now ${r.policy.challenge_type}`);
      startGuidedChallengeRef.current(gen, 1);
    } catch (err) {
      if (stale()) return;
      const code = err instanceof ChallengeFallbackError ? err.code : 'server';
      console.error('[UseSense] Challenge fallback failed:', err);
      setEndScreen(code === 'network' ? 'offline' : 'error');
      retryActionRef.current = code === 'network' ? () => fallBackToMovementRef.current(gen) : () => handleRetryRef.current();
      updatePhase('failed', 'Challenge fallback failed');
      if (code !== 'network') onError((err as any)?.message || 'Challenge fallback failed');
    }
  };

  /**
   * Speak Digits on the scan screen: the numbers in a pill at the top, a live
   * mic meter under the oval, "We can't hear you" when it stays flat for
   * 2 s. The microphone is asked for here, so a refusal can fall back.
   */
  const runGuidedDigits = async (gen: number) => {
    const stale = () => abortRef.current || gen !== genRef.current;
    if (stale()) return;
    const audioSpec = policyRef.current.audio_challenge as SpeakPhraseChallenge | undefined;
    const phrase = digitsText(audioSpec?.phrase || '3 7 2 9 1');
    const duration = audioSpec?.total_duration_ms || 5000;
    xcRef.current = { kind: 'speak_phrase', state: null, faceOk: true, progress: 0, done: false };
    micLevelsRef.current = [];
    setXc({ text: EXTRA_CHECK_COPY.digits, paused: false });
    setXcOverlay({ digits: phrase, meter: meterBars([]) });
    updatePhase('challenge', EXTRA_CHECK_COPY.digits);

    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mic.getAudioTracks().length) throw Object.assign(new Error('No microphone input'), { name: 'NotFoundError' });
    } catch (err) {
      showMicDenied(gen, err);
      return;
    }
    if (stale()) { mic.getTracks().forEach((t) => t.stop()); return; }
    const perms = channelIntegrityRef.current?.permissions_state;
    if (perms) perms.microphone = 'granted';

    // Live level from an analyser on the mic (RMS of the waveform, 0-1).
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let buf: Float32Array | null = null;
    try {
      const AC: typeof AudioContext | undefined = (window as any).AudioContext ?? (window as any).webkitAudioContext;
      if (AC) {
        ctx = new AC();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(mic).connect(analyser);
        buf = new Float32Array(analyser.fftSize);
        await ctx.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('[UseSense] Mic meter unavailable:', e);
    }
    const level = () => {
      if (__USESENSE_DEBUG__) {
        const f = debugHooks()?.forceMicLevel;
        if (typeof f === 'number') return f;
      }
      if (!analyser || !buf) return 0;
      analyser.getFloatTimeDomainData(buf as any);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      return Math.sqrt(sum / buf.length);
    };

    challengeStartedAtRef.current = new Date().toISOString();
    const recording = recordAudio(mic, duration).catch((e) => { console.warn('[UseSense] Audio recording failed:', e); return null; });
    const fps = sessionData.upload.target_fps || 4;
    const interval = getFrameInterval(fps);
    const quiet = new QuietDetector();
    const start = performance.now();
    let nextFrameAt = start;
    let last = '';
    while (!stale()) {
      const now = performance.now();
      const elapsed = now - start;
      if (elapsed >= duration) break;
      const lv = level();
      micLevelRef.current = lv;
      const levels = micLevelsRef.current;
      levels.push(lv);
      if (levels.length > 32) levels.shift();
      const isQuiet = quiet.update(lv, now);
      const x = xcRef.current;
      const faceOk = x?.faceOk ?? true;
      if (x) x.progress = elapsed / duration;
      const copy = !faceOk
        ? (x?.hint ? { text: x.hint.text, sub: EXTRA_CHECK_COPY.digitsPaused.sub } : EXTRA_CHECK_COPY.digitsPaused)
        : isQuiet ? EXTRA_CHECK_COPY.digitsQuiet : { text: EXTRA_CHECK_COPY.digits, sub: undefined };
      const paused = !faceOk || isQuiet;
      if (x) x.state = { progress: elapsed / duration, paused, capture: faceOk, index: 0, text: copy.text, sub: copy.sub, done: false };
      const key = `${copy.text}|${copy.sub ?? ''}|${paused}`;
      if (key !== last) { last = key; setXc({ text: copy.text, sub: copy.sub, paused }); }
      setXcOverlay({ digits: phrase, meter: meterBars(levels) });
      // Same rule as the scan: no frames are banked while a check fails.
      if (faceOk && now >= nextFrameAt) {
        nextFrameAt = now + interval;
        await grabFrame('challenge');
      }
      await sleep(50);
    }
    const blob = await recording;
    mic.getTracks().forEach((t) => t.stop());
    ctx?.close().catch(() => {});
    if (stale()) return;
    audioRef.current = blob;
    await finishGuidedChallenge(gen, 1);
  };

  // Late-bound: the capture chain's callbacks were created before these.
  const startGuidedChallengeRef = useRef(startGuidedChallenge);
  startGuidedChallengeRef.current = startGuidedChallenge;
  const runGuidedDigitsRef = useRef(runGuidedDigits);
  runGuidedDigitsRef.current = runGuidedDigits;
  const fallBackToMovementRef = useRef(fallBackToMovement);
  fallBackToMovementRef.current = fallBackToMovement;
  const runUploadRef = useRef(runUpload);
  runUploadRef.current = runUpload;
  const runStepUpUploadRef = useRef(runStepUpUpload);
  runStepUpUploadRef.current = runStepUpUpload;
  const runCompleteRef = useRef(runComplete);
  runCompleteRef.current = runComplete;
  const handleRetryRef = useRef(handleRetry);
  handleRetryRef.current = handleRetry;

  // ── Start / back ──────────────────────────────────────────────────────
  /** "Start face scan" on the primer. */
  const startCapture = useCallback(() => {
    genRef.current++;
    abortRef.current = false;
    setStarted(true);
  }, []);

  /** Back to the primer: stop the camera and drop the attempt. */
  const backToIntro = useCallback(() => {
    resetAttempt();
    abortRef.current = true;
    setStarted(false);
    updatePhase('intro', 'Ready');
  }, [resetAttempt, updatePhase]);

  /**
   * The capture screen's back button: the host's onCancel when it has one
   * (Flows cancel the run, as native does), else back to the primer.
   */
  const handleBack = onCancel ?? (showIntro ? backToIntro : undefined);

  /**
   * Leave from the confirmation: this verification ends (no resume). The
   * host's onCancel when it has one, else back to the primer.
   */
  const leaveVerification = useCallback(() => {
    leaveOpenRef.current = false;
    setLeaveOpen(false);
    genRef.current++;
    abortRef.current = true;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    console.log('[UseSense] Verification left by the user');
    if (onCancel) onCancel();
    else backToIntro();
  }, [onCancel, backToIntro]);

  const keepGoing = useCallback(() => {
    leaveOpenRef.current = false;
    setLeaveOpen(false);
  }, []);

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

      // Without MediaPipe there is no face gate. Guided capture falls back to
      // the shutter; the legacy flow enables "I'm Ready" instead of leaving it
      // disabled forever.
      setMeshFailed(!isFaceMeshReady());

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
      // Guided: offline before the scan starts ends on "You're offline";
      // Try again goes on once the connection is back.
      if (guided && typeof navigator !== 'undefined' && navigator.onLine === false) {
        const goOn = () => {
          if (navigator.onLine === false) return;
          requestCamera();
        };
        setEndScreen('offline');
        retryActionRef.current = goOn;
        updatePhase('failed', 'Offline');
        return;
      }
      requestCamera();
    }

    init().catch((err: any) => {
      if (!mounted) return;
      onError(err?.message || 'Initialization failed');
    });
    return () => { mounted = false; };
  }, [started]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Guided capture: tracker ─────────────────────────────────────────
  // One rAF loop while the align and scan screens are up. Each tick (about
  // 30 fps, 15 fps when the landmarker is slow) it tracks the face, runs the
  // quality gate, schedules the hint, drives the fill light, auto start and
  // the shutter fallback, and draws the contour scan.
  const captureColors = useMemo(
    () => resolveCaptureColors(theme?.capture),
    [theme?.capture?.ring, theme?.capture?.contourStart, theme?.capture?.contourEnd, theme?.capture?.warning],
  );
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  const advanceToBaselineGuided = useCallback(() => {
    if (phaseRef.current !== 'face-guide') return;
    setHint(null);
    hintRef.current = null;
    hintSchedRef.current.reset();
    advanceToBaseline();
  }, [advanceToBaseline]);
  advanceRef.current = advanceToBaselineGuided;

  const handleShutter = useCallback(() => {
    shutterModeRef.current = true;
    showShutterRef.current = false;
    setShowShutter(false);
    haptic(10);
    advanceRef.current();
  }, []);

  /** Relief v3 camera blur (18 px), set on the preview only when it changes. */
  const setCameraBlur = useCallback((on: boolean) => {
    if (on === cameraBlurOnRef.current) return;
    cameraBlurOnRef.current = on;
    const v = videoRef.current;
    if (v) v.style.filter = on ? `blur(${CAPTURE_VISUAL_SPEC.relief.cameraBlurPx}px)` : '';
  }, []);

  /**
   * One tracked frame of the extra check: is the face in the oval, where is
   * the nose pointing; move the tracker, then draw the ring and the overlay.
   */
  const trackChallenge = (now: number, video: HTMLVideoElement, container: HTMLDivElement) => {
    const x = xcRef.current;
    if (!x) return;
    const cw = container.clientWidth, ch = container.clientHeight;
    const oval = captureOval(cw, ch);
    // Same checks as the scan (passive and active liveness get the same
    // rules): face, one person, covered, distance (scan hold band), in frame,
    // sharpness, eyes, light as advice; pose relaxed toward the step and
    // stillness for Speak Digits only. Any blocking failure pauses the check
    // and no frames are banked until it passes again.
    let faceOk = true;
    let pose: { yaw: number; pitch: number; roll: number } | undefined;
    let hint: Hint | null = null;
    const direction = x.runner?.direction ?? null;
    if (isFaceMeshReady()) {
      const vw = video.videoWidth, vh = video.videoHeight;
      const track = trackFace(video);
      let screen: Point2[] | undefined;
      let pixels: FaceAreaStats | undefined;
      let regions: Float32Array | null = null;
      if (track?.landmarks) {
        const lm = track.landmarks;
        const mapper = coverMapper(vw, vh, cw, ch, true);
        screen = lm.map((l) => mapper.map(l.x, l.y));
        let minX = 1, maxX = 0, minY = 1, maxY = 0;
        for (const l of lm) {
          if (l.x < minX) minX = l.x;
          if (l.x > maxX) maxX = l.x;
          if (l.y < minY) minY = l.y;
          if (l.y > maxY) maxY = l.y;
        }
        if (now - lastPixelAtRef.current >= 100) {
          lastPixelAtRef.current = now;
          if (!pixelCanvasRef.current) pixelCanvasRef.current = document.createElement('canvas');
          pixels = sampleRegion(video, pixelCanvasRef.current, minX * vw, minY * vh, (maxX - minX) * vw, (maxY - minY) * vh)?.stats;
        }
        if (!regionCanvasRef.current) regionCanvasRef.current = document.createElement('canvas');
        regions = sampleFaceRegions(video, regionCanvasRef.current, lm, minX * vw, minY * vh, (maxX - minX) * vw, (maxY - minY) * vh);
      }
      pose = track?.matrix ? poseFromMatrix(track.matrix) : undefined;
      let raw = xcGateRef.current.evaluate({
        now,
        faceCount: track?.faceCount ?? 0,
        screenLandmarks: screen,
        oval,
        pose,
        eyeBlink: track?.eyeBlink,
        pixels,
      }, {
        scanning: true,
        // Speaking moves the chin: Speak Digits' stillness leaves it out (as iOS).
        stillnessAnchors: x.kind === 'speak_phrase' ? STILLNESS_ANCHORS_NO_CHIN : undefined,
      });
      // Covered face (COVER-v1): judged only on settled, facing-forward
      // frames against a baseline from the challenge's own first such frames,
      // so a turned head is never read as a hand (the web has no segmenter).
      const watch = coverWatchRef.current;
      watch.setVeil(fillLightOnRef.current, now);
      watch.covered(regions, now, isSteadyForCoverWatch(raw));
      raw = withCoverWatch(raw, watch.state);
      let gate = relaxGateForChallenge(raw, { kind: x.kind, direction });
      if (__USESENSE_DEBUG__) {
        const f = debugHooks()?.forceChallengeFail as GateResult['firstFailing'] | undefined;
        if (f) gate = finishGateResult({ ...gate, checks: { ...gate.checks, [f]: 'fail' } });
      }
      faceOk = gate.allPass;
      hint = xcHintSchedRef.current.update(hintableResult(gate, { scanning: true, fillLightSettling: false }), now, (c) =>
        hintFor(c, { distance: gate.distance, light: gate.light, inFrame: gate.inFrame }),
      );
      if (__USESENSE_DEBUG__) {
        const dbg = debugHooks();
        if (dbg) dbg.last = { phase: 'challenge', firstFailing: gate.firstFailing, faces: track?.faceCount ?? 0, video: `${vw}x${vh}`, measurements: gate.measurements };
      }
    }
    if (__USESENSE_DEBUG__) {
      const dbg = debugHooks();
      if (dbg?.forceFaceOff) { faceOk = false; hint = hint ?? hintFor('face', {}); }
      if (dbg?.forcePose) pose = { roll: 0, ...dbg.forcePose };
      if (dbg && frozenAtRef.current) dbg.ready = true;
    }
    x.faceOk = faceOk;
    x.hint = faceOk ? null : hint;
    const hold = leaveOpenRef.current || (__USESENSE_DEBUG__ && !!debugHooks()?.holdChallenge && !!x.display);
    const runner = x.runner;
    if (runner && !hold) {
      const d = runner.advance({ now, faceOk, yaw: pose?.yaw ?? null, pitch: pose?.pitch ?? null, held: leaveOpenRef.current, hint: x.hint });
      x.display = d;
      x.progress = d.progress;
      x.done = d.finished;
      const key = `${d.text}|${d.sub ?? ''}|${d.warning}`;
      if (x.shown !== key) {
        x.shown = key;
        console.log(`[UseSense] Extra check: ${d.text}${d.sub ? ` / ${d.sub}` : ''}${d.paused ? ' (paused)' : ''}`);
        setXc({ text: d.text, sub: d.sub, paused: d.warning });
      }
      if (x.kind === 'head_turn') {
        const arrow = arrowFor(d.arrow);
        setXcOverlay((o) => (o.arrow === arrow ? o : { arrow }));
      } else {
        setXcOverlay({ dot: d.dot, trail: d.trail });
      }
    }
    contourRef.current?.draw({
      mode: 'challenge',
      now,
      progress: x.progress,
      paused: x.display ? x.display.warning : !!x.state?.paused,
      ringColor: EXTRA_CHECK_COLORS.ring,
    });
  };

  const trackOnce = useCallback(() => {
    const now = performance.now();
    if (now - lastTrackAtRef.current < trackIntervalRef.current) return;
    lastTrackAtRef.current = now;
    const p = phaseRef.current;
    if (p !== 'face-guide' && p !== 'baseline' && p !== 'challenge') return;
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !container) return;
    if (p === 'challenge') { trackChallenge(now, video, container); return; }

    if (__USESENSE_DEBUG__) {
      const dbg = debugHooks();
      if (dbg?.freezeAt !== undefined && !frozenAtRef.current && streamStartedAtRef.current &&
          now - streamStartedAtRef.current >= dbg.freezeAt * 1000) {
        video.pause();
        videoRefBlurred.current?.pause();
        frozenAtRef.current = now;
        contourRef.current?.revealAll();
      }
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    // Same aspect-fill + mirror transform as the preview, so the gate and the
    // contour sit exactly on the face the user sees.
    const mapper = coverMapper(vw, vh, cw, ch, true);
    const oval = captureOval(cw, ch);
    if (!pixelCanvasRef.current) pixelCanvasRef.current = document.createElement('canvas');
    const pixelDue = now - lastPixelAtRef.current >= 100;

    let result: GateResult;
    let depth: ScreenLandmark[] | null = null;
    const meshOk = isFaceMeshReady();
    if (meshOk) {
      const t0 = performance.now();
      const track = trackFace(video);
      trackIntervalRef.current = performance.now() - t0 > 40 ? 66 : 30;
      // A new scan takes a new baseline for the covered-face change watch.
      const scanning = p === 'baseline';
      if (scanning !== coverWatchScanRef.current) {
        coverWatchScanRef.current = scanning;
        coverWatchRef.current.reset();
      }
      if (!track || !track.landmarks) {
        result = gateRef.current.evaluate({ now, faceCount: track?.faceCount ?? 0 });
      } else {
        const lm = track.landmarks;
        const screen: Point2[] = new Array(lm.length);
        let minX = 1, maxX = 0, minY = 1, maxY = 0;
        for (let i = 0; i < lm.length; i++) {
          const l = lm[i];
          screen[i] = mapper.map(l.x, l.y);
          if (l.x < minX) minX = l.x;
          if (l.x > maxX) maxX = l.x;
          if (l.y < minY) minY = l.y;
          if (l.y > maxY) maxY = l.y;
        }
        let pixels: FaceAreaStats | undefined;
        if (pixelDue) {
          lastPixelAtRef.current = now;
          const sampled = sampleRegion(video, pixelCanvasRef.current, minX * vw, minY * vh, (maxX - minX) * vw, (maxY - minY) * vh);
          pixels = sampled?.stats;
        }
        // Covered face (COVER-v1.md section 2): during the scan, six face
        // regions are compared with a baseline from the scan's first steady
        // frames. Measured here, judged after the gate below (it needs to
        // know the face is settled: found, still, in the oval, at the
        // distance, facing forward). The web does not ship the
        // segmentation model (COVER-v1.md "Per platform": +15 s to start on
        // Fast 4G), so outside the scan this check is not run.
        let regions: Float32Array | null = null;
        if (scanning) {
          if (!regionCanvasRef.current) regionCanvasRef.current = document.createElement('canvas');
          regions = sampleFaceRegions(video, regionCanvasRef.current, lm, minX * vw, minY * vh, (maxX - minX) * vw, (maxY - minY) * vh);
        }
        if (track.faceCount > 1 && now - lastSecondFaceLogRef.current > 5000) {
          lastSecondFaceLogRef.current = now;
          console.log('[UseSense] second_face_detected');
        }
        result = gateRef.current.evaluate({
          now,
          faceCount: track.faceCount,
          screenLandmarks: screen,
          oval,
          pose: track.matrix ? poseFromMatrix(track.matrix) : undefined,
          eyeBlink: track.eyeBlink,
          pixels,
        }, { scanning });
        if (scanning) {
          // Baseline only from steady frames; motion wins over covered. The
          // veil is frozen during the scan; if it changes anyway the watch
          // pauses 500 ms and takes a new steady baseline. The colour tint
          // (EVIDENCE-v1) holds the watch the same way while it is up.
          const watch = coverWatchRef.current;
          watch.setVeil(fillLightOnRef.current, now);
          if (tintOnRef.current) watch.hold(now);
          watch.covered(regions, now, isSteadyForCoverWatch(result));
          result = withCoverWatch(result, watch.state);
        }
        if (__USESENSE_DEBUG__) {
          const dbg = debugHooks();
          if (dbg) dbg.cover = { state: coverWatchRef.current.state, watchScore: coverWatchRef.current.lastScore, watchRegion: coverWatchRef.current.lastRegion };
        }
        depth = lm.map((l, i) => ({ x: screen[i].x, y: screen[i].y, z: l.z }));
      }
    } else {
      // No MediaPipe: light, sharpness and motion on the centre of the frame.
      if (pixelDue) {
        lastPixelAtRef.current = now;
        const sampled = sampleRegion(video, pixelCanvasRef.current, vw * 0.3, vh * 0.2, vw * 0.4, vh * 0.55);
        if (sampled) {
          lastPixelStatsRef.current = sampled.stats;
          const prevLuma = prevCentreLumaRef.current;
          lastMotionRef.current = prevLuma ? lumaMotion(prevLuma, sampled.luma) : undefined;
          prevCentreLumaRef.current = sampled.luma;
        }
      }
      result = evaluatePixelOnlyGate(lastPixelStatsRef.current, lastMotionRef.current);
    }

    // Fill light first: on the first "too dark" a warm veil covers the screen
    // and stays on for the rest of the attempt (turning it off would make the
    // face dark again). It is decided before the scan and frozen during it,
    // so it never appears behind the change watch's baseline. Light never
    // blocks the scan (spec v1.3); while the veil settles there is no light
    // hint, and mid-scan the hint names what holds the scan rather than the
    // light advice.
    if (shouldTurnOnFillLight({ tooDark: result.light === 'too_dark', on: fillLightAtRef.current !== null, scanning: p === 'baseline' })) {
      fillLightAtRef.current = now;
      fillLightOnRef.current = true;
      setFillLight(true);
    }
    const fillLightSettling = fillLightAtRef.current !== null && now - fillLightAtRef.current < SCAN_TIMING.fillLightSettleMs;
    const hintable = hintableResult(result, { scanning: p === 'baseline', fillLightSettling });

    let next = hintSchedRef.current.update(hintable, now, (c) =>
      hintFor(c, { distance: result.distance, light: result.light, inFrame: result.inFrame }),
    );
    if (__USESENSE_DEBUG__) {
      // Debug rig: show a given guidance line (like the reference's ?hint=).
      const fh = debugHooks()?.forceHint;
      if (fh) {
        const forced: Record<string, Hint | null> = {
          ready: null,
          centre: hintFor('in_frame', {}),
          closer: hintFor('distance', { distance: 'too_far' }),
          back: hintFor('distance', { distance: 'too_close' }),
          straight: hintFor('pose', {}),
          dark: hintFor('light', { light: 'too_dark' }),
          bright: hintFor('light', { light: 'too_bright' }),
          blur: hintFor('sharpness', {}),
          eyes: hintFor('eyes', {}),
          one: hintFor('one_person', {}),
          covered: hintFor('covered', {}),
          face: hintFor('face', {}),
        };
        if (fh in forced) {
          next = forced[fh];
          result = { ...result, allPass: next === null };
        }
      }
    }
    const cur = hintRef.current;
    if ((next?.id ?? null) !== (cur?.id ?? null) || next?.text !== cur?.text || next?.sub !== cur?.sub) {
      hintRef.current = next;
      setHint(next);
    }
    if (result.allPass !== gateOkRef.current) {
      gateOkRef.current = result.allPass;
      setGateOk(result.allPass);
    }
    scanOkRef.current = result.allPass;
    if (__USESENSE_DEBUG__) {
      const dbg = debugHooks();
      if (dbg) dbg.last = { phase: p, firstFailing: result.firstFailing, faces: result.checks.face === 'fail' ? 0 : 1, video: `${vw}x${vh}`, measurements: result.measurements };
    }

    if (p === 'face-guide') {
      const dt = Math.min(200, now - lastAlignTickRef.current);
      lastAlignTickRef.current = now;
      if (result.allPass) {
        passAccumRef.current += dt;
        if (!readyBuzzedRef.current) { readyBuzzedRef.current = true; haptic(20); }
        // Auto start after ~2 s of every check passing (needs the face gate).
        if (__USESENSE_DEBUG__ && debugHooks()?.forceState === 'align') {
          // Debug rig: hold the align screen.
        } else if (meshOk && !shutterModeRef.current && passAccumRef.current >= SCAN_TIMING.autoStartMs) {
          advanceRef.current();
          return;
        }
      } else if (hintSchedRef.current.hasSustainedFailure(now)) {
        // A blip does not reset the clock; a failure the user would be told
        // about does.
        passAccumRef.current = 0;
        readyBuzzedRef.current = false;
      }
      // Debug rig: a forced state is a still frame, not a slow user.
      const rigHold = __USESENSE_DEBUG__ && !!debugHooks()?.forceState;
      const wantShutter =
        !meshOk ||
        (!rigHold &&
          (now - alignStartedAtRef.current >= SCAN_TIMING.shutterAfterMs ||
            pausedWindowsRef.current >= SCAN_TIMING.shutterAfterPausedWindows));
      if (wantShutter && !showShutterRef.current) {
        showShutterRef.current = true;
        setShowShutter(true);
      }
    }

    if (__USESENSE_DEBUG__) {
      const dbg = debugHooks();
      if (dbg && p === 'face-guide' && frozenAtRef.current && (dbg.forceState === 'scan' || dbg.forceState === 'upload')) {
        // Debug rig: go straight to the scan on the frozen frame.
        advanceRef.current();
      }
      if (dbg && frozenAtRef.current && now - frozenAtRef.current > 1200 &&
          ((dbg.forceState === 'align' && p === 'face-guide') ||
           // Scan: also wait for the camera blur (1.5 s into the scan).
           (dbg.forceState === 'scan' && p === 'baseline' && scanSeenAtRef.current !== null &&
            now - scanSeenAtRef.current > CAPTURE_VISUAL_SPEC.relief.cameraBlurAfterMs + 200))) {
        dbg.ready = true;
      }
    }

    // Relief v3: blur the camera 0.8 s into the scan so the lines carry the
    // shape (display only; frames are captured from the video, not from
    // what is shown). Cleared on a return to align.
    if (p === 'baseline') { if (scanSeenAtRef.current === null) scanSeenAtRef.current = now; }
    else scanSeenAtRef.current = null;
    setCameraBlur(scanSeenAtRef.current !== null && now - scanSeenAtRef.current >= CAPTURE_VISUAL_SPEC.relief.cameraBlurAfterMs);

    const contour = contourRef.current;
    if (contour) {
      // The field is tracked on the align screen too, so the lines are
      // already on the face when the scan's sweep starts. With the mesh
      // triangles (once MediaPipe has loaded) this is the relief v3 field.
      contour.setTriangles(getFaceTriangles());
      contour.update(depth, now);
      contour.draw(p === 'baseline'
        ? { mode: 'scan', now, progress: scanProgressRef.current, paused: !result.allPass, fill: fillLightOnRef.current }
        : { mode: 'align', now, warn: !result.allPass && hintRef.current !== null, fill: fillLightOnRef.current });
    }
  }, []);

  // Guided inline step-up: the ring in amber while it waits on the person
  // (RMAS counts the action's time down), green with the tick when done.
  const inlinePhaseNow = guided && phase.startsWith('step-up-') && phase !== 'step-up-round';
  useEffect(() => {
    if (!inlinePhaseNow) return;
    const g = inlineStepUpGuidance(stepUpPhase === 'idle' ? 'complete' : stepUpPhase, rmasState);
    const c = containerRef.current;
    if (c && (c.clientWidth !== stageSize.W || c.clientHeight !== stageSize.H)) setStageSize({ W: c.clientWidth, H: c.clientHeight });
    if (!g) return;
    contourRef.current?.draw({
      mode: 'challenge',
      now: performance.now(),
      progress: g.progress,
      ringColor: g.ring === 'done' ? EXTRA_CHECK_COLORS.done : captureColors.warning,
    });
  });

  // Upload: keep the last scan frame (lines, no ring) under the blur. Debug
  // rig: report ready once the sheet is up on the frozen frame.
  useEffect(() => {
    if (guided && phase === 'extra-check-done') {
      // The extra check's green ring, full, behind the tick.
      contourRef.current?.draw({ mode: 'challenge', now: performance.now(), progress: 1, ringColor: EXTRA_CHECK_COLORS.done });
      return undefined;
    }
    if (!guided || (phase !== 'uploading' && phase !== 'completing' && phase !== 'extra-check-brief' && phase !== 'upload-failed')) return;
    contourRef.current?.draw({ mode: 'upload', now: performance.now() });
    if (__USESENSE_DEBUG__) {
      const dbg = debugHooks();
      if (dbg?.forceState === 'upload') {
        const t = setTimeout(() => { dbg.ready = true; }, 800);
        return () => clearTimeout(t);
      }
    }
    return undefined;
  }, [guided, phase]);

  const trackingActive = guided && (phase === 'face-guide' || phase === 'baseline' || phase === 'challenge');
  useEffect(() => {
    if (!trackingActive) return;
    let raf = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      try { trackOnce(); } catch (err) { console.warn('[UseSense] Tracker error:', err); }
    };
    raf = requestAnimationFrame(tick);
    return () => { stopped = true; cancelAnimationFrame(raf); };
  }, [trackingActive, trackOnce]);

  // The camera blur belongs to the scan and the upload sheet behind it; any
  // other phase (align, a challenge, a retry) shows the clear camera.
  useEffect(() => {
    if (phase === 'baseline' || phase === 'uploading' || phase === 'completing' || phase === 'extra-check-brief' || phase === 'upload-failed') return;
    scanSeenAtRef.current = null;
    setCameraBlur(false);
  }, [phase, setCameraBlur]);

  // The contour renderer needs its canvas, which mounts with the camera.
  useEffect(() => {
    const canvas = contourCanvasRef.current;
    if (!guided || !canvas) { contourRef.current = null; return; }
    if (!contourRef.current || contourRef.current.target !== canvas) {
      contourRef.current = new CaptureCanvas(canvas, captureColors, reducedMotion);
    }
    else contourRef.current.setColors(captureColors);
  });

  // Redraw the upload bar at frame rate while the sheet is up.
  const sheetUp = guided && (phase === 'uploading' || phase === 'completing');
  useEffect(() => {
    if (!sheetUp) return;
    let raf = 0;
    const tick = () => {
      setUploadBar(uploadBarRef.current.value(performance.now()));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sheetUp]);

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
  // Guided capture keeps the camera mounted under the upload sheet so the
  // face can blur out behind it (privacy) instead of cutting to black.
  const uploadSheet = guided && (phase === 'uploading' || phase === 'completing');
  /** Guided extra check on the scan screen (challenge, its sheet, its tick). */
  const xcPhase = guided && (phase === 'challenge' || phase === 'extra-check-done');
  /** Guided client inline step-up (Flash Reflection / RMAS) on the scan screen. */
  const inlinePhase = guided && (phase === 'step-up-intro' || phase === 'step-up-flash' || phase === 'step-up-rmas' || phase === 'step-up-complete');
  const inlineGuide = inlinePhase ? inlineStepUpGuidance(stepUpPhase === 'idle' ? 'complete' : stepUpPhase, rmasState) : null;
  /** A bottom sheet over the blurred scan screen. */
  const anySheet = uploadSheet || (guided && (phase === 'extra-check-brief' || phase === 'upload-failed'));
  const showCamera = anySheet || ['face-guide', 'baseline', 'countdown', 'challenge', 'extra-check-done', 'step-up-round', 'step-up-intro', 'step-up-flash', 'step-up-rmas', 'step-up-complete'].includes(phase);
  const gatedPhase = guided && (phase === 'face-guide' || phase === 'baseline');
  const fillLightOn = gatedPhase && fillLight;
  const shutterVisible = guided && phase === 'face-guide' && (showShutter || meshFailed);
  // Screen reader text: the visible hint, or the shutter prompt. Only changes
  // when the hint does, so it inherits the 1.2 s minimum between changes.
  const liveText = inlineGuide
    ? `${inlineGuide.text}${inlineGuide.sub ? `. ${inlineGuide.sub}` : ''}`
    : xcPhase
    ? xc ? `${xc.text}${xc.sub ? `. ${xc.sub}` : ''}` : ''
    : gatedPhase
    ? hint
      ? `${hint.text}${hint.sub ? `. ${hint.sub}` : ''}`
      : shutterVisible ? GATE_HINTS.shutter : ''
    : '';
  // Guidance under the oval (spec v1.1): the gate's instruction, else the
  // resting copy. Plain text only; a second line only for light/backlight.
  const guidance: { text: string; sub?: string } | null = helpOpen
    ? { text: GATE_HINTS.pose, sub: GATE_HINTS.too_dark_sub }
    : hint
      ? { text: hint.text, sub: hint.sub }
      : shutterVisible
        ? { text: GATE_HINTS.shutter }
        : phase === 'baseline' || gateOk
          ? { text: GATE_HINTS.still }
          : null;
  // Upload and checking share one eased bar (sending to 60%, checking to 95%).
  const debugSheet = __USESENSE_DEBUG__ && debugHooks()?.forceState === 'upload' ? debugHooks()?.forceProgress : undefined;
  const sheetValue = debugSheet !== undefined ? debugSheet : uploadBar;

  const renderResult = () => {
    if (!result) return null;
    const d = result.decision;
    const isApprove = d === 'APPROVE';
    const isReject = d === 'REJECT';
    const iconClass = isApprove ? 'usesense-result-icon--success' : isReject ? 'usesense-result-icon--failure' : 'usesense-result-icon--review';
    const title = isApprove ? 'Verification successful' : isReject ? 'Verification failed' : 'Pending review';
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
  const tokens = resolveEngineTokens(theme);
  const isLightPhase = !guided && (phase === 'intro' || phase === 'done');
  // Back on the scan screen: before the scan it goes back as before; once
  // the scan has started it asks first ("Leave verification?").
  const backAction = !handleBack
    ? undefined
    : phase === 'face-guide'
      ? handleBack
      : () => { leaveOpenRef.current = true; setLeaveOpen(true); };
  const xcOval = captureOval(stageSize.W, stageSize.H);
  const xcGuidance = inlineGuide ?? (xcPhase && xc ? xc : null);

  return (
    <div
      className={`usesense-engine${isLightPhase ? ' usesense-engine--light' : ''}${fillLightOn ? ' usesense-engine--fill' : ''}`}
      style={{
        ['--us-capture-ring' as string]: captureColors.ring,
        ['--us-capture-warning' as string]: captureColors.warning,
      } as React.CSSProperties}
    >
      <style>{getEngineStyles(primaryColor, theme)}</style>

      {logoUrl && phase !== 'intro' && <img className="usesense-logo" src={logoUrl} alt={displayName || 'Logo'} />}

      {/* ── Primer (guided: storyboard page; "Two quick steps" when the
            policy already has a challenge) ── */}
      {phase === 'intro' && guided && (() => {
        const c = primerCopy(policyRef.current.challenge_type);
        return (
          <StoryPage
            testId={c.title === 'Two quick steps' ? 'primer_two' : 'primer'}
            icon="face"
            tone="info"
            title={c.title}
            body={c.body}
            tips={c.tips}
            primary={c.start}
            onPrimary={startCapture}
            secondary={onCancel ? FACE_PRIMER_COPY.cancel : undefined}
            onSecondary={onCancel}
          />
        );
      })()}

      {/* ── Face primer (the same screen as Flows and the native SDKs) ── */}
      {phase === 'intro' && !guided && (
        <PrimerFrame
          tokens={{
            bg: tokens.lightBg, fg: tokens.lightFg, muted: tokens.muted, border: tokens.border,
            primary: primaryColor, primaryFg: tokens.primaryFg,
            fontDisplay: tokens.fontDisplay, fontBody: tokens.fontBody,
            buttonRadius: 12, buttonStyle: 'filled',
          }}
          brandName={displayName}
          logoUrl={logoUrl}
          onCancel={onCancel}
        >
          <FacePrimerBody
            tokens={{
              bg: tokens.lightBg, fg: tokens.lightFg, muted: tokens.muted, border: tokens.border,
              primary: primaryColor, primaryFg: tokens.primaryFg,
              fontDisplay: tokens.fontDisplay, fontBody: tokens.fontBody,
              buttonRadius: 12, buttonStyle: 'filled',
            }}
            onStart={startCapture}
          />
        </PrimerFrame>
      )}

      {/* Cancel button on dark loading/brief phases */}
      {onCancel && (phase === 'challenge-brief' || phase === 'initializing' || phase === 'camera-request' || (!guided && (phase === 'camera-error' || phase === 'failed'))) && (
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
          <div className="usesense-result-title">Allow camera access</div>
          <div className="usesense-result-subtitle">
            We need access to your camera for identity verification
          </div>
        </div>
      )}

      {/* ── Guided end pages: camera, offline, timed out, our error ────── */}
      {guided && (phase === 'camera-error' || phase === 'failed') && (
        <EndPage screen={endScreen} app={displayName} onPrimary={() => retryActionRef.current()} />
      )}

      {/* ── Speak Digits without a microphone ─────────────────────────── */}
      {guided && phase === 'mic-denied' && (
        <EndPage
          screen="mic_denied"
          app={displayName}
          onPrimary={() => runGuidedDigitsRef.current(genRef.current)}
          onSecondary={() => fallBackToMovementRef.current(genRef.current)}
        />
      )}

      {/* ── Camera error ──────────────────────────────────────────────── */}
      {phase === 'camera-error' && !guided && (
        <div className="usesense-result">
          <div className="usesense-result-icon usesense-result-icon--failure">
            <AlertIcon />
          </div>
          <div className="usesense-result-title">
            {phaseLabel === 'Camera disconnected' ? 'Camera disconnected' : 'Camera access needed'}
          </div>
          <div className="usesense-result-subtitle">{cameraError}</div>
          <button className="usesense-btn usesense-btn--primary" onClick={handleRetry} style={{ marginTop: '16px' }}>
            Retry Camera
          </button>
        </div>
      )}

      {/* ── Post-capture failure (upload / completion) ─────────────────── */}
      {phase === 'failed' && !guided && (
        <div className="usesense-result">
          <div className="usesense-result-icon usesense-result-icon--failure">
            <AlertIcon />
          </div>
          <div className="usesense-result-title">Verification incomplete</div>
          <div className="usesense-result-subtitle">
            {failureMessage || 'Something went wrong finishing your verification.'}
          </div>
          <button className="usesense-btn usesense-btn--primary" onClick={handleRetry} style={{ marginTop: '16px' }}>
            Try Again
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
            Got it, start
          </button>
        </div>
      )}

      {/* ── Camera phases ─────────────────────────────────────────────── */}
      {showCamera && (
        <>
          <div ref={containerRef} className={`usesense-camera-container${guided ? ' usesense-camera-container--guided' : ''}`}>
            <video ref={videoRefBlurred} className="usesense-camera-video usesense-camera-video--blurred" autoPlay playsInline muted />
            <video
              ref={videoRef}
              className="usesense-camera-video usesense-camera-video--clear"
              autoPlay
              playsInline
              muted
            />

            {/* Guide, contour lines, progress ring, fill light (guided capture) */}
            {guided && (
              <canvas
                ref={contourCanvasRef}
                className="usesense-contour-canvas"
                aria-hidden="true"
                style={{ visibility: gatedPhase || anySheet || xcPhase || inlinePhase ? 'visible' : 'hidden' }}
              />
            )}

            {/* EVIDENCE-v1 colour sequence: the whole view tinted in the
                server's colours during the scan, over the preview and the
                fill-light veil. Driven straight from the colour player. */}
            {guided && <div ref={tintElRef} className="usesense-colour-tint" aria-hidden="true" />}

            {/* Extra check: arrow, dot and trail, tick, digits pill, mic meter */}
            {xcPhase && (
              <ChallengeOverlay W={stageSize.W} H={stageSize.H} oval={xcOval} state={xcOverlay} />
            )}
            {inlinePhase && inlineGuide?.tick && (
              <ChallengeOverlay W={stageSize.W} H={stageSize.H} oval={xcOval} state={{ tick: true }} />
            )}

            {/* Sheets: the whole screen blurs behind them (privacy) */}
            {anySheet && <div className="usesense-capture-blur" />}

            {/* Top bar (guided): back and help. Not over a sheet. */}
            {guided && !anySheet && (
              <div className="usesense-capture-top">
                {backAction ? (
                  <button type="button" className="usesense-capture-circ" onClick={backAction} aria-label="Back">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                  </button>
                ) : <span />}
                <button
                  type="button"
                  className="usesense-capture-circ"
                  onClick={() => setHelpOpen((v) => !v)}
                  aria-label="Help"
                  aria-expanded={helpOpen}
                >
                  <span aria-hidden="true">?</span>
                </button>
              </div>
            )}

            {/* Cancel pill top-left (legacy flow) */}
            {!guided && onCancel && (
              <button className="usesense-cancel-pill" onClick={onCancel} style={{ zIndex: 30 }}>See results</button>
            )}

            {/* Verifying badge top-right during active recording (legacy flow) */}
            {!guided && (phase === 'baseline' || phase === 'challenge') && (
              <div className="usesense-verifying-badge" style={{ zIndex: 30 }}>
                <div className="usesense-recording-dot" />
                Verifying
              </div>
            )}

            {/* Face oval */}
            {/* Face oval (legacy flow; guided capture draws it on the canvas) */}
            {!guided && (phase === 'face-guide' || phase === 'baseline') && (
              <div ref={ovalRef} className={[
                'usesense-face-oval',
                faceGuideStatus?.ready ? 'usesense-face-oval--ready' : '',
                phase === 'baseline' ? 'usesense-face-oval--baseline' : '',
              ].join(' ')} />
            )}

            {/* Guidance text under the oval (guided capture). The polite live
                region below announces it; this copy is visual. */}
            {xcGuidance && (
              <div key={`${xcGuidance.text}|${xcGuidance.sub ?? ''}`} className="usesense-guidance" aria-hidden="true">
                <span className="usesense-guidance-text">{xcGuidance.text}</span>
                {xcGuidance.sub && <span className="usesense-guidance-sub">{xcGuidance.sub}</span>}
              </div>
            )}
            {gatedPhase && guidance && (
              <div key={`${guidance.text}|${guidance.sub ?? ''}`} className="usesense-guidance" aria-hidden="true">
                <span className="usesense-guidance-text">{guidance.text}</span>
                {guidance.sub && <span className="usesense-guidance-sub">{guidance.sub}</span>}
              </div>
            )}
            {shutterVisible && (
              <button type="button" className="usesense-shutter usesense-shutter--guided" onClick={handleShutter} aria-label="Start the scan">
                <span className="usesense-shutter-inner" />
              </button>
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

            {/* Environment warning (legacy flow; guided capture folds these
                checks into the gate, where they block) */}
            {!guided && envWarning && <div className="usesense-env-warning">{envWarning}</div>}

            {/* v4.1: Flash reflection overlay */}
            {flashOverlayColor && (
              <div className="usesense-flash-overlay" style={{ backgroundColor: flashOverlayColor }} />
            )}

            {/* v4.1: Step-up intro overlay */}
            {!guided && stepUpPhase === 'intro' && (
              <div className="usesense-step-up-overlay">
                <div className="usesense-step-up-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </div>
                <div className="usesense-step-up-title">Additional verification</div>
                <div className="usesense-step-up-message">We need to verify your presence with a quick check. This will only take a few seconds.</div>
              </div>
            )}

            {/* v4.1: Step-up complete overlay */}
            {!guided && stepUpPhase === 'complete' && (
              <div className="usesense-step-up-overlay">
                <div className="usesense-step-up-icon" style={{ color: '#00D4AA' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div className="usesense-step-up-title">Verification complete</div>
              </div>
            )}

            {/* v4.1: RMAS action prompt */}
            {!guided && rmasState && (
              <div className="usesense-rmas-card">
                <div className="usesense-rmas-step">{rmasState.step} of {rmasState.total}</div>
                <div className="usesense-rmas-label">{rmasState.label}</div>
                <div className="usesense-rmas-countdown-bar">
                  <div className="usesense-rmas-countdown-fill" style={{ width: `${rmasState.countdown}%` }} />
                </div>
              </div>
            )}

            {/* v4.1: Flash status text */}
            {!guided && stepUpPhase === 'flash' && (
              <div className="usesense-step-up-status">Hold still -- verifying...</div>
            )}
          </div>

          {/* Screen reader announcements for hints (rate-limited with them) */}
          {guided && (
            <div className="usesense-sr-only" role="status" aria-live="polite" aria-atomic="true">{liveText}</div>
          )}

          {/* Round 2: "One more quick check", then Continue */}
          {guided && phase === 'extra-check-brief' && stepUpRef.current && (
            <BottomSheet
              testId={`xc_${stepUpRef.current.challenge.type}`}
              icon={stepUpRef.current.challenge.type === 'head_turn' ? 'turn' : 'dot'}
              tone="extra"
              title={EXTRA_CHECK_COPY.sheetTitle}
              body={xcSentence}
              primary={EXTRA_CHECK_COPY.continue}
              onPrimary={() => continueRef.current()}
            />
          )}

          {/* The upload ran out of retries: the scan is kept */}
          {guided && phase === 'upload-failed' && (
            <BottomSheet
              testId="upload_failed"
              icon="upload"
              tone="warning"
              title="Couldn't send your scan"
              body="Check your connection. Your scan is kept, so you won't need to do it again."
              primary="Try again"
              onPrimary={() => retryActionRef.current()}
            />
          )}

          {/* Upload sheet over the blurred camera (guided capture) */}
          {uploadSheet && (
            <>
              <div className="usesense-upload-sheet">
                <div className="usesense-upload-sheet-title">Checking it&apos;s you</div>
                <div
                  className="usesense-upload-sheet-bar"
                  role="progressbar"
                  aria-valuenow={ariaPercent(sheetValue)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Verification progress"
                >
                  <i style={{ width: `${(sheetValue * 100).toFixed(2)}%` }} />
                </div>
                <div className="usesense-upload-sheet-sub">Usually under 10 seconds</div>
              </div>
            </>
          )}

          {/* Status area */}
          {!anySheet && !gatedPhase && !xcPhase && !inlinePhase && (
          <div className="usesense-status-area">
            <div className="usesense-status-text">{phaseLabel}</div>

            {phase === 'challenge' && speakPhrase && (
              <div className="usesense-phrase-display">{speakPhrase}</div>
            )}

            {!guided && phase === 'face-guide' && (
              <button
                className="usesense-btn usesense-btn--primary"
                // Without MediaPipe the guide can never report ready; let the
                // user start anyway instead of leaving them stuck.
                disabled={!faceGuideStatus?.ready && !meshFailed}
                onClick={advanceToBaseline}
                style={{ marginTop: '16px' }}
              >
                I&apos;m Ready
              </button>
            )}

            {((!guided && phase === 'baseline') || phase === 'challenge') && (
              <div className="usesense-status-hint" style={{ marginTop: '6px' }}>Follow the instructions</div>
            )}
          </div>
          )}

          {/* Progress (guided capture draws the scan's progress as the ring) */}
          {!guided && (phase === 'baseline' || phase === 'challenge') && (
            <div className="usesense-progress">
              <div className="usesense-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
        </>
      )}

      {/* ── Uploading / Completing ────────────────────────────────────── */}
      {!guided && (phase === 'uploading' || phase === 'completing') && (
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
              {phase === 'uploading'
                ? (uploadProgress && uploadProgress.total > 0
                    ? `Uploading \u2014 ${uploadProgress.percent}% of ${formatBytes(uploadProgress.total)}`
                    : 'Finishing up \u2014 this will only take a moment.')
                : 'Analyzing your identity\u2026'}
            </div>
            {phase === 'uploading' && uploadProgress && uploadProgress.total > 0 && (
              <div
                className="usesense-progress-track"
                role="progressbar"
                aria-valuenow={uploadProgress.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Upload progress"
              >
                <div
                  className="usesense-progress-fill"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Done ──────────────────────────────────────────────────────── */}
      {phase === 'done' && showResultScreen && !guided && renderResult()}
      {phase === 'done' && showResultScreen && guided && result && (() => {
        const screen = resultScreen(result.decision, allowRetryOnReject);
        const finish = onCancel ?? (() => onComplete(result));
        return (
          <EndPage
            screen={screen}
            app={displayName}
            onPrimary={screen === 'rejected_retry' ? (onRetry ?? handleRetry) : finish}
            onSecondary={finish}
          />
        );
      })()}

      {/* Back mid-flow: confirm before ending the verification */}
      {leaveOpen && <LeaveDialog onLeave={leaveVerification} onStay={keepGoing} />}

    </div>
  );
};
