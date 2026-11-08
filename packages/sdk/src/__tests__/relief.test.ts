import { describe, it, expect } from 'vitest';
import { buildReliefField, liftLine, CAPTURE_VISUAL_SPEC, type ScreenLandmark } from '../capture/contour-scan';
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

describe('buildReliefField (relief v2)', () => {
  const W = 390, H = 844, cols = CAPTURE_VISUAL_SPEC.relief.grid, rows = Math.round((cols * H) / W), cell = W / cols;
  const { lms, tris } = synthFace();
  const { field, faceH } = buildReliefField(lms, tris, cols, rows, cell);
  const at = (x: number, y: number) => field[Math.floor(y / cell) * cols + Math.floor(x / cell)];

  it('peaks on the face, is flat far away, and has no NaN', () => {
    expect(faceH).toBeGreaterThan(200);
    for (const v of field) expect(Number.isFinite(v)).toBe(true);
    expect(at(195, 300)).toBeGreaterThan(0.5);
    expect(at(10, 800)).toBe(0);
    expect(at(380, 30)).toBe(0);
  });

  it('fills an opening with no triangles from the surrounding depth', () => {
    // The "eye" opening sits inside the face; it must not drop to the dome.
    const around = at(195 + 30, 330);
    const hole = at(195, 330);
    expect(hole).toBeGreaterThan(0.3);
    expect(Math.abs(hole - around)).toBeLessThan(0.35);
  });

  it('blends the face edge into the surround (no cliff)', () => {
    let maxStep = 0;
    for (let y = 0; y < rows; y++) for (let x = 1; x < cols; x++) {
      maxStep = Math.max(maxStep, Math.abs(field[y * cols + x] - field[y * cols + x - 1]));
    }
    expect(maxStep).toBeLessThan(0.25);
  });
});

describe('liftLine', () => {
  it('lifts by depth but never comes within minGap of the line above', () => {
    const above = Float32Array.from([100, 100, 100]);
    const out = liftLine(107, [0, 0.5, 1], 20, above, 3);
    expect(Array.from(out)).toEqual([107, 103, 103]);
    // Successive lines never cross, whatever the depth.
    let prev = new Float32Array(5).fill(-1e9);
    for (let k = 0; k < 40; k++) {
      const cur = liftLine(k * 7, [0, 2, 5, 2, 0].map((d) => d * (k % 3)), 30, prev, 3);
      for (let j = 0; j < 5; j++) expect(cur[j] - prev[j]).toBeGreaterThanOrEqual(3 - 1e-6);
      prev = cur;
    }
  });
});
