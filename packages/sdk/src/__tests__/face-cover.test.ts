import { describe, it, expect } from 'vitest';
import {
  measureFaceCover, isCovered, CoverWatch, measureFaceRegions, distinctFaceCount, boxIoU,
  COVER_THRESHOLDS, SEGMENT_CATEGORY as C,
} from '../capture/face-cover';
import { FACE_OVAL, QualityGate, GATE_CHECKS, GATE_HINTS, hintFor } from '../capture/quality-gate';
import { SegmenterModelInfo } from '../segmenter-model-info';

/**
 * Synthetic landmarks (no real face): 478 points in normalised frame
 * coordinates, FACE_OVAL on an ellipse centred at (cx, cy) with half-sizes
 * (rx, ry), the change-watch anchors inside it.
 */
function synthLandmarks(cx = 0.5, cy = 0.5, rx = 0.2, ry = 0.28) {
  const lm = Array.from({ length: 478 }, () => ({ x: cx, y: cy }));
  FACE_OVAL.forEach((k, n) => {
    const t = (n / FACE_OVAL.length) * Math.PI * 2 - Math.PI / 2;
    lm[k] = { x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry };
  });
  lm[234] = { x: cx - rx, y: cy };
  lm[454] = { x: cx + rx, y: cy };
  lm[151] = { x: cx, y: cy - 0.55 * ry }; // forehead
  lm[50] = { x: cx - 0.5 * rx, y: cy + 0.1 * ry }; // cheeks
  lm[280] = { x: cx + 0.5 * rx, y: cy + 0.1 * ry };
  lm[5] = { x: cx, y: cy }; // nose
  lm[13] = { x: cx, y: cy + 0.4 * ry }; // mouth
  lm[199] = { x: cx, y: cy + 0.7 * ry }; // chin
  return lm;
}

/** A category mask: background, the face ellipse as face skin, then `paint`. */
function mask(size: number, lm: ReturnType<typeof synthLandmarks>, paint?: (x: number, y: number) => number | undefined) {
  const m = new Uint8Array(size * size);
  const rx = lm[454].x - 0.5, ry = lm[199].y - 0.5;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x + 0.5) / size, ny = (y + 0.5) / size;
    const inFace = ((nx - 0.5) / rx) ** 2 + ((ny - 0.5) / (ry / 0.7)) ** 2 <= 1;
    m[y * size + x] = paint?.(nx, ny) ?? (inFace ? C.faceSkin : C.background);
  }
  return m;
}

describe('measureFaceCover', () => {
  const lm = synthLandmarks();

  it('reads a clear face as clear, even with the background just outside the shrunk outline', () => {
    const c = measureFaceCover(mask(256, lm), 256, 256, lm, 480, 480)!;
    expect(c.bodySkin).toBe(0);
    expect(c.other).toBeLessThan(0.05);
    expect(isCovered(c)).toBe(false);
  });

  it('a hand (body skin) over the mouth and chin is covered', () => {
    const m = mask(256, lm, (x, y) => (y > 0.58 && Math.abs(x - 0.5) < 0.18 ? C.bodySkin : undefined));
    const c = measureFaceCover(m, 256, 256, lm, 480, 480)!;
    expect(c.bodySkin).toBeGreaterThanOrEqual(COVER_THRESHOLDS.bodySkinMax);
    expect(isCovered(c)).toBe(true);
  });

  it('a phone or paper (other) over a quarter of the face is covered', () => {
    const m = mask(256, lm, (x) => (x > 0.56 && x < 0.75 ? C.others : undefined));
    expect(isCovered(measureFaceCover(m, 256, 256, lm, 480, 480))).toBe(true);
  });

  it('hair over the forehead and a small skin patch stay clear', () => {
    const m = mask(256, lm, (x, y) =>
      y < 0.38 && Math.abs(x - 0.5) < 0.2 ? C.hair : Math.hypot(x - 0.6, y - 0.6) < 0.02 ? C.bodySkin : undefined);
    const c = measureFaceCover(m, 256, 256, lm, 480, 480)!;
    expect(c.bodySkin).toBeLessThan(COVER_THRESHOLDS.bodySkinMax);
    expect(isCovered(c)).toBe(false);
  });

  it('works for any mask size (normalised landmarks) and needs a full mesh', () => {
    const m = mask(64, lm, (x, y) => (y > 0.58 && Math.abs(x - 0.5) < 0.18 ? C.bodySkin : undefined));
    expect(isCovered(measureFaceCover(m, 64, 64, lm, 480, 480))).toBe(true);
    expect(measureFaceCover(m, 64, 64, lm.slice(0, 100), 480, 480)).toBeNull();
  });

  it('thresholds are exactly the spec (shared with iOS and Android)', () => {
    expect(isCovered({ bodySkin: 0.12, other: 0 })).toBe(true);
    expect(isCovered({ bodySkin: 0.1199, other: 0.2499 })).toBe(false);
    expect(isCovered({ bodySkin: 0, other: 0.25 })).toBe(true);
    expect(COVER_THRESHOLDS.maxAgeMs).toBe(3000);
    expect(COVER_THRESHOLDS.finalWaitMs).toBe(2500);
  });
});

/** A W x H RGBA image of a smooth "skin" gradient; `paint` overrides pixels. */
function image(W: number, H: number, gain = 1, paint?: (x: number, y: number) => [number, number, number] | undefined) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const p = paint?.(x, y) ?? [200 - y * 0.2, 150 - y * 0.15, 120 - y * 0.1];
    d[i] = p[0] * gain; d[i + 1] = p[1] * gain; d[i + 2] = p[2] * gain; d[i + 3] = 255;
  }
  return d;
}

describe('CoverWatch (six-region change watch)', () => {
  const W = 200, H = 260;
  const pts = synthLandmarks(0.5, 0.5, 0.35, 0.3).map((p) => ({ x: p.x * W, y: p.y * H }));
  const regions = (gain = 1, paint?: Parameters<typeof image>[3]) => measureFaceRegions(image(W, H, gain, paint), W, H, pts);

  it('stays clear on a steady face and through a global brightness change (fill light)', () => {
    const w = new CoverWatch();
    for (let i = 0; i < 3; i++) expect(w.covered(regions())).toBe(false);
    expect(w.covered(regions())).toBe(false);
    expect(w.covered(regions(1.15))).toBe(false);
  });

  it('flags a hand over the mouth and chin (colour and edges change)', () => {
    const w = new CoverWatch();
    for (let i = 0; i < 3; i++) w.covered(regions());
    const hand = (x: number, y: number): [number, number, number] | undefined =>
      y > pts[13].y - 12 ? (((x >> 2) & 1) ? [235, 175, 160] : [120, 80, 70]) : undefined;
    expect(w.covered(regions(1, hand))).toBe(true);
    expect([4, 5]).toContain(w.lastRegion); // mouth or chin
  });

  it('flags a flat object (paper) over the nose', () => {
    const w = new CoverWatch();
    for (let i = 0; i < 3; i++) w.covered(regions());
    const paper = (x: number, y: number): [number, number, number] | undefined =>
      Math.abs(x - pts[5].x) < 30 && Math.abs(y - pts[5].y) < 30 ? [245, 245, 245] : undefined;
    expect(w.covered(regions(1, paper))).toBe(true);
  });

  it('takes a new baseline after reset, and ignores a missing measurement', () => {
    const w = new CoverWatch();
    for (let i = 0; i < 3; i++) w.covered(regions());
    w.reset();
    const tinted = (): [number, number, number] => [120, 160, 200];
    for (let i = 0; i < 3; i++) expect(w.covered(regions(1, tinted))).toBe(false);
    expect(w.covered(regions(1, tinted))).toBe(false);
    expect(w.covered(null)).toBe(false);
  });

  it('returns null when a patch falls off the image', () => {
    const off = pts.map((p) => ({ x: p.x + 500, y: p.y }));
    expect(measureFaceRegions(image(W, H), W, H, off)).toBeNull();
  });
});

describe('one person: the same face found twice', () => {
  const face = (cx: number, s = 0.2) => [{ x: cx - s, y: 0.3 }, { x: cx + s, y: 0.7 }];

  it('counts an overlapping duplicate (IoU >= 0.3) once and a separate face twice', () => {
    expect(boxIoU([0, 0, 1, 1], [0, 0, 1, 1])).toBe(1);
    expect(distinctFaceCount([face(0.5), face(0.52)], 0)).toBe(1);
    expect(distinctFaceCount([face(0.3, 0.1), face(0.75, 0.1)], 0)).toBe(2);
    expect(distinctFaceCount([face(0.5)], 0)).toBe(1);
    expect(distinctFaceCount([], 0)).toBe(0);
  });
});

describe('quality gate: covered', () => {
  const lm = synthLandmarks(195, 330, 90, 120);
  lm[468] = { x: 165, y: 300 }; // irises, so the eye distance (stillness scale) is set
  lm[473] = { x: 225, y: 300 };
  const base = { faceCount: 1, screenLandmarks: lm };

  it('sits after one_person in the check order, with the shared copy', () => {
    expect(GATE_CHECKS.indexOf('covered')).toBe(GATE_CHECKS.indexOf('one_person') + 1);
    expect(GATE_CHECKS.indexOf('covered')).toBeLessThan(GATE_CHECKS.indexOf('distance'));
    expect(GATE_HINTS.covered).toBe('Keep your face uncovered');
    expect(hintFor('covered', {})).toEqual({ id: 'covered', text: 'Keep your face uncovered' });
  });

  it('fails and blocks when covered, passes when clear, unknown when not checked', () => {
    const g = new QualityGate();
    for (let i = 0; i < 3; i++) g.evaluate({ ...base, now: i * 30 });
    const r = g.evaluate({ ...base, now: 100, covered: true });
    expect(r.checks.covered).toBe('fail');
    expect(r.firstBlocking).toBe('covered');
    expect(r.allPass).toBe(false);
    expect(g.evaluate({ ...base, now: 130, covered: false }).checks.covered).toBe('pass');
    expect(g.evaluate({ ...base, now: 160 }).checks.covered).toBe('unknown');
  });

  it('holds ("Hold still") until the first segmentation result', () => {
    const g = new QualityGate();
    for (let i = 0; i < 20; i++) g.evaluate({ ...base, now: i * 30, covered: false });
    expect(g.evaluate({ ...base, now: 630, covered: false }).checks.stillness).toBe('pass');
    const r = g.evaluate({ ...base, now: 660, covered: false, coverPending: true });
    expect(r.checks.stillness).toBe('fail');
    expect(hintFor('stillness', {}).text).toBe('Hold still');
  });
});

describe('SegmenterModelInfo', () => {
  it('pins the model shared with iOS and Android, by hash, on the landmarker host', () => {
    expect(SegmenterModelInfo.sha256).toBe('c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0');
    expect(SegmenterModelInfo.sizeBytes).toBe(16371837);
    expect(SegmenterModelInfo.defaultCdnUrl).toContain(`/${SegmenterModelInfo.sha256}/`);
    expect(SegmenterModelInfo.defaultCdnUrl.startsWith('https://cdn.usesense.ai/mediapipe/')).toBe(true);
    expect(SegmenterModelInfo.sourceUrl).toContain('/selfie_multiclass_256x256/float32/1/');
  });
});
