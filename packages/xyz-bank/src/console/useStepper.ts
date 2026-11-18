import { useCallback, useEffect, useRef, useState } from 'react';
import type { Step } from '../scenarios/types';

/** Plays scripted steps on a timer. The rep can pause, scrub and replay. */
export function useStepper(steps: Step[], resetKey: string, speed = 1) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [runId, setRunId] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setIndex(0);
    setPlaying(true);
    setRunId((r) => r + 1);
  }, [resetKey]);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!playing || index >= steps.length - 1) return;
    const ms = (steps[index]?.ms ?? 3000) / speed;
    timer.current = window.setTimeout(() => setIndex((i) => Math.min(i + 1, steps.length - 1)), ms);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [index, playing, steps, speed, runId]);

  const atEnd = index >= steps.length - 1;
  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(steps.length - 1, i))), [steps.length]);
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);
  const restart = useCallback(() => { setIndex(0); setPlaying(true); setRunId((r) => r + 1); }, []);
  const toggle = useCallback(() => {
    if (atEnd) { restart(); return; }
    setPlaying((p) => !p);
  }, [atEnd, restart]);

  const decideAt = steps.findIndex((s) => s.decide);
  const decided = decideAt === -1 ? atEnd : index >= decideAt;

  // A new set of steps can arrive before the reset effect runs; never read past the end.
  const at = Math.min(index, steps.length - 1);
  return { index: at, step: steps[at], playing: playing && !atEnd, atEnd, decided, go, next, prev, restart, toggle, setPlaying, runId };
}
