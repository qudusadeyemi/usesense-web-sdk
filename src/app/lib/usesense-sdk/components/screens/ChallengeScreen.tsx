import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChallengeType,
  ChallengeSpec,
  SpeakPhraseChallenge,
  FollowDotChallenge,
  HeadTurnChallenge,
  UploadConfig,
  FrameMetadata,
} from '../../types';
import { QualityIndicator } from '../QualityIndicator';
import { ImageQualityReport } from '../../capture/image-quality';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result returned by ChallengeScreen when the two-phase capture completes.
 * For head_turn and follow_dot, this includes the actual captured frames
 * (since the ChallengeScreen owns the capture loop). For speak_phrase the
 * frames are captured separately by the main verification flow.
 */
export interface TwoPhaseCaptureResult {
  /** Captured frame blobs (JPEG, raw non-mirrored) */
  frames: Blob[];
  /** Per-frame metadata */
  frameMetadata: FrameMetadata[];
  /** step_frames map (head_turn only, key = step index) */
  step_frames?: Record<string, number[]>;
  /** waypoint_frames map (follow_dot only, key = waypoint index) */
  waypoint_frames?: Record<string, number[]>;
  /** Millisecond-offset timestamps for every frame since capture start */
  frame_timestamps: number[];
  /** ISO timestamp when the challenge phase started (excludes baseline) */
  started_at: string;
  /** ISO timestamp when the challenge phase completed */
  completed_at: string;
}

type CapturePhase = 'init' | 'instructions' | 'face-guide' | 'baseline' | 'countdown' | 'challenge' | 'done';

interface ChallengeScreenProps {
  type: ChallengeType;
  stream: MediaStream;
  challengeSpec?: ChallengeSpec;
  audioSpec?: SpeakPhraseChallenge | null;
  uploadConfig?: UploadConfig;
  /**
   * When true, the ChallengeScreen owns the capture loop and returns
   * frames in the onComplete callback (head_turn / follow_dot).
   * When false (speak_phrase), it only shows the challenge UI.
   */
  integratedCapture?: boolean;
  onComplete: (data: TwoPhaseCaptureResult | any) => void;
  logoUrl?: string;
  /** Called on each quality analysis cycle */
  onQualityReport?: (report: ImageQualityReport) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Duration of the baseline "keep still" phase in ms */
const BASELINE_DURATION_MS = 2000;

/** JPEG quality for captured frames */
const JPEG_QUALITY = 0.85;

/** Default max frames if no upload config provided */
const DEFAULT_MAX_FRAMES = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const DIRECTION_LABELS: Record<string, string> = {
  left: 'Turn your head LEFT',
  right: 'Turn your head RIGHT',
  up: 'Tilt your head UP',
  down: 'Tilt your head DOWN',
  center: 'Look straight ahead',
};

const DIRECTION_ARROWS: Record<string, string> = {
  left: '\u2190',
  right: '\u2192',
  up: '\u2191',
  down: '\u2193',
  center: '\u25CB',
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const ChallengeScreen: React.FC<ChallengeScreenProps> = ({
  type,
  stream,
  challengeSpec,
  audioSpec,
  uploadConfig,
  integratedCapture = false,
  onComplete,
  logoUrl,
  onQualityReport,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // UI state
  const [phase, setPhase] = useState<CapturePhase>('init');
  const [dotPosition, setDotPosition] = useState({ x: 50, y: 50 });
  const [progress, setProgress] = useState(0);
  const [currentDirection, setCurrentDirection] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Preparing...');
  const [qualityLevel, setQualityLevel] = useState<'good' | 'acceptable' | 'poor'>('good');
  const [qualityMessage, setQualityMessage] = useState<string | null>(null);

  // NEW in v1.17.5 — countdown number state
  const [countdownNumber, setCountdownNumber] = useState<number | null>(null);

  // Ref to prevent double-execution of the capture loop
  const captureRunning = useRef(false);

  // Ref — stores the Promise resolve callback for user dismissal of instructions
  const instructionsDismissRef = useRef<(() => void) | null>(null);

  // NEW in v1.17.5 — face guide ready ref
  const faceGuideReadyRef = useRef<(() => void) | null>(null);

  // ── Stable callback refs ──────────────────────────────────────────────────
  // These refs ensure that useEffect dependency arrays stay stable across
  // parent re-renders, preventing the capture loop from restarting.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const onQualityReportRef = useRef(onQualityReport);
  onQualityReportRef.current = onQualityReport;

  // Quality report handler
  const handleQualityReport = useCallback((report: ImageQualityReport) => {
    onQualityReportRef.current?.(report);
    setQualityLevel(report.overallLevel);
    if (report.guidance.length > 0) {
      setQualityMessage(report.guidance[0].message);
    } else {
      setQualityMessage(null);
    }
  }, []);

  // ─── Video initialisation ────────────────────────────────────────────────

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  }, [stream]);

  // ─── Canvas setup ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      ctxRef.current = canvasRef.current.getContext('2d');
    }
  }, []);

  // ─── Frame capture helper ────────────────────────────────────────────────
  /**
   * Capture a single RAW (non-mirrored) frame from the video stream.
   * CRITICAL: No scaleX(-1) — the backend expects raw webcam orientation.
   */
  const captureOneFrame = useCallback((): Promise<Blob | null> => {
    return new Promise(resolve => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!video || !canvas || !ctx || video.readyState < 2) {
        resolve(null);
        return;
      }

      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 1280;

      // Draw raw — NO MIRRORING
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        blob => resolve(blob),
        'image/jpeg',
        JPEG_QUALITY,
      );
    });
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  //  TWO-PHASE CAPTURE — head_turn / follow_dot
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!integratedCapture) return;
    if (type !== 'head_turn' && type !== 'follow_dot') return;
    if (captureRunning.current) return;
    captureRunning.current = true;

    const run = async () => {
      // Wait for the video element to be ready
      const video = videoRef.current;
      if (video && video.readyState < 2) {
        await new Promise<void>(resolve => {
          const onLoaded = () => {
            video.removeEventListener('loadeddata', onLoaded);
            resolve();
          };
          video.addEventListener('loadeddata', onLoaded);
          // Safety timeout
          setTimeout(resolve, 3000);
        });
      }

      // ────────────────────────────────────────────────────────────────────
      // Phase 0: INSTRUCTIONS — block on user acknowledgment before capture
      // ────────────────────────────────────────────────────────────────────
      setPhase('instructions');

      // Set instruction label based on challenge type
      if (type === 'follow_dot') {
        setStatusText('A red dot will appear on screen. Follow it with your eyes while keeping your head still.');
      } else if (type === 'head_turn') {
        setStatusText('You will be asked to turn your head in specific directions. Follow the arrows shown on screen.');
      }

      // BLOCKS here until user clicks "Got it"
      await new Promise<void>(resolve => {
        instructionsDismissRef.current = resolve;
      });

      // ────────────────────────────────────────────────────────────────────
      // Phase 0b: FACE GUIDE — position face in oval before capture
      // ────────────────────────────────────────────────────────────────────
      setPhase('face-guide');
      setStatusText('Position your face in the oval');
      setDotPosition(null as any);

      // BLOCKS until user clicks "My face is ready"
      await new Promise<void>(resolve => {
        faceGuideReadyRef.current = resolve;
      });

      // Derive capture parameters from the challenge spec
      // v1.17.6+: Server's upload.target_fps is AUTHORITATIVE, not capture_fps_hint
      const spec = challengeSpec as (HeadTurnChallenge | FollowDotChallenge);
      const framesPerStep = spec?.frames_per_step ?? 2;
      const captureFps = uploadConfig?.target_fps
        || spec?.capture_fps_hint
        || 10;
      const frameInterval = Math.floor(1000 / captureFps);

      // Accumulated capture state
      const frames: Blob[] = [];
      const frameMeta: FrameMetadata[] = [];
      const frameTimestamps: number[] = [];
      let globalFrameIndex = 0;
      const captureOrigin = performance.now();
      const captureStartDate = Date.now();

      // ── Frame budget ──────────────────────────────────────────────────
      const maxFrames = uploadConfig?.max_frames ?? DEFAULT_MAX_FRAMES;
      const baselineBudget = Math.max(10, Math.floor(maxFrames * 0.30));
      let budgetExhausted = false;

      console.log(
        `[UseSense] Frame budget: ${maxFrames} total (${baselineBudget} baseline, ${maxFrames - baselineBudget} challenge)`,
      );

      const grab = async (budgetLimit?: number): Promise<boolean> => {
        if (globalFrameIndex >= maxFrames) {
          if (!budgetExhausted) {
            console.warn(`[UseSense] Frame budget exhausted (${maxFrames} max). Stopping capture.`);
            budgetExhausted = true;
          }
          return false;
        }
        if (budgetLimit !== undefined && globalFrameIndex >= budgetLimit) {
          return false;
        }

        const blob = await captureOneFrame();
        if (!blob) return false;

        const now = performance.now();
        frameMeta.push({
          frame_index: globalFrameIndex,
          capture_timestamp_ms: Date.now(),
          performance_timestamp_ms: now - captureOrigin,
          frame_blob_size_bytes: blob.size,
          resolution_w: canvasRef.current?.width ?? 720,
          resolution_h: canvasRef.current?.height ?? 1280,
        });
        frames.push(blob);
        frameTimestamps.push(Math.round(now - captureOrigin));
        globalFrameIndex++;
        return true;
      };

      // ────────────────────────────────────────────────────────────────────
      // Phase 1: BASELINE
      // ────────────────────────────────────────────────────────────────────
      setPhase('baseline');
      setStatusText('Keep still \u2014 look at the camera');
      setProgress(0);

      const baselineEnd = performance.now() + BASELINE_DURATION_MS;
      while (performance.now() < baselineEnd) {
        await grab(baselineBudget);
        const elapsed = BASELINE_DURATION_MS - (baselineEnd - performance.now());
        setProgress(Math.min((elapsed / BASELINE_DURATION_MS) * 25, 25));
        await sleep(frameInterval);
      }

      const baselineFrameCount = globalFrameIndex;
      console.log(`[UseSense] Baseline complete: ${baselineFrameCount} frames captured`);

      // ────────────────────────────────────────────────────────────────────
      // Phase 1b: COUNTDOWN 3-2-1 before challenge (still capturing)
      // ────────────────────────────────────────────────────────────────────
      setPhase('countdown');
      setStatusText('');
      setCurrentDirection(null);
      console.log('Countdown before challenge...');
      for (let n = 3; n >= 1; n--) {
        setCountdownNumber(n);
        // Continue capturing baseline frames during countdown
        const countdownStepEnd = performance.now() + 1000;
        while (performance.now() < countdownStepEnd && globalFrameIndex < maxFrames) {
          await grab();
          await sleep(frameInterval);
        }
      }
      setCountdownNumber(null);

      const postCountdownFrameCount = globalFrameIndex;
      console.log(`[UseSense] Countdown complete: ${postCountdownFrameCount - baselineFrameCount} additional frames captured`);

      // ────────────────────────────────────────────────────────────────────
      // Phase 2: CHALLENGE
      // ────────────────────────────────────────────────────────────────────
      setPhase('challenge');
      const challengeStartedAt = new Date().toISOString();

      if (type === 'head_turn') {
        const htSpec = spec as HeadTurnChallenge;
        const sequence = htSpec.sequence;
        const stepFrames: Record<string, number[]> = {};
        sequence.forEach(s => { stepFrames[String(s.index)] = []; });

        const totalSteps = sequence.length;

        for (let si = 0; si < sequence.length; si++) {
          const step = sequence[si];

          setCurrentDirection(step.direction);
          setStatusText(DIRECTION_LABELS[step.direction] || 'Follow the instructions');
          setProgress(25 + ((si / totalSteps) * 75));

          const stepEnd = performance.now() + step.duration_ms;
          let framesThisStep = 0;

          while (performance.now() < stepEnd) {
            const ok = await grab();
            if (ok) {
              stepFrames[String(step.index)].push(globalFrameIndex - 1);
              framesThisStep++;
            }
            await sleep(frameInterval);
          }

          // Backup loop: ensure minimum frames per step, but bail out if budget is exhausted
          let backupAttempts = 0;
          const maxBackupAttempts = framesPerStep * 3;
          while (framesThisStep < framesPerStep && backupAttempts < maxBackupAttempts) {
            backupAttempts++;
            const ok = await grab();
            if (ok) {
              stepFrames[String(step.index)].push(globalFrameIndex - 1);
              framesThisStep++;
            } else if (budgetExhausted) {
              break; // No more frames possible, bail out
            }
            await sleep(frameInterval);
          }

          if (framesThisStep < framesPerStep) {
            console.warn(
              `[UseSense] Step ${step.index} (${step.direction}) has ${framesThisStep} frames ` +
              `(minimum: ${framesPerStep}). Backend validation may be degraded.`,
            );
          }

          console.log(
            `[UseSense] Step ${step.index} (${step.direction}): ${framesThisStep} frames ` +
            `[${stepFrames[String(step.index)].slice(0, 3).join(',')}...]`,
          );
        }

        setProgress(100);
        setPhase('done');

        const challengeCompletedAt = new Date().toISOString();

        console.log(
          `[UseSense] Two-phase capture complete: ${frames.length} total frames ` +
          `(${baselineFrameCount} baseline + ${frames.length - baselineFrameCount} challenge)`,
        );

        onCompleteRef.current({
          frames,
          frameMetadata: frameMeta,
          step_frames: stepFrames,
          frame_timestamps: frameTimestamps,
          started_at: challengeStartedAt,
          completed_at: challengeCompletedAt,
        } satisfies TwoPhaseCaptureResult);

      } else if (type === 'follow_dot') {
        const fdSpec = spec as FollowDotChallenge;
        const waypoints = fdSpec.waypoints;
        const waypointFrames: Record<string, number[]> = {};
        waypoints.forEach(wp => { waypointFrames[String(wp.index)] = []; });

        const totalWaypoints = waypoints.length;

        for (let wi = 0; wi < waypoints.length; wi++) {
          const wp = waypoints[wi];

          setDotPosition({ x: wp.x * 100, y: wp.y * 100 });
          setStatusText('Follow the dot with your eyes');
          setProgress(25 + ((wi / totalWaypoints) * 75));

          const wpEnd = performance.now() + wp.duration_ms;
          let framesThisWp = 0;

          while (performance.now() < wpEnd) {
            const ok = await grab();
            if (ok) {
              waypointFrames[String(wp.index)].push(globalFrameIndex - 1);
              framesThisWp++;
            }
            await sleep(frameInterval);
          }

          // Backup loop: ensure minimum frames per waypoint, but bail out if budget is exhausted
          let backupAttempts = 0;
          const maxBackupAttempts = framesPerStep * 3;
          while (framesThisWp < framesPerStep && backupAttempts < maxBackupAttempts) {
            backupAttempts++;
            const ok = await grab();
            if (ok) {
              waypointFrames[String(wp.index)].push(globalFrameIndex - 1);
              framesThisWp++;
            } else if (budgetExhausted) {
              break; // No more frames possible, bail out
            }
            await sleep(frameInterval);
          }

          if (framesThisWp < framesPerStep) {
            console.warn(
              `[UseSense] Waypoint ${wp.index} has ${framesThisWp} frames ` +
              `(minimum: ${framesPerStep}). Backend validation may be degraded.`,
            );
          }
        }

        setProgress(100);
        setPhase('done');

        const challengeCompletedAt = new Date().toISOString();

        console.log(
          `[UseSense] Two-phase capture complete: ${frames.length} total frames ` +
          `(${baselineFrameCount} baseline + ${frames.length - baselineFrameCount} challenge)`,
        );

        onCompleteRef.current({
          frames,
          frameMetadata: frameMeta,
          waypoint_frames: waypointFrames,
          frame_timestamps: frameTimestamps,
          started_at: challengeStartedAt,
          completed_at: challengeCompletedAt,
        } satisfies TwoPhaseCaptureResult);
      }
    };

    run().catch(err => {
      console.error('[UseSense] Two-phase capture error:', err);
      captureRunning.current = false;
    });

    return () => {
      captureRunning.current = false;
    };
  }, [integratedCapture, type, challengeSpec, uploadConfig, captureOneFrame]);

  // ═══════════════════════════════════════════════════════════════════════════
  //  SPEAK PHRASE — simple UI-only mode (frames captured separately)
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (type !== 'speak_phrase') return;

    const spec = audioSpec;
    const duration = spec?.total_duration_ms || 5000;
    const steps = 50;
    const stepDuration = duration / steps;
    let currentStep = 0;
    const startedAt = new Date().toISOString();

    // ── Phase 0: INSTRUCTIONS — show instruction overlay before speak_phrase begins ──
    setPhase('instructions');
    setStatusText('You will be shown a phrase to read aloud. Speak clearly and at a normal pace.');

    // Block until user clicks "Got it" — reuses the same instructionsDismissRef
    const runSpeakPhrase = async () => {
      await new Promise<void>(resolve => {
        instructionsDismissRef.current = resolve;
      });

      setPhase('challenge');

      const progressInterval = setInterval(() => {
        currentStep++;
        setProgress((currentStep / steps) * 100);

        if (currentStep >= steps) {
          clearInterval(progressInterval);
          setTimeout(() => {
            onCompleteRef.current({
              started_at: startedAt,
              completed_at: new Date().toISOString(),
            });
          }, 200);
        }
      }, stepDuration);

      // Store cleanup reference
      (runSpeakPhrase as any)._cleanup = () => clearInterval(progressInterval);
    };

    runSpeakPhrase();

    return () => {
      if ((runSpeakPhrase as any)._cleanup) {
        (runSpeakPhrase as any)._cleanup();
      }
    };
  }, [type, audioSpec]);

  // ══════════════════════════════════════════════════════════════════════════
  //  LEGACY UI-ONLY fallback for head_turn / follow_dot without
  //  integratedCapture (backwards compat — should not be used in v1.10.8+)
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (integratedCapture) return;
    if (type !== 'follow_dot') return;

    const spec = challengeSpec as FollowDotChallenge | undefined;
    const waypoints = spec?.waypoints || [
      { x: 0.5, y: 0.3, duration_ms: 1500, index: 0 },
      { x: 0.7, y: 0.5, duration_ms: 1500, index: 1 },
      { x: 0.5, y: 0.7, duration_ms: 1500, index: 2 },
      { x: 0.3, y: 0.5, duration_ms: 1500, index: 3 },
      { x: 0.5, y: 0.5, duration_ms: 1500, index: 4 },
    ];
    const framesPerStep = spec?.frames_per_step || 3;
    const captureFps = spec?.capture_fps_hint || 10;
    const frameIntervalMs = Math.floor(1000 / captureFps);

    let currentIndex = 0;
    const waypointFrames: Record<string, number[]> = {};
    const frameTimestampsArr: number[] = [];
    const startedAt = new Date().toISOString();
    const captureStart = performance.now();
    let frameCounter = 0;

    waypoints.forEach(wp => { waypointFrames[String(wp.index)] = []; });
    const firstWp = waypoints[0];
    setDotPosition({ x: firstWp.x * 100, y: firstWp.y * 100 });
    setProgress(0);

    const fid = setInterval(() => {
      if (currentIndex < waypoints.length) {
        waypointFrames[String(waypoints[currentIndex].index)].push(frameCounter);
        frameTimestampsArr.push(Math.round(performance.now() - captureStart));
        frameCounter++;
      }
    }, frameIntervalMs);

    const advanceWaypoint = () => {
      const cf = waypointFrames[String(waypoints[currentIndex].index)]?.length || 0;
      if (cf < framesPerStep) {
        console.warn(`[UseSense] Waypoint ${currentIndex} has ${cf} frames (minimum: ${framesPerStep}).`);
      }
      currentIndex++;
      if (currentIndex >= waypoints.length) {
        clearInterval(fid);
        onCompleteRef.current({ waypoint_frames: waypointFrames, frame_timestamps: frameTimestampsArr, started_at: startedAt, completed_at: new Date().toISOString() });
        return;
      }
      const wp = waypoints[currentIndex];
      setDotPosition({ x: wp.x * 100, y: wp.y * 100 });
      setProgress(((currentIndex + 1) / waypoints.length) * 100);
    };

    let elapsed = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    waypoints.forEach((wp, i) => {
      if (i > 0) { elapsed += waypoints[i - 1].duration_ms; timers.push(setTimeout(advanceWaypoint, elapsed)); }
    });
    elapsed += waypoints[waypoints.length - 1].duration_ms;
    timers.push(setTimeout(advanceWaypoint, elapsed));

    return () => { clearInterval(fid); timers.forEach(t => clearTimeout(t)); };
  }, [integratedCapture, type, challengeSpec]);

  useEffect(() => {
    if (integratedCapture) return;
    if (type !== 'head_turn') return;

    const spec = challengeSpec as HeadTurnChallenge | undefined;
    const sequence = spec?.sequence || [
      { direction: 'left' as const, duration_ms: 2000, index: 0 },
      { direction: 'right' as const, duration_ms: 2000, index: 1 },
      { direction: 'center' as const, duration_ms: 1500, index: 2 },
    ];
    const framesPerStep = spec?.frames_per_step || 3;
    const captureFps = spec?.capture_fps_hint || 10;
    const frameIntervalMs = Math.floor(1000 / captureFps);

    let currentIndex = 0;
    const stepFrames: Record<string, number[]> = {};
    const frameTimestampsArr: number[] = [];
    const startedAt = new Date().toISOString();
    const captureStart = performance.now();
    let frameCounter = 0;

    sequence.forEach(s => { stepFrames[String(s.index)] = []; });
    setCurrentDirection(sequence[0].direction);
    setProgress(0);

    const fid = setInterval(() => {
      if (currentIndex < sequence.length) {
        stepFrames[String(sequence[currentIndex].index)].push(frameCounter);
        frameTimestampsArr.push(Math.round(performance.now() - captureStart));
        frameCounter++;
      }
    }, frameIntervalMs);

    const advanceStep = () => {
      const cf = stepFrames[String(sequence[currentIndex].index)]?.length || 0;
      if (cf < framesPerStep) {
        console.warn(`[UseSense] Step ${currentIndex} (${sequence[currentIndex].direction}) has ${cf} frames (minimum: ${framesPerStep}).`);
      }
      currentIndex++;
      if (currentIndex >= sequence.length) {
        clearInterval(fid);
        onCompleteRef.current({ step_frames: stepFrames, frame_timestamps: frameTimestampsArr, started_at: startedAt, completed_at: new Date().toISOString() });
        return;
      }
      setCurrentDirection(sequence[currentIndex].direction);
      setProgress(((currentIndex + 1) / sequence.length) * 100);
    };

    let elapsed = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    sequence.forEach((s, i) => {
      if (i > 0) { elapsed += sequence[i - 1].duration_ms; timers.push(setTimeout(advanceStep, elapsed)); }
    });
    elapsed += sequence[sequence.length - 1].duration_ms;
    timers.push(setTimeout(advanceStep, elapsed));

    return () => { clearInterval(fid); timers.forEach(t => clearTimeout(t)); };
  }, [integratedCapture, type, challengeSpec]);

  // ─── Instruction text ────────────────────────────────────────────────────

  const getInstructions = () => {
    if (integratedCapture && (type === 'head_turn' || type === 'follow_dot')) {
      return statusText;
    }
    switch (type) {
      case 'head_turn':
        if (!currentDirection) return 'Follow the instructions';
        return DIRECTION_LABELS[currentDirection] || 'Follow the instructions';
      case 'follow_dot':
        return 'Follow the dot with your eyes';
      case 'speak_phrase':
        return 'Read the phrase below out loud clearly';
      default:
        return 'Follow the instructions';
    }
  };

  const phrase = audioSpec?.phrase;

  // ─── Phase badge (for two-phase mode) ────────────────────────────────────

  const getPhaseBadge = () => {
    if (!integratedCapture) return null;
    if (phase === 'baseline') {
      return (
        <div
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '20px',
            backgroundColor: 'rgba(99, 102, 241, 0.9)',
            color: 'white',
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '8px',
            letterSpacing: '0.5px',
          }}
        >
          BASELINE
        </div>
      );
    }
    if (phase === 'challenge') {
      return (
        <div
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '20px',
            backgroundColor: 'rgba(79, 70, 229, 0.9)',
            color: 'white',
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '8px',
            letterSpacing: '0.5px',
          }}
        >
          CHALLENGE
        </div>
      );
    }
    if (phase === 'done') {
      return (
        <div
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '20px',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            color: '#4F46E5',
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '8px',
            letterSpacing: '0.5px',
          }}
        >
          COMPLETE
        </div>
      );
    }
    return null;
  };

  // ─── Quality border glow color ───────────────────────────────────────────

  const getQualityBorderColor = () => {
    switch (qualityLevel) {
      case 'poor': return 'rgba(124, 58, 237, 0.6)';
      case 'acceptable': return 'rgba(167, 139, 250, 0.5)';
      default: return 'transparent';
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="usesense-screen">
      {logoUrl && (
        <img
          src={logoUrl}
          alt="Logo"
          style={{ height: '24px', marginBottom: '12px' }}
        />
      )}

      {getPhaseBadge()}

      <h2 className="usesense-title" style={{ marginBottom: '6px', fontSize: '18px' }}>
        {phase === 'baseline' ? 'Getting ready...' : 'Verification challenge'}
      </h2>

      {progress > 0 && (
        <div className="usesense-progress" style={{ marginTop: '6px', marginBottom: '10px' }}>
          <div
            className="usesense-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div
        className="usesense-video-container"
        style={{
          marginBottom: '0px',
          maxWidth: '340px',
          boxShadow: qualityLevel !== 'good'
            ? `0 0 0 3px ${getQualityBorderColor()}`
            : undefined,
          transition: 'box-shadow 0.4s ease',
        }}
      >
        <video
          ref={videoRef}
          className="usesense-video"
          autoPlay
          playsInline
          muted
          style={{ transform: 'scaleX(-1)' }} // Mirror preview only — captured frames are raw
        />

        {/* Real-time quality indicator overlay */}
        {(phase === 'face-guide' || phase === 'baseline' || phase === 'countdown' || phase === 'challenge') && (
          <QualityIndicator
            videoRef={videoRef}
            active={true}
            analysisHz={4}
            onQualityReport={handleQualityReport}
            compact={phase === 'challenge'}
            autoHide={false}
          />
        )}

        {/* Follow-dot overlay — only during challenge phase */}
        {type === 'follow_dot' && phase === 'challenge' && dotPosition && (
          <div
            className="usesense-challenge-dot"
            style={{
              left: `${dotPosition.x}%`,
              top: `${dotPosition.y}%`,
              transform: 'translate(-50%, -50%)',
              width: `${(challengeSpec as FollowDotChallenge)?.dot_size_px || 24}px`,
              height: `${(challengeSpec as FollowDotChallenge)?.dot_size_px || 24}px`,
            }}
          />
        )}

        {/* Head turn direction arrow overlay — indigo gradient circle (v1.17.5) */}
        {type === 'head_turn' && currentDirection && phase === 'challenge' && (
          <div
            key={currentDirection}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              background: currentDirection === 'center'
                ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                : 'linear-gradient(135deg, #4f46e5, #6366f1)',
              animation: 'direction-enter 0.35s ease-out forwards',
              boxShadow: '0 0 30px rgba(99, 102, 241, 0.5), 0 8px 25px rgba(0,0,0,0.3)',
            }}
          >
            <span style={{ fontSize: '48px', color: 'white', fontWeight: 'bold', lineHeight: 1 }}>
              {DIRECTION_ARROWS[currentDirection] || '\u25CB'}
            </span>
          </div>
        )}

        {/* Face guide oval overlay (v1.17.5) */}
        {phase === 'face-guide' && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {/* Semi-transparent surround with oval cutout */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(ellipse 55% 42% at 50% 50%, transparent 98%, rgba(0,0,0,0.6) 100%)',
              }}
            />
            {/* Animated dashed oval border */}
            <div
              style={{
                position: 'absolute',
                width: '55%',
                aspectRatio: '3 / 4',
                maxHeight: '80%',
                top: '50%',
                left: '50%',
                border: '3px dashed rgba(255,255,255,0.8)',
                borderRadius: '50%',
                animation: 'pulse 2s ease-in-out infinite',
                boxShadow: '0 0 0 4px rgba(255,255,255,0.15), inset 0 0 30px rgba(255,255,255,0.05)',
              }}
            />
            {/* Top label */}
            <div style={{ position: 'absolute', top: '4%', left: 0, right: 0, textAlign: 'center', zIndex: 11 }}>
              <div style={{ display: 'inline-block', padding: '4px 16px 6px', background: 'rgba(0,0,0,0.6)', borderRadius: '9999px' }}>
                <span style={{ color: 'white', fontSize: '14px', fontWeight: 500 }}>Position your face in the oval</span>
              </div>
            </div>
            {/* Ready button */}
            <div style={{ position: 'absolute', bottom: '6%', left: 0, right: 0, textAlign: 'center', zIndex: 11 }}>
              <button
                style={{
                  pointerEvents: 'auto',
                  padding: '12px 32px',
                  background: '#4f46e5',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: 700,
                  borderRadius: '16px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                }}
                onClick={() => {
                  if (faceGuideReadyRef.current) {
                    faceGuideReadyRef.current();
                    faceGuideReadyRef.current = null;
                  }
                }}
              >
                My face is ready
              </button>
            </div>
          </div>
        )}

        {/* Countdown overlay (v1.17.5) */}
        {phase === 'countdown' && countdownNumber !== null && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div
                key={countdownNumber}
                style={{
                  width: '112px',
                  height: '112px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.95)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                  animation: 'countdown-pop 0.9s ease-out forwards',
                }}
              >
                <span style={{ fontSize: '60px', fontWeight: 900, color: '#4f46e5' }}>{countdownNumber}</span>
              </div>
              <div style={{ padding: '4px 16px 6px', background: 'rgba(0,0,0,0.6)', borderRadius: '9999px' }}>
                <span style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>Get ready...</span>
              </div>
            </div>
          </div>
        )}

        {/* Baseline face oval overlay — subtle (v1.17.5 indigo) */}
        {phase === 'baseline' && (
          <div
            style={{
              position: 'absolute',
              width: '55%',
              aspectRatio: '3 / 4',
              maxHeight: '80%',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '50%',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* Quality warning banner below video */}
      {qualityMessage && phase !== 'done' && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.3s ease',
            backgroundColor: qualityLevel === 'poor'
              ? 'rgba(124, 58, 237, 0.1)'
              : 'rgba(167, 139, 250, 0.1)',
            color: qualityLevel === 'poor' ? '#6D28D9' : '#7C3AED',
            border: `1px solid ${qualityLevel === 'poor'
              ? 'rgba(124, 58, 237, 0.2)'
              : 'rgba(167, 139, 250, 0.2)'}`,
          }}
        >
          <span style={{ fontSize: '14px' }}>
            {qualityLevel === 'poor' ? '\u26A0\uFE0F' : '\u{1F4A1}'}
          </span>
          <span>{qualityMessage}</span>
        </div>
      )}

      {/* Pre-challenge instruction overlay — blocks until user clicks "Got it" */}
      {phase === 'instructions' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 50,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '28px 24px',
              maxWidth: '320px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              pointerEvents: 'auto',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#e0e7ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: '24px',
                color: '#4f46e5',
              }}
            >
              {type === 'follow_dot' ? '\u{1F534}' : type === 'head_turn' ? '\u{1F504}' : '\u{1F3A4}'}
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
              {type === 'follow_dot' ? 'Follow the Dot' : type === 'head_turn' ? 'Head Turn Challenge' : 'Speak Phrase Challenge'}
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', marginBottom: '20px' }}>
              {statusText}
            </p>
            <button
              style={{
                width: '100%',
                padding: '12px 24px',
                borderRadius: '10px',
                border: 'none',
                background: '#4f46e5',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                pointerEvents: 'auto',
              }}
              onClick={() => {
                if (instructionsDismissRef.current) {
                  instructionsDismissRef.current();
                  instructionsDismissRef.current = null;
                }
              }}
            >
              Got it — start challenge
            </button>
          </div>
        </div>
      )}

      {type === 'speak_phrase' && phrase && (
        <div
          style={{
            padding: '10px',
            background: 'var(--usesense-border)',
            borderRadius: '8px',
            marginTop: '10px',
            fontSize: '15px',
            fontWeight: '600',
            color: 'var(--usesense-text)',
          }}
        >
          &ldquo;{phrase}&rdquo;
        </div>
      )}
    </div>
  );
};