import { describe, it, expect } from 'vitest';
import {
  assessDocumentFrame,
  isCaptureReady,
  guidanceFor,
  type FramePixels,
} from '../flows/capture-quality';

function frame(width: number, height: number, px: (x: number, y: number) => [number, number, number]): FramePixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const [r, g, b] = px(x, y);
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
  }
  return { data, width, height };
}

describe('assessDocumentFrame', () => {
  it('flags a flat mid-gray frame as blurry (no edges) but well-lit', () => {
    const q = assessDocumentFrame(frame(32, 32, () => [128, 128, 128]));
    expect(q.brightness).toBeCloseTo(0.5, 2);
    expect(q.glareFraction).toBe(0);
    expect(q.sharpness).toBeLessThan(60);
    expect(q.issues).toContain('blurry');
    expect(q.issues).not.toContain('too_dark');
  });

  it('flags an all-white frame as too bright and glary', () => {
    const q = assessDocumentFrame(frame(32, 32, () => [255, 255, 255]));
    expect(q.issues).toContain('too_bright');
    expect(q.issues).toContain('glare');
    expect(q.glareFraction).toBe(1);
  });

  it('flags an all-black frame as too dark', () => {
    const q = assessDocumentFrame(frame(32, 32, () => [0, 0, 0]));
    expect(q.brightness).toBe(0);
    expect(q.issues).toContain('too_dark');
  });

  it('treats a high-contrast in-focus frame as sharp and issue-free', () => {
    // Alternating columns (64/192): well-lit, no glare, lots of edges -> sharp.
    const q = assessDocumentFrame(frame(32, 32, (x) => (x % 2 === 0 ? [64, 64, 64] : [192, 192, 192])));
    expect(q.sharpness).toBeGreaterThan(60);
    expect(q.glareFraction).toBe(0);
    expect(q.issues).toEqual([]);
  });

  it('handles an empty frame defensively', () => {
    const q = assessDocumentFrame({ data: new Uint8ClampedArray(0), width: 0, height: 0 });
    expect(q.issues).toContain('too_dark');
  });
});

describe('isCaptureReady', () => {
  const blurry = assessDocumentFrame(frame(16, 16, () => [128, 128, 128]));
  const clean = assessDocumentFrame(frame(16, 16, (x) => (x % 2 === 0 ? [64, 64, 64] : [192, 192, 192])));

  it('is true for a clean frame', () => {
    expect(isCaptureReady(clean)).toBe(true);
  });

  it('blocks a blurry frame when focus is required (default)', () => {
    expect(isCaptureReady(blurry)).toBe(false);
  });

  it('allows a blurry frame when requireFocus is disabled', () => {
    expect(isCaptureReady(blurry, { requireFocus: false })).toBe(true);
  });

  it('always blocks bad brightness regardless of hints', () => {
    const dark = assessDocumentFrame(frame(16, 16, () => [0, 0, 0]));
    expect(isCaptureReady(dark, { requireFocus: false, detectGlare: false })).toBe(false);
  });
});

describe('guidanceFor', () => {
  it('prioritizes darkness, then glare, then focus', () => {
    expect(guidanceFor(['too_dark', 'blurry'])).toMatch(/bright/i);
    expect(guidanceFor(['glare', 'blurry'])).toMatch(/glare/i);
    expect(guidanceFor(['blurry'])).toMatch(/steady|focus/i);
    expect(guidanceFor([])).toBeNull();
  });
});
