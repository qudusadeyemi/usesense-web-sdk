/**
 * Pure helpers for the document capture component.
 *
 * Kept free of DOM/canvas/MediaStream so they can be unit-tested in node
 * and reused without a browser environment. The component file
 * `document-capture.tsx` is the thin shell that wires these together
 * with getUserMedia, an HTMLCanvasElement, and React state.
 */

import type { DocumentType } from './documents';

// ── Aspect ratios ───────────────────────────────────────────────────────────

/**
 * Long-edge / short-edge aspect ratio for a given document type.
 *
 * - identity (ID-1: drivers licenses, national IDs, residence permits): 1.586
 * - passport (ICAO TD-3 booklet, opened to data page): 1.42
 *
 * This is a guide overlay, not a crop. The capture pipeline never crops the
 * resulting image -- the user fits the document inside the frame manually.
 */
export function aspectRatioForDocument(type: DocumentType): number {
  switch (type) {
    case 'identity':
      return 1.586;
    case 'passport':
      return 1.42;
  }
}

// ── Frame geometry ──────────────────────────────────────────────────────────

export interface FrameRectInput {
  viewportWidth: number;
  viewportHeight: number;
  aspectRatio: number;
  paddingPx: number;
}

export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Largest landscape rectangle of the given aspect ratio that fits inside
 * the viewport with `paddingPx` clearance on all sides, centered.
 *
 * Pure math, no DOM access. Result is rounded to whole pixels.
 */
export function computeFrameRect(input: FrameRectInput): FrameRect {
  const { viewportWidth, viewportHeight, aspectRatio, paddingPx } = input;
  const availW = Math.max(0, viewportWidth - paddingPx * 2);
  const availH = Math.max(0, viewportHeight - paddingPx * 2);

  // Try fitting by width first; if the resulting height exceeds availH,
  // fit by height instead.
  let width = availW;
  let height = Math.round(availW / aspectRatio);
  if (height > availH) {
    height = availH;
    width = Math.round(availH * aspectRatio);
  }

  const x = Math.round((viewportWidth - width) / 2);
  const y = Math.round((viewportHeight - height) / 2);
  return { x, y, width, height };
}

// ── Stability metrics ───────────────────────────────────────────────────────

/**
 * Mean luminance in the 0..255 range. Input is a single-channel
 * grayscale buffer (one byte per pixel).
 */
export function brightnessFromGray(data: Uint8ClampedArray): number {
  if (data.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i]!;
  return sum / data.length;
}

/**
 * Variance of a 3x3 Laplacian filter applied to a grayscale buffer.
 * Higher values mean more high-frequency content, which correlates
 * with sharpness. Edge pixels are skipped.
 *
 * This is the same metric used by the OpenCV "Laplacian variance"
 * blur detector, computed without OpenCV.
 */
export function sharpnessFromGray(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  if (width < 3 || height < 3) return 0;

  // First pass: compute the Laplacian response per interior pixel and
  // accumulate sum + sum of squares for the variance computation.
  let count = 0;
  let sum = 0;
  let sumSq = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const c = data[i]!;
      const up = data[i - width]!;
      const down = data[i + width]!;
      const left = data[i - 1]!;
      const right = data[i + 1]!;
      const lap = -4 * c + up + down + left + right;
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

// ── Stability gate ──────────────────────────────────────────────────────────

export interface StabilityMetrics {
  brightness: number;
  sharpness: number;
}

export interface StabilityThresholds {
  minBrightness: number;
  maxBrightness: number;
  minSharpness: number;
}

/**
 * Defaults tuned on a desktop webcam in moderate office light.
 * Devices vary; expose if needed later.
 */
export const STABILITY_THRESHOLDS: StabilityThresholds = {
  minBrightness: 60,
  maxBrightness: 240,
  minSharpness: 100,
};

/**
 * Returns true when the frame is bright enough and sharp enough to
 * enable the shutter button. Hint, not a guarantee.
 */
export function isStable(
  metrics: StabilityMetrics,
  thresholds: StabilityThresholds = STABILITY_THRESHOLDS,
): boolean {
  return (
    metrics.brightness >= thresholds.minBrightness &&
    metrics.brightness <= thresholds.maxBrightness &&
    metrics.sharpness >= thresholds.minSharpness
  );
}

// ── Capture mode ────────────────────────────────────────────────────────────

export type CaptureMode = 'camera' | 'upload';

/**
 * Picks the default input mode for <DocumentCapture/>.
 *
 * - Mobile + camera available: 'camera' (rear camera is the natural input)
 * - Desktop: 'upload' (webcams are usually unsuitable for ID photos)
 * - No camera: 'upload' (only option)
 *
 * The user can always switch via the in-component toggle.
 */
export function pickInitialMode(opts: {
  hasCamera: boolean;
  isMobile: boolean;
}): CaptureMode {
  if (!opts.hasCamera) return 'upload';
  return opts.isMobile ? 'camera' : 'upload';
}

// ── Upload validation ───────────────────────────────────────────────────────

/**
 * MIME types accepted by the upload path. JPEG/PNG cover most cases;
 * HEIC/HEIF are common on iOS. WebP for completeness.
 *
 * PDFs and other document formats are rejected -- prepareDocumentImage
 * decodes via the browser's image decoder, which only handles raster.
 */
const ACCEPTED_UPLOAD_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export type UploadValidation =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Validates a user-selected file before passing it to prepareDocumentImage.
 * Pure: only inspects `type` and `size` so it runs in node tests.
 */
export function validateUploadFile(file: Pick<File, 'type' | 'size'>): UploadValidation {
  if (file.size === 0) {
    return { ok: false, reason: 'File is empty' };
  }
  const type = file.type.toLowerCase();
  if (!ACCEPTED_UPLOAD_TYPES.has(type)) {
    return {
      ok: false,
      reason: 'Please choose an image (JPEG, PNG, HEIC, or WebP)',
    };
  }
  return { ok: true };
}
