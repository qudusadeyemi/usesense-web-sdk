/**
 * Capture canvas: the align guide, the scan's contour lines and progress ring
 * (LiveSense capture redesign, Phase 1).
 *
 * Ported from the cross-platform visual reference
 * (capture-test-kit/reference/index.html, "LiveSense capture visual spec v1").
 * Every number lives in {@link CAPTURE_VISUAL_SPEC}; iOS and Android use the
 * same values.
 *
 * The contour (relief v3.1, RELIEF-v3.md) is a smooth screen-space bump
 * fitted to the face plus a separate face-detail field from the mesh, both
 * smoothed over time. Lines
 * run edge to edge across the screen and bulge away from the face centre: up
 * over the forehead and head, down under the chin, flat beside the head.
 * Without the mesh triangles the v1 splat field and lift are used instead.
 *
 * Display only. MediaPipe's z is a guess from one flat image, so nothing here
 * is evidence of depth and nothing here is uploaded.
 */

import type { Ellipse } from './quality-gate';
import { CAPTURE_FIXED_COLORS } from './capture-theme';

// ============================================================================
// Spec
// ============================================================================

export const CAPTURE_VISUAL_SPEC = {
  /** Ellipse in screen fractions; rx is a fraction of the phone-width stage. */
  oval: { cx: 0.5, cy: 0.4, rxOfW: 0.36, ryOfH: 0.235 },
  guide: { fill: CAPTURE_FIXED_COLORS.ovalFill, stroke: CAPTURE_FIXED_COLORS.ovalStroke, width: 2 },
  ring: { track: CAPTURE_FIXED_COLORS.ringTrack, width: 3, gap: 6 },
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
   * Relief v3.1 (RELIEF-v3.md, "v3.1 changes"): lines bulge away from the
   * face centre over a smooth bump, plus a separate face-detail field so the
   * nose, brow and lips show. Sigmas are in v2's 130-column cells and scaled
   * by grid / 130.
   */
  relief: {
    grid: 64,
    bumpRxOfFaceW: 0.58,
    /** Bump half-height below the centre; also the bulge displacement scale. */
    bumpRyOfFaceH: 0.65,
    /** Bump half-height above the centre (spreads the squeeze over the head). */
    bumpRyUpOfFaceH: 0.85,
    bumpCyShiftOfFaceH: 0.05,
    blurSigma: 0.9,
    /** Detail field: the v2 mesh (openings filled, soft edge), blurred. */
    detailSigma: 2.5,
    /** Detail lift as a fraction of ry; not scaled by the bulge's tanh. */
    detailLiftOfRy: 0.12,
    fillSigma: 3,
    edgeSigma: 2,
    edgeLo: 0.15,
    edgeHi: 0.95,
    /** Bulge as a fraction of ry: above the centre, below it. */
    ampUp: 0.5,
    ampDown: 0.32,
    /** tanh scale of the bulge, as a fraction of ry. */
    tanhOfRy: 0.25,
    /** A line never comes closer than this (px) to the line above. */
    minGap: 2.5,
    /** Packed lines fade: alpha x (floor + (1 - floor) x clamp(gap / spacing)). */
    packedAlphaFloor: 0.25,
    /** One colour (the ring colour) at this alpha; no depth colouring or shading. */
    alpha: 0.9,
    width: 1.3,
    spacing: 9,
    /** Blur the camera this far into the scan, px. */
    cameraBlurAfterMs: 1500,
    cameraBlurPx: 18,
  },
  sweep: { durationMs: 520, lineFadeMs: 140 },
  /** Darken the camera this much under the lines during the scan. */
  feedDimDuringScan: 0.12,
  /** Keep the last field this long when the face drops out. */
  faceHoldMs: 300,
  /** Fill light: a warm veil over the whole screen (#FFF4E2 at 38%), spec v1.3. */
  fillLight: { color: CAPTURE_FIXED_COLORS.fillLight },
} as const;

/** Phone-shaped stage width: the full width on a phone, a phone column on a desktop. */
export function stageWidth(W: number, H: number): number {
  return Math.min(W, (H * 390) / 844);
}

/**
 * How much bigger the oval is on a wide (desktop) layout. A laptop webcam
 * is landscape and wide-angle, so at a normal 45-70 cm a face fills much
 * less of the frame than a phone selfie does; with the phone-sized oval the
 * distance band (which scales with the oval) only passed at about 60-80 cm,
 * and people had to push the laptop away. 1.4 puts the band's middle near
 * 55 cm on a 65 degree webcam (range about 42-80 cm).
 */
export const DESKTOP_OVAL_SCALE = 1.4;

/**
 * The oval's scale for a W x H screen: 1 on a phone (the stage is the whole
 * width), ramping to {@link DESKTOP_OVAL_SCALE} as the screen gets wider
 * than the phone column (full at 1.3 x the column), so a narrow desktop
 * window does not jump.
 */
export function ovalScale(W: number, H: number): number {
  const s = stageWidth(W, H);
  if (!(s > 0)) return 1;
  const t = Math.max(0, Math.min(1, (W / s - 1) / 0.3));
  return 1 + (DESKTOP_OVAL_SCALE - 1) * t;
}

/** The face oval for a W x H screen, px. */
export function captureOval(W: number, H: number): Ellipse {
  const o = CAPTURE_VISUAL_SPEC.oval;
  const k = ovalScale(W, H);
  return { cx: W * o.cx, cy: H * o.cy, rx: stageWidth(W, H) * o.rxOfW * k, ry: H * o.ryOfH * k };
}

/**
 * Where the guidance text and the shutter sit for a W x H screen, px: the
 * guidance 28 px under the oval (spec v1.1), the shutter at 85% of the
 * height or, when the bigger desktop oval pushes the guidance down, far
 * enough below it to clear two lines of text.
 */
export function captureLayout(W: number, H: number): { guidanceTop: number; shutterY: number } {
  const o = captureOval(W, H);
  const guidanceTop = o.cy + o.ry + 28;
  const shutterY = Math.min(H - 44, Math.max(H * 0.85, guidanceTop + 64 + 40));
  return { guidanceTop, shutterY };
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
 * One relief v3.1 line's y at each sample: pushed away from the bump centre
 * and lifted by the face detail,
 * y' = max(y + A * ry * f * t - 0.12 * ry * detail, yAbove + 2.5), with
 * t = tanh((y - cy) / (0.25 * ry)) and A = 0.50 above the centre, 0.32 below.
 * The detail lift is not scaled by t, so the nose shows where it is.
 */
export function bulgeLine(
  y: number, depth: ArrayLike<number>, detail: ArrayLike<number>, cy: number, ry: number,
  above: ArrayLike<number>, out: Float32Array = new Float32Array(depth.length),
): Float32Array {
  const R = CAPTURE_VISUAL_SPEC.relief;
  const t = Math.tanh((y - cy) / Math.max(1e-6, R.tanhOfRy * ry));
  const push = (t < 0 ? R.ampUp : R.ampDown) * ry * t;
  const lift = R.detailLiftOfRy * ry;
  for (let j = 0; j < depth.length; j++) {
    out[j] = Math.max(y + push * depth[j] - lift * detail[j], above[j] + R.minGap);
  }
  return out;
}

/** Alpha factor for a segment whose line sits `gap` px below the line above. */
export function packedAlpha(gap: number): number {
  const R = CAPTURE_VISUAL_SPEC.relief;
  return R.packedAlphaFloor + (1 - R.packedAlphaFloor) * Math.min(1, Math.max(0, gap / R.spacing));
}

/** MediaPipe FACE_OVAL ring (the face silhouette). */
const FACE_OVAL_RING = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

/** One frame of the relief v3.1 fields and the bump they were built on (screen px). */
export interface ReliefField {
  /** Bulge field: the bump alone. */
  field: Float32Array;
  /** Face detail: the v2 mesh, openings filled, soft edge, blurred 2.5. */
  detail: Float32Array;
  faceH: number;
  /** Bump centre y (midpoint of 10 and 152, plus 0.05 x faceH). */
  cy: number;
  /** Bump half-height below the centre (0.65 x faceH); the displacement scale. */
  ry: number;
}

/**
 * Relief v3.1 fields on a cols x rows grid of `cell`-px cells. Ported from
 * the reference updateField:
 * - detail: depth from the face outline (0) to the nearest point (1), each
 *   tessellation triangle rasterised with barycentric depth, openings filled
 *   (normalised convolution, sigma 3), soft edge
 *   smoothstep(0.15, 0.95, blur(cover, 2)), then blur 2.5;
 * - bulge: (1 - r^2)^2 inside an ellipse rx 0.58 x faceW, ry 0.85 x faceH
 *   above the centre and 0.65 x faceH below, centred on the 10/152 midpoint
 *   moved down 0.05 x faceH, then blur 0.9.
 */
export function buildReliefField(
  lms: ScreenLandmark[],
  tris: number[][],
  cols: number,
  rows: number,
  cell: number,
): ReliefField {
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
  const k = cols / 130;
  const sc = (s: number) => Math.max(0.3, s * k);
  // Detail: fill the eye and mouth openings, soften the edge, then blur.
  const mc = new Float32Array(n);
  for (let i = 0; i < n; i++) mc[i] = mesh[i] * cover[i];
  const num = gaussBlur(mc, cols, rows, sc(R.fillSigma));
  const dnm = gaussBlur(cover, cols, rows, sc(R.fillSigma));
  const edge = gaussBlur(cover, cols, rows, sc(R.edgeSigma));
  const filled = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const f = cover[i] ? mesh[i] : (dnm[i] > 1e-4 ? num[i] / dnm[i] : 0);
    filled[i] = f * smoothstep(R.edgeLo, R.edgeHi, edge[i]);
  }
  const detail = gaussBlur(filled, cols, rows, sc(R.detailSigma));
  // Bulge: the bump alone, taller above the centre.
  const top = lms[10], chin = lms[152], left = lms[234], right = lms[454];
  const faceH = Math.hypot(chin.x - top.x, chin.y - top.y);
  const faceW = Math.abs(right.x - left.x);
  const cx = (top.x + chin.x) / 2;
  const cy = (top.y + chin.y) / 2 + R.bumpCyShiftOfFaceH * faceH;
  const brx = Math.max(1, R.bumpRxOfFaceW * faceW);
  const bry = Math.max(1, R.bumpRyOfFaceH * faceH);
  const bryUp = Math.max(1, R.bumpRyUpOfFaceH * faceH);
  let raw: Float32Array = new Float32Array(n);
  for (let gy = 0; gy < rows; gy++) {
    const y = (gy + 0.5) * cell;
    const ry = y < cy ? bryUp : bry;
    for (let gx = 0; gx < cols; gx++) {
      const x = (gx + 0.5) * cell;
      const r2 = ((x - cx) / brx) ** 2 + ((y - cy) / ry) ** 2;
      raw[gy * cols + gx] = r2 < 1 ? (1 - r2) * (1 - r2) : 0;
    }
  }
  raw = gaussBlur(raw, cols, rows, sc(R.blurSigma));
  return { field: raw, detail, faceH, cy, ry: bry };
}

// ============================================================================
// Renderer
// ============================================================================

/**
 * The camera accents the renderer draws with (resolved and contrast-gated by
 * the capture theme). The contour lines use the ring colour in both
 * renderers; `contourStart` / `contourEnd` are retired (BRAND-v1 4.2).
 */
export interface CaptureCanvasColors {
  ring: string;
  warning: string;
}

export type CaptureCanvasMode = 'none' | 'align' | 'scan' | 'upload' | 'challenge';

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
   * Challenge: the ring's colour (purple for an extra check, green when it
   * is done). Paused still draws in the warning colour.
   */
  ringColor?: string;
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

/** The camera background (fixed, BRAND-v1 4.2) at the scan dim. */
const CAMERA_DIM_STYLE = (() => {
  const h = CAPTURE_FIXED_COLORS.cameraBackground.slice(1);
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${CAPTURE_VISUAL_SPEC.feedDimDuringScan})`;
})();

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
  private detail = new Float32Array(0);
  private faceH = 0;
  private hasFace = false;
  private lastFaceAt = -Infinity;
  private sweepStart = 0;
  private styles: string[] = [];
  private tris: number[][] | null = null;
  private bumpCy = 0;
  private bumpRy = 0;

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
    // One colour (the ring) from flat to peak alpha, as the relief renderer.
    const c0 = hexRgb(colors.ring);
    const c1 = c0;
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
      this.detail = new Float32Array(this.cols * this.rows);
      this.hasFace = false;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  /**
   * The face mesh triangles (from MediaPipe's tessellation). With them the
   * relief v3.1 fields and lines are used; without, the v1 splat field.
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
        for (let i = 0; i < this.field.length; i++) { this.field[i] *= 1 - alpha; this.detail[i] *= 1 - alpha; }
      }
      return;
    }
    const a = this.hasFace ? (this.reducedMotion ? Math.min(alpha, 0.12) : alpha) : 1;
    let field: Float32Array;
    if (this.tris) {
      const r = buildReliefField(lms, this.tris, this.cols, this.rows, this.cell);
      field = r.field;
      for (let i = 0; i < r.detail.length; i++) this.detail[i] += (r.detail[i] - this.detail[i]) * a;
      this.faceH = r.faceH;
      // The bump's centre and size are eased like the field.
      this.bumpCy += (r.cy - this.bumpCy) * a;
      this.bumpRy += (r.ry - this.bumpRy) * a;
    } else {
      const r = buildDepthField(lms, this.cols, this.rows, this.cell);
      field = r.field;
      this.faceH = r.faceH;
    }
    for (let i = 0; i < field.length; i++) this.field[i] += (field[i] - this.field[i]) * a;
    this.hasFace = true;
    this.lastFaceAt = now;
  }

  /** Bilinear sample at a screen point (same convention as the reference). */
  private sample(x: number, y: number, f: Float32Array = this.field): number {
    const gx = x / this.cell, gy = y / this.cell;
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const cols = this.cols, rows = this.rows;
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
    // scan / upload / challenge: dim the feed
    ctx.fillStyle = CAMERA_DIM_STYLE;
    ctx.fillRect(0, 0, W, H);
    if (frame.mode === 'challenge') {
      // Extra check (storyboard): the clear camera and the ring, no lines.
      if (frame.paused) {
        // Paused: the whole ring track turns amber, so the pause shows even
        // before any progress (e.g. right after a retry).
        const R = CAPTURE_VISUAL_SPEC.ring;
        ctx.lineWidth = R.width;
        ctx.strokeStyle = this.colors.warning;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.ellipse(o.cx, o.cy, o.rx + R.gap, o.ry + R.gap, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      this.drawRing(ctx, o, frame.progress ?? 0, !!frame.paused, frame.ringColor);
      return;
    }
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
   * Relief v3.1 lines (ported from the reference drawLines): each line
   * bulges away from the bump centre and is lifted by the face detail (see
   * {@link bulgeLine}), in one colour (the ring colour) at alpha 0.9, width
   * 1.3, spacing 9. Packed lines fade by their gap to the line above (min of
   * a segment's two ends); runs of equal quantised alpha share one stroke.
   * Every line is computed, revealed or not, so the gap sees the line above.
   */
  private drawRelief(ctx: CanvasRenderingContext2D, revealT: number): void {
    const L = CAPTURE_VISUAL_SPEC.lines;
    const R = CAPTURE_VISUAL_SPEC.relief;
    const S = CAPTURE_VISUAL_SPEC.sweep;
    const { W, H } = this;
    const bottom = H * L.bottomOfH;
    const fadeStart = bottom - H * L.fadeOfH;
    const count = Math.floor((bottom - L.top) / R.spacing);
    const nS = Math.ceil(W / L.sampleStep) + 2;
    let prev = new Float32Array(nS).fill(-1e9);
    let cur = new Float32Array(nS);
    const dep = new Float32Array(nS);
    const det = new Float32Array(nS);
    const segA = new Float32Array(nS);
    ctx.lineWidth = R.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.colors.ring;
    for (let k = 0; k <= count; k++) {
      const y = L.top + k * R.spacing;
      const appearAt = (k / count) * S.durationMs;
      const a0 = Math.min(1, Math.max(0, (revealT - appearAt) / S.lineFadeMs));
      const edgeFade = y > fadeStart ? 1 - (y - fadeStart) / (bottom - fadeStart) : 1;
      for (let j = 0; j < nS; j++) {
        const x = j * L.sampleStep;
        dep[j] = this.sample(x, y);
        det[j] = this.sample(x, y, this.detail);
      }
      bulgeLine(y, dep, det, this.bumpCy, this.bumpRy, prev, cur);
      const base = R.alpha * a0 * edgeFade;
      if (base > 0.002) {
        for (let j = 1; j < nS; j++) {
          segA[j] = Math.round(20 * packedAlpha(Math.min(cur[j - 1] - prev[j - 1], cur[j] - prev[j]))) / 20;
        }
        for (let j = 1; j < nS;) {
          const a = segA[j];
          let e = j;
          while (e + 1 < nS && segA[e + 1] === a) e++;
          ctx.globalAlpha = base * a;
          ctx.beginPath();
          ctx.moveTo((j - 1) * L.sampleStep, cur[j - 1]);
          for (let m = j; m <= e; m++) ctx.lineTo(m * L.sampleStep, cur[m]);
          ctx.stroke();
          j = e + 1;
        }
      }
      const t = prev; prev = cur; cur = t;
    }
    ctx.globalAlpha = 1;
  }

  private drawRing(ctx: CanvasRenderingContext2D, o: Ellipse, progress: number, paused: boolean, color?: string): void {
    const R = CAPTURE_VISUAL_SPEC.ring;
    ctx.lineWidth = R.width;
    ctx.lineCap = 'round';
    ctx.strokeStyle = R.track;
    ctx.beginPath();
    ctx.ellipse(o.cx, o.cy, o.rx + R.gap, o.ry + R.gap, 0, 0, Math.PI * 2);
    ctx.stroke();
    const p = Math.max(0, Math.min(1, progress));
    if (p <= 0) return;
    ctx.strokeStyle = paused ? this.colors.warning : color ?? this.colors.ring;
    ctx.beginPath();
    ctx.ellipse(o.cx, o.cy, o.rx + R.gap, o.ry + R.gap, 0, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.stroke();
  }
}
