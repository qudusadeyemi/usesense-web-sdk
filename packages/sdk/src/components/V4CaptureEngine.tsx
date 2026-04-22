/**
 * LiveSense v4 capture engine (web).
 *
 * Phase 1 tickets X-5 (phase machine) + X-7 (end-to-end wiring).
 *
 * A dedicated v4 React component that drives the perspective-distortion
 * flow end-to-end:
 *
 *   intro -> camera -> face-guide -> zoom -> uploading -> completing -> done
 *
 * v3's VerificationCaptureEngine is untouched. Customers opt into v4 by
 * using this component instead; both ship from the same package.
 *
 * The v4 flow differs from v3:
 *   - Skips baseline, SNR, challenge, step-up. Zoom is the only signal.
 *   - Captures 30fps for ~1.5s via V4FrameCapture (X-4).
 *   - Chains frame hashes via HashChainBuilder (X-6).
 *   - Signs the terminal with WebAuthn platform authenticator or an
 *     ephemeral IndexedDB key (EphemeralKeySigner).
 *   - Uploads with chain_signature + frame_hashes metadata.
 *   - Reads the opaque verdict from POST /v1/sessions/:id/result.
 *   - NEVER exposes sub-scores or pillar verdicts to the caller.
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { CaptureSessionData, Environment } from '../types';
import { getEngineStyles, USESENSE_FONTS_URL } from './styles';
import { ZoomPrompt, type ZoomOvalState } from './ZoomPrompt';
import {
  ZoomMotionController,
  type ZoomFailureReason,
  type FaceBoundingBox,
  type HeadPoseDegrees,
} from '../capture/zoom-motion';
import { V4FrameCapture, type V4CapturedFrame } from '../capture/v4-capture';
import {
  HashChainBuilder,
  buildChainUploadPayload,
  createChainSigner,
  type ChainSigner,
  type ChainUploadPayload,
} from '../capture/hash-chain';
import { initFaceMesh, evaluateFaceGuide, extractFrameSignal } from '../capture/media-pipe';
import { getCameraErrorMessage } from '../utils/errors';
import { MediaPipeModelInfo } from '../mediapipe-model-info';

// ─── Types ──────────────────────────────────────────────────────────────────

export type V4Phase =
  | 'intro'
  | 'initializing'
  | 'camera-request'
  | 'face-guide'
  | 'zoom'
  | 'uploading'
  | 'completing'
  | 'done'
  | 'error';

export interface V4Verdict {
  session_id: string;
  verdict: 'pass' | 'fail' | 'review';
  confidence: 'high' | 'medium' | 'low';
  assurance_level_achieved: 'mobile_hardware' | 'web_attested' | 'web_unattested';
  capture_channel: 'web';
  match_sense_embedding_id: string | null;
  timestamp: string;
}

export interface V4CaptureEngineProps {
  /** Session data returned from create-session or exchange-token. MUST be v4. */
  sessionData: CaptureSessionData;
  environment?: Environment;
  apiBaseUrl?: string;
  primaryColor?: string;
  logoUrl?: string;
  displayName?: string;
  /** Fires exactly once with the opaque verdict from the server. */
  onComplete: (result: V4Verdict) => void;
  /** Fires on fatal errors that cannot be recovered by retry. */
  onError: (error: string) => void;
  onCancel?: () => void;
  onPhaseChange?: (phase: V4Phase) => void;
  /**
   * Optional pre-registered WebAuthn credential. When provided and
   * platform authenticator is available, signs with WebAuthn. Otherwise
   * falls back to an ephemeral IndexedDB key (web_unattested).
   */
  webauthnCredentialId?: ArrayBuffer;
  webauthnRpId?: string;
  webauthnPublicKeySpki?: Uint8Array;
}

const DEFAULT_API_BASE = 'https://api.usesense.ai/v1';
const DEFAULT_PRIMARY = '#4F7CFF';
const SDK_VERSION = '4.2.0-v4';

// ─── Component ──────────────────────────────────────────────────────────────

export function V4CaptureEngine(props: V4CaptureEngineProps) {
  const {
    sessionData,
    environment = 'production',
    apiBaseUrl = DEFAULT_API_BASE,
    primaryColor = DEFAULT_PRIMARY,
    displayName,
    onComplete,
    onError,
    onCancel,
    onPhaseChange,
  } = props;

  const [phase, setPhase] = useState<V4Phase>('intro');
  const [guidance, setGuidance] = useState<string>('Fit your face in the oval');
  const [ovalState, setOvalState] = useState<ZoomOvalState>('framing');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const motionCtrlRef = useRef<ZoomMotionController | null>(null);
  const capCtrlRef = useRef<V4FrameCapture | null>(null);
  const chainBuilderRef = useRef<HashChainBuilder | null>(null);
  const signerRef = useRef<ChainSigner | null>(null);

  const transition = useCallback(
    (next: V4Phase, note?: string) => {
      setPhase(next);
      if (note) setGuidance(note);
      onPhaseChange?.(next);
    },
    [onPhaseChange],
  );

  // ── Setup: MediaPipe + camera ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        transition('initializing', 'Initialising');
        await initFaceMesh();
        if (cancelled) return;
        transition('camera-request', 'Requesting camera');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        transition('face-guide', 'Fit your face in the oval');
      } catch (err: any) {
        const msg = getCameraErrorMessage(err) || err?.message || 'Initialisation failed';
        setErrorMsg(msg);
        transition('error');
        onError(msg);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Face-guide loop: wait for stable face, then advance to zoom ─────────
  useEffect(() => {
    if (phase !== 'face-guide') return;
    let stable = 0;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (!videoRef.current) return;
      const status = await evaluateFaceGuide(videoRef.current);
      if (status.ready) {
        stable += 1;
        if (stable >= 8) {
          setOvalState('enlarged');
          transition('zoom', 'Move phone closer to fill the new oval');
          return;
        }
      } else {
        stable = 0;
        setGuidance(status.message || 'Fit your face in the oval');
      }
      setTimeout(tick, 250);
    };
    tick();
    return () => { cancelled = true; };
  }, [phase, transition]);

  // ── Zoom phase: drive controller, V4FrameCapture, hash chain ────────────
  useEffect(() => {
    if (phase !== 'zoom') return;
    let cancelled = false;
    (async () => {
      const video = videoRef.current;
      if (!video) return;

      // Try to lock exposure and white balance (best-effort; browsers vary).
      try {
        const track = streamRef.current?.getVideoTracks?.()[0];
        const caps: any = (track?.getCapabilities?.() as any) || {};
        if (caps.exposureMode && typeof track?.applyConstraints === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (track.applyConstraints as any)({ advanced: [{ exposureMode: 'manual' }] })
            .catch(() => undefined);
        }
      } catch {
        // best-effort; silently ignore
      }

      const motion = new ZoomMotionController();
      motionCtrlRef.current = motion;
      const cap = new V4FrameCapture(video);
      capCtrlRef.current = cap;
      const builder = new HashChainBuilder(sessionData.session_token);
      chainBuilderRef.current = builder;

      // Fan frames through: each captured frame appends to the chain.
      cap.on(async (frame: V4CapturedFrame) => {
        try {
          await builder.appendWithHash(frame.hash);
        } catch (err) {
          console.warn('[v4] chain append failed', err);
        }
      });

      // Observe for zoom-motion state transitions.
      motion.on((next, _prev, _stats, failure) => {
        if (next === 'complete') {
          cap.stop();
        } else if (next === 'failed') {
          cap.stop();
          handleZoomFailure(failure);
        }
      });
      motion.start();

      // Observation loop from MediaPipe landmarks.
      const obsLoop = async () => {
        while (!cancelled && motion.getState() === 'watching') {
          await new Promise((r) => setTimeout(r, 33));
        }
        while (!cancelled && (motion.getState() === 'watching' || motion.getState() === 'moving')) {
          if (!videoRef.current) break;
          let signal: any = null;
          try {
            // extractFrameSignal is synchronous but accepts (video, idx, phase).
            signal = extractFrameSignal(videoRef.current, 0, 'challenge');
          } catch {
            signal = null;
          }
          if (signal && signal.bbox) {
            const bbox: FaceBoundingBox = {
              cx: signal.bbox.x + (signal.bbox.w ?? signal.bbox.width ?? 0) / 2,
              cy: signal.bbox.y + (signal.bbox.h ?? signal.bbox.height ?? 0) / 2,
              w: signal.bbox.w ?? signal.bbox.width ?? 0,
              h: signal.bbox.h ?? signal.bbox.height ?? 0,
            };
            const pose: HeadPoseDegrees = {
              yaw: signal.headPose?.yaw ?? 0,
              pitch: signal.headPose?.pitch ?? 0,
              roll: signal.headPose?.roll ?? 0,
            };
            motion.observe({ timestampMs: performance.now(), bbox, headPose: pose });
          }
          await new Promise((r) => setTimeout(r, 33));
        }
      };

      // Kick observation in parallel with capture.
      obsLoop();
      await cap.run();
      if (cancelled) return;

      if (motion.getState() !== 'complete') {
        // Already handled by the failure listener.
        return;
      }

      // Build the chain signer (WebAuthn if configured, else ephemeral).
      try {
        const signer = await createChainSigner({
          sessionId: sessionData.session_id,
          webauthnCredentialId: props.webauthnCredentialId,
          webauthnRpId: props.webauthnRpId,
          webauthnPublicKeySpki: props.webauthnPublicKeySpki,
        });
        signerRef.current = signer;

        transition('uploading', 'Uploading');

        const chainPayload = await buildChainUploadPayload(builder, signer);
        const verdict = await uploadAndFetchResult(
          sessionData,
          environment,
          apiBaseUrl,
          chainPayload,
          cap.getFrames(),
          motion.stats(),
        );
        if (cancelled) return;
        transition('done', 'Done');
        onComplete(verdict);
      } catch (err: any) {
        const msg = err?.message || 'Upload failed';
        setErrorMsg(msg);
        transition('error');
        onError(msg);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleZoomFailure = useCallback(
    (reason: ZoomFailureReason | undefined) => {
      const msg =
        reason === 'timeout'
          ? 'You did not complete the motion in time. Try again.'
          : reason === 'head_turn'
            ? 'Please keep your head facing the camera.'
            : reason === 'no_motion'
              ? 'Move the phone closer to fit the new oval.'
              : reason === 'face_lost'
                ? 'Keep your face in view.'
                : 'Capture failed. Try again.';
      setErrorMsg(msg);
      transition('error');
      onError(msg);
    },
    [onError, transition],
  );

  // ── Render ──────────────────────────────────────────────────────────────

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: '100vh',
      background: '#1C1A17',
      color: '#FFFFFF',
      fontFamily: "'DM Sans', sans-serif",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }),
    [],
  );

  return (
    <div className="usesense-v4-engine" style={containerStyle} data-sdk-version={SDK_VERSION}>
      <style>{getEngineStyles(primaryColor)}</style>
      <link rel="stylesheet" href={USESENSE_FONTS_URL} />

      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
          zIndex: 1,
          display: phase === 'face-guide' || phase === 'zoom' ? 'block' : 'none',
        }}
      />

      {(phase === 'face-guide' || phase === 'zoom') && (
        <ZoomPrompt state={ovalState} guidance={guidance} primaryColor={primaryColor} />
      )}

      {phase === 'intro' && (
        <div style={{ textAlign: 'center', zIndex: 5, padding: 24 }}>
          {displayName ? <div style={{ opacity: 0.8, marginBottom: 8 }}>{displayName}</div> : null}
          <h2 style={{ margin: 0, marginBottom: 12 }}>Identity check</h2>
          <p style={{ margin: 0, marginBottom: 24, opacity: 0.8 }}>
            We will guide you through a quick motion check. It takes a few seconds.
          </p>
          <button
            onClick={() => transition('initializing', 'Initialising')}
            style={primaryBtn(primaryColor)}
          >
            Start
          </button>
          {onCancel ? (
            <button onClick={onCancel} style={secondaryBtn}>Cancel</button>
          ) : null}
        </div>
      )}

      {(phase === 'initializing' || phase === 'camera-request' || phase === 'uploading' || phase === 'completing') && (
        <div style={{ textAlign: 'center', zIndex: 5 }}>
          <div style={spinnerStyle} />
          <div style={{ marginTop: 16 }}>{guidance}</div>
        </div>
      )}

      {phase === 'error' && (
        <div style={{ textAlign: 'center', zIndex: 5, padding: 24 }}>
          <h3 style={{ marginBottom: 12 }}>Verification failed</h3>
          <p style={{ opacity: 0.8, marginBottom: 24 }}>{errorMsg}</p>
          {onCancel ? <button onClick={onCancel} style={secondaryBtn}>Close</button> : null}
        </div>
      )}
    </div>
  );
}

// ─── Upload + result fetch ──────────────────────────────────────────────────

async function uploadAndFetchResult(
  session: CaptureSessionData,
  environment: Environment,
  apiBaseUrl: string,
  chain: ChainUploadPayload,
  frames: V4CapturedFrame[],
  motionStats: {
    startBbox: FaceBoundingBox | null;
    endBbox: FaceBoundingBox | null;
    scaleRatio: number;
    durationMs: number;
    maxHeadYawAbsDeg: number;
    maxHeadPitchAbsDeg: number;
    observationCount: number;
  },
): Promise<V4Verdict> {
  const assuranceLevel = chain.assuranceLevel;
  const metadata = {
    session_id: session.session_id,
    sdk_version: SDK_VERSION,
    platform: 'web',
    source: 'sdk-v4',
    assurance_level: assuranceLevel,
    frame_hashes: chain.frameHashes,
    terminal_hash_hex: chain.terminalHashHex,
    chain_signature_b64: chain.signatureB64,
    public_key_spki_b64: chain.publicKeySpkiB64,
    zoom_motion_stats: {
      scale_ratio: motionStats.scaleRatio,
      duration_ms: motionStats.durationMs,
      max_head_yaw_abs_deg: motionStats.maxHeadYawAbsDeg,
      max_head_pitch_abs_deg: motionStats.maxHeadPitchAbsDeg,
      observation_count: motionStats.observationCount,
    },
    frames_manifest: frames.map((f) => ({
      frame_index: f.index,
      capture_timestamp_ms: f.timestampMs,
      resolution_w: f.resolution.w,
      resolution_h: f.resolution.h,
    })),
  };

  const form = new FormData();
  for (const f of frames) {
    const blob = new Blob([f.bytes as unknown as BlobPart], { type: 'image/jpeg' });
    form.append('frames[]', blob, `frame-${f.index}.jpg`);
  }
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');

  const uploadUrl =
    `${apiBaseUrl.replace(/\/$/, '')}/sessions/${encodeURIComponent(session.session_id)}/signals` +
    `?env=${encodeURIComponent(environment)}` +
    `&nonce=${encodeURIComponent(session.nonce)}`;
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'x-session-token': session.session_token,
      'x-nonce': session.nonce,
      'x-environment': environment,
      'x-idempotency-key': crypto.randomUUID(),
      'x-usesense-sdk-version': 'v4',
      'x-usesense-mediapipe-model-version': MediaPipeModelInfo.versionLabel,
    },
    body: form,
  });
  if (!uploadRes.ok) {
    throw new Error(`upload failed (${uploadRes.status})`);
  }

  // Fetch the v4 opaque result.
  const resultUrl =
    `${apiBaseUrl.replace(/\/$/, '')}/sessions/${encodeURIComponent(session.session_id)}/result` +
    `?env=${encodeURIComponent(environment)}` +
    `&nonce=${encodeURIComponent(session.nonce)}`;
  const resultRes = await fetch(resultUrl, {
    method: 'POST',
    headers: {
      'x-session-token': session.session_token,
      'x-nonce': session.nonce,
      'x-environment': environment,
      'x-usesense-sdk-version': 'v4',
    },
  });
  if (!resultRes.ok) {
    throw new Error(`result fetch failed (${resultRes.status})`);
  }
  return (await resultRes.json()) as V4Verdict;
}

// ─── Styling helpers ────────────────────────────────────────────────────────

const primaryBtn = (c: string): React.CSSProperties => ({
  background: c,
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '12px 28px',
  fontWeight: 600,
  fontSize: 16,
  cursor: 'pointer',
  marginRight: 12,
});

const secondaryBtn: React.CSSProperties = {
  background: 'transparent',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.4)',
  borderRadius: 10,
  padding: '12px 28px',
  fontWeight: 500,
  fontSize: 16,
  cursor: 'pointer',
};

const spinnerStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  border: '3px solid rgba(255,255,255,0.2)',
  borderTopColor: '#fff',
  borderRadius: '50%',
  animation: 'usesense-spin 1s linear infinite',
  margin: '0 auto',
};
