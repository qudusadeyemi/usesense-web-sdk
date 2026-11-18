/* Booth mode: an event screen. The story plays on a loop, with a standing QR
   code to the try-it steps on the visitor's own phone. Public, like a
   prospect link; the booth link has its own, larger check allowance. */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Logo } from '../bank/Screens';
import { DemoProvider, useDemo } from '../lib/settings';
import { publicShareApi, settingsFor, shareUrl, type PublicShare } from '../lib/shares';
import { WatchtowerError } from '../lib/watchtower';
import { SenseMark } from './Panel';
import { StoryPlayer } from './StoryPlayer';

function BoothInner({ id, share }: { id: string; share: PublicShare }) {
  const { brand } = useDemo();
  const [qr, setQr] = useState('');
  useEffect(() => { QRCode.toDataURL(`${shareUrl(location.origin, id)}#try`, { margin: 1, width: 520, errorCorrectionLevel: 'M' }).then(setQr); }, [id]);
  return (
    <div className="booth">
      <header className="pr-top">
        <span className="pr-brand">{brand.coBranded && <><Logo brand={brand} light /><span className="x">×</span></>}<SenseMark size={22} /><b>Sense</b></span>
        <span className="small" style={{ color: '#a9a398' }}>The fraud layer on top of any KYC</span>
      </header>
      <main className="booth-main">
        <StoryPlayer ids={share.page.scenarios} autoplay />
        <aside className="booth-qr">
          {qr && <img src={qr} alt="QR code to try it on your phone" />}
          <b>Try to fool it on your phone</b>
          <span className="small">Open an account, then try again as someone else. Sense should stop you.</span>
          {share.checksLeft <= 0 && <span className="small" style={{ color: '#ffc670' }}>Face checks for this screen are used up. The replays keep playing.</span>}
        </aside>
      </main>
    </div>
  );
}

export function BoothPage() {
  const { id = '' } = useParams();
  const [share, setShare] = useState<PublicShare | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { publicShareApi.get(id).then(setShare).catch((e) => setErr(e instanceof WatchtowerError ? e.message : 'Couldn’t open this screen.')); }, [id]);
  if (err) return <div className="ended"><SenseMark size={32} /><h1>This booth screen isn’t available</h1><p className="muted">{err}</p></div>;
  if (!share) return <div className="page faint">Loading…</div>;
  return <DemoProvider storageKey={`xyz-booth-settings-${id}`} initial={settingsFor(share.page)}><BoothInner id={id} share={share} /></DemoProvider>;
}
