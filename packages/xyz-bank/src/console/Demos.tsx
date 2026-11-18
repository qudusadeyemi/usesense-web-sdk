import { useMemo, useState } from 'react';
import { IcCopy, IcExternal } from '../bank/icons';
import { clearHistory, leaveBehindUrl, loadHistory, summarise } from '../lib/history';
import { watchtowerSessionUrl } from '../lib/live';
import { useDemo } from '../lib/settings';

export function Demos() {
  const { settings } = useDemo();
  const [entries, setEntries] = useState(loadHistory);
  const [sr, setSr] = useState('');
  const [toast, setToast] = useState('');
  const people = useMemo(() => summarise(entries), [entries]);
  const lives = entries.filter((e) => e.variant === 'live' && e.liveSessionId).slice(0, 12);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setToast('Link copied'); }
    catch { setToast('Copy failed. Select the link and copy it.'); }
    window.setTimeout(() => setToast(''), 2200);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Demos</h1><p>What you showed, to whom, from this browser. Send a leave-behind so the prospect can replay the scenarios they saw.</p></div>
        {entries.length > 0 && <button className="btn ghost" onClick={() => { clearHistory(); setEntries([]); }}>Clear history</button>}
      </div>

      <div className="card" style={{ padding: 18, display: 'grid', gap: 10 }}>
        <div className="field">
          <label htmlFor="sr">Tracked-link code (optional)</label>
          <input id="sr" className="input mono" placeholder="From Network Admin, Growth, Links" value={sr} onChange={(e) => setSr(e.target.value.trim())} style={{ maxWidth: 360 }} />
          <span className="help">Add one and the leave-behind reports opens and scenario views to Growth, like the decks do.</span>
        </div>
      </div>

      {people.length === 0 ? (
        <div className="card" style={{ padding: 28 }}><h3>No demos yet</h3><p className="muted" style={{ marginTop: 6 }}>Play any scenario and it appears here, grouped by prospect.</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Prospect</th><th>Last shown</th><th>Scenarios</th><th>Live runs</th><th>Leave-behind</th></tr></thead>
            <tbody>
              {people.map((p) => {
                const url = leaveBehindUrl(location.origin, { prospect: p.prospect === 'No prospect set' ? '' : p.prospect, industry: p.industry, market: p.market, scenarios: p.scenarios.map((s) => s.id), sr: sr || undefined });
                return (
                  <tr key={p.prospect}>
                    <td><b>{p.prospect}</b><br /><span className="faint small">{p.industry} · {p.market.toUpperCase()}</span></td>
                    <td className="small">{new Date(p.last).toLocaleString()}</td>
                    <td className="small">{p.scenarios.map((s) => s.title).join(', ')}</td>
                    <td className="mono small">{p.live}</td>
                    <td><div className="row"><button className="btn sm" onClick={() => copy(url)}><IcCopy width={14} /> Copy link</button><a className="btn ghost sm" href={url} target="_blank" rel="noreferrer" aria-label="Open the leave-behind"><IcExternal width={14} /></a></div></td>
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
