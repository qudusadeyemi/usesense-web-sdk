/**
 * Live contour scan visual (Phase 1 redesign).
 *
 * Each tracked frame, the face mesh z is rasterised into a 64x64 depth grid
 * that covers the oval, smoothed over time, and drawn as horizontal lines
 * lifted by the depth under them, so the lines bend over the nose ridge, eye
 * sockets and lips and follow the head as it moves.
 *
 * This is display only. MediaPipe's z is a guess from one flat image (it draws
 * the same face over a printed photo), so nothing here is evidence of depth
 * and nothing here is uploaded.
 *
 * 2D canvas: about 30 polylines of 64 points per frame plus a 478-point splat,
 * well inside a mid-range phone's 30 fps budget, so WebGL is not needed.
 */

import type { Ellipse } from './quality-gate';

export const DEPTH_GRID = 64;

/** A landmark in screen pixels with depth toward the camera (px, >= 0). */
export interface DepthPoint {
  x: number;
  y: number;
  /** Larger = closer to the camera. */
  d: number;
}

/** Splat radius in grid cells and the weight at which a cell is "fully face". */
const SPLAT_RADIUS = 3;
const SPLAT_SIGMA2 = 2 * 1.4 * 1.4;
const FULL_WEIGHT = 0.9;

/**
 * Rasterise depth points into a size x size grid over the box
 * [x0, x0 + w] x [y0, y0 + h]. Cells with no nearby landmark get 0 (flat), and
 * the face edge fades to 0 with the splat weight so lines leave the face
 * smoothly. Pure, exported for tests.
 */
export function rasteriseDepth(
  points: DepthPoint[],
  box: { x0: number; y0: number; w: number; h: number },
  size: number = DEPTH_GRID,
  out?: Float32Array,
): Float32Array {
  const n = size * size;
  const grid = out && out.length === n ? out : new Float32Array(n);
  const wsum = new Float32Array(n);
  grid.fill(0);
  const sx = (size - 1) / box.w;
  const sy = (size - 1) / box.h;
  for (const p of points) {
    const gx = (p.x - box.x0) * sx;
    const gy = (p.y - box.y0) * sy;
    const cx = Math.round(gx);
    const cy = Math.round(gy);
    for (let y = cy - SPLAT_RADIUS; y <= cy + SPLAT_RADIUS; y++) {
      if (y < 0 || y >= size) continue;
      for (let x = cx - SPLAT_RADIUS; x <= cx + SPLAT_RADIUS; x++) {
        if (x < 0 || x >= size) continue;
        const dx = x - gx;
        const dy = y - gy;
        const w = Math.exp(-(dx * dx + dy * dy) / SPLAT_SIGMA2);
        const i = y * size + x;
        wsum[i] += w;
        grid[i] += w * p.d;
      }
    }
  }
  for (let i = 0; i < n; i++) {
    const w = wsum[i];
    grid[i] = w > 1e-4 ? (grid[i] / w) * Math.min(1, w / FULL_WEIGHT) : 0;
  }
  // Two separable box-blur passes (about a 5-cell Gaussian) so the lines bend
  // smoothly instead of tracing individual landmarks.
  const tmp = wsum;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const l = x > 0 ? grid[i - 1] : grid[i];
        const r = x < size - 1 ? grid[i + 1] : grid[i];
        tmp[i] = (l + grid[i] + r) / 3;
      }
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const u = y > 0 ? tmp[i - size] : tmp[i];
        const d = y < size - 1 ? tmp[i + size] : tmp[i];
        grid[i] = (u + tmp[i] + d) / 3;
      }
    }
  }
  return grid;
}

/** Linear blend of two #rrggbb colours. */
function mix(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export interface ContourColors {
  ring: string;
  contourStart: string;
  contourEnd: string;
  warning: string;
}

export interface ContourFrame {
  /** Monotonic ms. */
  now: number;
  /** Fraction of the scan banked, 0-1, drawn as the ring. */
  progress: number;
  /** Paused: the ring holds and turns the warning colour. */
  paused: boolean;
}

/**
 * Draws the contour lines and the progress ring onto a canvas that covers the
 * camera container.
 */
export class ContourScan {
  private smoothed = new Float32Array(DEPTH_GRID * DEPTH_GRID);
  private scratch = new Float32Array(DEPTH_GRID * DEPTH_GRID);
  private hasFace = false;
  private startedAt = 0;
  private oval: Ellipse | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private colors: ContourColors,
    private readonly reducedMotion: boolean,
  ) {}

  /** The canvas this renderer draws on. */
  get target(): HTMLCanvasElement {
    return this.canvas;
  }

  setColors(colors: ContourColors): void {
    this.colors = colors;
  }

  /** Start (or restart) the sweep-in. */
  start(now: number): void {
    this.startedAt = now;
    this.smoothed.fill(0);
    this.hasFace = false;
  }

  /** The oval box the grid covers (a little taller than the oval). */
  private gridBox(oval: Ellipse) {
    return { x0: oval.cx - oval.rx, y0: oval.cy - oval.ry * 1.05, w: oval.rx * 2, h: oval.ry * 2.1 };
  }

  /** Feed one tracked frame. Pass null points when the face is lost. */
  update(points: DepthPoint[] | null, oval: Ellipse): void {
    this.oval = oval;
    // Temporal smoothing. Reduced motion smooths much harder so the lines
    // drift instead of following every micro-movement.
    const alpha = this.reducedMotion ? 0.12 : 0.35;
    if (!points || points.length === 0) {
      for (let i = 0; i < this.smoothed.length; i++) this.smoothed[i] *= 1 - alpha;
      return;
    }
    rasteriseDepth(points, this.gridBox(oval), DEPTH_GRID, this.scratch);
    const a = this.hasFace ? alpha : 1;
    for (let i = 0; i < this.smoothed.length; i++) {
      this.smoothed[i] += (this.scratch[i] - this.smoothed[i]) * a;
    }
    this.hasFace = true;
  }

  /** Bilinear sample of the smoothed grid at a screen point. */
  private sample(x: number, y: number, box: { x0: number; y0: number; w: number; h: number }): number {
    const s = DEPTH_GRID - 1;
    const gx = Math.max(0, Math.min(s, ((x - box.x0) / box.w) * s));
    const gy = Math.max(0, Math.min(s, ((y - box.y0) / box.h) * s));
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = Math.min(s, x0 + 1), y1 = Math.min(s, y0 + 1);
    const fx = gx - x0, fy = gy - y0;
    const g = this.smoothed;
    const top = g[y0 * DEPTH_GRID + x0] * (1 - fx) + g[y0 * DEPTH_GRID + x1] * fx;
    const bot = g[y1 * DEPTH_GRID + x0] * (1 - fx) + g[y1 * DEPTH_GRID + x1] * fx;
    return top * (1 - fy) + bot * fy;
  }

  /** Resize the backing store to the canvas's CSS size. */
  private fit(): CanvasRenderingContext2D | null {
    const c = this.canvas;
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const w = Math.round(c.clientWidth * dpr);
    const h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  clear(): void {
    const ctx = this.fit();
    if (ctx) ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
  }

  draw(frame: ContourFrame): void {
    const ctx = this.fit();
    const oval = this.oval;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    if (!oval) return;
    const box = this.gridBox(oval);

    // Lines sweep in from the top over 700 ms (instant with reduced motion).
    const sweep = this.reducedMotion ? 1 : Math.min(1, (frame.now - this.startedAt) / 700);
    const LINES = 30;
    const SEG = 48;
    const lift = 0.3; // fraction of the depth, in px, the line is raised by

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(oval.cx, oval.cy, oval.rx * 0.98, oval.ry * 0.98, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let li = 0; li < LINES; li++) {
      const t = li / (LINES - 1);
      if (t > sweep) break;
      const y0 = oval.cy - oval.ry + t * oval.ry * 2;
      ctx.beginPath();
      for (let si = 0; si <= SEG; si++) {
        const x = oval.cx - oval.rx + (si / SEG) * oval.rx * 2;
        const y = y0 - this.sample(x, y0, box) * lift;
        if (si === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = mix(this.colors.contourStart, this.colors.contourEnd, t);
      // Newest line at the sweep front is brightest; the rest settle.
      ctx.globalAlpha = 0.55 + 0.35 * (1 - Math.min(1, (sweep - t) * 4));
      ctx.stroke();
    }
    ctx.restore();

    // Progress ring around the oval, from 12 o'clock clockwise.
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(oval.cx, oval.cy, oval.rx + 6, oval.ry + 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    const p = Math.max(0, Math.min(1, frame.progress));
    if (p > 0) {
      ctx.strokeStyle = frame.paused ? this.colors.warning : this.colors.ring;
      ctx.beginPath();
      ctx.ellipse(oval.cx, oval.cy, oval.rx + 6, oval.ry + 6, 0, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
