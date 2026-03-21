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
  onComplete: (data: TwoPhaseCaptureResult | any) => void;
  logoUrl?: string;
  onQualityReport?: (report: ImageQualityReport) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BASELINE_DURATION_MS = 2000;
const JPEG_QUALITY = 0.85;
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
// ───────────────────────────────────────────────────────────────────────────

export const ChallengeScreen: React.FC<ChallengeScreenProps> = ({
  type,
  stream,
  challengeSpec,
  audioSpec,
  uploadConfig,
  onComplete,
  logoUrl,
  onQualityReport,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [phase, setPhase] = useState<CapturePhase>('init');
  const [dotPosition, setDotPosition] = useState({ x: 50, y: 50 });
  const [progress, setProgress] = useState(0);
  const [currentDirection, setCurrentDirection] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Preparing...');
  const [qualityLevel, setQualityLevel] = useState<'good' | 'acceptable' | 'poor'>('good');
  const [qualityMessage, setQualityMessage] = useState<string | null>(null);
  const [countdownNumber, setCountdownNumber] = useState<number | null>(null);

  const captureRunning = useRef(false);
  const instructionsDismissRef = useRef<(() => void) | null>(null);
  const faceGuideReadyRef = useRef<(() => void) | null>(null);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onQualityReportRef = useRef(onQualityReport);
  onQualityReportRef.current = onQualityReport;

  const handleQualityReport = useCallback((report: ImageQualityReport) => {
    onQualityReportRef.current?.(report);
    setQualityLevel(report.overallLevel);
    if (report.guidance.length > 0) {
      setQualityMessage(report.guidance[0].message);
    } else {
      setQualityMessage(null);
    }
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  }, [stream]);

  useEffect(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      ctxRef.current = canvasRef.current.getContext('2d');
    }
  }, []);

  const captureOneFrame = useCallback((): Promise<Blob | null> => {
    return new Promise(resolve => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!video || !canvas || !ctx || video.readyState < 2) { resolve(null); return; }
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 1280;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', JPEG_QUALITY);
    });
  }, []);

  // TWO-PHASE CAPTURE
  useEffect(() => {
    if (captureRunning.current) return;
    captureRunning.current = true;

    const run = async () => {
      const video = videoRef.current;
      if (video && video.readyState < 2) {
        await new Promise<void>(resolve => {
          const onLoaded = () => { video.removeEventListener('loadeddata', onLoaded); resolve(); };
          video.addEventListener('loadeddata', onLoaded);
          setTimeout(resolve, 3000);
        });
      }

      // Shared capture config
      const spec = challengeSpec as (HeadTurnChallenge | FollowDotChallenge);
      const framesPerStep = spec?.frames_per_step ?? 2;
      const captureFps = uploadConfig?.target_fps || (spec as any)?.capture_fps_hint || 10;
      const frameInterval = Math.floor(1000 / captureFps);

      const frames: Blob[] = [];
      const frameMeta: FrameMetadata[] = [];
      const frameTimestamps: number[] = [];
      let globalFrameIndex = 0;
      const captureOrigin = performance.now();

      const maxFrames = uploadConfig?.max_frames ?? DEFAULT_MAX_FRAMES;
      const baselineBudget = Math.max(10, Math.floor(maxFrames * 0.30));
      let budgetExhausted = false;

      const grab = async (budgetLimit?: number): Promise<boolean> => {
        if (globalFrameIndex >= maxFrames) {
          if (!budgetExhausted) { console.warn(`[UseSense] Frame budget exhausted (${maxFrames} max).`); budgetExhausted = true; }
          return false;
        }
        if (budgetLimit !== undefined && globalFrameIndex >= budgetLimit) return false;
        const blob = await captureOneFrame();
        if (!blob) return false;
        const now = performance.now();
        frameMeta.push({ frame_index: globalFrameIndex, capture_timestamp_ms: Date.now(), performance_timestamp_ms: now - captureOrigin, frame_blob_size_bytes: blob.size, resolution_w: canvasRef.current?.width ?? 720, resolution_h: canvasRef.current?.height ?? 1280 });
        frames.push(blob);
        frameTimestamps.push(Math.round(now - captureOrigin));
        globalFrameIndex++;
        return true;
      };

      // Phase 0: INSTRUCTIONS (skip for 'none')
      if (type !== 'none') {
        setPhase('instructions');
        if (type === 'follow_dot') {
          setStatusText('A red dot will appear on screen. Follow it with your eyes while keeping your head still.');
        } else if (type === 'head_turn') {
          setStatusText('You will be asked to turn your head in specific directions. Follow the arrows shown on screen.');
        } else if (type === 'speak_phrase') {
          setStatusText('You will be shown a phrase to read aloud. Speak clearly and at a normal pace.');
        }
        await new Promise<void>(resolve => { instructionsDismissRef.current = resolve; });
      }

      // Phase 0b: FACE GUIDE
      setPhase('face-guide');
      setStatusText('Position your face in the oval');
      setDotPosition(null as any);
      await new Promise<void>(resolve => { faceGuideReadyRef.current = resolve; });

      // Phase 1: BASELINE
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
      void globalFrameIndex; // baseline frame count recorded

      // Phase 1b: COUNTDOWN (skip for 'none')
      if (type !== 'none') {
        setPhase('countdown');
        setStatusText('');
        setCurrentDirection(null);
        for (let n = 3; n >= 1; n--) {
          setCountdownNumber(n);
          const countdownStepEnd = performance.now() + 1000;
          while (performance.now() < countdownStepEnd && globalFrameIndex < maxFrames) {
            await grab();
            await sleep(frameInterval);
          }
        }
        setCountdownNumber(null);
      }

      // Phase 2: CHALLENGE
      setPhase('challenge');
      const challengeStartedAt = new Date().toISOString();

      if (type === 'none') {
        // Baseline-only -- no challenge phase
        setProgress(100);
        setPhase('done');
        onCompleteRef.current({
          frames,
          frameMetadata: frameMeta,
          frame_timestamps: frameTimestamps,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        } satisfies TwoPhaseCaptureResult);
        return;
      }

      if (type === 'speak_phrase') {
        const duration = audioSpec?.total_duration_ms || 5000;
        const phraseEnd = performance.now() + duration;
        while (performance.now() < phraseEnd && globalFrameIndex < maxFrames) {
          const pct = 25 + ((1 - (phraseEnd - performance.now()) / duration) * 75);
          setProgress(Math.min(pct, 100));
          await grab();
          await sleep(frameInterval);
        }
        setProgress(100);
        setPhase('done');
        onCompleteRef.current({
          frames,
          frameMetadata: frameMeta,
          frame_timestamps: frameTimestamps,
          started_at: challengeStartedAt,
          completed_at: new Date().toISOString(),
        } satisfies TwoPhaseCaptureResult);
        return;
      }

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
          while (performance.now() < stepEnd) { const ok = await grab(); if (ok) { stepFrames[String(step.index)].push(globalFrameIndex - 1); framesThisStep++; } await sleep(frameInterval); }
          let backupAttempts = 0;
          while (framesThisStep < framesPerStep && backupAttempts < framesPerStep * 3) { backupAttempts++; const ok = await grab(); if (ok) { stepFrames[String(step.index)].push(globalFrameIndex - 1); framesThisStep++; } else if (budgetExhausted) break; await sleep(frameInterval); }
        }
        setProgress(100);
        setPhase('done');
        onCompleteRef.current({ frames, frameMetadata: frameMeta, step_frames: stepFrames, frame_timestamps: frameTimestamps, started_at: challengeStartedAt, completed_at: new Date().toISOString() } satisfies TwoPhaseCaptureResult);
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
          while (performance.now() < wpEnd) { const ok = await grab(); if (ok) { waypointFrames[String(wp.index)].push(globalFrameIndex - 1); framesThisWp++; } await sleep(frameInterval); }
          let backupAttempts = 0;
          while (framesThisWp < framesPerStep && backupAttempts < framesPerStep * 3) { backupAttempts++; const ok = await grab(); if (ok) { waypointFrames[String(wp.index)].push(globalFrameIndex - 1); framesThisWp++; } else if (budgetExhausted) break; await sleep(frameInterval); }
        }
        setProgress(100);
        setPhase('done');
        onCompleteRef.current({ frames, frameMetadata: frameMeta, waypoint_frames: waypointFrames, frame_timestamps: frameTimestamps, started_at: challengeStartedAt, completed_at: new Date().toISOString() } satisfies TwoPhaseCaptureResult);
      }
    };

    run().catch(err => { console.error('[UseSense] Two-phase capture error:', err); captureRunning.current = false; });
    return () => { captureRunning.current = false; };
  }, [type, challengeSpec, audioSpec, uploadConfig, captureOneFrame]);

  const getInstructions = () => {
    return statusText;
  };

  const phrase = audioSpec?.phrase;

  const getPhaseBadge = () => {
    if (phase === 'baseline') return <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '20px', backgroundColor: 'rgba(99, 102, 241, 0.9)', color: 'white', fontSize: '12px', fontWeight: '600', marginBottom: '8px', letterSpacing: '0.5px' }}>BASELINE</div>;
    if (phase === 'challenge') return <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '20px', backgroundColor: 'rgba(79, 70, 229, 0.9)', color: 'white', fontSize: '12px', fontWeight: '600', marginBottom: '8px', letterSpacing: '0.5px' }}>CHALLENGE</div>;
    if (phase === 'done') return <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '20px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#4F46E5', fontSize: '12px', fontWeight: '600', marginBottom: '8px', letterSpacing: '0.5px' }}>COMPLETE</div>;
    return null;
  };

  const getQualityBorderColor = () => {
    switch (qualityLevel) {
      case 'poor': return 'rgba(124, 58, 237, 0.6)';
      case 'acceptable': return 'rgba(167, 139, 250, 0.5)';
      default: return 'transparent';
    }
  };

  return (
    <div className="usesense-screen">
      {logoUrl && <img src={logoUrl} alt="Logo" style={{ height: '24px', marginBottom: '12px' }} />}
      {getPhaseBadge()}
      <h2 className="usesense-title" style={{ marginBottom: '6px', fontSize: '18px' }}>
        {phase === 'baseline' ? 'Getting ready...' : 'Verification challenge'}
      </h2>
      {progress > 0 && (
        <div className="usesense-progress" style={{ marginTop: '6px', marginBottom: '10px' }}>
          <div className="usesense-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="usesense-video-container" style={{ marginBottom: '0px', maxWidth: '340px', boxShadow: qualityLevel !== 'good' ? `0 0 0 3px ${getQualityBorderColor()}` : undefined, transition: 'box-shadow 0.4s ease' }}>
        <video ref={videoRef} className="usesense-video" autoPlay playsInline muted style={{ transform: 'scaleX(-1)' }} />
        {(phase === 'face-guide' || phase === 'baseline' || phase === 'countdown' || phase === 'challenge') && <QualityIndicator videoRef={videoRef} active={true} analysisHz={4} onQualityReport={handleQualityReport} compact={phase === 'challenge'} autoHide={false} />}

        {type === 'follow_dot' && phase === 'challenge' && dotPosition && (
          <div className="usesense-challenge-dot" style={{ left: `${dotPosition.x}%`, top: `${dotPosition.y}%`, transform: 'translate(-50%, -50%)', width: `${(challengeSpec as FollowDotChallenge)?.dot_size_px || 24}px`, height: `${(challengeSpec as FollowDotChallenge)?.dot_size_px || 24}px` }} />
        )}

        {type === 'head_turn' && currentDirection && phase === 'challenge' && (
          <div key={currentDirection} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '96px', height: '96px', borderRadius: '50%', background: currentDirection === 'center' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'linear-gradient(135deg, #4f46e5, #6366f1)', animation: 'direction-enter 0.35s ease-out forwards', boxShadow: '0 0 30px rgba(99, 102, 241, 0.5), 0 8px 25px rgba(0,0,0,0.3)' }}>
            <span style={{ fontSize: '48px', color: 'white', fontWeight: 'bold', lineHeight: 1 }}>{DIRECTION_ARROWS[currentDirection] || '\u25CB'}</span>
          </div>
        )}

        {phase === 'face-guide' && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 42% at 50% 50%, transparent 98%, rgba(0,0,0,0.6) 100%)' }} />
            <div style={{ position: 'absolute', width: '55%', aspectRatio: '3 / 4', maxHeight: '80%', top: '50%', left: '50%', border: '3px dashed rgba(255,255,255,0.8)', borderRadius: '50%', animation: 'pulse 2s ease-in-out infinite', boxShadow: '0 0 0 4px rgba(255,255,255,0.15), inset 0 0 30px rgba(255,255,255,0.05)' }} />
            <div style={{ position: 'absolute', top: '4%', left: 0, right: 0, textAlign: 'center', zIndex: 11 }}>
              <div style={{ display: 'inline-block', padding: '4px 16px 6px', background: 'rgba(0,0,0,0.6)', borderRadius: '9999px' }}>
                <span style={{ color: 'white', fontSize: '14px', fontWeight: 500 }}>Position your face in the oval</span>
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: '6%', left: 0, right: 0, textAlign: 'center', zIndex: 11 }}>
              <button style={{ pointerEvents: 'auto', padding: '12px 32px', background: '#4f46e5', color: 'white', fontSize: '16px', fontWeight: 700, borderRadius: '16px', border: 'none', cursor: 'pointer', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)' }} onClick={() => { if (faceGuideReadyRef.current) { faceGuideReadyRef.current(); faceGuideReadyRef.current = null; } }}>
                My face is ready
              </button>
            </div>
          </div>
        )}

        {phase === 'countdown' && countdownNumber !== null && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div key={countdownNumber} style={{ width: '112px', height: '112px', borderRadius: '50%', background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', animation: 'countdown-pop 0.9s ease-out forwards' }}>
                <span style={{ fontSize: '60px', fontWeight: 900, color: '#4f46e5' }}>{countdownNumber}</span>
              </div>
              <div style={{ padding: '4px 16px 6px', background: 'rgba(0,0,0,0.6)', borderRadius: '9999px' }}>
                <span style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>Get ready...</span>
              </div>
            </div>
          </div>
        )}

        {phase === 'baseline' && (
          <div style={{ position: 'absolute', width: '55%', aspectRatio: '3 / 4', maxHeight: '80%', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', border: '2px solid rgba(255, 255, 255, 0.3)', borderRadius: '50%', pointerEvents: 'none' }} />
        )}

        <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0, 0, 0, 0.8)', color: 'white', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', textAlign: 'center', maxWidth: '90%', backdropFilter: 'blur(4px)' }}>
          {getInstructions()}
        </div>
      </div>

      {qualityMessage && phase !== 'done' && (
        <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.3s ease', backgroundColor: qualityLevel === 'poor' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(167, 139, 250, 0.1)', color: qualityLevel === 'poor' ? '#6D28D9' : '#7C3AED', border: `1px solid ${qualityLevel === 'poor' ? 'rgba(124, 58, 237, 0.2)' : 'rgba(167, 139, 250, 0.2)'}` }}>
          <span style={{ fontSize: '14px' }}>{qualityLevel === 'poor' ? '\u26A0\uFE0F' : '\u{1F4A1}'}</span>
          <span>{qualityMessage}</span>
        </div>
      )}

      {phase === 'instructions' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 50, pointerEvents: 'none' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px 24px', maxWidth: '320px', width: '90%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', pointerEvents: 'auto' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px', color: '#4f46e5' }}>
              {type === 'follow_dot' ? '\u{1F534}' : type === 'head_turn' ? '\u{1F504}' : '\u{1F3A4}'}
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
              {type === 'follow_dot' ? 'Follow the Dot' : type === 'head_turn' ? 'Head Turn Challenge' : 'Speak Phrase Challenge'}
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', marginBottom: '20px' }}>{statusText}</p>
            <button style={{ width: '100%', padding: '12px 24px', borderRadius: '10px', border: 'none', background: '#4f46e5', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', pointerEvents: 'auto' }} onClick={() => { if (instructionsDismissRef.current) { instructionsDismissRef.current(); instructionsDismissRef.current = null; } }}>
              Got it — start challenge
            </button>
          </div>
        </div>
      )}

      {type === 'speak_phrase' && phrase && (
        <div style={{ padding: '10px', background: 'var(--usesense-border)', borderRadius: '8px', marginTop: '10px', fontSize: '15px', fontWeight: '600', color: 'var(--usesense-text)' }}>
          &ldquo;{phrase}&rdquo;
        </div>
      )}
    </div>
  );
};