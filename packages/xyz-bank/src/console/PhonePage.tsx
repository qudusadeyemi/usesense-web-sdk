/* The phone page. Two ways in:
   - QR: opened on the prospect's phone with the session packed in the link
     (per-session token, never an API key); the result shows on the rep's
     screen.
   - Embedded (?embed=1): inside the phone frame on a laptop page
     (PhoneCapture). Running in its own phone-sized window is what makes the
     SDK lay out as on a phone: its sizes and breakpoints read the window
     (min-height: 100vh, max-width: 640px, vw), so dropped straight into a
     laptop page it took the laptop's height and desktop layout. The laptop
     page sends the handoff by message (no URL size limit, so a full logo
     fits) and hears back when the capture is done, fails or is cancelled. */
import { useEffect, useState } from 'react';
import { FlowRunner, VerificationCaptureEngine, type CaptureResult } from '@usesense/web-sdk';
import { deepOf } from '../bank/Screens';
import { WATCHTOWER_API } from '../lib/auth';
import { unpackHandoff, type Handoff } from '../lib/live';

export const EMBED = typeof location !== 'undefined' && new URLSearchParams(location.search).get('embed') === '1';

export type CaptureMessage =
  | { type: 'xyz-capture-ready' }
  | { type: 'xyz-capture-init'; handoff: Handoff }
  | { type: 'xyz-capture-done'; result?: CaptureResult; flowRunId?: string }
  | { type: 'xyz-capture-error'; message: string }
  | { type: 'xyz-capture-cancel' };

const tell = (m: CaptureMessage) => { if (EMBED) window.parent.postMessage(m, location.origin); };

/* The demo's logo when the QR link had no room for it (Handoff.lg). A miss
   leaves the page unbranded rather than blocking the check. */
async function withLogo(h: Handoff | null): Promise<Handoff | null> {
  if (!h?.lg || h.a?.logo?.url || !h.s) return h;
  try {
    const res = await fetch(`${WATCHTOWER_API}/public/demo/logo/${encodeURIComponent(h.s.session_id)}`, { signal: AbortSignal.timeout(4000) });
    const body = res.ok ? await res.json() as { logo?: string } : null;
    if (!body?.logo) return h;
    return { ...h, a: { ...(h.a ?? {}), logo: { url: body.logo, placement: 'header' }, mode: 'light' } };
  } catch {
    return h;
  }
}

export function PhonePage() {
  const [data, setData] = useState<Handoff | null | undefined>(undefined);
  const [state, setState] = useState<'run' | 'done' | 'error'>('run');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!EMBED) { unpackHandoff(location.hash.replace(/^#h=/, '')).then(withLogo).then(setData); return; }
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      const m = e.data as CaptureMessage;
      if (m?.type === 'xyz-capture-init' && (m.handoff?.s || m.handoff?.f)) setData(m.handoff);
    };
    window.addEventListener('message', on);
    tell({ type: 'xyz-capture-ready' });
    return () => window.removeEventListener('message', on);
  }, []);

  const shell = (title: string, body: string) => (
    <div className="phone-page" style={{ background: deepOf(data?.c ?? '#0F5C4A'), color: '#fff', fontFamily: 'var(--f-app)', display: 'grid', placeContent: 'center', textAlign: 'center', padding: 28, gap: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: '-.03em' }}>{title}</div>
      <p style={{ opacity: .75, maxWidth: 300, margin: '0 auto' }}>{body}</p>
    </div>
  );

  if (data === undefined) return EMBED ? <div className="phone-page" /> : shell('One moment', 'Opening the face check…');
  if (!data) return shell('This link has expired', 'Ask for a new QR code on the demo screen.');
  if (state === 'done') return EMBED ? <div className="phone-page" /> : shell('Done. Look at the big screen.', `${data.n} has your result. You can close this page.`);
  if (state === 'error') return shell('That didn’t work', msg || 'Ask for a new QR code and try again.');

  const fail = (m: string) => { tell({ type: 'xyz-capture-error', message: m }); setMsg(m); setState('error'); };
  const cancel = () => { tell({ type: 'xyz-capture-cancel' }); setState('done'); };

  if (data.f) {
    return (
      <div className="phone-page">
        <FlowRunner
          options={{ flowRunId: data.f.flowRunId, sdkToken: data.f.sdkToken, apiBaseUrl: data.b, appearance: data.a, displayName: data.n }}
          onResult={(r) => { tell({ type: 'xyz-capture-done', flowRunId: r.flowRunId }); setState('done'); }}
          onError={(e) => (e.code === 'cancelled' ? cancel() : fail(e.message || 'The ID check stopped.'))}
        />
      </div>
    );
  }

  const base = data.b.replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1';
  return (
    <div className="phone-page">
      <VerificationCaptureEngine
        sessionData={data.s!}
        environment={data.s!.environment}
        apiBaseUrl={base}
        primaryColor={data.c}
        displayName={data.n}
        appearance={data.a}
        logoUrl={data.a?.logo?.url}
        {...(data.t ? { sessionType: data.t } : {})}
        showResultScreen={false}
        onComplete={(r) => { tell({ type: 'xyz-capture-done', result: r }); setState('done'); }}
        onError={(e) => fail(typeof e === 'string' ? e : 'The capture stopped.')}
        onCancel={cancel}
      />
    </div>
  );
}
