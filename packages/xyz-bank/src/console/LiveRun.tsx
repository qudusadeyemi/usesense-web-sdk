import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { VerificationCaptureEngine, type CaptureResult, type CaptureSessionData } from '@usesense/web-sdk';
import { IcInfo, IcPhone, IcX } from '../bank/icons';
import { appearanceOf, useDemo } from '../lib/settings';
import {
  LiveError, createSession, envFor, fromCapture, fromDetails, getSession, getSessionStatus, loadIdentity, packHandoff, saveIdentity,
  type LiveResult,
} from '../lib/live';
import type { LiveKind } from '../scenarios/types';

type Phase = 'intro' | 'creating' | 'capture' | 'qr' | 'waiting' | 'error';

export interface LiveRunProps {
  kind: LiveKind;
  title: string;
  /** Hand the check to another phone with a QR code. */
  handoff?: boolean;
  onResult: (r: LiveResult, name: string) => void;
  onClose: () => void;
}

export function LiveRun({ kind, title, handoff, onResult, onClose }: LiveRunProps) {
  const { settings, activeKey, brand, market } = useDemo();
  const env = envFor(settings.liveMode);
  const identity = loadIdentity(env);
  const [phase, setPhase] = useState<Phase>('intro');
  const [error, setError] = useState('');
  const [session, setSession] = useState<CaptureSessionData | null>(null);
  const [qr, setQr] = useState('');
  const [link, setLink] = useState('');
  const started = useRef(0);
  const poll = useRef<number | null>(null);
  const useQr = handoff || kind === 'agent';

  // What this live run actually does.
  const plan = (() => {
    if (kind === 'auth') return identity
      ? { type: 'authentication' as const, name: identity.name, idn: identity.identityId, explain: 'A returning-customer check against the face from your live sign-up.' }
      : null;
    if (kind === 'duplicate') return identity
      ? { type: 'enrollment' as const, name: market.people.alias, idn: undefined, explain: `A new sign-up under the name ${market.people.alias}. It is still your face, so Sense should stop it as a duplicate.` }
      : { type: 'enrollment' as const, name: market.people.genuine, idn: undefined, explain: 'First run: sign up as yourself. Then run it again under a new name to see the duplicate stopped.' };
    if (kind === 'screen') return { type: 'enrollment' as const, name: market.people.victim, idn: undefined, explain: 'Hold a photo of a person on another phone up to the camera. Sense should stop it.' };
    // enroll and agent: genuine path. If this browser already signed up in this org, a returning-customer check avoids a duplicate.
    if (identity && !useQr) return { type: 'authentication' as const, name: identity.name, idn: identity.identityId, explain: 'You already signed up in this org from this browser, so this runs as a returning-customer check. A second sign-up would be stopped as a duplicate, which is the next demo.' };
    return { type: 'enrollment' as const, name: useQr ? market.people.genuine : market.people.genuine, idn: undefined, explain: useQr ? 'The prospect scans the QR code and takes the face check on their own phone. The result appears here.' : 'Take the face check yourself, like a new customer would.' };
  })();

  useEffect(() => () => { if (poll.current) window.clearInterval(poll.current); }, []);

  const finishFromCapture = useCallback((r: CaptureResult) => {
    if (!plan) return;
    const res = fromCapture(r, plan.type, env, Date.now() - started.current);
    if (res.outcome === 'let' && plan.type === 'enrollment' && res.identityId && kind !== 'screen') {
      saveIdentity({ identityId: res.identityId, env, at: new Date().toISOString(), name: plan.name });
    }
    onResult(res, plan.name);
  }, [plan, env, kind, onResult]);

  const start = useCallback(async () => {
    if (!plan || !activeKey) return;
    setPhase('creating');
    setError('');
    try {
      started.current = Date.now();
      const s = await createSession(activeKey, settings.apiBaseUrl, env, {
        type: plan.type,
        externalUserId: `xyz-demo-${plan.name.toLowerCase().replace(/[^a-z]+/g, '-')}-${Date.now().toString(36)}`,
        identityId: plan.idn,
        metadata: { scenario: title, prospect: settings.prospect || null, demo_kind: kind },
      });
      setSession(s);
      if (useQr) {
        const url = `${location.origin}/xyz/phone#h=${await packHandoff(s, settings.apiBaseUrl, { name: brand.name, color: brand.color, appearance: appearanceOf(brand, { inlineAssets: false }) })}`;
        setLink(url);
        setQr(await QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: 'L' }));
        setPhase('qr');
        poll.current = window.setInterval(async () => {
          const st = await getSessionStatus(settings.apiBaseUrl, s.session_id);
          if (st === 'completed' || st === 'failed' || st === 'expired') {
            if (poll.current) window.clearInterval(poll.current);
            setPhase('waiting');
            try {
              const d = await getSession(activeKey, settings.apiBaseUrl, env, s.session_id);
              const res = fromDetails(d, env);
              res.tookMs = Date.now() - started.current;
              onResult(res, plan.name);
            } catch (e) {
              setError((e as Error).message);
              setPhase('error');
            }
          }
        }, 2000);
      } else {
        setPhase('capture');
      }
    } catch (e) {
      setError(e instanceof LiveError ? e.message : 'Couldn’t start the live check. Try again.');
      setPhase('error');
    }
  }, [plan, activeKey, settings.apiBaseUrl, settings.prospect, env, title, kind, useQr, brand, onResult]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); } catch { /* ignore */ }
  };

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label={`Live: ${title}`} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="modal" style={phase === 'capture' ? { width: 'min(480px, 100%)' } : undefined}>
        <div className="mh">
          <div className="row"><span className={`pill ${settings.liveMode === 'live' ? 'live' : 'sandbox'}`}>{settings.liveMode === 'live' ? 'Live · real credits' : 'Sandbox'}</span><b style={{ fontFamily: 'var(--f-display)', fontWeight: 600 }}>{title}</b></div>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close"><IcX width={16} height={16} /></button>
        </div>
        <div className="mb">
          {!activeKey && (
            <div className="notice"><IcInfo /><span>Live checks are off or no key is set. Paste a sandbox key on the Set up page.</span></div>
          )}
          {activeKey && !plan && (
            <div className="notice"><IcInfo /><span>This check confirms a returning customer, so it needs a face to compare with. Run a live sign-up first (for example Good customers, fast), then come back.</span></div>
          )}
          {activeKey && plan && phase === 'intro' && (
            <>
              <p>{plan.explain}</p>
              {settings.liveMode === 'live' && <div className="banner-live">Production key: this spends real credits and writes a real decision.</div>}
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button className="btn" onClick={onClose}>Cancel</button>
                <button className="btn blue" onClick={start} autoFocus>{useQr ? <><IcPhone width={16} /> Show the QR code</> : 'Start the face check'}</button>
              </div>
            </>
          )}
          {phase === 'creating' && <div className="empty-panel"><span className="spinner" style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--line2)', borderTopColor: 'var(--ink)', animation: 'spin .8s linear infinite' }} />Starting a {env} session…</div>}
          {phase === 'capture' && session && (
            <div className="engine-host">
              <VerificationCaptureEngine
                sessionData={session}
                environment={session.environment ?? env}
                apiBaseUrl={`${settings.apiBaseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')}/v1`}
                primaryColor={brand.color}
                logoUrl={brand.logo ?? undefined}
                displayName={brand.name}
                appearance={appearanceOf(brand)}
                sessionType={plan?.type}
                showResultScreen={false}
                onComplete={finishFromCapture}
                onError={(msg) => { setError(typeof msg === 'string' ? msg : 'The capture stopped.'); setPhase('error'); }}
                onCancel={onClose}
              />
            </div>
          )}
          {phase === 'qr' && (
            <>
              <div className="qr-box">{qr && <img src={qr} alt="QR code for the face check" />}</div>
              <p className="small muted" style={{ textAlign: 'center' }}>Scan with a phone camera. The link holds this one check only, never your API key. It expires with the session.</p>
              <div className="row" style={{ justifyContent: 'center' }}><span className="spinner" style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--line2)', borderTopColor: 'var(--ink)', animation: 'spin .8s linear infinite' }} /><span className="small">Waiting for the phone…</span><button className="btn sm" onClick={copy}>Copy link</button></div>
            </>
          )}
          {phase === 'waiting' && <div className="empty-panel">Reading the decision from Sense…</div>}
          {phase === 'error' && (
            <>
              <div className="notice" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}><IcInfo /><span>{error}</span></div>
              <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Close</button><button className="btn pri" onClick={() => setPhase('intro')}>Try again</button></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
