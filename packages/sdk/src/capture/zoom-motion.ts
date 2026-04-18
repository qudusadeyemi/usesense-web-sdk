/**
 * Zoom-motion controller.
 *
 * Phase 1 ticket X-3.
 *
 * Consumes a stream of per-frame face observations (bounding box + head
 * pose) and decides whether the user is performing the v4 induced-zoom
 * motion: holding their face at arm's length, then moving the camera
 * closer so the face bounding box grows by ~40% in the image plane.
 *
 * The controller is a pure state machine. It does NOT touch the camera,
 * does NOT invoke MediaPipe, and does NOT capture frames. Call-sites:
 *
 *   - X-5 phase machine: starts the controller when the zoom phase begins
 *     and stops it on completion or timeout.
 *   - The MediaPipe landmark callback in the v4 capture loop: feeds one
 *     observation per frame via `observe()`.
 *
 * Outcomes:
 *   - `complete`     motion followed expected trajectory and ended in the
 *                    enlarged-oval target band
 *   - `timeout`      3 seconds elapsed without completing the motion
 *   - `no_motion`    bbox did not grow fast enough for long enough
 *   - `head_turn`    head yaw or pitch exceeded 15 degrees during the motion
 *
 * The controller reports motion_stats on completion; the caller stuffs
 * this into the upload metadata so the server can cross-check against
 * its own SfM reconstruction.
 *
 * References:
 *   - Spec section 4 (perspective distortion geometry)
 *   - Spec section 6.3.2 (zoom-phase UX)
 */

// ─── Public types ───────────────────────────────────────────────────────────

export interface FaceBoundingBox {
  /** Centre x in image pixels. */
  readonly cx: number;
  /** Centre y in image pixels. */
  readonly cy: number;
  /** Width in image pixels. */
  readonly w: number;
  /** Height in image pixels. */
  readonly h: number;
}

export interface HeadPoseDegrees {
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
}

export interface ZoomObservation {
  /** Monotonic timestamp in ms (performance.now() is fine). */
  readonly timestampMs: number;
  readonly bbox: FaceBoundingBox;
  readonly headPose: HeadPoseDegrees;
}

export type ZoomState = 'idle' | 'watching' | 'moving' | 'complete' | 'failed';

export type ZoomFailureReason = 'timeout' | 'no_motion' | 'head_turn' | 'face_lost';

export interface ZoomMotionStats {
  readonly startBbox: FaceBoundingBox | null;
  readonly endBbox: FaceBoundingBox | null;
  /** Final scale ratio, endBbox area / startBbox area. */
  readonly scaleRatio: number;
  /** Time from first observation to complete/failure, in ms. */
  readonly durationMs: number;
  /** Peak absolute head yaw during the session. */
  readonly maxHeadYawAbsDeg: number;
  /** Peak absolute head pitch during the session. */
  readonly maxHeadPitchAbsDeg: number;
  /** Number of observations fed. */
  readonly observationCount: number;
}

export interface ZoomMotionConfig {
  /** Total allowed wall-clock time from start() to completion. Default 3000ms. */
  readonly timeoutMs?: number;
  /** Rolling window for "growth velocity" detection. Default 200ms. */
  readonly windowMs?: number;
  /**
   * Minimum bbox area growth in the rolling window to consider motion "active".
   * Fraction of start-area. Default 0.05 (i.e. 5% growth in windowMs).
   */
  readonly minGrowthInWindow?: number;
  /**
   * Required final scale ratio (end bbox area / start bbox area). The client
   * target corresponds to the oval going from 1.0 to 1.4 linear scale, which
   * is 1.96 area scale. We allow a tolerance band.
   */
  readonly completionMinScaleRatio?: number;
  readonly completionMaxScaleRatio?: number;
  /**
   * Stable dwell time at the completion band before we declare complete.
   * Default 200ms.
   */
  readonly completionDwellMs?: number;
  /** Head pose tolerance during the motion, in degrees (yaw and pitch). */
  readonly maxHeadPoseDeg?: number;
  /**
   * Duration without any growth signal, starting from the first observation,
   * after which we give up even if the overall timeout has not elapsed.
   * Default 1500ms.
   */
  readonly noMotionGraceMs?: number;
}

const DEFAULT_CONFIG: Required<ZoomMotionConfig> = {
  timeoutMs: 3000,
  windowMs: 200,
  minGrowthInWindow: 0.05,
  completionMinScaleRatio: 1.7,
  completionMaxScaleRatio: 2.4,
  completionDwellMs: 200,
  maxHeadPoseDeg: 15,
  noMotionGraceMs: 1500,
};

export type ZoomTransitionListener = (
  next: ZoomState,
  prev: ZoomState,
  stats: ZoomMotionStats,
  failure?: ZoomFailureReason,
) => void;

// ─── Controller ─────────────────────────────────────────────────────────────

export class ZoomMotionController {
  private readonly cfg: Required<ZoomMotionConfig>;
  private state: ZoomState = 'idle';
  private startTs: number | null = null;
  private startBbox: FaceBoundingBox | null = null;
  private latestBbox: FaceBoundingBox | null = null;
  private completionDwellStartedAt: number | null = null;
  private lastMotionTs: number | null = null;
  private maxYaw = 0;
  private maxPitch = 0;
  private count = 0;
  private window: { ts: number; area: number }[] = [];
  private listeners: ZoomTransitionListener[] = [];

  constructor(config: ZoomMotionConfig = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
  }

  /** Begin watching. No observations are processed until this is called. */
  start(): void {
    if (this.state !== 'idle' && this.state !== 'complete' && this.state !== 'failed') {
      return; // idempotent
    }
    this.reset();
    this.transition('watching');
  }

  /** Force-stop the controller in its current terminal state. No-op if terminal. */
  stop(): void {
    if (this.state === 'complete' || this.state === 'failed') return;
    this.failWith('timeout');
  }

  /**
   * Feed one observation. Returns true if this observation changed state.
   *
   * The controller is resilient to out-of-order timestamps: an observation
   * older than the previous one is dropped.
   */
  observe(obs: ZoomObservation): boolean {
    if (this.state !== 'watching' && this.state !== 'moving') return false;

    const prev = this.state;

    if (this.startTs === null) {
      this.startTs = obs.timestampMs;
      this.startBbox = { ...obs.bbox };
      this.latestBbox = { ...obs.bbox };
      this.count = 0;
      this.window = [];
    }

    if (obs.timestampMs < (this.window[this.window.length - 1]?.ts ?? 0)) {
      return false; // stale
    }

    this.count += 1;
    this.latestBbox = { ...obs.bbox };
    this.maxYaw = Math.max(this.maxYaw, Math.abs(obs.headPose.yaw));
    this.maxPitch = Math.max(this.maxPitch, Math.abs(obs.headPose.pitch));

    const elapsed = obs.timestampMs - this.startTs;

    // 1. Head-pose tolerance: fail fast if user turns away.
    if (
      Math.abs(obs.headPose.yaw) > this.cfg.maxHeadPoseDeg ||
      Math.abs(obs.headPose.pitch) > this.cfg.maxHeadPoseDeg
    ) {
      this.failWith('head_turn');
      return true;
    }

    // 2. Timeout check
    if (elapsed > this.cfg.timeoutMs) {
      this.failWith('timeout');
      return true;
    }

    // 3. Growth tracking via rolling window
    const area = obs.bbox.w * obs.bbox.h;
    this.window.push({ ts: obs.timestampMs, area });
    const lower = obs.timestampMs - this.cfg.windowMs;
    while (this.window.length > 1 && this.window[0].ts < lower) {
      this.window.shift();
    }
    const startArea = (this.startBbox!.w * this.startBbox!.h) || 1;
    const windowStartArea = this.window[0].area;
    const growthInWindow = (area - windowStartArea) / startArea;

    if (growthInWindow >= this.cfg.minGrowthInWindow) {
      this.lastMotionTs = obs.timestampMs;
      if (this.state === 'watching') {
        this.transition('moving');
      }
    }

    // 4. Completion band
    const scaleRatio = area / startArea;
    if (
      scaleRatio >= this.cfg.completionMinScaleRatio &&
      scaleRatio <= this.cfg.completionMaxScaleRatio
    ) {
      if (this.completionDwellStartedAt === null) {
        this.completionDwellStartedAt = obs.timestampMs;
      } else if (obs.timestampMs - this.completionDwellStartedAt >= this.cfg.completionDwellMs) {
        this.transition('complete');
        return true;
      }
    } else {
      this.completionDwellStartedAt = null;
    }

    // 5. No-motion grace: if we've never seen sufficient growth, fail early.
    if (this.lastMotionTs === null && elapsed >= this.cfg.noMotionGraceMs) {
      this.failWith('no_motion');
      return true;
    }

    return this.state !== prev;
  }

  /**
   * Register an observer of state transitions. Returns an unsubscribe fn.
   */
  on(listener: ZoomTransitionListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getState(): ZoomState {
    return this.state;
  }

  stats(): ZoomMotionStats {
    const durationMs =
      this.startTs === null || this.latestBbox === null
        ? 0
        : (this.window[this.window.length - 1]?.ts ?? this.startTs) - this.startTs;
    const startArea = this.startBbox ? this.startBbox.w * this.startBbox.h : 0;
    const endArea = this.latestBbox ? this.latestBbox.w * this.latestBbox.h : 0;
    return {
      startBbox: this.startBbox ? { ...this.startBbox } : null,
      endBbox: this.latestBbox ? { ...this.latestBbox } : null,
      scaleRatio: startArea > 0 ? endArea / startArea : 0,
      durationMs,
      maxHeadYawAbsDeg: this.maxYaw,
      maxHeadPitchAbsDeg: this.maxPitch,
      observationCount: this.count,
    };
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private reset(): void {
    this.startTs = null;
    this.startBbox = null;
    this.latestBbox = null;
    this.completionDwellStartedAt = null;
    this.lastMotionTs = null;
    this.maxYaw = 0;
    this.maxPitch = 0;
    this.count = 0;
    this.window = [];
  }

  private transition(next: ZoomState, failure?: ZoomFailureReason): void {
    const prev = this.state;
    if (prev === next) return;
    this.state = next;
    const stats = this.stats();
    for (const l of this.listeners) {
      try {
        l(next, prev, stats, failure);
      } catch {
        // listener errors are swallowed
      }
    }
  }

  private failWith(reason: ZoomFailureReason): void {
    this.transition('failed', reason);
  }
}
