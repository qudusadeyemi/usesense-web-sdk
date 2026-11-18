/* "Import from their website": the same job, steps and review as Watchtower's
   brand import sheet (brand-import.tsx). Every value shows where on the site
   it came from; the rep picks what to use; nothing changes until they apply. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BankScreen, Phone } from '../bank/Screens';
import {
  applyImport, brandImportApi, cleanWebsite, foundPaths, ImportError, LABELS, setByRep, theirs,
  type BrandImportJob, type BrandImportPath, type BrandImportStep,
} from '../lib/brandImport';
import { brandFor, useDemo } from '../lib/settings';
import { IcX } from '../bank/icons';

function StepIcon({ status }: { status: BrandImportStep['status'] }) {
  const map = { done: ['y', '✓'], running: ['run', ''], failed: ['n', '!'], skipped: ['d', '–'], pending: ['d', ''] } as const;
  const [cls, glyph] = map[status];
  return <i className={cls} aria-hidden>{glyph}</i>;
}

function Steps({ job }: { job: BrandImportJob }) {
  const steps = job.steps.length ? job.steps : [{ id: 'fetch', label: 'Reading the website', status: 'running' as const }];
  return (
    <ol className="bi-steps" aria-live="polite">
      {steps.map((s) => (
        <li key={s.id} className={`check ${s.status}`}>
          <StepIcon status={s.status} />
          <span><b style={{ fontWeight: s.status === 'pending' ? 400 : 600 }}>{theirs(s.label)}</b>{s.note && <span className="muted small">{theirs(s.note)}</span>}</span>
        </li>
      ))}
    </ol>
  );
}

function Value({ path, value }: { path: BrandImportPath; value: string | number }) {
  if (path === 'appearance.logo.url' || path === 'appearance.logo.darkUrl') return null;
  if (path.startsWith('appearance.colors.')) return <span className="row" style={{ gap: 8 }}><span className="bi-sw" style={{ background: String(value) }} /><code className="tiny">{String(value)}</code></span>;
  if (path === 'appearance.typography.displayFamily' || path === 'appearance.typography.fontFamily') return <span style={{ fontFamily: String(value) }}>{String(value).split(',')[0].replace(/["']/g, '')}</span>;
  if (path === 'appearance.typography.fontCss') return <span className="small muted">{String(value).includes('@font-face') ? 'Their font files' : 'Google Fonts'}</span>;
  if (path === 'appearance.typography.headingCase') return <span>{value === 'upper' ? 'CAPITALS' : 'As written'}</span>;
  if (path === 'appearance.shape.buttonRadius') return <span className="row" style={{ gap: 8 }}><span className="bi-radius" style={{ borderRadius: Math.min(Number(value), 12) }} /><span className="small muted">{Number(value) >= 999 ? 'Pill' : `${value}px`}</span></span>;
  if (path === 'appearance.shape.buttonStyle') return <span>{value === 'outline' ? 'Outline' : 'Filled'}</span>;
  return <span>{String(value)}</span>;
}

export function BrandImportSheet({ onClose }: { onClose: () => void }) {
  const { settings, update, market, industry } = useDemo();
  const [url, setUrl] = useState(settings.website);
  const [job, setJob] = useState<BrandImportJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState('');
  const [chosen, setChosen] = useState<Set<BrandImportPath>>(new Set());
  const poll = useRef<number | null>(null);
  useEffect(() => () => { if (poll.current) window.clearTimeout(poll.current); }, []);

  const result = job && job.status !== 'running' ? job.result : undefined;
  const found = useMemo(() => (result ? foundPaths(result) : []), [result]);
  useEffect(() => { if (result) setChosen(new Set(found.filter((p) => !setByRep(settings, p)))); }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  const watch = (j: BrandImportJob) => {
    setJob(j);
    if (j.status !== 'running') return;
    poll.current = window.setTimeout(async () => {
      try { watch((await brandImportApi.get(j.id)).job); } catch { poll.current = window.setTimeout(() => watch(j), 2500); }
    }, 1200);
  };

  const start = async () => {
    const site = cleanWebsite(url);
    if (!site) { setErr('Enter a website like example.com.'); return; }
    setErr('');
    setStarting(true);
    try { watch((await brandImportApi.start(site)).job); } catch (e) { setErr(e instanceof ImportError ? e.message : 'Couldn’t start the import.'); }
    setStarting(false);
  };
  const reset = () => { if (poll.current) window.clearTimeout(poll.current); setJob(null); };

  const previewSettings = useMemo(() => (result ? { ...settings, ...applyImport(settings, result, [...chosen]) } : settings), [result, settings, chosen]);
  const preview = brandFor(previewSettings);
  const apply = () => { if (result) update(applyImport(settings, result, [...chosen])); onClose(); };
  const toggle = (p: BrandImportPath) => setChosen((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; });

  const failed = job && (job.status === 'failed' || (result?.failure && !found.length));
  const failureText = result?.failure?.message ?? job?.error?.message ?? 'We couldn’t read this site.';
  const lightLogo = chosen.has('appearance.logo.url') ? String(result?.fields['appearance.logo.url']?.value ?? '') : settings.logo ?? '';
  const darkLogo = chosen.has('appearance.logo.darkUrl') ? String(result?.fields['appearance.logo.darkUrl']?.value ?? '') : settings.site?.logoDark ?? '';

  return (
    <div className="modal-back sheet-back" role="dialog" aria-modal="true" aria-label="Import from their website" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="bi-sheet">
        <div className="mh">
          <div><b style={{ fontFamily: 'var(--f-display)', fontWeight: 600, fontSize: '1.15rem' }}>Import from their website</b>
            <p className="small muted" style={{ margin: '2px 0 0' }}>The same import as Watchtower’s Brand page: logo, colours and fonts, each with where it came from, contrast fixed. It brands the app and the real face check. Nothing changes until you apply.</p></div>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close"><IcX width={16} height={16} /></button>
        </div>

        {!job && (
          <form className="mb" style={{ maxWidth: 560 }} onSubmit={(e) => { e.preventDefault(); void start(); }}>
            <label htmlFor="bi-url" className="label">Their website</label>
            <div className="row">
              <input id="bi-url" className="input grow" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="theircompany.com" autoFocus />
              <button type="submit" className="btn pri" disabled={!url.trim() || starting}>{starting ? 'Starting…' : 'Read their brand'}</button>
            </div>
            {err ? <span className="err">{err}</span> : <span className="help">Takes about 20 seconds.</span>}
          </form>
        )}

        {job && job.status === 'running' && (
          <div className="mb" style={{ maxWidth: 560 }}>
            <p className="small">Reading <b>{job.url}</b></p>
            <Steps job={job} />
          </div>
        )}

        {job && failed && (
          <div className="mb" style={{ maxWidth: 560 }}>
            <div className="notice" style={{ background: 'var(--gold-soft)', color: 'var(--ink)' }}><span>{theirs(failureText)}</span></div>
            <Steps job={job} />
            <div className="row"><button className="btn pri" onClick={onClose}>Upload their logo instead</button><button className="btn" onClick={reset}>Try another address</button></div>
          </div>
        )}

        {job && result && !failed && (
          <>
            <div className="bi-body">
              <section className="stack" style={{ gap: 14, minWidth: 0 }} aria-label="What we found">
                <div className="row small muted">From <b style={{ color: 'var(--ink)' }}>{result.host}</b><button className="btn ghost sm" onClick={reset}>Use another website</button></div>
                {(lightLogo || darkLogo) && (
                  <div className="bi-logos">
                    <figure><div className="paper">{lightLogo ? <img src={lightLogo} alt="Logo on a light background" /> : <span className="tiny faint">No logo</span>}</div><figcaption className="tiny faint">On light backgrounds</figcaption></figure>
                    <figure><div className="ink">{darkLogo ? <img src={darkLogo} alt="Logo on a dark background" /> : lightLogo ? <span className="chip-paper"><img src={lightLogo} alt="Logo on a light chip" /></span> : null}</div><figcaption className="tiny faint">{darkLogo ? 'On dark backgrounds' : 'On dark backgrounds, on a light chip'}</figcaption></figure>
                  </div>
                )}
                <ul className="bi-list">
                  {found.map((p) => {
                    const f = result.fields[p]!;
                    const id = `bi-${p.replace(/\./g, '-')}`;
                    const mine = setByRep(settings, p);
                    return (
                      <li key={p}>
                        <input type="checkbox" id={id} checked={chosen.has(p)} onChange={() => toggle(p)} />
                        <div className="grow" style={{ minWidth: 0 }}>
                          <div className="row" style={{ flexWrap: 'wrap', gap: '4px 12px' }}>
                            <label htmlFor={id} className="bi-label">{LABELS[p]}</label>
                            <Value path={p} value={f.value} />
                            {p === 'appearance.colors.primary' && result.contrast && <span className={`pill ${result.contrast.passes ? 'ok' : 'live'}`}>{result.contrast.ratio.toFixed(1)} : 1 {result.contrast.passes ? 'AA' : 'below AA'} · {result.contrast.foreground.toLowerCase() === '#ffffff' ? 'white' : 'dark'} text</span>}
                            {mine && <span className="pill off">You set this</span>}
                          </div>
                          <span className="tiny faint">{theirs(f.source)}</span>
                          {f.note && <span className="tiny muted" style={{ display: 'block' }}>{theirs(f.note)}</span>}
                        </div>
                      </li>
                    );
                  })}
                  {result.missing.map((m) => (
                    <li key={m.path} className="miss"><span className="tiny faint" aria-hidden>–</span><div><span className="small muted">{LABELS[m.path]}: not found</span><span className="tiny faint" style={{ display: 'block' }}>{theirs(m.reason)} Left empty instead of guessing.</span></div></li>
                  ))}
                </ul>
                <p className="tiny faint" style={{ margin: 0 }}>Success, warning and error colours always stay Sense’s, so results read the same everywhere.</p>
                {result.notes.map((n, i) => <p key={i} className="tiny muted bi-note">{theirs(n)}</p>)}
              </section>
              <aside className="stack" style={{ gap: 10, alignItems: 'center' }} aria-label="Live preview">
                <span className="eyebrow">Live preview</span>
                <div className="preview-phone"><Phone dark brand={preview}><BankScreen screen={{ kind: 'welcome' }} ctx={{ brand: preview, market, industry }} stepKey={`bi-${preview.name}-${preview.color}-${preview.logo?.slice(-24)}`} /></Phone></div>
              </aside>
            </div>
            <div className="bi-foot">
              <span className="small muted" style={{ marginRight: 'auto' }}>{chosen.size} of {found.length} selected</span>
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn pri" disabled={chosen.size === 0} onClick={apply}>Use this brand</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
