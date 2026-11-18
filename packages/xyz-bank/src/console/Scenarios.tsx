import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDemo } from '../lib/settings';
import { JOURNEYS, makeContext, orderedFor } from '../scenarios';
import { JOURNEY_LABEL, OUTCOME_LABEL, QUESTION_LABEL, type Journey } from '../scenarios/types';

export function Scenarios() {
  const { market, industry, brand, activeKey } = useDemo();
  const ctx = useMemo(() => makeContext(market, industry, brand), [market, industry, brand]);
  const all = useMemo(() => orderedFor(ctx), [ctx]);
  const [journey, setJourney] = useState<Journey | 'lead' | 'all'>('lead');
  const [liveOnly, setLiveOnly] = useState(false);
  const leads = new Set(industry.leads);
  const shown = all.filter((s) => (journey === 'all' ? true : journey === 'lead' ? leads.has(s.id) : s.journey === journey) && (!liveOnly || !!s.live));

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Pick the attack they fear</h1><p>Ordered for {industry.short.toLowerCase()} in {market.label}. Every scenario plays as a genuine customer, as the attacker, and without Sense.</p></div>
        <button className="chip" aria-pressed={liveOnly} onClick={() => setLiveOnly((x) => !x)}>{liveOnly ? '✓ ' : ''}Runs live</button>
      </div>
      <div className="jtabs" role="group" aria-label="Journey">
        <button className="chip" aria-pressed={journey === 'lead'} onClick={() => setJourney('lead')}>Top 5 for {industry.short.toLowerCase()}</button>
        <button className="chip" aria-pressed={journey === 'all'} onClick={() => setJourney('all')}>All {all.length}</button>
        {JOURNEYS.map((j) => (
          <button key={j} className="chip" aria-pressed={journey === j} onClick={() => setJourney(j)}>{JOURNEY_LABEL[j]} · {all.filter((s) => s.journey === j).length}</button>
        ))}
      </div>
      <div className="sgrid">
        {shown.map((s) => (
          <Link key={s.id} className="scard" to={`/stage/${s.id}?v=attack`}>
            <div className="top">
              <span className={`qtag ${s.question}`}>{QUESTION_LABEL[s.question]}</span>
              {s.live ? <span className="livetag">{activeKey ? 'Live' : 'Live with a key'}</span> : <span className="faint tiny mono">Scripted</span>}
            </div>
            <h3>{s.title}</h3>
            <p>{s.blurb}</p>
            <div className="meta">
              <span>{JOURNEY_LABEL[s.journey]} · {s.caughtBy}</span>
              <span className={`outc ${s.attackOutcome}`}>{OUTCOME_LABEL[s.attackOutcome]}</span>
            </div>
            {leads.has(s.id) && <span className="lead">Leads for {industry.short.toLowerCase()}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
