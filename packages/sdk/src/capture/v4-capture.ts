/**
 * LiveSense v4 high-rate frame capture loop.
 *
 * Phase 1 ticket X-4.
 *
 * v3/v4.1 captures around 4-8 JPEG frames at low FPS. v4's perspective
 * distortion validator needs a continuous, evenly-spaced stream at
 * 30fps over roughly 1.5 seconds so server-side KLT and bundle
 * adjustment have enough views to recover geometry.
 *
 * This module exposes a capture loop that:
 *   1. Schedules frame captures at a target interval (33ms for 30fps).
 *   2. Encodes each frame as JPEG at quality 0.9 (higher than v3's 0.8
 *      because the perspective signal is geometry-sensitive).
 *   3. Hashes each frame and appends to a hash-chain builder so the
 *      terminal value can be signed by the attested key (X-6).
 *   4. Stops when it hits the v4 frame budget (80 frames) or is stopped
 *      explicitly by the phase machine (X-5).
 *
 * MP4 container encoding via WebCodecs is a Phase 2 follow-up; Phase 1
 * ships with the existing multipart JPEG upload shape, just with a
 * much higher frame rate and count. This keeps the server upload path
 * unchanged and keeps the SDK dependency surface empty.
 */

import { hashFrame } from '../utils/crypto';

// ─── v4 capture constants ────────────────────────────────────────────────────

/** v4 JPEG quality. Higher than v3's 0.8 to preserve small geometric detail. */
export const V4_JPEG_QUALITY = 0.9;

/** 30fps target frame interval in ms. */
export const V4_TARGET_FRAME_INTERVAL_MS = 33;

/** Hard cap on the v4 capture buffer. 80 frames ~ 2.67s at 30fps. */
export const V4_MAX_FRAMES = 80;

/** Minimum frames required for the server to even attempt SfM. */
export const V4_MIN_FRAMES = 30;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface V4CapturedFrame {
  readonly index: number;
  readonly bytes: Uint8Array;
  readonly hash: string;
  readonly timestampMs: number;
  readonly resolution: { w: number; h: number };
}

export interface V4CaptureConfig {
  readonly targetFrameIntervalMs?: number;
  readonly maxFrames?: number;
  readonly jpegQuality?: number;
}

export interface V4CaptureStats {
  readonly frameCount: number;
  readonly firstTimestampMs: number | null;
  readonly lastTimestampMs: number | null;
  readonly observedFps: number;
  readonly droppedFrames: number;
}

export type V4FrameListener = (frame: V4CapturedFrame) => void;

// ─── Capture loop ───────────────────────────────────────────────────────────

export class V4FrameCapture {
  private readonly video: HTMLVideoElement;
  private readonly cfg: Required<V4CaptureConfig>;
  private running = false;
  private stopRequested = false;
  private frames: V4CapturedFrame[] = [];
  private listeners: V4FrameListener[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private droppedFrames = 0;

  constructor(video: HTMLVideoElement, config: V4CaptureConfig = {}) {
    this.video = video;
    this.cfg = {
      targetFrameIntervalMs: config.targetFrameIntervalMs ?? V4_TARGET_FRAME_INTERVAL_MS,
      maxFrames: config.maxFrames ?? V4_MAX_FRAMES,
      jpegQuality: config.jpegQuality ?? V4_JPEG_QUALITY,
    };
  }

  /**
   * Run the capture loop until maxFrames reached, stop() is called, or the
   * video element becomes invalid. Returns the captured frames in order.
   */
  async run(): Promise<V4CapturedFrame[]> {
    if (this.running) throw new Error('v4-capture: already running');
    this.running = true;
    this.stopRequested = false;
    this.frames = [];
    this.droppedFrames = 0;

    let nextDueAt = now();
    while (!this.stopRequested && this.frames.length < this.cfg.maxFrames) {
      if (!this.isVideoReady()) break;

      const t0 = now();
      const frame = await this.captureOne(this.frames.length);
      if (frame) {
        this.frames.push(frame);
        this.emit(frame);
      } else {
        this.droppedFrames += 1;
      }

      nextDueAt += this.cfg.targetFrameIntervalMs;
      const wait = Math.max(0, nextDueAt - now());
      // If we are falling behind by more than one interval, do not accumulate
      // backlog; reset the due time to now so we do not pin the CPU.
      if (wait === 0 && now() - t0 > 2 * this.cfg.targetFrameIntervalMs) {
        nextDueAt = now();
      }
      await sleep(wait);
    }

    this.running = false;
    return this.frames.slice();
  }

  stop(): void {
    this.stopRequested = true;
  }

  on(listener: V4FrameListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getFrames(): V4CapturedFrame[] {
    return this.frames.slice();
  }

  stats(): V4CaptureStats {
    const first = this.frames[0]?.timestampMs ?? null;
    const last = this.frames[this.frames.length - 1]?.timestampMs ?? null;
    let observedFps = 0;
    if (first !== null && last !== null && this.frames.length > 1) {
      const spanMs = last - first;
      observedFps = spanMs > 0 ? ((this.frames.length - 1) * 1000) / spanMs : 0;
    }
    return {
      frameCount: this.frames.length,
      firstTimestampMs: first,
      lastTimestampMs: last,
      observedFps,
      droppedFrames: this.droppedFrames,
    };
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private isVideoReady(): boolean {
    return !!this.video && this.video.videoWidth > 0 && this.video.videoHeight > 0;
  }

  private ensureCanvas(): void {
    if (this.canvas) return;
    const c = document.createElement('canvas');
    c.width = this.video.videoWidth;
    c.height = this.video.videoHeight;
    this.canvas = c;
    this.ctx = c.getContext('2d');
  }

  private async captureOne(index: number): Promise<V4CapturedFrame | null> {
    this.ensureCanvas();
    if (!this.canvas || !this.ctx) return null;

    // Keep canvas dimensions in sync with the video in case the user rotated
    // orientation or the underlying stream reconfigured mid-capture.
    if (
      this.canvas.width !== this.video.videoWidth ||
      this.canvas.height !== this.video.videoHeight
    ) {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
    }

    this.ctx.drawImage(this.video, 0, 0);

    const blob: Blob | null = await new Promise((resolve) =>
      this.canvas!.toBlob(resolve, 'image/jpeg', this.cfg.jpegQuality),
    );
    if (!blob) return null;

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const hash = await hashFrame(bytes);
    return {
      index,
      bytes,
      hash,
      timestampMs: now(),
      resolution: { w: this.video.videoWidth, h: this.video.videoHeight },
    };
  }

  private emit(frame: V4CapturedFrame): void {
    for (const l of this.listeners) {
      try {
        l(frame);
      } catch {
        // swallow listener errors
      }
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
