/**
 * Capture canvas: the align guide, the scan's contour lines and progress ring
 * (LiveSense capture redesign, Phase 1).
 *
 * Ported from the cross-platform visual reference
 * (capture-test-kit/reference/index.html, "LiveSense capture visual spec v1").
 * Every number lives in {@link CAPTURE_VISUAL_SPEC}; iOS and Android use the
 * same values.
 *
 * The contour is a screen-space depth field built from the face mesh: a
 * Gaussian splat of each landmark's relative depth (facial detail), plus a head
 * dome fitted to the face so lines also lift over the hair, blurred and
 * smoothed over time. Lines run edge to edge across the screen and are lifted
 * by the field, so they stay flat away from the face and bend over the head.
 *
 * Display only. MediaPipe's z is a guess from one flat image, so nothing here
 * is evidence of depth and nothing here is uploaded.
 */

import type { Ellipse } from './quality-gate';

// ============================================================================
// Spec
// ============================================================================

export const CAPTURE_VISUAL_SPEC = {
  /** Ellipse in screen fractions; rx is a fraction of the phone-width stage. */
  oval: { cx: 0.5, cy: 0.4, rxOfW: 0.36, ryOfH: 0.235 },
  guide: { fill: 'rgba(255,255,255,0.14)', stroke: 'rgba(255,255,255,0.90)', width: 2 },
  ring: { track: 'rgba(255,255,255,0.18)', width: 3, gap: 6 },
  lines: {
    spacing: 7,
    width: 1.0,
    sampleStep: 3,
    top: 0,
    bottomOfH: 0.84,
    fadeOfH: 0.14,
    ampOfFaceH: 0.16,
    flatAlpha: 0.5,
    peakAlpha: 0.95,
  },
  depth: { grid: 96, splatSigma: 2.6, blurSigma: 1.8, emaAlpha: 0.3, feather: 0.35, meshWeight: 0.8 },
  dome: { rxOfFaceW: 0.62, ryOfFaceH: 0.78, cyShiftOfFaceH: -0.12, height: 0.62, feather: 0.18 },
  /**
   * Relief v2 (spec v1.4, RELIEF-v2.md): the face mesh's triangles rasterised
   * into a dense depth map, so the nose, brow, cheeks and chin read clearly.
   */
  relief: {
    grid: 130,
    domeHeight: 0.5,
    meshHeight: 0.7,
    blurSigma: 0.9,
    /** Max lift as a fraction of face height. */
    amp: 0.28,
    /** A line never comes closer than this (px) to the line above. */
    minGap: 3,
    /** Top-lit shading strength. */
    light: 0.3,
    fillSigma: 3,
    edgeSigma: 2,
    edgeLo: 0.15,
    edgeHi: 0.95,
  },
  sweep: { durationMs: 520, lineFadeMs: 140 },
  /** Darken the camera this much under the lines during the scan. */
  feedDimDuringScan: 0.12,
  /** Keep the last field this long when the face drops out. */
  faceHoldMs: 300,
  /** Fill light: a warm veil over the whole screen (#FFF4E2 at 38%), spec v1.3. */
  fillLight: { color: 'rgba(255,244,226,0.38)' },
} as const;

/** Phone-shaped stage width: the full width on a phone, a phone column on a desktop. */
export function stageWidth(W: number, H: number): number {
  return Math.min(W, (H * 390) / 844);
}

/** The face oval for a W x H screen, px. */
export function captureOval(W: number, H: number): Ellipse {
  const o = CAPTURE_VISUAL_SPEC.oval;
  return { cx: W * o.cx, cy: H * o.cy, rx: stageWidth(W, H) * o.rxOfW, ry: H * o.ryOfH };
}

// ============================================================================
// Depth field (pure)
// ============================================================================

export interface ScreenLandmark {
  /** Screen px (already aspect-fill mapped and mirrored like the preview). */
  x: number;
  y: number;
  /** MediaPipe z (smaller = nearer the camera). */
  z: number;
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Separable Gaussian blur with clamped edges. */
export function gaussBlur(src: Float32Array, cols: number, rows: number, sigma: number): Float32Array {
  const r = Math.ceil(sigma * 2.5);
  const k: number[] = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) { const w = Math.exp(-(i * i) / (2 * sigma * sigma)); k.push(w); sum += w; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < rows; y++) {
    const row = y * cols;
    for (let x = 0; x < cols; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) a += src[row + Math.min(cols - 1, Math.max(0, x + i))] * k[i + r];
      tmp[row + x] = a;
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) a += tmp[Math.min(rows - 1, Math.max(0, y + i)) * cols + x] * k[i + r];
      out[y * cols + x] = a;
    }
  }
  return out;
}

/**
 * One frame's depth field (0..1) on a cols x rows grid of `cell`-px cells,
 * plus the face height in px (forehead 10 to chin 152). Needs the 468+ mesh.
 */
export function buildDepthField(
  lms: ScreenLandmark[],
  cols: number,
  rows: number,
  cell: number,
): { field: Float32Array; faceH: number } {
  const D = CAPTURE_VISUAL_SPEC.depth;
  const n = cols * rows;
  const acc = new Float32Array(n);
  const wsum = new Float32Array(n);
  let zmin = Infinity, zmax = -Infinity;
  for (const p of lms) { if (p.z < zmin) zmin = p.z; if (p.z > zmax) zmax = p.z; }
  const zr = Math.max(1e-6, zmax - zmin);
  const sig = D.splatSigma;
  const r = Math.ceil(sig * 2.5);
  const inv2s2 = 1 / (2 * sig * sig);
  // 1. Mesh detail: Gaussian splat of relative depth (nose tip ~1, edge ~0).
  for (const p of lms) {
    const d = (zmax - p.z) / zr;
    const gx = p.x / cell, gy = p.y / cell;
    const ix = Math.round(gx), iy = Math.round(gy);
    for (let y = iy - r; y <= iy + r; y++) {
      if (y < 0 || y >= rows) continue;
      for (let x = ix - r; x <= ix + r; x++) {
        if (x < 0 || x >= cols) continue;
        const w = Math.exp(-((x - gx) ** 2 + (y - gy) ** 2) * inv2s2);
        const i = y * cols + x;
        acc[i] += w * d;
        wsum[i] += w;
      }
    }
  }
  let raw: Float32Array = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    raw[i] = wsum[i] > 1e-6 ? (acc[i] / wsum[i]) * smoothstep(0, D.feather, wsum[i]) : 0;
  }
  raw = gaussBlur(raw, cols, rows, D.blurSigma);

  // 2. Head dome from forehead (10), chin (152) and cheeks (234, 454).
  const top = lms[10], chin = lms[152], left = lms[234], right = lms[454];
  const faceH = Math.hypot(chin.x - top.x, chin.y - top.y);
  const faceW = Math.abs(right.x - left.x);
  const M = CAPTURE_VISUAL_SPEC.dome;
  const dcx = (top.x + chin.x) / 2;
  const dcy = (top.y + chin.y) / 2 + M.cyShiftOfFaceH * faceH;
  const drx = Math.max(1, M.rxOfFaceW * faceW);
  const dry = Math.max(1, M.ryOfFaceH * faceH);
  // 3. Combine.
  for (let gy = 0; gy < rows; gy++) {
    const y = (gy + 0.5) * cell;
    for (let gx = 0; gx < cols; gx++) {
      const x = (gx + 0.5) * cell;
      const r2 = ((x - dcx) / drx) ** 2 + ((y - dcy) / dry) ** 2;
      const dome = r2 < 1 ? Math.pow(1 - r2, 0.75) * M.height * smoothstep(1, 1 - M.feather, Math.sqrt(r2)) : 0;
      const i = gy * cols + gx;
      raw[i] = Math.min(1, dome + raw[i] * D.meshWeight);
    }
  }
  return { field: raw, faceH };
}

/**
 * One relief line's y at each sample: lifted by depth, but never closer than
 * `minGap` px to the line above at the same x (so lines cannot cross).
 */
export function liftLine(
  y: number, depth: ArrayLike<number>, amp: number, above: ArrayLike<number>, minGap: number,
  out: Float32Array = new Float32Array(depth.length),
): Float32Array {
  for (let j = 0; j < depth.length; j++) out[j] = Math.max(y - depth[j] * amp, above[j] + minGap);
  return out;
}

/** MediaPipe FACE_OVAL ring (the face silhouette). */
const FACE_OVAL_RING = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

/**
 * Relief v2 depth field (0..~1.2) on a cols x rows grid of `cell`-px cells,
 * plus the face height in px. Ported from the reference updateField:
 * 1. depth per landmark from the face outline: d = max(0, (zEdge - z) / (zEdge - zMin));
 * 2. rasterise each mesh triangle with barycentric depth (weights >= -0.02,
 *    keep the larger value where triangles overlap);
 * 3. fill the eye and mouth openings by normalised convolution (sigma 3);
 * 4. soft edge: smoothstep(0.15, 0.95, blur(cover, 2));
 * 5. raw = 0.5 * dome + 0.7 * mesh, then blur 0.9.
 */
export function buildReliefField(
  lms: ScreenLandmark[],
  tris: number[][],
  cols: number,
  rows: number,
  cell: number,
): { field: Float32Array; faceH: number } {
  const R = CAPTURE_VISUAL_SPEC.relief;
  const n = cols * rows;
  const mesh = new Float32Array(n);
  const cover = new Float32Array(n);
  let zmin = Infinity;
  let zEdge = 0;
  for (let i = 0; i < 468; i++) if (lms[i].z < zmin) zmin = lms[i].z;
  for (const k of FACE_OVAL_RING) zEdge += lms[k].z;
  zEdge /= FACE_OVAL_RING.length;
  const zr = Math.max(1e-6, zEdge - zmin);
  const P = lms.map((p) => [p.x / cell, p.y / cell, Math.max(0, (zEdge - p.z) / zr)]);
  for (const [ia, ib, ic] of tris) {
    const A = P[ia], B = P[ib], C = P[ic];
    if (!A || !B || !C) continue;
    const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0])));
    const x1 = Math.min(cols - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
    const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1])));
    const y1 = Math.min(rows - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
    const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
    if (Math.abs(den) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w1 = ((B[1] - C[1]) * (px - C[0]) + (C[0] - B[0]) * (py - C[1])) / den;
        const w2 = ((C[1] - A[1]) * (px - C[0]) + (A[0] - C[0]) * (py - C[1])) / den;
        const w3 = 1 - w1 - w2;
        if (w1 < -0.02 || w2 < -0.02 || w3 < -0.02) continue;
        const d = w1 * A[2] + w2 * B[2] + w3 * C[2];
        const i = y * cols + x;
        if (d > mesh[i] || cover[i] === 0) mesh[i] = d;
        cover[i] = 1;
      }
    }
  }
  // Head dome for the hair and head outline (a soft surround, not the face).
  const top = lms[10], chin = lms[152], left = lms[234], right = lms[454];
  const faceH = Math.hypot(chin.x - top.x, chin.y - top.y);
  const faceW = Math.abs(right.x - left.x);
  const M = CAPTURE_VISUAL_SPEC.dome;
  const dcx = (top.x + chin.x) / 2;
  const dcy = (top.y + chin.y) / 2 + M.cyShiftOfFaceH * faceH;
  const drx = Math.max(1, M.rxOfFaceW * faceW);
  const dry = Math.max(1, M.ryOfFaceH * faceH);
  // Fill the eye and mouth openings from the surrounding depth.
  const mc = new Float32Array(n);
  for (let i = 0; i < n; i++) mc[i] = mesh[i] * cover[i];
  const num = gaussBlur(mc, cols, rows, R.fillSigma);
  const den2 = gaussBlur(cover, cols, rows, R.fillSigma);
  // Soft edge: the face blends into the dome instead of meeting it at a cliff.
  const soft = gaussBlur(cover, cols, rows, R.edgeSigma);
  for (let i = 0; i < n; i++) {
    const filled = cover[i] ? mesh[i] : (den2[i] > 1e-3 ? num[i] / den2[i] : 0);
    mesh[i] = filled * smoothstep(R.edgeLo, R.edgeHi, soft[i]);
  }
  let raw: Float32Array = new Float32Array(n);
  for (let gy = 0; gy < rows; gy++) {
    const y = (gy + 0.5) * cell;
    for (let gx = 0; gx < cols; gx++) {
      const x = (gx + 0.5) * cell;
      const r2 = ((x - dcx) / drx) ** 2 + ((y - dcy) / dry) ** 2;
      const dome = r2 < 1 ? Math.pow(1 - r2, 0.75) * smoothstep(1, 1 - M.feather, Math.sqrt(r2)) : 0;
      const i = gy * cols + gx;
      raw[i] = dome * R.domeHeight + mesh[i] * R.meshHeight;
    }
  }
  raw = gaussBlur(raw, cols, rows, R.blurSigma);
  return { field: raw, faceH };
}

// ============================================================================
// Renderer
// ============================================================================

export interface CaptureCanvasColors {
  ring: string;
  contourStart: string;
  contourEnd: string;
  warning: string;
}

export type CaptureCanvasMode = 'none' | 'align' | 'scan' | 'upload';

export interface CaptureCanvasFrame {
  mode: CaptureCanvasMode;
  /** Monotonic ms. */
  now: number;
  /** Scan progress 0-1 (ring). */
  progress?: number;
  /** Scan paused: progress drawn in the warning colour. */
  paused?: boolean;
  /** Align: a check is failing (stroke turns warning). */
  warn?: boolean;
  /**
   * Fill light: a warm veil over the whole screen so it lights the face
   * (browsers cannot raise screen brightness).
   */
  fill?: boolean;
}

function hexRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Colour/alpha steps for depth; segments are batched per step. */
const BUCKETS = 24;

export class CaptureCanvas {
  private W = 0;
  private H = 0;
  private dpr = 1;
  private cols = 0;
  private rows = 0;
  private cell = 1;
  private field = new Float32Array(0);
  private faceH = 0;
  private hasFace = false;
  private lastFaceAt = -Infinity;
  private sweepStart = 0;
  private styles: string[] = [];
  private tris: number[][] | null = null;
  private c0: [number, number, number] = [0, 0, 0];
  private c1: [number, number, number] = [0, 0, 0];
  private reliefStyles = new Map<string, string>();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private colors: CaptureCanvasColors,
    private readonly reducedMotion: boolean,
  ) {
    this.setColors(colors);
  }

  /** The canvas this renderer draws on. */
  get target(): HTMLCanvasElement {
    return this.canvas;
  }

  setColors(colors: CaptureCanvasColors): void {
    this.colors = colors;
    const c0 = hexRgb(colors.contourStart);
    const c1 = hexRgb(colors.contourEnd);
    this.c0 = c0;
    this.c1 = c1;
    this.reliefStyles.clear();
    const L = CAPTURE_VISUAL_SPEC.lines;
    this.styles = [];
    for (let b = 0; b < BUCKETS; b++) {
      const t = b / (BUCKETS - 1);
      const c = c0.map((v, i) => Math.round(v + (c1[i] - v) * t));
      const a = L.flatAlpha + (L.peakAlpha - L.flatAlpha) * t;
      this.styles.push(`rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`);
    }
  }

  /** Match the backing store and grid to the canvas's CSS size. */
  private fit(): CanvasRenderingContext2D | null {
    const c = this.canvas;
    const W = c.clientWidth, H = c.clientHeight;
    if (!W || !H) return null;
    const dpr = Math.min(3, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    if (W !== this.W || H !== this.H || dpr !== this.dpr) {
      this.W = W; this.H = H; this.dpr = dpr;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      this.cols = this.tris ? CAPTURE_VISUAL_SPEC.relief.grid : CAPTURE_VISUAL_SPEC.depth.grid;
      this.rows = Math.max(1, Math.round((this.cols * H) / W));
      this.cell = W / this.cols;
      this.field = new Float32Array(this.cols * this.rows);
      this.hasFace = false;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  /**
   * The face mesh triangles (from MediaPipe's tessellation). With them the
   * relief v2 field and lines are used; without, the v1 splat field.
   */
  setTriangles(tris: number[][] | null): void {
    if (tris === this.tris) return;
    this.tris = tris;
    this.W = 0; // re-fit the grid on the next frame
  }

  /** Start (or restart) the sweep-in. */
  startSweep(now: number): void {
    this.sweepStart = now;
  }

  /** Show every line at once (frozen debug frames). */
  revealAll(): void {
    this.sweepStart = -1e9;
  }

  /**
   * Feed one tracked frame (landmarks already in screen px). Pass null when
   * the face was not found; the last field is kept for 300 ms, then fades.
   */
  update(lms: ScreenLandmark[] | null, now: number, alpha: number = CAPTURE_VISUAL_SPEC.depth.emaAlpha): void {
    if (!this.fit()) return;
    if (!lms || lms.length < 468) {
      if (now - this.lastFaceAt > CAPTURE_VISUAL_SPEC.faceHoldMs) {
        for (let i = 0; i < this.field.length; i++) this.field[i] *= 1 - alpha;
      }
      return;
    }
    const { field, faceH } = this.tris
      ? buildReliefField(lms, this.tris, this.cols, this.rows, this.cell)
      : buildDepthField(lms, this.cols, this.rows, this.cell);
    const a = this.hasFace ? (this.reducedMotion ? Math.min(alpha, 0.12) : alpha) : 1;
    for (let i = 0; i < field.length; i++) this.field[i] += (field[i] - this.field[i]) * a;
    this.faceH = faceH;
    this.hasFace = true;
    this.lastFaceAt = now;
  }

  /** Bilinear sample at a screen point (same convention as the reference). */
  private sample(x: number, y: number): number {
    const gx = x / this.cell, gy = y / this.cell;
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const cols = this.cols, rows = this.rows, f = this.field;
    const g = (xx: number, yy: number) => (xx < 0 || yy < 0 || xx >= cols || yy >= rows ? 0 : f[yy * cols + xx]);
    return g(x0, y0) * (1 - fx) * (1 - fy) + g(x0 + 1, y0) * fx * (1 - fy) + g(x0, y0 + 1) * (1 - fx) * fy + g(x0 + 1, y0 + 1) * fx * fy;
  }

  clear(): void {
    const ctx = this.fit();
    if (ctx) ctx.clearRect(0, 0, this.W, this.H);
  }

  draw(frame: CaptureCanvasFrame): void {
    const ctx = this.fit();
    if (!ctx) return;
    const { W, H } = this;
    ctx.clearRect(0, 0, W, H);
    if (frame.mode === 'none') return;
    const o = captureOval(W, H);
    if (frame.fill) {
      // Under the guide, ring and lines; the camera shows through.
      ctx.fillStyle = CAPTURE_VISUAL_SPEC.fillLight.color;
      ctx.fillRect(0, 0, W, H);
    }
    if (frame.mode === 'align') {
      const G = CAPTURE_VISUAL_SPEC.guide;
      ctx.beginPath();
      ctx.ellipse(o.cx, o.cy, o.rx, o.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = G.fill;
      ctx.fill();
      ctx.lineWidth = G.width;
      ctx.strokeStyle = frame.warn ? this.colors.warning : G.stroke;
      ctx.stroke();
      return;
    }
    // scan / upload: dim the feed, lines, ring (scan only)
    ctx.fillStyle = `rgba(13,15,20,${CAPTURE_VISUAL_SPEC.feedDimDuringScan})`;
    ctx.fillRect(0, 0, W, H);
    if (this.hasFace) {
      const revealT = this.reducedMotion ? 1e9 : frame.now - this.sweepStart;
      if (this.tris) this.drawRelief(ctx, revealT);
      else this.drawLines(ctx, revealT);
    }
    if (frame.mode === 'scan') this.drawRing(ctx, o, frame.progress ?? 0, !!frame.paused);
  }

  private drawLines(ctx: CanvasRenderingContext2D, revealT: number): void {
    const L = CAPTURE_VISUAL_SPEC.lines;
    const S = CAPTURE_VISUAL_SPEC.sweep;
    const { W, H } = this;
    const amp = L.ampOfFaceH * this.faceH;
    const bottom = H * L.bottomOfH;
    const fadeStart = bottom - H * L.fadeOfH;
    const count = Math.floor((bottom - L.top) / L.spacing);
    ctx.lineWidth = L.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let k = 0; k <= count; k++) {
      const y = L.top + k * L.spacing;
      const appearAt = (k / count) * S.durationMs;
      const a0 = Math.min(1, Math.max(0, (revealT - appearAt) / S.lineFadeMs));
      if (a0 <= 0) continue;
      const edgeFade = y > fadeStart ? 1 - (y - fadeStart) / (bottom - fadeStart) : 1;
      const lineAlpha = a0 * edgeFade;
      if (lineAlpha <= 0.002) continue;
      ctx.globalAlpha = lineAlpha;
      // Consecutive segments in the same depth bucket share one stroke, so a
      // flat line away from the face is a single draw call.
      let pd = this.sample(0, y);
      let px = 0, py = y - pd * amp;
      let bucket = -1;
      for (let x = L.sampleStep; x <= W + L.sampleStep; x += L.sampleStep) {
        const d = this.sample(x, y);
        const ny = y - d * amp;
        const t = Math.min(1, (d + pd) / 2);
        const b = Math.round(t * (BUCKETS - 1));
        if (b !== bucket) {
          if (bucket >= 0) ctx.stroke();
          bucket = b;
          ctx.strokeStyle = this.styles[b];
          ctx.beginPath();
          ctx.moveTo(px, py);
        }
        ctx.lineTo(x, ny);
        px = x; py = ny; pd = d;
      }
      if (bucket >= 0) ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Relief v2 lines (ported from the reference drawLines): lift 0.28 x face
   * height, each line kept at least 3 px below the line above at every x
   * (computed for every line, revealed or not), colour and alpha by local
   * depth (t = depth / 0.8) and top-lit shading (1 + 0.3 x slope). Segments
   * that share a quantised colour and shade are batched into one stroke.
   */
  private drawRelief(ctx: CanvasRenderingContext2D, revealT: number): void {
    const L = CAPTURE_VISUAL_SPEC.lines;
    const R = CAPTURE_VISUAL_SPEC.relief;
    const S = CAPTURE_VISUAL_SPEC.sweep;
    const { W, H, cell } = this;
    const amp = R.amp * this.faceH;
    const bottom = H * L.bottomOfH;
    const fadeStart = bottom - H * L.fadeOfH;
    const count = Math.floor((bottom - L.top) / L.spacing);
    const nS = Math.ceil(W / L.sampleStep) + 2;
    let prev = new Float32Array(nS).fill(-1e9);
    const cur = new Float32Array(nS);
    const dep = new Float32Array(nS);
    const lit = new Float32Array(nS);
    ctx.lineWidth = L.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let k = 0; k <= count; k++) {
      const y = L.top + k * L.spacing;
      const appearAt = (k / count) * S.durationMs;
      const a0 = Math.min(1, Math.max(0, (revealT - appearAt) / S.lineFadeMs));
      const edgeFade = y > fadeStart ? 1 - (y - fadeStart) / (bottom - fadeStart) : 1;
      for (let j = 0; j < nS; j++) {
        const x = j * L.sampleStep;
        dep[j] = this.sample(x, y);
        // Top-lit shading: surfaces rising toward the top catch the light.
        const slope = (this.sample(x, y + cell) - this.sample(x, y - cell)) / 2;
        lit[j] = Math.max(-1, Math.min(1, slope * 12));
      }
      liftLine(y, dep, amp, prev, R.minGap, cur);
      prev = Float32Array.from(cur);
      const lineAlpha = a0 * edgeFade;
      if (lineAlpha <= 0.002) continue;
      ctx.globalAlpha = lineAlpha;
      let key = '';
      for (let j = 1; j < nS; j++) {
        const t = Math.min(1, (dep[j] + dep[j - 1]) / 2 / 0.8);
        const l = (lit[j] + lit[j - 1]) / 2;
        const k2 = `${Math.round(t * (BUCKETS - 1))}|${Math.round(l * 10)}`;
        if (k2 !== key) {
          if (key) ctx.stroke();
          key = k2;
          ctx.strokeStyle = this.reliefStyle(k2);
          ctx.beginPath();
          ctx.moveTo((j - 1) * L.sampleStep, cur[j - 1]);
        }
        ctx.lineTo(j * L.sampleStep, cur[j]);
      }
      if (key) ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Stroke style for a quantised (depth, shade) key; cached. */
  private reliefStyle(key: string): string {
    const hit = this.reliefStyles.get(key);
    if (hit) return hit;
    const [tb, lb] = key.split('|').map(Number);
    const t = tb / (BUCKETS - 1);
    const shade = 1 + CAPTURE_VISUAL_SPEC.relief.light * (lb / 10);
    const L = CAPTURE_VISUAL_SPEC.lines;
    const c = this.c0.map((v, i) => Math.min(255, Math.round((v + (this.c1[i] - v) * t) * shade)));
    const a = Math.min(1, (L.flatAlpha + (L.peakAlpha - L.flatAlpha) * t) * shade);
    const style = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
    this.reliefStyles.set(key, style);
    return style;
  }

  private drawRing(ctx: CanvasRenderingContext2D, o: Ellipse, progress: number, paused: boolean): void {
    const R = CAPTURE_VISUAL_SPEC.ring;
    ctx.lineWidth = R.width;
    ctx.lineCap = 'round';
    ctx.strokeStyle = R.track;
    ctx.beginPath();
    ctx.ellipse(o.cx, o.cy, o.rx + R.gap, o.ry + R.gap, 0, 0, Math.PI * 2);
    ctx.stroke();
    const p = Math.max(0, Math.min(1, progress));
    if (p <= 0) return;
    ctx.strokeStyle = paused ? this.colors.warning : this.colors.ring;
    ctx.beginPath();
    ctx.ellipse(o.cx, o.cy, o.rx + R.gap, o.ry + R.gap, 0, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.stroke();
  }
}
