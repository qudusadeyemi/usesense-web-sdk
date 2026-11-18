import { useCallback, useEffect, useMemo, useState } from 'react';
import { IcCopy, IcExternal } from '../bank/icons';
import { clearHistory, leaveBehindUrl, loadHistory, summarise } from '../lib/history';
import { watchtowerSessionUrl } from '../lib/live';
import { useDemo } from '../lib/settings';
import { pageFor, shareUrl, sharesApi, type ShareSummary } from '../lib/shares';
import { WatchtowerError } from '../lib/watchtower';

export function Demos() {
  const { settings } = useDemo();
  const [entries, setEntries] = useState(loadHistory);
  const [sr, setSr] = useState('');
  const [toast, setToast] = useState('');
  const people = useMemo(() => summarise(entries), [entries]);
  const lives = entries.filter((e) => e.variant === 'live' && e.liveSessionId).slice(0, 12);
  const [shares, setShares] = useState<ShareSummary[] | null>(null);
  const [sharesErr, setSharesErr] = useState('');
  const [making, setMaking] = useState('');

  const loadShares = useCallback(async () => {
    try { setShares((await sharesApi.list()).shares); setSharesErr(''); }
    catch (e) { setSharesErr(e instanceof WatchtowerError ? e.message : 'Couldn’t load your links.'); }
  }, []);
  useEffect(() => { void loadShares(); }, [loadShares]);

  const makeLink = async (row: { prospect: string; industry: string; market: string; scenarios: string[] }) => {
    setMaking(row.prospect);
    try {
      const { share } = await sharesApi.create(pageFor(settings, row), sr || undefined);
      await copy(shareUrl(location.origin, share.id), 'Prospect link copied');
      void loadShares();
    } catch (e) {
      setToast(e instanceof WatchtowerError ? e.message : 'Couldn’t make the link.');
      window.setTimeout(() => setToast(''), 3500);
    }
    setMaking('');
  };
  const switchOff = async (id: string) => {
    try { await sharesApi.revoke(id); void loadShares(); } catch { setToast('Couldn’t switch it off. Try again.'); }
  };

  async function copy(text: string, done = 'Link copied') {
    try { await navigator.clipboard.writeText(text); setToast(done); }
    catch { setToast('Copy failed. Select the link and copy it.'); }
    window.setTimeout(() => setToast(''), 2200);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Demos</h1><p>What you showed, to whom, from this browser. Send the prospect a link so they can try it themselves: the scenarios they saw, in their brand, and a real face check on their own phone.</p></div>
        {entries.length > 0 && <button className="btn ghost" onClick={() => { clearHistory(); setEntries([]); }}>Clear history</button>}
      </div>

      <div className="card" style={{ padding: 18, display: 'grid', gap: 10 }}>
        <div className="field">
          <label htmlFor="sr">Tracked-link code (optional)</label>
          <input id="sr" className="input mono" placeholder="From Network Admin, Growth, Links" value={sr} onChange={(e) => setSr(e.target.value.trim())} style={{ maxWidth: 360 }} />
          <span className="help">Add one before making a link and it reports opens and scenario views to Growth, like the decks do.</span>
        </div>
      </div>

      {people.length === 0 ? (
        <div className="card" style={{ padding: 28 }}><h3>No demos yet</h3><p className="muted" style={{ marginTop: 6 }}>Play any scenario and it appears here, grouped by prospect.</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Prospect</th><th>Last shown</th><th>Scenarios</th><th>Live runs</th><th>Send them</th></tr></thead>
            <tbody>
              {people.map((p) => {
                const url = leaveBehindUrl(location.origin, { prospect: p.prospect === 'No prospect set' ? '' : p.prospect, industry: p.industry, market: p.market, scenarios: p.scenarios.map((s) => s.id), sr: sr || undefined });
                return (
                  <tr key={p.prospect}>
                    <td><b>{p.prospect}</b><br /><span className="faint small">{p.industry} · {p.market.toUpperCase()}</span></td>
                    <td className="small">{new Date(p.last).toLocaleString()}</td>
                    <td className="small">{p.scenarios.map((s) => s.title).join(', ')}</td>
                    <td className="mono small">{p.live}</td>
                    <td>
                      <div className="row" style={{ flexWrap: 'wrap' }}>
                        <button className="btn pri sm" disabled={!!making} onClick={() => makeLink({ prospect: p.prospect === 'No prospect set' ? '' : p.prospect, industry: p.industry, market: p.market, scenarios: p.scenarios.map((s) => s.id) })}>
                          <IcCopy width={14} /> {making === p.prospect ? 'Making…' : 'Make prospect link'}
                        </button>
                        <button className="btn ghost sm" title="Scripted replays only, no brand, no face check, no sign-in needed to make" onClick={() => copy(url)}>Replay only</button>
                      </div>
                      {p.prospect !== settings.prospect && <span className="tiny faint">Their name only: the brand is set for {settings.prospect || 'XYZ Bank'}.</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ fontSize: '1.15rem' }}>Your prospect links</h2>
      <p className="muted small" style={{ marginTop: -8 }}>Each link lasts 14 days and allows 5 face checks, run in the Sense Demo sandbox org. Switch one off at any time.</p>
      {sharesErr && <div className="notice"><span>{sharesErr}</span></div>}
      {shares && shares.length === 0 && <p className="small muted">No links yet. Use Make prospect link above.</p>}
      {shares && shares.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Prospect</th><th>Made</th><th>Opens</th><th>Face checks</th><th>Status</th><th /></tr></thead>
            <tbody>
              {shares.map((x) => {
                const link = shareUrl(location.origin, x.id);
                const off = x.revoked || x.expired;
                return (
                  <tr key={x.id}>
                    <td><b>{x.prospect || 'XYZ Bank'}</b><br /><span className="faint small">{x.scenarios.length} scenario{x.scenarios.length === 1 ? '' : 's'}</span>{!off && <><br /><span className="mono tiny" style={{ userSelect: 'all', wordBreak: 'break-all' }}>{link}</span></>}</td>
                    <td className="small">{new Date(x.createdAt).toLocaleDateString()}</td>
                    <td className="mono small">{x.views}</td>
                    <td className="mono small">{x.checksUsed} / {x.maxChecks}</td>
                    <td className="small">{x.revoked ? 'Switched off' : x.expired ? 'Ended' : `Until ${new Date(x.expiresAt).toLocaleDateString()}`}</td>
                    <td>
                      {!off && (
                        <div className="row">
                          <button className="btn sm" onClick={() => copy(link)}><IcCopy width={14} /> Copy</button>
                          <a className="btn ghost sm" href={link} target="_blank" rel="noreferrer" aria-label="Open the prospect link"><IcExternal width={14} /></a>
                          <button className="btn ghost sm" onClick={() => switchOff(x.id)}>Switch off</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {lives.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.15rem' }}>Recent live runs</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>Scenario</th><th>Outcome</th><th>Session</th></tr></thead>
              <tbody>
                {lives.map((e) => (
                  <tr key={e.liveSessionId}>
                    <td className="small">{new Date(e.at).toLocaleString()}</td>
                    <td className="small">{e.scenarioTitle}{e.prospect ? ` · ${e.prospect}` : ''}</td>
                    <td className="small">{e.liveOutcome === 'let' ? 'Let through' : e.liveOutcome === 'stop' ? 'Stopped' : 'In review'}</td>
                    <td><a className="mono small" href={watchtowerSessionUrl(e.liveSessionId!)} target="_blank" rel="noreferrer">{e.liveSessionId}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {settings.prospect === '' && people.length > 0 && <p className="tiny faint">Tip: set the prospect name on Set up so demos are grouped by company.</p>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
