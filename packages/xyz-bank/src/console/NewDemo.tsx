/* New demo: their website in, their app out. One field, then one review of
   what we found (brand, business, market), then the story the website's
   industry page recommends. */
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BankScreen, Phone } from '../bank/Screens';
import { applyImport, brandImportApi, cleanWebsite, foundPaths, ImportError, theirs, type BrandImportJob } from '../lib/brandImport';
import { createDemo } from '../lib/demos';
import { INDUSTRIES, MARKETS, type IndustryId, type MarketId } from '../lib/presets';
import { brandFor, DEFAULT_SETTINGS, type DemoSettings } from '../lib/settings';
import { industryFromSector, INDUSTRY_LINE, marketFromHost, recommendedStory } from '../lib/story';
import { allScenarios, makeContext } from '../scenarios';
import { TopBar } from './Home';
import { StoryEditor } from './StoryEditor';

const MAX_LOGO = 600 * 1024;

export function readLogoFile(f: File | undefined, done: (dataUrl: string) => void, fail: (msg: string) => void) {
  if (!f) return;
  if (!/^image\/(png|jpeg|svg\+xml|webp|gif)$/.test(f.type)) { fail('Use a PNG, JPG, SVG or WebP file.'); return; }
  if (f.size > MAX_LOGO) { fail('That file is over 600 KB. Use a smaller export of the logo.'); return; }
  const r = new FileReader();
  r.onload = () => done(String(r.result));
  r.readAsDataURL(f);
}

type Step = 'site' | 'review' | 'story';

export function NewDemo() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('site');
  const [url, setUrl] = useState('');
  const [nameOnly, setNameOnly] = useState(false);
  const [err, setErr] = useState('');
  const [job, setJob] = useState<BrandImportJob | null>(null);
  const [draft, setDraft] = useState<DemoSettings>({ ...DEFAULT_SETTINGS });
  const [guessed, setGuessed] = useState<{ industry: boolean; market: boolean }>({ industry: false, market: false });
  const [story, setStory] = useState<string[]>(recommendedStory('bank'));
  const poll = useRef<number | null>(null);
  const [over, setOver] = useState(false);

  useEffect(() => () => { if (poll.current) window.clearTimeout(poll.current); }, []);

  const watch = (j: BrandImportJob) => {
    setJob(j);
    if (j.status !== 'running') {
      if (j.result) {
        const patch = applyImport({ ...DEFAULT_SETTINGS, website: url }, j.result, foundPaths(j.result));
        const ind = industryFromSector(j.result.suggestion?.sector);
        const mkt = marketFromHost(j.result.host);
        setDraft((d) => ({ ...d, ...patch, ...(ind ? { industry: ind } : {}), ...(mkt ? { market: mkt } : {}) }));
        setGuessed({ industry: !!ind, market: !!mkt });
        if (ind) setStory(recommendedStory(ind));
      }
      return;
    }
    poll.current = window.setTimeout(async () => {
      try { watch((await brandImportApi.get(j.id)).job); } catch { poll.current = window.setTimeout(() => watch(j), 2500); }
    }, 1200);
  };

  const begin = async () => {
    setErr('');
    if (nameOnly) {
      if (!draft.prospect.trim()) { setErr('Enter their name.'); return; }
      setStep('review');
      return;
    }
    const site = cleanWebsite(url);
    if (!site) { setErr('Enter a website like northlinebank.com.'); return; }
    setUrl(site);
    setDraft((d) => ({ ...d, website: site }));
    setStep('review');
    try { watch((await brandImportApi.start(site)).job); } catch (e) { setErr(e instanceof ImportError ? e.message : 'Couldn’t start the import. Enter their name instead.'); setJob(null); }
  };

  const brand = useMemo(() => brandFor(draft), [draft]);
  const market = MARKETS[draft.market];
  const industry = INDUSTRIES[draft.industry];
  const running = !!job && job.status === 'running';
  const failed = (!!job && job.status === 'failed' && !job.result?.fields) || (!!err && step === 'review');
  const ctx = useMemo(() => makeContext(market, industry, brand), [market, industry, brand]);
  const all = useMemo(() => allScenarios(ctx), [ctx]);

  const setIndustry = (id: IndustryId) => { setDraft((d) => ({ ...d, industry: id })); setStory(recommendedStory(id)); };

  const save = () => {
    const rec = createDemo({ ...draft, prospect: draft.prospect.trim() }, story);
    nav(`/d/${rec.id}`);
  };

  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); readLogoFile(e.dataTransfer.files?.[0], (logo) => setDraft((d) => ({ ...d, logo })), setErr); };

  return (
    <div className="app">
      <TopBar><Link className="btn ghost sm" to="/">Cancel</Link></TopBar>
      <main className="app-main narrow">
        <ol className="wizard" aria-label="Steps">
          <li className={step === 'site' ? 'cur' : 'done'}>Who</li>
          <li className={step === 'review' ? 'cur' : step === 'story' ? 'done' : ''}>Check</li>
          <li className={step === 'story' ? 'cur' : ''}>Their story</li>
        </ol>

        {step === 'site' && (
          <form className="card stack" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); begin(); }}>
            <h1>Who are you showing?</h1>
            {!nameOnly ? (
              <>
                <label htmlFor="nd-url" className="small muted">Their website</label>
                <div className="row"><input id="nd-url" className="input grow" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="northlinebank.com" autoFocus /><button className="btn pri" type="submit">Continue</button></div>
                <p className="small muted">We read their logo, colours, fonts and what they do, with the same import as Watchtower’s Brand page. Nothing is saved to any Watchtower org.</p>
                <button type="button" className="linkish" onClick={() => setNameOnly(true)}>No website? Enter a name instead</button>
              </>
            ) : (
              <>
                <label htmlFor="nd-name" className="small muted">Their name</label>
                <div className="row"><input id="nd-name" className="input grow" value={draft.prospect} onChange={(e) => setDraft((d) => ({ ...d, prospect: e.target.value }))} placeholder="Northline Bank" autoFocus maxLength={40} /><button className="btn pri" type="submit">Continue</button></div>
                <button type="button" className="linkish" onClick={() => setNameOnly(false)}>Use their website instead</button>
              </>
            )}
            {err && <p className="small" style={{ color: 'var(--red)' }}>{err}</p>}
          </form>
        )}

        {step === 'review' && (
          <section className="review-grid">
            <div className="card stack" style={{ gap: 12 }}>
              <div className="row"><h1 className="grow">{nameOnly ? `Check ${draft.prospect || "the details"}` : "Check what we found"}</h1>{running && <span className="small muted">Reading {url}…</span>}</div>
              {running && job && (
                <ul className="bi-steps">
                  {job.steps.map((s) => <li key={s.id} className={s.status}><span className="dot" />{theirs(s.label)}</li>)}
                </ul>
              )}
              {failed && <p className="small" style={{ color: 'var(--gold)' }}>{err || job?.error?.message || 'We couldn’t read that website.'} Fill in the name and drop their logo file below.</p>}
              {!running && (
                <div className="found">
                  <div className="frow"><span>Name</span><input id="nd-pname" className="input" value={draft.prospect} maxLength={40} onChange={(e) => setDraft((d) => ({ ...d, prospect: e.target.value }))} placeholder="Their name" /></div>
                  <div className="frow"><span>Logo</span>
                    <label className={`logo-drop mini${over ? ' over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
                      {draft.logo ? <img src={draft.logo} alt="Their logo" /> : <span className="small muted">Drop their logo file, or click</span>}
                      <input type="file" accept="image/*" hidden onChange={(e) => readLogoFile(e.target.files?.[0], (logo) => setDraft((d) => ({ ...d, logo })), setErr)} />
                    </label>
                  </div>
                  <div className="frow"><span>Colour</span><input type="color" id="nd-color" value={draft.brandColor ?? '#0F5C4A'} onChange={(e) => setDraft((d) => ({ ...d, brandColor: e.target.value }))} /><span className="mono small">{draft.brandColor ?? 'XYZ green'}</span></div>
                  <div className="frow"><span>They are a</span>
                    <select id="nd-ind" className="input" value={draft.industry} onChange={(e) => setIndustry(e.target.value as IndustryId)}>
                      {Object.values(INDUSTRIES).map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                    </select>
                    {guessed.industry && <span className="tiny faint">from their website</span>}
                  </div>
                  <div className="frow"><span>Market</span>
                    <select id="nd-mkt" className="input" value={draft.market} onChange={(e) => setDraft((d) => ({ ...d, market: e.target.value as MarketId }))}>
                      {Object.values(MARKETS).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                    {guessed.market && <span className="tiny faint">from their domain</span>}
                  </div>
                </div>
              )}
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button className="btn ghost" onClick={() => { setStep('site'); setJob(null); setErr(''); }}>Back</button>
                <button className="btn pri" disabled={running || !draft.prospect.trim()} onClick={() => setStep('story')}>Looks right</button>
              </div>
            </div>
            <aside className="preview-phone"><Phone dark brand={brand}><BankScreen screen={{ kind: 'welcome' }} ctx={{ brand, market, industry }} stepKey={`nd-${brand.name}-${brand.color}-${brand.logo?.slice(-20)}`} /></Phone></aside>
          </section>
        )}

        {step === 'story' && (
          <section className="card stack" style={{ gap: 14 }}>
            <h1>{brand.name}’s story</h1>
            <p className="muted">Recommended for {industry.short.toLowerCase()}, from usesense.ai/solutions/{INDUSTRY_LINE[draft.industry].page}: <i>“{INDUSTRY_LINE[draft.industry].line}”</i>. It opens with a good customer, then three attacks.</p>
            <StoryEditor all={all} story={story} onChange={setStory} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setStep('review')}>Back</button>
              <button className="btn pri" onClick={save}>Save demo</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
