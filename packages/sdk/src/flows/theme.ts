// Flow runner theme + the FlowAppearance white-label contract.
//
// FlowAppearance is the single customization schema shared across surfaces and
// SDKs (Phase 1 of the white-label initiative). It can be supplied two ways and
// is merged SDK-init > server(branding) > built-in default:
//   - by the developer at SDK init (`appearance` run option), and/or
//   - by the operator in the dashboard, delivered in the branding payload.
// Every field is optional; anything omitted falls back to the hosted-page tokens.

import { useEffect, useState } from 'react';
import { BRAND_FONT_CSS } from './fonts/brand-fonts';

// ─── Resolved theme (what components consume) ────────────────────────────────

export interface FlowTheme {
  bg: string; fg: string; muted: string; card: string; border: string;
  primary: string; primaryFg: string;
  success: string; destructive: string; warning: string;
  fontDisplay: string; fontBody: string;
  radius: number; buttonRadius: number; buttonStyle: 'filled' | 'outline';
  backgroundImage?: string;
  isDark: boolean;
}

// ─── FlowAppearance: the white-label contract (Phase 1) ──────────────────────

/** A palette layer. `dark` overrides apply only in dark mode. */
export interface AppearanceColors {
  primary?: string;
  primaryForeground?: string;
  background?: string;
  surface?: string;
  foreground?: string;
  muted?: string;
  border?: string;
  success?: string;
  error?: string;
  warning?: string;
  /** Overrides applied on top of the dark base (e.g. a darker background). */
  dark?: Omit<AppearanceColors, 'dark'>;
}

export interface AppearanceTypography {
  /** Body font-family stack (e.g. "'DM Sans', system-ui, sans-serif"). */
  fontFamily?: string;
  /** Heading/display font-family; defaults to fontFamily when omitted. */
  displayFamily?: string;
  /** A CSS @import / stylesheet URL or @font-face block to load custom fonts.
   *  When set, the bundled brand fonts are NOT injected. */
  fontCss?: string;
}

export interface AppearanceShape {
  /** Base corner radius in px (cards, inputs). */
  radius?: number;
  /** Button corner radius in px; defaults to radius. */
  buttonRadius?: number;
  buttonStyle?: 'filled' | 'outline';
}

export interface FlowAppearance {
  colors?: AppearanceColors;
  typography?: AppearanceTypography;
  shape?: AppearanceShape;
  logo?: { url?: string; placement?: 'header' | 'center' | 'none'; height?: number };
  background?: { color?: string; imageUrl?: string };
  /** Force a palette or follow the OS (default 'auto'). */
  mode?: 'light' | 'dark' | 'auto';
}

// ─── Built-in defaults (the hosted-page tokens) ──────────────────────────────

const FONT_DISPLAY = "'Outfit', system-ui, -apple-system, Segoe UI, sans-serif";
const FONT_BODY = "'DM Sans', system-ui, -apple-system, Segoe UI, sans-serif";

const LIGHT_BASE: FlowTheme = {
  bg: '#FDFCFA', fg: '#1C1A17', muted: '#6B6760', card: '#F5F3EF', border: '#E8E5DE',
  primary: '#4F7CFF', primaryFg: '#FFFFFF',
  success: '#00D4AA', destructive: '#FF6B4A', warning: '#FFB84D',
  fontDisplay: FONT_DISPLAY, fontBody: FONT_BODY,
  radius: 12, buttonRadius: 12, buttonStyle: 'filled', isDark: false,
};
const DARK_BASE: FlowTheme = {
  ...LIGHT_BASE,
  bg: '#1C1A17', fg: '#F5F3EF', muted: '#9E9A92', card: '#2A2723', border: 'rgba(255,255,255,0.08)',
  isDark: true,
};

// Back-compat exports (used elsewhere).
export const LIGHT_THEME = LIGHT_BASE;
export const DARK_THEME = DARK_BASE;
export type ThemePreference = 'light' | 'dark' | 'auto';

// ─── Resolution: FlowAppearance -> FlowTheme ─────────────────────────────────

/** Deep-merge a higher-priority appearance over a lower one (for SDK > server). */
export function mergeAppearance(
  high: FlowAppearance | undefined,
  low: FlowAppearance | undefined,
): FlowAppearance | undefined {
  if (!high) return low;
  if (!low) return high;
  return {
    ...low, ...high,
    colors: { ...low.colors, ...high.colors, dark: { ...low.colors?.dark, ...high.colors?.dark } },
    typography: { ...low.typography, ...high.typography },
    shape: { ...low.shape, ...high.shape },
    logo: { ...low.logo, ...high.logo },
    background: { ...low.background, ...high.background },
  };
}

function applyColors(base: FlowTheme, c: AppearanceColors | undefined, dark: boolean): FlowTheme {
  if (!c) return base;
  const layer = dark ? { ...c, ...c.dark } : c;
  return {
    ...base,
    primary: layer.primary ?? base.primary,
    primaryFg: layer.primaryForeground ?? base.primaryFg,
    bg: layer.background ?? base.bg,
    card: layer.surface ?? base.card,
    fg: layer.foreground ?? base.fg,
    muted: layer.muted ?? base.muted,
    border: layer.border ?? base.border,
    success: layer.success ?? base.success,
    destructive: layer.error ?? base.destructive,
    warning: layer.warning ?? base.warning,
  };
}

/** Build the resolved theme for a given mode from an appearance object. */
export function resolveTheme(appearance: FlowAppearance | undefined, dark: boolean): FlowTheme {
  let t: FlowTheme = dark ? { ...DARK_BASE } : { ...LIGHT_BASE };
  if (!appearance) return t;
  t = applyColors(t, appearance.colors, dark);
  const ty = appearance.typography;
  if (ty?.fontFamily) t.fontBody = ty.fontFamily;
  if (ty?.displayFamily ?? ty?.fontFamily) t.fontDisplay = (ty.displayFamily ?? ty.fontFamily)!;
  const sh = appearance.shape;
  if (typeof sh?.radius === 'number') t.radius = sh.radius;
  t.buttonRadius = sh?.buttonRadius ?? sh?.radius ?? t.buttonRadius;
  if (sh?.buttonStyle) t.buttonStyle = sh.buttonStyle;
  if (appearance.background?.imageUrl) t.backgroundImage = appearance.background.imageUrl;
  if (appearance.background?.color) t.bg = appearance.background.color;
  return t;
}

const prefersDark = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

/**
 * Resolve the active theme from a merged FlowAppearance. `mode: 'auto'` (default)
 * follows the OS and updates live.
 */
export function useFlowTheme(appearance?: FlowAppearance): FlowTheme {
  const mode = appearance?.mode ?? 'auto';
  const [dark, setDark] = useState<boolean>(() => mode === 'dark' || (mode === 'auto' && prefersDark()));

  useEffect(() => {
    if (mode !== 'auto' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', onChange);
    setDark(mq.matches);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  const isDark = mode === 'dark' ? true : mode === 'light' ? false : dark;
  return resolveTheme(appearance, isDark);
}

/**
 * Inject brand fonts once. Uses the appearance's custom `fontCss` when provided,
 * otherwise the bundled Outfit + DM Sans. Idempotent; degrades to the system
 * stack if a host CSP blocks the injection.
 */
let fontsInjected = false;
export function injectBrandFonts(appearance?: FlowAppearance): void {
  if (fontsInjected || typeof document === 'undefined') return;
  fontsInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-usesense-flow-fonts', '');
  style.textContent = appearance?.typography?.fontCss ?? BRAND_FONT_CSS;
  document.head.appendChild(style);
}
