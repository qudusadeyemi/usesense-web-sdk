import { describe, it, expect } from 'vitest';
import { computeFrameOutputSize } from '../capture/frame-capture';
import { encodeMetadata } from '../api-client';

// Frames used to upload at the camera's native resolution, which put 1.9-3.4 MB
// on the wire per session; one measured production session spent 1.9s capturing
// and 193s uploading. These tests pin the two things that shrink it.

describe('computeFrameOutputSize', () => {
  it('caps a 720p landscape capture at 960 on the long edge', () => {
    expect(computeFrameOutputSize(1280, 720)).toEqual({ w: 960, h: 540 });
  });

  it('caps a portrait capture on its long edge, not its width', () => {
    // Phones held upright report 720x1280. Capping width would leave the
    // expensive dimension untouched.
    expect(computeFrameOutputSize(720, 1280)).toEqual({ w: 540, h: 960 });
  });

  it('never upscales a camera already below the cap', () => {
    expect(computeFrameOutputSize(640, 480)).toEqual({ w: 640, h: 480 });
    expect(computeFrameOutputSize(320, 240)).toEqual({ w: 320, h: 240 });
  });

  it('preserves aspect ratio within a rounding pixel', () => {
    for (const [w, h] of [[1920, 1080], [1280, 720], [1440, 1080], [720, 1280]]) {
      const out = computeFrameOutputSize(w, h);
      expect(Math.abs(out.w / out.h - w / h)).toBeLessThan(0.01);
    }
  });

  it('caps the long edge at 960 for any oversized input', () => {
    for (const [w, h] of [[4096, 2160], [1920, 1080], [3000, 3000], [1080, 1920]]) {
      const out = computeFrameOutputSize(w, h);
      expect(Math.max(out.w, out.h)).toBeLessThanOrEqual(960);
    }
  });

  it('never returns a zero dimension for extreme aspect ratios', () => {
    const out = computeFrameOutputSize(4000, 1);
    expect(out.w).toBeGreaterThan(0);
    expect(out.h).toBeGreaterThan(0);
  });
});

describe('encodeMetadata', () => {
  // Representative of the real payload: production metadata.json measured
  // 345-461 KB, dominated by the verification_package landmark arrays.
  const bigMetadata = {
    channel_integrity: { user_agent: 'test', camera_resolution: '1280x720' },
    frames_manifest: Array.from({ length: 15 }, (_, i) => ({
      index: i,
      resolution_w: 540,
      resolution_h: 960,
      hash: 'a'.repeat(64),
    })),
    verification_package: {
      frames: Array.from({ length: 8 }, () => ({
        shapeParams: Array.from({ length: 60 }, (_, k) => k * 0.017),
        geometricRatios: Array.from({ length: 40 }, (_, k) => k * 0.013),
      })),
    },
  } as any;

  it('produces gzip-framed bytes the server can sniff', async () => {
    const out = await encodeMetadata(bigMetadata);
    expect(out.gzipped).toBe(true);
    expect(out.filename).toBe('metadata.json.gz');

    // The server detects compression from the magic bytes rather than the
    // filename or header, so those two bytes are the actual contract.
    const bytes = new Uint8Array(await out.blob.arrayBuffer());
    expect(bytes[0]).toBe(0x1f);
    expect(bytes[1]).toBe(0x8b);
  });

  it('round-trips back to the identical object', async () => {
    const out = await encodeMetadata(bigMetadata);
    const stream = out.blob.stream().pipeThrough(new DecompressionStream('gzip'));
    const text = await new Response(stream).text();
    expect(JSON.parse(text)).toEqual(bigMetadata);
  });

  it('actually shrinks a realistic payload', async () => {
    const raw = new TextEncoder().encode(JSON.stringify(bigMetadata)).byteLength;
    const out = await encodeMetadata(bigMetadata);
    expect(out.blob.size).toBeLessThan(raw * 0.6);
  });

  it('falls back to plain JSON when CompressionStream is unavailable', async () => {
    const original = (globalThis as any).CompressionStream;
    // Safari < 16.4 has no CompressionStream. Capture must still succeed there.
    delete (globalThis as any).CompressionStream;
    try {
      const out = await encodeMetadata(bigMetadata);
      expect(out.gzipped).toBe(false);
      expect(out.filename).toBe('metadata.json');
      expect(JSON.parse(await out.blob.text())).toEqual(bigMetadata);
    } finally {
      (globalThis as any).CompressionStream = original;
    }
  });
});
