/**
 * Frame capture pipeline.
 *
 * Captures JPEG frames from a video element at a target FPS,
 * computes SHA-256 hash per frame, and enforces a frame budget.
 * v4.1: JPEG quality 0.8, per-frame luminance collection.
 */

import { hashFrame } from '../utils/crypto';

const JPEG_QUALITY = 0.8;
const MAX_FRAMES = 30;

export interface CapturedFrame {
  index: number;
  bytes: Uint8Array;
  hash: string;
  timestamp: number;
  luminance: number;
  resolution: { w: number; h: number };
}

/**
 * Capture a single JPEG frame from a video element.
 * Returns the raw bytes, SHA-256 hash, an absolute Date.now() timestamp,
 * and a quick average luminance (for suspicion engine input).
 */
export async function captureOneFrame(
  videoElement: HTMLVideoElement,
  frameIndex: number,
  _captureStartTime: number
): Promise<CapturedFrame | null> {
  if (!videoElement || videoElement.videoWidth === 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(videoElement, 0, 0);

  // Compute luminance from a downscaled 64x48 sample (lightweight, ~0.1ms)
  const lumCanvas = document.createElement('canvas');
  const lumW = 64;
  const lumH = 48;
  lumCanvas.width = lumW;
  lumCanvas.height = lumH;
  const lumCtx = lumCanvas.getContext('2d');
  let luminance = 0;
  if (lumCtx) {
    lumCtx.drawImage(videoElement, 0, 0, lumW, lumH);
    const data = lumCtx.getImageData(0, 0, lumW, lumH).data;
    let total = 0;
    const pixelCount = lumW * lumH;
    for (let i = 0; i < data.length; i += 4) {
      total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    luminance = total / pixelCount;
  }

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  );
  if (!blob) return null;

  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const hash = await hashFrame(bytes);

  return {
    index: frameIndex,
    bytes,
    hash,
    timestamp: Date.now(),
    luminance,
    resolution: { w: videoElement.videoWidth, h: videoElement.videoHeight },
  };
}

/**
 * Frame budget checker. Hard cap at 30 frames.
 */
export function isFrameBudgetExhausted(currentCount: number): boolean {
  return currentCount >= MAX_FRAMES;
}

/**
 * Compute the interval between frames for a target FPS.
 */
export function getFrameInterval(targetFps: number): number {
  return Math.floor(1000 / Math.max(1, targetFps));
}

/**
 * Utility: sleep for ms.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
