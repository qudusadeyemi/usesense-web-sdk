/**
 * Covered-face check (capture-test-kit/COVER-v1.md), the pure parts:
 * measuring a segmentation mask over the face, the six-region change watch
 * used during the scan, and the same-face overlap rule for "one person".
 *
 * MediaPipe's face landmarker keeps predicting a plausible face under a hand,
 * a phone or a sheet of paper, so every landmark check passes on a covered
 * face. These read the pixels instead. Gate only: nothing here is uploaded.
 * Thresholds match the iOS and Android SDKs.
 */

import { FACE_OVAL } from './quality-gate';

/** Thresholds and timing from COVER-v1.md. */
export const COVER_THRESHOLDS = {
  /** Covered when this share of the face area is body skin (a hand, an arm). */
  bodySkinMax: 0.12,
  /** ...or this share is background, clothes or other objects (a phone, paper). */
  otherMax: 0.25,
  /** The FACE_OVAL silhouette is shrunk this much toward its centroid. */
  inner: 0.85,
  /** Sample steps across the silhouette's width. */
  gridSteps: 40,
  /** A segmentation result older than this no longer counts, ms. */
  maxAgeMs: 3000,
  /** Longest wait for the final check before a scan finishes anyway, ms. */
  finalWaitMs: 2500,
  /** A second face overlapping the subject by this IoU is the same face. */
  sameFaceIoU: 0.3,
} as const;

/** selfie_multiclass_256x256 categories. */
export const SEGMENT_CATEGORY = {
  background: 0,
  hair: 1,
  bodySkin: 2,
  faceSkin: 3,
  clothes: 4,
  others: 5,
} as const;

/** How much of the face area the segmenter saw as something other than face. */
export interface FaceCover {
  /** Share labelled body skin: a hand or an arm in front of the face. */
  bodySkin: number;
  /** Share labelled background, clothes or other objects. */
  other: number;
}

/** True when a segmentation result says the face is covered. */
export function isCovered(c: FaceCover | null | undefined): boolean {
  return !!c && (c.bodySkin >= COVER_THRESHOLDS.bodySkinMax || c.other >= COVER_THRESHOLDS.otherMax);
}

function insidePolygon(px: number[], py: number[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = px.length - 1; i < px.length; j = i++) {
    if ((py[i] > y) !== (py[j] > y) && x < ((px[j] - px[i]) * (y - py[i])) / (py[j] - py[i]) + px[i]) c = !c;
  }
  return c;
}

/**
 * Share of the face area by category, from a category `mask` (`mw` x `mh`,
 * one category per pixel) of the frame the landmarks came from. `lm` are the
 * landmarker's normalised coordinates (0-1 of that frame), so the mask can be
 * any size. The area is the FACE_OVAL silhouette shrunk to 85 % toward its
 * centroid, sampled on a ~40-step grid across its width (in frame pixels
 * `imgW` x `imgH`, so the grid is square). Null without a usable face.
 */
export function measureFaceCover(
  mask: ArrayLike<number>,
  mw: number,
  mh: number,
  lm: ArrayLike<{ x: number; y: number }>,
  imgW: number,
  imgH: number,
): FaceCover | null {
  if (lm.length < 468 || mw < 1 || mh < 1 || imgW < 1 || imgH < 1) return null;
  const T = COVER_THRESHOLDS;
  let cx = 0, cy = 0;
  for (const k of FACE_OVAL) { cx += lm[k].x * imgW; cy += lm[k].y * imgH; }
  cx /= FACE_OVAL.length;
  cy /= FACE_OVAL.length;
  const px = FACE_OVAL.map((k) => cx + (lm[k].x * imgW - cx) * T.inner);
  const py = FACE_OVAL.map((k) => cy + (lm[k].y * imgH - cy) * T.inner);
  const minX = Math.min(...px), maxX = Math.max(...px);
  const minY = Math.min(...py), maxY = Math.max(...py);
  const step = Math.max(1e-6, (maxX - minX) / T.gridSteps);
  const sx = mw / imgW, sy = mh / imgH;
  const C = SEGMENT_CATEGORY;
  let total = 0, body = 0, other = 0;
  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      if (!insidePolygon(px, py, x, y)) continue;
      const mx = Math.min(mw - 1, Math.max(0, Math.floor(x * sx)));
      const my = Math.min(mh - 1, Math.max(0, Math.floor(y * sy)));
      const c = mask[my * mw + mx];
      if (c === C.bodySkin) body++;
      else if (c === C.background || c === C.clothes || c === C.others) other++;
      total++;
    }
  }
  if (total === 0) return null;
  return { bodySkin: body / total, other: other / total };
}

// ============================================================================
// Change watch (scan only, no model)
// ============================================================================

/** Forehead, two cheeks, nose, mouth, chin (MediaPipe 478-point mesh). */
export const COVER_REGION_ANCHORS = [151, 50, 280, 5, 13, 199] as const;
const STRIDE = 4;

/** Limits from COVER-v1.md section 2. */
export const COVER_WATCH = {
  /** Frames averaged into the baseline at the start of the scan. */
  baselineFrames: 3,
  /** Change in a region's luma relative to the face mean. */
  lumaLimit: 0.22,
  /** Change in red or blue chromaticity. */
  chromaLimit: 0.035,
  /** Edge energy may rise or fall by this factor. */
  edgeRatioLimit: 2.2,
  edgeFloor: 4,
  /** Patch half-size as a fraction of face width (|L454 - L234|). */
  patchOfFaceW: 0.07,
  /** Sample every this many pixels. */
  sampleStep: 2,
} as const;

const luma = (d: ArrayLike<number>, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

/**
 * Appearance of the six face regions on one frame: per region, luma relative
 * to the mean of all six (so the fill light or an exposure change cancels),
 * red and blue chromaticity, and edge energy (mean |dx| + |dy| of luma).
 * `rgba` is a `w` x `h` RGBA image; `pts` are the landmarks in its pixels.
 * Null when a patch falls off the image.
 */
export function measureFaceRegions(
  rgba: ArrayLike<number>,
  w: number,
  h: number,
  pts: ArrayLike<{ x: number; y: number }>,
): Float32Array | null {
  if (pts.length < 468) return null;
  const W = COVER_WATCH;
  const faceW = Math.abs(pts[454].x - pts[234].x);
  const half = Math.max(2, Math.floor(W.patchOfFaceW * faceW));
  const out = new Float32Array(COVER_REGION_ANCHORS.length * STRIDE);
  let lumaSum = 0;
  for (let r = 0; r < COVER_REGION_ANCHORS.length; r++) {
    const a = pts[COVER_REGION_ANCHORS[r]];
    const cx = Math.floor(a.x), cy = Math.floor(a.y);
    const x0 = Math.max(1, cx - half), x1 = Math.min(w - 2, cx + half);
    const y0 = Math.max(1, cy - half), y1 = Math.min(h - 2, cy + half);
    if (x1 <= x0 || y1 <= y0) return null;
    let sl = 0, sr = 0, sb = 0, se = 0, n = 0;
    for (let y = y0; y <= y1; y += W.sampleStep) {
      for (let x = x0; x <= x1; x += W.sampleStep) {
        const i = (y * w + x) * 4;
        const red = rgba[i], green = rgba[i + 1], blue = rgba[i + 2];
        const sum = Math.max(1, red + green + blue);
        sl += luma(rgba, i);
        sr += red / sum;
        sb += blue / sum;
        se += Math.abs(luma(rgba, i + 4) - luma(rgba, i - 4)) + Math.abs(luma(rgba, i + w * 4) - luma(rgba, i - w * 4));
        n++;
      }
    }
    if (n === 0) return null;
    out[r * STRIDE] = sl / n;
    out[r * STRIDE + 1] = sr / n;
    out[r * STRIDE + 2] = sb / n;
    out[r * STRIDE + 3] = se / n;
    lumaSum += sl / n;
  }
  const mean = Math.max(1, lumaSum / COVER_REGION_ANCHORS.length);
  for (let r = 0; r < COVER_REGION_ANCHORS.length; r++) out[r * STRIDE] /= mean;
  return out;
}

/**
 * Watches the face regions through one scan: the first 3 frames set a
 * baseline (running mean), after which a region that changes beyond the
 * limits means something came in front of the face. Reacts within one
 * tracking frame, ahead of the segmenter.
 */
export class CoverWatch {
  private baseline: Float32Array | null = null;
  private frames = 0;
  /** Largest change on the last frame (>= 1 fails) and its region index. */
  lastScore = 0;
  lastRegion = -1;

  /** Start over (a new scan takes a new baseline). */
  reset(): void {
    this.baseline = null;
    this.frames = 0;
    this.lastScore = 0;
    this.lastRegion = -1;
  }

  /** True when the face looks covered compared with the start of the scan. */
  covered(regions: Float32Array | null): boolean {
    if (!regions) return false;
    const W = COVER_WATCH;
    if (!this.baseline || this.frames < W.baselineFrames) {
      const b = this.baseline ?? (this.baseline = new Float32Array(regions.length));
      for (let i = 0; i < regions.length; i++) b[i] += (regions[i] - b[i]) / (this.frames + 1);
      this.frames++;
      this.lastScore = 0;
      return false;
    }
    const b = this.baseline;
    let worst = 0, worstRegion = -1;
    for (let r = 0; r < COVER_REGION_ANCHORS.length; r++) {
      const o = r * STRIDE;
      const l = Math.abs(regions[o] - b[o]) / W.lumaLimit;
      const c = Math.max(Math.abs(regions[o + 1] - b[o + 1]), Math.abs(regions[o + 2] - b[o + 2])) / W.chromaLimit;
      const e0 = b[o + 3] + W.edgeFloor, e1 = regions[o + 3] + W.edgeFloor;
      const e = (Math.max(e1 / e0, e0 / e1) - 1) / (W.edgeRatioLimit - 1);
      const score = Math.max(l, c, e);
      if (score > worst) { worst = score; worstRegion = r; }
    }
    this.lastScore = worst;
    this.lastRegion = worstRegion;
    return worst >= 1;
  }
}

// ============================================================================
// One person: the same face found twice
// ============================================================================

/** Normalised bounding box [x0, y0, x1, y1] of a set of landmarks. */
export function landmarkBox(face: ArrayLike<{ x: number; y: number }>): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < face.length; i++) {
    const p = face[i];
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  return [x0, y0, x1, y1];
}

/** Intersection over union of two [x0, y0, x1, y1] boxes. */
export function boxIoU(a: readonly number[], b: readonly number[]): number {
  const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const inter = ix * iy;
  const union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
  return union <= 0 ? 0 : inter / union;
}

/**
 * Distinct faces: the subject plus every other face whose box overlaps the
 * subject's by less than IoU 0.3. A bigger overlap is the same face found
 * twice (tracking and re-detection), not another person.
 */
export function distinctFaceCount(faces: ArrayLike<ArrayLike<{ x: number; y: number }>>, subject: number): number {
  if (faces.length === 0) return 0;
  const boxes = Array.from({ length: faces.length }, (_, i) => landmarkBox(faces[i]));
  let n = 1;
  for (let i = 0; i < boxes.length; i++) {
    if (i !== subject && boxIoU(boxes[i], boxes[subject]) < COVER_THRESHOLDS.sameFaceIoU) n++;
  }
  return n;
}
