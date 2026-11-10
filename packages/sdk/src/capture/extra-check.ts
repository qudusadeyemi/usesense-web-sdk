/**
 * The extra check: a short movement (Head Turn, Follow Dot) or Speak Digits,
 * drawn on the guided scan screen (full-bleed camera, oval ring) instead of
 * the old challenge screens.
 *
 * Asked for in one of two ways:
 *  - after the scan (round 2): the /signals response carries a step-up; a
 *    "One more quick check" sheet explains it, then the movement runs;
 *  - before the scan: the session's policy already has a challenge; the
 *    primer says "Two quick steps" and the movement follows straight on from
 *    the scan, with no sheet.
 *
 * This module is the logic only (copy, trackers, end screens), so it can be
 * tested without a camera. The engine feeds it one tracked frame at a time.
 * Spec: the end-user storyboard (flows 4 to 6).
 */

import type { Decision, FollowDotWaypoint, HeadTurnStep } from '../types';
import { finishGateResult, GATE_THRESHOLDS, type GateResult } from './quality-gate';

// ============================================================================
// Colours and copy
// ============================================================================

/** Extra-check colours (storyboard). */
export const EXTRA_CHECK_COLORS = {
  /** The ring while an extra check runs (purple = extra check). */
  ring: '#A878FC',
  /** Paused (face out of the oval) or too quiet. */
  warning: '#FFB84D',
  /** The Follow Dot dot and its dashed trail. */
  dot: '#FFB84D',
  /** The "Done" tick and ring. */
  done: '#00D4AA',
  /** Sheet icon. */
  iconBg: 'rgba(168,120,252,0.18)',
  iconFg: '#C3A6FF',
  /** Mic level meter bars. */
  meter: '#00D4AA',
} as const;

/** The challenge types the extra check can draw. */
export type ExtraCheckType = 'head_turn' | 'follow_dot' | 'speak_phrase';

const DIR_PHRASE: Record<HeadTurnStep['direction'], string> = {
  left: 'to the left', right: 'to the right', up: 'up', down: 'down', center: 'back to the centre',
};

/** All extra-check copy (storyboard). No em dashes. */
export const EXTRA_CHECK_COPY = {
  sheetTitle: 'One more quick check',
  continue: 'Continue',
  sheet: {
    head_turn: 'Slowly turn your head to the left, then to the right.',
    follow_dot: 'Keep your face in the oval and follow the dot with your head.',
    speak_phrase: "Say the numbers you see out loud. We'll need your microphone.",
  },
  headFirstSub: 'Slowly',
  headPaused: { text: 'Move your face to the centre', sub: 'Then keep turning' },
  retry: "Let's try that again",
  /** After a step that timed out: honest, not a tick. */
  nextOne: "Let's try the next one",
  pointAtDot: 'Turn your head toward the dot',
  showFace: 'Show your face in the oval',
  dotFirst: 'Follow the dot with your head',
  dotNext: 'Keep following',
  dotPaused: { text: 'Show your face in the oval', sub: 'The dot will wait for you' },
  digits: 'Say these numbers',
  digitsQuiet: { text: "We can't hear you", sub: 'Speak a little louder' },
  digitsPaused: { text: 'Show your face in the oval', sub: 'Then say the numbers' },
  done: 'Done',
  leave: {
    title: 'Leave verification?',
    body: "You're nearly done. If you leave, you'll need to start again.",
    leave: 'Leave',
    stay: 'Keep going',
  },
} as const;

/**
 * The sheet sentence for a Head Turn sequence, from its own directions
 * ("Slowly turn your head to the left, then to the right."). A sequence
 * without turns gets the storyboard sentence.
 */
export function headTurnSentence(sequence: Pick<HeadTurnStep, 'direction'>[] | undefined): string {
  const dirs = (sequence ?? []).map((s) => s.direction).filter((d) => d !== 'center');
  if (dirs.length === 0) return EXTRA_CHECK_COPY.sheet.head_turn;
  // The first two sides the server asked for (as iOS).
  return `Slowly turn your head ${dirs.slice(0, 2).map((d) => DIR_PHRASE[d]).join(', then ')}.`;
}

/** The sheet sentence for an extra check. */
export function extraCheckSentence(type: ExtraCheckType, sequence?: Pick<HeadTurnStep, 'direction'>[]): string {
  return type === 'head_turn' ? headTurnSentence(sequence) : EXTRA_CHECK_COPY.sheet[type];
}

/** Title for a Head Turn step: the first turn says it in full, later ones say "Now ..." (as iOS). */
export function headTurnTitle(direction: HeadTurnStep['direction'], firstTurn: boolean): { text: string; sub?: string } {
  switch (direction) {
    case 'left':
    case 'right':
      return firstTurn ? { text: `Turn your head ${DIR_PHRASE[direction]}`, sub: EXTRA_CHECK_COPY.headFirstSub } : { text: `Now ${DIR_PHRASE[direction]}` };
    case 'up':
    case 'down':
      return firstTurn ? { text: `Look ${direction}`, sub: EXTRA_CHECK_COPY.headFirstSub } : { text: `Now look ${direction}` };
    default:
      return { text: 'Now look straight ahead' };
  }
}

/** The retry hint after a missed turn ("Turn a little further to the left"). */
export function headTurnRetrySub(direction: HeadTurnStep['direction']): string {
  switch (direction) {
    case 'left':
    case 'right': return `Turn a little further ${DIR_PHRASE[direction]}`;
    case 'up':
    case 'down': return `Look a little further ${direction}`;
    default: return 'Look straight at the screen';
  }
}

// ============================================================================
// Challenge runner (closed loop; a port of the iOS SDK's ChallengeRunner)
// ============================================================================

/** Timings and thresholds (same values as iOS). */
export const EXTRA_CHECK_TIMING = {
  /** The green tick shows this long before the upload sheet. */
  doneMs: 900,
  /** Speak Digits: the meter flat this long shows "We can't hear you". */
  quietMs: 2000,
  /** The gate must fail this long before the challenge pauses (one bad frame is not a pause). */
  lostAfterMs: 300,
  /** ... and pass this long before it resumes (the first sighting starts at once). */
  foundAfterMs: 150,
  /** Head Turn / Follow Dot: a step ends once the pose has held its target this long. */
  holdAtTargetMs: 600,
  /** Not there after max(this, the server's step): one hint per challenge, then on to the next step. */
  hintAfterMs: 4000,
  /** "Let's try the next one" shows this long after a missed step. */
  missedNoticeMs: 1200,
  /** Follow Dot: the glide to the next waypoint (at most 40% of the step). */
  dotGlideMs: 600,
  /** Follow Dot: after the dot arrives, a couple of "settled" frames may bank whatever the device makes of the head. */
  dotSettleMs: 500,
} as const;

/**
 * Pose targets, degrees. Head Turn asks for a little more than the server's
 * own bar (6 yaw / 5 pitch) so the server sees a clear turn. Follow Dot is
 * judged on the dot's MAIN direction from the pose held at the previous
 * waypoint; the other axis may go this far the wrong way; a move under the
 * centre band on both axes asks for nothing new (the server's 0.1).
 */
export const CHALLENGE_TARGETS = {
  turnYaw: 15,
  turnPitch: 12,
  centreTolerance: 10,
  dotYaw: 10,
  dotPitch: 8,
  dotWrongWayTolerance: 10,
  dotCentreBand: 0.1,
} as const;

/**
 * Pose signs. Measured on the web (MediaPipe face transform via
 * poseFromMatrix, synthetic face, 2026-11-10): turning to the person's own
 * left read yaw -28, looking up raised pitch. Same as the iOS device
 * measurement. Needs a real-device check.
 */
export const POSE_SIGNS = { leftYaw: -1, upPitch: 1 } as const;

/** Frames a Follow Dot waypoint banks once the dot has settled, even if the head looks off target. */
export const SETTLED_FRAMES_PER_STEP = 2;

/**
 * Frames one challenge step may bank so every later step still gets its
 * share of what is left (at least `minimum`, while any remain). On iOS a
 * 30-frame budget ran out by the third of four steps and the server failed
 * the last step, which had no frames.
 */
export function stepFrameQuota(remaining: number, stepsLeft: number, minimum = 2): number {
  const r = Math.max(0, remaining);
  if (stepsLeft <= 0) return r;
  return Math.max(Math.min(minimum, r), Math.floor(r / stepsLeft));
}

/** Whether the pose is at a Head Turn step's target (null: no pose to judge). */
export function atTurnTarget(direction: HeadTurnStep['direction'], yaw: number | null | undefined, pitch: number | null | undefined): boolean | null {
  const T = CHALLENGE_TARGETS;
  switch (direction) {
    case 'left':
    case 'right': {
      if (yaw == null) return null;
      const towardLeft = yaw * POSE_SIGNS.leftYaw;
      return direction === 'left' ? towardLeft >= T.turnYaw : -towardLeft >= T.turnYaw;
    }
    case 'up':
    case 'down': {
      if (pitch == null) return null;
      const towardUp = pitch * POSE_SIGNS.upPitch;
      return direction === 'up' ? towardUp >= T.turnPitch : -towardUp >= T.turnPitch;
    }
    default:
      if (yaw == null || pitch == null) return null;
      return Math.abs(yaw) < T.centreTolerance && Math.abs(pitch) < T.centreTolerance;
  }
}

/**
 * Follow Dot: whether the head followed the dot's move from `prev` to `wp`
 * (0-1 screen units; screen right is the person's right in the mirrored
 * preview), measured from the pose held at the previous waypoint.
 */
export function atDotTarget(
  wp: { x: number; y: number }, prev: { x: number; y: number },
  yaw: number | null | undefined, pitch: number | null | undefined, refYaw: number, refPitch: number,
): boolean | null {
  if (yaw == null || pitch == null) return null;
  const T = CHALLENGE_TARGETS;
  const dx = wp.x - prev.x, dy = prev.y - wp.y; // dy > 0: the dot moved up
  const towardRight = (yaw - refYaw) * -POSE_SIGNS.leftYaw;
  const towardUp = (pitch - refPitch) * POSE_SIGNS.upPitch;
  const followX = dx > 0 ? towardRight : -towardRight;
  const followY = dy > 0 ? towardUp : -towardUp;
  const movesX = Math.abs(dx) > T.dotCentreBand, movesY = Math.abs(dy) > T.dotCentreBand;
  if (!movesX && !movesY) return true;
  if (movesX && (!movesY || Math.abs(dx) >= Math.abs(dy))) {
    return followX >= T.dotYaw && (!movesY || followY > -T.dotWrongWayTolerance);
  }
  return followY >= T.dotPitch && (!movesX || followX > -T.dotWrongWayTolerance);
}

/** One tick of what the camera saw. */
export interface ChallengeObservation {
  /** Monotonic ms. */
  now: number;
  /** Every blocking check passes (the gate with this step's rules). */
  faceOk: boolean;
  /** Head pose for the challenge, degrees (poseFromMatrix), when known. */
  yaw?: number | null;
  pitch?: number | null;
  /** The leave dialog is open: time stands still. */
  held?: boolean;
  /** The gate's hint for what fails (named when paused). */
  hint?: { text: string } | null;
}

/** What the challenge screen draws. */
export interface ChallengeDisplay {
  kind: 'head_turn' | 'follow_dot';
  /** Ring fill, 0-1: one segment per step done, plus the hold on the current one. */
  progress: number;
  /** Paused or a missed step: the ring turns amber. */
  warning: boolean;
  paused: boolean;
  text: string;
  sub?: string;
  arrow: HeadTurnStep['direction'] | null;
  dot: { x: number; y: number } | null;
  trail: { x: number; y: number }[];
  finished: boolean;
}

/** How one step went, for the server's timing checks (`step_events`). */
export interface ChallengeStepLog {
  index: number;
  promptedAt: number;
  endedAt: number;
  reachedAt: number | null;
  /** true: ended on target; false: timed out; null: no pose to judge (server's time). */
  reached: boolean | null;
  hinted: boolean;
}

export type ChallengePlan =
  | { kind: 'head_turn'; steps: HeadTurnStep[] }
  | { kind: 'follow_dot'; waypoints: FollowDotWaypoint[] };

/**
 * The extra check's timeline, closed loop. Head Turn: a step ends once the
 * pose has held the step's target for 0.6 s; not there after max(4 s, the
 * server's step), ONE hint per challenge ("Let's try that again"), then on
 * ("Let's try the next one") and the server judges. Follow Dot: the dot
 * glides to each waypoint and waits for the head to move that way. The gate
 * failing pauses everything (debounced); nothing fails on the device.
 */
export class ChallengeRunner {
  stepIndex = 0;
  retriesLeft: number;
  finished = false;
  retrying = false;
  readonly stepLog: ChallengeStepLog[] = [];
  private stepElapsed = 0;
  private stepAge = 0;
  private atTarget = 0;
  private poseSeen = false;
  private stepPromptedAt: number | null = null;
  private stepReachedAt: number | null = null;
  private stepHinted = false;
  private lastAtTarget: boolean | null = null;
  private reachedSteps = 0;
  private missedUntil: number | null = null;
  private refYaw = 0;
  private refPitch = 0;
  private lastYaw: number | null = null;
  private lastPitch: number | null = null;
  private lastTime: number | null = null;
  private present = false;
  private everPresent = false;
  private absentFor = 0;
  private presentFor = 0;
  private lastHint: { text: string } | null = null;

  constructor(readonly plan: ChallengePlan, retries = 1) {
    this.retriesLeft = retries;
  }

  get stepCount(): number {
    return this.plan.kind === 'head_turn' ? this.plan.steps.length : this.plan.waypoints.length;
  }

  private durationMs(i: number): number {
    const list = this.plan.kind === 'head_turn' ? this.plan.steps : this.plan.waypoints;
    return Math.max(200, list[Math.min(i, list.length - 1)]?.duration_ms ?? 200);
  }

  /** The spec's own index for the current step (what step_frames / waypoint_frames are keyed by). */
  get specStepIndex(): number {
    const list = this.plan.kind === 'head_turn' ? this.plan.steps : this.plan.waypoints;
    return list[Math.min(this.stepIndex, list.length - 1)]?.index ?? 0;
  }

  /** The current Head Turn step's direction. */
  get direction(): HeadTurnStep['direction'] | null {
    return this.plan.kind === 'head_turn' ? this.plan.steps[Math.min(this.stepIndex, this.plan.steps.length - 1)]?.direction ?? null : null;
  }

  /**
   * Why frames may bank now. Head Turn: only on target (frames from the way
   * there made the server fail steps the person did). Follow Dot: on target,
   * or "settled" (a couple of frames once the dot has arrived, for the
   * server to judge). No pose to judge: always.
   */
  get bankReason(): 'none' | 'on_target' | 'settled' {
    if (this.finished) return 'on_target';
    if (this.lastAtTarget ?? true) return 'on_target';
    if (this.plan.kind === 'follow_dot' && this.stepAge >= this.dotGlideMs(this.stepIndex) + EXTRA_CHECK_TIMING.dotSettleMs) return 'settled';
    return 'none';
  }

  private dotGlideMs(i: number): number {
    return Math.min(EXTRA_CHECK_TIMING.dotGlideMs, this.durationMs(i) * 0.4);
  }

  advance(obs: ChallengeObservation): ChallengeDisplay {
    const dt = this.lastTime === null ? 0 : Math.min(250, Math.max(0, obs.now - this.lastTime));
    this.lastTime = obs.now;
    if (this.stepPromptedAt === null && (this.present || obs.faceOk) && !this.finished) this.stepPromptedAt = obs.now;
    this.updatePresence(obs.faceOk, dt);
    if (obs.hint || obs.faceOk) this.lastHint = obs.hint ?? null;
    const running = this.present && !obs.held && !this.finished;
    if (running) {
      this.stepElapsed += dt;
      this.stepAge += dt;
      if (this.plan.kind === 'head_turn') {
        const step = this.plan.steps[this.stepIndex];
        this.advanceTargeted(step.duration_ms, atTurnTarget(step.direction, obs.yaw, obs.pitch), dt);
      } else {
        const wps = this.plan.waypoints;
        const wp = wps[this.stepIndex];
        if (obs.yaw != null && obs.pitch != null) { this.lastYaw = obs.yaw; this.lastPitch = obs.pitch; }
        const arrived = this.stepAge >= this.dotGlideMs(this.stepIndex);
        const reached = this.stepIndex === 0
          ? atTurnTarget('center', obs.yaw, obs.pitch)
          : atDotTarget(wp, wps[this.stepIndex - 1], obs.yaw, obs.pitch, this.refYaw, this.refPitch);
        this.advanceTargeted(wp.duration_ms, reached === null ? null : reached && arrived, dt);
      }
    }
    return this.display();
  }

  private advanceTargeted(serverMs: number, reached: boolean | null, dt: number): void {
    const server = Math.max(200, serverMs);
    this.lastAtTarget = reached;
    if (reached === null) {
      // No pose from the landmarker: the server's step time.
      if (!this.poseSeen && this.stepElapsed >= server) this.endStep(null);
      return;
    }
    this.poseSeen = true;
    if (reached && this.atTarget === 0) this.stepReachedAt = this.lastTime;
    this.atTarget = reached ? this.atTarget + dt : 0;
    if (!reached) this.stepReachedAt = null;
    if (this.atTarget >= EXTRA_CHECK_TIMING.holdAtTargetMs) { this.endStep(true); return; }
    if (this.stepElapsed >= Math.max(EXTRA_CHECK_TIMING.hintAfterMs, server)) {
      if (!this.retrying && this.retriesLeft > 0) {
        this.retriesLeft--;
        this.retrying = true;
        this.stepHinted = true;
        this.stepElapsed = 0;
      } else {
        this.endStep(false);
      }
    }
  }

  private updatePresence(seen: boolean, dt: number): void {
    if (seen) {
      this.presentFor += dt;
      this.absentFor = 0;
      if (!this.present && (!this.everPresent || this.presentFor >= EXTRA_CHECK_TIMING.foundAfterMs)) {
        this.present = true;
        this.everPresent = true;
      }
    } else {
      this.absentFor += dt;
      this.presentFor = 0;
      if (this.present && this.absentFor >= EXTRA_CHECK_TIMING.lostAfterMs) this.present = false;
    }
  }

  private endStep(reached: boolean | null): void {
    if (reached !== false) this.reachedSteps++;
    const now = this.lastTime ?? 0;
    this.missedUntil = reached === false ? now + EXTRA_CHECK_TIMING.missedNoticeMs : null;
    this.stepLog.push({
      index: this.specStepIndex,
      promptedAt: this.stepPromptedAt ?? now,
      endedAt: now,
      reachedAt: reached === true ? this.stepReachedAt : null,
      reached,
      hinted: this.stepHinted,
    });
    this.stepPromptedAt = now;
    this.stepReachedAt = null;
    this.stepHinted = false;
    this.lastAtTarget = null;
    this.retrying = false;
    if (this.plan.kind === 'follow_dot' && this.lastYaw !== null && this.lastPitch !== null) {
      // The next move is measured from where the head is now.
      this.refYaw = this.lastYaw;
      this.refPitch = this.lastPitch;
    }
    this.stepIndex++;
    this.stepElapsed = 0;
    this.stepAge = 0;
    this.atTarget = 0;
    this.poseSeen = false;
    if (this.stepIndex >= this.stepCount) {
      this.finished = true;
      this.stepIndex = this.stepCount - 1;
    }
  }

  get progress(): number {
    if (this.finished && this.reachedSteps >= this.stepCount) return 1;
    return Math.min(1, (this.reachedSteps + Math.min(1, this.atTarget / EXTRA_CHECK_TIMING.holdAtTargetMs)) / Math.max(1, this.stepCount));
  }

  private get missedNoticeShowing(): boolean {
    return this.missedUntil !== null && this.lastTime !== null && !this.finished && this.lastTime < this.missedUntil;
  }

  display(): ChallengeDisplay {
    const C = EXTRA_CHECK_COPY;
    const paused = this.everPresent && !this.present && !this.finished;
    const base = { progress: this.progress, warning: false, paused, finished: this.finished, arrow: null as ChallengeDisplay['arrow'], dot: null as ChallengeDisplay['dot'], trail: [] as ChallengeDisplay['trail'] };
    if (this.plan.kind === 'head_turn') {
      const steps = this.plan.steps;
      const step = steps[Math.min(this.stepIndex, steps.length - 1)];
      const d: ChallengeDisplay = { kind: 'head_turn', ...base, text: '' };
      if (this.finished) { d.text = C.done; return d; }
      if (!this.everPresent) d.text = C.showFace;
      else if (paused) { d.warning = true; d.text = this.lastHint?.text ?? C.headPaused.text; d.sub = C.headPaused.sub; }
      else if (this.missedNoticeShowing) { d.warning = true; d.text = C.nextOne; }
      else if (this.retrying) { d.text = C.retry; d.sub = headTurnRetrySub(step.direction); d.arrow = step.direction === 'center' ? null : step.direction; }
      else {
        const firstTurn = steps.slice(0, this.stepIndex).every((st) => st.direction === 'center');
        const t = headTurnTitle(step.direction, firstTurn);
        d.text = t.text; d.sub = t.sub;
        d.arrow = step.direction === 'center' ? null : step.direction;
      }
      return d;
    }
    const pts = this.plan.waypoints.map((w) => ({ x: w.x, y: w.y }));
    const i = Math.min(this.stepIndex, pts.length - 1);
    const from = i === 0 ? pts[0] : pts[i - 1];
    const glide = this.dotGlideMs(i);
    const t = glide > 0 ? Math.min(1, this.stepAge / glide) : 1;
    const e = t * t * (3 - 2 * t);
    const dot = this.finished ? pts[i] : { x: from.x + (pts[i].x - from.x) * e, y: from.y + (pts[i].y - from.y) * e };
    const d: ChallengeDisplay = { kind: 'follow_dot', ...base, dot, trail: [...pts.slice(0, i), dot], text: '' };
    if (this.finished) { d.text = C.done; return d; }
    if (!this.everPresent) d.text = C.showFace;
    else if (paused) { d.warning = true; d.text = this.lastHint?.text ?? C.dotPaused.text; d.sub = C.dotPaused.sub; }
    else if (this.missedNoticeShowing) { d.warning = true; d.text = C.nextOne; }
    else if (this.retrying) { d.text = C.retry; d.sub = C.pointAtDot; }
    else d.text = this.stepIndex * 2 < pts.length ? C.dotFirst : C.dotNext;
    return d;
  }

  /** `step_events` for the challenge response (ms since the epoch; `clockOffset` maps the monotonic clock to it). */
  stepEvents(clockOffset: number): Record<string, unknown>[] {
    const ms = (t: number) => Math.round(t + clockOffset);
    return this.stepLog.map((e) => ({
      index: e.index,
      prompted_at_ms: ms(e.promptedAt),
      ended_at_ms: ms(e.endedAt),
      hinted: e.hinted,
      ...(e.reachedAt !== null ? { reached_at_ms: ms(e.reachedAt), reaction_ms: Math.round(e.reachedAt - e.promptedAt) } : {}),
      outcome: e.reached === null ? 'timed' : e.reached ? 'reached' : 'timed_out',
    }));
  }
}

// ============================================================================
// Speak Digits
// ============================================================================

/** Below this RMS level (0-1) the microphone counts as hearing nothing. */
export const QUIET_LEVEL = 0.04;

/** "We can't hear you" once the level has stayed under {@link QUIET_LEVEL} for 2 s. */
export class QuietDetector {
  private loudAt: number | null = null;
  constructor(private readonly windowMs: number = EXTRA_CHECK_TIMING.quietMs, private readonly threshold = QUIET_LEVEL) {}

  /** Feed one level reading; true while it has been quiet for the whole window. */
  update(level: number, now: number): boolean {
    if (this.loudAt === null) this.loudAt = now;
    if (level >= this.threshold) this.loudAt = now;
    return now - this.loudAt >= this.windowMs;
  }
}

/** Mic meter bar heights (px) from the latest levels, newest last; 9 bars of 4-34 px. */
export function meterBars(levels: number[], count = 9, min = 4, max = 34): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const v = levels[levels.length - count + i] ?? 0;
    // RMS of speech sits around 0.05-0.3; scale so normal speech fills the bar.
    const t = Math.max(0, Math.min(1, v / 0.25));
    out.push(Math.round(min + (max - min) * t));
  }
  return out;
}

/** "4729" or "4 7 2 9" as the spaced pill text ("4 7 2 9"). */
export function digitsText(phrase: string): string {
  const compact = phrase.replace(/\s+/g, '');
  return /^\d+$/.test(compact) ? compact.split('').join(' ') : phrase.trim();
}

// ============================================================================
// End screens
// ============================================================================

/** Every way a verification can end on the SDK's own screens. */
export type EndScreen =
  | 'approved'
  | 'review'
  | 'rejected_retry'
  | 'rejected'
  | 'camera_denied'
  | 'camera_stopped'
  | 'offline'
  | 'expired'
  | 'mic_denied'
  | 'error';

/** The result screen for a decision. Try again only when the integrator allows retries. */
export function resultScreen(decision: Decision | string | undefined, allowRetry: boolean): EndScreen {
  if (decision === 'APPROVE') return 'approved';
  if (decision === 'REJECT') return allowRetry ? 'rejected_retry' : 'rejected';
  return 'review';
}

/** The verification is open this long (server rule). */
export const SESSION_TTL_MS = 15 * 60 * 1000;

/**
 * Which screen a failed request ends on: offline (no network), timed out
 * (the session expired), or our error. A network failure while online is
 * treated as offline too: the person can fix it and try again.
 */
export function classifyFailure(err: unknown, online: boolean): 'offline' | 'expired' | 'error' {
  const e = err as { name?: string; message?: string } | null | undefined;
  const msg = (e?.message ?? String(err ?? '')).toLowerCase();
  if (/expired|timed out|\(410\)|session_expired/.test(msg)) return 'expired';
  if (!online || e?.name === 'NetworkError' || e?.name === 'TypeError' || /network|failed to fetch|offline/.test(msg)) return 'offline';
  return 'error';
}

/** Which camera screen a getUserMedia error ends on. */
export function classifyCameraError(err: unknown): 'camera_denied' | 'camera_stopped' {
  const name = (err as { name?: string } | null)?.name ?? '';
  return name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError'
    ? 'camera_denied' : 'camera_stopped';
}

/** Icon names for {@link END_SCREEN_COPY} (paths in the engine). */
export type EndScreenIcon = 'check' | 'clock' | 'x' | 'camera' | 'wifi' | 'mic' | 'hourglass' | 'alert';
/** Icon tone: green, amber or red. */
export type EndScreenTone = 'success' | 'warning' | 'danger';

export interface EndScreenCopy {
  icon: EndScreenIcon;
  tone: EndScreenTone;
  title: string;
  body: string;
  tips?: string[];
  primary: string;
  secondary?: string;
}

/**
 * Copy for every end screen (storyboard flow 6). `app` is the integrator's
 * display name, or null. Browsers cannot open settings, so the permission
 * screens say how to allow access instead.
 */
export function endScreenCopy(screen: EndScreen, app?: string | null): EndScreenCopy {
  const name = app && app.trim() ? app.trim() : null;
  switch (screen) {
    case 'approved':
      return { icon: 'check', tone: 'success', title: "You're verified", body: name ? `Thanks. You can carry on in ${name}.` : 'Thanks. You can carry on now.', primary: 'Done' };
    case 'review':
      return { icon: 'clock', tone: 'warning', title: "Thanks, we're checking", body: name ? `This can take a few minutes. ${name} will let you know.` : "This can take a few minutes. You'll be told the result.", primary: 'Done' };
    case 'rejected_retry':
      return {
        icon: 'x', tone: 'danger', title: "We couldn't verify you",
        body: 'This sometimes happens with poor light or movement. You can try once more.',
        tips: ['Face a window or a lamp', 'Hold your phone at eye level'],
        primary: 'Try again', secondary: 'Not now',
      };
    case 'rejected':
      return { icon: 'x', tone: 'danger', title: "We couldn't verify you", body: name ? `Please contact ${name} for help.` : 'Please contact the service you are verifying with for help.', primary: 'Done' };
    case 'camera_denied':
      return {
        icon: 'camera', tone: 'warning', title: 'Camera access needed',
        body: "We use the camera only for this check. Allow camera access for this site in your browser's address bar or site settings, then try again.",
        primary: 'Try again',
      };
    case 'camera_stopped':
      return { icon: 'camera', tone: 'warning', title: 'The camera stopped', body: 'Another app or tab may be using it. Close anything else that uses the camera, then try again.', primary: 'Try again' };
    case 'offline':
      return { icon: 'wifi', tone: 'warning', title: "You're offline", body: 'Check your internet connection, then try again.', primary: 'Try again' };
    case 'expired':
      return { icon: 'hourglass', tone: 'warning', title: 'This check timed out', body: 'For your security, each check is only open for 15 minutes.', primary: 'Start again' };
    case 'mic_denied':
      return {
        icon: 'mic', tone: 'warning', title: 'Microphone needed',
        body: "This check needs your microphone. Allow it for this site in your browser's address bar or site settings and try again, or do a head movement instead.",
        primary: 'Try again', secondary: 'Do a head movement instead',
      };
    default:
      return { icon: 'alert', tone: 'warning', title: 'Something went wrong', body: "It's not you. Please try again in a moment.", primary: 'Try again' };
  }
}

/**
 * Primer copy: one step, or two when the policy already has a challenge
 * (before-the-scan extra check). Speak Digits says numbers, not a movement.
 */
export function primerCopy(challenge: 'none' | 'head_turn' | 'follow_dot' | 'speak_phrase' | string | undefined): { title: string; body: string; tips: string[]; start: string } {
  const tips = ['Good light on your face', 'Take off sunglasses, hats and masks', 'Only you in the picture'];
  if (challenge === 'speak_phrase') {
    return { title: 'Two quick steps', body: 'A selfie scan, then say a few numbers out loud. About 10 seconds.', tips, start: 'Start' };
  }
  if (challenge === 'head_turn' || challenge === 'follow_dot') {
    return { title: 'Two quick steps', body: 'A selfie scan, then a short movement. About 10 seconds.', tips, start: 'Start' };
  }
  return { title: 'Take a quick selfie', body: 'Hold your phone at eye level and look at the screen for a few seconds.', tips, start: 'Start' };
}

// ============================================================================
// Client inline step-up (on-device attack check) on the guided screen
// ============================================================================

/** The inline step-up's stages (suspicion engine, then Flash Reflection / RMAS). */
export type InlineStepUpStage = 'idle' | 'intro' | 'flash' | 'rmas' | 'complete';

/**
 * Whether the client inline step-up runs now: the policy has not turned it
 * off (`inline_step_up.enabled` true or absent) and the suspicion engine
 * triggered on this capture's frames. It always runs before the round-1
 * upload, so a server round-2 extra check comes after it.
 */
export function shouldRunInlineStepUp(policy: { enabled?: boolean } | null | undefined, triggered: boolean): boolean {
  return policy?.enabled !== false && triggered;
}

/** Inline step-up copy (guided style: plain text under the oval). */
export const INLINE_STEP_UP_COPY = {
  intro: { text: 'One more moment', sub: 'Keep your face in the oval' },
  flash: { text: 'Hold still', sub: 'The screen will change colour' },
  complete: { text: 'Done' },
} as const;

/**
 * What the guided scan screen shows for an inline step-up stage: guidance
 * under the oval, and the ring (amber while waiting on the person, green
 * when done). RMAS shows its action ("Blink twice") with "1 of 3" and the
 * ring counting down the action's time.
 */
export function inlineStepUpGuidance(
  stage: InlineStepUpStage,
  rmas?: { label: string; step: number; total: number; countdown: number } | null,
): { text: string; sub?: string; ring: 'warning' | 'done'; progress: number; tick: boolean } | null {
  switch (stage) {
    case 'intro': return { ...INLINE_STEP_UP_COPY.intro, ring: 'warning', progress: 1, tick: false };
    case 'flash': return { ...INLINE_STEP_UP_COPY.flash, ring: 'warning', progress: 1, tick: false };
    case 'rmas':
      return rmas
        ? { text: rmas.label, sub: `${rmas.step} of ${rmas.total}`, ring: 'warning', progress: Math.max(0, Math.min(1, rmas.countdown / 100)), tick: false }
        : { text: 'Get ready', ring: 'warning', progress: 1, tick: false };
    case 'complete': return { ...INLINE_STEP_UP_COPY.complete, ring: 'done', progress: 1, tick: true };
    default: return null;
  }
}

// ============================================================================
// The quality gate during a challenge
// ============================================================================

/**
 * The gate's pose limits per challenge step, degrees (iOS ChallengeGateRules).
 * The relaxed limit opens both ways for a sideways step: the gate keeps the
 * face usable, the runner judges the movement.
 */
export function challengeGateLimits(kind: ExtraCheckType, direction?: HeadTurnStep['direction'] | null): { yaw: number; pitch: number; roll: number; stillness: boolean } {
  if (kind === 'speak_phrase') return { yaw: GATE_THRESHOLDS.maxYaw, pitch: GATE_THRESHOLDS.maxPitch, roll: GATE_THRESHOLDS.maxRoll, stillness: true };
  if (kind === 'follow_dot') return { yaw: 40, pitch: 35, roll: 20, stillness: false };
  if (direction === 'left' || direction === 'right') return { yaw: 50, pitch: GATE_THRESHOLDS.maxPitch, roll: 20, stillness: false };
  if (direction === 'up' || direction === 'down') return { yaw: GATE_THRESHOLDS.maxYaw, pitch: 40, roll: 20, stillness: false };
  return { yaw: 30, pitch: 30, roll: 20, stillness: false };
}

/** What the current challenge step asks for, for relaxing the gate. */
export interface ChallengeGateContext {
  kind: ExtraCheckType;
  /** Head Turn: the current step's direction. */
  direction?: HeadTurnStep['direction'] | null;
}

/**
 * The scan's quality gate, applied to a challenge (same rules and checks as
 * the passive scan: face, one person, covered, distance with the scan's hold
 * band, in frame, sharpness, eyes, light as advice). Only pose relaxes, per
 * step ({@link challengeGateLimits}); stillness applies to Speak Digits only
 * (a movement challenge moves).
 */
export function relaxGateForChallenge(result: GateResult, ctx: ChallengeGateContext): GateResult {
  const lim = challengeGateLimits(ctx.kind, ctx.direction);
  const checks = { ...result.checks };
  if (!lim.stillness) checks.stillness = 'unknown';
  const p = result.measurements.pose;
  if (p && result.checks.face === 'pass') {
    checks.pose = Math.abs(p.yaw) < lim.yaw && Math.abs(p.pitch) < lim.pitch && Math.abs(p.roll) < lim.roll ? 'pass' : 'fail';
  }
  return finishGateResult({ ...result, checks });
}

/** The second line under a paused challenge's guidance (the first names the failing check). */
export function challengePausedSub(kind: ExtraCheckType): string {
  return kind === 'head_turn' ? EXTRA_CHECK_COPY.headPaused.sub
    : kind === 'follow_dot' ? EXTRA_CHECK_COPY.dotPaused.sub
      : EXTRA_CHECK_COPY.digitsPaused.sub;
}
