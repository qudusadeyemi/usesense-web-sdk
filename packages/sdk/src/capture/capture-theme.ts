/**
 * The capture brand contract (BRAND-v1): one resolved theme per session or
 * Flow run, used by every capture screen.
 *
 * Two surfaces:
 *  - the page surface (primer, sheets, upload sheet, result and error pages,
 *    leave dialog, loading screens) follows the full palette and `mode`;
 *  - the camera surface (align, scan, extra checks) is always dark. Brand
 *    appears there only as accents, each gated to 3:1 contrast on #333333.
 *
 * Precedence per field, highest first (unset is unset):
 *   1. code: `appearance` (per launch or SDK init)
 *   2. code: legacy `primaryColor`, `buttonRadius`, `fontFamily`, `logoUrl`, `displayName`
 *   3. dashboard: the server `branding.appearance` (Flow layer already merged in by the server)
 *   4. dashboard: the server's flat `branding.primary_color` / `logo_url` / `display_name`
 *   5. Sense defaults
 *
 * Spec: capture-test-kit/BRAND-v1.md, sections 2 and 4.
 */

import type { AppearanceColors, AppearanceIcons, AppearanceLoader, FlowAppearance } from '../flows/theme';

// ============================================================================
// Defaults and the fixed list
// ============================================================================

/** Sense page palette per mode (spec 4.1). Dark is today's capture look. */
export const SENSE_PAGE_DEFAULTS = {
  dark: { background: '#12141B', surface: '#1D2029', foreground: '#F4F5F8', muted: '#A3A9B8', border: 'rgba(255,255,255,0.08)' },
  light: { background: '#FDFCFA', surface: '#F5F3EF', foreground: '#1C1A17', muted: '#6B6760', border: '#E8E5DE' },
} as const;

/** Sense accent defaults (spec 4.1 and 4.2). */
export const SENSE_ACCENT_DEFAULTS = {
  primary: '#4F7CFF',
  success: '#00D4AA',
  error: '#FF6B4A',
  warning: '#FFB84D',
  /** The extra-check ring (Sense purple). */
  challenge: '#A878FC',
} as const;

/** The two inks `primaryForeground` chooses between when unset. */
export const PRIMARY_FOREGROUND_CHOICES = ['#FFFFFF', '#1C1A17'] as const;

/** Every camera accent must reach this contrast on {@link CAMERA_CONTRAST_REFERENCE}. */
export const CAMERA_MIN_CONTRAST = 3;
/** The contrast reference for camera accents (same on iOS, Android and Web). */
export const CAMERA_CONTRAST_REFERENCE = '#333333';

/** Lightening for a primary that fails on the camera: HSL L += 5% per step, up to 8 steps. */
export const LIGHTEN_STEP = 0.05;
export const LIGHTEN_MAX_STEPS = 8;

/**
 * Colours that are NOT brandable (spec 4.2), on the camera and around it.
 * Brand never reaches these: they keep guidance readable over any video and
 * keep the measurement colours honest.
 */
export const CAPTURE_FIXED_COLORS = {
  /** Camera background behind the preview. */
  cameraBackground: '#0D0F14',
  /** Scan dim and the camera blur tint (rgb of the camera background). */
  scanDim: 'rgba(13,15,20,0.25)',
  /** Back / help buttons on the camera. */
  cameraButton: 'rgba(13,15,20,0.55)',
  cameraButtonInk: '#F4F5F8',
  /** Oval guide fill and its neutral stroke. */
  ovalFill: 'rgba(255,255,255,0.14)',
  ovalStroke: 'rgba(255,255,255,0.90)',
  /** Ring track. */
  ringTrack: 'rgba(255,255,255,0.18)',
  /** Guidance text and its shadow. */
  guidance: '#FFFFFF',
  guidanceSub: 'rgba(255,255,255,0.82)',
  guidanceShadow: '0 1px 2px rgba(0, 0, 0, 0.35), 0 2px 14px rgba(0, 0, 0, 0.45)',
  /** Shutter button (white on the camera, dark ink on the fill light). */
  shutter: '#FFFFFF',
  shutterRing: 'rgba(255,255,255,0.95)',
  shutterOnFill: '#2A251E',
  /** Fill-light veil (#FFF4E2). */
  fillLight: 'rgba(255,244,226,0.38)',
  /** Speak Digits pill. */
  digitsPill: 'rgba(13,15,20,0.72)',
  /** Extra-check arrow and the tick's mark. */
  arrow: '#FFFFFF',
  /** "Powered by Sense" on the camera. */
  poweredOnCamera: 'rgba(255,255,255,0.55)',
  /** Dialog scrim. */
  scrim: 'rgba(0,0,0,0.5)',
} as const;

// ============================================================================
// Colour maths (WCAG relative luminance, the same formula on every platform)
// ============================================================================

/** Parse #rgb / #rrggbb. Returns null for anything else. */
export function parseHexColor(hex: string | undefined | null): [number, number, number] | null {
  if (typeof hex !== 'string') return null;
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two hex colours, or 0 if either is not a hex colour. */
export function contrast(a: string | undefined | null, b: string | undefined | null): number {
  const pa = parseHexColor(a);
  const pb = parseHexColor(b);
  if (!pa || !pb) return 0;
  const la = luminance(pa);
  const lb = luminance(pb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** True when `color` is a hex colour with at least 3:1 on the camera reference. */
export function passesOnCamera(color: string | undefined | null): boolean {
  return contrast(color, CAMERA_CONTRAST_REFERENCE) >= CAMERA_MIN_CONTRAST;
}

function toHex([r, g, b]: [number, number, number]): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [ch(h + 1 / 3) * 255, ch(h) * 255, ch(h - 1 / 3) * 255];
}

/**
 * Lighten a hex colour in HSL: L += 5% per step, up to 8 steps, until it
 * reaches 3:1 on the camera. Returns the first passing step, or null.
 */
export function lightenUntilPasses(color: string | undefined | null): string | null {
  const rgb = parseHexColor(color);
  if (!rgb) return null;
  const [h, s, l] = rgbToHsl(rgb);
  for (let step = 1; step <= LIGHTEN_MAX_STEPS; step++) {
    const c = toHex(hslToRgb([h, s, Math.min(1, l + LIGHTEN_STEP * step)]));
    if (passesOnCamera(c)) return c;
  }
  return null;
}

/** `color` at `alpha`, as rgba() for hex, else a color-mix() for any other CSS colour. */
export function withAlpha(color: string, alpha: number): string {
  const rgb = parseHexColor(color);
  if (rgb) return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

// ============================================================================
// Inputs
// ============================================================================

/** The server `branding` block (session create, token exchange, Flow run view, init-session). */
export interface CaptureServerBranding {
  display_name?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  redirect_url?: string | null;
  appearance?: FlowAppearance | null;
  copy?: unknown;
}

/** Legacy code-level brand fields (SDK init / engine props). */
export interface CaptureLegacyBrand {
  primaryColor?: string | null;
  logoUrl?: string | null;
  displayName?: string | null;
  fontFamily?: string | null;
  buttonRadius?: number | null;
}

export interface CaptureThemeInput {
  /** Layer 1: `appearance` from code (per launch, then SDK init). */
  appearance?: FlowAppearance | null;
  /** Layer 2: legacy code fields. */
  legacy?: CaptureLegacyBrand | null;
  /** Layers 3 and 4: the server's `branding`. */
  server?: CaptureServerBranding | null;
  /** Whether the device prefers dark (for `mode: 'auto'`). */
  prefersDark?: boolean;
}

/** Which layer a resolved field came from (debug trace). */
export type CaptureBrandSource = 'code' | 'code:legacy' | 'dashboard' | 'dashboard:flat' | 'default' | 'lightened';

/** The resolved capture theme. Every value is final; no screen reads a raw constant for a brandable token. */
export interface CaptureTheme {
  mode: 'light' | 'dark';
  /** The mode setting before resolving `auto` (unset = dark for capture). */
  modeSetting: 'light' | 'dark' | 'auto' | 'unset';
  page: {
    background: string;
    backgroundImage: string | null;
    surface: string;
    foreground: string;
    muted: string;
    border: string;
    primary: string;
    primaryForeground: string;
    success: string;
    error: string;
    warning: string;
  };
  camera: {
    ring: string;
    challenge: string;
    warning: string;
    success: string;
  };
  typography: { displayFamily: string; fontFamily: string; fontCss: string | null };
  shape: { buttonRadius: number; buttonStyle: 'filled' | 'outline'; dialogRadius: number; sheetRadius: number; tileRadius: number };
  logo: { url: string | null; placement: 'header' | 'center' | 'none'; height: number };
  displayName: string | null;
  icons: { success: string | null; review: string | null; notVerified: string | null };
  loader: { style: 'spinner' | 'dots' | 'bar'; imageUrl: string | null };
  /** Source layer of each resolved field, for the debug trace. */
  sources: Record<string, CaptureBrandSource>;
}

export const SENSE_FONT_DISPLAY = "'Outfit', system-ui, -apple-system, 'Segoe UI', sans-serif";
export const SENSE_FONT_BODY = "'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";

// ============================================================================
// Resolution
// ============================================================================

const isSet = (v: unknown): boolean =>
  v !== undefined && v !== null && !(typeof v === 'string' && v.trim().length === 0) && !(typeof v === 'number' && !Number.isFinite(v));

type Layer = { source: CaptureBrandSource; a: FlowAppearance };

/** A legacy stored default the server should never send, treated as unset (spec 7). */
const UNCONFIGURED_PRIMARY = '#4f46e5';

function layersOf(input: CaptureThemeInput): Layer[] {
  const out: Layer[] = [];
  if (input.appearance) out.push({ source: 'code', a: input.appearance });
  const L = input.legacy;
  if (L) {
    const a: FlowAppearance = {};
    if (isSet(L.primaryColor)) a.colors = { primary: L.primaryColor! };
    if (isSet(L.fontFamily)) a.typography = { fontFamily: L.fontFamily! };
    if (isSet(L.buttonRadius)) a.shape = { buttonRadius: L.buttonRadius! };
    if (isSet(L.logoUrl)) a.logo = { url: L.logoUrl! };
    out.push({ source: 'code:legacy', a });
  }
  const S = input.server;
  if (S?.appearance) out.push({ source: 'dashboard', a: S.appearance });
  if (S) {
    const a: FlowAppearance = {};
    if (isSet(S.primary_color) && S.primary_color!.trim().toLowerCase() !== UNCONFIGURED_PRIMARY) a.colors = { primary: S.primary_color! };
    if (isSet(S.logo_url)) a.logo = { url: S.logo_url! };
    out.push({ source: 'dashboard:flat', a });
  }
  return out;
}

/**
 * Resolve the capture theme from the brand layers (spec sections 2 and 4).
 * Pure: the caller supplies `prefersDark` for `mode: 'auto'`.
 */
export function resolveCaptureTheme(input: CaptureThemeInput = {}): CaptureTheme {
  const layers = layersOf(input);
  const sources: Record<string, CaptureBrandSource> = {};
  /** The first layer that sets `get(a)`. */
  function first<T>(key: string, get: (a: FlowAppearance) => T | undefined | null): T | undefined {
    for (const l of layers) {
      const v = get(l.a);
      if (isSet(v)) { sources[key] = l.source; return v as T; }
    }
    return undefined;
  }
  function or<T>(key: string, v: T | undefined, fallback: T): T {
    if (v !== undefined) return v;
    sources[key] = 'default';
    return fallback;
  }

  // Mode: unset keeps capture pages dark (today's look).
  const modeSet = first('mode', (a) => a.mode);
  const modeSetting: CaptureTheme['modeSetting'] = modeSet === 'light' || modeSet === 'dark' || modeSet === 'auto' ? modeSet : 'unset';
  if (modeSetting === 'unset') sources.mode = 'default';
  const mode: 'light' | 'dark' = modeSetting === 'light' ? 'light'
    : modeSetting === 'auto' ? (input.prefersDark ? 'dark' : 'light')
      : 'dark';
  const dark = mode === 'dark';
  const base = SENSE_PAGE_DEFAULTS[mode];

  // Surface keys: light reads colors.*, dark reads colors.dark.* only ("derive nothing").
  type SurfaceKey = 'background' | 'surface' | 'foreground' | 'muted' | 'border';
  const surfaceColor = (k: SurfaceKey): string => {
    const v = first<string>(`page.${k}`, (a) => {
      if (dark) return a.colors?.dark?.[k];
      if (k === 'background') return a.background?.color ?? a.colors?.background;
      return a.colors?.[k];
    });
    return or(`page.${k}`, v, base[k]);
  };
  // Accent keys: the dark override, else the shared key (both modes).
  type AccentKey = 'primary' | 'primaryForeground' | 'success' | 'error' | 'warning';
  const accent = (k: AccentKey): string | undefined =>
    first<string>(`page.${k}`, (a) => (dark ? a.colors?.dark?.[k as keyof Omit<AppearanceColors, 'dark'>] : undefined) ?? a.colors?.[k as keyof Omit<AppearanceColors, 'dark'>] as string | undefined);

  const primary = or('page.primary', accent('primary'), SENSE_ACCENT_DEFAULTS.primary);
  let primaryForeground = accent('primaryForeground');
  if (primaryForeground === undefined) {
    sources['page.primaryForeground'] = 'default';
    const [w, d] = PRIMARY_FOREGROUND_CHOICES;
    // On the Sense primary itself keep today's white (dark ink would score
    // higher on #4F7CFF but changes the default look); a brand primary gets
    // whichever ink has the higher contrast (spec 4.1).
    primaryForeground = sources['page.primary'] === 'default' ? w
      : contrast(d, primary) > contrast(w, primary) ? d : w;
  }
  const page: CaptureTheme['page'] = {
    background: surfaceColor('background'),
    backgroundImage: first<string>('page.backgroundImage', (a) => a.background?.imageUrl) ?? null,
    surface: surfaceColor('surface'),
    foreground: surfaceColor('foreground'),
    muted: surfaceColor('muted'),
    border: surfaceColor('border'),
    primary,
    primaryForeground,
    success: or('page.success', accent('success'), SENSE_ACCENT_DEFAULTS.success),
    error: or('page.error', accent('error'), SENSE_ACCENT_DEFAULTS.error),
    warning: or('page.warning', accent('warning'), SENSE_ACCENT_DEFAULTS.warning),
  };

  // Camera accents (spec 4.2), each gated to 3:1 on #333333.
  const ringSet = first<string>('camera.ring', (a) => a.capture?.ring);
  let ring: string;
  if (ringSet && passesOnCamera(ringSet)) ring = ringSet.trim();
  else if (passesOnCamera(page.primary)) { ring = page.primary.trim(); sources['camera.ring'] = sources['page.primary']; }
  else {
    const lighter = lightenUntilPasses(page.primary);
    if (lighter) { ring = lighter; sources['camera.ring'] = 'lightened'; }
    else { ring = SENSE_ACCENT_DEFAULTS.primary; sources['camera.ring'] = 'default'; }
  }
  const challengeSet = first<string>('camera.challenge', (a) => a.capture?.challenge);
  const challenge = challengeSet && passesOnCamera(challengeSet) ? challengeSet.trim() : SENSE_ACCENT_DEFAULTS.challenge;
  if (challenge === SENSE_ACCENT_DEFAULTS.challenge && challengeSet !== challenge) sources['camera.challenge'] = 'default';
  const warnSet = first<string>('camera.warning', (a) => a.capture?.warning);
  let warning: string;
  if (warnSet && passesOnCamera(warnSet)) warning = warnSet.trim();
  else if (passesOnCamera(page.warning)) { warning = page.warning.trim(); sources['camera.warning'] = sources['page.warning']; }
  else { warning = SENSE_ACCENT_DEFAULTS.warning; sources['camera.warning'] = 'default'; }
  const success = passesOnCamera(page.success) ? page.success.trim() : SENSE_ACCENT_DEFAULTS.success;
  sources['camera.success'] = success === page.success.trim() ? sources['page.success'] : 'default';

  // Typography.
  const fontFamily = or('typography.fontFamily', first<string>('typography.fontFamily', (a) => a.typography?.fontFamily), SENSE_FONT_BODY);
  const displayFamily = or('typography.displayFamily', first<string>('typography.displayFamily', (a) => a.typography?.displayFamily), SENSE_FONT_DISPLAY);
  const fontCss = first<string>('typography.fontCss', (a) => a.typography?.fontCss) ?? null;

  // Shape: buttonRadius falls back to radius, then 14.
  const radius = first<number>('shape.radius', (a) => (typeof a.shape?.radius === 'number' ? a.shape.radius : undefined));
  const buttonRadiusSet = first<number>('shape.buttonRadius', (a) => (typeof a.shape?.buttonRadius === 'number' ? a.shape.buttonRadius : undefined));
  const buttonRadius = buttonRadiusSet ?? radius ?? 14;
  if (buttonRadiusSet === undefined) sources['shape.buttonRadius'] = radius !== undefined ? sources['shape.radius'] : 'default';
  const styleSet = first<string>('shape.buttonStyle', (a) => a.shape?.buttonStyle);
  const buttonStyle: 'filled' | 'outline' = styleSet === 'outline' ? 'outline' : 'filled';
  if (styleSet === undefined) sources['shape.buttonStyle'] = 'default';
  const shape: CaptureTheme['shape'] = {
    buttonRadius,
    buttonStyle,
    dialogRadius: radius ?? 20,
    sheetRadius: radius !== undefined ? Math.min(2 * radius, 28) : 28,
    tileRadius: radius ?? 12,
  };

  // Logo and name.
  const logoUrl = first<string>('logo.url', (a) => a.logo?.url) ?? null;
  const placementSet = first<string>('logo.placement', (a) => a.logo?.placement);
  const placement: CaptureTheme['logo']['placement'] = placementSet === 'center' || placementSet === 'none' ? placementSet : 'header';
  const heightSet = first<number>('logo.height', (a) => (typeof a.logo?.height === 'number' && a.logo.height > 0 ? a.logo.height : undefined));
  const displayName = (isSet(input.legacy?.displayName) ? input.legacy!.displayName!.trim()
    : isSet(input.server?.display_name) ? input.server!.display_name!.trim() : null);
  sources.displayName = isSet(input.legacy?.displayName) ? 'code:legacy' : isSet(input.server?.display_name) ? 'dashboard' : 'default';

  // Result illustrations and the loader.
  const icon = (k: keyof AppearanceIcons) => first<string>(`icons.${String(k)}`, (a) => a.icons?.[k]) ?? null;
  const loaderStyle = first<string>('loader.style', (a: FlowAppearance) => (a.loader as AppearanceLoader | undefined)?.style);
  const loaderImage = first<string>('loader.imageUrl', (a) => a.loader?.imageUrl) ?? null;

  return {
    mode,
    modeSetting,
    page,
    camera: { ring, challenge, warning, success },
    typography: { displayFamily, fontFamily, fontCss },
    shape,
    logo: { url: logoUrl, placement, height: heightSet ?? 28 },
    displayName,
    icons: { success: icon('success'), review: icon('review'), notVerified: icon('notVerified') },
    loader: { style: loaderStyle === 'dots' || loaderStyle === 'bar' ? loaderStyle : 'spinner', imageUrl: loaderImage },
    sources,
  };
}

/**
 * The resolved theme as CSS custom properties, set on the engine's root. The
 * capture styles read only these (plus {@link CAPTURE_FIXED_COLORS}).
 */
export function captureThemeVars(t: CaptureTheme): Record<string, string> {
  const p = t.page;
  const css = (s: string) => s.replace(/[;{}<>]/g, '');
  return {
    '--us-page-bg': css(p.background),
    '--us-page-bg-image': p.backgroundImage ? `url("${encodeURI(p.backgroundImage).replace(/"/g, '%22')}")` : 'none',
    '--us-page-surface': css(p.surface),
    '--us-page-fg': css(p.foreground),
    '--us-page-muted': css(p.muted),
    '--us-page-border': css(p.border),
    '--us-page-muted-tint': withAlpha(css(p.muted), 0.18),
    '--us-primary': css(p.primary),
    '--us-primary-fg': css(p.primaryForeground),
    '--us-primary-tint': withAlpha(css(p.primary), 0.16),
    '--us-success': css(p.success),
    '--us-success-tint': withAlpha(css(p.success), 0.16),
    '--us-error': css(p.error),
    '--us-error-tint': withAlpha(css(p.error), 0.16),
    '--us-warning': css(p.warning),
    '--us-warning-tint': withAlpha(css(p.warning), 0.16),
    '--us-cam-ring': t.camera.ring,
    '--us-cam-challenge': t.camera.challenge,
    '--us-cam-challenge-tint': withAlpha(t.camera.challenge, 0.16),
    '--us-cam-warning': t.camera.warning,
    '--us-cam-success': t.camera.success,
    '--us-font-display': css(t.typography.displayFamily),
    '--us-font-body': css(t.typography.fontFamily),
    '--us-btn-radius': `${t.shape.buttonRadius}px`,
    '--us-dialog-radius': `${t.shape.dialogRadius}px`,
    '--us-sheet-radius': `${t.shape.sheetRadius}px`,
    '--us-tile-radius': `${t.shape.tileRadius}px`,
    '--us-logo-height': `${t.logo.height}px`,
  };
}

/** One line per resolved field with its source layer (debug trace, spec 6). */
export function captureThemeTrace(t: CaptureTheme): string[] {
  const value = (k: string): unknown => k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown> | undefined)?.[p], t);
  return Object.keys(t.sources).sort().map((k) => {
    const v = value(k);
    return v === undefined ? `${k} (${t.sources[k]})` : `${k}=${String(v ?? '')} (${t.sources[k]})`;
  });
}
