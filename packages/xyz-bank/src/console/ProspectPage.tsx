/* The prospect's own link: try.usesense.ai/xyz/p/:id. No sign-in, no keys.
   The same story the rep presented, self-guided: try it on your own face
   (open an account, then try again as someone else), watch the attacks, see
   what it means for your team, share it, and take a next step. Checks run in
   the Sense Demo sandbox org; Watchtower starts them. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { VerificationCaptureEngine, type CaptureResult, type CaptureSessionData } from '@usesense/web-sdk';
import { beacon } from '../lib/beacon';
import { fromCapture, fromDetails, type LiveResult } from '../lib/live';
import { appearanceOf, DemoProvider, useDemo } from '../lib/settings';
import { publicShareApi, settingsFor, shareUrl, visitorId, type PublicShare } from '../lib/shares';
import { WatchtowerError } from '../lib/watchtower';
import { makeContext } from '../scenarios';
import { BankScreen, Logo, Phone } from '../bank/Screens';
import { IcArrowRight, IcCopy, IcPhone, IcX } from '../bank/icons';
import { DecisionPanel, SenseMark, livePanel } from './Panel';
import { StoryPlayer } from './StoryPlayer';

type Attempt = { result: LiveResult; at: string; name: string };
const triedKey = (id: string) => `xyz-share-tries-${id}`;
function loadTries(id: string): Attempt[] {
  try { return JSON.parse(localStorage.getItem(triedKey(id)) || '[]') as Attempt[]; } catch { return []; }
}
function saveTries(id: string, a: Attempt[]) {
  try { localStorage.setItem(triedKey(id), JSON.stringify(a.slice(-5))); } catch { /* private window: still works this visit */ }
}
const isPhone = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 700);
const SITE = 'https://usesense.ai';
const SIGNUP = 'https://watchtower.usesense.ai/signup';

type Role = 'fraud' | 'compliance' | 'product' | 'developers' | 'leadership';
const ROLES: { id: Role; label: string }[] = [
  { id: 'fraud', label: 'Fraud and risk' }, { id: 'compliance', label: 'Compliance' }, { id: 'product', label: 'Product' },
  { id: 'developers', label: 'Developers' }, { id: 'leadership', label: 'Leadership' },
];

/* ---------- the face check ---------- */

function TryIt({ id, step, name, onDone }: { id: string; step: 1 | 2; name: string; onDone: (a: Attempt | null, err?: string) => void }) {
  const { brand } = useDemo();
  const [phase, setPhase] = useState<'pick' | 'qr' | 'starting' | 'capture' | 'reading'>(isPhone() ? 'starting' : 'pick');
  const [session, setSession] = useState<CaptureSessionData | null>(null);
  const [qr, setQr] = useState('');
  const link = `${shareUrl(location.origin, id)}#try`;

  const start = useCallback(async () => {
    setPhase('starting');
    try {
      const r = await publicShareApi.startCheck(id);
      setSession(r.session);
      setPhase('capture');
    } catch (e) {
      onDone(null, e instanceof WatchtowerError ? e.message : 'Couldn’t start the face check. Try again.');
    }
  }, [id, onDone]);

  useEffect(() => { if (phase === 'starting' && !session) void start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (phase === 'qr' && !qr) QRCode.toDataURL(link, { margin: 1, width: 440, errorCorrectionLevel: 'M' }).then(setQr); }, [phase, qr, link]);

  const finish = async (r: CaptureResult) => {
    if (!session) return;
    setPhase('reading');
    let res = fromCapture(r, 'enrollment', 'sandbox');
    // The server's verdict has the duplicate search; prefer it when it is ready.
    for (let i = 0; i < 6; i++) {
      try {
        const d = (await publicShareApi.result(id, session.session_id)).result;
        if (d.verdict?.decision) { res = fromDetails(d, 'sandbox'); break; }
      } catch { /* keep the capture's own verdict */ }
      await new Promise((ok) => setTimeout(ok, 1500));
    }
    onDone({ result: res, at: new Date().toISOString(), name });
  };

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Try it yourself">
      <div className="modal" style={phase === 'capture' ? { width: 'min(480px, 100%)' } : undefined}>
        <div className="mh">
          <div className="row"><span className="pill sandbox">Sandbox</span><b style={{ fontFamily: 'var(--f-display)', fontWeight: 600 }}>{step === 2 ? `Step 2 · Be someone else` : `Step 1 · Open an account at ${brand.name}`}</b></div>
          <button className="btn ghost sm" onClick={() => onDone(null)} aria-label="Close"><IcX width={16} height={16} /></button>
        </div>
        <div className="mb">
          {phase === 'pick' && (
            <>
              <p><b>Use your phone for the face check.</b> Phones have better cameras, and it’s how your customers will do it.</p>
              <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button className="btn" onClick={start}>Use this computer instead</button>
                <button className="btn pri" onClick={() => setPhase('qr')}><IcPhone width={16} /> Use my phone</button>
              </div>
            </>
          )}
          {phase === 'qr' && (
            <>
              <div className="qr-box">{qr && <img src={qr} alt="QR code to open this demo on your phone" />}</div>
              <p className="small muted" style={{ textAlign: 'center' }}>Scan with your phone’s camera. The page opens on your phone with the face check ready.</p>
              <div className="row" style={{ justifyContent: 'center' }}><button className="btn sm" onClick={start}>Use this computer instead</button></div>
            </>
          )}
          {phase === 'starting' && <div className="empty-panel">Starting the face check…</div>}
          {phase === 'capture' && session && (
            <>
              <p className="small muted" style={{ margin: 0 }}>{step === 2 ? <>New name: <b>{name}</b>. Same face. This is how one person opens many accounts.</> : <>You’re <b>{name}</b> for this demo. Any name works.</>}</p>
              <div className="engine-host">
                <VerificationCaptureEngine
                  sessionData={session}
                  environment={session.environment ?? 'sandbox'}
                  apiBaseUrl="https://api.usesense.ai/v1"
                  primaryColor={brand.color}
                  logoUrl={brand.logo ?? undefined}
                  displayName={brand.name}
                  appearance={appearanceOf(brand)}
                  sessionType="enrollment"
                  showResultScreen={false}
                  onComplete={finish}
                  onError={(msg) => onDone(null, typeof msg === 'string' ? msg : 'The capture stopped. Check the camera is allowed for this site, then try again.')}
                  onCancel={() => onDone(null)}
                />
              </div>
            </>
          )}
          {phase === 'reading' && <div className="empty-panel">Reading the decision from Sense…</div>}
          <p className="tiny faint" style={{ margin: 0 }}>Your face check is kept in the Sense demo sandbox for this demo only and is never shared with {brand.coBranded ? brand.name : 'anyone else'}.</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- the page ---------- */

function ProspectInner({ id, share }: { id: string; share: PublicShare }) {
  const demo = useDemo();
  const { brand, market, industry } = demo;
  const [params] = useSearchParams();
  const [tries, setTries] = useState<Attempt[]>(() => loadTries(id));
  const [open, setOpen] = useState<0 | 1 | 2>(() => (location.hash === '#try' ? (loadTries(id).length ? 2 : 1) : 0));
  const [tryErr, setTryErr] = useState('');
  const [checksLeft, setChecksLeft] = useState(share.checksLeft);
  const [role, setRole] = useState<Role>(() => (ROLES.some((r) => r.id === params.get('tab')) ? params.get('tab') as Role : 'fraud'));
  const [shareRole, setShareRole] = useState<Role>('fraud');
  const [copied, setCopied] = useState(false);
  const watched = useRef(false);
  const ctx = useMemo(() => makeContext(market, industry, brand), [market, industry, brand]);
  const first = tries[0];
  const second = tries[1];
  const name = brand.coBranded ? brand.name : 'XYZ Bank';
  const people = market.people;

  useEffect(() => { beacon(share.sr, 'page_view', 'xyz-share'); }, [share.sr]);
  useEffect(() => { if (params.get('tab')) document.getElementById('team')?.scrollIntoView(); }, [params]);

  const cta = (label: string) => { void publicShareApi.event(id, label); beacon(share.sr, 'cta_click', `xyz-share:${label}`); };

  const done = useCallback((a: Attempt | null, err?: string) => {
    setOpen(0);
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    if (err) setTryErr(err);
    if (!a) return;
    setTryErr('');
    setTries((cur) => { const next = [...cur, a]; saveTries(id, next); return next; });
    setChecksLeft((n) => Math.max(0, n - 1));
  }, [id]);

  const nextStep: 1 | 2 = first ? 2 : 1;
  const nextName = nextStep === 1 ? people.genuine : tries.length % 2 === 1 ? people.alias : people.genuine;
  const dup = !!second && second.result.dedupe === 'fail';
  const shareLink = `${shareUrl(location.origin, id)}${shareRole !== 'fraud' ? `?tab=${shareRole}` : ''}`;
  const tookS = first?.result.tookMs ? Math.round(first.result.tookMs / 1000) : null;

  return (
    <div className="prospect2">
      <header className="p2-top">
        <span className="row" style={{ gap: 10 }}>
          {brand.coBranded && <span className="prospect-logo"><Logo brand={brand} /></span>}
          <span className="row small" style={{ gap: 6 }}>{brand.coBranded && <span className="faint">×</span>}<SenseMark size={20} /><b style={{ fontFamily: 'var(--f-display)' }}>Sense</b></span>
        </span>
        <a className="btn sm" href={`${SITE}/demo`} target="_blank" rel="noreferrer" onClick={() => cta('book')}>Book a follow-up</a>
      </header>

      <section className="p2-hero">
        <div className="stack" style={{ gap: 14 }}>
          <span className="eyebrow">Made for {name} by {share.from} at Sense</span>
          <h1>{name}, with Sense on top of your KYC</h1>
          <p className="lede">Your KYC checks the ID. Sense checks the person: a real person, the right person, only one account, and still them later.</p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {share.live && checksLeft > 0
              ? <button className="btn pri lg" onClick={() => { setTryErr(''); setOpen(nextStep); }}>{first ? 'Now try to fool it' : 'Try it on your face'} <span className="tiny" style={{ opacity: .7 }}>· 2 min</span></button>
              : null}
            <a className="btn lg" href="#attacks">Watch the attacks</a>
          </div>
          <ol className="p2-inside small muted"><li><a href="#try">Try it yourself</a></li><li><a href="#attacks">The {share.page.scenarios.length} parts we showed you</a></li><li><a href="#team">What it means for your team</a></li></ol>
        </div>
        <div className="p2-phone" aria-hidden><Phone dark brand={brand}><BankScreen screen={{ kind: 'welcome' }} ctx={{ brand, market, industry }} stepKey="hero" /></Phone></div>
      </section>

      <section className="p2-sec" id="try">
        <span className="eyebrow">1 · Try it yourself</span>
        <h2>Open an account. Then try to fool it.</h2>
        <div className="p2-steps">
          <div className={`p2-step${first ? ' done' : ' now'}`}>
            <span className="n">1</span>
            <div className="grow"><b>Open an account</b><p className="small muted">A real Sense face check, in {name}’s look. This is what a good customer gets.</p></div>
            {first ? <DecisionPanel panel={livePanel(first.result, ctx, first.name, 'prospect')} decided feed={[]} scripted={false} /> : share.live && checksLeft > 0 && <button className="btn pri" onClick={() => { setTryErr(''); setOpen(1); }}>Start</button>}
          </div>
          <div className={`p2-step${second ? ' done' : first ? ' now' : ''}`}>
            <span className="n">2</span>
            <div className="grow"><b>Be someone else</b><p className="small muted">A new name, the same face. This is how one person opens many accounts.</p></div>
            {second ? <DecisionPanel panel={livePanel(second.result, ctx, second.name, 'prospect')} decided feed={[]} scripted={false} /> : first && share.live && checksLeft > 0 && <button className="btn pri" onClick={() => { setTryErr(''); setOpen(2); }}>Try to fool it</button>}
          </div>
        </div>
        {dup && <p className="p2-big">One person. One account. Sense stopped your second account because it was the same face.</p>}
        {first && !second && first.result.outcome === 'let' && <p className="small muted">Good customers get this: {tookS ? `${tookS} seconds, ` : ''}no retakes, no head turns.</p>}
        {first && first.result.dedupe === 'fail' && !second && <p className="small muted">Sense has seen this face before, from an earlier try, so even step one was stopped as a second account.</p>}
        {tryErr && <div className="notice" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}><span>{tryErr}</span><button className="btn sm" onClick={() => { setTryErr(''); setOpen(nextStep); }}>Try again</button></div>}
        <p className="tiny faint">{share.live
          ? checksLeft > 0 ? `${checksLeft} face check${checksLeft === 1 ? '' : 's'} left on this link, shared with anyone you send it to.` : `This link’s face checks are used up. Ask ${share.from} for another, or start free in the sandbox.`
          : 'Live face checks are paused right now. The replays below still work.'}</p>
      </section>

      <section className="p2-sec" id="attacks">
        <span className="eyebrow">2 · The attacks we showed you</span>
        <h2>Passed your KYC. Stopped by Sense.</h2>
        <p className="muted">Each one in three steps: what the fraudster does, what your KYC saw, and what Sense saw.</p>
        <StoryPlayer ids={share.page.scenarios} onStep={() => { if (!watched.current) { watched.current = true; } }} onEnd={() => { cta('watch'); document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' }); }} />
        <p className="tiny faint">Scripted replays with example people and numbers. {brand.coBranded ? `${name} is shown as an example; this is not their live app.` : 'XYZ Bank is fictional.'}</p>
      </section>

      <section className="p2-sec" id="team">
        <span className="eyebrow">3 · What it means for your team</span>
        <div className="p2-tabs" role="tablist" aria-label="Your team">
          {ROLES.map((r) => <button key={r.id} role="tab" aria-selected={role === r.id} onClick={() => { setRole(r.id); cta(`tab:${r.id}`); }}>{r.label}</button>)}
        </div>
        <RoleView role={role} name={name} first={first} tookS={tookS} onCta={cta} />
      </section>

      <section className="p2-sec p2-split">
        <div className="stack" style={{ gap: 10 }}>
          <h3>Send this to your team</h3>
          <p className="small muted">The same link, opening on their view. No sign-up for anyone.</p>
          <div className="wrap-row">{ROLES.map((r) => <button key={r.id} className={`chipbtn${shareRole === r.id ? ' on' : ''}`} onClick={() => setShareRole(r.id)}>{r.label}</button>)}</div>
          <div className="copyrow"><span className="mono small grow" style={{ userSelect: 'all' }}>{shareLink}</span><button className="btn sm" onClick={() => { navigator.clipboard?.writeText(shareLink).then(() => setCopied(true)).catch(() => {}); cta('share'); }}><IcCopy width={14} /> {copied ? 'Copied' : 'Copy'}</button></div>
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <h3>What next</h3>
          <a className="next-card" href={`${SITE}/demo`} target="_blank" rel="noreferrer" onClick={() => cta('book')}><b>Book a follow-up with {share.from}</b><span className="small muted">30 minutes, with your fraud and dev leads.</span><IcArrowRight width={16} /></a>
          <a className="next-card" href={`${SITE}/scan`} target="_blank" rel="noreferrer" onClick={() => cta('scan')}><b>Get a free fraud scan</b><span className="small muted">Send a customer file. Sense finds one face behind many accounts, with the evidence, then deletes everything.</span><IcArrowRight width={16} /></a>
          <a className="next-card" href={SIGNUP} target="_blank" rel="noreferrer" onClick={() => cta('sandbox')}><b>Start free in the sandbox</b><span className="small muted">100 free sandbox credits, no card.</span><IcArrowRight width={16} /></a>
        </div>
      </section>

      <footer className="p2-foot tiny faint">This link works until {new Date(share.expiresAt).toLocaleDateString()}. Sense · usesense.ai</footer>
      {open !== 0 && <TryIt id={id} step={open} name={open === 1 ? people.genuine : nextName} onDone={done} />}
    </div>
  );
}

function RoleView({ role, name, first, tookS, onCta }: { role: Role; name: string; first?: Attempt; tookS: number | null; onCta: (l: string) => void }) {
  const views: Record<Role, { h: string; points: string[]; page: string; pageLabel: string }> = {
    fraud: { h: 'Your KYC passes them. Sense stops them.', points: ['“Passed your KYC, stopped by Sense” on every decision', 'Change rules the same day: describe, simulate, publish', 'Fake users stopped, in Reports'], page: '/teams/fraud-and-risk', pageLabel: 'Sense for fraud and risk teams' },
    compliance: { h: 'Why we approved someone, in one click', points: ['Evidence of verification: a PDF record for any decision', 'Four-eyes approvals where you need a second reviewer', 'An audit log of every change to every policy'], page: '/teams/compliance', pageLabel: 'Sense for compliance teams' },
    product: { h: 'Let good users through faster', points: ['Passive liveness: most people just look at the camera', 'Sensei keeps checks light for people who look safe', 'Your colours, logo and words on every capture screen'], page: '/solutions/sign-up-drop-off', pageLabel: 'Reduce sign-up drop-off' },
    developers: { h: 'Live this sprint. No sales call.', points: ['One SDK: web, iOS, Android, React Native and Flutter', 'Sandbox first, with free test credits and no card', 'Every decision signed with Ed25519, verifiable offline'], page: '/teams/developers', pageLabel: 'Sense for developers' },
    leadership: { h: 'Grow sign-ups. Not fraud.', points: ['Keep your KYC provider; Sense sits on top', 'Pay per check, with public prices and volume rates', 'Sensei as your fraud team until you hire one'], page: '/pricing', pageLabel: 'Pricing' },
  };
  const v = views[role];
  return (
    <div className="role-view">
      <div className="stack" style={{ gap: 10 }}>
        <h2>{v.h}</h2>
        <ul className="clean">{v.points.map((p) => <li key={p}>{p}</li>)}</ul>
        <a className="small" href={`${SITE}${v.page}`} target="_blank" rel="noreferrer">{v.pageLabel} on usesense.ai</a>
      </div>
      <div className="role-side">
        {role === 'compliance' && (first
          ? <div className="card stack" style={{ gap: 6 }}><b>The record for your test</b><span className="small muted">{first.name} · {new Date(first.at).toLocaleString()}</span><span className="small">Decision: <b>{first.result.outcome === 'let' ? 'Let through' : first.result.outcome === 'stop' ? 'Stopped' : 'In review'}</b></span><span className="mono tiny">{first.result.sessionId}</span><span className="tiny faint">In Watchtower, your team downloads this as an evidence of verification PDF.</span></div>
          : <p className="small muted">Try it yourself above and the record for your own check appears here.</p>)}
        {role === 'product' && <div className="card stack" style={{ gap: 6 }}><b>{tookS ? `Your check took ${tookS} seconds` : 'Try it to time it'}</b><span className="small muted">That is what {name}’s good customers would feel.</span></div>}
        {role === 'developers' && <div className="card stack" style={{ gap: 8 }}><pre className="code" style={{ margin: 0 }}>npm i @usesense/web-sdk</pre><a className="btn pri" href={SIGNUP} target="_blank" rel="noreferrer" onClick={() => onCta('sandbox')}>Start free in the sandbox</a></div>}
        {role === 'leadership' && <div className="card stack" style={{ gap: 6 }}><b>Pay per check, start free</b><span className="small muted">100 free sandbox credits, public list prices and volume rates from $0.05 per credit.</span></div>}
        {role === 'fraud' && <div className="card stack" style={{ gap: 6 }}><b>Find the fake users you already have</b><span className="small muted">A free fraud scan finds one face behind many accounts on your book.</span><a className="btn" href={`${SITE}/scan`} target="_blank" rel="noreferrer" onClick={() => onCta('scan')}>Get a free fraud scan</a></div>}
      </div>
    </div>
  );
}

export function ProspectPage() {
  const { id = '' } = useParams();
  const [share, setShare] = useState<PublicShare | null>(null);
  const [error, setError] = useState<{ title: string; body: string; ended?: boolean; from?: string } | null>(null);

  useEffect(() => {
    publicShareApi.get(id, { v: visitorId(), d: isPhone() ? 'phone' : 'desktop' }).then(setShare).catch((e) => {
      if (e instanceof WatchtowerError && e.status === 410) setError({ title: 'This demo link has ended', body: 'Links last 14 days.', ended: true, from: typeof e.body.from === 'string' ? e.body.from : undefined });
      else if (e instanceof WatchtowerError && e.status === 404) setError({ title: 'This demo isn’t available', body: 'This link is not valid. Check it was copied in full.' });
      else setError({ title: 'This demo isn’t available', body: 'Couldn’t open this demo. Try again in a moment.' });
    });
  }, [id]);

  if (error) {
    return (
      <div className="ended">
        <SenseMark size={32} />
        <h1>{error.title}</h1>
        <p className="muted">{error.body} {error.ended ? `Ask ${error.from ?? 'your Sense contact'} for a new one, or see how Sense works on the website.` : ''}</p>
        <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <a className="btn pri" href={`${SITE}/demo`}>{error.ended ? `Ask ${error.from ?? 'Sense'} for a new link` : 'Talk to Sense'}</a>
          <a className="btn" href={`${SITE}/platform`}>Take the platform tour</a>
        </div>
      </div>
    );
  }
  if (!share) return <div className="page faint">Loading…</div>;
  return (
    <DemoProvider storageKey={`xyz-share-settings-${id}`} initial={settingsFor(share.page)}>
      <ProspectInner id={id} share={share} />
    </DemoProvider>
  );
}
