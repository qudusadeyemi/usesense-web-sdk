import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { INDUSTRIES, MARKETS, type Industry, type IndustryId, type Market, type MarketId } from './presets';

export type LiveMode = 'sandbox' | 'live' | 'off';

export interface DemoSettings {
  prospect: string;
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
  color: string;
  coBranded: boolean;
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

export function brandFor(s: Pick<DemoSettings, 'prospect' | 'logo' | 'brandColor'>): Brand {
  const name = s.prospect.trim() || 'XYZ Bank';
  const short = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'XYZ';
  return { name, short: s.prospect.trim() ? short : 'XYZ', logo: s.logo, color: s.brandColor || XYZ_GREEN, coBranded: !!s.prospect.trim() };
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
