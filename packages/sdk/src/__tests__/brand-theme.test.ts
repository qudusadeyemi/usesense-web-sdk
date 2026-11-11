/**
 * BRAND-v1 section 9: contrast gating and lightening (Night Pay fixture),
 * precedence per field, Sense defaults per mode, retired contour colours.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveCaptureTheme,
  captureThemeVars,
  captureThemeTrace,
  contrast,
  passesOnCamera,
  lightenUntilPasses,
  CAMERA_CONTRAST_REFERENCE,
  SENSE_PAGE_DEFAULTS,
  SENSE_ACCENT_DEFAULTS,
} from '../capture/capture-theme';
import { resolveCaptureColors, CAPTURE_CONTRAST_BACKGROUND } from '../capture/quality-gate';
import { resolveEngineBrand, engineThemeToAppearance } from '../components/capture-brand';
import { flowThemeToEngineTheme, resolveTheme, type FlowAppearance } from '../flows/theme';

/** Spec section 8 test brands. */
const ACME: FlowAppearance = {
  mode: 'light',
  colors: { primary: '#1F7A4D', background: '#FFFFFF', surface: '#F3F6F4', foreground: '#13261C', muted: '#5B6B62', border: '#D8E0DB' },
  typography: { displayFamily: 'Georgia', fontFamily: 'Inter' },
  shape: { radius: 12, buttonRadius: 999, buttonStyle: 'filled' },
  logo: { url: 'https://example.com/acme.svg', placement: 'header', height: 28 },
};
const NIGHT_PAY: FlowAppearance = {
  mode: 'dark',
  colors: { primary: '#3A1D8F', dark: { background: '#0B0B12', surface: '#16162A', foreground: '#EDEBFF', muted: '#9C98C9' } },
  capture: { challenge: '#FF4FA3' },
  shape: { buttonRadius: 4, buttonStyle: 'outline' },
};

describe('camera contrast reference', () => {
  it('is #333333 on every path (spec 4.2)', () => {
    expect(CAMERA_CONTRAST_REFERENCE).toBe('#333333');
    expect(CAPTURE_CONTRAST_BACKGROUND).toBe('#333333');
  });
  it('uses the WCAG luminance formula', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#333333', '#333333')).toBeCloseTo(1, 5);
    expect(contrast('rgb(0,0,0)', '#fff')).toBe(0);
  });
  it('every Sense camera default passes 3:1', () => {
    for (const c of [SENSE_ACCENT_DEFAULTS.primary, SENSE_ACCENT_DEFAULTS.challenge, SENSE_ACCENT_DEFAULTS.warning, SENSE_ACCENT_DEFAULTS.success]) {
      expect(passesOnCamera(c)).toBe(true);
    }
  });
});

describe('Sense defaults', () => {
  it('unset mode keeps capture pages dark (today\'s look)', () => {
    const t = resolveCaptureTheme();
    expect(t.mode).toBe('dark');
    expect(t.modeSetting).toBe('unset');
    expect(t.page).toMatchObject({ ...SENSE_PAGE_DEFAULTS.dark, primary: '#4F7CFF', success: '#00D4AA', error: '#FF6B4A', warning: '#FFB84D' });
    expect(t.camera).toEqual({ ring: '#4F7CFF', challenge: '#A878FC', warning: '#FFB84D', success: '#00D4AA' });
    expect(t.typography.displayFamily).toMatch(/Outfit/);
    expect(t.typography.fontFamily).toMatch(/DM Sans/);
    expect(t.shape).toEqual({ buttonRadius: 14, buttonStyle: 'filled', dialogRadius: 20, sheetRadius: 28, tileRadius: 12 });
    expect(t.logo).toEqual({ url: null, placement: 'header', height: 28 });
    expect(t.loader).toEqual({ style: 'spinner', imageUrl: null });
  });
  it('light mode uses the Sense light palette', () => {
    expect(resolveCaptureTheme({ appearance: { mode: 'light' } }).page).toMatchObject(SENSE_PAGE_DEFAULTS.light);
  });
  it('auto follows the device', () => {
    expect(resolveCaptureTheme({ appearance: { mode: 'auto' }, prefersDark: true }).mode).toBe('dark');
    expect(resolveCaptureTheme({ appearance: { mode: 'auto' }, prefersDark: false }).mode).toBe('light');
  });
  it('primaryForeground picks white or #1C1A17 by contrast (white on the Sense primary)', () => {
    expect(resolveCaptureTheme().page.primaryForeground).toBe('#FFFFFF');
    expect(resolveCaptureTheme({ appearance: { colors: { primary: '#1F7A4D' } } }).page.primaryForeground).toBe('#FFFFFF');
    expect(resolveCaptureTheme({ appearance: { colors: { primary: '#FFD400' } } }).page.primaryForeground).toBe('#1C1A17');
  });
});

describe('page palette per mode', () => {
  it('light: background.color wins over colors.background', () => {
    const t = resolveCaptureTheme({ appearance: { mode: 'light', colors: { background: '#EEEEEE' }, background: { color: '#FAFAFA' } } });
    expect(t.page.background).toBe('#FAFAFA');
  });
  it('dark reads colors.dark only and derives nothing from the light keys', () => {
    const t = resolveCaptureTheme({ appearance: { mode: 'dark', colors: { background: '#FFFFFF', foreground: '#000000', dark: { surface: '#16162A' } } } });
    expect(t.page.background).toBe(SENSE_PAGE_DEFAULTS.dark.background);
    expect(t.page.foreground).toBe(SENSE_PAGE_DEFAULTS.dark.foreground);
    expect(t.page.surface).toBe('#16162A');
  });
  it('accents apply in both modes, a dark override wins in dark', () => {
    const a: FlowAppearance = { mode: 'dark', colors: { primary: '#1F7A4D', dark: { primary: '#5BC48D' } } };
    expect(resolveCaptureTheme({ appearance: a }).page.primary).toBe('#5BC48D');
    expect(resolveCaptureTheme({ appearance: { ...a, mode: 'light' } }).page.primary).toBe('#1F7A4D');
  });
});

describe('camera accent gating (spec 4.2)', () => {
  it('Night Pay: the primary fails 3:1 and the ring comes out lightened', () => {
    expect(passesOnCamera('#3A1D8F')).toBe(false);
    const t = resolveCaptureTheme({ appearance: NIGHT_PAY });
    expect(t.camera.ring).not.toBe('#3A1D8F');
    expect(t.camera.ring).not.toBe(SENSE_ACCENT_DEFAULTS.primary);
    expect(passesOnCamera(t.camera.ring)).toBe(true);
    expect(t.camera.ring).toBe(lightenUntilPasses('#3A1D8F'));
    expect(t.sources['camera.ring']).toBe('lightened');
    // The page keeps the brand's own primary.
    expect(t.page.primary).toBe('#3A1D8F');
    // Its challenge colour passes and is used.
    expect(t.camera.challenge).toBe('#FF4FA3');
  });
  it('lightening stops at the first passing step (L += 5%)', () => {
    const out = lightenUntilPasses('#3A1D8F')!;
    // The value before it (5% darker) must still fail.
    const lHex = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
      return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    };
    const base = lHex('#3A1D8F');
    const steps = Math.round((lHex(out) - base) / 0.05);
    expect(steps).toBeGreaterThanOrEqual(1);
    expect(steps).toBeLessThanOrEqual(8);
    if (steps > 1) {
      const prev = lightenStep('#3A1D8F', steps - 1);
      expect(passesOnCamera(prev)).toBe(false);
    }
  });
  it('a primary that 8 steps cannot rescue falls back to #4F7CFF', () => {
    expect(lightenUntilPasses('#000000')).toBeNull();
    expect(resolveCaptureTheme({ appearance: { colors: { primary: '#000000' } } }).camera.ring).toBe('#4F7CFF');
  });
  it('capture.ring wins when it passes, else colors.primary', () => {
    expect(resolveCaptureTheme({ appearance: { capture: { ring: '#00D4AA' }, colors: { primary: '#FF6A00' } } }).camera.ring).toBe('#00D4AA');
    expect(resolveCaptureTheme({ appearance: { capture: { ring: '#222244' }, colors: { primary: '#FF6A00' } } }).camera.ring).toBe('#FF6A00');
    expect(resolveCaptureTheme({ appearance: { capture: { ring: 'not-a-colour' } } }).camera.ring).toBe('#4F7CFF');
  });
  it('challenge: capture.challenge if it passes, else Sense purple (never primary)', () => {
    expect(resolveCaptureTheme({ appearance: { capture: { challenge: '#222244' }, colors: { primary: '#FF6A00' } } }).camera.challenge).toBe('#A878FC');
  });
  it('warning: capture.warning, else colors.warning, else #FFB84D', () => {
    expect(resolveCaptureTheme({ appearance: { capture: { warning: '#FFD400' } } }).camera.warning).toBe('#FFD400');
    expect(resolveCaptureTheme({ appearance: { capture: { warning: '#222222' }, colors: { warning: '#FF9500' } } }).camera.warning).toBe('#FF9500');
    expect(resolveCaptureTheme({ appearance: { colors: { warning: '#553300' } } }).camera.warning).toBe('#FFB84D');
  });
  it('success on camera: colors.success if it passes, else #00D4AA', () => {
    expect(resolveCaptureTheme({ appearance: { colors: { success: '#34C759' } } }).camera.success).toBe('#34C759');
    expect(resolveCaptureTheme({ appearance: { colors: { success: '#0B3D1E' } } }).camera.success).toBe('#00D4AA');
  });
  it('Acme Bank: the green primary passes and is the ring', () => {
    const t = resolveCaptureTheme({ appearance: ACME });
    expect(passesOnCamera('#1F7A4D')).toBe(contrast('#1F7A4D', '#333333') >= 3);
    expect(passesOnCamera(t.camera.ring)).toBe(true);
    expect(t.mode).toBe('light');
    expect(t.page).toMatchObject({ background: '#FFFFFF', surface: '#F3F6F4', foreground: '#13261C', muted: '#5B6B62', border: '#D8E0DB', primary: '#1F7A4D' });
    expect(t.typography).toMatchObject({ displayFamily: 'Georgia', fontFamily: 'Inter' });
    expect(t.shape).toEqual({ buttonRadius: 999, buttonStyle: 'filled', dialogRadius: 12, sheetRadius: 24, tileRadius: 12 });
  });
});

describe('precedence per field (spec 2)', () => {
  it('code appearance > code legacy > dashboard appearance > dashboard flat > default', () => {
    const server = { appearance: { colors: { primary: '#118844' } }, primary_color: '#AA0000' };
    expect(resolveCaptureTheme({ server }).page.primary).toBe('#118844');
    expect(resolveCaptureTheme({ server: { primary_color: '#AA0000' } }).page.primary).toBe('#AA0000');
    // Legacy code primaryColor beats the dashboard appearance.
    const legacy = resolveCaptureTheme({ legacy: { primaryColor: '#FF6A00' }, server });
    expect(legacy.page.primary).toBe('#FF6A00');
    expect(legacy.sources['page.primary']).toBe('code:legacy');
    // Code appearance beats legacy.
    expect(resolveCaptureTheme({ appearance: { colors: { primary: '#123456' } }, legacy: { primaryColor: '#FF6A00' }, server }).page.primary).toBe('#123456');
  });
  it('is field by field: a code colour does not hide the dashboard logo or name', () => {
    const t = resolveCaptureTheme({
      appearance: { colors: { primary: '#FF6A00' } },
      server: { logo_url: 'https://cdn.example.com/logo.png', display_name: 'XTransfer', appearance: { shape: { radius: 6 } } },
    });
    expect(t.logo.url).toBe('https://cdn.example.com/logo.png');
    expect(t.displayName).toBe('XTransfer');
    expect(t.shape.buttonRadius).toBe(6);
    expect(t.page.primary).toBe('#FF6A00');
  });
  it('appearance.logo beats the flat logo_url (Flows used to read only logo_url)', () => {
    const t = resolveCaptureTheme({ server: { logo_url: 'https://a/flat.png', appearance: { logo: { url: 'https://a/appearance.png' } } } });
    expect(t.logo.url).toBe('https://a/appearance.png');
  });
  it('treats the stored default #4f46e5 as unset', () => {
    expect(resolveCaptureTheme({ server: { primary_color: '#4F46E5' } }).page.primary).toBe('#4F7CFF');
  });
  it('blank values are unset', () => {
    const t = resolveCaptureTheme({ appearance: { colors: { primary: '  ' } }, legacy: { primaryColor: '' }, server: { appearance: { colors: { primary: '#118844' } } } });
    expect(t.page.primary).toBe('#118844');
  });
  it('mode follows the highest layer that sets it', () => {
    expect(resolveCaptureTheme({ appearance: { mode: 'light' }, server: { appearance: { mode: 'dark' } } }).mode).toBe('light');
    expect(resolveCaptureTheme({ server: { appearance: { mode: 'light' } } }).mode).toBe('light');
  });
  it('the engine wiring: legacy props over sessionData.branding, the run view over the session', () => {
    const b = resolveEngineBrand({
      primaryColor: '#FF6A00',
      branding: { display_name: 'Run view name', appearance: { colors: { surface: '#101010' } } },
      sessionBranding: { display_name: 'Session name', logo_url: 'https://a/s.png', appearance: { colors: { primary: '#118844', surface: '#202020' } } },
      prefersDark: false,
    });
    expect(b.theme.page.primary).toBe('#FF6A00');
    expect(b.theme.displayName).toBe('Run view name');
    expect(b.theme.logo.url).toBe('https://a/s.png');
    expect(b.strings.app).toBe('Run view name');
  });
  it('a theme from flowThemeToEngineTheme carries its appearance (unset stays unset)', () => {
    const et = flowThemeToEngineTheme(resolveTheme({ colors: { primary: '#118844' } }, false));
    expect(engineThemeToAppearance(et)).toEqual({ colors: { primary: '#118844' } });
    const b = resolveEngineBrand({ theme: et, prefersDark: false });
    expect(b.theme.mode).toBe('dark');
    expect(b.theme.page.background).toBe(SENSE_PAGE_DEFAULTS.dark.background);
    expect(b.theme.page.primary).toBe('#118844');
    // No appearance at all: the Flow's built-in tokens are not brand choices.
    expect(engineThemeToAppearance(flowThemeToEngineTheme(resolveTheme(undefined, false)))).toEqual({});
  });
});

describe('retired contourStart / contourEnd', () => {
  it('are accepted without error and ignored', () => {
    const withRetired = { capture: { contourStart: '#123456', contourEnd: 'nonsense', ring: '#00D4AA' } };
    expect(() => resolveCaptureTheme({ appearance: withRetired })).not.toThrow();
    expect(resolveCaptureTheme({ appearance: withRetired }).camera).toEqual(resolveCaptureTheme({ appearance: { capture: { ring: '#00D4AA' } } }).camera);
    expect(() => resolveCaptureColors({ contourStart: '#000', contourEnd: '#fff' })).not.toThrow();
    expect(resolveCaptureColors({ contourStart: '#000', contourEnd: '#fff' })).toEqual(resolveCaptureColors());
    expect(Object.keys(resolveCaptureColors())).not.toContain('contourStart');
  });
});

describe('CSS variables and the trace', () => {
  it('exposes the resolved tokens', () => {
    const v = captureThemeVars(resolveCaptureTheme({ appearance: NIGHT_PAY }));
    expect(v['--us-page-bg']).toBe('#0B0B12');
    expect(v['--us-btn-radius']).toBe('4px');
    expect(v['--us-cam-challenge']).toBe('#FF4FA3');
    expect(v['--us-success-tint']).toBe('rgba(0,212,170,0.16)');
  });
  it('strips characters that could break out of a declaration', () => {
    const v = captureThemeVars(resolveCaptureTheme({ appearance: { colors: { primary: 'red;} body{display:none' } } }));
    expect(v['--us-primary']).not.toMatch(/[;{}]/);
  });
  it('logs each field with its source layer', () => {
    const lines = captureThemeTrace(resolveCaptureTheme({ legacy: { primaryColor: '#FF6A00' }, server: { display_name: 'Acme' } }));
    expect(lines).toContain('page.primary=#FF6A00 (code:legacy)');
    expect(lines).toContain('displayName=Acme (dashboard)');
    expect(lines.some((l) => l.startsWith('page.background=') && l.endsWith('(default)'))).toBe(true);
  });
});

/** HSL lighten by `steps` x 5% (test helper mirroring the resolver). */
function lightenStep(hex: string, steps: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  const L = Math.min(1, l + 0.05 * steps);
  const q = L < 0.5 ? L * (1 + s) : L + s - L * s, p = 2 * L - q;
  const c = (t: number) => { let x = t; if (x < 0) x += 1; if (x > 1) x -= 1; return x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p; };
  const hx = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${hx(c(h + 1 / 3))}${hx(c(h))}${hx(c(h - 1 / 3))}`;
}
