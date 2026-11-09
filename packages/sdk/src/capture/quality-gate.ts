/**
 * LiveSense capture quality gate (Phase 1 redesign).
 *
 * Pure, DOM-free logic so it can be unit tested and shared by every capture
 * surface. The engine feeds it one {@link GateFrameInput} per tracked video
 * frame; it answers which checks pass, in the priority order of the spec:
 *
 *   face found > one person > covered > distance > fully in frame > pose >
 *   light > sharpness > eyes open > stillness
 *
 * Only the highest failing check is ever shown to the user (see
 * {@link HintScheduler}). Thresholds and copy match the iOS and Android SDKs;
 * change them in all three or none.
 *
 * Nothing computed here is uploaded or scored. The server decides liveness;
 * this only decides when to capture.
 */

// ============================================================================
// Spec constants
// ============================================================================

/** Check identifiers, in priority order (index 0 = most important). */
export const GATE_CHECKS = [
  'face',
  'one_person',
  'covered',
  'distance',
  'in_frame',
  'pose',
  'light',
  'sharpness',
  'eyes',
  'stillness',
] as const;

export type GateCheckId = (typeof GATE_CHECKS)[number];

/** Thresholds from the spec's quality-gate table. */
export const GATE_THRESHOLDS = {
  /** Consecutive frames with exactly one face before "face found" passes. */
  faceStreakFrames: 3,
  /**
   * Every face-silhouette landmark (MediaPipe FACE_OVAL) must sit within the
   * oval scaled by this factor (normalised ellipse distance). Spec v1.2.2.
   */
  ovalSlack: 1.15,
  /**
   * If the silhouette spills out but the face centre is within this fraction
   * of the oval (x / rx and y / ry, each) of the expected face centre, the
   * face is too big for the oval (too close), not off-centre. Spec v1.2.1.
   */
  centredWithin: 0.08,
  /**
   * Where a well-placed face's centre sits: the oval encloses the hair, so
   * the face sits below the oval centre by this fraction of ry. Spec v1.2.1.
   */
  expectedCentreDropOfRy: 0.25,
  /** Eye distance / frame width. */
  distanceMin: 0.17,
  distanceMax: 0.32,
  /**
   * Once the scan runs, the distance band widens by this much each side
   * (0.15-0.34), so a face on a band edge does not flicker and drop the scan.
   * Spec v1.3, as Android and iOS.
   */
  distanceHoldMargin: 0.02,
  /** Degrees, absolute. */
  maxYaw: 15,
  maxPitch: 15,
  maxRoll: 12,
  /** Face-area mean luminance (BT.601, 0-255). */
  lumMin: 70,
  lumMax: 200,
  /** A pixel at or above this luma counts as clipped. */
  clipLuma: 250,
  /** Fraction of clipped pixels in the face area that fails the light check. */
  clipMaxFraction: 0.08,
  /**
   * Laplacian variance floor on the face area resampled to 96x96.
   * The spec asks for the per-device 20th percentile; until that data exists
   * this is a fixed floor, tuned on laptop webcams and mid-range phones.
   */
  minSharpness: 12,
  /** Both eyeBlink blendshapes must be below this. */
  maxEyeBlink: 0.6,
  /** Stillness window in ms. */
  stillnessWindowMs: 300,
  /** Landmark jitter / eye distance must be below this. */
  maxJitter: 0.04,
} as const;

/**
 * Guidance copy (visual spec v1.1). Plain instructions only: no counters,
 * stage names or status lines. A second line appears only when the user has
 * to do something different (light, backlight). Identical on iOS, Android
 * and web.
 */
export const GATE_HINTS = {
  /** All checks pass, and during the scan. */
  still: 'Hold still',
  face: 'Show your face in the oval',
  one_person: 'Only you in the picture',
  covered: 'Keep your face uncovered',
  in_frame: 'Move your face to the centre',
  too_far: 'Move a little closer',
  too_close: 'Move back a little',
  pose: 'Look straight ahead',
  too_dark: 'Find more light',
  too_dark_sub: 'Face a window or lamp',
  too_bright: 'Too much light behind you',
  too_bright_sub: 'Turn away from the window',
  sharpness: 'Hold your phone steady',
  eyes: 'Keep your eyes open',
  stillness: 'Hold still',
  shutter: "Tap the button when you're ready",
} as const;

/** Hint timing from the spec. */
export const HINT_TIMING = {
  /** A check must fail continuously this long before its hint appears. */
  onsetMs: 400,
  /** A shown hint stays up at least this long. */
  minVisibleMs: 1200,
} as const;

/** Scan behaviour from the spec. */
export const SCAN_TIMING = {
  /** A pause longer than this discards the banked frames. */
  maxPauseMs: 1500,
  /** Show the shutter after this long on align/scan without finishing. */
  shutterAfterMs: 20000,
  /** ...or after this many paused windows. */
  shutterAfterPausedWindows: 3,
  /** Continuous all-pass time before the scan auto-starts. */
  autoStartMs: 2000,
  /** The fill light settles this long before "Find more light" may show. */
  fillLightSettleMs: 1500,
} as const;

// ============================================================================
// Inputs
// ============================================================================

export interface Point2 {
  x: number;
  y: number;
}

/** An ellipse in the same coordinate space as the mapped landmarks. */
export interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** Face-area pixel statistics; see {@link faceAreaStats}. */
export interface FaceAreaStats {
  meanLuma: number;
  clippedFraction: number;
  sharpness: number;
}

export interface GateFrameInput {
  /** Monotonic ms. */
  now: number;
  /** Number of faces the landmarker returned (0, 1 or 2). */
  faceCount: number;
  /**
   * The subject's landmarks mapped to screen space (pixels), in landmark
   * index order. Undefined when no face was found.
   */
  screenLandmarks?: Point2[];
  /** The face oval in the same screen space. */
  oval?: Ellipse;
  /**
   * The width that "frame width" means for the distance ratio, in the same
   * screen pixels as screenLandmarks. See {@link referenceFrameWidth}.
   */
  frameWidth?: number;
  /** Head pose for the gate, degrees (see {@link poseFromMatrix}). */
  pose?: { yaw: number; pitch: number; roll: number };
  /** eyeBlinkLeft / eyeBlinkRight blendshape scores, when available. */
  eyeBlink?: { left: number; right: number };
  /** Face-area pixel stats; undefined when not measured this frame. */
  pixels?: FaceAreaStats;
  /**
   * Covered-face check (COVER-v1.md): true when the segmenter or the scan's
   * change watch sees something over the face, false when clear, undefined
   * when not checked (no segmenter).
   */
  covered?: boolean;
  /**
   * The segmenter is on but has no result for this face yet. Holds the gate
   * (shown as "Hold still") so a scan can't start unchecked.
   */
  coverPending?: boolean;
}

export type CheckState = 'pass' | 'fail' | 'unknown';

export interface GateResult {
  checks: Record<GateCheckId, CheckState>;
  /** Highest-priority failing check, or null when nothing fails. */
  firstFailing: GateCheckId | null;
  /**
   * True when no BLOCKING check fails ('unknown' counts as passing). Light is
   * advice only (spec v1.3): it turns the fill light on and gives a hint, but
   * a darker face in ordinary room light must not be locked out of the scan.
   */
  allPass: boolean;
  /** Highest-priority failing check that blocks (everything except light). */
  firstBlocking: GateCheckId | null;
  /** Distance direction when the distance check fails. */
  distance?: 'too_far' | 'too_close';
  /**
   * Why the in-frame check failed: the face is off-centre, or it is centred
   * but too big for the oval (too close).
   */
  inFrame?: 'off_centre' | 'too_close';
  /** Light direction when the light check fails. */
  light?: 'too_dark' | 'too_bright';
  measurements: {
    eyeRatio?: number;
    /** Largest normalised ellipse radius of the face silhouette (1 = on the oval). */
    ovalFit?: number;
    /**
     * Face-centre offset from the expected face centre, the larger of
     * |dx| / rx and |dy| / ry (in-frame failures only).
     */
    centreOffset?: number;
    jitter?: number;
    pose?: { yaw: number; pitch: number; roll: number };
    meanLuma?: number;
    sharpness?: number;
  };
}

// ============================================================================
// Geometry helpers
// ============================================================================

/** MediaPipe iris centres; present only on the 478-point model. */
const IRIS_LEFT = 468;
const IRIS_RIGHT = 473;
/** MediaPipe FACE_OVAL: the face-silhouette ring, used by the in-frame check. */
export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
] as const;
/** Stillness anchors: nose tip, eye outer corners, chin, forehead. */
export const STILLNESS_ANCHORS = [1, 33, 263, 152, 10] as const;

const dist = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Point2, b: Point2): Point2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Distance between the eyes, in the landmarks' units. Uses the iris centres
 * (468, 473) and falls back to the eye-corner midpoints on the 468-point model.
 */
export function eyeDistance(lm: Point2[]): number {
  if (lm.length > IRIS_RIGHT) return dist(lm[IRIS_LEFT], lm[IRIS_RIGHT]);
  if (lm.length < 468) return 0;
  return dist(mid(lm[33], lm[133]), mid(lm[362], lm[263]));
}

/**
 * The oval width as a fraction of the phone-width stage (visual spec: the
 * oval's rx is 0.36 of the screen width on a phone).
 */
export const OVAL_STAGE_FRACTION = 0.72;

/**
 * The "frame width" the distance ratio divides by: the phone-width stage the
 * oval is drawn in. On a phone that is exactly the preview width, so the
 * spec's 0.17-0.30 band applies unchanged. On a desktop the preview is a wide
 * landscape crop and the oval sits in a phone-shaped column; dividing by the
 * raw frame width there would demand a face bigger than the oval (0.17 is
 * unreachable while the face is still inside it). Scaling from the oval keeps
 * the band meaning "the face fills the oval" on every layout.
 */
export function referenceFrameWidth(oval: Ellipse): number {
  return (oval.rx * 2) / OVAL_STAGE_FRACTION;
}

/** Face centre: midpoint of forehead/chin (10, 152) and cheeks (234, 454). */
export function faceCentre(lm: Point2[]): Point2 {
  return {
    x: (lm[10].x + lm[152].x + lm[234].x + lm[454].x) / 4,
    y: (lm[10].y + lm[152].y + lm[234].y + lm[454].y) / 4,
  };
}

/** Where a well-placed face's centre sits in the oval: (cx, cy + 0.25 ry). */
export function expectedFaceCentre(oval: Ellipse): Point2 {
  return { x: oval.cx, y: oval.cy + GATE_THRESHOLDS.expectedCentreDropOfRy * oval.ry };
}

/** Largest normalised radius of any point (1 = on the ellipse, >1 = outside). */
export function maxEllipseRadius(points: Point2[], e: Ellipse): number {
  let m = 0;
  for (const p of points) {
    const dx = (p.x - e.cx) / e.rx;
    const dy = (p.y - e.cy) / e.ry;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r > m) m = r;
  }
  return m;
}

/** True when every point lies inside the ellipse scaled by `slack`. */
export function allInsideEllipse(points: Point2[], e: Ellipse, slack: number): boolean {
  const rx = e.rx * slack;
  const ry = e.ry * slack;
  if (rx <= 0 || ry <= 0) return false;
  for (const p of points) {
    const dx = (p.x - e.cx) / rx;
    const dy = (p.y - e.cy) / ry;
    if (dx * dx + dy * dy > 1) return false;
  }
  return true;
}

/**
 * Head pose for the GATE from MediaPipe's facial transformation matrix
 * (row-major 4x4), as ZYX Euler angles with R = Rz * Ry * Rx:
 *   yaw   (about Y, head turn) = atan2(-R20, sqrt(R00^2 + R10^2))
 *   pitch (about X, nod)       = atan2(R21, R22)
 *   roll  (about Z, tilt)      = atan2(R10, R00)
 *
 * This is deliberately separate from the headPose in the upload, whose labels
 * feed the binding proof and the server's scoring and must not change in
 * Phase 1. Degrees.
 */
export function poseFromMatrix(m: ArrayLike<number>): { yaw: number; pitch: number; roll: number } {
  const R00 = m[0], R10 = m[4], R20 = m[8], R21 = m[9], R22 = m[10];
  const toDeg = 180 / Math.PI;
  const sy = Math.sqrt(R00 * R00 + R10 * R10);
  return {
    yaw: Math.atan2(-R20, sy) * toDeg,
    pitch: Math.atan2(R21, R22) * toDeg,
    roll: Math.atan2(R10, R00) * toDeg,
  };
}

// ============================================================================
// Pixel helpers
// ============================================================================

/** BT.601 luma of an RGBA buffer. */
export function rgbaToLuma(data: ArrayLike<number>, out?: Float32Array): Float32Array {
  const n = Math.floor(data.length / 4);
  const lum = out && out.length === n ? out : new Float32Array(n);
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return lum;
}

/**
 * Mean luma, clipped fraction and Laplacian variance of a face-area luma
 * buffer (w x h). The engine resamples the face box to 96x96 first, so the
 * sharpness value scales with the face rather than with the camera resolution.
 */
export function faceAreaStats(lum: Float32Array, w: number, h: number): FaceAreaStats {
  const n = w * h;
  let sum = 0;
  let clipped = 0;
  for (let i = 0; i < n; i++) {
    sum += lum[i];
    if (lum[i] >= GATE_THRESHOLDS.clipLuma) clipped++;
  }
  // 4-neighbour Laplacian variance over the interior.
  let lSum = 0;
  let lSq = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = lum[i - 1] + lum[i + 1] + lum[i - w] + lum[i + w] - 4 * lum[i];
      lSum += l;
      lSq += l * l;
      count++;
    }
  }
  const lMean = count ? lSum / count : 0;
  return {
    meanLuma: n ? sum / n : 0,
    clippedFraction: n ? clipped / n : 0,
    sharpness: count ? lSq / count - lMean * lMean : 0,
  };
}

// ============================================================================
// The gate
// ============================================================================

interface AnchorSample {
  t: number;
  pts: Point2[];
}

/**
 * Stateful evaluator. Keeps the short histories two checks need (the face
 * streak and the stillness window). Create one per capture attempt.
 */
export class QualityGate {
  private faceStreak = 0;
  private samples: AnchorSample[] = [];
  /** Last pixel stats, reused on frames where pixels were not measured. */
  private lastPixels?: FaceAreaStats;

  /** Forget history (e.g. after the face leaves the frame). */
  reset(): void {
    this.faceStreak = 0;
    this.samples = [];
    this.lastPixels = undefined;
  }

  /**
   * Evaluate one frame. `scanning` widens the distance band by the hold
   * margin, so a face on the edge does not drop a running scan.
   */
  evaluate(input: GateFrameInput, opts: { scanning?: boolean } = {}): GateResult {
    const T = GATE_THRESHOLDS;
    const checks = Object.fromEntries(GATE_CHECKS.map((c) => [c, 'unknown'])) as Record<GateCheckId, CheckState>;
    const result: GateResult = { checks, firstFailing: null, firstBlocking: null, allPass: false, measurements: {} };

    // 1. Face found: one face for N frames in a row.
    const lm = input.screenLandmarks;
    if (input.faceCount < 1 || !lm || lm.length < 468) {
      this.faceStreak = 0;
      this.samples = [];
      checks.face = 'fail';
      return this.finish(result);
    }
    this.faceStreak++;
    checks.face = this.faceStreak >= T.faceStreakFrames ? 'pass' : 'fail';

    // 2. One person.
    checks.one_person = input.faceCount > 1 ? 'fail' : 'pass';

    // 2b. Covered: a hand or an object over the face.
    if (input.covered !== undefined) checks.covered = input.covered ? 'fail' : 'pass';

    // 3. Distance (before in-frame, so size problems get size guidance).
    const eyeDist = eyeDistance(lm);
    const frameWidth = input.frameWidth ?? (input.oval ? referenceFrameWidth(input.oval) : 0);
    if (frameWidth > 0 && eyeDist > 0) {
      const ratio = eyeDist / frameWidth;
      result.measurements.eyeRatio = ratio;
      const margin = opts.scanning ? T.distanceHoldMargin : 0;
      if (ratio < T.distanceMin - margin) { checks.distance = 'fail'; result.distance = 'too_far'; }
      else if (ratio > T.distanceMax + margin) { checks.distance = 'fail'; result.distance = 'too_close'; }
      else checks.distance = 'pass';
    }

    // 4. Fully in frame: the face silhouette within the oval x 1.10.
    if (input.oval) {
      const silhouette = FACE_OVAL.map((k) => lm[k]);
      const fit = maxEllipseRadius(silhouette, input.oval);
      result.measurements.ovalFit = fit;
      if (fit <= T.ovalSlack) {
        checks.in_frame = 'pass';
      } else {
        checks.in_frame = 'fail';
        const c = faceCentre(lm);
        const e = expectedFaceCentre(input.oval);
        const off = Math.max(Math.abs(c.x - e.x) / input.oval.rx, Math.abs(c.y - e.y) / input.oval.ry);
        result.measurements.centreOffset = off;
        result.inFrame = off <= T.centredWithin ? 'too_close' : 'off_centre';
      }
    }

    // 5. Pose.
    if (input.pose) {
      const p = input.pose;
      result.measurements.pose = p;
      checks.pose =
        Math.abs(p.yaw) < T.maxYaw && Math.abs(p.pitch) < T.maxPitch && Math.abs(p.roll) < T.maxRoll
          ? 'pass' : 'fail';
    }

    // 6 + 7. Light and sharpness, on the face area.
    const px = input.pixels ?? this.lastPixels;
    if (input.pixels) this.lastPixels = input.pixels;
    if (px) {
      result.measurements.meanLuma = px.meanLuma;
      result.measurements.sharpness = px.sharpness;
      if (px.meanLuma < T.lumMin) { checks.light = 'fail'; result.light = 'too_dark'; }
      else if (px.meanLuma > T.lumMax || px.clippedFraction > T.clipMaxFraction) {
        checks.light = 'fail'; result.light = 'too_bright';
      } else checks.light = 'pass';
      checks.sharpness = px.sharpness >= T.minSharpness ? 'pass' : 'fail';
    }

    // 8. Eyes open. Unknown (passes) when blendshapes are unavailable.
    if (input.eyeBlink) {
      checks.eyes = input.eyeBlink.left < T.maxEyeBlink && input.eyeBlink.right < T.maxEyeBlink ? 'pass' : 'fail';
    }

    // 9. Stillness over a 300 ms window. Fails until the window has filled,
    // so the face must have been still for the whole window.
    const anchors = STILLNESS_ANCHORS.map((i) => lm[i]);
    this.samples.push({ t: input.now, pts: anchors });
    while (this.samples.length > 2 && input.now - this.samples[1].t >= T.stillnessWindowMs) {
      this.samples.shift();
    }
    const span = input.now - this.samples[0].t;
    if (span >= T.stillnessWindowMs * 0.9 && eyeDist > 0) {
      const jitter = anchorJitter(this.samples) / eyeDist;
      result.measurements.jitter = jitter;
      checks.stillness = jitter < T.maxJitter ? 'pass' : 'fail';
    } else {
      checks.stillness = 'fail';
    }
    // No covered-face result yet for this face: hold, as "Hold still".
    if (input.coverPending) checks.stillness = 'fail';

    return this.finish(result);
  }

  private finish(result: GateResult): GateResult {
    return finishResult(result);
  }
}

/** Checks that never block the scan (spec v1.3): light is advice only. */
export const ADVISORY_CHECKS: ReadonlySet<GateCheckId> = new Set<GateCheckId>(['light']);

/** Fill in firstFailing / firstBlocking / allPass from the checks. */
function finishResult(result: GateResult): GateResult {
  result.firstFailing = GATE_CHECKS.find((c) => result.checks[c] === 'fail') ?? null;
  result.firstBlocking = GATE_CHECKS.find((c) => result.checks[c] === 'fail' && !ADVISORY_CHECKS.has(c)) ?? null;
  result.allPass = result.firstBlocking === null;
  return result;
}

/**
 * The checks the hint may talk about. Mid-scan only what holds the scan (not
 * the light advice); while the fill light settles, not the light either.
 */
export function hintableResult(result: GateResult, opts: { scanning: boolean; fillLightSettling: boolean }): GateResult {
  if (!(opts.scanning || opts.fillLightSettling) || result.checks.light !== 'fail') return result;
  return finishResult({ ...result, checks: { ...result.checks, light: 'unknown' } });
}

/**
 * Mean over anchors of the largest distance from that anchor's mean position
 * across the window.
 */
export function anchorJitter(samples: { pts: Point2[] }[]): number {
  if (samples.length < 2) return 0;
  const nAnchors = samples[0].pts.length;
  let total = 0;
  for (let a = 0; a < nAnchors; a++) {
    let mx = 0, my = 0;
    for (const s of samples) { mx += s.pts[a].x; my += s.pts[a].y; }
    mx /= samples.length; my /= samples.length;
    let maxD = 0;
    for (const s of samples) {
      const d = Math.hypot(s.pts[a].x - mx, s.pts[a].y - my);
      if (d > maxD) maxD = d;
    }
    total += maxD;
  }
  return total / nAnchors;
}

/**
 * Gate used when MediaPipe failed to load: only the pixel checks can run, on
 * the centre of the frame instead of the face. They block (pause the scan)
 * rather than only warn, which is what they did before the redesign.
 */
export function evaluatePixelOnlyGate(px: FaceAreaStats | undefined, motion: number | undefined): GateResult {
  const T = GATE_THRESHOLDS;
  const checks = Object.fromEntries(GATE_CHECKS.map((c) => [c, 'unknown'])) as Record<GateCheckId, CheckState>;
  const result: GateResult = { checks, firstFailing: null, firstBlocking: null, allPass: false, measurements: {} };
  if (px) {
    result.measurements.meanLuma = px.meanLuma;
    result.measurements.sharpness = px.sharpness;
    if (px.meanLuma < T.lumMin) { checks.light = 'fail'; result.light = 'too_dark'; }
    else if (px.meanLuma > T.lumMax || px.clippedFraction > T.clipMaxFraction) {
      checks.light = 'fail'; result.light = 'too_bright';
    } else checks.light = 'pass';
    checks.sharpness = px.sharpness >= T.minSharpness ? 'pass' : 'fail';
  }
  // Mean absolute luma difference between consecutive centre crops.
  if (motion !== undefined) checks.stillness = motion > PIXEL_MOTION_MAX ? 'fail' : 'pass';
  finishResult(result);
  return result;
}

/** Frame-difference motion ceiling for the pixel-only gate (0-255 luma). */
export const PIXEL_MOTION_MAX = 8;

// ============================================================================
// Hint scheduling
// ============================================================================

/** The text of one hint. `sub` is an optional second line. */
export interface Hint {
  id: string;
  text: string;
  sub?: string;
}

/**
 * Copy for a failing check, given the gate's direction details. The fill
 * light runs silently, so "too dark" always reads "Find more light".
 */
export function hintFor(
  check: GateCheckId,
  detail: { distance?: 'too_far' | 'too_close'; light?: 'too_dark' | 'too_bright'; inFrame?: 'off_centre' | 'too_close' },
): Hint {
  switch (check) {
    case 'face': return { id: 'face', text: GATE_HINTS.face };
    case 'one_person': return { id: 'one_person', text: GATE_HINTS.one_person };
    case 'covered': return { id: 'covered', text: GATE_HINTS.covered };
    case 'in_frame':
      // Centred but spilling out of the oval: too close, not off-centre.
      return detail.inFrame === 'too_close'
        ? { id: 'too_close', text: GATE_HINTS.too_close }
        : { id: 'in_frame', text: GATE_HINTS.in_frame };
    case 'distance':
      return detail.distance === 'too_close'
        ? { id: 'too_close', text: GATE_HINTS.too_close }
        : { id: 'too_far', text: GATE_HINTS.too_far };
    case 'pose': return { id: 'pose', text: GATE_HINTS.pose };
    case 'light':
      return detail.light === 'too_bright'
        ? { id: 'too_bright', text: GATE_HINTS.too_bright, sub: GATE_HINTS.too_bright_sub }
        : { id: 'too_dark', text: GATE_HINTS.too_dark, sub: GATE_HINTS.too_dark_sub };
    case 'sharpness': return { id: 'sharpness', text: GATE_HINTS.sharpness };
    case 'eyes': return { id: 'eyes', text: GATE_HINTS.eyes };
    case 'stillness': return { id: 'stillness', text: GATE_HINTS.stillness };
  }
}

/**
 * Decides which single hint is on screen.
 *
 * - A check must fail continuously for {@link HINT_TIMING.onsetMs} before its
 *   hint can show. Of the checks past onset, only the highest priority shows.
 * - A shown hint stays up at least {@link HINT_TIMING.minVisibleMs}, even if
 *   its check recovers or a more important one starts failing.
 *
 * Because every visible hint lasts at least minVisibleMs, two announcements
 * of the aria-live region are never closer together than that, so the same
 * scheduler rate-limits screen reader output.
 */
export class HintScheduler {
  private failingSince = new Map<GateCheckId, number>();
  private shown: { hint: Hint; check: GateCheckId; since: number } | null = null;

  constructor(
    private readonly onsetMs: number = HINT_TIMING.onsetMs,
    private readonly minVisibleMs: number = HINT_TIMING.minVisibleMs,
  ) {}

  reset(): void {
    this.failingSince.clear();
    this.shown = null;
  }

  /**
   * Feed one gate result. `hintOf` turns a check id into its copy (so callers
   * can supply live details like the distance direction). Returns the hint
   * that should be on screen now, or null.
   */
  update(result: GateResult, now: number, hintOf: (c: GateCheckId) => Hint): Hint | null {
    for (const c of GATE_CHECKS) {
      if (result.checks[c] === 'fail') {
        if (!this.failingSince.has(c)) this.failingSince.set(c, now);
      } else {
        this.failingSince.delete(c);
      }
    }
    const candidate = GATE_CHECKS.find((c) => {
      const since = this.failingSince.get(c);
      return since !== undefined && now - since >= this.onsetMs;
    });

    if (this.shown && now - this.shown.since < this.minVisibleMs) {
      return this.shown.hint;
    }
    if (!candidate) {
      this.shown = null;
      return null;
    }
    const hint = hintOf(candidate);
    if (!this.shown || this.shown.hint.id !== hint.id) {
      this.shown = { hint, check: candidate, since: now };
    } else {
      this.shown.hint = hint;
    }
    return this.shown.hint;
  }

  /**
   * True when some check has failed continuously for at least the onset time,
   * i.e. a failure the user is (or is about to be) told about. Short blips
   * return false.
   */
  hasSustainedFailure(now: number): boolean {
    for (const since of this.failingSince.values()) {
      if (now - since >= this.onsetMs) return true;
    }
    return false;
  }

  /** The check whose hint is visible, if any. */
  get visibleCheck(): GateCheckId | null {
    return this.shown?.check ?? null;
  }
}

// ============================================================================
// Colours
// ============================================================================

/** Sense defaults for the capture visuals. */
export const CAPTURE_COLOR_DEFAULTS = {
  ring: '#4F7CFF',
  contourStart: '#7A96FF',
  contourEnd: '#A878FC',
  warning: '#FFB84D',
} as const;

/** The dark camera scrim custom colours are checked against (same as iOS). */
export const CAPTURE_CONTRAST_BACKGROUND = '#1A1A1A';
/** Minimum WCAG contrast ratio for a custom capture colour. */
export const CAPTURE_MIN_CONTRAST = 3;

/** Parse #rgb / #rrggbb. Returns null for anything else. */
export function parseHex(hex: string | undefined | null): [number, number, number] | null {
  if (typeof hex !== 'string') return null;
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two hex colours, or 0 if either is invalid. */
export function contrastRatio(a: string, b: string): number {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return 0;
  const la = relativeLuminance(pa);
  const lb = relativeLuminance(pb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Integrator overrides for the capture visuals (FlowAppearance `capture`). */
export interface CaptureColors {
  ring?: string;
  contourStart?: string;
  contourEnd?: string;
  warning?: string;
}

/**
 * Resolve the capture colours: each override is used only when it is a valid
 * hex colour with at least 3:1 contrast on the dark camera background,
 * otherwise the Sense default is used, so a brand colour can never make the
 * guide unreadable.
 */
export function resolveCaptureColors(overrides?: CaptureColors): Required<CaptureColors> {
  const pick = (v: string | undefined, fallback: string) =>
    v && contrastRatio(v, CAPTURE_CONTRAST_BACKGROUND) >= CAPTURE_MIN_CONTRAST ? v.trim() : fallback;
  return {
    ring: pick(overrides?.ring, CAPTURE_COLOR_DEFAULTS.ring),
    contourStart: pick(overrides?.contourStart, CAPTURE_COLOR_DEFAULTS.contourStart),
    contourEnd: pick(overrides?.contourEnd, CAPTURE_COLOR_DEFAULTS.contourEnd),
    warning: pick(overrides?.warning, CAPTURE_COLOR_DEFAULTS.warning),
  };
}
