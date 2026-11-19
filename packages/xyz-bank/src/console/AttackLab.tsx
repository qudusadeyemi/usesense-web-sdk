/* Attack lab (/d/:id/lab): pick an attack or set the dials, run a real check
   in the Sense Demo org, and read the decision the live policy made. The rep
   faces the camera (or the prospect scans a QR); Watchtower applies the dials
   where scoring reads each signal. Nothing on this page predicts an outcome. */
import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { BankScreen, Phone } from '../bank/Screens';
import { getDemo, settingsKey } from '../lib/demos';
import { ATTACKS, changed, DIAL_GROUPS, decisionUrl, describeDials, GENUINE, optionLabel, questions, readReason, type Answer, type DialKey, type Dials } from '../lib/lab';
import type { LiveResult } from '../lib/live';
import { DemoProvider, useDemo } from '../lib/settings';
import { liveTarget } from '../lib/staffLive';
import { TopBar } from './Home';
import { LiveCheck } from './LiveCheck';

export function AttackLabRoute() {
  const { id = '' } = useParams();
  if (!getDemo(id)) return <Navigate to="/" replace />;
  return <DemoProvider key={id} storageKey={settingsKey(id)}><AttackLab demoId={id} /></DemoProvider>;
}

interface Run { n: number; at: string; label: string; dials: Dials; result: LiveResult | null; error: string | null }

const OUTCOME: Record<LiveResult['outcome'], { word: string; cls: string; tone: 'ok' | 'stop' | 'review' | 'hold'; title: string; body: string }> = {
  let: { word: 'Approved', cls: 'ok', tone: 'ok', title: 'You’re in', body: 'Your account is open.' },
  review: { word: 'In review', cls: 'sandbox', tone: 'review', title: 'We’re checking a few things', body: 'We’ll message you within the hour.' },
  stop: { word: 'Rejected', cls: 'live', tone: 'stop', title: 'We couldn’t verify you', body: 'Visit a branch with your ID.' },
  pending: { word: 'Not finished', cls: 'off', tone: 'hold', title: 'Almost there', body: 'We’re still checking.' },
};
const ANSWER: Record<Answer, [string, string]> = { yes: ['Yes', 'var(--teal)'], no: ['No', 'var(--red)'], unsure: ['Unsure', 'var(--gold)'] };
const runsKey = (id: string) => `xyz-lab-runs:${id}`;

function loadRuns(id: string): Run[] {
  try { return JSON.parse(sessionStorage.getItem(runsKey(id)) || '[]'); } catch { return []; }
}
function saveRuns(id: string, runs: Run[]) {
  try { sessionStorage.setItem(runsKey(id), JSON.stringify(runs.slice(-20))); } catch { /* ignore */ }
}

function AttackLab({ demoId }: { demoId: string }) {
  const { settings, brand, market, industry } = useDemo();
  const target = liveTarget(settings);
  const [dials, setDials] = useState<Dials>({});
  const [attack, setAttack] = useState<string | null>('genuine');
  const [camera, setCamera] = useState<'me' | 'them'>('me');
  const [running, setRunning] = useState<{ n: number; dials: Dials; label: string } | null>(null);
  const [runs, setRuns] = useState<Run[]>(() => loadRuns(demoId));
  const [shown, setShown] = useState<number | null>(runs.length ? runs[runs.length - 1].n : null);
  const [compare, setCompare] = useState<number[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({ device: true, face: true, history: true });

  const off = Object.keys(changed(dials)).length;
  const current = runs.find((r) => r.n === shown) ?? null;
  const bctx = useMemo(() => ({ brand, market, industry }), [brand, market, industry]);

  const pick = (id: string) => {
    const a = ATTACKS.find((x) => x.id === id)!;
    setAttack(id);
    setDials({ ...a.dials });
  };
  const setDial = (k: DialKey, v: string) => { setAttack(null); setDials((d) => ({ ...d, [k]: v })); };

  const run = () => {
    const n = (runs.at(-1)?.n ?? 0) + 1;
    const label = attack ? ATTACKS.find((a) => a.id === attack)!.label : 'Free play';
    setRunning({ n, dials: changed(dials), label });
  };
  const finish = (result: LiveResult | null, error: string | null) => {
    if (!running) return;
    const r: Run = { n: running.n, at: new Date().toISOString(), label: running.label, dials: running.dials, result, error };
    const next = [...runs, r];
    setRuns(next);
    saveRuns(demoId, next);
    setShown(r.n);
    setRunning(null);
  };

  const toggleCompare = (n: number) => setCompare((c) => (c.includes(n) ? c.filter((x) => x !== n) : [...c.slice(-1), n]));
  const pair = compare.length === 2 ? compare.map((n) => runs.find((r) => r.n === n)!).filter(Boolean) : [];

  return (
    <div className="app">
      <TopBar><Link className="btn ghost sm" to={`/d/${demoId}`}>Back to the demo</Link></TopBar>
      <main className="app-main lab">
        <div className="row lab-head">
          <h1 className="grow">{brand.name} · attack lab</h1>
          <span className="pill sandbox">Sense Demo policy, live</span>
        </div>

        {target.via !== 'demo' && (
          <p className="card lab-note small">This demo runs live checks on the prospect’s own key. Dials only work on the Sense Demo key: switch it in the demo’s live settings.</p>
        )}

        <div className="lab-plan" role="group" aria-label="Attacks">
          {ATTACKS.map((a, i) => (
            <button key={a.id} className="chip" aria-pressed={attack === a.id} onClick={() => pick(a.id)} disabled={!!running}>{i + 1} · {a.label}</button>
          ))}
          <button className="chip" aria-pressed={attack === null} onClick={() => setAttack(null)} disabled={!!running}>Free play</button>
        </div>
        {attack && <p className="small muted lab-line">{ATTACKS.find((a) => a.id === attack)!.line}</p>}

        <div className="lab-grid">
          <section aria-label="Dials">
            {DIAL_GROUPS.map((g) => {
              const n = g.dials.filter((d) => (dials[d.key] ?? GENUINE[d.key]) !== GENUINE[d.key]).length;
              return (
                <div className="lab-group" key={g.id}>
                  <button className="lab-group-head" aria-expanded={open[g.id]} onClick={() => setOpen((o) => ({ ...o, [g.id]: !o[g.id] }))}>
                    <b className="grow">{g.label}</b>
                    {n > 0 && <span className="pill sandbox">{n} changed</span>}
                    <span className="faint">{open[g.id] ? '−' : '+'}</span>
                  </button>
                  {open[g.id] && g.dials.map((d) => {
                    const v = dials[d.key] ?? GENUINE[d.key];
                    return (
                      <label className="lab-dial" key={d.key}>
                        <span className="small muted">{d.label}</span>
                        <select className={`select${v !== GENUINE[d.key] ? ' changed' : ''}`} value={v} disabled={!!running} onChange={(e) => setDial(d.key, e.target.value)}>
                          {d.options.map(([o, l]) => <option key={o} value={o}>{l}</option>)}
                        </select>
                      </label>
                    );
                  })}
                </div>
              );
            })}
            <div className="lab-group">
              <div className="lab-group-head"><b className="grow">Whose camera</b></div>
              <div className="row" role="group" aria-label="Whose camera">
                <button className="chip" aria-pressed={camera === 'me'} onClick={() => setCamera('me')} disabled={!!running}>This laptop</button>
                <button className="chip" aria-pressed={camera === 'them'} onClick={() => setCamera('them')} disabled={!!running}>Their phone (QR)</button>
              </div>
              <p className="tiny faint">The selfie is real. The dials change what Sense is told about it.</p>
            </div>
            <div className="row">
              <button className="btn ghost sm" onClick={() => { setDials({}); setAttack('genuine'); }} disabled={!!running}>Reset to genuine</button>
              <span className="small faint grow">{off ? `${off} dial${off > 1 ? 's' : ''} off genuine` : 'All genuine'}</span>
              <button className="btn blue" onClick={run} disabled={!!running || target.via !== 'demo'}>Run</button>
            </div>
          </section>

          <section className="lab-side" aria-label="Decision">
            {running ? (
              <div className="card lab-capture">
                <p className="small muted">Run {running.n}: {running.label} · {describeDials(running.dials)}</p>
                <LiveCheck
                  step="first"
                  who={camera}
                  label={`lab:${running.label}`}
                  dials={Object.keys(running.dials).length ? running.dials as Record<string, string> : undefined}
                  onResult={(r) => finish(r, null)}
                  onFail={(m) => finish(null, m)}
                />
                <button className="btn ghost sm" onClick={() => finish(null, 'Cancelled.')}>Cancel</button>
              </div>
            ) : (
              <>
                <Phone dark brand={brand}>
                  <BankScreen
                    screen={current?.result ? { kind: 'result', tone: OUTCOME[current.result.outcome].tone, title: OUTCOME[current.result.outcome].title, body: OUTCOME[current.result.outcome].body } : { kind: 'welcome' }}
                    ctx={bctx}
                    stepKey={`lab-${current?.n ?? 0}`}
                  />
                </Phone>
                <Decision run={current} />
              </>
            )}
          </section>
        </div>

        {runs.length > 0 && (
          <section className="card lab-runs" aria-label="Runs">
            <div className="row"><b className="grow">Runs</b><span className="tiny faint">Tick two to compare</span><button className="btn ghost sm" onClick={() => { setRuns([]); saveRuns(demoId, []); setShown(null); setCompare([]); }}>Clear</button></div>
            {runs.slice().reverse().map((r) => (
              <div className={`lab-run${r.n === shown ? ' cur' : ''}`} key={r.n}>
                <input type="checkbox" aria-label={`Compare run ${r.n}`} checked={compare.includes(r.n)} onChange={() => toggleCompare(r.n)} disabled={!r.result} />
                <button className="linkish grow" onClick={() => setShown(r.n)}>{r.n} · {r.label} <span className="faint small">· {describeDials(r.dials)}</span></button>
                {r.result ? <span className={`pill ${OUTCOME[r.result.outcome].cls}`}>{OUTCOME[r.result.outcome].word}</span> : <span className="pill off">Didn’t finish</span>}
              </div>
            ))}
            {pair.length === 2 && <Compare a={pair[0]} b={pair[1]} />}
          </section>
        )}
      </main>
    </div>
  );
}

function Decision({ run }: { run: Run | null }) {
  if (!run) return <div className="card lab-decision"><p className="small faint">Not run yet. Pick an attack, then Run.</p></div>;
  if (!run.result) {
    return (
      <div className="card lab-decision">
        <b>Run {run.n} didn’t finish</b>
        <p className="small muted">{run.error || 'Nothing was decided.'} Run it again.</p>
      </div>
    );
  }
  const r = run.result;
  const q = questions(r);
  const o = OUTCOME[r.outcome];
  const reasons = r.reasons.map(readReason);
  return (
    <div className="card lab-decision">
      <span className="tiny faint">Run {run.n} · {describeDials(run.dials)}{r.tookMs ? ` · ${(r.tookMs / 1000).toFixed(1)} s` : ''}</span>
      <span className={`pill ${o.cls} lab-verdict`}>{o.word}</span>
      <dl className="lab-q">
        <div><dt>Real person?</dt><dd style={{ color: ANSWER[q.real][1] }}>{ANSWER[q.real][0]}</dd></div>
        <div><dt>Only one?</dt><dd style={{ color: ANSWER[q.one][1] }}>{ANSWER[q.one][0]}</dd></div>
      </dl>
      <div className="lab-reasons">
        {reasons.length === 0 && <p className="small muted">Every check passed.</p>}
        {reasons.map((x, i) => (
          <p className="small" key={i}>
            <span className={`lab-act ${x.action}`}>{x.action}</span> {x.text}
            {x.setting && <><br /><span className="tiny faint">{x.setting}</span></>}
          </p>
        ))}
      </div>
      <div className="row">
        <a className="btn sm" href={decisionUrl(r.sessionId)} target="_blank" rel="noreferrer">Open in Watchtower</a>
        <span className="tiny faint mono">{r.sessionId.slice(0, 16)}…</span>
      </div>
    </div>
  );
}

function Compare({ a, b }: { a: Run; b: Run }) {
  const keys = DIAL_GROUPS.flatMap((g) => g.dials.map((d) => d.key));
  const val = (r: Run, k: DialKey) => optionLabel(k, r.dials[k] ?? GENUINE[k]);
  const score = (r: Run, k: 'liveness' | 'channel' | 'dedupe') => r.result?.scores[k] ?? null;
  const rows: [string, string, string][] = [
    ...keys.map((k): [string, string, string] => [DIAL_GROUPS.flatMap((g) => g.dials).find((d) => d.key === k)!.label, val(a, k), val(b, k)]),
    ['Liveness score', String(score(a, 'liveness') ?? '·'), String(score(b, 'liveness') ?? '·')],
    ['Device trust', String(score(a, 'channel') ?? '·'), String(score(b, 'channel') ?? '·')],
    ['Duplicate risk', String(score(a, 'dedupe') ?? '·'), String(score(b, 'dedupe') ?? '·')],
    ['Decision', OUTCOME[a.result!.outcome].word, OUTCOME[b.result!.outcome].word],
  ];
  return (
    <table className="lab-compare">
      <thead><tr><th /><th>Run {a.n}</th><th>Run {b.n}</th></tr></thead>
      <tbody>{rows.map(([l, x, y]) => <tr key={l} className={x !== y ? 'diff' : ''}><td className="muted">{l}</td><td>{x}</td><td>{y}</td></tr>)}</tbody>
    </table>
  );
}
