/* Prospect links: try.usesense.ai/xyz/p/:id. A rep creates one from Demos;
   Watchtower keeps it (14 days, 5 face checks) and starts each check in the
   Sense Demo sandbox org with a key it holds, so no key reaches a browser.
   Server side: watchtower-api modules/demo-shares. */
import type { CaptureSessionData } from '@usesense/web-sdk';
import type { DemoSettings, SiteBrand } from './settings';
import type { SessionDetails } from './live';
import { wtCall } from './watchtower';

export interface SharePage {
  prospect: string;
  industry: string;
  market: string;
  scenarios: string[];
  website: string;
  brand: { color: string | null; logo: string | null; logoDark: string | null; site: SiteBrand | null };
}

export interface ShareSummary {
  id: string;
  prospect: string;
  scenarios: string[];
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
  expired: boolean;
  checksUsed: number;
  maxChecks: number;
  views: number;
  kind?: 'prospect' | 'booth';
  /** Browsers that opened it; 2 or more usually means it was forwarded. */
  visitors?: number;
  outcomes?: (string | null)[];
  lastActivityAt?: string | null;
}

export interface ShareEvent {
  at: string;
  kind: 'open' | 'check' | 'result' | 'cta';
  detail?: string;
  newVisitor?: boolean;
}

export interface PublicShare {
  kind?: 'prospect' | 'booth';
  page: SharePage;
  sr: string | null;
  expiresAt: string;
  live: boolean;
  checksLeft: number;
  from: string;
}

/** Brand fields the server keeps (it drops anything else). */
function siteForShare(site: SiteBrand | null): SiteBrand | null {
  if (!site) return null;
  // logoDark travels once, at the top of the brand.
  const { sources: _sources, logoDark: _logoDark, ...rest } = site;
  return rest;
}

/** The page a link shows. The brand is only included when it is this prospect's. */
export function pageFor(s: DemoSettings, row: { prospect: string; industry: string; market: string; scenarios: string[] }): SharePage {
  const same = !!row.prospect && row.prospect === s.prospect;
  return {
    prospect: row.prospect,
    industry: row.industry,
    market: row.market,
    scenarios: row.scenarios,
    website: same ? s.website : '',
    brand: same
      ? { color: s.brandColor, logo: s.logo, logoDark: s.site?.logoDark ?? null, site: siteForShare(s.site) }
      : { color: null, logo: null, logoDark: null, site: null },
  };
}

/** Back from the server into the app's settings, for the public page. */
export function settingsFor(page: SharePage): Partial<DemoSettings> {
  const site = page.brand.site ? { ...page.brand.site, ...(page.brand.logoDark ? { logoDark: page.brand.logoDark } : {}) } : page.brand.logoDark ? { logoDark: page.brand.logoDark } : null;
  return {
    prospect: page.prospect,
    industry: page.industry as DemoSettings['industry'],
    market: page.market as DemoSettings['market'],
    logo: page.brand.logo,
    brandColor: page.brand.color,
    website: page.website,
    site,
    liveMode: 'off',
    sandboxKey: '',
    liveKey: '',
  };
}

export const shareUrl = (origin: string, id: string) => `${origin}/xyz/p/${id}`;

export const sharesApi = {
  create: (page: SharePage, sr?: string, kind: 'prospect' | 'booth' = 'prospect') =>
    wtCall<{ share: ShareSummary }>('/demo-shares', { method: 'POST', body: JSON.stringify({ page, kind, ...(sr ? { sr } : {}) }) }),
  detail: (id: string) => wtCall<{ share: ShareSummary; events: ShareEvent[] }>(`/demo-shares/${encodeURIComponent(id)}`),
  list: () => wtCall<{ shares: ShareSummary[] }>('/demo-shares'),
  revoke: (id: string) => wtCall<{ share: ShareSummary }>(`/demo-shares/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export const publicShareApi = {
  get: (id: string, visit?: { v: string; d: 'phone' | 'desktop' }) =>
    wtCall<PublicShare>(`/public/demo/${encodeURIComponent(id)}${visit ? `?v=${encodeURIComponent(visit.v)}&d=${visit.d}` : ''}`, {}, { signedIn: false }),
  event: (id: string, label: string) =>
    wtCall<void>(`/public/demo/${encodeURIComponent(id)}/events`, { method: 'POST', body: JSON.stringify({ kind: 'cta', label }) }, { signedIn: false }).catch(() => {}),
  startCheck: (id: string) =>
    wtCall<{ session: CaptureSessionData; checksLeft: number; attempt: number }>(`/public/demo/${encodeURIComponent(id)}/checks`, { method: 'POST' }, { signedIn: false }),
  result: (id: string, sessionId: string) =>
    wtCall<{ result: SessionDetails }>(`/public/demo/${encodeURIComponent(id)}/checks/${encodeURIComponent(sessionId)}`, {}, { signedIn: false }),
};

export const boothUrl = (origin: string, id: string) => `${origin}/xyz/b/${id}`;

/** A random id for this browser, so the rep can tell a forwarded open from a repeat visit. */
export function visitorId(): string {
  try {
    let v = localStorage.getItem('xyz-visitor');
    if (!v) { v = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20); localStorage.setItem('xyz-visitor', v); }
    return v;
  } catch {
    return '';
  }
}

/** Where a link stands, as the rep sees it. */
export function shareState(s: ShareSummary, now = Date.now()): { label: string; tone: 'ok' | 'warn' | 'off' | 'plain' } {
  if (s.revoked) return { label: 'Switched off', tone: 'off' };
  if (s.expired) return { label: 'Ended', tone: 'off' };
  if ((s.visitors ?? 0) > 1 || s.checksUsed > 1) return { label: 'Engaged', tone: 'ok' };
  if (!(s.visitors ?? 0) && now - Date.parse(s.createdAt) > 2 * 86_400_000) return { label: 'Nudge', tone: 'warn' };
  if (!(s.visitors ?? 0)) return { label: 'Sent', tone: 'plain' };
  return { label: 'Opened', tone: 'plain' };
}

/** A timeline row in plain words. */
export function describeEvent(e: ShareEvent): string {
  switch (e.kind) {
    case 'open': return e.newVisitor ? `Opened by someone new, on a ${e.detail ?? 'device'} (forwarded)` : `Opened on a ${e.detail ?? 'device'}`;
    case 'check': return e.detail === '1' ? 'Started a face check' : `Started face check ${e.detail}`;
    case 'result': return /approve|let|accept/i.test(e.detail ?? '') ? 'Face check: Let through' : /reject|block|stop|deny/i.test(e.detail ?? '') ? 'Face check: Stopped' : 'Face check: In review';
    case 'cta': return ({ book: 'Asked for a follow-up call', scan: 'Opened the free fraud scan', sandbox: 'Went to start free in the sandbox', share: 'Copied the link to share', tour: 'Opened the platform tour', watch: 'Watched the attacks' } as Record<string, string>)[e.detail ?? ''] ?? (e.detail?.startsWith('tab:') ? `Read the ${e.detail.slice(4)} view` : 'Clicked a next step');
  }
}
