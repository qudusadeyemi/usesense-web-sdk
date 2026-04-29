'use client';

/**
 * <DocumentCapture/> -- standalone document camera component.
 *
 * Renders a fullscreen camera preview with an aspect-correct cutout
 * matching the requested document type. Provides a shutter button that
 * is gated by a brightness + sharpness stability check.
 *
 * Output: a prepared JPEG Blob via `onCapture`. Caller is responsible
 * for handing it to `submitDocumentImage`.
 *
 * This component does NOT call the API. It is the camera surface only,
 * mirroring the separation between `prepareDocumentImage` (pure) and
 * `submitDocumentImage` (HTTP).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import {
  prepareDocumentImage,
  DocumentImageTooLargeError,
} from './prepare-document-image';
import type { DocumentType, DocumentSide } from './documents';
import {
  aspectRatioForDocument,
  brightnessFromGray,
  computeFrameRect,
  isStable,
  pickInitialMode,
  sharpnessFromGray,
  STABILITY_THRESHOLDS,
  validateUploadFile,
} from './document-capture-helpers';
import type { CaptureMode, StabilityMetrics } from './document-capture-helpers';

const SAMPLE_INTERVAL_MS = 250;
const SAMPLE_LONG_EDGE_PX = 160;
const FRAME_PADDING_PX = 32;

export interface DocumentCaptureProps {
  documentType: DocumentType;
  side: DocumentSide;
  primaryColor?: string;
  /**
   * Force a specific input mode. If omitted, picks based on environment
   * (camera on mobile when available, upload on desktop).
   */
  mode?: CaptureMode;
  /** Called with the prepared JPEG blob and the side it represents. */
  onCapture: (blob: Blob, side: DocumentSide) => void;
  onCancel?: () => void;
  onError?: (message: string) => void;
}

type CaptureState =
  | { phase: 'requesting-camera' }
  | { phase: 'ready' }
  | { phase: 'capturing' }
  | { phase: 'preparing' }
  | { phase: 'error'; message: string };

export function DocumentCapture(props: DocumentCaptureProps) {
  const {
    documentType,
    side,
    primaryColor = '#4F7CFF',
    mode: modeProp,
    onCapture,
    onCancel,
    onError,
  } = props;

  // ── Mode (camera | upload) ────────────────────────────────────────────────
  // Defer environment detection to first render so SSR doesn't crash.
  const [mode, setMode] = useState<CaptureMode>(() => {
    if (modeProp) return modeProp;
    if (typeof navigator === 'undefined') return 'upload';
    const hasCamera = Boolean(navigator.mediaDevices?.getUserMedia);
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    return pickInitialMode({ hasCamera, isMobile });
  });
  // If the parent overrides the mode after mount, honor it.
  useEffect(() => {
    if (modeProp) setMode(modeProp);
  }, [modeProp]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [state, setState] = useState<CaptureState>(() =>
    mode === 'upload' ? { phase: 'ready' } : { phase: 'requesting-camera' },
  );
  const [metrics, setMetrics] = useState<StabilityMetrics>({ brightness: 0, sharpness: 0 });
  const [viewport, setViewport] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const aspectRatio = useMemo(() => aspectRatioForDocument(documentType), [documentType]);
  const stable = useMemo(() => isStable(metrics, STABILITY_THRESHOLDS), [metrics]);

  // ── Camera lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'camera') return;
    let cancelled = false;
    setState({ phase: 'requesting-camera' });
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setState({ phase: 'ready' });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState({ phase: 'error', message });
        onError?.(message);
      }
    }
    start();
    return () => {
      cancelled = true;
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [mode, onError]);

  // ── Viewport tracking ─────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      const el = containerRef.current;
      if (!el) return;
      setViewport({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Stability sampling loop ───────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'camera') return;
    if (state.phase !== 'ready') return;
    let cancelled = false;
    const sample = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;
      const sw = video.videoWidth;
      const sh = video.videoHeight;
      const scale = SAMPLE_LONG_EDGE_PX / Math.max(sw, sh);
      const tw = Math.max(3, Math.round(sw * scale));
      const th = Math.max(3, Math.round(sh * scale));

      let canvas = sampleCanvasRef.current;
      if (!canvas) {
        canvas = document.createElement('canvas');
        sampleCanvasRef.current = canvas;
      }
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, tw, th);
      const { data } = ctx.getImageData(0, 0, tw, th);

      // Convert RGBA to grayscale luminance (Rec. 601).
      const gray = new Uint8ClampedArray(tw * th);
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        gray[j] = Math.round(
          0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!,
        );
      }

      setMetrics({
        brightness: brightnessFromGray(gray),
        sharpness: sharpnessFromGray(gray, tw, th),
      });
    };
    const id = window.setInterval(sample, SAMPLE_INTERVAL_MS);
    sample();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [mode, state.phase]);

  // ── Shutter ───────────────────────────────────────────────────────────────
  const handleShutter = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setState({ phase: 'capturing' });
    try {
      const sw = video.videoWidth;
      const sh = video.videoHeight;
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas 2D context unavailable');
      ctx.drawImage(video, 0, 0, sw, sh);
      const rawBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.95),
      );
      if (!rawBlob) throw new Error('failed to encode capture');

      setState({ phase: 'preparing' });
      const prepared = await prepareDocumentImage({ source: rawBlob });
      onCapture(prepared.blob, side);
      setState({ phase: 'ready' });
    } catch (err) {
      if (err instanceof DocumentImageTooLargeError) {
        const message = 'Image too large after compression. Try better lighting or a closer shot.';
        setState({ phase: 'error', message });
        onError?.(message);
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      setState({ phase: 'error', message });
      onError?.(message);
    }
  }, [onCapture, onError]);

  // ── Upload path ───────────────────────────────────────────────────────────
  const handleFile = useCallback(
    async (file: File) => {
      const v = validateUploadFile(file);
      if (!v.ok) {
        setState({ phase: 'error', message: v.reason });
        onError?.(v.reason);
        return;
      }
      setState({ phase: 'preparing' });
      try {
        const prepared = await prepareDocumentImage({ source: file });
        onCapture(prepared.blob, side);
        setState({ phase: 'ready' });
      } catch (err) {
        if (err instanceof DocumentImageTooLargeError) {
          const message = 'Image too large. Try a smaller file.';
          setState({ phase: 'error', message });
          onError?.(message);
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setState({ phase: 'error', message });
        onError?.(message);
      }
    },
    [onCapture, onError, side],
  );

  // ── Layout ────────────────────────────────────────────────────────────────
  const frameRect = useMemo(() => {
    if (viewport.width === 0 || viewport.height === 0) return null;
    return computeFrameRect({
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      aspectRatio,
      paddingPx: FRAME_PADDING_PX,
    });
  }, [viewport, aspectRatio]);

  const hint = pickHint(state, metrics, side, documentType, mode);
  const shutterEnabled = state.phase === 'ready' && stable;
  const showToggle = !modeProp;

  return (
    <div ref={containerRef} style={styles.root}>
      {mode === 'camera' ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={styles.video}
          />
          {frameRect && (
            <FrameCutout
              rect={frameRect}
              viewport={viewport}
              stable={stable}
              primaryColor={primaryColor}
            />
          )}
        </>
      ) : (
        <div style={styles.uploadBackdrop} />
      )}

      <div style={styles.topBar}>
        {onCancel ? (
          <button onClick={onCancel} style={styles.cancelBtn} aria-label="Cancel">
            ×
          </button>
        ) : (
          <div style={{ width: 40 }} />
        )}
        <div style={styles.title}>
          {labelForDocument(documentType)} · {side}
        </div>
        <div style={{ width: 40 }} />
      </div>

      {showToggle && (
        <div style={styles.modeToggle}>
          <button
            type="button"
            onClick={() => setMode('camera')}
            style={styles.modeBtn(mode === 'camera', primaryColor)}
            aria-pressed={mode === 'camera'}
          >
            Camera
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            style={styles.modeBtn(mode === 'upload', primaryColor)}
            aria-pressed={mode === 'upload'}
          >
            Upload
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          // Allow re-selecting the same file later.
          e.target.value = '';
        }}
      />

      <div style={styles.bottomBar}>
        <div style={styles.hint}>{hint}</div>
        {mode === 'camera' ? (
          <button
            onClick={handleShutter}
            disabled={!shutterEnabled}
            aria-label="Take photo"
            style={styles.shutter(shutterEnabled, primaryColor)}
          >
            <span style={styles.shutterInner(shutterEnabled, primaryColor)} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={state.phase === 'preparing'}
            style={styles.uploadCta(primaryColor, state.phase === 'preparing')}
          >
            {state.phase === 'preparing' ? 'Preparing…' : 'Choose image'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Frame overlay subcomponent ────────────────────────────────────────────

interface FrameCutoutProps {
  rect: { x: number; y: number; width: number; height: number };
  viewport: { width: number; height: number };
  stable: boolean;
  primaryColor: string;
}

function FrameCutout({ rect, viewport, stable, primaryColor }: FrameCutoutProps) {
  const borderColor = stable ? primaryColor : 'rgba(255,255,255,0.85)';
  return (
    <svg
      width={viewport.width}
      height={viewport.height}
      style={styles.overlaySvg}
      aria-hidden
    >
      <defs>
        <mask id="document-cutout">
          <rect width="100%" height="100%" fill="white" />
          <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={14} fill="black" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#document-cutout)" />
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        rx={14}
        fill="none"
        stroke={borderColor}
        strokeWidth={3}
      />
    </svg>
  );
}

// ── Hint copy ─────────────────────────────────────────────────────────────

function pickHint(
  state: CaptureState,
  metrics: StabilityMetrics,
  side: DocumentSide,
  type: DocumentType,
  mode: CaptureMode,
): string {
  if (state.phase === 'error') return state.message;
  if (state.phase === 'preparing') return 'Preparing image...';
  if (mode === 'upload') {
    return `Choose a photo of the ${side} of your ${labelForDocument(type).toLowerCase()}`;
  }
  if (state.phase === 'requesting-camera') return 'Requesting camera...';
  if (state.phase === 'capturing') return 'Capturing...';
  if (metrics.brightness < STABILITY_THRESHOLDS.minBrightness) {
    return 'Too dark — find better lighting';
  }
  if (metrics.brightness > STABILITY_THRESHOLDS.maxBrightness) {
    return 'Too bright — reduce glare';
  }
  if (metrics.sharpness < STABILITY_THRESHOLDS.minSharpness) {
    return 'Hold still — image is blurry';
  }
  return `Fit the ${side} of your ${labelForDocument(type).toLowerCase()} inside the frame`;
}

function labelForDocument(type: DocumentType): string {
  switch (type) {
    case 'identity':
      return 'ID card';
    case 'passport':
      return 'Passport';
    case 'organization':
      return 'business document';
    case 'address':
      return 'proof of address';
  }
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = {
  root: {
    position: 'fixed',
    inset: 0,
    background: '#000',
    overflow: 'hidden',
    fontFamily: "'DM Sans', sans-serif",
  } as CSSProperties,
  video: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } as CSSProperties,
  overlaySvg: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  } as CSSProperties,
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 16px env(safe-area-inset-top, 16px)',
    color: '#fff',
  } as CSSProperties,
  title: {
    fontSize: '0.95rem',
    fontWeight: 600,
    textTransform: 'capitalize',
  } as CSSProperties,
  cancelBtn: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(0,0,0,0.5)',
    color: '#fff',
    fontSize: 22,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as CSSProperties,
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 'env(safe-area-inset-bottom, 24px)',
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  } as CSSProperties,
  hint: {
    color: '#fff',
    fontSize: '0.88rem',
    fontWeight: 500,
    textAlign: 'center',
    background: 'rgba(0,0,0,0.45)',
    padding: '8px 14px',
    borderRadius: 999,
    maxWidth: '85%',
  } as CSSProperties,
  shutter: (enabled: boolean, color: string): CSSProperties => ({
    width: 76,
    height: 76,
    borderRadius: '50%',
    border: `4px solid ${enabled ? color : 'rgba(255,255,255,0.6)'}`,
    background: 'transparent',
    cursor: enabled ? 'pointer' : 'not-allowed',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 150ms ease',
  }),
  shutterInner: (enabled: boolean, color: string): CSSProperties => ({
    width: 58,
    height: 58,
    borderRadius: '50%',
    background: enabled ? color : 'rgba(255,255,255,0.85)',
    transition: 'background 150ms ease, transform 150ms ease',
    transform: enabled ? 'scale(1)' : 'scale(0.92)',
  }),
  uploadBackdrop: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, #1a1d24 0%, #0b0d12 100%)',
  } as CSSProperties,
  modeToggle: {
    position: 'absolute',
    top: 72,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'inline-flex',
    background: 'rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 999,
    padding: 4,
    gap: 2,
  } as CSSProperties,
  modeBtn: (active: boolean, color: string): CSSProperties => ({
    border: 'none',
    background: active ? color : 'transparent',
    color: '#fff',
    fontSize: '0.82rem',
    fontWeight: 600,
    padding: '6px 16px',
    borderRadius: 999,
    cursor: 'pointer',
    transition: 'background 150ms ease',
  }),
  uploadCta: (color: string, busy: boolean): CSSProperties => ({
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: 999,
    padding: '14px 28px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.7 : 1,
    minWidth: 200,
  }),
};
