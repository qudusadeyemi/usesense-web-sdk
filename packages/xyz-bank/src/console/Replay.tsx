/* The prospect's leave-behind: scripted replays only, no sign-in, no keys. */
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { beacon } from '../lib/beacon';
import { INDUSTRIES, MARKETS, type IndustryId, type MarketId } from '../lib/presets';
import { DemoProvider, brandFor, useDemo } from '../lib/settings';
import { SenseMark } from './Panel';
import { Stage } from './Stage';

function ReplayInner() {
  const [p] = useSearchParams();
  const ids = useMemo(() => (p.get('s') ?? '').split(',').map((x) => x.trim()).filter(Boolean), [p]);
  const sr = p.get('sr');
  const scenario = p.get('scenario');
  const variant = p.get('v');
  const { brand } = useDemo();
  const name = brandFor({ prospect: p.get('for') ?? '', logo: null, brandColor: null }).name;

  useEffect(() => { beacon(sr, 'page_view', 'xyz-replay'); }, [sr]);
  useEffect(() => { if (scenario) beacon(sr, 'deck_slide', `xyz:${scenario}:${variant ?? 'attack'}`); }, [sr, scenario, variant]);

  return (
    <div className="replay">
      <header>
        <div className="row"><SenseMark /><b style={{ fontFamily: 'var(--f-display)', fontWeight: 600 }}>Sense</b><span className="faint small">for {brand.coBranded ? name : 'you'}</span></div>
        <div className="row">
          <a className="btn sm" href="https://usesense.ai/demo" target="_blank" rel="noreferrer" onClick={() => beacon(sr, 'cta_click', 'xyz-replay:book')}>Talk to us</a>
          <a className="btn pri sm" href="https://usesense.ai/scan" target="_blank" rel="noreferrer" onClick={() => beacon(sr, 'cta_click', 'xyz-replay:scan')}>Get a free fraud scan</a>
        </div>
      </header>
      <Stage publicMode scenarioIds={ids} />
      <p className="tiny faint" style={{ padding: '0 28px 28px' }}>Scripted replays with example people and numbers. {brand.coBranded ? `${name} is shown as an example; this is not their live app.` : 'XYZ Bank is fictional.'}</p>
    </div>
  );
}

export function Replay() {
  const [p] = useSearchParams();
  const ind = p.get('ind') as IndustryId | null;
  const mkt = p.get('mkt') as MarketId | null;
  // Pinned to the link: the prospect sees what the rep set, never the rep's keys.
  const initial = {
    prospect: (p.get('for') ?? '').slice(0, 40),
    industry: ind && INDUSTRIES[ind] ? ind : 'bank' as IndustryId,
    market: mkt && MARKETS[mkt] ? mkt : 'gb' as MarketId,
    logo: null, brandColor: null, website: '', site: null, liveMode: 'off' as const, sandboxKey: '', liveKey: '',
  };
  return (
    <DemoProvider storageKey="xyz-replay-settings-v1" initial={initial}>
      <ReplayInner />
    </DemoProvider>
  );
}
