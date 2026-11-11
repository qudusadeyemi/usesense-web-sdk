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
import { CaptureStrings, DEFAULT_CAPTURE_STRINGS } from './capture-copy';
import { SENSE_ACCENT_DEFAULTS, withAlpha } from './capture-theme';

// ============================================================================
// Colours and copy
// ============================================================================

/**
 * Sense default extra-check colours (storyboard). The engine draws with the
 * resolved capture theme instead (BRAND-v1 4.2): the ring is
 * `capture.challenge`, the dot and pause `capture.warning`, done and the
 * meter the camera success colour. Kept for reference and back-compat.
 */
export const EXTRA_CHECK_COLORS = {
  /** The ring while an extra check runs (purple = extra check). */
  ring: SENSE_ACCENT_DEFAULTS.challenge,
  /** Paused (face out of the oval) or too quiet. */
  warning: SENSE_ACCENT_DEFAULTS.warning,
  /** The Follow Dot dot and its dashed trail. */
  dot: SENSE_ACCENT_DEFAULTS.warning,
  /** The "Done" tick and ring. */
  done: SENSE_ACCENT_DEFAULTS.success,
  /** Sheet icon tile and glyph. */
  iconBg: withAlpha(SENSE_ACCENT_DEFAULTS.challenge, 0.16),
  iconFg: SENSE_ACCENT_DEFAULTS.challenge,
  /** Mic level meter bars. */
  meter: SENSE_ACCENT_DEFAULTS.success,
} as const;

/** The challenge types the extra check can draw. */
export type ExtraCheckType = 'head_turn' | 'follow_dot' | 'speak_phrase';

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
export function headTurnSentence(sequence: Pick<HeadTurnStep, 'direction'>[] | undefined, strings: CaptureStrings = DEFAULT_CAPTURE_STRINGS): string {
  return strings.sheetBody('head_turn', (sequence ?? []).map((s) => s.direction));
}

/** The sheet sentence for an extra check. */
export function extraCheckSentence(type: ExtraCheckType, sequence?: Pick<HeadTurnStep, 'direction'>[], strings: CaptureStrings = DEFAULT_CAPTURE_STRINGS): string {
  return strings.sheetBody(type, type === 'head_turn' ? (sequence ?? []).map((s) => s.direction) : undefined);
}

/** Title for a Head Turn step: the first turn says it in full, later ones say "Now ..." (as iOS). */
export function headTurnTitle(direction: HeadTurnStep['direction'], firstTurn: boolean, strings: CaptureStrings = DEFAULT_CAPTURE_STRINGS): { text: string; sub?: string } {
  return strings.headTurn(direction, firstTurn);
}

/** The retry hint after a missed turn ("Turn a little further to the left"). */
export function headTurnRetrySub(direction: HeadTurnStep['direction'], strings: CaptureStrings = DEFAULT_CAPTURE_STRINGS): string {
  return strings.turnFurther(direction);
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

/** The head counts as having moved once it is this far (yaw/pitch distance, degrees) from its pose at the prompt. */
export const FIRST_MOVE_DEG = 4;

/**
 * Movement along a step's main axis, degrees, signed so that positive is
 * toward the target (step_events v2): the measured pose signs and, for
 * Follow Dot, the mirrored preview (screen right is the person's right), the
 * same terms as {@link atTurnTarget} / {@link atDotTarget}. Head Turn
 * left/right is yaw, up/down pitch, centre the shrinking distance from
 * straight ahead. Follow Dot is the axis the dot moved most along from the
 * previous waypoint (x wins ties). null: no direction to judge.
 */
export function towardTargetDeg(
  target: { kind: 'head_turn'; direction: HeadTurnStep['direction'] } | { kind: 'follow_dot'; wp: { x: number; y: number }; prev: { x: number; y: number } },
  yaw: number, pitch: number, refYaw: number, refPitch: number,
): number | null {
  const towardLeft = (yaw - refYaw) * POSE_SIGNS.leftYaw;
  const towardUp = (pitch - refPitch) * POSE_SIGNS.upPitch;
  if (target.kind === 'head_turn') {
    switch (target.direction) {
      case 'left': return towardLeft;
      case 'right': return -towardLeft;
      case 'up': return towardUp;
      case 'down': return -towardUp;
      default: return Math.hypot(refYaw, refPitch) - Math.hypot(yaw, pitch);
    }
  }
  const dx = target.wp.x - target.prev.x, dy = target.prev.y - target.wp.y; // dy > 0: the dot moved up
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? -towardLeft : towardLeft;
  return dy > 0 ? towardUp : -towardUp;
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
  /** Toward-the-target movement (degrees) when the head first left the prompt pose by {@link FIRST_MOVE_DEG}; null: it never did. */
  firstMoveDeg?: number | null;
  /** ms from the prompt to that first move. */
  firstMoveAt?: number | null;
  /** The largest movement away from the target along the main axis (>= 0). Absent: no pose to measure from. */
  maxAwayDeg?: number;
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
  /** First-move tracking for the current step (pose at the prompt, then every frame with a pose). */
  private movePrompt: { yaw: number; pitch: number } | null = null;
  private moveFirst: { deg: number; at: number } | null = null;
  private moveMaxAway = 0;
  private framePose: { yaw: number; pitch: number } | null = null;

  constructor(readonly plan: ChallengePlan, retries = 1, private readonly strings: CaptureStrings = DEFAULT_CAPTURE_STRINGS) {
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
    this.framePose = obs.yaw != null && obs.pitch != null ? { yaw: obs.yaw, pitch: obs.pitch } : null;
    if (!this.finished && !obs.held && this.stepPromptedAt !== null) this.trackMove(obs.now);
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

  /** What the current step moves toward, for {@link towardTargetDeg}; null: nothing to measure (Follow Dot waypoint 0). */
  private moveTarget(): Parameters<typeof towardTargetDeg>[0] | null {
    if (this.plan.kind === 'head_turn') return { kind: 'head_turn', direction: this.plan.steps[this.stepIndex].direction };
    if (this.stepIndex === 0) return null;
    return { kind: 'follow_dot', wp: this.plan.waypoints[this.stepIndex], prev: this.plan.waypoints[this.stepIndex - 1] };
  }

  /** First move and the furthest the head went the wrong way, from every frame with a pose (not only banked ones). */
  private trackMove(now: number): void {
    const p = this.framePose;
    if (!p) return;
    if (!this.movePrompt) { this.movePrompt = p; return; }
    const target = this.moveTarget();
    if (!target) return;
    const toward = towardTargetDeg(target, p.yaw, p.pitch, this.movePrompt.yaw, this.movePrompt.pitch);
    if (toward === null) return;
    if (-toward > this.moveMaxAway) this.moveMaxAway = -toward;
    if (!this.moveFirst && Math.hypot(p.yaw - this.movePrompt.yaw, p.pitch - this.movePrompt.pitch) > FIRST_MOVE_DEG) {
      this.moveFirst = { deg: toward, at: now };
    }
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
    const promptedAt = this.stepPromptedAt ?? now;
    const measured = this.movePrompt !== null && this.moveTarget() !== null;
    this.stepLog.push({
      index: this.specStepIndex,
      promptedAt,
      endedAt: now,
      reachedAt: reached === true ? this.stepReachedAt : null,
      reached,
      hinted: this.stepHinted,
      ...(measured ? {
        firstMoveDeg: this.moveFirst?.deg ?? null,
        firstMoveAt: this.moveFirst ? this.moveFirst.at - promptedAt : null,
        maxAwayDeg: this.moveMaxAway,
      } : {}),
    });
    // The next step's prompt is this frame: its pose is where the next move starts from.
    this.movePrompt = this.framePose;
    this.moveFirst = null;
    this.moveMaxAway = 0;
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
    const S = this.strings;
    const C = {
      done: S.t('extraCheck', 'done'), showFace: S.t('guidance', 'showFace'), nextOne: S.t('extraCheck', 'tryNext'),
      retry: S.t('extraCheck', 'tryAgain'), pointAtDot: S.t('extraCheck', 'towardDot'),
      dotFirst: S.t('extraCheck', 'followDot'), dotNext: S.t('extraCheck', 'keepFollowing'),
      headPaused: { text: S.t('guidance', 'centre'), sub: S.t('extraCheck', 'pausedTurn') },
      dotPaused: { text: S.t('guidance', 'showFace'), sub: S.t('extraCheck', 'pausedDot') },
    };
    const paused = this.everPresent && !this.present && !this.finished;
    const base = { progress: this.progress, warning: false, paused, finished: this.finished, arrow: null as ChallengeDisplay['arrow'], dot: null as ChallengeDisplay['dot'], trail: [] as ChallengeDisplay['trail'] };
    if (this.plan.kind === 'head_turn') {
      const steps = this.plan.steps;
      const step = steps[Math.min(this.stepIndex, steps.length - 1)];
      const d: ChallengeDisplay = { kind: 'head_turn', ...base, text: '' };
      if (this.finished) { d.text = C.done; return d; }
      if (!this.everPresent) d.text = C.showFace;
      else if (paused) { d.warning = true; d.text = this.lastHint?.text ?? C.headPaused.text; d.sub = S.pausedTurn(step.direction); }
      else if (this.missedNoticeShowing) { d.warning = true; d.text = C.nextOne; }
      else if (this.retrying) { d.text = C.retry; d.sub = headTurnRetrySub(step.direction, S); d.arrow = step.direction === 'center' ? null : step.direction; }
      else {
        const firstTurn = steps.slice(0, this.stepIndex).every((st) => st.direction === 'center');
        const t = headTurnTitle(step.direction, firstTurn, S);
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
      // step_events v2: omitted when the head never moved 4 degrees / there was no pose (or Follow Dot waypoint 0).
      ...(e.firstMoveDeg != null && e.firstMoveAt != null ? { first_move_deg: round1(e.firstMoveDeg), first_move_ms: Math.round(e.firstMoveAt) } : {}),
      ...(e.maxAwayDeg !== undefined ? { max_away_deg: round1(e.maxAwayDeg) } : {}),
    }));
  }
}

const round1 = (v: number) => Math.round(v * 10) / 10;

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
export function endScreenCopy(screen: EndScreen, app?: string | null, strings?: CaptureStrings): EndScreenCopy {
  const S = strings ?? new CaptureStrings(undefined, app, null);
  switch (screen) {
    case 'approved':
      return { icon: 'check', tone: 'success', title: S.t('result', 'approvedTitle'), body: S.t('result', 'approvedBody'), primary: S.t('result', 'done') };
    case 'review':
      return { icon: 'clock', tone: 'warning', title: S.t('result', 'reviewTitle'), body: S.t('result', 'reviewBody'), primary: S.t('result', 'done') };
    case 'rejected_retry':
      return {
        icon: 'x', tone: 'danger', title: S.t('result', 'retryTitle'),
        body: S.t('result', 'retryBody'),
        tips: S.list('result', 'retryTips'),
        primary: S.t('result', 'tryAgain'), secondary: S.t('result', 'notNow'),
      };
    case 'rejected':
      return { icon: 'x', tone: 'danger', title: S.t('result', 'rejectedTitle'), body: S.t('result', 'rejectedBody'), primary: S.t('result', 'done') };
    case 'camera_denied':
      return { icon: 'camera', tone: 'warning', title: S.t('errors', 'cameraDeniedTitle'), body: S.t('errors', 'cameraDeniedBody'), primary: S.t('errors', 'openSettings') };
    case 'camera_stopped':
      return { icon: 'camera', tone: 'warning', title: S.t('errors', 'cameraStoppedTitle'), body: S.t('errors', 'cameraStoppedBody'), primary: S.t('result', 'tryAgain') };
    case 'offline':
      return { icon: 'wifi', tone: 'warning', title: S.t('errors', 'offlineTitle'), body: S.t('errors', 'offlineBody'), primary: S.t('result', 'tryAgain') };
    case 'expired':
      return { icon: 'hourglass', tone: 'warning', title: S.t('errors', 'expiredTitle'), body: S.t('errors', 'expiredBody'), primary: S.t('errors', 'startAgain') };
    case 'mic_denied':
      return {
        icon: 'mic', tone: 'warning', title: S.t('errors', 'micTitle'),
        body: S.t('errors', 'micBody'),
        primary: S.t('result', 'tryAgain'), secondary: S.t('errors', 'useHeadMovement'),
      };
    default:
      return { icon: 'alert', tone: 'warning', title: S.t('errors', 'errorTitle'), body: S.t('errors', 'errorBody'), primary: S.t('result', 'tryAgain') };
  }
}

/**
 * Primer copy: one step, or two when the policy already has a challenge
 * (before-the-scan extra check). Speak Digits says numbers, not a movement.
 */
export function primerCopy(challenge: 'none' | 'head_turn' | 'follow_dot' | 'speak_phrase' | string | undefined, strings: CaptureStrings = DEFAULT_CAPTURE_STRINGS): { title: string; body: string; tips: string[]; start: string } {
  const { title, body, tips, start } = strings.primer(challenge);
  return { title, body, tips, start };
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
  strings: CaptureStrings = DEFAULT_CAPTURE_STRINGS,
): { text: string; sub?: string; ring: 'warning' | 'done'; progress: number; tick: boolean } | null {
  const S = strings;
  switch (stage) {
    case 'intro': return { text: S.t('extraCheck', 'oneMoment'), sub: S.t('extraCheck', 'keepInOval'), ring: 'warning', progress: 1, tick: false };
    case 'flash': return { text: S.t('guidance', 'holdStill'), sub: S.t('extraCheck', 'screenColour'), ring: 'warning', progress: 1, tick: false };
    case 'rmas':
      return rmas
        ? { text: rmas.label, sub: `${rmas.step} of ${rmas.total}`, ring: 'warning', progress: Math.max(0, Math.min(1, rmas.countdown / 100)), tick: false }
        : { text: 'Get ready', ring: 'warning', progress: 1, tick: false };
    case 'complete': return { text: S.t('extraCheck', 'done'), ring: 'done', progress: 1, tick: true };
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
 * step ({@link challengeGateLimits}); stillness and sharpness apply to Speak
 * Digits only: a movement challenge moves, and a head turning in a dark room
 * blurs every frame (long exposure), which read as "Hold your phone steady"
 * and paused the turn (Android A03 device run).
 */
export function relaxGateForChallenge(result: GateResult, ctx: ChallengeGateContext): GateResult {
  const lim = challengeGateLimits(ctx.kind, ctx.direction);
  const checks = { ...result.checks };
  if (!lim.stillness) { checks.stillness = 'unknown'; checks.sharpness = 'unknown'; }
  const p = result.measurements.pose;
  if (p && result.checks.face === 'pass') {
    checks.pose = Math.abs(p.yaw) < lim.yaw && Math.abs(p.pitch) < lim.pitch && Math.abs(p.roll) < lim.roll ? 'pass' : 'fail';
  }
  return finishGateResult({ ...result, checks });
}

/** The second line under a paused challenge's guidance (the first names the failing check). */
export function challengePausedSub(kind: ExtraCheckType, strings: CaptureStrings = DEFAULT_CAPTURE_STRINGS, direction?: HeadTurnStep['direction'] | null): string {
  return kind === 'head_turn' ? strings.pausedTurn(direction)
    : kind === 'follow_dot' ? strings.t('extraCheck', 'pausedDot')
      : strings.t('extraCheck', 'pausedDigits');
}
