/* Your demos: one card per prospect, newest first, each saying what to do
   next. The first visit shows how a demo works and offers a quick demo. */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../bank/Screens';
import { useAuth } from '../lib/auth';
import { listDemos, migrateOldSettings, QUICK_ID, readSettings, type DemoRecord } from '../lib/demos';
import { INDUSTRIES, MARKETS } from '../lib/presets';
import { brandFor } from '../lib/settings';
import { sharesApi, shareState, type ShareSummary } from '../lib/shares';
import { SenseMark } from './Panel';

export function ago(iso?: string | null): string {
  if (!iso) return '';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

const INTRO_KEY = 'xyz-intro-seen';

export function TopBar({ children }: { children?: React.ReactNode }) {
  const auth = useAuth();
  return (
    <header className="app-top">
      <Link to="/" className="app-mark"><SenseMark size={22} /><b>Sense demo</b></Link>
      <span className="grow" />
      {children}
      <a className="btn ghost sm" href="https://watchtower.usesense.ai" target="_blank" rel="noreferrer">Watchtower</a>
      {!auth.disabled && <button className="btn ghost sm" onClick={() => auth.signOut()} title={auth.email ?? ''}>Sign out</button>}
    </header>
  );
}

function demoLine(d: DemoRecord, share?: ShareSummary): { text: string; tag?: { label: string; tone: string } } {
  if (share) {
    const st = shareState(share);
    const bits = [`Link sent ${ago(share.createdAt)}`];
    if (share.visitors) bits.push(`opened by ${share.visitors} ${share.visitors === 1 ? 'person' : 'people'}`);
    if (share.checksUsed) bits.push(`${share.checksUsed} face ${share.checksUsed === 1 ? 'check' : 'checks'}`);
    return { text: bits.join(' · '), tag: st };
  }
  if (d.presentedAt) return { text: `Presented ${ago(d.presentedAt)} · no link sent yet`, tag: { label: 'Send the link', tone: 'warn' } };
  if (d.rehearsedAt) return { text: `Rehearsed ${ago(d.rehearsedAt)}`, tag: { label: 'Ready', tone: 'plain' } };
  return { text: `Set up ${ago(d.createdAt)} · not presented yet`, tag: { label: 'Draft', tone: 'plain' } };
}

export function Home() {
  const nav = useNavigate();
  const auth = useAuth();
  useMemo(() => migrateOldSettings(), []);
  const demos = useMemo(() => listDemos().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), []);
  const [shares, setShares] = useState<Map<string, ShareSummary>>(new Map());
  const [intro, setIntro] = useState(() => { try { return !localStorage.getItem(INTRO_KEY); } catch { return false; } });
  useEffect(() => {
    if (!demos.some((d) => d.shareId)) return;
    sharesApi.list().then((r) => setShares(new Map(r.shares.map((s) => [s.id, s])))).catch(() => {});
  }, [demos]);
  const closeIntro = () => { setIntro(false); try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* ignore */ } };
  const first = (auth.name ?? '').split(' ')[0];

  return (
    <div className="app">
      <TopBar />
      <main className="app-main">
        {intro && (
          <section className="intro card">
            <span className="eyebrow">{first ? `Welcome, ${first}` : 'Welcome'}</span>
            <h2>How a demo works</h2>
            <div className="intro-steps">
              <div><b>1 · Prepare</b><p className="muted small">Their website in, their app out. About a minute.</p></div>
              <div><b>2 · Present</b><p className="muted small">Their app tells the story. You press →. Your notes stay off the shared screen.</p></div>
              <div><b>3 · Follow up</b><p className="muted small">They get a link to try it on their own face, and you see what they did.</p></div>
            </div>
            <div className="row">
              <button className="btn blue" onClick={() => { closeIntro(); nav(`/d/${QUICK_ID}/rehearse`); }}>Try a quick demo now</button>
              <button className="btn" onClick={() => { closeIntro(); nav('/new'); }}>Set up a prospect</button>
              <button className="btn ghost sm" onClick={closeIntro}>Skip</button>
            </div>
          </section>
        )}

        <div className="page-head">
          <div><h1>Your demos</h1><p className="muted">One per prospect. Everything stays in this browser.</p></div>
          <div className="row">
            <Link className="btn" to={`/d/${QUICK_ID}`}>Quick demo</Link>
            <Link className="btn pri" to="/new">New demo</Link>
          </div>
        </div>

        {demos.length === 0 ? (
          <div className="empty-big card">
            <h3>No prospects yet</h3>
            <p className="muted">Start with their website. We read their logo, colours and what they do, and pick the attacks that matter to them.</p>
            <Link className="btn pri" to="/new">New demo</Link>
          </div>
        ) : (
          <ul className="demo-list">
            {demos.map((d) => {
              const s = readSettings(d.id);
              const brand = brandFor(s);
              const share = d.shareId ? shares.get(d.shareId) : undefined;
              const line = demoLine(d, share);
              return (
                <li key={d.id}>
                  <Link to={`/d/${d.id}`} className="demo-card">
                    <span className="dc-logo"><Logo brand={brand} /></span>
                    <span className="grow">
                      <b>{s.prospect || s.website || 'Untitled demo'}</b>
                      <span className="muted small">{INDUSTRIES[s.industry]?.label} · {MARKETS[s.market]?.label}</span>
                      <span className="small">{line.text}</span>
                    </span>
                    {line.tag && <span className={`tag ${line.tag.tone}`}>{line.tag.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
