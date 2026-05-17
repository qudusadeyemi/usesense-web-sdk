/**
 * Clock -- single source of time for `runBiometricSession`.
 *
 * Casey: a function with two clock models (setInterval + await sleep) is
 * untestable except by accident. Inject one Clock; tests pass FakeClock and
 * advance it explicitly.
 *
 *   real time:  realClock      -- wall clock + setTimeout
 *   test time:  createFakeClock -- pure, advance(ms) drives sleeps
 */

export interface Clock {
  /** Current time in ms (monotonic). */
  now(): number;
  /** Resolves after `ms` of clock time. */
  sleep(ms: number): Promise<void>;
}

export const realClock: Clock = {
  now: () => performance.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

export interface FakeClock extends Clock {
  /** Advance time by `ms`, releasing any sleeps whose deadlines have passed. */
  advance(ms: number): Promise<void>;
}

interface Pending {
  deadline: number;
  resolve: () => void;
}

/**
 * Pure fake. `now()` only advances when `advance()` is called. `sleep()`
 * resolves on the microtask queue after `advance()` crosses its deadline.
 */
export function createFakeClock(start = 0): FakeClock {
  let current = start;
  const pending: Pending[] = [];

  const flushMicrotasks = async () => {
    // Drain enough microtask cycles for chained `await sleep(); await x();
    // await sleep()` patterns to schedule their next sleep.
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };

  const releaseDue = async () => {
    // Resolve all sleeps whose deadline has passed. Yield to the microtask
    // queue between passes so resolved continuations run + may schedule
    // new sleeps which themselves might be due.
    await flushMicrotasks();
    for (let pass = 0; pass < 100; pass++) {
      const due = pending.filter((p) => p.deadline <= current);
      if (due.length === 0) return;
      for (const p of due) {
        const idx = pending.indexOf(p);
        if (idx >= 0) pending.splice(idx, 1);
        p.resolve();
      }
      await flushMicrotasks();
    }
  };

  return {
    now: () => current,
    sleep(ms) {
      return new Promise<void>((resolve) => {
        pending.push({ deadline: current + ms, resolve });
      });
    },
    async advance(ms) {
      current += ms;
      await releaseDue();
    },
  };
}
