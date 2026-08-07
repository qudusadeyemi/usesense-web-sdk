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

/**
 * Longest-edge cap for uploaded frames.
 *
 * Frames used to be encoded at the camera's native resolution, which put
 * 1.9-3.4 MB on the wire per session. On a mobile uplink that is minutes of
 * "Almost done" for the subject: one measured production session spent 1.9s
 * capturing and 193s uploading.
 *
 * 960 was picked by measuring 198 real frames from 11 production sessions
 * through the actual pipeline. Face matching is indifferent to it (Rekognition
 * similarity 99.99 -> 99.99 against a threshold of 90, zero detection
 * failures). The binding constraint is Rekognition's Quality.Sharpness, which
 * the server's screen-replay detector reads: at 960 mean sharpness falls
 * ~11% (83.9 -> 75.4) and no session in the corpus crossed the
 * SHARPNESS_SCREEN_CEILING, whereas 640 pushed 2 of 11 over it and 480 pushed 7.
 *
 * Changing this changes what the server scores. `frames_manifest[].resolution_w/h`
 * reports the encoded size so the detector can scale its thresholds; keep the
 * calibration table in screen-replay-detector.tsx in step with this constant.
 */
const MAX_FRAME_LONG_EDGE = 960;

/**
 * Encoded frame size for a given native camera size.
 *
 * Caps the longest edge at MAX_FRAME_LONG_EDGE and preserves aspect ratio, so
 * portrait (720x1280) and landscape (1280x720) captures shrink by the same
 * factor. Never upscales: a camera already below the cap is passed through
 * untouched.
 */
export function computeFrameOutputSize(
  nativeW: number,
  nativeH: number
): { w: number; h: number } {
  const scale = Math.min(1, MAX_FRAME_LONG_EDGE / Math.max(nativeW, nativeH));
  return {
    w: Math.max(1, Math.round(nativeW * scale)),
    h: Math.max(1, Math.round(nativeH * scale)),
  };
}

export interface CapturedFrame {
  index: number;
  bytes: Uint8Array;
  hash: string;
  timestamp: number;
  luminance: number;
  resolution: { w: number; h: number };
  /** v4: capture phase tag attached at the moment the frame was captured. */
  phase?: 'baseline' | 'zoom' | 'challenge';
}

/**
 * Capture a single JPEG frame from a video element.
 * Returns the raw bytes, SHA-256 hash, an absolute Date.now() timestamp,
 * and a quick average luminance (for suspicion engine input).
 */
export async function captureOneFrame(
  videoElement: HTMLVideoElement,
  frameIndex: number,
  _captureStartTime: number,
  /**
   * Canvas to encode into. Pass one to keep the last captured frame around
   * after this returns: the screen-detection signals need real pixels, and
   * with no canvas to read they fall back to a hardcoded 0.5. Omit and a
   * throwaway canvas is allocated per frame, as before.
   */
  targetCanvas?: HTMLCanvasElement
): Promise<CapturedFrame | null> {
  if (!videoElement || videoElement.videoWidth === 0) return null;

  // Downscale to MAX_FRAME_LONG_EDGE, preserving aspect ratio. Portrait and
  // landscape both cap on their longest edge, so a 720x1280 phone capture and a
  // 1280x720 desktop one shrink by the same factor.
  const { w: outW, h: outH } = computeFrameOutputSize(
    videoElement.videoWidth,
    videoElement.videoHeight
  );

  const canvas = targetCanvas ?? document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // A downscale without filtering aliases, and aliasing reads as lost sharpness
  // to the server's screen-replay detector -- the one signal this change can
  // actually hurt. Ask for the best resampling the browser has.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(videoElement, 0, 0, outW, outH);

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
    // The encoded size, not the camera's native size: this is what the server
    // actually scores, and `hash` is over these same downscaled bytes.
    // channel_integrity.camera_resolution still reports the native capture.
    resolution: { w: outW, h: outH },
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
