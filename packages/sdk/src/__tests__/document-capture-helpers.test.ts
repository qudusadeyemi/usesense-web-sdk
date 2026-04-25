import { describe, it, expect } from 'vitest';
import {
  aspectRatioForDocument,
  computeFrameRect,
  brightnessFromGray,
  sharpnessFromGray,
  isStable,
  pickInitialMode,
  validateUploadFile,
  STABILITY_THRESHOLDS,
} from '../document-capture-helpers';

describe('aspectRatioForDocument', () => {
  it('returns ID-1 ratio for identity', () => {
    expect(aspectRatioForDocument('identity')).toBeCloseTo(1.586, 3);
  });

  it('returns passport ratio for passport', () => {
    expect(aspectRatioForDocument('passport')).toBeCloseTo(1.42, 3);
  });
});

describe('computeFrameRect', () => {
  it('fits a wide frame inside a tall viewport with width as the limit', () => {
    const r = computeFrameRect({
      viewportWidth: 400,
      viewportHeight: 800,
      aspectRatio: 1.586,
      paddingPx: 24,
    });
    expect(r.width).toBe(400 - 48);
    expect(r.height).toBe(Math.round((400 - 48) / 1.586));
    expect(r.x).toBe(24);
    expect(r.y).toBe(Math.round((800 - r.height) / 2));
  });

  it('fits a wide frame inside a wide viewport with height as the limit', () => {
    const r = computeFrameRect({
      viewportWidth: 1600,
      viewportHeight: 400,
      aspectRatio: 1.586,
      paddingPx: 24,
    });
    expect(r.height).toBe(400 - 48);
    expect(r.width).toBe(Math.round((400 - 48) * 1.586));
    expect(r.y).toBe(24);
    expect(r.x).toBe(Math.round((1600 - r.width) / 2));
  });
});

describe('brightnessFromGray', () => {
  it('averages 0..255 luminance values', () => {
    const data = new Uint8ClampedArray([0, 128, 255, 64]);
    expect(brightnessFromGray(data)).toBeCloseTo((0 + 128 + 255 + 64) / 4, 3);
  });
});

describe('sharpnessFromGray', () => {
  it('returns 0 for a flat image (no edges)', () => {
    const w = 8;
    const h = 8;
    const flat = new Uint8ClampedArray(w * h).fill(120);
    expect(sharpnessFromGray(flat, w, h)).toBe(0);
  });

  it('returns a positive value for a checkerboard', () => {
    const w = 8;
    const h = 8;
    const checker = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        checker[y * w + x] = (x + y) % 2 === 0 ? 0 : 255;
      }
    }
    expect(sharpnessFromGray(checker, w, h)).toBeGreaterThan(100);
  });
});

describe('isStable', () => {
  it('false when too dark', () => {
    expect(
      isStable({ brightness: 30, sharpness: 500 }, STABILITY_THRESHOLDS),
    ).toBe(false);
  });

  it('false when too blurry', () => {
    expect(
      isStable({ brightness: 140, sharpness: 20 }, STABILITY_THRESHOLDS),
    ).toBe(false);
  });

  it('true when bright and sharp enough', () => {
    expect(
      isStable({ brightness: 140, sharpness: 500 }, STABILITY_THRESHOLDS),
    ).toBe(true);
  });
});

describe('pickInitialMode', () => {
  it('prefers camera on mobile when available', () => {
    expect(pickInitialMode({ hasCamera: true, isMobile: true })).toBe('camera');
  });

  it('prefers upload on desktop even when camera is available', () => {
    expect(pickInitialMode({ hasCamera: true, isMobile: false })).toBe('upload');
  });

  it('falls back to upload when no camera', () => {
    expect(pickInitialMode({ hasCamera: false, isMobile: true })).toBe('upload');
    expect(pickInitialMode({ hasCamera: false, isMobile: false })).toBe('upload');
  });
});

describe('validateUploadFile', () => {
  const blob = (type: string, size = 1024) =>
    ({ type, size }) as unknown as File;

  it('accepts JPEG', () => {
    expect(validateUploadFile(blob('image/jpeg'))).toEqual({ ok: true });
  });

  it('accepts PNG', () => {
    expect(validateUploadFile(blob('image/png'))).toEqual({ ok: true });
  });

  it('accepts HEIC', () => {
    expect(validateUploadFile(blob('image/heic'))).toEqual({ ok: true });
  });

  it('rejects PDF', () => {
    const r = validateUploadFile(blob('application/pdf'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/image/i);
  });

  it('rejects empty file', () => {
    const r = validateUploadFile(blob('image/jpeg', 0));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/empty/i);
  });
});
