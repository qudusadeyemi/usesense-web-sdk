import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { FlowAppearance } from '@usesense/web-sdk';
import { INDUSTRIES, MARKETS, type Industry, type IndustryId, type Market, type MarketId } from './presets';

export type LiveMode = 'sandbox' | 'live' | 'off';

/** Brand fields imported from the prospect's website beyond name, logo and colour. */
export interface SiteBrand {
  host?: string;
  logoDark?: string;
  /** Text on the primary colour, contrast-checked by the import. */
  onBrand?: string;
  accent?: string;
  ink?: string;
  displayFamily?: string;
  fontFamily?: string;
  /** Google Fonts @import or @font-face block, as the import returns it. */
  fontCss?: string;
  headingCase?: 'upper' | 'none';
  buttonRadius?: number;
  buttonStyle?: 'filled' | 'outline';
  /** Which import paths came from the website (the rest were set by the rep). */
  sources?: Record<string, 'website'>;
}

export interface DemoSettings {
  prospect: string;
  /** The website the brand was imported from, if any. */
  website: string;
  site: SiteBrand | null;
  /** The prospect's own logo file as a data URL. Never redrawn. */
  logo: string | null;
  brandColor: string | null;
  industry: IndustryId;
  market: MarketId;
  liveMode: LiveMode;
  sandboxKey: string;
  liveKey: string;
  apiBaseUrl: string;
  /** Set once the rep has accepted that production keys spend real credits. */
  liveCostAccepted: boolean;
}

export const DEFAULT_SETTINGS: DemoSettings = {
  prospect: '',
  website: '',
  site: null,
  logo: null,
  brandColor: null,
  industry: 'bank',
  market: 'gb',
  liveMode: 'sandbox',
  sandboxKey: '',
  liveKey: '',
  apiBaseUrl: 'https://api.usesense.ai',
  liveCostAccepted: false,
};

const KEY = 'xyz-demo-settings-v1';

function load(key: string): DemoSettings {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<DemoSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export interface Brand {
  name: string;
  short: string;
  logo: string | null;
  /** A logo variant for dark surfaces, when the site has one. */
  logoDark: string | null;
  color: string;
  coBranded: boolean;
  /** Text on the brand colour. */
  onBrand: string;
  site: SiteBrand | null;
}

export interface DemoContextValue {
  settings: DemoSettings;
  update: (patch: Partial<DemoSettings>) => void;
  reset: () => void;
  market: Market;
  industry: Industry;
  brand: Brand;
  /** The key for the selected live mode, or '' when live checks are off. */
  activeKey: string;
}

const Ctx = createContext<DemoContextValue | null>(null);

export const XYZ_GREEN = '#0F5C4A';

const HEX = /^#[0-9a-f]{6}$/i;

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** White or near-black text, whichever reads better on the colour. */
export function textOn(hex: string): string {
  if (!HEX.test(hex)) return '#ffffff';
  return contrast(hex, '#ffffff') >= contrast(hex, '#0B1F1A') ? '#ffffff' : '#0B1F1A';
}

export function brandFor(s: Pick<DemoSettings, 'prospect' | 'logo' | 'brandColor'> & { site?: SiteBrand | null }): Brand {
  const name = s.prospect.trim() || 'XYZ Bank';
  const short = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'XYZ';
  const color = s.brandColor || XYZ_GREEN;
  const site = s.site ?? null;
  // Use the site's text-on-brand only if it still reads on the current colour.
  const onBrand = site?.onBrand && HEX.test(site.onBrand) && HEX.test(color) && contrast(color, site.onBrand) >= 4.5 ? site.onBrand : textOn(color);
  return {
    name, short: s.prospect.trim() ? short : 'XYZ', logo: s.logo, logoDark: site?.logoDark ?? null,
    color, coBranded: !!s.prospect.trim(), onBrand, site,
  };
}

/** The prospect's brand as the SDK's white-label appearance (BRAND-v1), so the
    real face check looks like their app too. Success, warning and error stay
    Sense's, as in Watchtower. */
export function appearanceOf(b: Brand, opts: { inlineAssets?: boolean } = {}): FlowAppearance {
  const inline = opts.inlineAssets ?? true;
  const site = b.site;
  const a: FlowAppearance = { colors: { primary: b.color, primaryForeground: b.onBrand } };
  if (site?.ink && HEX.test(site.ink) && contrast(site.ink, '#ffffff') >= 4.5) a.colors!.foreground = site.ink;
  const t: NonNullable<FlowAppearance['typography']> = {};
  if (site?.fontFamily) t.fontFamily = site.fontFamily;
  if (site?.displayFamily) t.displayFamily = site.displayFamily;
  // A big @font-face block would not fit the QR link; Google Fonts imports are short.
  if (site?.fontCss && (inline || site.fontCss.length <= 400)) t.fontCss = site.fontCss;
  if (Object.keys(t).length) a.typography = t;
  if (site?.buttonRadius !== undefined || site?.buttonStyle) {
    a.shape = { ...(site.buttonRadius !== undefined ? { buttonRadius: Math.min(site.buttonRadius, 999) } : {}), ...(site.buttonStyle ? { buttonStyle: site.buttonStyle } : {}) };
  }
  if (b.logo && (inline || (!b.logo.startsWith('data:') && b.logo.length <= 300))) {
    a.logo = { url: b.logo, placement: 'header' };
    // The logo is drawn for light backgrounds, so keep the page light (the camera is always dark).
    a.mode = 'light';
  }
  return a;
}

export function DemoProvider({ children, storageKey = KEY, initial }: { children: ReactNode; storageKey?: string; initial?: Partial<DemoSettings> }) {
  const [settings, setSettings] = useState<DemoSettings>(() => ({ ...load(storageKey), ...(initial ?? {}) }));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
      /* storage full or blocked: settings still work for this tab */
    }
  }, [settings, storageKey]);

  const update = useCallback((patch: Partial<DemoSettings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const reset = useCallback(() => setSettings({ ...DEFAULT_SETTINGS, sandboxKey: settings.sandboxKey, liveKey: settings.liveKey }), [settings.sandboxKey, settings.liveKey]);

  const value = useMemo<DemoContextValue>(() => {
    const market = MARKETS[settings.market] ?? MARKETS.gb;
    const industry = INDUSTRIES[settings.industry] ?? INDUSTRIES.bank;
    const activeKey = settings.liveMode === 'off' ? '' : settings.liveMode === 'live' ? settings.liveKey.trim() : settings.sandboxKey.trim();
    return { settings, update, reset, market, industry, brand: brandFor(settings), activeKey };
  }, [settings, update, reset]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo(): DemoContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDemo must be used inside DemoProvider');
  return v;
}
