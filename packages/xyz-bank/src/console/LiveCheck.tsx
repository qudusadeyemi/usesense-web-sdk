/* "Now you try" while presenting: a real Sense face check, on the prospect's
   phone (QR) or the rep's camera. Step one opens an account; step two tries
   again under a new name with the same face, which Sense should stop. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import type { CaptureResult, CaptureSessionData } from '@usesense/web-sdk';
import { fromCapture, getSessionStatus, LiveError, packHandoff, type LiveResult } from '../lib/live';
import { appearanceOf, useDemo } from '../lib/settings';
import { liveTarget, myFace, readCheck, rememberMyFace, startCheck } from '../lib/staffLive';
import type { WatchtowerError } from '../lib/watchtower';
import { PhoneCapture, PhoneWait } from './PhoneCapture';

export type TryStep = 'first' | 'fool';

function message(e: unknown): string {
  const w = e as WatchtowerError & LiveError;
  if (w?.code === 'live_off') return 'Live checks are switched off on the server. Use the recorded run.';
  if (w?.code === 'rate_limited') return w.message;
  if (w?.code === 'signed_out' || w?.status === 401) return 'Your sign-in expired. Sign in again, then try.';
  if (w?.status === 403) return 'Live checks are for Sense staff accounts.';
  return w?.message || 'Couldn’t start the face check. Try again.';
}

export function LiveCheck({ step, who, label, dials, onResult, onFail }: {
  step: TryStep;
  who: 'them' | 'me';
  label: string;
  /** Attack lab dials (lib/lab.ts), scored by Watchtower on the Sense Demo key. */
  dials?: Record<string, string>;
  onResult: (r: LiveResult, name: string) => void;
  onFail: (msg: string) => void;
}) {
  const { settings, brand, market } = useDemo();
  const target = liveTarget(settings);
  const scope = useParams<{ id: string }>().id;
  const [session, setSession] = useState<CaptureSessionData | null>(null);
  const [qr, setQr] = useState('');
  const [link, setLink] = useState('');
  const [waiting, setWaiting] = useState(false);
  const poll = useRef<number | null>(null);
  const started = useRef(0);
  const ran = useRef(false);

  // On the rep's own camera, a face Sense already knows checks in as a returning customer.
  const mine = who === 'me' ? myFace(target, scope) : null;
  const plan = step === 'fool'
    ? { type: 'enrollment' as const, name: market.people.alias, identityId: undefined }
    : mine
      ? { type: 'authentication' as const, name: mine.name, identityId: mine.identityId }
      : { type: 'enrollment' as const, name: market.people.genuine, identityId: undefined };

  const finish = useCallback(async (sessionId: string, fallback?: CaptureResult) => {
    setWaiting(true);
    let r: LiveResult;
    try {
      r = await readCheck(target, sessionId);
    } catch {
      if (!fallback) { onFail('Couldn’t read the result. Open it in Watchtower.'); return; }
      r = fromCapture(fallback, plan.type, target.env);
    }
    r.tookMs = Date.now() - started.current;
    if (who === 'me' && plan.type === 'enrollment' && step === 'first' && r.outcome === 'let' && r.identityId && !dials) rememberMyFace(target, r.identityId, plan.name, scope);
    onResult(r, plan.name);
  }, [target, plan.type, plan.name, who, step, onResult, onFail, scope]);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        started.current = Date.now();
        const s = await startCheck(target, { type: plan.type, identityId: plan.identityId, label, prospect: settings.prospect, name: plan.name, scope, dials, logo: who === 'them' ? brand.logo : null });
        setSession(s);
        if (who === 'them') {
          const appearance = appearanceOf(brand, { inlineAssets: false });
          // An uploaded logo doesn't fit the QR link: on the demo key the phone fetches it from Watchtower.
          const fetchLogo = !!brand.logo && !appearance.logo && target.via === 'demo';
          const url = `${location.origin}/xyz/phone#h=${await packHandoff(s, target.base, { name: brand.name, color: brand.color, appearance, fetchLogo })}`;
          setLink(url);
          setQr(await QRCode.toDataURL(url, { margin: 1, width: 520, errorCorrectionLevel: 'L' }));
          poll.current = window.setInterval(async () => {
            const st = await getSessionStatus(target.base, s.session_id, s.session_token);
            if (st === 'completed' || st === 'failed' || st === 'expired') {
              if (poll.current) window.clearInterval(poll.current);
              finish(s.session_id);
            }
          }, 2000);
        }
      } catch (e) {
        onFail(message(e));
      }
    })();
    return () => { if (poll.current) window.clearInterval(poll.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On this camera the check runs in the phone frame, so the waits keep that shape too.
  if (waiting) return who === 'me' ? <PhoneWait brand={brand} text="Reading the decision from Sense…" /> : <div className="try-wait"><span className="spinner" />Reading the decision from Sense…</div>;
  if (!session) return who === 'me' ? <PhoneWait brand={brand} text="Starting a real face check…" /> : <div className="try-wait"><span className="spinner" />Starting a real face check…</div>;

  if (who === 'them') {
    return (
      <div className="try-qr">
        {qr && <img src={qr} alt="QR code that opens the face check on a phone" />}
        <div className="stack">
          <b>Scan with your phone camera</b>
          <span className="muted small">{step === 'fool'
            ? <>Now be someone else: the name is <b>{plan.name}</b>. Same face.</>
            : <>You’ll open an account at {brand.name} as <b>{plan.name}</b>. Any face works; it stays in the Sense demo sandbox.</>}</span>
          <span className="row small muted"><span className="spinner" /> Waiting for the phone…</span>
          <button className="btn sm ghost" onClick={() => { navigator.clipboard?.writeText(link).catch(() => {}); }}>Copy the link instead</button>
        </div>
      </div>
    );
  }

  return (
    <PhoneCapture
      brand={brand}
      handoff={{ s: session, b: target.base, n: brand.name, c: brand.color, a: appearanceOf(brand), t: plan.type }}
      onDone={(m) => finish(session.session_id, m.result)}
      onFail={(m) => onFail(m || 'The capture stopped.')}
      onCancel={() => onFail('Cancelled.')}
    />
  );
}
