import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BankScreen, Phone, screenIsDark } from '../bank/Screens';
import { IcBack, IcPause, IcPlay, IcPhone, IcRestart, IcArrowRight } from '../bank/icons';
import { logDemo } from '../lib/history';
import type { LiveResult } from '../lib/live';
import { useDemo } from '../lib/settings';
import { findScenario, makeContext, orderedFor } from '../scenarios';
import { JOURNEY_LABEL, QUESTION_LABEL, type FeedEvent, type Screen, type VariantId } from '../scenarios/types';
import { DecisionPanel, WatchtowerLink, livePanel } from './Panel';
import { useStepper } from './useStepper';

// The capture engine only loads when a rep runs a live check.
const LiveRun = lazy(() => import('./LiveRun').then((m) => ({ default: m.LiveRun })));

const VARIANTS: { id: VariantId; label: string; key: string }[] = [
  { id: 'genuine', label: 'Genuine', key: '1' },
  { id: 'attack', label: 'Attacker', key: '2' },
  { id: 'nosense', label: 'Without Sense', key: '3' },
];

export function Stage({ publicMode = false, scenarioIds }: { publicMode?: boolean; scenarioIds?: string[] }) {
  const { id: routeId } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const demo = useDemo();
  const ctx = useMemo(() => makeContext(demo.market, demo.industry, demo.brand), [demo.market, demo.industry, demo.brand]);
  const list = useMemo(() => {
    const all = orderedFor(ctx);
    return scenarioIds?.length ? all.filter((s) => scenarioIds.includes(s.id)) : all;
  }, [ctx, scenarioIds]);
  const id = routeId ?? params.get('scenario') ?? list[0]?.id ?? '';
  const scenario = findScenario(ctx, id) ?? list[0];
  const variant = ((params.get('v') as VariantId) || 'attack') as VariantId;
  const v = scenario.variants[variant] ?? scenario.variants.attack;
  const [speed] = useState(1);
  const st = useStepper(v.steps, `${scenario.id}:${variant}`, speed);
  const [showTalk, setShowTalk] = useState(false);
  const [liveOpen, setLiveOpen] = useState<null | { handoff: boolean }>(null);
  const [live, setLive] = useState<null | { r: LiveResult; name: string }>(null);

  useEffect(() => { setLive(null); }, [scenario.id, variant]);

  useEffect(() => {
    if (publicMode) return;
    logDemo({ prospect: demo.settings.prospect, industry: demo.industry.id, market: demo.market.id, scenarioId: scenario.id, scenarioTitle: scenario.title, variant });
  }, [scenario.id, variant, publicMode, demo.settings.prospect, demo.industry.id, demo.market.id, scenario.title]);

  const setVariant = useCallback((vid: VariantId) => {
    const p = new URLSearchParams(params);
    p.set('v', vid);
    if (publicMode) p.set('scenario', scenario.id);
    setParams(p, { replace: true });
  }, [params, setParams, publicMode, scenario.id]);

  const idx = list.findIndex((s) => s.id === scenario.id);
  const goScenario = useCallback((delta: number) => {
    const next = list[(idx + delta + list.length) % list.length];
    if (!next) return;
    if (publicMode) { const p = new URLSearchParams(params); p.set('scenario', next.id); p.set('v', 'attack'); setParams(p); }
    else nav(`/stage/${next.id}?v=attack`);
  }, [list, idx, publicMode, params, setParams, nav]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (liveOpen) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === ' ') { e.preventDefault(); st.toggle(); }
      else if (e.key === 'ArrowRight') st.next();
      else if (e.key === 'ArrowLeft') st.prev();
      else if (e.key === 'r' || e.key === 'R') st.restart();
      else if (e.key === 't' || e.key === 'T') setShowTalk((x) => !x);
      else if (e.key === ']') goScenario(1);
      else if (e.key === '[') goScenario(-1);
      else { const vv = VARIANTS.find((x) => x.key === e.key); if (vv) setVariant(vv.id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [st, setVariant, goScenario, liveOpen]);

  const feed: FeedEvent[] = v.steps.slice(0, st.index + 1).map((s) => s.event).filter((e): e is FeedEvent => !!e);

  // A live result replaces the scripted genuine path.
  let screen: Screen = st.step.screen;
  let stepKey = `${scenario.id}-${variant}-${st.step.id}-${st.runId}`;
  if (live) {
    const o = live.r.outcome;
    screen = o === 'let'
      ? { kind: 'result', tone: 'ok', title: live.r.type === 'authentication' ? 'Confirmed, it’s you' : `You’re in, ${live.name.split(' ')[0]}`, body: 'Checked live by Sense, just now.', cta: 'Continue', detail: demo.market.accountLine }
      : o === 'stop'
        ? { kind: 'result', tone: 'stop', title: 'We couldn’t confirm it’s you', body: 'Checked live by Sense, just now. This is the real decision.', cta: 'Contact support' }
        : { kind: 'result', tone: 'review', title: 'Almost there', body: 'Sense sent this to Review. Your team would see it in Watchtower now.', cta: 'Got it' };
    stepKey = `live-${live.r.sessionId}`;
  }

  const panel = live ? livePanel(live.r, ctx, live.name) : v.panel;
  const decided = live ? true : st.decided;
  const canLive = !publicMode && !!scenario.live && variant !== 'nosense';

  const onLiveResult = (r: LiveResult, name: string) => {
    setLive({ r, name });
    setLiveOpen(null);
    st.setPlaying(false);
    logDemo({ prospect: demo.settings.prospect, industry: demo.industry.id, market: demo.market.id, scenarioId: scenario.id, scenarioTitle: scenario.title, variant: 'live', liveSessionId: r.sessionId, liveOutcome: r.outcome });
  };

  return (
    <div className="stage-page">
      <div className="stagebar">
        {!publicMode && <Link className="btn ghost sm" to="/scenarios" aria-label="All scenarios"><IcBack width={16} /></Link>}
        <div className="title">
          <h1>{scenario.title}</h1>
          <span>{JOURNEY_LABEL[scenario.journey]} · {QUESTION_LABEL[scenario.question]} · Caught by {scenario.caughtBy}</span>
        </div>
        <div className="seg" role="group" aria-label="Replay as">
          {VARIANTS.map((x) => (
            <button key={x.id} className={x.id === 'attack' ? 'atk' : ''} aria-pressed={!live && variant === x.id} onClick={() => { setLive(null); setVariant(x.id); }} title={`Key ${x.key}`}>{x.label}</button>
          ))}
        </div>
        <div className="row">
          <button className="btn sm" onClick={() => goScenario(-1)} title="Previous scenario ([)">Prev</button>
          <button className="btn sm" onClick={() => goScenario(1)} title="Next scenario (])">Next <IcArrowRight width={14} /></button>
        </div>
      </div>
      <div className="steps" role="tablist" aria-label="Steps">
        {v.steps.map((s, i) => (
          <button key={s.id} role="tab" aria-selected={i === st.index} className={`${i < st.index ? 'done' : ''} ${i === st.index ? 'cur' : ''} ${!st.playing ? 'paused' : ''}`}
            style={{ ['--dur' as string]: `${(s.ms ?? 3000) / speed}ms` }} onClick={() => { setLive(null); st.go(i); }}>
            <i key={i === st.index ? `${st.runId}-${st.index}` : undefined} />{s.label}
          </button>
        ))}
      </div>
      <div className="stage">
        <div className="left">
          <Phone dark={screenIsDark(screen)} brand={demo.brand}>
            <BankScreen screen={screen} ctx={{ brand: demo.brand, market: demo.market, industry: demo.industry }} stepKey={stepKey} />
          </Phone>
          <div className="transport">
            <button onClick={st.restart} aria-label="Restart (R)" title="Restart (R)"><IcRestart /></button>
            <button onClick={st.prev} aria-label="Previous step" title="Previous step (←)"><IcBack /></button>
            <button className="play" onClick={st.toggle} aria-label={st.playing ? 'Pause' : 'Play'} title="Play or pause (Space)">{st.playing ? <IcPause /> : <IcPlay />}</button>
            <button onClick={st.next} aria-label="Next step" title="Next step (→)"><IcArrowRight /></button>
            <span className="count">{st.index + 1} / {v.steps.length}</span>
          </div>
        </div>
        <div className="right">
          {!live && st.step.say && (
            <div className="say" key={`${stepKey}-say`}><span className="eyebrow">{publicMode ? 'What’s happening' : 'Say'}</span><span>{st.step.say}</span></div>
          )}
          {canLive && !live && (
            <div className="live-cta">
              <div><b>{scenario.live!.label}</b><p>{scenario.live!.hint}</p></div>
              <div className="row">
                {demo.activeKey
                  ? <>
                      <button className="btn" onClick={() => { st.setPlaying(false); setLiveOpen({ handoff: true }); }} title="The prospect takes the check on their own phone"><IcPhone width={15} /> Their phone</button>
                      <button className="btn blue" onClick={() => { st.setPlaying(false); setLiveOpen({ handoff: false }); }}>Run it live</button>
                    </>
                  : <Link className="btn" to="/setup">Add a key to run live</Link>}
              </div>
            </div>
          )}
          {live && (
            <div className="live-cta">
              <div><span className="pill blue">Live result</span><p style={{ marginTop: 6 }}>This decision came from Sense just now. Open it in Watchtower to show the evidence, the signed outcome and Review.</p></div>
              <div className="row"><button className="btn" onClick={() => setLive(null)}>Back to the replay</button><WatchtowerLink sessionId={live.r.sessionId} /></div>
            </div>
          )}
          <DecisionPanel panel={panel} decided={decided} feed={feed} scripted={!live} />
          {!publicMode && (
            <div className="card" style={{ padding: '6px 18px' }}>
              <button className="btn ghost sm" style={{ margin: '6px -8px' }} onClick={() => setShowTalk((x) => !x)} aria-expanded={showTalk}>
                {showTalk ? 'Hide' : 'Show'} the talk track <span className="kbd">T</span>
              </button>
              {showTalk && (
                <div className="talk">
                  <div className="t"><span>Set up</span><p>{scenario.talk.setup}</p></div>
                  <div className="t"><span>Attack</span><p>{scenario.talk.attack}</p></div>
                  <div className="t"><span>Contrast</span><p>{scenario.talk.contrast}</p></div>
                  <div className="t"><span>Close</span><p>{scenario.talk.close}</p></div>
                </div>
              )}
            </div>
          )}
          {!publicMode && (
            <p className="tiny faint">Keys: <span className="kbd">Space</span> play · <span className="kbd">←</span><span className="kbd">→</span> steps · <span className="kbd">1</span><span className="kbd">2</span><span className="kbd">3</span> genuine, attacker, without Sense · <span className="kbd">[</span><span className="kbd">]</span> scenarios · <span className="kbd">R</span> restart</p>
          )}
        </div>
      </div>
      {liveOpen && scenario.live && (
        <Suspense fallback={<div className="modal-back"><div className="modal"><div className="mb">Loading the face check…</div></div></div>}>
          <LiveRun kind={scenario.live.kind} title={scenario.title} handoff={liveOpen.handoff} onResult={onLiveResult} onClose={() => setLiveOpen(null)} />
        </Suspense>
      )}
    </div>
  );
}
