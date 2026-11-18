/* Import a prospect's brand from their website, with the same pipeline
   Watchtower's Brand page uses. It runs through the staff endpoint
   (watchtower-api /demo-shares/brand-import), which any Sense staff account
   can use and which writes nothing to any org. The chosen fields are kept in
   this browser only. */
import { AUTH_DISABLED } from './auth';
import { wtCall, type WatchtowerError } from './watchtower';
import type { DemoSettings, SiteBrand } from './settings';

export type BrandImportPath =
  | 'display_name' | 'appearance.logo.url' | 'appearance.logo.darkUrl' | 'appearance.colors.primary'
  | 'appearance.colors.primaryForeground' | 'appearance.colors.accent' | 'appearance.colors.foreground'
  | 'appearance.typography.displayFamily' | 'appearance.typography.fontFamily' | 'appearance.typography.fontCss'
  | 'appearance.typography.headingCase' | 'appearance.shape.buttonRadius' | 'appearance.shape.buttonStyle';

export interface BrandImportStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'failed';
  note?: string;
}

export interface BrandImportResult {
  /** What the website says the business is, as Watchtower's onboarding reads it. */
  suggestion?: { sector?: string | null };
  url: string;
  host: string;
  fields: Partial<Record<BrandImportPath, { value: string | number; source: string; note?: string }>>;
  missing: { path: BrandImportPath; reason: string }[];
  contrast?: { primary: string; foreground: string; ratio: number; passes: boolean };
  palette: string[];
  notes: string[];
  failure?: { code: string; message: string };
}

export interface BrandImportJob {
  id: string;
  url: string;
  status: 'running' | 'done' | 'failed';
  steps: BrandImportStep[];
  result?: BrandImportResult;
  error?: { code: string; message: string };
}

/** The same labels, in the same order, as Watchtower's import sheet. */
export const LABELS: Record<BrandImportPath, string> = {
  display_name: 'Name',
  'appearance.logo.url': 'Logo',
  'appearance.logo.darkUrl': 'Logo on dark backgrounds',
  'appearance.colors.primary': 'Primary colour',
  'appearance.colors.primaryForeground': 'Text on buttons',
  'appearance.colors.accent': 'Accent colour',
  'appearance.colors.foreground': 'Text colour',
  'appearance.typography.displayFamily': 'Heading font',
  'appearance.typography.fontFamily': 'Body font',
  'appearance.typography.fontCss': 'Font files',
  'appearance.typography.headingCase': 'Heading case',
  'appearance.shape.buttonRadius': 'Button corners',
  'appearance.shape.buttonStyle': 'Button style',
};
export const ORDER = Object.keys(LABELS) as BrandImportPath[];

export class ImportError extends Error {}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await wtCall<T>(path, init);
  } catch (e) {
    const w = e as WatchtowerError;
    if (w.code === 'signed_out') throw new ImportError(AUTH_DISABLED ? 'Website import needs a Watchtower sign-in, which is off in this local build. Upload the logo instead.' : 'Your sign-in has expired. Sign in again to import a brand.');
    if (w.status === 403 && w.code === 'forbidden') throw new ImportError('Website import is for Sense staff accounts. Upload the logo instead.');
    if (w.status === 403 && /mfa/.test(w.code)) throw new ImportError('Watchtower wants your two-step code first. Sign in to Watchtower once, then try again.');
    if (w.status === 401) throw new ImportError('Your sign-in has expired. Sign in again to import a brand.');
    throw new ImportError(w.status ? w.message : 'Couldn’t reach Watchtower. Check the connection and try again.');
  }
}

export const brandImportApi = {
  start: (url: string) => call<{ job: BrandImportJob }>('/demo-shares/brand-import', {
    method: 'POST',
    body: JSON.stringify({ url }),
  }),
  get: (id: string) => call<{ job: BrandImportJob }>(`/demo-shares/brand-import/${encodeURIComponent(id)}`),
};

/** "https://www.acme.com/about" or "acme.com" -> "acme.com". Null if it isn't a web address. */
export function cleanWebsite(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname)) return null;
    return u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '');
  } catch {
    return null;
  }
}

/** The fields shown with a checkbox (text on buttons follows the primary colour). */
export function foundPaths(r: BrandImportResult): BrandImportPath[] {
  return ORDER.filter((p) => r.fields[p] && p !== 'appearance.colors.primaryForeground');
}

/** Whether the rep already set this field by hand (so it starts unticked, like Watchtower's "kept"). */
export function setByRep(s: DemoSettings, p: BrandImportPath): boolean {
  const fromSite = s.site?.sources?.[p] === 'website';
  if (fromSite) return false;
  if (p === 'display_name') return !!s.prospect.trim();
  if (p === 'appearance.logo.url') return !!s.logo;
  if (p === 'appearance.colors.primary') return !!s.brandColor;
  return false;
}

/** Merge the chosen fields into the demo settings. Pure, for the preview and the tests. */
export function applyImport(s: DemoSettings, r: BrandImportResult, chosen: BrandImportPath[]): Partial<DemoSettings> {
  const pick = new Set(chosen);
  if (pick.has('appearance.colors.primary') && r.fields['appearance.colors.primaryForeground']) pick.add('appearance.colors.primaryForeground');
  const v = (p: BrandImportPath) => (pick.has(p) ? r.fields[p]?.value : undefined);
  const str = (p: BrandImportPath) => { const x = v(p); return typeof x === 'string' && x.trim() ? x.trim() : undefined; };

  const site: SiteBrand = { ...(s.site ?? {}), host: r.host, sources: { ...(s.site?.sources ?? {}) } };
  const patch: Partial<DemoSettings> = { website: r.host };
  const mark = (p: BrandImportPath) => { site.sources![p] = 'website'; };

  const name = str('display_name');
  if (name) { patch.prospect = name.slice(0, 40); mark('display_name'); }
  const logo = str('appearance.logo.url');
  if (logo) { patch.logo = logo; mark('appearance.logo.url'); }
  const primary = str('appearance.colors.primary');
  if (primary) { patch.brandColor = primary; mark('appearance.colors.primary'); }

  const fill = <K extends keyof SiteBrand>(p: BrandImportPath, key: K, val: SiteBrand[K] | undefined) => {
    if (val === undefined) return;
    site[key] = val;
    mark(p);
  };
  fill('appearance.logo.darkUrl', 'logoDark', str('appearance.logo.darkUrl'));
  fill('appearance.colors.primaryForeground', 'onBrand', str('appearance.colors.primaryForeground'));
  fill('appearance.colors.accent', 'accent', str('appearance.colors.accent'));
  fill('appearance.colors.foreground', 'ink', str('appearance.colors.foreground'));
  fill('appearance.typography.displayFamily', 'displayFamily', str('appearance.typography.displayFamily'));
  fill('appearance.typography.fontFamily', 'fontFamily', str('appearance.typography.fontFamily'));
  fill('appearance.typography.fontCss', 'fontCss', str('appearance.typography.fontCss'));
  const hc = str('appearance.typography.headingCase');
  fill('appearance.typography.headingCase', 'headingCase', hc === 'upper' ? 'upper' : hc ? 'none' : undefined);
  const br = v('appearance.shape.buttonRadius');
  fill('appearance.shape.buttonRadius', 'buttonRadius', typeof br === 'number' && Number.isFinite(br) ? br : undefined);
  const bs = str('appearance.shape.buttonStyle');
  fill('appearance.shape.buttonStyle', 'buttonStyle', bs === 'outline' ? 'outline' : bs ? 'filled' : undefined);

  patch.site = site;
  return patch;
}

/** Watchtower's job speaks to the brand owner ("your logo"); here the rep reads it about a prospect. */
export function theirs(text: string): string {
  return text
    .replace(/\bwhat you do\b/gi, (m) => (m[0] === 'W' ? 'What they do' : 'what they do'))
    .replace(/\byou're\b|\byou’re\b/gi, (m) => (m[0] === 'Y' ? 'They’re' : 'they’re'))
    .replace(/\byours\b/gi, (m) => (m[0] === 'Y' ? 'Theirs' : 'theirs'))
    .replace(/\byour\b/gi, (m) => (m[0] === 'Y' ? 'Their' : 'their'));
}
