import { describe, it, expect } from 'vitest';
import { buildReliefField, bulgeLine, packedAlpha, CAPTURE_VISUAL_SPEC, type ScreenLandmark } from '../capture/contour-scan';
import { trianglesFromTessellation } from '../capture/media-pipe';

const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

/**
 * A synthetic face: a 20x24 lattice of landmarks over an ellipse in screen
 * px, z a dome (nearest at the centre), triangulated in quads. The FACE_OVAL
 * ring and anchors (10, 152, 234, 454) sit on the outline. A small patch in
 * the middle has no triangles, like an eye opening.
 */
function synthFace(cx = 195, cy = 340, w = 220, h = 300) {
  const NX = 20, NY = 24;
  const lms: ScreenLandmark[] = new Array(478).fill(null).map(() => ({ x: cx, y: cy, z: 0.05 }));
  const idx = (i: number, j: number) => j * NX + i; // 0..479 -> use first 468 slots
  const lattice: number[][] = [];
  for (let j = 0; j < NY; j++) {
    lattice.push([]);
    for (let i = 0; i < NX; i++) {
      const u = i / (NX - 1) * 2 - 1, v = j / (NY - 1) * 2 - 1;
      const k = idx(i, j);
      if (k >= 468) { lattice[j].push(-1); continue; }
      const r2 = Math.min(1, u * u + v * v);
      lms[k] = { x: cx + u * w / 2 * Math.sqrt(1 - Math.min(0.999, v * v) * 0) , y: cy + v * h / 2, z: 0.05 - 0.1 * (1 - r2) };
      lattice[j].push(k);
    }
  }
  const tris: number[][] = [];
  for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const a = lattice[j][i], b = lattice[j][i + 1], c = lattice[j + 1][i], d = lattice[j + 1][i + 1];
    if ([a, b, c, d].some((k) => k < 0)) continue;
    if (i >= 8 && i <= 10 && j >= 8 && j <= 9) continue; // an "eye" opening
    tris.push([a, b, d], [a, d, c]);
  }
  // Outline: the ring at the ellipse edge, all at the edge depth.
  FACE_OVAL.forEach((k, n) => {
    const t = (n / FACE_OVAL.length) * Math.PI * 2 - Math.PI / 2;
    lms[k] = { x: cx + Math.cos(t) * w / 2, y: cy + Math.sin(t) * h / 2, z: 0.05 };
  });
  return { lms, tris };
}

describe('trianglesFromTessellation', () => {
  it('reads 3 edges per triangle, in order', () => {
    const edges = [{ start: 1, end: 2 }, { start: 2, end: 3 }, { start: 3, end: 1 }, { start: 4, end: 5 }, { start: 5, end: 6 }, { start: 6, end: 4 }];
    expect(trianglesFromTessellation(edges)).toEqual([[1, 2, 3], [4, 5, 6]]);
    expect(trianglesFromTessellation(undefined)).toBeNull();
    expect(trianglesFromTessellation([{ start: 'a' }, {}, {}])).toBeNull();
  });
});

describe('buildReliefField (relief v3.1)', () => {
  const W = 390, H = 844, cols = CAPTURE_VISUAL_SPEC.relief.grid, rows = Math.round((cols * H) / W), cell = W / cols;
  const { lms, tris } = synthFace();
  const { field, detail, faceH, cy, ry } = buildReliefField(lms, tris, cols, rows, cell);
  const at = (f: Float32Array, x: number, y: number) => f[Math.floor(y / cell) * cols + Math.floor(x / cell)];

  it('bulge field is the bump alone, taller above the centre, flat far away, with no NaN', () => {
    expect(cols).toBe(64);
    expect(faceH).toBeGreaterThan(200);
    expect(cy).toBeCloseTo((lms[10].y + lms[152].y) / 2 + 0.05 * faceH, 5);
    expect(ry).toBeCloseTo(0.65 * faceH, 5);
    for (const v of field) expect(Number.isFinite(v)).toBe(true);
    for (const v of detail) expect(Number.isFinite(v)).toBe(true);
    expect(at(field, 195, cy)).toBeGreaterThan(0.8);
    // Same distance above and below the centre: higher above (ry_up 0.85 > 0.65).
    const d = 0.5 * ry;
    expect(at(field, 195, cy - d)).toBeGreaterThan(at(field, 195, cy + d) + 0.1);
    expect(at(field, 10, 800)).toBe(0);
    expect(at(field, 380, 30)).toBe(0);
  });

  it('detail field peaks on the face, fills an opening and has no cliff at the edge', () => {
    expect(at(detail, 195, 340)).toBeGreaterThan(0.4);
    expect(at(detail, 10, 800)).toBeLessThan(0.01);
    // The "eye" opening is filled from the surrounding depth.
    expect(Math.abs(at(detail, 195, 330) - at(detail, 225, 330))).toBeLessThan(0.3);
    let maxStep = 0;
    for (let y = 0; y < rows; y++) for (let x = 1; x < cols; x++) {
      maxStep = Math.max(maxStep, Math.abs(detail[y * cols + x] - detail[y * cols + x - 1]));
    }
    expect(maxStep).toBeLessThan(0.25);
  });
});

describe('bulgeLine', () => {
  const R = CAPTURE_VISUAL_SPEC.relief;
  const flat = new Float32Array(3).fill(-1e9);
  const none = [0, 0, 0];

  it('pushes lines up above the centre and down below it, more up than down', () => {
    const cy = 400, ry = 200;
    const up = bulgeLine(cy - ry, [0, 1, 0], none, cy, ry, flat);
    const down = bulgeLine(cy + ry, [0, 1, 0], none, cy, ry, flat);
    expect(up[0]).toBe(cy - ry);
    expect(up[1]).toBeCloseTo(cy - ry - R.ampUp * ry * Math.tanh(4), 4);
    expect(down[1]).toBeCloseTo(cy + ry + R.ampDown * ry * Math.tanh(4), 4);
    expect(cy - ry - up[1]).toBeGreaterThan(down[1] - (cy + ry));
  });

  it('lifts by the detail even at the centre (not scaled by tanh)', () => {
    const cy = 400, ry = 200;
    const out = bulgeLine(cy, [1, 1, 1], [0, 1, 0.5], cy, ry, flat);
    expect(out[0]).toBe(cy);
    expect(out[1]).toBeCloseTo(cy - R.detailLiftOfRy * ry, 4);
    expect(out[2]).toBeCloseTo(cy - 0.5 * R.detailLiftOfRy * ry, 4);
  });

  it('keeps every line at least 2.5 px below the line above', () => {
    const cy = 380, ry = 190;
    let prev: Float32Array = new Float32Array(5).fill(-1e9);
    for (let k = 0; k < 80; k++) {
      const y = k * R.spacing;
      const r = (y - cy) / ry;
      const f = Math.abs(r) < 1 ? (1 - r * r) ** 2 : 0;
      const cur = bulgeLine(y, [0, f * 0.5, f, f * 0.5, 0], [0, f, f, f, 0], cy, ry, prev);
      for (let j = 0; j < 5; j++) expect(cur[j] - prev[j]).toBeGreaterThanOrEqual(R.minGap - 1e-6);
      prev = cur;
    }
  });
});

describe('packedAlpha', () => {
  it('fades packed lines to the floor and leaves spaced lines alone', () => {
    expect(packedAlpha(0)).toBeCloseTo(0.25, 6);
    expect(packedAlpha(4.5)).toBeCloseTo(0.25 + 0.75 * 0.5, 6);
    expect(packedAlpha(9)).toBe(1);
    expect(packedAlpha(30)).toBe(1);
    expect(packedAlpha(-1)).toBeCloseTo(0.25, 6);
  });
});
