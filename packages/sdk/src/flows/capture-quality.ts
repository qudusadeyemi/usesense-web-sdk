/**
 * capture-quality.ts -- pure, zero-dependency frame-quality gates for document
 * capture. Given a frame's pixels it measures brightness, sharpness (focus) and
 * glare so the capture UI can auto-capture only a good frame and guide the user
 * otherwise. No DOM or browser APIs, so it is fully unit-testable.
 */

/** A frame's raw RGBA pixels (as produced by canvas `getImageData`). */
export interface FramePixels {
  readonly data: Uint8ClampedArray | number[];
  readonly width: number;
  readonly height: number;
}

/** Why a frame is not yet good enough to capture. */
export type FrameQualityIssue = 'too_dark' | 'too_bright' | 'blurry' | 'glare';

/** Thresholds for the document quality gates. All brightness values are 0..1. */
export interface FrameQualityThresholds {
  /** Reject frames darker than this mean luma (0..1). */
  readonly minBrightness: number;
  /** Reject frames brighter than this mean luma (0..1). */
  readonly maxBrightness: number;
  /** Minimum Laplacian variance (on 0..255 luma) for "in focus". */
  readonly minSharpness: number;
  /** Maximum fraction (0..1) of near-white pixels before it reads as glare. */
  readonly maxGlareFraction: number;
}

/** Sensible defaults, tunable per integration. */
export const DEFAULT_DOCUMENT_THRESHOLDS: FrameQualityThresholds = {
  minBrightness: 0.25,
  maxBrightness: 0.95,
  minSharpness: 60,
  maxGlareFraction: 0.04,
};

/** Measured quality of a single frame. */
export interface FrameQuality {
  /** Mean luma, 0..1. */
  readonly brightness: number;
  /** Laplacian variance on 0..255 luma; higher is sharper. */
  readonly sharpness: number;
  /** Fraction of near-white (overexposed) pixels, 0..1. */
  readonly glareFraction: number;
  /** All detected issues, regardless of which gates the caller enables. */
  readonly issues: readonly FrameQualityIssue[];
}

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Measure brightness, sharpness and glare for a frame. Pure: same input always
 * yields the same metrics.
 */
export function assessDocumentFrame(
  frame: FramePixels,
  thresholds: FrameQualityThresholds = DEFAULT_DOCUMENT_THRESHOLDS,
): FrameQuality {
  const { data, width, height } = frame;
  const n = width * height;
  if (n === 0) {
    return { brightness: 0, sharpness: 0, glareFraction: 0, issues: ['too_dark'] };
  }

  // Grayscale luma + brightness + glare in one pass.
  const gray = new Float64Array(n);
  let sum = 0;
  let glare = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const y = luma(data[o], data[o + 1], data[o + 2]);
    gray[i] = y;
    sum += y;
    if (y >= 245) glare++;
  }
  const brightness = sum / n / 255;
  const glareFraction = glare / n;

  // Sharpness: variance of the discrete Laplacian over interior pixels.
  let lapSum = 0;
  let lapSqSum = 0;
  let count = 0;
  for (let yy = 1; yy < height - 1; yy++) {
    for (let xx = 1; xx < width - 1; xx++) {
      const idx = yy * width + xx;
      const lap = 4 * gray[idx] - gray[idx - 1] - gray[idx + 1] - gray[idx - width] - gray[idx + width];
      lapSum += lap;
      lapSqSum += lap * lap;
      count++;
    }
  }
  const sharpness = count > 0 ? lapSqSum / count - (lapSum / count) ** 2 : 0;

  const issues: FrameQualityIssue[] = [];
  if (brightness < thresholds.minBrightness) issues.push('too_dark');
  else if (brightness > thresholds.maxBrightness) issues.push('too_bright');
  if (sharpness < thresholds.minSharpness) issues.push('blurry');
  if (glareFraction > thresholds.maxGlareFraction) issues.push('glare');

  return { brightness, sharpness, glareFraction, issues };
}

/**
 * Decide whether a frame is good enough to auto-capture, honoring which gates
 * the server enabled via `captureHints`. Brightness is always gated; focus and
 * glare are gated only when requested.
 */
export function isCaptureReady(
  quality: FrameQuality,
  hints?: { requireFocus?: boolean; detectGlare?: boolean },
): boolean {
  for (const issue of quality.issues) {
    if (issue === 'too_dark' || issue === 'too_bright') return false;
    if (issue === 'blurry' && hints?.requireFocus !== false) return false;
    if (issue === 'glare' && hints?.detectGlare !== false) return false;
  }
  return true;
}

/** Short, user-facing guidance for the most important current issue. */
export function guidanceFor(issues: readonly FrameQualityIssue[]): string | null {
  if (issues.includes('too_dark')) return 'Move somewhere brighter';
  if (issues.includes('glare')) return 'Reduce glare on the document';
  if (issues.includes('too_bright')) return 'Reduce the lighting';
  if (issues.includes('blurry')) return 'Hold steady to focus';
  return null;
}
