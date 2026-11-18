/* A per-rep log of what was shown to whom, kept in this browser. It feeds the
   Demos page and the leave-behind link. */

export interface DemoEntry {
  at: string;
  prospect: string;
  industry: string;
  market: string;
  scenarioId: string;
  scenarioTitle: string;
  variant: 'genuine' | 'attack' | 'nosense' | 'live';
  liveSessionId?: string;
  liveOutcome?: string;
}

const KEY = 'xyz-demo-history-v1';
const MAX = 300;

export function loadHistory(): DemoEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function logDemo(e: Omit<DemoEntry, 'at'>): void {
  try {
    const all = loadHistory();
    const last = all[0];
    // Replaying the same variant within a minute counts once.
    if (last && last.scenarioId === e.scenarioId && last.variant === e.variant && last.prospect === e.prospect && Date.now() - Date.parse(last.at) < 60_000 && !e.liveSessionId) return;
    all.unshift({ ...e, at: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function clearHistory(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export interface ProspectSummary {
  prospect: string;
  industry: string;
  market: string;
  last: string;
  scenarios: { id: string; title: string; count: number }[];
  live: number;
}

export function summarise(entries: DemoEntry[]): ProspectSummary[] {
  const by = new Map<string, ProspectSummary>();
  for (const e of entries) {
    const key = e.prospect || 'No prospect set';
    let p = by.get(key);
    if (!p) { p = { prospect: key, industry: e.industry, market: e.market, last: e.at, scenarios: [], live: 0 }; by.set(key, p); }
    if (e.at > p.last) p.last = e.at;
    if (e.variant === 'live') p.live++;
    const s = p.scenarios.find((x) => x.id === e.scenarioId);
    if (s) s.count++; else p.scenarios.push({ id: e.scenarioId, title: e.scenarioTitle, count: 1 });
  }
  return [...by.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
}

/** Leave-behind link: scripted replays only, branded for the prospect. Carries a tracked-link code when the rep has one. */
export function leaveBehindUrl(origin: string, opts: { prospect: string; industry: string; market: string; scenarios: string[]; sr?: string }): string {
  const q = new URLSearchParams();
  if (opts.prospect) q.set('for', opts.prospect);
  q.set('ind', opts.industry);
  q.set('mkt', opts.market);
  if (opts.scenarios.length) q.set('s', opts.scenarios.join(','));
  if (opts.sr) q.set('sr', opts.sr);
  return `${origin}/xyz/replay?${q.toString()}`;
}
