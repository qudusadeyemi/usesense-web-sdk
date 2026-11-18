/* The story, self-guided: the prospect's page, the old leave-behind replay
   and booth mode. Same beats as Present; a tap (or a timer, in booth mode)
   moves on. */
import { useEffect, useMemo, useState } from 'react';
import { IcArrowRight, IcBack } from '../bank/icons';
import { useDemo } from '../lib/settings';
import { beatsFor } from '../lib/story';
import { allScenarios, makeContext } from '../scenarios';
import { BeatProgress, BeatView } from './BeatView';

const HOLD_MS = 3800;

export function StoryPlayer({ ids, autoplay = false, onEnd, onStep }: { ids: string[]; autoplay?: boolean; onEnd?: () => void; onStep?: (scenarioId: string, beat: number) => void }) {
  const demo = useDemo();
  const ctx = useMemo(() => makeContext(demo.market, demo.industry, demo.brand), [demo.market, demo.industry, demo.brand]);
  const list = useMemo(() => {
    const all = allScenarios(ctx);
    const byId = new Map(all.map((s) => [s.id, s]));
    const picked = ids.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => !!s);
    return picked.length ? picked : all.slice(0, 3);
  }, [ctx, ids]);
  const [at, setAt] = useState({ s: 0, b: 0, run: 0 });
  const scenario = list[Math.min(at.s, list.length - 1)];
  const beats = useMemo(() => beatsFor(scenario), [scenario]);
  const beat = beats[Math.min(at.b, beats.length - 1)];
  const last = at.s === list.length - 1 && at.b === beats.length - 1;

  useEffect(() => { onStep?.(scenario.id, at.b); }, [scenario.id, at.b]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => setAt((p) => {
    if (p.b < beats.length - 1) return { s: p.s, b: p.b + 1, run: p.run + 1 };
    if (p.s < list.length - 1) return { s: p.s + 1, b: 0, run: p.run + 1 };
    onEnd?.();
    return autoplay ? { s: 0, b: 0, run: p.run + 1 } : p;
  });
  const prev = () => setAt((p) => {
    if (p.b > 0) return { s: p.s, b: p.b - 1, run: p.run + 1 };
    if (p.s > 0) { const n = beatsFor(list[p.s - 1]).length - 1; return { s: p.s - 1, b: n, run: p.run + 1 }; }
    return p;
  });

  useEffect(() => {
    if (!autoplay) return;
    const ms = beat.steps.reduce((n, s) => n + (s.ms ?? 3000), 0) + HOLD_MS;
    const t = window.setTimeout(next, ms);
    return () => window.clearTimeout(t);
  }); // re-arms on every beat

  const nextLabel = at.b < beats.length - 1 ? `Next: ${beats[at.b + 1].label === 'Your KYC' ? 'what your KYC saw' : beats[at.b + 1].label === 'Sense' ? 'what Sense saw' : beats[at.b + 1].label.toLowerCase()}` : at.s < list.length - 1 ? 'Next attack' : 'Done';

  return (
    <div className={`story-player${autoplay ? ' auto' : ''}`}>
      {list.length > 1 && (
        <div className="sp-tabs" role="tablist" aria-label="Attacks">
          {list.map((s, i) => (
            <button key={s.id} role="tab" aria-selected={i === at.s} onClick={() => setAt((p) => ({ s: i, b: 0, run: p.run + 1 }))}>{s.title}</button>
          ))}
        </div>
      )}
      <BeatProgress beats={beats} index={at.b} />
      <BeatView scenario={scenario} beat={beat} runKey={`${scenario.id}-${at.b}-${at.run}`} />
      {!autoplay && (
        <div className="sp-nav">
          <button className="btn" onClick={prev} disabled={at.s === 0 && at.b === 0}><IcBack width={15} /> Back</button>
          {!last && <button className="btn pri" onClick={next}>{nextLabel} <IcArrowRight width={15} /></button>}
          {last && onEnd && <button className="btn pri" onClick={onEnd}>Try it yourself <IcArrowRight width={15} /></button>}
        </div>
      )}
    </div>
  );
}
