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
}

export interface PublicShare {
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
  create: (page: SharePage, sr?: string) =>
    wtCall<{ share: ShareSummary }>('/demo-shares', { method: 'POST', body: JSON.stringify({ page, ...(sr ? { sr } : {}) }) }),
  list: () => wtCall<{ shares: ShareSummary[] }>('/demo-shares'),
  revoke: (id: string) => wtCall<{ share: ShareSummary }>(`/demo-shares/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export const publicShareApi = {
  get: (id: string) => wtCall<PublicShare>(`/public/demo/${encodeURIComponent(id)}`, {}, { signedIn: false }),
  startCheck: (id: string) =>
    wtCall<{ session: CaptureSessionData; checksLeft: number; attempt: number }>(`/public/demo/${encodeURIComponent(id)}/checks`, { method: 'POST' }, { signedIn: false }),
  result: (id: string, sessionId: string) =>
    wtCall<{ result: SessionDetails }>(`/public/demo/${encodeURIComponent(id)}/checks/${encodeURIComponent(sessionId)}`, {}, { signedIn: false }),
};
