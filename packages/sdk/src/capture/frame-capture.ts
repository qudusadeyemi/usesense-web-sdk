/**
 * Frame capture pipeline.
 *
 * Captures JPEG frames from a video element at a target FPS,
 * computes SHA-256 hash per frame, and enforces a frame budget.
 */

import { hashFrame } from '../utils/crypto';

const JPEG_QUALITY = 0.85;
const MAX_FRAMES = 30;

export interface CapturedFrame {
  index: number;
  bytes: Uint8Array;
  hash: string;
  timestamp: number;
}

/**
 * Capture a single JPEG frame from a video element.
 * Returns the raw bytes and the SHA-256 hash.
 */
export async function captureOneFrame(
  videoElement: HTMLVideoElement,
  frameIndex: number,
  captureStartTime: number
): Promise<CapturedFrame | null> {
  if (!videoElement || videoElement.videoWidth === 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(videoElement, 0, 0);

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
    timestamp: performance.now() - captureStartTime,
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
