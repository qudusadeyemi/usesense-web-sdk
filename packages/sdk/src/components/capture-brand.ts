/**
 * Wiring between the capture engine's props and the BRAND-v1 resolver: which
 * prop is which layer, the device's colour scheme, and the brand's fonts.
 */

import { useEffect, useState } from 'react';
import { mergeAppearance, type FlowAppearance } from '../flows/theme';
import type { FlowCopy } from '../flows/copy';
import { resolveCaptureTheme, type CaptureServerBranding } from '../capture/capture-theme';
import { CaptureStrings, mergeCaptureCopy, type CaptureCopy } from '../capture/capture-copy';
import type { EngineTheme } from './styles';
import type { CaptureBrand } from './ExtraCheck';

/** True while the device prefers a dark colour scheme (live). */
export function usePrefersDark(): boolean {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState<boolean>(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    setDark(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return dark;
}

/**
 * A hand-built EngineTheme (no `appearance`) as a code-layer appearance. Its
 * colours were chosen for whatever mode the host shows, so they apply in
 * both modes; `mode` stays unset (capture pages stay dark unless set).
 */
export function engineThemeToAppearance(t: EngineTheme | undefined): FlowAppearance | undefined {
  if (!t) return undefined;
  if (t.appearance) return t.appearance;
  const palette = {
    background: t.bg, surface: t.card, foreground: t.fg, muted: t.muted, border: t.border,
    primaryForeground: t.primaryFg, success: t.success, error: t.destructive, warning: t.warning,
  };
  const set = Object.fromEntries(Object.entries(palette).filter(([, v]) => typeof v === 'string' && v.trim()));
  const out: FlowAppearance = {};
  if (Object.keys(set).length) out.colors = { ...set, dark: { ...set } };
  if (t.fontBody || t.fontDisplay) out.typography = { fontFamily: t.fontBody, displayFamily: t.fontDisplay };
  if (t.capture) out.capture = t.capture;
  return Object.keys(out).length ? out : undefined;
}

/** Field-level merge of the run view's branding over the session's (Flows). */
function mergeServerBranding(high: CaptureServerBranding | null | undefined, low: CaptureServerBranding | null | undefined): CaptureServerBranding | null {
  if (!high) return low ?? null;
  if (!low) return high;
  const pick = <K extends keyof CaptureServerBranding>(k: K) => (high[k] != null && high[k] !== '' ? high[k] : low[k]);
  return {
    display_name: pick('display_name'),
    logo_url: pick('logo_url'),
    primary_color: pick('primary_color'),
    redirect_url: pick('redirect_url'),
    appearance: mergeAppearance(high.appearance ?? undefined, low.appearance ?? undefined) ?? null,
    copy: { capture: mergeCaptureCopy(captureCopyOf(high.copy), captureCopyOf(low.copy)) },
  };
}

function captureCopyOf(copy: unknown): CaptureCopy | undefined {
  const c = (copy as { capture?: unknown } | null | undefined)?.capture;
  return c && typeof c === 'object' ? (c as CaptureCopy) : undefined;
}

export interface EngineBrandInput {
  /** Code: appearance (per launch / SDK init). */
  appearance?: FlowAppearance;
  /** Code: copy (only `copy.capture` is read on the capture screens). */
  copy?: FlowCopy;
  /** Code: the legacy theme prop (its `appearance` when built by flowThemeToEngineTheme). */
  theme?: EngineTheme;
  /** Dashboard: branding the host already has (a Flow's run view). */
  branding?: CaptureServerBranding | null;
  /** Dashboard: `branding` from session create / token exchange / init-session. */
  sessionBranding?: CaptureServerBranding | null;
  /** Code, legacy fields. */
  primaryColor?: string;
  logoUrl?: string;
  displayName?: string;
  prefersDark: boolean;
}

/** Resolve the engine's brand (theme and strings) from its props. */
export function resolveEngineBrand(input: EngineBrandInput): CaptureBrand {
  const server = mergeServerBranding(input.branding, input.sessionBranding);
  const code = mergeAppearance(input.appearance, engineThemeToAppearance(input.theme));
  const theme = resolveCaptureTheme({
    appearance: code,
    legacy: { primaryColor: input.primaryColor, logoUrl: input.logoUrl, displayName: input.displayName },
    server,
    prefersDark: input.prefersDark,
  });
  const copy = mergeCaptureCopy(input.copy?.capture, captureCopyOf(server?.copy));
  return { theme, strings: new CaptureStrings(copy, theme.displayName) };
}

/**
 * Load the brand's own fonts (appearance.typography.fontCss): a stylesheet
 * URL, an @import, or @font-face rules. One tag, rewritten on change.
 */
export function injectCaptureFontCss(fontCss: string): void {
  if (typeof document === 'undefined') return;
  const css = fontCss.trim();
  const isUrl = /^https:\/\/\S+$/i.test(css);
  const id = 'usesense-capture-font-css';
  const existing = document.getElementById(id);
  if (existing?.getAttribute('data-src') === css) return;
  existing?.remove();
  let el: HTMLLinkElement | HTMLStyleElement;
  if (isUrl) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = css;
    el = link;
  } else {
    const style = document.createElement('style');
    style.textContent = css;
    el = style;
  }
  el.id = id;
  el.setAttribute('data-src', css);
  document.head.appendChild(el);
}
