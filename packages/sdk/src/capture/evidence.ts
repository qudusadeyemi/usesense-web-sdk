/**
 * LiveSense evidence contract (capture-test-kit/EVIDENCE-v1.md), web side.
 *
 * The device collects, the server decides: everything here is raw evidence
 * for Watchtower's scorers (evidence-contract.ts, evidence-record.ts,
 * evidence-scorers.ts), never a score.
 *
 *  - parseEvidenceConfig: the optional `evidence` block from session create /
 *    Flow init-session / token exchange. Absent or another contract: null, and
 *    the upload stays as it was.
 *  - Per frame (sections 3 to 5): one entry per uploaded frame, in upload
 *    order; 478 landmarks rounded to 5 decimals (in the uploaded JPEG's space,
 *    not mirrored); the transformation matrix and the matrix_zyx_v3 pose; the
 *    two eye blendshapes.
 *  - ColourSequencePlayer (section 6): plays the server's colours during the
 *    scan and records what was actually shown, on the capture clock.
 *  - buildEvidenceUpload: metadata.evidence. Web has no closer step and no
 *    binding v2 (reduced assurance), and says so in `capability`.
 */

import { poseFromMatrix } from './quality-gate';

export const EVIDENCE_CONTRACT = 'evidence-v1';
export const POSE_METHOD_V3 = 'matrix_zyx_v3';
/** The pose label old SDKs used; the server reads it as "method unknown". */
export const POSE_METHOD_LEGACY = 'mediapipe_zyx_v2';

// ============================================================================
// Session create: the evidence block
// ============================================================================

/** The server's colour sequence for the reflection check. */
export interface ColourSequenceConfig {
  id: string;
  /** `#RRGGBB`, upper case, in the server's order. Never reordered or cached. */
  colours: string[];
  segmentMs: number;
  leadInMs: number;
  /** Tint opacity over the camera view, 0 to 1. */
  opacity: number;
}

/** The `evidence` block, decoded. Every part is optional on the wire. */
export interface EvidenceConfig {
  colourSequence: ColourSequenceConfig | null;
  /** Always disabled for web sessions; read, never assumed. */
  closerStep: { enabled: boolean; targetScale: number | null; minScale: number | null } | null;
  bindingV2Enabled: boolean;
  landmarks: { required: boolean; format: string | null } | null;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const posNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

function parseColourSequence(v: unknown): ColourSequenceConfig | null {
  if (!isObj(v)) return null;
  const id = typeof v.id === 'string' && v.id.length > 0 ? v.id : null;
  const colours = Array.isArray(v.colours) ? v.colours : null;
  if (!id || !colours || colours.length === 0) return null;
  if (!colours.every((c) => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c))) return null;
  const segmentMs = posNum(v.segment_ms);
  const leadInMs = typeof v.lead_in_ms === 'number' && Number.isFinite(v.lead_in_ms) && v.lead_in_ms >= 0 ? v.lead_in_ms : null;
  const opacity = posNum(v.opacity);
  if (segmentMs === null || leadInMs === null || opacity === null) return null;
  return {
    id,
    colours: (colours as string[]).map((c) => c.toUpperCase()),
    segmentMs,
    leadInMs,
    opacity: Math.min(1, opacity),
  };
}

/**
 * Decode the optional `evidence` block (EVIDENCE-v1 section 1). Never throws.
 * Absent, not an object, or a contract other than "evidence-v1": null, which
 * means "do none of sections 4 to 7". Inside the block every key is optional,
 * unknown keys are ignored, and a malformed key reads as absent.
 */
export function parseEvidenceConfig(raw: unknown): EvidenceConfig | null {
  if (!isObj(raw) || raw.contract !== EVIDENCE_CONTRACT) return null;
  const closer = isObj(raw.closer_step)
    ? {
        enabled: raw.closer_step.enabled === true,
        targetScale: posNum(raw.closer_step.target_scale),
        minScale: posNum(raw.closer_step.min_scale),
      }
    : null;
  const landmarks = isObj(raw.landmarks)
    ? {
        required: raw.landmarks.required === true,
        format: typeof raw.landmarks.format === 'string' ? raw.landmarks.format : null,
      }
    : null;
  return {
    colourSequence: parseColourSequence(raw.colour_sequence),
    closerStep: closer,
    bindingV2Enabled: isObj(raw.binding_v2) && raw.binding_v2.enabled === true,
    landmarks,
  };
}

// ============================================================================
// Per frame (sections 3, 4, 5)
// ============================================================================

/** Round to `d` decimals. -0 becomes 0 so JSON and the digest agree. */
export function roundTo(v: number, d: number): number {
  const f = 10 ** d;
  const r = Math.round(v * f) / f;
  return r === 0 ? 0 : r;
}

/** Every value rounded to `d` decimals (default 5, the contract's precision). */
export function roundAll(values: ArrayLike<number>, d = 5): number[] {
  const out = new Array<number>(values.length);
  for (let i = 0; i < values.length; i++) out[i] = roundTo(values[i], d);
  return out;
}

/** What one frame's landmarker result contributes to its package entry. */
export interface FrameEvidenceInput {
  /** Flat [x0, y0, z0, ...] normalised to the uploaded JPEG (478 or 468 points). */
  landmarks: ArrayLike<number>;
  /** Facial transformation matrix, row-major 4x4. */
  matrix?: ArrayLike<number> | null;
  blendshapes?: Array<{ categoryName: string; score: number }> | null;
}

export interface FrameEvidenceFields {
  /** 5 decimals, rounded BEFORE meshDigest so the server hashes what it reads. */
  landmarks: number[];
  /** 16 values, row-major, 5 decimals; absent without a matrix. */
  transformMatrix?: number[];
  /** matrix_zyx_v3 from the rounded matrix (degrees); absent without a matrix. */
  pose?: { yaw: number; pitch: number; roll: number };
  blendshapes?: { eyeBlinkLeft: number; eyeBlinkRight: number };
}

/**
 * The contract's per-frame fields for one landmarker result. The pose is
 * computed from the ROUNDED matrix with the server's formula, so the server's
 * recomputation from `transformMatrix` agrees with it exactly.
 */
export function frameEvidenceFields(input: FrameEvidenceInput): FrameEvidenceFields {
  const out: FrameEvidenceFields = { landmarks: roundAll(input.landmarks, 5) };
  const m = input.matrix;
  if (m && m.length === 16) {
    const matrix = roundAll(m, 5);
    if (matrix.every(Number.isFinite)) {
      out.transformMatrix = matrix;
      const p = poseFromMatrix(matrix);
      out.pose = { yaw: roundTo(p.yaw, 3), pitch: roundTo(p.pitch, 3), roll: roundTo(p.roll, 3) };
    }
  }
  const cats = input.blendshapes ?? [];
  const score = (name: string) => cats.find((c) => c.categoryName === name)?.score;
  const l = score('eyeBlinkLeft');
  const r = score('eyeBlinkRight');
  if (typeof l === 'number' && typeof r === 'number' && Number.isFinite(l) && Number.isFinite(r)) {
    out.blendshapes = { eyeBlinkLeft: roundTo(l, 3), eyeBlinkRight: roundTo(r, 3) };
  }
  return out;
}

/**
 * Frame rules (EVIDENCE-v1 section 3): at most one mesh entry per uploaded
 * frame, keyed by its upload position, in ascending order. A signal whose
 * index is outside the upload, a second signal for the same frame, or a frame
 * whose JPEG bytes repeat an earlier frame's (same hash) gets no entry; a
 * frame with no signal simply has none (never a neighbour's mesh).
 */
export function selectMeshSignals<T extends { frameIndex: number }>(
  signals: readonly T[],
  uploadHashes: readonly string[],
): T[] {
  const byIndex = new Map<number, T>();
  for (const s of signals) {
    const i = s.frameIndex;
    if (!Number.isInteger(i) || i < 0 || i >= uploadHashes.length || !uploadHashes[i]) continue;
    if (!byIndex.has(i)) byIndex.set(i, s);
  }
  const seenHash = new Set<string>();
  const out: T[] = [];
  for (const i of [...byIndex.keys()].sort((a, b) => a - b)) {
    const h = uploadHashes[i];
    if (seenHash.has(h)) continue;
    seenHash.add(h);
    out.push(byIndex.get(i)!);
  }
  return out;
}

// ============================================================================
// Colour sequence (section 6)
// ============================================================================

export interface ColourSegment {
  colour: string;
  start_ms: number;
  end_ms: number;
}

/** metadata.evidence.colour, as uploaded. */
export interface ColourEvidence {
  sequence_id: string;
  segments: ColourSegment[];
  /** Browsers cannot read or set screen brightness. */
  screen_brightness: number | null;
  completed: boolean;
  interrupted_reason: string | null;
  awb_locked: boolean;
}

/** What the player needs from the screen. */
export interface ColourTintHost {
  /** Show `colour` over the camera view at `opacity`; null hides the tint. */
  showTint(colour: string | null, opacity: number): void;
}

export interface ColourPlayerOptions {
  /** Frame scheduler (default requestAnimationFrame); the callback gets the rAF timestamp. */
  requestFrame?: (cb: (t: number) => void) => number;
  cancelFrame?: (id: number) => void;
  /** Lock (true) or unlock (false) the camera's white balance; resolves to whether it took. */
  lockWhiteBalance?: (lock: boolean) => Promise<boolean> | boolean;
  /** Time source for play() and interrupt() (default performance.now). */
  now?: () => number;
}

export type ColourPhase = { kind: 'idle' } | { kind: 'leadIn' } | { kind: 'segment'; index: number } | { kind: 'done' };

/** Plays that may show a colour before the scan stops waiting for the sequence. */
export const COLOUR_MAX_RUNS = 3;

/**
 * Plays the server's colour sequence and records what was shown.
 *
 * Each segment's `start_ms` is the requestAnimationFrame timestamp of the
 * frame that first draws it, on the capture clock (`clock`). Order rule
 * (Watchtower `scoreReflection`): uploaded segments must read `issued[i % n]`,
 * so a gate pause drops the partly shown segment and the replay resumes at
 * that colour, and a dropped scan window clears the record so the next window
 * starts at the first colour (the same choice as iOS PR #101; the spec's
 * literal "replay the full sequence" would score `sequence_mismatch`).
 */
export class ColourSequencePlayer {
  readonly sequence: ColourSequenceConfig;
  host: ColourTintHost | null = null;
  private readonly clock: (t: number) => number | null;
  private readonly requestFrame: (cb: (t: number) => void) => number;
  private readonly cancelFrame: (id: number) => void;
  private readonly lockWhiteBalance?: (lock: boolean) => Promise<boolean> | boolean;
  private readonly now: () => number;

  private _phase: ColourPhase = { kind: 'idle' };
  private _record: ColourEvidence;
  private _runs = 0;
  private shownThisPlay = false;
  private phaseStart = 0;
  private frameId: number | null = null;
  private awbAll = true;
  private awbKnown = false;
  private _nextIndex = 0;
  /** Lock and unlock calls run one after another, never overlapping. */
  private wbChain: Promise<unknown> = Promise.resolve();

  constructor(sequence: ColourSequenceConfig, clock: (t: number) => number | null, options: ColourPlayerOptions = {}) {
    this.sequence = sequence;
    this.clock = clock;
    this.requestFrame = options.requestFrame ?? ((cb) => requestAnimationFrame(cb));
    this.cancelFrame = options.cancelFrame ?? ((id) => cancelAnimationFrame(id));
    this.lockWhiteBalance = options.lockWhiteBalance;
    this.now = options.now ?? (() => performance.now());
    this._record = this.emptyRecord();
  }

  private emptyRecord(): ColourEvidence {
    return {
      sequence_id: this.sequence.id,
      segments: [],
      screen_brightness: null,
      completed: false,
      interrupted_reason: null,
      awb_locked: false,
    };
  }

  get phase(): ColourPhase { return this._phase; }
  /** A copy of what has been shown so far. */
  get record(): ColourEvidence { return { ...this._record, segments: this._record.segments.map((s) => ({ ...s })) }; }
  /** Plays that showed at least one colour (a pause in the lead-in costs nothing). */
  get runs(): number { return this._runs; }
  /** The colour index the next play starts at. */
  get nextIndex(): number { return this._nextIndex; }
  get isPlaying(): boolean { return this._phase.kind === 'leadIn' || this._phase.kind === 'segment'; }
  get finished(): boolean { return this._phase.kind === 'done'; }
  /** True while a colour is on screen. */
  get tinting(): boolean { return this._phase.kind === 'segment'; }
  /** Whether another play may start (not playing, not done, runs left). */
  get canPlay(): boolean { return !this.isPlaying && !this.finished && this._runs < COLOUR_MAX_RUNS; }

  /** Time a play started now would take: the lead-in plus the colours still to show. */
  remainingMs(): number {
    return this.sequence.leadInMs + (this.sequence.colours.length - this._nextIndex) * this.sequence.segmentMs;
  }

  /** Start, or resume after a pause, with a lead-in. */
  play(): void {
    if (!this.canPlay) return;
    this.shownThisPlay = false;
    this._phase = { kind: 'leadIn' };
    this.phaseStart = this.now();
    if (this.lockWhiteBalance) {
      this.whiteBalance(true).then((ok) => this.noteAwb(ok));
    } else {
      this.noteAwb(false);
    }
    this.schedule();
  }

  private whiteBalance(lock: boolean): Promise<boolean> {
    const next = this.wbChain
      .then(() => this.lockWhiteBalance!(lock))
      .then((ok) => ok === true, () => false);
    this.wbChain = next;
    return next;
  }

  private noteAwb(ok: boolean): void {
    this.awbAll = this.awbAll && ok;
    this.awbKnown = true;
    this._record.awb_locked = this.awbKnown && this.awbAll;
  }

  /**
   * A gate pause (or the scan ending): stop the tint. The partly shown
   * segment is dropped and the next play resumes at its colour.
   */
  interrupt(reason = 'gate_pause'): void {
    if (!this.isPlaying) return;
    if (this._phase.kind === 'segment') {
      this._record.segments.pop();
      this._nextIndex = this._phase.index;
    }
    this._record.completed = false;
    this._record.interrupted_reason = reason;
    this.stop({ kind: 'idle' });
  }

  /** Abandon the sequence (capture over, engine gone). */
  cancel(): void { this.interrupt('cancelled'); }

  /** The scan window was dropped with its frames: the segments go too. */
  resetForNewWindow(): void {
    this.interrupt('window_dropped');
    this._record = this.emptyRecord();
    this._nextIndex = 0;
    this._runs = 0;
    this.awbAll = true;
    this.awbKnown = false;
    this._phase = { kind: 'idle' };
  }

  private schedule(): void {
    this.frameId = this.requestFrame((t) => {
      this.frameId = null;
      if (!this.isPlaying) return;
      this.advance(t);
      if (this.isPlaying) this.schedule();
    });
  }

  /** Drive the state machine to the frame drawn at `t` (exposed for tests). */
  advance(t: number): void {
    const { leadInMs, segmentMs, colours } = this.sequence;
    const p = this._phase;
    if (p.kind === 'leadIn' && t - this.phaseStart >= leadInMs) {
      this.begin(this._nextIndex, t);
    } else if (p.kind === 'segment' && t - this.phaseStart >= segmentMs) {
      this.closeSegment(t);
      this._nextIndex = p.index + 1;
      if (p.index + 1 < colours.length) {
        this.begin(p.index + 1, t);
      } else {
        this._record.completed = true;
        // interrupted_reason is kept: it says the sequence completed after a pause.
        this.stop({ kind: 'done' });
      }
    }
  }

  private begin(i: number, t: number): void {
    const ms = this.clock(t);
    if (ms === null) return;
    this._phase = { kind: 'segment', index: i };
    this.phaseStart = t;
    if (!this.shownThisPlay) { this.shownThisPlay = true; this._runs++; }
    const colour = this.sequence.colours[i];
    this._record.segments.push({ colour, start_ms: ms, end_ms: ms });
    this.host?.showTint(colour, this.sequence.opacity);
  }

  private closeSegment(t: number): void {
    const last = this._record.segments[this._record.segments.length - 1];
    if (!last) return;
    const ms = this.clock(t);
    last.end_ms = Math.max(last.start_ms + 1, ms ?? last.start_ms + 1);
  }

  private stop(next: ColourPhase): void {
    const wasPlaying = this.isPlaying;
    if (this.frameId !== null) { this.cancelFrame(this.frameId); this.frameId = null; }
    this._phase = next;
    if (!wasPlaying) return;
    this.host?.showTint(null, 0);
    if (this.lockWhiteBalance) void this.whiteBalance(false);
  }
}

/**
 * Capture-clock milliseconds for a performance.now()-based time: integer ms
 * since the camera opened (`origin`), never negative. Null before the camera.
 */
export function captureClockMs(t: number, origin: number | null): number | null {
  if (origin === null || !Number.isFinite(origin) || !Number.isFinite(t)) return null;
  return Math.max(0, Math.round(t - origin));
}

// ============================================================================
// White balance (section 6: lock if the platform allows)
// ============================================================================

/**
 * Lock or unlock the camera's white balance through the track's
 * `whiteBalanceMode` constraint, where the browser exposes it (Chrome on some
 * Android and Windows cameras; not on macOS). Locks at the current colour
 * temperature so the picture does not shift. Resolves to whether the track
 * reports the requested mode afterwards; false wherever it is unsupported.
 */
export async function setWhiteBalanceLock(track: MediaStreamTrack | null | undefined, lock: boolean): Promise<boolean> {
  try {
    if (!track || typeof track.getCapabilities !== 'function' || typeof track.applyConstraints !== 'function') return false;
    const caps = track.getCapabilities() as Record<string, unknown>;
    const modes = Array.isArray(caps.whiteBalanceMode) ? (caps.whiteBalanceMode as string[]) : [];
    const want = lock ? 'manual' : 'continuous';
    if (!modes.includes(want)) return false;
    const settings = track.getSettings() as Record<string, unknown>;
    const advanced: Record<string, unknown> = { whiteBalanceMode: want };
    if (lock && typeof settings.colorTemperature === 'number') advanced.colorTemperature = settings.colorTemperature;
    await Promise.race([
      track.applyConstraints({ advanced: [advanced] } as MediaTrackConstraints),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
    ]);
    return (track.getSettings() as Record<string, unknown>).whiteBalanceMode === want;
  } catch {
    return false;
  }
}

// ============================================================================
// metadata.evidence (sections 2, 7, 8)
// ============================================================================

export interface EvidenceCapability {
  landmarks: boolean;
  blendshapes: boolean;
  pose_method: string | null;
  closer_step: boolean;
  binding_v2: boolean;
}

/** metadata.evidence for the round-1 upload. */
export interface EvidenceUpload {
  contract: typeof EVIDENCE_CONTRACT;
  clock: 'capture_monotonic_ms';
  colour?: ColourEvidence;
  closer: { completed: false; skipped_reason: 'platform_web' };
  capability: EvidenceCapability;
}

/**
 * What this build can do, whether or not it happened in this session
 * (section 2). Landmarks, blendshapes and the matrix pose need MediaPipe
 * loaded; the web has no closer step and no binding v2.
 */
export function webEvidenceCapability(meshAvailable: boolean): EvidenceCapability {
  return {
    landmarks: meshAvailable,
    blendshapes: meshAvailable,
    pose_method: meshAvailable ? POSE_METHOD_V3 : null,
    closer_step: false,
    binding_v2: false,
  };
}

/**
 * metadata.evidence. `colour` is the player's record when the server sent a
 * sequence (omitted otherwise). The closer step is always the web skip and
 * nothing else; there is no `binding` (web stays on binding v1).
 */
export function buildEvidenceUpload(opts: { meshAvailable: boolean; colour?: ColourEvidence | null }): EvidenceUpload {
  return {
    contract: EVIDENCE_CONTRACT,
    clock: 'capture_monotonic_ms',
    ...(opts.colour ? { colour: opts.colour } : {}),
    closer: { completed: false, skipped_reason: 'platform_web' },
    capability: webEvidenceCapability(opts.meshAvailable),
  };
}

/** Watchtower scoreReflection ignores a segment's first 150 ms (the camera catching up). */
export const REFLECTION_RISE_MS = 150;

/**
 * Frames per colour segment inside the window the server scores
 * ([start_ms + 150, end_ms]), from the package's capture-clock timestamps.
 * Diagnostic only (logged at upload): a 0 means that segment cannot count.
 */
export function framesPerSegment(segments: readonly ColourSegment[], timestamps: readonly number[]): number[] {
  return segments.map((s) => timestamps.filter((t) => t >= s.start_ms + REFLECTION_RISE_MS && t <= s.end_ms).length);
}

/** Face chroma on one tracked video frame (capture-clock ms, mean red and blue chromaticity). */
export interface ChromaSample { t: number; r: number; b: number }

/**
 * Optical latency of each colour segment: ms from the segment's start (the
 * rAF that drew it) to the first tracked video frame whose face chroma has
 * moved half way from the colour before to this colour. This is display +
 * exposure + delivery, the lag between a colour being recorded and a frame
 * stamped at draw time showing it. The server ignores each segment's first
 * 150 ms; a latency above that means frames are paired with the previous
 * colour. Null for a segment whose chroma step is too small to read.
 */
export function colourOnsetLatencies(samples: readonly ChromaSample[], segments: readonly ColourSegment[]): Array<number | null> {
  const mean = (xs: readonly ChromaSample[]) => xs.length
    ? { r: xs.reduce((a, s) => a + s.r, 0) / xs.length, b: xs.reduce((a, s) => a + s.b, 0) / xs.length }
    : null;
  return segments.map((seg) => {
    const pre = mean(samples.filter((s) => s.t >= seg.start_ms - 200 && s.t < seg.start_ms));
    const post = mean(samples.filter((s) => s.t >= seg.end_ms - 250 && s.t <= seg.end_ms));
    if (!pre || !post) return null;
    const step = Math.hypot(post.r - pre.r, post.b - pre.b);
    if (step < 0.002) return null;
    const hit = samples.find((s) => s.t >= seg.start_ms && s.t <= seg.end_ms && Math.hypot(s.r - pre.r, s.b - pre.b) >= step / 2);
    return hit ? hit.t - seg.start_ms : null;
  });
}

function hexChroma(hex: string): { r: number; b: number } | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  const R = parseInt(m[1], 16), G = parseInt(m[2], 16), B = parseInt(m[3], 16);
  const s = R + G + B;
  return s > 0 ? { r: R / s, b: B / s } : null;
}

/**
 * The display-to-camera lag that best explains the face chroma trace: for
 * each candidate lag L, the Pearson correlation between the tracked face
 * chroma (red and blue, centred) and the chroma of the colour shown at t - L,
 * over every tracked frame that falls in a segment. Uses all frames at once,
 * so it reads a shift far smaller than one frame's noise. `corrAtZero` is the
 * fit a draw-time stamp assumes. Null without at least 8 usable frames.
 */
export function estimateColourLag(
  samples: readonly ChromaSample[],
  segments: readonly ColourSegment[],
  maxLagMs = 400,
  stepMs = 10,
): { lagMs: number; corr: number; corrAtZero: number; frames: number } | null {
  const screen = segments.map((s) => ({ ...s, c: hexChroma(s.colour) }));
  const fit = (lag: number): { corr: number; n: number } | null => {
    const xs: number[] = [], ys: number[] = [];
    for (const s of samples) {
      const seg = screen.find((g) => s.t - lag >= g.start_ms && s.t - lag < g.end_ms);
      if (!seg?.c) continue;
      xs.push(s.r, s.b);
      ys.push(seg.c.r, seg.c.b);
    }
    if (xs.length < 16) return null;
    const centre = (v: number[]) => {
      const mr = v.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) / (v.length / 2);
      const mb = v.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0) / (v.length / 2);
      return v.map((x, i) => x - (i % 2 === 0 ? mr : mb));
    };
    const a = centre(xs), b = centre(ys);
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < a.length; i++) { num += a[i] * b[i]; da += a[i] ** 2; db += b[i] ** 2; }
    return da > 0 && db > 0 ? { corr: num / Math.sqrt(da * db), n: xs.length / 2 } : null;
  };
  const zero = fit(0);
  if (!zero) return null;
  let best = { lagMs: 0, corr: zero.corr };
  for (let lag = stepMs; lag <= maxLagMs; lag += stepMs) {
    const f = fit(lag);
    if (f && f.corr > best.corr) best = { lagMs: lag, corr: f.corr };
  }
  const round3 = (v: number) => Math.round(v * 1000) / 1000;
  return { lagMs: best.lagMs, corr: round3(best.corr), corrAtZero: round3(zero.corr), frames: zero.n };
}
