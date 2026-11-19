/* Present: the screen the prospect sees. Their app tells the story; nothing
   the rep needs is on it. Notes open in their own window (N), or inline when
   rehearsing. Keys: arrows move, / jumps to any attack, L runs a live check,
   U opens "under the hood", Esc ends with the follow-up link. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IcArrowRight, IcBack, IcCopy, IcExternal, IcX } from '../bank/icons';
import { Logo } from '../bank/Screens';
import { getDemo, saveDemo, type DemoRecord } from '../lib/demos';
import { watchtowerSessionUrl, type LiveResult } from '../lib/live';
import { appearanceOf, useDemo } from '../lib/settings';
import { pageFor, sharesApi, shareUrl } from '../lib/shares';
import { beatsFor, matchScenarios, related, type Beat } from '../lib/story';
import { liveTarget } from '../lib/staffLive';
import { allScenarios, makeContext } from '../scenarios';
import type { Scenario } from '../scenarios/types';
import { BeatProgress, BeatView, QuestionChip } from './BeatView';
import { LiveCheck, type TryStep } from './LiveCheck';
import { DecisionPanel, SenseMark, livePanel } from './Panel';

export type Item = { kind: 'cover' } | { kind: 'attack'; id: string; extra?: boolean } | { kind: 'try' } | { kind: 'end' };
export interface Pos { i: number; beat: number }

/** What the notes window needs to follow along. */
export interface NotesState {
  title: string;
  where: string;
  beatLabel: string;
  say: string;
  stepSays: string[];
  ask: string[];
  next: string;
  partIndex: number;
  parts: number;
  startedAt: number;
}

export const channelName = (id: string) => `xyz-present-${id}`;
export type NotesCommand = 'next' | 'prev' | 'try' | 'end' | 'jump';

function itemsFor(story: string[]): Item[] {
  return [{ kind: 'cover' }, ...story.map((id) => ({ kind: 'attack' as const, id })), { kind: 'try' }, { kind: 'end' }];
}

export function Present({ demoId, rehearse = false }: { demoId: string; rehearse?: boolean }) {
  const nav = useNavigate();
  const demo = useDemo();
  const ctx = useMemo(() => makeContext(demo.market, demo.industry, demo.brand), [demo.market, demo.industry, demo.brand]);
  const all = useMemo(() => allScenarios(ctx), [ctx]);
  const byId = useMemo(() => new Map(all.map((s) => [s.id, s])), [all]);
  const [record, setRecord] = useState<DemoRecord | null>(() => getDemo(demoId));
  const story = useMemo(() => (record?.story ?? []).filter((id) => byId.has(id)), [record, byId]);
  const [items, setItems] = useState<Item[]>(() => itemsFor(story));
  const [pos, setPos] = useState<Pos>({ i: 0, beat: 0 });
  const [back, setBack] = useState<Pos | null>(null);
  const [run, setRun] = useState(0);
  const [jump, setJump] = useState(false);
  const [hood, setHood] = useState(false);
  const [showNotes, setShowNotes] = useState(rehearse);
  const [chrome, setChrome] = useState(true);
  const startedAt = useRef(Date.now());
  const chromeTimer = useRef<number | null>(null);

  useEffect(() => { setItems((cur) => (cur.some((x) => x.kind === 'attack' && x.extra) ? cur : itemsFor(story))); }, [story]);

  const item = items[pos.i] ?? items[0];
  const scenario = item.kind === 'attack' ? byId.get(item.id) : undefined;
  const beats = useMemo<Beat[]>(() => (scenario ? beatsFor(scenario) : []), [scenario]);
  const beat = beats[pos.beat];

  // Try state lives here so moving away and back keeps the results.
  const [tryRun, setTryRun] = useState<null | { step: TryStep; who: 'them' | 'me' }>(null);
  const [results, setResults] = useState<{ first?: { r: LiveResult; name: string }; fool?: { r: LiveResult; name: string } }>({});
  const [tryErr, setTryErr] = useState('');

  const update = useCallback((patch: Partial<DemoRecord>) => {
    setRecord((r) => (r ? saveDemo({ ...r, ...patch }) : r));
  }, []);

  useEffect(() => { update(rehearse ? { rehearsedAt: new Date().toISOString() } : { presentedAt: new Date().toISOString() }); }, [rehearse, update]);

  const go = useCallback((p: Pos) => { setPos(p); setRun((x) => x + 1); }, []);
  const next = useCallback(() => {
    if (item.kind === 'attack' && pos.beat < beats.length - 1) return go({ i: pos.i, beat: pos.beat + 1 });
    if (item.kind === 'attack' && item.extra && back) { const b = back; setBack(null); return go({ i: b.i + 1, beat: 0 }); }
    if (pos.i < items.length - 1) go({ i: pos.i + 1, beat: 0 });
  }, [item, pos, beats.length, items.length, go, back]);
  const prev = useCallback(() => {
    if (item.kind === 'attack' && pos.beat > 0) return go({ i: pos.i, beat: pos.beat - 1 });
    if (pos.i > 0) {
      const p = items[pos.i - 1];
      const n = p.kind === 'attack' && byId.get(p.id) ? beatsFor(byId.get(p.id)!).length - 1 : 0;
      go({ i: pos.i - 1, beat: n });
    }
  }, [item, pos, items, byId, go]);
  const toKind = useCallback((k: 'try' | 'end') => go({ i: items.findIndex((x) => x.kind === k), beat: 0 }), [items, go]);

  const playExtra = useCallback((id: string) => {
    setJump(false);
    const at = items.findIndex((x) => x.kind === 'attack' && x.id === id);
    if (at >= 0) return go({ i: at, beat: 0 });
    // Insert after the current item, and remember where to come back to.
    const ins = pos.i + 1;
    setItems((cur) => [...cur.slice(0, ins), { kind: 'attack', id, extra: true }, ...cur.slice(ins)]);
    setBack(pos);
    if (record && !record.extras.includes(id) && !record.story.includes(id)) update({ extras: [...record.extras, id] });
    go({ i: ins, beat: 0 });
  }, [items, pos, go, record, update]);

  const leave = useCallback(() => nav(`/d/${demoId}`), [nav, demoId]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (jump || (tryRun && e.key !== 'Escape')) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
      else if (e.key === '/') { e.preventDefault(); setJump(true); }
      else if (e.key === 'l' || e.key === 'L') toKind('try');
      else if (e.key === 'u' || e.key === 'U') setHood((h) => !h);
      else if (e.key === 'n' || e.key === 'N') { if (rehearse) setShowNotes((x) => !x); else openNotes(demoId); }
      else if (e.key === 'Escape') { if (hood) setHood(false); else if (tryRun) setTryRun(null); else if (item.kind === 'end') leave(); else toKind('end'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, jump, tryRun, toKind, hood, item.kind, leave, rehearse, demoId]);

  // Controls show on mouse movement, then get out of the way.
  useEffect(() => {
    const wake = () => {
      setChrome(true);
      if (chromeTimer.current) window.clearTimeout(chromeTimer.current);
      chromeTimer.current = window.setTimeout(() => setChrome(false), 2600);
    };
    wake();
    window.addEventListener('mousemove', wake);
    return () => { window.removeEventListener('mousemove', wake); if (chromeTimer.current) window.clearTimeout(chromeTimer.current); };
  }, []);

  // Notes window sync
  const attackItems = items.filter((x) => x.kind === 'attack');
  const notes: NotesState = useMemo(() => {
    const partIndex = item.kind === 'attack' ? attackItems.findIndex((x) => x === item) + 1 : item.kind === 'cover' ? 0 : attackItems.length + 1;
    const nextItem = items.slice(pos.i + 1).find((x) => x.kind !== 'cover');
    const nextTitle = item.kind === 'attack' && pos.beat < beats.length - 1
      ? `${beats[pos.beat + 1].label}`
      : nextItem?.kind === 'attack' ? byId.get(nextItem.id)?.title ?? '' : nextItem?.kind === 'try' ? 'Now you try (live)' : nextItem?.kind === 'end' ? 'The end card and their link' : '';
    if (item.kind === 'attack' && scenario && beat) {
      return {
        title: scenario.title, where: `${partIndex} of ${attackItems.length}${item.extra ? ' · extra' : ''}`, beatLabel: `${beat.label} · beat ${pos.beat + 1} of ${beats.length}`,
        say: beat.say, stepSays: beat.steps.map((s) => s.say).filter((x): x is string => !!x),
        ask: related(all, scenario).map((r) => `${r.title}: press / then type “${r.title.split(' ')[0].toLowerCase()}”`),
        next: nextTitle, partIndex, parts: attackItems.length, startedAt: startedAt.current,
      };
    }
    const fixed: Record<string, [string, string]> = {
      cover: [`${demo.brand.name}, with Sense on top of your KYC`, 'Open with their name. “Sense answers four questions on every customer: a real person, the right person, only one, and still them later.”'],
      try: ['Now you try', 'Ask them to scan the QR with their phone. Step one opens an account. Step two: same face, new name. Sense should stop it.'],
      end: ['Thank you', 'Their link is on screen. It lasts 14 days and has 5 face checks. Offer the follow-up.'],
    };
    const [title, say] = fixed[item.kind] ?? ['', ''];
    return { title, where: item.kind === 'cover' ? 'Opening' : item.kind === 'try' ? 'Live' : 'Close', beatLabel: '', say, stepSays: [], ask: [], next: nextTitle, partIndex, parts: attackItems.length, startedAt: startedAt.current };
  }, [item, scenario, beat, beats, pos, items, attackItems, byId, all, demo.brand.name]);

  const chan = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const c = new BroadcastChannel(channelName(demoId));
    chan.current = c;
    c.onmessage = (e) => {
      const m = e.data as { cmd?: NotesCommand; hello?: boolean };
      if (m.hello) c.postMessage({ notes: notesRef.current });
      if (m.cmd === 'next') next();
      if (m.cmd === 'prev') prev();
      if (m.cmd === 'try') toKind('try');
      if (m.cmd === 'end') toKind('end');
      if (m.cmd === 'jump') setJump(true);
    };
    return () => c.close();
  }, [demoId, next, prev, toKind]);
  const notesRef = useRef(notes);
  useEffect(() => { notesRef.current = notes; chan.current?.postMessage({ notes }); }, [notes]);

  // The follow-up link, made when the end card opens.
  const [share, setShare] = useState<{ url: string; err?: string } | null>(null);
  useEffect(() => {
    if (item.kind !== 'end' || rehearse || share) return;
    if (record?.shareId) { setShare({ url: shareUrl(location.origin, record.shareId) }); return; }
    const scenarios = [...story, ...(record?.extras ?? [])];
    sharesApi.create(pageFor(demo.settings, { prospect: demo.settings.prospect, industry: demo.settings.industry, market: demo.settings.market, scenarios }))
      .then((r) => { update({ shareId: r.share.id }); setShare({ url: shareUrl(location.origin, r.share.id) }); })
      .catch((e) => setShare({ url: '', err: (e as Error).message || 'Couldn’t make the link. Make it from the demo page.' }));
  }, [item.kind, rehearse, share, record, story, demo.settings, update]);

  const ctxName = demo.brand.name;
  const target = liveTarget(demo.settings);

  return (
    <div className={`present${chrome ? ' chrome' : ''}${showNotes ? ' with-notes' : ''}`}>
      <header className="pr-top">
        <span className="pr-brand"><Logo brand={demo.brand} light /><span className="x">×</span><SenseMark size={20} /><b>Sense</b></span>
        <div className="pr-parts" aria-label="Story">
          {items.filter((x) => x.kind === 'attack' || x.kind === 'try').map((x, k) => {
            const at = items.indexOf(x);
            return <button key={k} className={`${at < pos.i ? 'done' : ''}${at === pos.i ? ' cur' : ''}`} onClick={() => go({ i: at, beat: 0 })} aria-label={x.kind === 'try' ? 'Now you try' : byId.get(x.id)?.title}><i /></button>;
          })}
        </div>
        {rehearse && <span className="pill sandbox">Rehearsal</span>}
      </header>

      <main className="pr-main">
        {item.kind === 'cover' && (
          <div className="pr-cover">
            <div className="pr-cover-logo"><Logo brand={demo.brand} light /></div>
            <h1>{demo.brand.coBranded ? demo.brand.name : 'XYZ Bank'}, with Sense on top of your KYC</h1>
            <p>Four questions on every customer: a real person, the right person, only one, and still them later.</p>
            <div className="pr-q4"><span className="qchip q-real">Real person?</span><span className="qchip q-right">Right person?</span><span className="qchip q-one">Only one?</span><span className="qchip q-still">Still them?</span></div>
          </div>
        )}

        {item.kind === 'attack' && scenario && beat && (
          <div className="pr-attack">
            <BeatProgress beats={beats} index={pos.beat} />
            <BeatView scenario={scenario} beat={beat} runKey={`${scenario.id}-${pos.beat}-${run}`} />
          </div>
        )}

        {item.kind === 'try' && (
          <TrySection
            brandName={ctxName}
            tryRun={tryRun} setTryRun={setTryRun} results={results} setResults={setResults} err={tryErr} setErr={setTryErr}
            via={target.via}
            onRecorded={() => playExtra('same-face-new-name')}
            ctxPanel={(r, name) => livePanel(r, ctx, name, 'prospect')}
          />
        )}

        {item.kind === 'end' && (
          <div className="pr-cover">
            <h1>Thank you{demo.brand.coBranded ? `, ${demo.brand.name}` : ''}</h1>
            {rehearse
              ? <p>In a real call, their link appears here. Rehearsal doesn’t make one.</p>
              : <>
                  <p>Here is a link to try it with your team. Open an account, then try again as someone else.</p>
                  {share?.url
                    ? <div className="pr-link"><span className="mono">{share.url}</span><button className="btn" onClick={() => navigator.clipboard?.writeText(share.url).catch(() => {})}><IcCopy width={15} /> Copy link</button></div>
                    : share?.err ? <p className="small" style={{ color: 'var(--red)' }}>{share.err}</p> : <p className="small muted">Making their link…</p>}
                  <p className="small muted">Works for 14 days · 5 face checks</p>
                </>}
          </div>
        )}
      </main>

      {showNotes && <InlineNotes notes={notes} />}

      <footer className="pr-controls" aria-label="Presenter controls">
        <button className="btn ghost sm" onClick={leave} title="Leave (back to the demo page)"><IcX width={15} /> Leave</button>
        <span className="grow" />
        <button className="btn ghost sm" onClick={prev} aria-label="Back (←)"><IcBack width={16} /></button>
        <button className="btn sm" onClick={next} aria-label="Next (→)">Next <IcArrowRight width={14} /></button>
        <span className="grow" />
        <button className="btn ghost sm" onClick={() => setJump(true)} title="Jump to any attack (/)">Jump <span className="kbd">/</span></button>
        <button className="btn ghost sm" onClick={() => toKind('try')} title="Now you try (L)">Live <span className="kbd">L</span></button>
        <button className="btn ghost sm" onClick={() => setHood(true)} title="Under the hood (U)">Under the hood <span className="kbd">U</span></button>
        {!rehearse && <button className="btn ghost sm" onClick={() => openNotes(demoId)} title="Open notes in a new window (N)">Notes <span className="kbd">N</span></button>}
        {rehearse && <button className="btn ghost sm" onClick={() => setShowNotes((x) => !x)}>Notes <span className="kbd">N</span></button>}
      </footer>

      {jump && <JumpPalette all={all} onPick={playExtra} onClose={() => setJump(false)} />}
      {hood && <UnderTheHood scenario={scenario} beat={beat} live={results.fool ?? results.first} onClose={() => setHood(false)} />}
    </div>
  );
}

export function openNotes(demoId: string) {
  window.open(`/xyz/d/${encodeURIComponent(demoId)}/notes`, `xyz-notes-${demoId}`, 'popup,width=460,height=720');
}

/* ---------- Now you try ---------- */

function TrySection({ brandName, tryRun, setTryRun, results, setResults, err, setErr, via, onRecorded, ctxPanel }: {
  brandName: string;
  tryRun: null | { step: TryStep; who: 'them' | 'me' };
  setTryRun: (v: null | { step: TryStep; who: 'them' | 'me' }) => void;
  results: { first?: { r: LiveResult; name: string }; fool?: { r: LiveResult; name: string } };
  setResults: (fn: (r: typeof results) => typeof results) => void;
  err: string;
  setErr: (s: string) => void;
  via: 'demo' | 'key';
  onRecorded: () => void;
  ctxPanel: (r: LiveResult, name: string) => ReturnType<typeof livePanel>;
}) {
  const step: TryStep = results.first ? 'fool' : 'first';
  const latest = results.fool ?? results.first;
  // Expand: the capture centred over the stage at full size (as in the attack lab).
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setExpanded(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [expanded]);
  useEffect(() => { if (!tryRun) setExpanded(false); }, [tryRun]);
  const sameFace = results.fool && results.fool.r.outcome === 'stop' && results.fool.r.dedupe === 'fail';
  return (
    <div className="pr-try">
      {via === 'key' && <span className="pill live" style={{ alignSelf: 'center' }}>Runs in their sandbox</span>}
      {!tryRun && !latest && (
        <div className="pr-cover">
          <h1>Now you try</h1>
          <p>Open an account at {brandName} with your own face. It takes a minute.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn blue lg" onClick={() => { setErr(''); setTryRun({ step: 'first', who: 'them' }); }}>Show the QR code</button>
            <button className="btn lg" onClick={() => { setErr(''); setTryRun({ step: 'first', who: 'me' }); }}>Use this camera</button>
          </div>
          {err && <TryError err={err} onRetry={() => setErr('')} onRecorded={onRecorded} />}
        </div>
      )}
      {tryRun && (
        <div className="pr-try-run">
          <h2>{tryRun.step === 'fool' ? 'Now try to fool it' : 'Open an account'}</h2>
          {/* Expanding only restyles this wrapper, so the camera is never restarted. */}
          <div className={`cap-expand${expanded ? ' expanded' : ''}`}>
            {expanded && (
              <div className="cap-expand-bar">
                <span className="small grow">{tryRun.step === 'fool' ? 'Now try to fool it' : 'Open an account'}</span>
                <button className="btn sm" onClick={() => setExpanded(false)}>Shrink</button>
              </div>
            )}
            <LiveCheck
              step={tryRun.step} who={tryRun.who} label={tryRun.step === 'fool' ? 'try-duplicate' : 'try-first'}
              onResult={(r, name) => { setResults((x) => ({ ...x, [tryRun.step]: { r, name } })); setTryRun(null); }}
              onFail={(m) => { setErr(m); setTryRun(null); }}
            />
          </div>
          <div className="row">
            {tryRun.who === 'me' && <button className="btn sm" onClick={() => setExpanded(true)}>Expand</button>}
            <button className="btn ghost sm" onClick={() => setTryRun(null)}>Cancel</button>
          </div>
        </div>
      )}
      {!tryRun && latest && (
        <div className="pr-try-result">
          <div className="pr-results">
            {results.first && <div><span className="eyebrow">Step 1 · {results.first.r.type === 'authentication' ? 'Returning customer' : 'Open an account'}</span><DecisionPanel panel={ctxPanel(results.first.r, results.first.name)} decided feed={[]} scripted={false} /></div>}
            {results.fool && <div><span className="eyebrow">Step 2 · Same face, new name</span><DecisionPanel panel={ctxPanel(results.fool.r, results.fool.name)} decided feed={[]} scripted={false} /></div>}
          </div>
          {sameFace && <p className="bv-headline sense">One person. One account.</p>}
          {results.first?.r.type === 'authentication' && !results.fool && <p className="small muted">Sense recognised this face from an earlier demo, so it checked in as a returning customer.</p>}
          <div className="row" style={{ justifyContent: 'center' }}>
            {!results.fool && <button className="btn blue lg" onClick={() => { setErr(''); setTryRun({ step, who: 'them' }); }}>Now try to fool it</button>}
            {!results.fool && <button className="btn lg" onClick={() => { setErr(''); setTryRun({ step, who: 'me' }); }}>Fool it on this camera</button>}
            <a className="btn lg" href={watchtowerSessionUrl(latest.r.sessionId)} target="_blank" rel="noreferrer">See it in Watchtower <IcExternal width={15} /></a>
          </div>
          {err && <TryError err={err} onRetry={() => setErr('')} onRecorded={onRecorded} />}
        </div>
      )}
    </div>
  );
}

function TryError({ err, onRetry, onRecorded }: { err: string; onRetry: () => void; onRecorded: () => void }) {
  return (
    <div className="notice" style={{ background: 'var(--red-soft)', color: 'var(--red)', justifyContent: 'center' }}>
      <span>{err}</span>
      <button className="btn sm" onClick={onRetry}>Try again</button>
      <button className="btn sm" onClick={onRecorded}>Show the recorded run</button>
    </div>
  );
}

/* ---------- Jump to any attack ---------- */

function JumpPalette({ all, onPick, onClose }: { all: Scenario[]; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const list = matchScenarios(all, q).slice(0, 8);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="jump" role="dialog" aria-label="Jump to an attack" onClick={(e) => e.stopPropagation()}>
        <input id="jump-q" className="input" autoFocus value={q} placeholder="What did they ask about? Loan stacking, SIM swap, deepfakes…" onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, list.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            else if (e.key === 'Enter' && list[sel]) onPick(list[sel].id);
            else if (e.key === 'Escape') onClose();
          }} />
        <ul>
          {list.map((s, i) => (
            <li key={s.id}><button className={i === sel ? 'sel' : ''} onMouseEnter={() => setSel(i)} onClick={() => onPick(s.id)}><b>{s.title}</b><QuestionChip s={s} /></button></li>
          ))}
          {!list.length && <li className="muted small" style={{ padding: 10 }}>No attack matches. Try another word.</li>}
        </ul>
        <span className="tiny faint">↵ play · Esc back. It plays in three beats, then returns to where you were.</span>
      </div>
    </div>
  );
}

/* ---------- Under the hood ---------- */

const DECISION_WORD = { let: 'APPROVE', stop: 'REJECT', review: 'MANUAL_REVIEW', kyc: 'APPROVE', pending: 'PENDING' } as const;

export function UnderTheHood({ scenario, beat, live, onClose }: { scenario?: Scenario; beat?: Beat; live?: { r: LiveResult; name: string }; onClose: () => void }) {
  const { brand } = useDemo();
  const [tab, setTab] = useState<'decision' | 'signature' | 'webhook' | 'sdk'>('decision');
  const panel = beat?.panel ?? scenario?.variants.attack.panel;
  const example = !live;
  const decision = live
    ? {
        session_id: live.r.sessionId,
        decision: DECISION_WORD[live.r.outcome],
        pillar_verdicts: { liveness: live.r.liveness, channel_trust: live.r.device, dedupe: live.r.dedupe },
        scores: { liveness: live.r.scores.liveness ?? null, channel_trust: live.r.scores.channel ?? null, dedupe_risk: live.r.scores.dedupe ?? null },
        reasons: live.r.reasons,
        environment: live.r.env,
      }
    : panel
      ? {
          session_id: 'ses_example',
          decision: DECISION_WORD[panel.outcome],
          questions: Object.fromEntries(panel.answers.map((a) => [{ real: 'real_person', right: 'right_person', one: 'only_one', still: 'still_them' }[a.q], a.state])),
          reasons: panel.answers.filter((a) => a.state === 'fail').map((a) => a.text),
          environment: 'sandbox',
        }
      : { decision: 'APPROVE' };
  const body = JSON.stringify(decision, null, 2);
  const webhook = JSON.stringify({ event: 'verification.completed', payload: decision, timestamp: '2026-11-18T09:41:12Z', webhookId: 'wh_example' }, null, 2);
  const appearance = appearanceOf(brand, { inlineAssets: false });
  if (appearance.logo?.url && appearance.logo.url.length > 80) appearance.logo.url = `${appearance.logo.url.slice(0, 60)}…`;
  const sdk = `import { VerificationCaptureEngine } from '@usesense/web-sdk';

<VerificationCaptureEngine
  sessionData={session}            // created by your server
  appearance={${JSON.stringify(appearance, null, 2).replace(/\n/g, '\n  ')}}
  onComplete={(result) => sendToYourServer(result)}
/>`;
  const sig = `// The decision arrives with a signature:
// { kid, value, canonical_payload }

import { verify } from 'node:crypto';

const ok = verify(null,
  Buffer.from(sig.canonical_payload, 'utf8'), key,
  Buffer.from(sig.value, 'base64url'));
// then use the parsed payload as the trusted decision`;
  return (
    <div className="hood" role="dialog" aria-label="Under the hood">
      <div className="row"><b>Under the hood</b>{example && <span className="pill off">Example</span>}<span className="grow" /><button className="btn ghost sm" onClick={onClose} aria-label="Close"><IcX width={15} /></button></div>
      <div className="seg" role="tablist">
        {(['decision', 'signature', 'webhook', 'sdk'] as const).map((t) => (
          <button key={t} role="tab" aria-pressed={tab === t} onClick={() => setTab(t)}>{{ decision: 'Decision', signature: 'Signature', webhook: 'Webhook', sdk: 'SDK code' }[t]}</button>
        ))}
      </div>
      <pre className="code">{tab === 'decision' ? body : tab === 'webhook' ? webhook : tab === 'sdk' ? sdk : sig}</pre>
      <p className="small muted">{{
        decision: example ? 'The shape of the decision your server receives, filled in from this scenario.' : 'The real decision for this live check.',
        signature: 'Every decision is signed with Ed25519. Match the kid to the published key, verify canonical_payload exactly as sent, then trust the payload. No call to Sense.',
        webhook: 'The same decision arrives by webhook: event, payload, timestamp and a webhook id you can dedupe on.',
        sdk: `${brand.name}’s brand, as code. The same appearance works on iOS, Android, React Native and Flutter.`,
      }[tab]}</p>
    </div>
  );
}

/* ---------- Notes ---------- */

export function InlineNotes({ notes }: { notes: NotesState }) {
  return (
    <aside className="notes-inline" aria-label="Your notes (not for sharing)">
      <div className="row"><span className="eyebrow">{notes.where}{notes.beatLabel ? ` · ${notes.beatLabel}` : ''}</span><span className="grow" /><span className="tiny faint">Notes are only on your screen</span></div>
      <p className="say-big">{notes.say}</p>
      {notes.ask.length > 0 && <p className="small muted">If they ask: {notes.ask.join(' · ')}</p>}
      {notes.next && <p className="tiny faint">Next: {notes.next}</p>}
    </aside>
  );
}

export function NotesWindow({ demoId }: { demoId: string }) {
  const [notes, setNotes] = useState<NotesState | null>(null);
  const [now, setNow] = useState(Date.now());
  const chan = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const c = new BroadcastChannel(channelName(demoId));
    chan.current = c;
    c.onmessage = (e) => { if (e.data?.notes) setNotes(e.data.notes as NotesState); };
    c.postMessage({ hello: true });
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { c.close(); window.clearInterval(t); };
  }, [demoId]);
  const send = (cmd: NotesCommand) => chan.current?.postMessage({ cmd });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') send('next'); if (e.key === 'ArrowLeft') send('prev'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const rec = getDemo(demoId);
  if (!notes) return <div className="notes-win"><p className="muted">Waiting for the presentation… Keep the Present tab open; these notes follow it.</p>{!rec && <Link to="/">Your demos</Link>}</div>;
  const mins = Math.floor((now - notes.startedAt) / 60000);
  return (
    <div className="notes-win">
      <div className="row"><span className="eyebrow">{notes.where}</span><span className="grow" /><span className="mono small">{mins} min</span></div>
      <h2>{notes.title}</h2>
      {notes.beatLabel && <span className="pill off">{notes.beatLabel}</span>}
      <div className="say-card"><span className="eyebrow">Say</span><p>{notes.say}</p></div>
      {notes.stepSays.length > 0 && <div className="stack small"><span className="eyebrow">On the phone</span>{notes.stepSays.map((s, i) => <span key={i} className="muted">{s}</span>)}</div>}
      {notes.ask.length > 0 && <div className="stack small"><span className="eyebrow">If they ask</span>{notes.ask.map((s) => <span key={s}>{s}</span>)}</div>}
      {notes.next && <p className="small muted">Next: <b>{notes.next}</b></p>}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => send('prev')}><IcBack width={15} /> Back</button>
        <button className="btn pri" onClick={() => send('next')}>Next <IcArrowRight width={15} /></button>
        <button className="btn" onClick={() => send('jump')}>Jump</button>
        <button className="btn" onClick={() => send('try')}>Now you try</button>
        <button className="btn" onClick={() => send('end')}>End</button>
      </div>
      <p className="tiny faint">← → work here too. This window is only on your screen; share the Present tab, not this one.</p>
    </div>
  );
}
