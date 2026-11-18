import { Face } from '../bank/Face';
import { IcExternal, IcSparkle } from '../bank/icons';
import { plainReason, watchtowerSessionUrl, type LiveResult } from '../lib/live';
import type { ScenarioContext } from '../scenarios';
import { OUTCOME_LABEL, QUESTION_LABEL, type Answer, type Extra, type FeedEvent, type Outcome, type Panel as PanelT } from '../scenarios/types';

const Q_COLOR = { real: 'var(--q-real)', right: 'var(--q-right)', one: 'var(--q-one)', still: 'var(--q-still)' } as const;
const ICON = { pass: '✓', fail: '✕', flag: '!', skip: '–', unknown: '?' } as const;

export function SenseMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="8" fill="#4f7cff" />
      <circle cx="16" cy="13" r="4.2" fill="#fff" />
      <path d="M8.5 25c1.2-4.4 4-6.4 7.5-6.4s6.3 2 7.5 6.4" fill="#fff" />
      <path d="M6.5 11.5a10 10 0 0 0 0 9M25.5 11.5a10 10 0 0 1 0 9" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

export function Verdict({ outcome }: { outcome: Outcome | 'wait' }) {
  if (outcome === 'wait') return <span className="verdict wait"><span className="spin" />Checking</span>;
  const mark = outcome === 'stop' ? '✕' : outcome === 'let' ? '✓' : outcome === 'review' ? '!' : '';
  return <span className={`verdict ${outcome}`}>{mark && <span aria-hidden="true">{mark}</span>}{OUTCOME_LABEL[outcome]}</span>;
}

function AnswerRow({ a, i }: { a: Answer; i: number }) {
  return (
    <div className={`qrow ${a.state}`} style={{ animationDelay: `${0.12 + i * 0.12}s`, ['--qc' as string]: Q_COLOR[a.q] }}>
      <span className={`ic ${a.state}`} aria-label={a.state}>{ICON[a.state]}</span>
      <b>{QUESTION_LABEL[a.q]}<span className="sr-only">: </span></b>
      <p>{a.text}<span className="src">{a.source}</span></p>
    </div>
  );
}

function Ring({ extra }: { extra: Extract<Extra, { kind: 'ring' }> }) {
  // Hubs in the middle row, accounts around them.
  const hubs = extra.nodes.filter((n) => n.type !== 'account');
  const accts = extra.nodes.filter((n) => n.type === 'account');
  const W = 520, H = 220;
  const pos = new Map<string, [number, number]>();
  hubs.forEach((n, i) => pos.set(n.id, [W * (i + 1) / (hubs.length + 1), H / 2]));
  accts.forEach((n, i) => {
    const top = i % 2 === 0;
    const col = Math.floor(i / 2);
    const cols = Math.ceil(accts.length / 2);
    pos.set(n.id, [40 + (W - 80) * (cols === 1 ? 0.5 : col / (cols - 1)) + (top ? 0 : 30), top ? 30 : H - 30]);
  });
  return (
    <div className="extra">
      <h4>The ring: 7 accounts, 2 faces, 1 phone</h4>
      <svg className="ring-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Accounts linked by face and device">
        {extra.edges.map(([a, b]) => {
          const p = pos.get(a)!, q = pos.get(b)!;
          return <line key={a + b} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} />;
        })}
        {extra.nodes.map((n) => {
          const [x, y] = pos.get(n.id)!;
          const fill = n.type === 'face' ? 'var(--q-one)' : n.type === 'device' ? 'var(--q-real)' : n.flagged ? 'var(--red-fill)' : 'var(--surface)';
          const r = n.type === 'account' ? 15 : 20;
          return (
            <g key={n.id}>
              <circle cx={x} cy={y} r={r} fill={fill} stroke={n.type === 'account' ? 'var(--line2)' : 'none'} strokeWidth="1.5" />
              <text x={x} y={n.type === 'account' ? (y < H / 2 ? y - 21 : y + 28) : y + 34} textAnchor="middle">{n.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ExtraBlock({ extra }: { extra: Extra }) {
  switch (extra.kind) {
    case 'ring': return <Ring extra={extra} />;
    case 'botfarm': {
      const max = Math.max(...extra.devices.map((d) => d.count));
      return (
        <div className="extra">
          <h4>{extra.total} sign-ups from {extra.devices.length} devices · {extra.window}</h4>
          <div className="bars">
            {extra.devices.map((d, i) => (
              <div className="bar" key={d.label}><span className="small">{d.label}</span><span className="b" style={{ width: `${(d.count / max) * 100}%`, animationDelay: `${0.3 + i * 0.1}s` }} /><span className="mono small">{d.count}</span></div>
            ))}
          </div>
        </div>
      );
    }
    case 'network':
      return (
        <div className="extra">
          <h4>Seen in Sense Network</h4>
          <div className="small muted">{extra.member} · {extra.when} · {extra.reason}. Only the matching signal is shared.</div>
        </div>
      );
    case 'agent':
      return (
        <div className="extra">
          <h4>AI agent on this application</h4>
          <div className="small muted">{extra.operator} · {extra.declared ? 'Declared' : 'Undeclared'} · {extra.detail}</div>
        </div>
      );
    case 'match':
      return (
        <div className="extra">
          <h4>Same face, two names</h4>
          <div className="match-pair">
            <span className="f"><Face kind="a" breathe={false} /></span>
            <span className="small"><b>{extra.a}</b><br /><span className="muted">{extra.when}</span></span>
            <span className="pill ok" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>{extra.score}</span>
            <span className="small"><b>{extra.b}</b><br /><span className="muted">Today</span></span>
            <span className="f"><Face kind="a" breathe={false} /></span>
          </div>
        </div>
      );
  }
}

export function DecisionPanel({ panel, decided, feed, scripted = true }: { panel: PanelT; decided: boolean; feed: FeedEvent[]; scripted?: boolean }) {
  const loss = panel.outcome === 'kyc';
  return (
    <div className="panel" aria-live="polite">
      <div className="ph">
        <div className="who"><b>{panel.subject}</b><span>{panel.meta}</span></div>
        <Verdict outcome={decided ? panel.outcome : 'wait'} />
      </div>
      {!decided ? (
        feed.length ? (
          <div className="feed">
            {feed.map((e, i) => (
              <div key={i + e.text} className={`ev ${e.tone ?? ''}`}><i /><span>{e.text}</span><span className="t">{loss ? 'KYC only' : 'Sense'}</span></div>
            ))}
          </div>
        ) : <div className="empty-panel">Waiting for the customer to start.</div>
      ) : (
        <>
          <div>{panel.answers.map((a, i) => <AnswerRow key={a.q} a={a} i={i} />)}</div>
          {panel.extra && <ExtraBlock extra={panel.extra} />}
          <div className={`sensei${loss ? ' loss' : ''}`}>
            <span className="h"><IcSparkle />{loss ? 'What KYC alone let through' : 'Sensei'}</span>
            <p>{panel.sensei.text}</p>
            {panel.sensei.actions.length > 0 && <div className="acts">{panel.sensei.actions.map((x) => <span key={x}>{x}</span>)}</div>}
          </div>
          <div className="pf"><span>{scripted ? 'Scripted replay · example decision' : 'Live decision from Sense'}</span>{scripted && !loss && <span className="mono tiny">Signed like every Sense decision</span>}</div>
        </>
      )}
    </div>
  );
}

/* ---------- live results as a panel ---------- */

export function livePanel(r: LiveResult, c: ScenarioContext, name: string, audience: 'rep' | 'prospect' = 'rep'): PanelT {
  const auth = r.type === 'authentication';
  const real: Answer = {
    q: 'real',
    state: r.liveness === 'fail' || r.device === 'fail' ? 'fail' : r.liveness === 'flag' || r.device === 'flag' ? 'flag' : r.liveness === 'skip' && r.device === 'skip' ? 'unknown' : 'pass',
    source: 'LiveSense · DeepSense',
    text: r.liveness === 'fail' ? 'Liveness failed: this did not look like a live person.' : r.device === 'fail' ? 'The device or camera stream was not trusted.' : 'A live person on a real camera.',
  };
  const one: Answer = auth
    ? { q: 'one', state: 'skip', source: 'MatchSense', text: 'Not searched on a returning-customer check.' }
    : { q: 'one', state: r.dedupe === 'fail' ? 'fail' : r.dedupe === 'flag' ? 'flag' : r.dedupe === 'skip' ? 'unknown' : 'pass', source: 'MatchSense', text: r.dedupe === 'fail' ? 'Same face as an existing customer in this org.' : r.dedupe === 'flag' ? 'Similar to an existing customer. Worth a look.' : 'No other customer in this org has this face.' };
  const still: Answer = auth
    ? { q: 'still', state: r.outcome === 'let' ? 'pass' : r.outcome === 'stop' ? 'fail' : 'flag', source: 'Account protection', text: r.outcome === 'let' ? 'Matches the face from sign-up.' : r.outcome === 'stop' ? 'Does not match the face from sign-up.' : 'Not a clear match. Sent to Review.' }
    : { q: 'still', state: 'skip', source: 'Account protection', text: 'Not asked at sign-up.' };
  const reasons = r.reasons.slice(0, 3).map(plainReason);
  const outcome: Outcome = r.outcome === 'pending' ? 'review' : r.outcome;
  const sense = outcome === 'let'
    ? (auth ? 'The owner, confirmed in seconds against the face from sign-up.' : 'A real, live, unique person. Through without extra steps.')
    : outcome === 'stop' ? `Stopped${reasons.length ? `: ${reasons.join('; ')}` : ''}. ${audience === 'prospect' ? 'Your team would see the frames and every signal in Watchtower.' : 'Open it in Watchtower for the frames and every signal.'}`
      : `Sent to Review${reasons.length ? `: ${reasons.join('; ')}` : ''}. ${audience === 'prospect' ? 'Sensei writes up the case for your team in Watchtower.' : 'Sensei writes up the case in Watchtower.'}`;
  return {
    subject: `${name} · ${auth ? 'returning customer' : 'new applicant'}`,
    meta: `${r.env === 'production' ? 'Live' : 'Sandbox'} · ${r.sessionId}${r.tookMs ? ` · ${(r.tookMs / 1000).toFixed(1)} s` : ''} · ${c.m.city}`,
    outcome,
    answers: [real, { q: 'right', state: 'skip', source: 'Your KYC', text: 'Not part of this live check. Your KYC or Sense KYC answers it in a Flow.' }, one, still],
    sensei: { text: sense, actions: [] },
  };
}

export function WatchtowerLink({ sessionId }: { sessionId: string }) {
  return (
    <a className="btn pri" href={watchtowerSessionUrl(sessionId)} target="_blank" rel="noreferrer">
      Open in Watchtower <IcExternal width={15} height={15} />
    </a>
  );
}
