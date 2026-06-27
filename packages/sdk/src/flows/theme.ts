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
  icons?: AppearanceIcons;
  loader?: AppearanceLoader;
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

/** Custom illustration/icon overrides (image URLs replacing built-in glyphs). */
export interface AppearanceIcons {
  /** Success result screen. */ success?: string;
  /** Under-review result screen. */ review?: string;
  /** Not-verified result screen. */ notVerified?: string;
  /** Any other named slot (e.g. info bullet ids) by URL. */
  [slot: string]: string | undefined;
}

/** Loading animation: a built-in preset or a custom asset. */
export interface AppearanceLoader {
  /** Built-in preset. Default 'spinner'. */
  style?: 'spinner' | 'dots' | 'bar';
  /** Custom loader asset (GIF / animated SVG / Lottie-as-image URL); overrides style. */
  imageUrl?: string;
}

export interface FlowAppearance {
  colors?: AppearanceColors;
  typography?: AppearanceTypography;
  shape?: AppearanceShape;
  logo?: { url?: string; placement?: 'header' | 'center' | 'none'; height?: number };
  background?: { color?: string; imageUrl?: string };
  /** Custom illustrations for result screens / icon slots. */
  icons?: AppearanceIcons;
  /** Loading-animation preset or custom asset. */
  loader?: AppearanceLoader;
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
    icons: { ...low.icons, ...high.icons },
    loader: { ...low.loader, ...high.loader },
  };
}

/** A blank/whitespace override is treated as unset (falls back), so a cleared
 *  dashboard color field never blanks the UI with an invalid CSS value. */
const pick = (v: string | undefined, fallback: string): string =>
  v != null && v.trim().length > 0 ? v : fallback;

function applyColors(base: FlowTheme, c: AppearanceColors | undefined, dark: boolean): FlowTheme {
  if (!c) return base;
  const layer = dark ? { ...c, ...c.dark } : c;
  return {
    ...base,
    primary: pick(layer.primary, base.primary),
    primaryFg: pick(layer.primaryForeground, base.primaryFg),
    bg: pick(layer.background, base.bg),
    card: pick(layer.surface, base.card),
    fg: pick(layer.foreground, base.fg),
    muted: pick(layer.muted, base.muted),
    border: pick(layer.border, base.border),
    success: pick(layer.success, base.success),
    destructive: pick(layer.error, base.destructive),
    warning: pick(layer.warning, base.warning),
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
  // background.color is a single (light) color; in dark mode the dark palette
  // (or colors.dark.background) wins, so it never paints a light bg over dark.
  if (!dark && appearance.background?.color) t.bg = appearance.background.color;
  if (appearance.icons) t.icons = appearance.icons;
  if (appearance.loader) t.loader = appearance.loader;
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
let bundledInjected = false;
let injectedFontCss: string | null = null;
export function injectBrandFonts(appearance?: FlowAppearance): void {
  if (typeof document === 'undefined') return;
  const css = appearance?.typography?.fontCss;
  // Custom fontCss can arrive from the SERVER after mount, so this must run when
  // it changes — not just once. Reuse one <style> tag; only re-write on change.
  if (css) {
    if (injectedFontCss === css) return;
    injectedFontCss = css;
    let el = document.head.querySelector<HTMLStyleElement>('style[data-usesense-flow-fonts]');
    if (!el) {
      el = document.createElement('style');
      el.setAttribute('data-usesense-flow-fonts', '');
      document.head.appendChild(el);
    }
    el.textContent = css;
    return;
  }
  // No custom fonts: inject the bundled brand fonts once (unless custom already did).
  if (bundledInjected || injectedFontCss) return;
  bundledInjected = true;
  const el = document.createElement('style');
  el.setAttribute('data-usesense-flow-fonts', '');
  el.textContent = BRAND_FONT_CSS;
  document.head.appendChild(el);
}
