// Flow runner theme: the hosted run page's design tokens (warm neutrals +
// DeepSense primary), light and dark, plus OS dark-mode detection and one-time
// brand-font injection. Mirrors frontend/src/styles/theme.css so the SDK runner
// looks identical to the hosted page.

import { useEffect, useState } from 'react';
import { BRAND_FONT_CSS } from './fonts/brand-fonts';

export interface FlowTheme {
  /** page background */ bg: string;
  /** primary text */ fg: string;
  /** secondary/muted text */ muted: string;
  /** raised surface (cards, inputs) */ card: string;
  /** hairline borders */ border: string;
  /** brand primary (buttons, focus) */ primary: string;
  primaryFg: string;
  success: string;
  destructive: string;
  warning: string;
  fontDisplay: string;
  fontBody: string;
  isDark: boolean;
}

const FONT_DISPLAY = "'Outfit', system-ui, -apple-system, Segoe UI, sans-serif";
const FONT_BODY = "'DM Sans', system-ui, -apple-system, Segoe UI, sans-serif";

export const LIGHT_THEME: FlowTheme = {
  bg: '#FDFCFA', fg: '#1C1A17', muted: '#6B6760', card: '#F5F3EF', border: '#E8E5DE',
  primary: '#4F7CFF', primaryFg: '#FFFFFF',
  success: '#00D4AA', destructive: '#FF6B4A', warning: '#FFB84D',
  fontDisplay: FONT_DISPLAY, fontBody: FONT_BODY, isDark: false,
};

export const DARK_THEME: FlowTheme = {
  bg: '#1C1A17', fg: '#F5F3EF', muted: '#9E9A92', card: '#2A2723', border: 'rgba(255,255,255,0.08)',
  primary: '#4F7CFF', primaryFg: '#FFFFFF',
  success: '#00D4AA', destructive: '#FF6B4A', warning: '#FFB84D',
  fontDisplay: FONT_DISPLAY, fontBody: FONT_BODY, isDark: true,
};

export type ThemePreference = 'light' | 'dark' | 'auto';

const prefersDark = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

/**
 * Resolve the active theme. 'auto' (default) follows the OS setting and updates
 * live when it changes; 'light'/'dark' force a palette.
 */
export function useFlowTheme(preference: ThemePreference = 'auto'): FlowTheme {
  const [dark, setDark] = useState<boolean>(() => preference === 'dark' || (preference === 'auto' && prefersDark()));

  useEffect(() => {
    if (preference !== 'auto' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', onChange);
    setDark(mq.matches);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  if (preference === 'light') return LIGHT_THEME;
  if (preference === 'dark') return DARK_THEME;
  return dark ? DARK_THEME : LIGHT_THEME;
}

/**
 * Inject the bundled brand @font-face once. Idempotent. If a host page's CSP
 * blocks `data:` fonts the runner degrades gracefully to the system stack via
 * the font-family fallbacks above.
 */
let fontsInjected = false;
export function injectBrandFonts(): void {
  if (fontsInjected || typeof document === 'undefined') return;
  fontsInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-usesense-flow-fonts', '');
  style.textContent = BRAND_FONT_CSS;
  document.head.appendChild(style);
}
