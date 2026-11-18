/* Opened from the QR code on the rep's stage. Runs one face check with the
   per-session token in the link (never an API key); the result shows on the
   rep's screen. */
import { useEffect, useState } from 'react';
import { VerificationCaptureEngine } from '@usesense/web-sdk';
import { deepOf } from '../bank/Screens';
import { unpackHandoff, type Handoff } from '../lib/live';

export function PhonePage() {
  const [data, setData] = useState<Handoff | null | undefined>(undefined);
  const [state, setState] = useState<'run' | 'done' | 'error'>('run');
  useEffect(() => { unpackHandoff(location.hash.replace(/^#h=/, '')).then(setData); }, []);
  const [msg, setMsg] = useState('');

  const shell = (title: string, body: string) => (
    <div className="phone-page" style={{ background: deepOf(data?.c ?? '#0F5C4A'), color: '#fff', fontFamily: 'var(--f-app)', display: 'grid', placeContent: 'center', textAlign: 'center', padding: 28, gap: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: '-.03em' }}>{title}</div>
      <p style={{ opacity: .75, maxWidth: 300, margin: '0 auto' }}>{body}</p>
    </div>
  );

  if (data === undefined) return shell('One moment', 'Opening the face check…');
  if (!data) return shell('This link has expired', 'Ask for a new QR code on the demo screen.');
  if (state === 'done') return shell('Done. Look at the big screen.', `${data.n} has your result. You can close this page.`);
  if (state === 'error') return shell('That didn’t work', msg || 'Ask for a new QR code and try again.');

  const base = data.b.replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1';
  return (
    <div className="phone-page">
      <VerificationCaptureEngine
        sessionData={data.s}
        environment={data.s.environment}
        apiBaseUrl={base}
        primaryColor={data.c}
        displayName={data.n}
        appearance={data.a}
        showResultScreen={false}
        onComplete={() => setState('done')}
        onError={(e) => { setMsg(typeof e === 'string' ? e : ''); setState('error'); }}
        onCancel={() => setState('done')}
      />
    </div>
  );
}
