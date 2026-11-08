/**
 * DOM side of the quality gate: maps MediaPipe's normalised video coordinates
 * onto what the user sees (object-fit: cover, mirrored preview), reads the
 * oval's on-screen ellipse, and samples face-area pixels.
 */

import type { Ellipse, FaceAreaStats, Point2 } from './quality-gate';
import { faceAreaStats, rgbaToLuma } from './quality-gate';

/** Maps a normalised video point to container pixels. */
export interface VideoMapper {
  map(x: number, y: number): Point2;
  /** Rendered width of the full video frame, px (the scale for landmark z). */
  renderedWidth: number;
}

/**
 * Mapper for a video drawn with object-fit: cover into a container of
 * `cw` x `ch` px, mirrored horizontally like the selfie preview.
 */
export function coverMapper(vw: number, vh: number, cw: number, ch: number, mirrored = true): VideoMapper {
  const scale = Math.max(cw / vw, ch / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const ox = (cw - dw) / 2;
  const oy = (ch - dh) / 2;
  return {
    map: (x, y) => ({ x: ox + (mirrored ? 1 - x : x) * dw, y: oy + y * dh }),
    renderedWidth: dw,
  };
}

/** The oval element's ellipse relative to the container, px. */
export function ellipseOf(el: Element, container: Element): Ellipse {
  const r = el.getBoundingClientRect();
  const c = container.getBoundingClientRect();
  return { cx: r.left - c.left + r.width / 2, cy: r.top - c.top + r.height / 2, rx: r.width / 2, ry: r.height / 2 };
}

/** Side of the square the face area is resampled to before measuring. */
export const FACE_SAMPLE_SIZE = 96;

/**
 * Light and sharpness on a region of the video frame (video pixel coords),
 * resampled to 96x96 so the sharpness value scales with the face, not with
 * the camera resolution. Returns the luma too, for frame-difference motion.
 */
export function sampleRegion(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  sx: number, sy: number, sw: number, sh: number,
): { stats: FaceAreaStats; luma: Float32Array } | null {
  const S = FACE_SAMPLE_SIZE;
  if (canvas.width !== S) canvas.width = S;
  if (canvas.height !== S) canvas.height = S;
  const ctx = canvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings);
  if (!ctx) return null;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const x = Math.max(0, Math.min(vw - 1, sx));
  const y = Math.max(0, Math.min(vh - 1, sy));
  const w = Math.max(1, Math.min(vw - x, sw));
  const h = Math.max(1, Math.min(vh - y, sh));
  try {
    ctx.drawImage(video, x, y, w, h, 0, 0, S, S);
    const luma = rgbaToLuma(ctx.getImageData(0, 0, S, S).data);
    return { stats: faceAreaStats(luma, S, S), luma };
  } catch {
    return null;
  }
}

/** Mean absolute difference between two equal-length luma buffers. */
export function lumaMotion(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

/** True when the user asked the OS for reduced motion. */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Vibrate where supported. Never throws. */
export function haptic(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    // unsupported or blocked (e.g. no user activation yet)
  }
}
