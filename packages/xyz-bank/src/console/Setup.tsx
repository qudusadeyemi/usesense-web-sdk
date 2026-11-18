import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { BankScreen, Phone } from '../bank/Screens';
import { checkKey, envFor, forgetIdentity, loadIdentity, type KeyCheck } from '../lib/live';
import { INDUSTRIES, MARKETS, type IndustryId, type MarketId } from '../lib/presets';
import { XYZ_GREEN, useDemo, type LiveMode } from '../lib/settings';

const SWATCHES = [XYZ_GREEN, '#1F3A93', '#6D28D9', '#B91C1C', '#C2410C', '#0E7490', '#111827'];
const MAX_LOGO = 600 * 1024;

export function Setup() {
  const { settings, update, reset, brand, market, industry, activeKey } = useDemo();
  const [check, setCheck] = useState<KeyCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [logoErr, setLogoErr] = useState('');
  const [over, setOver] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const env = envFor(settings.liveMode);
  const [identity, setIdentity] = useState(() => loadIdentity(env));

  useEffect(() => { setCheck(null); setIdentity(loadIdentity(env)); }, [activeKey, env]);

  const runCheck = async () => {
    if (!activeKey) return;
    setChecking(true);
    setCheck(await checkKey(activeKey, settings.apiBaseUrl, env));
    setChecking(false);
  };

  const readLogo = (f: File | undefined) => {
    setLogoErr('');
    if (!f) return;
    if (!/^image\/(png|jpeg|svg\+xml|webp|gif)$/.test(f.type)) { setLogoErr('Use a PNG, JPG, SVG or WebP file.'); return; }
    if (f.size > MAX_LOGO) { setLogoErr('That file is over 600 KB. Use a smaller export of the logo.'); return; }
    const r = new FileReader();
    r.onload = () => update({ logo: String(r.result) });
    r.readAsDataURL(f);
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); readLogo(e.dataTransfer.files?.[0]); };

  const keyField = settings.liveMode === 'live' ? 'liveKey' : 'sandboxKey';
  const keyValue = settings[keyField];

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Set up this demo</h1><p>Takes a minute. Everything here stays in this browser, and you can change it mid-call.</p></div>
        <div className="row"><button className="btn ghost" onClick={reset}>Start fresh</button><Link className="btn pri" to="/scenarios">Pick a scenario</Link></div>
      </div>
      <div className="setup">
        <div className="stack" style={{ gap: 24 }}>
          <section className="card" aria-labelledby="who">
            <h3 id="who">Who are you showing?</h3>
            <div className="field">
              <label htmlFor="prospect">Prospect name (optional)</label>
              <input id="prospect" className="input" placeholder="Leave empty to show XYZ Bank" value={settings.prospect} onChange={(e) => update({ prospect: e.target.value.slice(0, 40) })} />
              <span className="help">With a name, the app becomes their app: “{brand.name}”.</span>
            </div>
            <div className="field">
              <span className="label">Their logo file (optional)</span>
              <div className={`logo-drop${over ? ' over' : ''}`} role="button" tabIndex={0}
                onClick={() => fileRef.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
                <span className="box">{settings.logo ? <img src={settings.logo} alt="Prospect logo" /> : 'PNG/SVG'}</span>
                <span className="grow">Drop the prospect’s own logo file, or click to choose. Use the real file from their site or brand kit; never redraw a logo.</span>
                {settings.logo && <button className="btn sm" onClick={(e) => { e.stopPropagation(); update({ logo: null }); }}>Remove</button>}
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={(e) => readLogo(e.target.files?.[0])} />
              {logoErr && <span className="err">{logoErr}</span>}
            </div>
            <div className="field">
              <span className="label">Brand colour</span>
              <div className="swatches">
                {SWATCHES.map((c) => <button key={c} className="swatch" style={{ background: c }} aria-label={c} aria-pressed={(settings.brandColor ?? XYZ_GREEN).toLowerCase() === c.toLowerCase()} onClick={() => update({ brandColor: c === XYZ_GREEN ? null : c })} />)}
                <label className="btn sm" style={{ position: 'relative' }}>Custom
                  <input type="color" value={settings.brandColor ?? XYZ_GREEN} onChange={(e) => update({ brandColor: e.target.value })} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} aria-label="Custom brand colour" />
                </label>
              </div>
            </div>
            <div className="field">
              <span className="label">Their business</span>
              <div className="chips">
                {(Object.keys(INDUSTRIES) as IndustryId[]).map((k) => <button key={k} className="chip" aria-pressed={settings.industry === k} onClick={() => update({ industry: k })}>{INDUSTRIES[k].label}</button>)}
              </div>
              <span className="help">Sets the words in the app and which attacks come first.</span>
            </div>
            <div className="field">
              <span className="label">Market</span>
              <div className="chips">
                {(Object.keys(MARKETS) as MarketId[]).map((k) => <button key={k} className="chip" aria-pressed={settings.market === k} onClick={() => update({ market: k })}>{MARKETS[k].label} · {MARKETS[k].currency}</button>)}
              </div>
              <span className="help">Sets money, names, ID type and local detail.</span>
            </div>
          </section>

          <section className="card" aria-labelledby="livehead">
            <div className="row" style={{ justifyContent: 'space-between' }}><h3 id="livehead">Live checks</h3>
              <div className="seg" role="group" aria-label="Live checks">
                {(['sandbox', 'live', 'off'] as LiveMode[]).map((m) => <button key={m} aria-pressed={settings.liveMode === m} onClick={() => update({ liveMode: m })}>{m === 'sandbox' ? 'Sandbox' : m === 'live' ? 'Live' : 'Off'}</button>)}
              </div>
            </div>
            {settings.liveMode === 'off' ? (
              <p className="muted small">Scripted scenarios only. Nothing is sent to Sense.</p>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="key">{settings.liveMode === 'live' ? 'Production' : 'Sandbox'} API key from Watchtower</label>
                  <div className="row">
                    <input id="key" className="input mono grow" type={showKey ? 'text' : 'password'} autoComplete="off" spellCheck={false} placeholder="Paste the key"
                      value={keyValue} onChange={(e) => update({ [keyField]: e.target.value.trim() } as never)} />
                    <button className="btn sm" onClick={() => setShowKey((s) => !s)}>{showKey ? 'Hide' : 'Show'}</button>
                  </div>
                  <span className="help">Watchtower, Developers, API keys. The key stays in this browser and is only sent to the Sense API.</span>
                </div>
                {settings.liveMode === 'live' && !settings.liveCostAccepted && (
                  <div className="banner-live" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <span>Production keys spend real credits and write real, signed decisions. Use the Sense Demo org, never a customer’s.</span>
                    <button className="btn sm" onClick={() => update({ liveCostAccepted: true })}>I understand</button>
                  </div>
                )}
                <div className="status">
                  {!activeKey && <div className="check"><i className="d">–</i><span><b>No key yet</b><span className="muted small">Scripted scenarios still work.</span></span></div>}
                  {activeKey && !check && <div className="row" style={{ justifyContent: 'space-between' }}><span className="small muted">Check the key before the call.</span><button className="btn sm" onClick={runCheck} disabled={checking}>{checking ? 'Checking…' : 'Check key'}</button></div>}
                  {check && (
                    <>
                      <div className="check"><i className={check.ok ? 'y' : 'n'}>{check.ok ? '✓' : '✕'}</i><span><b>{check.ok ? `Connected (${env})` : 'Key not accepted'}</b><span className="muted small">{check.ok ? 'Sense accepted this key.' : check.message}</span></span></div>
                      {check.ok && check.envGuess !== env && <div className="check"><i className="w">!</i><span><b>This looks like a {check.envGuess} key</b><span className="muted small">You picked {settings.liveMode === 'live' ? 'Live' : 'Sandbox'}. Sessions run where the key belongs.</span></span></div>}
                      {check.ok && check.flows === false && <div className="check"><i className="w">!</i><span><b>No Flows permission</b><span className="muted small">Fine for these demos, which use face check sessions.</span></span></div>}
                    </>
                  )}
                  <div className="check">
                    <i className={identity ? 'w' : 'd'}>{identity ? '!' : '–'}</i>
                    <span><b>{identity ? `Your face is enrolled as ${identity.name}` : 'No live sign-up from this browser yet'}</b>
                      <span className="muted small">{identity
                        ? <>Genuine runs check you as a returning customer. A new sign-up is stopped as a duplicate, which is the duplicate demo. <button className="btn ghost sm" style={{ padding: '0 4px' }} onClick={() => { forgetIdentity(env); setIdentity(null); }}>Forget it</button></>
                        : 'Your first live run signs you up. After that, Sense will recognise you.'}</span></span>
                  </div>
                </div>
                <details className="adv">
                  <summary>Advanced</summary>
                  <div className="field"><label htmlFor="base">API base URL</label><input id="base" className="input mono" value={settings.apiBaseUrl} onChange={(e) => update({ apiBaseUrl: e.target.value.trim() || 'https://api.usesense.ai' })} /><span className="help">Leave as https://api.usesense.ai unless you are testing staging.</span></div>
                </details>
              </>
            )}
          </section>
        </div>
        <aside className="card" style={{ padding: 22, position: 'sticky', top: 80 }} aria-label="Preview">
          <div className="row" style={{ justifyContent: 'space-between' }}><h3>What the prospect sees</h3><span className="faint small">{industry.short} · {market.currency}</span></div>
          <div className="preview-phone">
            <Phone dark brandColor={brand.color}><BankScreen screen={{ kind: 'welcome' }} ctx={{ brand, market, industry }} stepKey={`${brand.name}-${industry.id}-${brand.color}`} /></Phone>
          </div>
          <Link className="btn pri" to="/scenarios" style={{ width: '100%' }}>Start the demo</Link>
        </aside>
      </div>
    </div>
  );
}
