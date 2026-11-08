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
      this.cols = CAPTURE_VISUAL_SPEC.depth.grid;
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
    const { field, faceH } = buildDepthField(lms, this.cols, this.rows, this.cell);
    const a = this.hasFace ? (this.reducedMotion ? Math.min(alpha, 0.12) : alpha) : 1;
    for (let i = 0; i < field.length; i++) this.field[i] += (field[i] - this.field[i]) * a;
    this.faceH = this.hasFace ? this.faceH + (faceH - this.faceH) * a : faceH;
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
    if (this.hasFace) this.drawLines(ctx, this.reducedMotion ? 1e9 : frame.now - this.sweepStart);
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
