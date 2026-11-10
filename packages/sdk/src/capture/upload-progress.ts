/**
 * The upload sheet's progress bar (display only; spec v1.3, as iOS ee69907).
 *
 * The server's check after an upload has no progress to report, and on a
 * phone it took 6.7 s after a 2.3 s upload: a bar that jumped to 95% and sat
 * there looked stuck. Instead each stage eases toward a cap it never reaches,
 * starting from wherever the bar is, so it keeps moving until the result:
 *
 *   v(t) = cap - (cap - from) * e^(-t / tau)
 *
 *   start    0.04
 *   sending  cap 0.60, tau 1.5 s
 *   checking cap 0.95, tau 5 s   (upload accepted, or /complete in flight)
 *   done     1.0
 *
 * Stages only move forward; the bar never jumps back.
 */

export type UploadStage = 'idle' | 'sending' | 'checking' | 'done';

export const UPLOAD_PROGRESS = {
  start: 0.04,
  sending: { cap: 0.6, tauMs: 1500 },
  checking: { cap: 0.95, tauMs: 5000 },
} as const;

const ORDER: Record<UploadStage, number> = { idle: 0, sending: 1, checking: 2, done: 3 };

/** Eased progress across the upload and checking stages. */
export class UploadProgress {
  private stage: UploadStage = 'idle';
  private since = 0;
  private from = 0;

  /** Current stage. */
  get current(): UploadStage {
    return this.stage;
  }

  /**
   * Move to `stage` at time `now` (ms). Ignored unless it is further on than
   * the current stage. The new stage starts from the bar's current value.
   */
  advance(stage: UploadStage, now: number): void {
    if (ORDER[stage] <= ORDER[this.stage]) return;
    const v = this.value(now);
    this.from = stage === 'sending' && this.stage === 'idle' ? UPLOAD_PROGRESS.start : v;
    this.stage = stage;
    this.since = now;
  }

  /** Back to the start (the user returned to the align screen). */
  reset(): void {
    this.stage = 'idle';
    this.since = 0;
    this.from = 0;
  }

  /** Bar value (0-1) at time `now` (ms). */
  value(now: number): number {
    switch (this.stage) {
      case 'idle': return 0;
      case 'done': return 1;
      default: {
        const { cap, tauMs } = UPLOAD_PROGRESS[this.stage];
        const from = Math.min(this.from, cap);
        const t = Math.max(0, now - this.since);
        // Clamped just under the cap: after minutes the exponent underflows,
        // and the bar must never claim a stage has finished.
        return Math.min(cap - 0.001, cap - (cap - from) * Math.exp(-t / tauMs));
      }
    }
  }
}

/** aria-valuenow for a bar value: whole percent, floored to 10% steps. */
export function ariaPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.floor(value * 10) * 10));
}
