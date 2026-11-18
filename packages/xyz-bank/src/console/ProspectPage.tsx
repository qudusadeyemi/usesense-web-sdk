/* The prospect's own link: try.usesense.ai/xyz/p/:id. No sign-in, no keys.
   The scenarios the rep showed, in the prospect's brand, plus a real face
   check on their own device: first open an account, then try a second
   account under a new name, the way a fraudster would, and get stopped.
   Checks run in the Sense Demo sandbox org; Watchtower starts them. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { VerificationCaptureEngine, type CaptureResult, type CaptureSessionData } from '@usesense/web-sdk';
import { beacon } from '../lib/beacon';
import { fromCapture, fromDetails, type LiveResult } from '../lib/live';
import { appearanceOf, DemoProvider, useDemo } from '../lib/settings';
import { publicShareApi, settingsFor, shareUrl, type PublicShare } from '../lib/shares';
import { WatchtowerError } from '../lib/watchtower';
import { makeContext } from '../scenarios';
import { Logo } from '../bank/Screens';
import { IcPhone, IcX } from '../bank/icons';
import { DecisionPanel, SenseMark, livePanel } from './Panel';
import { Stage } from './Stage';

type Attempt = { result: LiveResult; at: string };
const triedKey = (id: string) => `xyz-share-tries-${id}`;
function loadTries(id: string): Attempt[] {
  try { return JSON.parse(localStorage.getItem(triedKey(id)) || '[]') as Attempt[]; } catch { return []; }
}
function saveTries(id: string, a: Attempt[]) {
  try { localStorage.setItem(triedKey(id), JSON.stringify(a.slice(-5))); } catch { /* private window: still works this visit */ }
}
const isPhone = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 700);
const NAMES = ['Alex Morgan', 'Sam Okafor'];

function TryIt({ id, share, onDone, tries }: { id: string; share: PublicShare; onDone: (a: Attempt | null) => void; tries: Attempt[] }) {
  const { brand } = useDemo();
  const [phase, setPhase] = useState<'pick' | 'qr' | 'starting' | 'capture' | 'reading' | 'error'>(isPhone() ? 'starting' : 'pick');
  const [session, setSession] = useState<CaptureSessionData | null>(null);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const second = tries.length > 0;
  const name = NAMES[Math.min(tries.length, 1)];
  const link = `${shareUrl(location.origin, id)}#try`;

  const start = useCallback(async () => {
    setPhase('starting');
    setError('');
    try {
      const r = await publicShareApi.startCheck(id);
      setSession(r.session);
      setPhase('capture');
      beacon(share.sr, 'cta_click', `xyz-share:check-${r.attempt}`);
    } catch (e) {
      setError(e instanceof WatchtowerError ? e.message : 'Couldn’t start the face check. Try again.');
      setPhase('error');
    }
  }, [id, share.sr]);

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
    onDone({ result: res, at: new Date().toISOString() });
  };

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Try it yourself">
      <div className="modal" style={phase === 'capture' ? { width: 'min(480px, 100%)' } : undefined}>
        <div className="mh">
          <div className="row"><span className="pill sandbox">Sandbox</span><b style={{ fontFamily: 'var(--f-display)', fontWeight: 600 }}>{second ? `A second account, as ${name}` : `Open an account at ${brand.name}`}</b></div>
          <button className="btn ghost sm" onClick={() => onDone(null)} aria-label="Close"><IcX width={16} height={16} /></button>
        </div>
        <div className="mb">
          {phase === 'pick' && (
            <>
              <p>{second
                ? `Now be the fraudster: a new name, a new email, the same face. ${brand.name} has never seen “${name}”. Sense has seen the face.`
                : `A real face check, like your customers would take. It takes about ten seconds. It runs in the Sense demo sandbox, not in a real app.`}</p>
              <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => setPhase('qr')}><IcPhone width={16} /> Use my phone</button>
                <button className="btn pri" onClick={start}>Use this computer’s camera</button>
              </div>
            </>
          )}
          {phase === 'qr' && (
            <>
              <div className="qr-box">{qr && <img src={qr} alt="QR code to open this demo on your phone" />}</div>
              <p className="small muted" style={{ textAlign: 'center' }}>Scan with your phone’s camera. The check runs and shows its result on your phone.</p>
              <div className="row" style={{ justifyContent: 'center' }}><button className="btn sm" onClick={() => setPhase('pick')}>Back</button></div>
            </>
          )}
          {phase === 'starting' && <div className="empty-panel">Starting the face check…</div>}
          {phase === 'capture' && session && (
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
                onError={(msg) => { setError(typeof msg === 'string' ? msg : 'The capture stopped.'); setPhase('error'); }}
                onCancel={() => onDone(null)}
              />
            </div>
          )}
          {phase === 'reading' && <div className="empty-panel">Reading the decision from Sense…</div>}
          {phase === 'error' && (
            <>
              <div className="notice" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}><span>{error}</span></div>
              <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={() => onDone(null)}>Close</button><button className="btn pri" onClick={start}>Try again</button></div>
            </>
          )}
          <p className="tiny faint" style={{ margin: 0 }}>Your face check is stored in the Sense demo sandbox for this demo only and is never shared with {brand.coBranded ? brand.name : 'anyone else'}.</p>
        </div>
      </div>
    </div>
  );
}

function ProspectInner({ id, share }: { id: string; share: PublicShare }) {
  const demo = useDemo();
  const { brand } = demo;
  const [tries, setTries] = useState<Attempt[]>(() => loadTries(id));
  const [open, setOpen] = useState(() => location.hash === '#try');
  const [checksLeft, setChecksLeft] = useState(share.checksLeft);
  const ctx = useMemo(() => makeContext(demo.market, demo.industry, brand), [demo.market, demo.industry, brand]);
  const last = tries[tries.length - 1];

  useEffect(() => { beacon(share.sr, 'page_view', 'xyz-share'); }, [share.sr]);

  const done = (a: Attempt | null) => {
    setOpen(false);
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    if (!a) return;
    const next = [...tries, a];
    setTries(next);
    saveTries(id, next);
    setChecksLeft((n) => Math.max(0, n - 1));
  };

  const second = tries.length > 0;
  const stoppedAsDuplicate = !!last && tries.length > 1 && last.result.dedupe === 'fail';

  return (
    <div className="replay prospect">
      <header>
        <div className="row" style={{ gap: 12 }}>
          {brand.coBranded ? <span className="prospect-logo"><Logo brand={brand} /></span> : null}
          <span className="row faint small" style={{ gap: 6 }}>{brand.coBranded ? '×' : ''} <SenseMark /><b style={{ fontFamily: 'var(--f-display)', fontWeight: 600, color: 'var(--ink)' }}>Sense</b></span>
        </div>
        <div className="row">
          <a className="btn sm" href="https://usesense.ai/demo" target="_blank" rel="noreferrer" onClick={() => beacon(share.sr, 'cta_click', 'xyz-share:book')}>Talk to us</a>
          <a className="btn pri sm" href="https://usesense.ai/scan" target="_blank" rel="noreferrer" onClick={() => beacon(share.sr, 'cta_click', 'xyz-share:scan')}>Get a free fraud scan</a>
        </div>
      </header>

      <section className="try-hero">
        <div className="try-copy">
          <span className="eyebrow">Made for {brand.coBranded ? brand.name : 'you'} by {share.from}</span>
          <h1>{brand.coBranded ? `${brand.name}, with Sense on top of your KYC.` : 'The fraud layer on top of any KYC.'}</h1>
          <p className="muted">Watch the attacks we showed you, then try it on your own face. Sense answers four questions on every customer: a real person, the right person, only one account, and still them later.</p>
          {share.live && checksLeft > 0 ? (
            <div className="try-steps">
              <div className={`try-step${tries.length > 0 ? ' done' : ' now'}`}><i>1</i><span><b>Open an account</b><span className="small muted">A real face check, in {brand.name}’s look.</span></span></div>
              <div className={`try-step${tries.length > 1 ? ' done' : tries.length === 1 ? ' now' : ''}`}><i>2</i><span><b>Now try it as a fraudster</b><span className="small muted">A second account, a new name, the same face.</span></span></div>
              <button className="btn pri" onClick={() => setOpen(true)}>{!second ? 'Try it yourself' : tries.length === 1 ? 'Open a second account' : 'Try again'}</button>
              <span className="tiny faint">{checksLeft} face check{checksLeft === 1 ? '' : 's'} left on this link.</span>
            </div>
          ) : (
            <p className="small faint">{share.live ? 'This link has used its face checks. Ask your Sense contact for another.' : 'Live face checks are paused right now. The replays below still work.'}</p>
          )}
        </div>
        {last && (
          <div className="try-result">
            {stoppedAsDuplicate && <div className="banner-live" style={{ background: 'var(--teal-soft)', color: 'var(--ink)' }}>New name, same face: Sense stopped the second account. That is the “only one?” question, answered on your own face.</div>}
            <DecisionPanel panel={livePanel(last.result, ctx, NAMES[Math.min(tries.length - 1, 1)], 'prospect')} decided feed={[]} scripted={false} />
          </div>
        )}
      </section>

      {share.page.scenarios.length > 0 && <h2 className="try-h2">The attacks we showed you</h2>}
      <Stage publicMode scenarioIds={share.page.scenarios} />
      <p className="tiny faint" style={{ padding: '0 28px 28px' }}>Scripted replays with example people and numbers. {brand.coBranded ? `${brand.name} is shown as an example; this is not their live app.` : 'XYZ Bank is fictional.'} This link works until {new Date(share.expiresAt).toLocaleDateString()}.</p>
      {open && <TryIt id={id} share={{ ...share, checksLeft }} tries={tries} onDone={done} />}
    </div>
  );
}

export function ProspectPage() {
  const { id = '' } = useParams();
  const [share, setShare] = useState<PublicShare | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    publicShareApi.get(id).then(setShare).catch((e) => setError(e instanceof WatchtowerError && e.status === 410 ? e.message : e instanceof WatchtowerError && e.status === 404 ? 'This link is not valid. Check it was copied in full.' : 'Couldn’t open this demo. Try again in a moment.'));
  }, [id]);

  if (error) return <div className="page" style={{ maxWidth: 560, margin: '10vh auto', textAlign: 'center' }}><SenseMark /><h1 style={{ marginTop: 12 }}>This demo isn’t available</h1><p className="muted">{error}</p></div>;
  if (!share) return <div className="page faint">Loading…</div>;
  return (
    <DemoProvider storageKey={`xyz-share-settings-${id}`} initial={settingsFor(share.page)}>
      <ProspectInner id={id} share={share} />
    </DemoProvider>
  );
}
