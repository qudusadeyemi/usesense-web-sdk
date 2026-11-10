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
import type { Point2 } from './quality-gate';

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
  return `Slowly turn your head ${dirs.map((d) => DIR_PHRASE[d]).join(', then ')}.`;
}

/** The sheet sentence for an extra check. */
export function extraCheckSentence(type: ExtraCheckType, sequence?: Pick<HeadTurnStep, 'direction'>[]): string {
  return type === 'head_turn' ? headTurnSentence(sequence) : EXTRA_CHECK_COPY.sheet[type];
}

/** Title for a Head Turn step: the first turn says it in full, later ones say "Now ...". */
export function headTurnTitle(direction: HeadTurnStep['direction'], firstTurn: boolean): { text: string; sub?: string } {
  if (direction === 'center') return { text: 'Look straight ahead' };
  if (firstTurn) {
    const verb = direction === 'up' || direction === 'down' ? 'Tilt' : 'Turn';
    return { text: `${verb} your head ${DIR_PHRASE[direction]}`, sub: EXTRA_CHECK_COPY.headFirstSub };
  }
  return { text: `Now ${DIR_PHRASE[direction]}` };
}

/** The retry hint after a missed turn ("Turn a little further to the left"). */
export function headTurnRetrySub(direction: HeadTurnStep['direction']): string {
  if (direction === 'center') return 'Look straight at the screen';
  const verb = direction === 'up' || direction === 'down' ? 'Tilt' : 'Turn';
  return `${verb} a little further ${DIR_PHRASE[direction]}`;
}

// ============================================================================
// Face measurements (screen space, mirrored preview)
// ============================================================================

/** Landmarks used: nose tip, cheek edges, eye corners, chin. */
const NOSE = 1, CHEEK_L = 234, CHEEK_R = 454, EYE_L = 33, EYE_R = 263, CHIN = 152;

/**
 * Where the nose points, from screen-space landmarks of the MIRRORED preview
 * (what the person sees). x: nose offset from the cheek midpoint over half
 * the face width; negative = the face turned to the person's left (screen
 * left, the side the arrow is on). y: the nose's place between the eyes and
 * the chin (about 0.45 facing forward); smaller = head tilted up.
 */
export function headOffset(screen: ArrayLike<Point2> | null | undefined): { x: number; y: number } | null {
  if (!screen || screen.length < 455) return null;
  const n = screen[NOSE], l = screen[CHEEK_L], r = screen[CHEEK_R];
  const el = screen[EYE_L], er = screen[EYE_R], c = screen[CHIN];
  const half = Math.abs(r.x - l.x) / 2;
  if (!(half > 1e-6)) return null;
  const midX = (l.x + r.x) / 2;
  const eyeY = (el.y + er.y) / 2;
  const span = c.y - eyeY;
  return {
    x: (n.x - midX) / half,
    y: Math.abs(span) > 1e-6 ? (n.y - eyeY) / span : 0.45,
  };
}

/**
 * Is the face in the oval enough to go on with an extra check? Looser than
 * the scan's gate (a turned head spills past the silhouette): the landmark
 * centroid inside the oval at `slack` of its radii.
 */
export function faceInChallengeOval(
  screen: ArrayLike<Point2> | null | undefined,
  oval: { cx: number; cy: number; rx: number; ry: number },
  slack = 0.85,
): boolean {
  if (!screen || screen.length === 0) return false;
  let sx = 0, sy = 0;
  for (let i = 0; i < screen.length; i++) { sx += screen[i].x; sy += screen[i].y; }
  const cx = sx / screen.length, cy = sy / screen.length;
  const dx = (cx - oval.cx) / (oval.rx * slack);
  const dy = (cy - oval.cy) / (oval.ry * slack);
  return dx * dx + dy * dy <= 1;
}

// ============================================================================
// Shared tracker plumbing
// ============================================================================

/** One tracked frame, as the trackers see it. */
export interface ExtraCheckInput {
  /** Monotonic ms. */
  now: number;
  /** A face is found and in the oval. */
  faceOk: boolean;
  /** {@link headOffset} of this frame (Head Turn only). */
  offset?: { x: number; y: number } | null;
}

/** What to show and do for the current frame. */
export interface ExtraCheckState {
  /** Ring fill, 0-1. */
  progress: number;
  /** The face left the oval: the ring turns amber and the check waits. */
  paused: boolean;
  /** Bank frames now (never while paused). */
  capture: boolean;
  /** The challenge index frames belong to (step / waypoint `index`). */
  index: number;
  /** Guidance under the oval. */
  text: string;
  sub?: string;
  done: boolean;
}

/** How long the face may be out of the oval before the check pauses. */
export const EXTRA_CHECK_TIMING = {
  pauseGraceMs: 300,
  /** The green tick shows this long before the upload sheet. */
  doneMs: 900,
  /** Speak Digits: the meter flat this long shows "We can't hear you". */
  quietMs: 2000,
} as const;

class PauseClock {
  private offSince: number | null = null;
  private last: number | null = null;
  /** Active (unpaused) time added by this frame, and whether it is paused. */
  tick(now: number, faceOk: boolean): { dt: number; paused: boolean } {
    const prev = this.last ?? now;
    this.last = now;
    // A stalled (backgrounded) tab is not active time.
    const step = Math.max(0, Math.min(now - prev, 250));
    if (faceOk) { this.offSince = null; return { dt: step, paused: false }; }
    if (this.offSince === null) this.offSince = now;
    const paused = now - this.offSince > EXTRA_CHECK_TIMING.pauseGraceMs;
    return { dt: paused ? 0 : step, paused };
  }
}

// ============================================================================
// Head Turn
// ============================================================================

/** How far counts as a turn (nose offset over half the face width, or the tilt ratio change). */
export const HEAD_TURN_THRESHOLDS = { yaw: 0.3, pitch: 0.1, centre: 0.15 } as const;

/** Whether this offset reaches the step's direction. */
export function turnReached(direction: HeadTurnStep['direction'], off: { x: number; y: number }, neutralY: number): boolean {
  const T = HEAD_TURN_THRESHOLDS;
  switch (direction) {
    case 'left': return off.x <= -T.yaw;
    case 'right': return off.x >= T.yaw;
    case 'up': return neutralY - off.y >= T.pitch;
    case 'down': return off.y - neutralY >= T.pitch;
    default: return Math.abs(off.x) <= T.centre;
  }
}

/**
 * Head Turn on the scan screen. Each step lasts at least its `duration_ms`
 * of active time and ends once the turn has been seen; the face leaving the
 * oval pauses the clock. A step not reached in its window gets ONE local
 * retry (per check) with a hint; after that it moves on and the server
 * decides. It never fails on the device.
 */
export class HeadTurnTracker {
  private stepIdx = 0;
  private active = 0;
  private reached = false;
  private retriesLeft: number;
  private retrying = false;
  private neutralY: number | null = null;
  private clock = new PauseClock();
  private finished = false;

  /**
   * @param sequence the server's steps
   * @param retries local retries for a missed turn (per check)
   * @param measure false when there is no face tracking (no MediaPipe): the
   *   steps then run on time alone and the server decides.
   */
  constructor(private readonly sequence: HeadTurnStep[], retries = 1, private readonly measure = true) {
    this.retriesLeft = retries;
  }

  /** The window a step gets to be reached before it counts as missed. */
  static windowMs(step: HeadTurnStep): number {
    return Math.max(step.duration_ms * 2, 3000);
  }

  /** Whether a retry has been used. */
  get retried(): boolean { return this.retrying || this.retriesLeft === 0; }

  update(input: ExtraCheckInput): ExtraCheckState {
    const n = this.sequence.length;
    if (this.finished || n === 0) return this.state(true, false);
    const { dt, paused } = this.clock.tick(input.now, input.faceOk);
    const step = this.sequence[this.stepIdx];
    if (!this.measure) this.reached = true;
    else if (!paused && input.faceOk && input.offset) {
      if (this.neutralY === null) this.neutralY = input.offset.y;
      if (turnReached(step.direction, input.offset, this.neutralY)) this.reached = true;
    }
    this.active += dt;
    if (this.active >= step.duration_ms && this.reached) {
      this.next();
    } else if (this.active >= HeadTurnTracker.windowMs(step)) {
      if (this.retriesLeft > 0) {
        this.retriesLeft--;
        this.retrying = true;
        this.active = 0;
      } else {
        this.next();
      }
    }
    return this.state(this.finished, paused);
  }

  private next(): void {
    this.stepIdx++;
    this.active = 0;
    this.reached = false;
    this.retrying = false;
    if (this.stepIdx >= this.sequence.length) { this.finished = true; this.stepIdx = this.sequence.length - 1; }
  }

  private state(done: boolean, paused: boolean): ExtraCheckState {
    const n = this.sequence.length;
    const step = this.sequence[Math.min(this.stepIdx, n - 1)];
    if (done || !step) {
      return { progress: 1, paused: false, capture: false, index: step?.index ?? 0, text: EXTRA_CHECK_COPY.done, done: true };
    }
    const part = Math.min(1, this.active / Math.max(1, step.duration_ms));
    const progress = Math.min(1, (this.stepIdx + (this.retrying ? 0 : part)) / n);
    const firstTurn = this.sequence.findIndex((s) => s.direction !== 'center') === this.stepIdx;
    let copy: { text: string; sub?: string };
    if (paused) copy = { ...EXTRA_CHECK_COPY.headPaused };
    else if (this.retrying) copy = { text: EXTRA_CHECK_COPY.retry, sub: headTurnRetrySub(step.direction) };
    else copy = headTurnTitle(step.direction, firstTurn);
    return { progress, paused, capture: !paused, index: step.index, ...copy, done: false };
  }

  /** The current step's direction (for the arrow), or null when done. */
  get direction(): HeadTurnStep['direction'] | null {
    return this.finished ? null : this.sequence[this.stepIdx]?.direction ?? null;
  }
}

// ============================================================================
// Follow Dot
// ============================================================================

/** Part of each waypoint's time the dot spends moving there from the last one. */
const DOT_TRAVEL = 0.35;

/** Smoothstep easing. */
function ease(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Follow Dot on the scan screen. The dot glides to each waypoint (the
 * server's random path, 0-1 of the screen) and holds for the rest of its
 * `duration_ms`; the face leaving the oval stops the clock, so the dot waits
 * in place until the face is back.
 */
export class FollowDotTracker {
  private idx = 0;
  private active = 0;
  private clock = new PauseClock();
  private finished = false;

  constructor(private readonly waypoints: FollowDotWaypoint[], private readonly start = { x: 0.5, y: 0.4 }) {}

  update(input: ExtraCheckInput): ExtraCheckState {
    const n = this.waypoints.length;
    if (this.finished || n === 0) return this.state(true, false);
    const { dt, paused } = this.clock.tick(input.now, input.faceOk);
    this.active += dt;
    const wp = this.waypoints[this.idx];
    if (this.active >= wp.duration_ms) {
      this.idx++;
      this.active = 0;
      if (this.idx >= n) { this.finished = true; this.idx = n - 1; }
    }
    return this.state(this.finished, paused);
  }

  private state(done: boolean, paused: boolean): ExtraCheckState {
    const n = this.waypoints.length;
    const wp = this.waypoints[Math.min(this.idx, n - 1)];
    if (done || !wp) return { progress: 1, paused: false, capture: false, index: wp?.index ?? 0, text: EXTRA_CHECK_COPY.done, done: true };
    const progress = Math.min(1, (this.idx + Math.min(1, this.active / Math.max(1, wp.duration_ms))) / n);
    const copy = paused ? { ...EXTRA_CHECK_COPY.dotPaused } : { text: this.idx === 0 ? EXTRA_CHECK_COPY.dotFirst : EXTRA_CHECK_COPY.dotNext };
    return { progress, paused, capture: !paused, index: wp.index, ...copy, done: false };
  }

  /** Where the dot is now (0-1 of the screen). */
  get dot(): { x: number; y: number } {
    const n = this.waypoints.length;
    if (n === 0) return this.start;
    const i = Math.min(this.idx, n - 1);
    const to = this.waypoints[i];
    if (this.finished) return { x: to.x, y: to.y };
    const from = i === 0 ? this.start : this.waypoints[i - 1];
    const t = ease(this.active / Math.max(1, to.duration_ms * DOT_TRAVEL));
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  }

  /** The dashed trail: where the dot has been, ending at the dot. */
  get trail(): { x: number; y: number }[] {
    const n = this.waypoints.length;
    const pts = [this.start];
    for (let i = 0; i < Math.min(this.idx, n); i++) pts.push({ x: this.waypoints[i].x, y: this.waypoints[i].y });
    pts.push(this.dot);
    return pts;
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
