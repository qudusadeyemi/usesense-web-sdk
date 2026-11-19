/* One prospect: their brand, their story, and three buttons (Rehearse,
   Present, Send them the link). Below: what they did with the link, where
   live checks run, and booth mode. */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IcCopy, IcExternal, IcX } from '../bank/icons';
import { Logo } from '../bank/Screens';
import { checkKey, envFor, type KeyCheck } from '../lib/live';
import { deleteDemo, getDemo, QUICK_ID, saveDemo, settingsKey, type DemoRecord } from '../lib/demos';
import { INDUSTRIES, MARKETS, type IndustryId, type MarketId } from '../lib/presets';
import { DemoProvider, XYZ_GREEN, appearanceOf, useDemo, type Brand } from '../lib/settings';
import { boothUrl, describeEvent, pageFor, sharesApi, shareState, shareUrl, type ShareEvent, type ShareSummary } from '../lib/shares';
import { allScenarios, makeContext } from '../scenarios';
import { BrandImportSheet } from './BrandImport';
import { ago, TopBar } from './Home';
import { readLogoFile } from './NewDemo';
import { StoryEditor } from './StoryEditor';

export function DemoRoute() {
  const { id = '' } = useParams();
  const rec = getDemo(id);
  if (!rec) return <NotFound />;
  return <DemoProvider key={id} storageKey={settingsKey(id)}><DemoPage initial={rec} /></DemoProvider>;
}

function NotFound() {
  return (
    <div className="app"><TopBar /><main className="app-main narrow"><div className="card stack"><h2>That demo isn’t in this browser</h2><p className="muted">Demos are kept in the browser that made them.</p><Link className="btn pri" to="/">Your demos</Link></div></main></div>
  );
}

function DemoPage({ initial }: { initial: DemoRecord }) {
  const nav = useNavigate();
  const demo = useDemo();
  const [rec, setRec] = useState(initial);
  const [brandOpen, setBrandOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const ctx = useMemo(() => makeContext(demo.market, demo.industry, demo.brand), [demo.market, demo.industry, demo.brand]);
  const all = useMemo(() => allScenarios(ctx), [ctx]);
  const update = useCallback((patch: Partial<DemoRecord>) => setRec((r) => saveDemo({ ...r, ...patch })), []);
  const quick = rec.id === QUICK_ID;
  const name = demo.brand.coBranded ? demo.brand.name : 'XYZ Bank';

  return (
    <div className="app">
      <TopBar><Link className="btn ghost sm" to="/">Your demos</Link></TopBar>
      <main className="app-main">
        <div className="demo-head">
          <span className="dc-logo big"><Logo brand={demo.brand} /></span>
          <div className="grow">
            <h1>{name}</h1>
            <span className="muted">{demo.industry.label} · {demo.market.label}{quick ? ' · quick demo, no prospect' : ''}</span>
          </div>
          <button className="btn" onClick={() => setBrandOpen(true)}>Edit brand</button>
          <Link className="btn" to={`/d/${rec.id}/rehearse`}>Rehearse{rec.rehearsedAt ? ' ✓' : ''}</Link>
          <Link className="btn" to={`/d/${rec.id}/lab`}>Attack lab</Link>
          <Link className="btn blue lg" to={`/d/${rec.id}/present`}>Present</Link>
        </div>

        <div className="demo-grid">
          <section className="card stack" aria-labelledby="story-h">
            <div className="row"><h3 id="story-h" className="grow">The story</h3><span className="small muted">{rec.story.length} parts · about {rec.story.length * 3} minutes</span></div>
            <StoryEditor all={all} story={rec.story} extras={rec.extras} onChange={(story) => update({ story })} />
            <p className="tiny faint">Then: Now you try (a real face check), See it in Watchtower, and their link.</p>
          </section>

          <div className="stack" style={{ gap: 16 }}>
            {!quick && <FollowUp rec={rec} update={update} onOpen={() => setLinkOpen(true)} />}
            <LiveChecks />
            <Booth rec={rec} update={update} />
            {!quick && <button className="btn ghost sm" style={{ justifySelf: 'start', color: 'var(--red)' }} onClick={() => { deleteDemo(rec.id); nav('/'); }}>Delete this demo</button>}
          </div>
        </div>
      </main>
      {brandOpen && <BrandSheet onClose={() => setBrandOpen(false)} />}
      {linkOpen && <LinkSheet rec={rec} update={update} onClose={() => setLinkOpen(false)} />}
    </div>
  );
}

/* ---------- After the call ---------- */

function FollowUp({ rec, update, onOpen }: { rec: DemoRecord; update: (p: Partial<DemoRecord>) => void; onOpen: () => void }) {
  const [data, setData] = useState<{ share: ShareSummary; events: ShareEvent[] } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!rec.shareId) return;
    sharesApi.detail(rec.shareId).then(setData).catch((e) => setErr((e as Error).message));
  }, [rec.shareId]);
  if (!rec.shareId) {
    return (
      <section className="card stack" style={{ gap: 10 }}>
        <h3>After the call</h3>
        <p className="small muted">Send them a link to try it on their own face. It shows the story you presented, in their brand.</p>
        <button className="btn pri" onClick={onOpen}>Send them the link</button>
      </section>
    );
  }
  const st = data ? shareState(data.share) : null;
  return (
    <section className="card stack" style={{ gap: 10 }}>
      <div className="row"><h3 className="grow">What they did</h3>{st && <span className={`tag ${st.tone}`}>{st.label}</span>}</div>
      {err && <p className="small muted">{err}</p>}
      {data && (
        <>
          {data.events.length === 0
            ? <p className="small muted">Not opened yet. Sent {ago(data.share.createdAt)}.</p>
            : <ul className="timeline">{[...data.events].reverse().slice(0, 12).map((e, i) => <li key={i}><span className="t">{new Date(e.at).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span><span>{describeEvent(e)}</span></li>)}</ul>}
          <p className="tiny faint">{data.share.checksUsed} of {data.share.maxChecks} face checks used · until {new Date(data.share.expiresAt).toLocaleDateString()}. Faces are never shown here.</p>
        </>
      )}
      <div className="row">
        <button className="btn sm" onClick={onOpen}>Link and email</button>
        {data && !data.share.revoked && <button className="btn ghost sm" onClick={async () => { try { await sharesApi.revoke(rec.shareId!); setData({ ...data, share: { ...data.share, revoked: true } }); } catch { /* ignore */ } }}>Switch off</button>}
        {data?.share.revoked && <button className="btn ghost sm" onClick={() => update({ shareId: undefined })}>Make a new link</button>}
      </div>
    </section>
  );
}

function LinkSheet({ rec, update, onClose }: { rec: DemoRecord; update: (p: Partial<DemoRecord>) => void; onClose: () => void }) {
  const { settings, brand } = useDemo();
  const [url, setUrl] = useState(rec.shareId ? shareUrl(location.origin, rec.shareId) : '');
  const [err, setErr] = useState('');
  const [sr, setSr] = useState('');
  const [copied, setCopied] = useState('');
  const make = async () => {
    setErr('');
    try {
      const r = await sharesApi.create(pageFor(settings, { prospect: settings.prospect, industry: settings.industry, market: settings.market, scenarios: [...rec.story, ...rec.extras] }), sr.trim() || undefined);
      update({ shareId: r.share.id });
      setUrl(shareUrl(location.origin, r.share.id));
    } catch (e) { setErr((e as Error).message || 'Couldn’t make the link.'); }
  };
  const email = `Thanks for today. Here’s ${brand.name} with Sense on top: try opening an account, then try again as someone else and watch Sense stop it.\n\n${url}\n\nThe link works for 14 days. Forward it to your team.`;
  const copy = (text: string, what: string) => { navigator.clipboard?.writeText(text).then(() => setCopied(what)).catch(() => setCopied('')); };
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Send them the link" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mh"><b>Send {brand.name} their link</b><button className="btn ghost sm" onClick={onClose} aria-label="Close"><IcX width={15} /></button></div>
        <div className="mb stack">
          <p className="small muted">It shows the {rec.story.length + rec.extras.length} parts you presented, in their brand, with Try it yourself, a view for each team and next steps. 14 days, 5 face checks.</p>
          {!url ? (
            <>
              <label htmlFor="ls-sr" className="small muted">Tracked-link code (optional, from Network Admin · Growth)</label>
              <input id="ls-sr" className="input" value={sr} onChange={(e) => setSr(e.target.value)} placeholder="e.g. a1b2c3" />
              <button className="btn pri" onClick={make}>Make the link</button>
            </>
          ) : (
            <>
              <div className="copyrow"><span className="mono small grow" style={{ userSelect: 'all' }}>{url}</span><button className="btn sm" onClick={() => copy(url, 'link')}><IcCopy width={14} /> {copied === 'link' ? 'Copied' : 'Copy'}</button></div>
              <label className="small muted" htmlFor="ls-email">Email text</label>
              <textarea id="ls-email" className="input" rows={6} readOnly value={email} />
              <div className="row"><button className="btn" onClick={() => copy(email, 'email')}>{copied === 'email' ? 'Copied' : 'Copy email'}</button><a className="btn ghost" href={url} target="_blank" rel="noreferrer">Preview their page <IcExternal width={14} /></a></div>
            </>
          )}
          {err && <p className="small" style={{ color: 'var(--red)' }}>{err}</p>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Where live checks run (sales engineers) ---------- */

function LiveChecks() {
  const { settings, update } = useDemo();
  const [open, setOpen] = useState(settings.liveVia === 'key');
  const [check, setCheck] = useState<KeyCheck | null>(null);
  const keyField = settings.liveMode === 'live' ? 'liveKey' : 'sandboxKey';
  const key = settings[keyField];
  return (
    <section className="card stack" style={{ gap: 10 }}>
      <div className="row"><h3 className="grow">Live checks</h3><span className="tag plain">{settings.liveVia === 'key' ? 'Their key' : 'Sense Demo sandbox'}</span></div>
      <p className="small muted">“Now you try” runs a real face check in the Sense Demo org, so results open in Watchtower. No key needed.</p>
      {!open ? <button className="linkish small" onClick={() => setOpen(true)}>Run it on their own sandbox key instead</button> : (
        <div className="stack" style={{ gap: 8 }}>
          <label className="radio"><input type="radio" name="via" checked={settings.liveVia === 'demo'} onChange={() => update({ liveVia: 'demo' })} /> Sense Demo sandbox</label>
          <label className="radio"><input type="radio" name="via" checked={settings.liveVia === 'key'} onChange={() => update({ liveVia: 'key', liveMode: settings.liveMode === 'off' ? 'sandbox' : settings.liveMode })} /> Their key</label>
          {settings.liveVia === 'key' && (
            <>
              <div className="row">
                <select id="lc-mode" className="input" value={settings.liveMode === 'live' ? 'live' : 'sandbox'} onChange={(e) => update({ liveMode: e.target.value as 'sandbox' | 'live' })}><option value="sandbox">Sandbox key</option><option value="live">Production key (real credits)</option></select>
              </div>
              <input id="lc-key" className="input mono" type="password" value={key} onChange={(e) => { update({ [keyField]: e.target.value }); setCheck(null); }} placeholder="Paste the key" autoComplete="off" />
              <div className="row"><button className="btn sm" disabled={!key.trim()} onClick={async () => setCheck(await checkKey(key.trim(), settings.apiBaseUrl, envFor(settings.liveMode)))}>Check the key</button>{check && <span className={`small ${check.ok ? '' : 'muted'}`} style={{ color: check.ok ? 'var(--teal)' : 'var(--red)' }}>{check.ok ? 'Key works' : check.message}</span>}</div>
              <p className="tiny faint">Kept in this browser only. Results appear in their Watchtower.</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- Booth mode ---------- */

function Booth({ rec, update }: { rec: DemoRecord; update: (p: Partial<DemoRecord>) => void }) {
  const { settings } = useDemo();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const make = async () => {
    setBusy(true); setErr('');
    try {
      const r = await sharesApi.create(pageFor(settings, { prospect: settings.prospect, industry: settings.industry, market: settings.market, scenarios: rec.story }), undefined, 'booth');
      update({ boothId: r.share.id });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="card stack" style={{ gap: 10 }}>
      <h3>Booth mode</h3>
      <p className="small muted">For an event screen: the story plays on a loop with a QR code, and visitors try it on their own phones. Up to 150 face checks over 14 days.</p>
      {rec.boothId
        ? <div className="row"><a className="btn" href={boothUrl(location.origin, rec.boothId)} target="_blank" rel="noreferrer">Open booth screen <IcExternal width={14} /></a><button className="btn ghost sm" onClick={() => update({ boothId: undefined })}>New booth link</button></div>
        : <button className="btn" disabled={busy} onClick={make}>{busy ? 'Making…' : 'Make a booth screen'}</button>}
      {err && <p className="small" style={{ color: 'var(--red)' }}>{err}</p>}
    </section>
  );
}

/* ---------- Brand ---------- */

const SWATCHES = [XYZ_GREEN, '#1F3A93', '#6D28D9', '#B91C1C', '#C2410C', '#0E7490', '#111827'];

function BrandSheet({ onClose }: { onClose: () => void }) {
  const { settings, update, brand } = useDemo();
  const [importing, setImporting] = useState(false);
  const [platforms, setPlatforms] = useState(false);
  const [err, setErr] = useState('');
  const [over, setOver] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); readLogoFile(e.dataTransfer.files?.[0], (logo) => update({ logo }), setErr); };
  if (importing) return <BrandImportSheet onClose={() => setImporting(false)} />;
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Edit brand" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="mh"><b>Brand</b><button className="btn ghost sm" onClick={onClose} aria-label="Close"><IcX width={15} /></button></div>
        <div className="mb stack">
          <div className="site-row">
            <span className="grow">{settings.website ? <><b>From {settings.website}</b><span className="small muted" style={{ display: 'block' }}>Logo, colours and fonts from their website.</span></> : <><b>Import from their website</b><span className="small muted" style={{ display: 'block' }}>The same import as Watchtower’s Brand page.</span></>}</span>
            <button className="btn sm" onClick={() => setImporting(true)}>{settings.website ? 'Import again' : 'Import'}</button>
          </div>
          <div className="found">
            <div className="frow"><span>Name</span><input id="bs-name" className="input" value={settings.prospect} maxLength={40} onChange={(e) => update({ prospect: e.target.value })} placeholder="Leave empty to show XYZ Bank" /></div>
            <div className="frow"><span>Logo</span>
              <label className={`logo-drop mini${over ? ' over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
                {settings.logo ? <img src={settings.logo} alt="Their logo" /> : <span className="small muted">Drop their logo file, or click</span>}
                <input ref={file} type="file" accept="image/*" hidden onChange={(e) => readLogoFile(e.target.files?.[0], (logo) => update({ logo }), setErr)} />
              </label>
              {settings.logo && <button className="btn ghost sm" onClick={() => update({ logo: null })}>Remove</button>}
            </div>
            <div className="frow"><span>Colour</span>
              <span className="swatches">{SWATCHES.map((c) => <button key={c} className="swatch" aria-pressed={(settings.brandColor ?? XYZ_GREEN).toLowerCase() === c.toLowerCase()} style={{ background: c }} onClick={() => update({ brandColor: c === XYZ_GREEN ? null : c })} aria-label={c} />)}
                <input type="color" id="bs-color" value={settings.brandColor ?? XYZ_GREEN} onChange={(e) => update({ brandColor: e.target.value })} aria-label="Custom colour" /></span>
            </div>
            <div className="frow"><span>They are a</span><select id="bs-ind" className="input" value={settings.industry} onChange={(e) => update({ industry: e.target.value as IndustryId })}>{Object.values(INDUSTRIES).map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</select></div>
            <div className="frow"><span>Market</span><select id="bs-mkt" className="input" value={settings.market} onChange={(e) => update({ market: e.target.value as MarketId })}>{Object.values(MARKETS).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
          </div>
          <p className="tiny faint">Use the prospect’s real logo file from their site or brand kit; never redraw a logo.</p>
          {err && <p className="small" style={{ color: 'var(--red)' }}>{err}</p>}
          <button className="linkish small" onClick={() => setPlatforms((x) => !x)}>{platforms ? 'Hide' : 'Preview'} the face check on every platform</button>
          {platforms && <PlatformPreview brand={brand} />}
        </div>
      </div>
    </div>
  );
}

/** The SDK's first capture screen in their brand. The same appearance values drive every platform. */
export function PlatformPreview({ brand }: { brand: Brand }) {
  const a = appearanceOf(brand, { inlineAssets: true });
  const radius = a.shape?.buttonRadius ?? 12;
  const font = a.typography?.fontFamily;
  return (
    <div className="platforms">
      {['Web', 'iOS', 'Android'].map((p) => (
        <figure key={p}>
          <div className="sdk-mock" style={{ fontFamily: font }}>
            {brand.logo ? <img src={brand.logo} alt="" /> : <b>{brand.name}</b>}
            <span className="sdk-oval" />
            <b style={{ fontFamily: a.typography?.displayFamily ?? font }}>Take a quick selfie</b>
            <span className="tiny" style={{ color: '#6b6760' }}>Look at the screen for a few seconds.</span>
            <span className="sdk-btn" style={{ background: a.colors?.primary ?? brand.color, color: a.colors?.primaryForeground ?? '#fff', borderRadius: Math.min(radius, 999) }}>Start</span>
          </div>
          <figcaption className="tiny muted">{p}</figcaption>
        </figure>
      ))}
      <p className="tiny faint" style={{ gridColumn: '1 / -1' }}>The same values as Watchtower’s Brand page, on web, iOS, Android, React Native and Flutter. Success, warning and error colours stay Sense’s.</p>
    </div>
  );
}
