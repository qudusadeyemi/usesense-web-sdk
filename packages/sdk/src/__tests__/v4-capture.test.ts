/**
 * Unit tests for V4FrameCapture constants (X-4).
 *
 * The capture loop itself exercises browser-only APIs (HTMLVideoElement,
 * canvas.toBlob) and is covered in the demo app rather than unit tests.
 * Here we verify the exported constants are at the spec values and the
 * stats function handles edge cases (no frames, single frame).
 */

import { describe, it, expect } from 'vitest';

import {
  V4FrameCapture,
  V4_JPEG_QUALITY,
  V4_TARGET_FRAME_INTERVAL_MS,
  V4_MAX_FRAMES,
  V4_MIN_FRAMES,
} from '../capture/v4-capture';

describe('V4FrameCapture (X-4)', () => {
  it('exports spec constants', () => {
    expect(V4_JPEG_QUALITY).toBe(0.9);
    expect(V4_TARGET_FRAME_INTERVAL_MS).toBe(33); // ~30fps
    expect(V4_MAX_FRAMES).toBe(80);
    expect(V4_MIN_FRAMES).toBe(30);
  });

  it('stats(): no frames produces zeros', () => {
    // Capture controller with a dummy stand-in; never call run().
    const cap = new V4FrameCapture({} as any);
    const s = cap.stats();
    expect(s.frameCount).toBe(0);
    expect(s.observedFps).toBe(0);
    expect(s.firstTimestampMs).toBeNull();
    expect(s.lastTimestampMs).toBeNull();
    expect(s.droppedFrames).toBe(0);
  });

  it('stats(): single synthetic frame produces 0 fps (span undefined)', () => {
    const cap = new V4FrameCapture({} as any);
    // Reach into internals ONLY to validate the stats function. The production
    // code never exposes this; this is a white-box stat-shape check.
    (cap as any).frames = [
      { index: 0, bytes: new Uint8Array(), hash: 'a'.repeat(64), timestampMs: 100, resolution: { w: 1, h: 1 } },
    ];
    const s = cap.stats();
    expect(s.frameCount).toBe(1);
    expect(s.observedFps).toBe(0); // need at least 2 frames
    expect(s.firstTimestampMs).toBe(100);
    expect(s.lastTimestampMs).toBe(100);
  });

  it('stats(): 30 frames over 1s yields ~29 fps', () => {
    const cap = new V4FrameCapture({} as any);
    const frames: any[] = [];
    for (let i = 0; i < 30; i++) {
      frames.push({
        index: i,
        bytes: new Uint8Array(),
        hash: 'a'.repeat(64),
        timestampMs: 1000 + i * (1000 / 29), // span exactly 1000ms across 29 gaps
        resolution: { w: 1, h: 1 },
      });
    }
    (cap as any).frames = frames;
    const s = cap.stats();
    expect(s.frameCount).toBe(30);
    expect(s.observedFps).toBeGreaterThan(28);
    expect(s.observedFps).toBeLessThan(30);
  });

  it('on(): registered listener receives every pushed frame', () => {
    const cap = new V4FrameCapture({} as any);
    const seen: number[] = [];
    cap.on((f) => seen.push(f.index));

    // Simulate frames arriving via the private emit path.
    for (let i = 0; i < 3; i++) {
      (cap as any).emit({
        index: i,
        bytes: new Uint8Array(),
        hash: 'a'.repeat(64),
        timestampMs: 1000 + i,
        resolution: { w: 1, h: 1 },
      });
    }
    expect(seen).toEqual([0, 1, 2]);
  });

  it('stop(): toggles stopRequested flag', () => {
    const cap = new V4FrameCapture({} as any);
    expect((cap as any).stopRequested).toBe(false);
    cap.stop();
    expect((cap as any).stopRequested).toBe(true);
  });
});
