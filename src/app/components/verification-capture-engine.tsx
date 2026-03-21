/**
 * VerificationCaptureEngine — Shared biometric capture engine
 *
 * Runs the full capture pipeline:
 *   Camera init  ->  Web integrity signals  ->  Baseline phase
 *   ->  Countdown 3-2-1  ->  Challenge phase  ->  Upload signals
 *   ->  Complete session  ->  Return verdict
 *
 * Used by:
 *   - Hosted Enrollment Page  (remote enrollment flow)
 *   - Hosted Verification Page (remote verification flow)
 *   - (future) Embedded Web SDK widget
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera, ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
  Crosshair, Sun, Moon, Aperture,
} from 'lucide-react';
import { API_BASE, publicAnonKey } from '../lib/supabase-config';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CaptureSessionData {
  session_id: string;
  session_token: string;
  nonce: string;
  policy: any;
  upload: {
    max_frames: number;
    target_fps: number;
    capture_duration_ms: number;
  };
}

export interface CaptureResult {
  decision: string;
  identity_id?: string;
  channel_trust_score?: number;
  liveness_score?: number;
  dedupe_risk_score?: number;
  reasons?: string[];
  debug?: any;
  [key: string]: any;
}

export type CapturePhase =
  | 'initializing'
  | 'camera-request'
  | 'camera-error'
  | 'instructions'
  | 'face-guide'
  | 'baseline'
  | 'countdown'
  | 'challenge'
  | 'uploading'
  | 'completing'
  | 'done';

interface VerificationCaptureEngineProps {
  sessionData: CaptureSessionData;
  environment: 'sandbox' | 'production';
  primaryColor?: string;
  onComplete: (result: CaptureResult) => void;
  onError: (error: string) => void;
  onPhaseChange?: (phase: CapturePhase, label: string) => void;
}

// ─── Web Integrity Signal Collector ───────────────────────────────────────────

async function collectWebIntegritySignals(): Promise<Record<string, any>> {
  const signals: Record<string, any> = {};

  // Core navigator
  signals.user_agent = navigator.userAgent;
  signals.platform = navigator.platform;
  signals.webdriver = !!(navigator as any).webdriver;
  signals.cookie_enabled = navigator.cookieEnabled;
  signals.do_not_track = navigator.doNotTrack || null;
  signals.language = navigator.language;
  signals.languages = navigator.languages ? [...navigator.languages] : [navigator.language];
  signals.hardware_concurrency = navigator.hardwareConcurrency || null;
  signals.device_memory = (navigator as any).deviceMemory || null;
  signals.max_touch_points = navigator.maxTouchPoints ?? null;
  signals.pdf_viewer_enabled = (navigator as any).pdfViewerEnabled ?? null;

  // Screen / display
  signals.screen_resolution = `${screen.width}x${screen.height}`;
  signals.screen_available = `${screen.availWidth}x${screen.availHeight}`;
  signals.device_pixel_ratio = window.devicePixelRatio || 1;
  signals.color_depth = screen.colorDepth || null;
  signals.viewport_size = `${window.innerWidth}x${window.innerHeight}`;

  // Timezone
  try { signals.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { signals.timezone = null; }
  signals.timezone_offset = new Date().getTimezoneOffset();

  // Connection info
  try {
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      signals.connection = {
        effective_type: conn.effectiveType || null,
        downlink: conn.downlink ?? null,
        rtt: conn.rtt ?? null,
        save_data: conn.saveData ?? null,
      };
    }
  } catch { /* not available */ }

  // Feature support matrix
  const featureSupport: Record<string, boolean> = {
    supports_webrtc: typeof RTCPeerConnection !== 'undefined',
    supports_media_recorder: typeof MediaRecorder !== 'undefined',
    supports_webgl: false,
    supports_webgl2: false,
    supports_wasm: typeof WebAssembly !== 'undefined',
    supports_service_worker: 'serviceWorker' in navigator,
    supports_web_audio: typeof (window as any).AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined',
    supports_intersection_observer: typeof IntersectionObserver !== 'undefined',
    supports_web_crypto: !!(window.crypto && window.crypto.subtle),
    supports_shared_array_buffer: typeof SharedArrayBuffer !== 'undefined',
  };

  // WebGL detection + renderer extraction
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      featureSupport.supports_webgl = true;
      if (canvas.getContext('webgl2')) featureSupport.supports_webgl2 = true;
      const debugExt = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (debugExt) {
        signals.webgl_vendor = (gl as WebGLRenderingContext).getParameter(debugExt.UNMASKED_VENDOR_WEBGL) || null;
        signals.webgl_renderer = (gl as WebGLRenderingContext).getParameter(debugExt.UNMASKED_RENDERER_WEBGL) || null;
      }
    }
  } catch { /* WebGL not available */ }
  signals.feature_support = featureSupport;

  // Permissions state
  const permissionsState: Record<string, string> = {};
  if (navigator.permissions) {
    const permNames = ['camera', 'microphone', 'geolocation', 'notifications'];
    const results = await Promise.allSettled(
      permNames.map(async (name) => {
        try {
          const status = await navigator.permissions.query({ name: name as PermissionName });
          return { name, state: status.state };
        } catch { return { name, state: 'unsupported' }; }
      })
    );
    for (const result of results) {
      if (result.status === 'fulfilled') permissionsState[result.value.name] = result.value.state;
    }
  }
  signals.permissions_state = permissionsState;

  // Derived permission booleans
  if (permissionsState.camera === 'granted') signals.camera_permission_granted = true;
  else if (permissionsState.camera === 'denied') signals.camera_permission_granted = false;
  if (permissionsState.microphone === 'granted') signals.microphone_permission_granted = true;
  else if (permissionsState.microphone === 'denied') signals.microphone_permission_granted = false;

  // Document state
  signals.has_focus = document.hasFocus();
  signals.visibility_state = document.visibilityState;

  // Canvas fingerprint hash
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('UseSense', 2, 15);
      ctx.fillStyle = 'rgba(102,204,0,0.7)';
      ctx.fillText('UseSense', 4, 17);
      const dataUrl = canvas.toDataURL();
      let hash = 0;
      for (let i = 0; i < dataUrl.length; i++) {
        hash = ((hash << 5) - hash) + dataUrl.charCodeAt(i);
        hash |= 0;
      }
      signals.canvas_hash = hash;
    }
  } catch { /* no canvas */ }

  // Battery
  try {
    if ('getBattery' in navigator) {
      const battery = await (navigator as any).getBattery();
      signals.battery = { charging: battery.charging, level: battery.level };
    }
  } catch { /* not available */ }

  // Automation detection
  signals.automation_detected = !!(navigator as any).webdriver
    || !!(window as any).domAutomation
    || !!(window as any).domAutomationController
    || !!(window as any).callPhantom
    || !!(window as any)._phantom
    || !!(window as any).__nightmare
    || !!(document as any).__selenium_unwrapped
    || /HeadlessChrome/.test(navigator.userAgent);

  signals.collected_at = new Date().toISOString();
  console.log(`[CaptureEngine] Collected ${Object.keys(signals).length} web integrity signals`);
  return signals;
}

// ─── Direction helpers ────────────────────────────────────────────────────────

const DIRECTION_LABELS: Record<string, string> = {
  left: 'Turn LEFT',
  right: 'Turn RIGHT',
  up: 'Look UP',
  down: 'Look DOWN',
  center: 'Return to CENTER',
};

const DirectionArrow = ({ direction }: { direction: string }) => {
  const cls = 'w-10 h-10 text-white';
  switch (direction) {
    case 'left': return <ArrowLeft className={cls} />;
    case 'right': return <ArrowRight className={cls} />;
    case 'up': return <ArrowUp className={cls} />;
    case 'down': return <ArrowDown className={cls} />;
    case 'center': return <Crosshair className={cls} />;
    default: return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export function VerificationCaptureEngine({
  sessionData,
  environment,
  primaryColor = '#4f46e5',
  onComplete,
  onError,
  onPhaseChange,
}: VerificationCaptureEngineProps) {
  const [phase, setPhase] = useState<CapturePhase>('initializing');
  const [phaseLabel, setPhaseLabel] = useState('Initializing...');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [framesCollected, setFramesCollected] = useState(0);
  const [challengeDirection, setChallengeDirection] = useState('');
  const [dotPosition, setDotPosition] = useState<{ x: number; y: number } | null>(null);
  const [countdownNumber, setCountdownNumber] = useState<number | null>(null);

  // Real-time environment quality detection
  const [envWarnings, setEnvWarnings] = useState<{ type: 'dark' | 'bright' | 'blur'; label: string }[]>([]);
  const qualityCanvasRef = useRef<HTMLCanvasElement>(null);
  const qualityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const instructionsDismissRef = useRef<(() => void) | null>(null);
  const faceGuideReadyRef = useRef<(() => void) | null>(null);
  const webIntegrityRef = useRef<Record<string, any> | null>(null);
  const mountedRef = useRef(true);

  // Phase change broadcaster
  const updatePhase = useCallback((p: CapturePhase, label: string) => {
    if (!mountedRef.current) return;
    setPhase(p);
    setPhaseLabel(label);
    onPhaseChange?.(p, label);
  }, [onPhaseChange]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (qualityIntervalRef.current) {
        clearInterval(qualityIntervalRef.current);
        qualityIntervalRef.current = null;
      }
    };
  }, []);

  // Start engine on mount
  useEffect(() => {
    runCaptureFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // Main capture flow
  // ═══════════════════════════════════════════════════════════════════════════

  const runCaptureFlow = async () => {
    try {
      // 0. Collect web integrity signals in background
      collectWebIntegritySignals().then(s => { webIntegrityRef.current = s; });

      // 1. Request camera
      updatePhase('camera-request', 'Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        // Wait for the video to actually produce frames
        await new Promise<void>((resolve) => {
          const v = videoRef.current!;
          if (v.videoWidth > 0 && v.videoHeight > 0) { resolve(); return; }
          const check = () => {
            if (v.videoWidth > 0 && v.videoHeight > 0) {
              v.removeEventListener('loadeddata', check);
              v.removeEventListener('playing', check);
              resolve();
            }
          };
          v.addEventListener('loadeddata', check);
          v.addEventListener('playing', check);
          setTimeout(resolve, 3000);
        });
      }
      console.log('[CaptureEngine] Camera started, videoWidth=', videoRef.current?.videoWidth);

      // Patch permission signals after camera grant
      if (webIntegrityRef.current) {
        if (!webIntegrityRef.current.permissions_state) webIntegrityRef.current.permissions_state = {};
        webIntegrityRef.current.permissions_state.camera = 'granted';
        webIntegrityRef.current.camera_permission_granted = true;
      }

    } catch (err: any) {
      console.error('[CaptureEngine] Camera error:', err);
      if (webIntegrityRef.current) {
        if (!webIntegrityRef.current.permissions_state) webIntegrityRef.current.permissions_state = {};
        webIntegrityRef.current.permissions_state.camera = 'denied';
        webIntegrityRef.current.camera_permission_granted = false;
      }
      const msg = err.name === 'NotAllowedError'
        ? 'Camera access was denied. Please allow camera access and try again.'
        : err.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : `Camera error: ${err.message}`;
      setCameraError(msg);
      updatePhase('camera-error', msg);
      return;
    }

    // 2. Read policy
    const challengeSpec = sessionData.policy?.challenge;
    const audioChallenge = sessionData.policy?.audio_challenge;
    const hasChallenge = (challengeSpec && challengeSpec.type && challengeSpec.type !== 'none')
      || (audioChallenge && audioChallenge.type);
    const fps = sessionData.upload?.target_fps || 10;
    const intervalMs = Math.floor(1000 / fps);
    const maxFrames = sessionData.upload?.max_frames || 30;
    const BASELINE_DURATION_MS = 2000;

    const frames: Blob[] = [];
    let globalFrameIndex = 0;

    // ─── Global safety-net try-catch ──────────────────────────────────────
    // Everything after camera init is wrapped so that if ANY unexpected error
    // is thrown (DOM exception, undefined access, promise rejection, etc.)
    // we always fire onError rather than silently stranding the user.
    try {

    // Helpers
    const captureOneFrame = (): Promise<number> => {
      return new Promise((resolve) => {
        const idx = globalFrameIndex++;
        if (videoRef.current && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            canvasRef.current.width = videoRef.current.videoWidth || 640;
            canvasRef.current.height = videoRef.current.videoHeight || 480;
            ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
            canvasRef.current.toBlob((blob) => {
              if (blob) {
                frames.push(blob);
                if (mountedRef.current) {
                  setFramesCollected(frames.length);
                  setProgress(Math.round((frames.length / maxFrames) * 100));
                }
              }
              resolve(idx);
            }, 'image/jpeg', 0.8);
            return;
          }
        }
        resolve(idx);
      });
    };

    const captureForDuration = async (
      durationMs: number,
      onFrame?: (idx: number) => void,
    ): Promise<void> => {
      const phaseStart = Date.now();
      let framesCapturedInPhase = 0;
      while (Date.now() - phaseStart < durationMs && globalFrameIndex < maxFrames) {
        const idx = await captureOneFrame();
        onFrame?.(idx);
        framesCapturedInPhase++;
        const elapsed = Date.now() - phaseStart;
        const nextFrameTime = framesCapturedInPhase * intervalMs;
        const waitTime = nextFrameTime - elapsed;
        if (waitTime > 0) await new Promise(r => setTimeout(r, waitTime));
      }
    };

    // ═══ Phase 0: Instructions (if challenge issued) ═══
    if (hasChallenge) {
      const challengeType = challengeSpec?.type || audioChallenge?.type || 'liveness';
      const label = challengeType === 'follow_dot' ? 'Follow the Dot'
        : challengeType === 'head_turn' ? 'Head Turn'
        : challengeType === 'speak_phrase' ? 'Speak a Phrase'
        : 'Liveness Challenge';
      updatePhase('instructions', label);
      await new Promise<void>(resolve => { instructionsDismissRef.current = resolve; });
    }

    // ═══ Phase 0b: Face Guide ═══
    if (hasChallenge) {
      updatePhase('face-guide', 'Position your face in the oval');
      setChallengeDirection('');
      setDotPosition(null);
      await new Promise<void>(resolve => { faceGuideReadyRef.current = resolve; });
    }

    // ═══ Phase 1: Baseline ═══
    updatePhase('baseline', 'Hold still — looking at the camera');
    setChallengeDirection('');
    setDotPosition(null);
    await captureForDuration(BASELINE_DURATION_MS);
    const baselineFrameCount = globalFrameIndex;
    console.log(`[CaptureEngine] Baseline: ${baselineFrameCount} frames`);

    // ═══ Phase 1b: Countdown ═══
    let challengeResponse: any = null;

    if (hasChallenge) {
      updatePhase('countdown', 'Get ready...');
      for (let n = 3; n >= 1; n--) {
        if (mountedRef.current) setCountdownNumber(n);
        await captureForDuration(1000);
      }
      if (mountedRef.current) setCountdownNumber(null);
    }

    // ═══ Phase 2: Challenge ═══
    if (challengeSpec?.type === 'head_turn' && challengeSpec.sequence) {
      updatePhase('challenge', 'Head Turn');
      const stepFrames: Record<number, number[]> = {};
      const challengeStartTime = Date.now();

      for (const step of challengeSpec.sequence) {
        stepFrames[step.index] = [];
        const dirLabel = DIRECTION_LABELS[step.direction] || step.direction;
        if (mountedRef.current) setChallengeDirection(step.direction);
        setPhaseLabel(dirLabel);
        console.log(`[CaptureEngine] Head turn step ${step.index}: ${dirLabel} (${step.duration_ms}ms)`);

        await captureForDuration(step.duration_ms, (idx) => {
          stepFrames[step.index].push(idx);
        });

        const minRequired = challengeSpec.frames_per_step || 2;
        while (stepFrames[step.index].length < minRequired && globalFrameIndex < maxFrames) {
          const idx = await captureOneFrame();
          stepFrames[step.index].push(idx);
          await new Promise(r => setTimeout(r, intervalMs));
        }
      }

      challengeResponse = {
        type: 'head_turn',
        seed: challengeSpec.seed,
        completed: true,
        step_frames: stepFrames,
        started_at: new Date(challengeStartTime).toISOString(),
        completed_at: new Date().toISOString(),
      };

    } else if (challengeSpec?.type === 'follow_dot' && challengeSpec.waypoints) {
      updatePhase('challenge', 'Follow the Dot');
      const waypointFrames: Record<number, number[]> = {};
      const challengeStartTime = Date.now();

      for (const wp of challengeSpec.waypoints) {
        waypointFrames[wp.index] = [];
        if (mountedRef.current) setDotPosition({ x: wp.x, y: wp.y });
        setPhaseLabel('Follow the dot');
        console.log(`[CaptureEngine] Follow-dot waypoint ${wp.index}: (${wp.x}, ${wp.y}) for ${wp.duration_ms}ms`);

        await captureForDuration(wp.duration_ms, (idx) => {
          waypointFrames[wp.index].push(idx);
        });

        const minRequired = challengeSpec.frames_per_step || 2;
        while (waypointFrames[wp.index].length < minRequired && globalFrameIndex < maxFrames) {
          const idx = await captureOneFrame();
          waypointFrames[wp.index].push(idx);
          await new Promise(r => setTimeout(r, intervalMs));
        }
      }

      if (mountedRef.current) setDotPosition(null);
      challengeResponse = {
        type: 'follow_dot',
        seed: challengeSpec.seed,
        completed: true,
        waypoint_frames: waypointFrames,
        started_at: new Date(challengeStartTime).toISOString(),
        completed_at: new Date().toISOString(),
      };

    } else if (challengeSpec?.type === 'speak_phrase' || audioChallenge?.type === 'speak_phrase') {
      updatePhase('challenge', 'Say the phrase aloud');
      await captureForDuration(3000);
      const seed = challengeSpec?.seed || audioChallenge?.seed;
      challengeResponse = {
        type: 'speak_phrase',
        seed,
        completed: true,
        started_at: new Date(Date.now() - 3000).toISOString(),
        completed_at: new Date().toISOString(),
      };

    } else if (!hasChallenge) {
      // No challenge — capture remaining
      const remainingMs = Math.max(0, (sessionData.upload?.capture_duration_ms || 2500) - BASELINE_DURATION_MS);
      if (remainingMs > 0) {
        setPhaseLabel('Capturing...');
        await captureForDuration(remainingMs);
      }
    }

    // ═══ Stop camera ═══
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (mountedRef.current) {
      setChallengeDirection('');
      setDotPosition(null);
      setCountdownNumber(null);
    }

    console.log(`[CaptureEngine] Capture done: ${frames.length} frames (${baselineFrameCount} baseline + ${frames.length - baselineFrameCount} challenge)`);

    // ═══ Upload signals ═══
    updatePhase('uploading', `Uploading ${frames.length} frames...`);

    try {
      const formData = new FormData();
      frames.forEach((frame, i) => formData.append('frames[]', frame, `frame_${i}.jpg`));

      const metadata: any = {
        session_id: sessionData.session_id,
        sdk_version: '1.17.7',
        platform: 'web',
        source: 'hosted_page',
        capture_config: {
          captureDurationMs: sessionData.upload?.capture_duration_ms || 2500,
          targetFps: fps,
          maxFrames,
        },
        timestamps: {
          session_started_at_ms: Date.now() - 10000,
          capture_started_at_ms: Date.now() - 5000,
          capture_ended_at_ms: Date.now(),
        },
        frames_manifest: frames.map((_, i) => ({
          frame_index: i,
          capture_timestamp_ms: Date.now() - (frames.length - i) * intervalMs,
          resolution_w: 640,
          resolution_h: 480,
        })),
        channel_integrity: webIntegrityRef.current || await collectWebIntegritySignals(),
        ...(challengeResponse ? { challenge_response: challengeResponse } : {}),
      };

      // Enrich channel_integrity with capture-time signals
      const ci = metadata.channel_integrity;
      if (ci) {
        const vw = videoRef.current?.videoWidth || 640;
        const vh = videoRef.current?.videoHeight || 480;
        ci.camera_resolution = `${vw}x${vh}`;
        if (ci.camera_permission_granted === undefined && ci.permissions_state?.camera === 'granted') {
          ci.camera_permission_granted = true;
        }
        if (ci.microphone_permission_granted === undefined && ci.permissions_state?.microphone === 'granted') {
          ci.microphone_permission_granted = true;
        }
      }

      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');

      const nonceParam = sessionData.nonce ? `&nonce=${encodeURIComponent(sessionData.nonce)}` : '';
      const uploadUrl = `${API_BASE}/v1/sessions/${sessionData.session_id}/signals?env=${environment}${nonceParam}`;

      console.log(`[CaptureEngine] Uploading to ${uploadUrl}`);

      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Session-Token': sessionData.session_token,
          'X-Idempotency-Key': `${sessionData.session_id}_${Date.now()}`,
          ...(sessionData.nonce ? { 'X-Nonce': sessionData.nonce } : {}),
          'apikey': publicAnonKey,
        },
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        console.error('[CaptureEngine] Upload failed:', uploadData);
        throw new Error(uploadData.error?.message || 'Signal upload failed');
      }
      console.log('[CaptureEngine] Upload success:', uploadData);

    } catch (err: any) {
      console.error('[CaptureEngine] Upload error:', err);
      onError(`Upload failed: ${err.message}`);
      return;
    }

    // ═══ Complete session ═══
    updatePhase('completing', 'Processing verification...');

    try {
      const nonceParam = sessionData.nonce ? `&nonce=${encodeURIComponent(sessionData.nonce)}` : '';
      const completeUrl = `${API_BASE}/v1/sessions/${sessionData.session_id}/complete?env=${environment}${nonceParam}`;

      const completeRes = await fetch(completeUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Session-Token': sessionData.session_token,
          'X-Idempotency-Key': `${sessionData.session_id}_complete_${Date.now()}`,
          ...(sessionData.nonce ? { 'X-Nonce': sessionData.nonce } : {}),
          'apikey': publicAnonKey,
        },
      });

      const completeData = await completeRes.json();
      if (!completeRes.ok) {
        console.error('[CaptureEngine] Complete failed:', completeData);
        throw new Error(completeData.error?.message || completeData.error?.details || 'Session completion failed');
      }

      console.log('[CaptureEngine] Session complete:', completeData);
      updatePhase('done', 'Complete');
      onComplete(completeData);

    } catch (err: any) {
      console.error('[CaptureEngine] Complete error:', err);
      onError(`Verification failed: ${err.message}`);
    }
    } catch (err: any) {
      console.error('[CaptureEngine] Capture error:', err);
      onError(`Capture failed: ${err.message}`);
    }
  };

  // Retry camera
  const handleRetryCamera = () => {
    setCameraError(null);
    runCaptureFlow();
  };

  // Re-attach stream whenever the video element mounts
  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
    if (node && streamRef.current && node.srcObject !== streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // Real-time environment quality analyzer
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const shouldAnalyze = ['face-guide', 'baseline', 'countdown', 'challenge'].includes(phase);
    if (!shouldAnalyze) {
      if (qualityIntervalRef.current) {
        clearInterval(qualityIntervalRef.current);
        qualityIntervalRef.current = null;
      }
      setEnvWarnings([]);
      return;
    }

    const analyzeFrame = () => {
      const video = videoRef.current;
      const qCanvas = qualityCanvasRef.current;
      if (!video || !qCanvas || video.videoWidth === 0) return;

      const ctx = qCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const sw = 160, sh = 120;
      qCanvas.width = sw;
      qCanvas.height = sh;
      ctx.drawImage(video, 0, 0, sw, sh);

      const imageData = ctx.getImageData(0, 0, sw, sh);
      const data = imageData.data;
      const pixelCount = sw * sh;
      const warnings: { type: 'dark' | 'bright' | 'blur'; label: string }[] = [];

      // Brightness / Dark detection
      let totalLuminance = 0;
      let overexposedPixels = 0;
      const GLARE_THRESHOLD = 245;

      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        totalLuminance += lum;
        if (lum > GLARE_THRESHOLD) overexposedPixels++;
      }

      const avgLuminance = totalLuminance / pixelCount;

      if (avgLuminance < 45) {
        warnings.push({ type: 'dark', label: 'Too dark — move to a brighter area' });
      } else if (avgLuminance < 65) {
        warnings.push({ type: 'dark', label: 'Low light — try improving lighting' });
      }

      // Glare detection
      const glareRatio = overexposedPixels / pixelCount;
      if (glareRatio > 0.15) {
        warnings.push({ type: 'bright', label: 'Glare detected — avoid direct light' });
      } else if (avgLuminance > 210) {
        warnings.push({ type: 'bright', label: 'Too bright — reduce lighting' });
      }

      // Blur detection (Laplacian variance)
      const gray = new Float32Array(pixelCount);
      for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      }

      let laplacianSum = 0;
      let laplacianCount = 0;
      for (let y = 1; y < sh - 1; y++) {
        for (let x = 1; x < sw - 1; x++) {
          const idx = y * sw + x;
          const lap = 4 * gray[idx] - gray[idx - sw] - gray[idx + sw] - gray[idx - 1] - gray[idx + 1];
          laplacianSum += lap * lap;
          laplacianCount++;
        }
      }
      const laplacianVariance = laplacianSum / laplacianCount;

      if (laplacianVariance < 30) {
        warnings.push({ type: 'blur', label: 'Image blurry — hold camera steady' });
      } else if (laplacianVariance < 60) {
        warnings.push({ type: 'blur', label: 'Slightly blurry — try holding still' });
      }

      if (mountedRef.current) {
        setEnvWarnings(warnings);
      }
    };

    analyzeFrame();
    qualityIntervalRef.current = setInterval(analyzeFrame, 500);

    return () => {
      if (qualityIntervalRef.current) {
        clearInterval(qualityIntervalRef.current);
        qualityIntervalRef.current = null;
      }
    };
  }, [phase]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  const showCameraFeed = ['face-guide', 'baseline', 'countdown', 'challenge'].includes(phase);
  const showCountdown = phase === 'countdown' && countdownNumber !== null;
  const challengeSpec_r = sessionData.policy?.challenge;
  const challengeType_r = challengeSpec_r?.type || sessionData.policy?.audio_challenge?.type;

  const WarningIcon = ({ type }: { type: 'dark' | 'bright' | 'blur' }) => {
    switch (type) {
      case 'dark': return <Moon className="w-3.5 h-3.5" />;
      case 'bright': return <Sun className="w-3.5 h-3.5" />;
      case 'blur': return <Aperture className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="flex-1 relative bg-black overflow-hidden">
      {/* Persistent video + canvas (always mounted) */}
      <video
        ref={videoCallbackRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          showCameraFeed ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ transform: 'scaleX(-1)' }}
      />
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={qualityCanvasRef} className="hidden" />

      {/* Camera Error */}
      {phase === 'camera-error' && (
        <div className="absolute inset-0 flex items-center justify-center p-6 z-20">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/20">
              <Camera className="h-10 w-10 text-amber-400" />
            </div>
            <h2 className="text-xl text-white" style={{ fontWeight: 600 }}>Camera Access Required</h2>
            <p className="text-slate-300">{cameraError}</p>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-left border border-white/10">
              <p className="text-sm text-white mb-2" style={{ fontWeight: 500 }}>How to fix:</p>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>Check that your browser has permission to use the camera</li>
                <li>Make sure no other app is using the camera</li>
                <li>Try refreshing the page</li>
              </ul>
            </div>
            <button
              onClick={handleRetryCamera}
              className="w-full py-3 rounded-xl text-white shadow-md hover:shadow-lg transition-all"
              style={{ backgroundColor: primaryColor, fontWeight: 600 }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Initializing / Camera Request */}
      {(phase === 'initializing' || phase === 'camera-request') && (
        <div className="absolute inset-0 flex items-center justify-center p-6 z-20">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: primaryColor }} />
            <p className="text-white/80">{phaseLabel}</p>
          </div>
        </div>
      )}

      {/* Instructions (before challenge) */}
      {phase === 'instructions' && (
        <div className="absolute inset-0 flex items-center justify-center p-6 z-20">
          <div className="max-w-md w-full space-y-6 text-center">
            <h2 className="text-2xl text-white" style={{ fontWeight: 600 }}>{phaseLabel} Challenge</h2>
            <p className="text-slate-300" style={{ lineHeight: '1.625' }}>
              {challengeType_r === 'head_turn'
                ? 'You will be asked to turn your head in different directions. Follow the on-screen arrows.'
                : challengeType_r === 'follow_dot'
                  ? 'A dot will appear on screen. Follow it with your eyes while keeping your head relatively still.'
                  : challengeType_r === 'speak_phrase'
                    ? 'You will be asked to speak a short phrase out loud. Make sure your environment is quiet.'
                    : 'Follow the on-screen instructions to complete the liveness check.'}
            </p>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-sm text-white/80 border border-white/10">
              <p>Make sure you are in a well-lit area with your face clearly visible.</p>
            </div>
            <button
              onClick={() => instructionsDismissRef.current?.()}
              className="w-full py-4 rounded-xl text-white shadow-md hover:shadow-lg transition-all text-lg"
              style={{ backgroundColor: primaryColor, fontWeight: 600 }}
            >
              Got it — Start
            </button>
          </div>
        </div>
      )}

      {/* Face Guide */}
      {phase === 'face-guide' && (
        <>
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{
              backdropFilter: 'blur(18px) brightness(0.7)',
              WebkitBackdropFilter: 'blur(18px) brightness(0.7)',
              backgroundColor: 'rgba(255,255,255,0.08)',
              maskImage: 'radial-gradient(ellipse calc(min(70vw, 45vh, 320px) / 2) calc(min(93vw, 60vh, 420px) / 2) at center, transparent 99.5%, black 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse calc(min(70vw, 45vh, 320px) / 2) calc(min(93vw, 60vh, 420px) / 2) at center, transparent 99.5%, black 100%)',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div
              className="rounded-[50%] border-[3px] border-white/70"
              style={{
                width: 'min(70vw, 45vh, 320px)',
                height: 'min(93vw, 60vh, 420px)',
              }}
            />
          </div>
          {envWarnings.length > 0 && (
            <div className="absolute top-4 left-4 right-4 flex flex-col gap-2 z-20">
              {envWarnings.map((w, i) => (
                <div
                  key={`${w.type}-${i}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs backdrop-blur-sm ${
                    w.type === 'dark' ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30'
                    : w.type === 'bright' ? 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/30'
                    : 'bg-blue-500/20 text-blue-200 border border-blue-500/30'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  <WarningIcon type={w.type} />
                  {w.label}
                </div>
              ))}
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-6 pb-6 pt-20 text-center z-20">
            <p className="text-white text-base sm:text-lg mb-5" style={{ fontWeight: 500 }}>Position your face inside the oval</p>
            <button
              onClick={() => faceGuideReadyRef.current?.()}
              className="px-10 py-3.5 rounded-xl text-white shadow-lg hover:shadow-xl transition-all text-base"
              style={{ backgroundColor: primaryColor, fontWeight: 600 }}
            >
              I'm Ready
            </button>
          </div>
        </>
      )}

      {/* Uploading / Completing / Done (keep spinner visible until parent unmounts) */}
      {(phase === 'uploading' || phase === 'completing' || phase === 'done') && (
        <div className="absolute inset-0 flex items-center justify-center p-6 z-20 bg-slate-950/95">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/20 mx-auto" style={{ borderTopColor: primaryColor }} />
            <h2 className="text-xl text-white" style={{ fontWeight: 600 }}>
              {phase === 'uploading' ? 'Verifying your presence' : 'Almost done'}
            </h2>
            <p className="text-slate-300">
              {phase === 'uploading'
                ? 'Please wait while we securely process your session...'
                : 'Finishing up — this will only take a moment.'}
            </p>
          </div>
        </div>
      )}

      {/* Active capture overlays (baseline, countdown, challenge) */}
      {showCameraFeed && phase !== 'face-guide' && (
        <>
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{
              backdropFilter: 'blur(14px) brightness(0.75)',
              WebkitBackdropFilter: 'blur(14px) brightness(0.75)',
              backgroundColor: 'rgba(0,0,0,0.05)',
              maskImage: 'radial-gradient(ellipse calc(min(70vw, 45vh, 320px) / 2) calc(min(93vw, 60vh, 420px) / 2) at center, transparent 99.5%, black 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse calc(min(70vw, 45vh, 320px) / 2) calc(min(93vw, 60vh, 420px) / 2) at center, transparent 99.5%, black 100%)',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div
              className="rounded-[50%] border-[3px] border-white/40"
              style={{
                width: 'min(70vw, 45vh, 320px)',
                height: 'min(93vw, 60vh, 420px)',
              }}
            />
          </div>

          {envWarnings.length > 0 && (
            <div className="absolute top-14 left-4 right-4 flex flex-col gap-1.5 z-20 pointer-events-none">
              {envWarnings.map((w, i) => (
                <div
                  key={`${w.type}-${i}`}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs backdrop-blur-sm w-fit ${
                    w.type === 'dark' ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30'
                    : w.type === 'bright' ? 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/30'
                    : 'bg-blue-500/20 text-blue-200 border border-blue-500/30'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  <WarningIcon type={w.type} />
                  {w.label}
                </div>
              ))}
            </div>
          )}

          {/* Countdown overlay */}
          {showCountdown && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="text-8xl text-white/90 drop-shadow-2xl animate-pulse" style={{ fontWeight: 700 }}>
                {countdownNumber}
              </div>
            </div>
          )}

          {/* Follow-dot overlay */}
          {dotPosition && (
            <div
              className="absolute w-6 h-6 rounded-full bg-red-500 shadow-lg shadow-red-500/50 z-10 transition-all duration-300"
              style={{
                left: `${dotPosition.x * 100}%`,
                top: `${dotPosition.y * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}

          {/* Head turn direction arrow */}
          {phase === 'challenge' && challengeDirection && !dotPosition && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="bg-black/60 rounded-2xl p-6 flex flex-col items-center gap-2">
                <DirectionArrow direction={challengeDirection} />
                <span className="text-white text-sm" style={{ fontWeight: 500 }}>
                  {DIRECTION_LABELS[challengeDirection] || challengeDirection}
                </span>
              </div>
            </div>
          )}

          {/* Recording indicator */}
          <div className="absolute top-4 right-4 bg-black/60 rounded-lg px-3 py-1.5 flex items-center gap-2 z-20">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-xs font-mono">Verifying</span>
          </div>

          {/* Bottom instruction + progress */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-6 pb-5 pt-14 z-10">
            <p className="text-white text-base sm:text-lg text-center mb-3" style={{ fontWeight: 500 }}>
              {phaseLabel}
            </p>
            <div className="w-full max-w-sm mx-auto bg-white/20 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full transition-all duration-200 rounded-full"
                style={{ width: `${progress}%`, backgroundColor: primaryColor }}
              />
            </div>
            <p className="text-white/50 text-[11px] text-center mt-2">
              {phase === 'baseline' ? 'Hold still — looking straight ahead'
                : phase === 'countdown' ? 'Get ready...'
                : phase === 'challenge' ? 'Follow the instructions'
                : 'Verifying...'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}