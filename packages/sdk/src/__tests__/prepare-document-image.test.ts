import { describe, it, expect } from 'vitest';
import { computeResizeTarget, MAX_PRE_BASE64_BYTES } from '../prepare-document-image';

describe('computeResizeTarget', () => {
  it('does not upscale when both dimensions are already within bounds', () => {
    const t = computeResizeTarget({ width: 800, height: 600, maxLongEdge: 2000 });
    expect(t).toEqual({ width: 800, height: 600, scale: 1 });
  });

  it('scales landscape down to maxLongEdge along width', () => {
    const t = computeResizeTarget({ width: 4000, height: 3000, maxLongEdge: 2000 });
    expect(t.width).toBe(2000);
    expect(t.height).toBe(1500);
    expect(t.scale).toBeCloseTo(0.5);
  });

  it('scales portrait down to maxLongEdge along height', () => {
    const t = computeResizeTarget({ width: 1500, height: 4500, maxLongEdge: 1800 });
    expect(t.height).toBe(1800);
    expect(t.width).toBe(600);
    expect(t.scale).toBeCloseTo(0.4);
  });

  it('rounds to integer pixel dimensions', () => {
    const t = computeResizeTarget({ width: 3333, height: 2222, maxLongEdge: 2000 });
    expect(Number.isInteger(t.width)).toBe(true);
    expect(Number.isInteger(t.height)).toBe(true);
  });
});

describe('MAX_PRE_BASE64_BYTES', () => {
  it('is set so that base64 encoding stays under 5MB Infrared cap', () => {
    // base64 inflates by ~4/3. 5_000_000 / (4/3) = 3_750_000
    expect(MAX_PRE_BASE64_BYTES).toBeLessThanOrEqual(3_750_000);
    expect(MAX_PRE_BASE64_BYTES).toBeGreaterThan(3_000_000);
  });
});
