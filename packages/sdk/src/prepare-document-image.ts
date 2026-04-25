/**
 * Browser utility for preparing a captured document image for upload.
 *
 * Two responsibilities, kept apart so the math is testable in node:
 *   1. computeResizeTarget — pure scaling math (no DOM)
 *   2. prepareDocumentImage — browser shell using canvas + JPEG encode
 *
 * Aspect ratios are guides only. We never crop; we only scale to fit
 * the long edge inside `maxLongEdge` and re-encode at JPEG quality steps
 * until the result fits under the pre-base64 budget.
 */

import type { DocumentImage } from './documents';

/** Pre-base64 byte budget. Infrared caps requests at 5MB; base64 inflates ~4/3. */
export const MAX_PRE_BASE64_BYTES = 3_500_000;

const DEFAULT_MAX_LONG_EDGE = 2000;
const QUALITY_STEPS = [0.85, 0.78, 0.7, 0.6];

// ============================================================================
// Pure scaling math
// ============================================================================

export interface ResizeInput {
  width: number;
  height: number;
  maxLongEdge: number;
}

export interface ResizeTarget {
  width: number;
  height: number;
  scale: number;
}

export function computeResizeTarget(input: ResizeInput): ResizeTarget {
  const longEdge = Math.max(input.width, input.height);
  if (longEdge <= input.maxLongEdge) {
    return { width: input.width, height: input.height, scale: 1 };
  }
  const scale = input.maxLongEdge / longEdge;
  return {
    width: Math.round(input.width * scale),
    height: Math.round(input.height * scale),
    scale,
  };
}

// ============================================================================
// Browser shell
// ============================================================================

export interface PrepareDocumentImageParams {
  source: Blob | ImageBitmap | HTMLImageElement | HTMLCanvasElement;
  maxLongEdge?: number;
}

export class DocumentImageTooLargeError extends Error {
  constructor(public byteLength: number) {
    super(
      `Document image is ${byteLength} bytes after re-encoding; exceeds ${MAX_PRE_BASE64_BYTES} byte budget`
    );
    this.name = 'DocumentImageTooLargeError';
  }
}

export async function prepareDocumentImage(
  params: PrepareDocumentImageParams
): Promise<DocumentImage> {
  const bitmap = await toImageBitmap(params.source);
  const target = computeResizeTarget({
    width: bitmap.width,
    height: bitmap.height,
    maxLongEdge: params.maxLongEdge ?? DEFAULT_MAX_LONG_EDGE,
  });

  const canvas = makeCanvas(target.width, target.height);
  const ctx = getContext2D(canvas);
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, target.width, target.height);
  if (typeof (bitmap as ImageBitmap).close === 'function') {
    (bitmap as ImageBitmap).close();
  }

  for (const quality of QUALITY_STEPS) {
    const blob = await canvasToJpeg(canvas, quality);
    if (blob.size <= MAX_PRE_BASE64_BYTES) {
      return {
        blob,
        width: target.width,
        height: target.height,
        byteLength: blob.size,
      };
    }
  }

  // Final attempt at the lowest quality already produced; report it.
  const fallback = await canvasToJpeg(canvas, QUALITY_STEPS[QUALITY_STEPS.length - 1]!);
  throw new DocumentImageTooLargeError(fallback.size);
}

// ----- browser helpers (untested in node; kept thin) -----

async function toImageBitmap(
  source: Blob | ImageBitmap | HTMLImageElement | HTMLCanvasElement
): Promise<ImageBitmap | { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(source as Blob | ImageBitmap | HTMLCanvasElement);
  }
  // Last-ditch: assume the source already exposes width/height (HTMLImageElement, canvas).
  const anySrc = source as { width: number; height: number };
  if (typeof anySrc.width === 'number' && typeof anySrc.height === 'number') {
    return anySrc;
  }
  throw new Error('createImageBitmap is unavailable in this environment');
}

function makeCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

function getContext2D(canvas: HTMLCanvasElement | OffscreenCanvas): CanvasRenderingContext2D {
  const ctx = (canvas as HTMLCanvasElement).getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx as unknown as CanvasRenderingContext2D;
}

async function canvasToJpeg(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  quality: number
): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type: 'image/jpeg', quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
      'image/jpeg',
      quality
    );
  });
}
