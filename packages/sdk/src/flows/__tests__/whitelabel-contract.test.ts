// Tests for the white-label contract resolution — the keystone every SDK +
// the server mirror: appearance/copy merge precedence (SDK > server > default)
// and FlowAppearance -> FlowTheme resolution (palette, dark layer, shape, icons,
// loader).

import { describe, it, expect } from 'vitest';
import { mergeAppearance, resolveTheme, LIGHT_THEME, DARK_THEME } from '../theme';
import { mergeCopy, txt } from '../copy';

describe('mergeAppearance', () => {
  it('SDK-init (high) wins over server (low), deep-merging colors', () => {
    const merged = mergeAppearance(
      { colors: { primary: '#AAA' } },
      { colors: { primary: '#BBB', background: '#FFF' } },
    );
    expect(merged?.colors?.primary).toBe('#AAA');
    expect(merged?.colors?.background).toBe('#FFF');
  });

  it('returns the present side when the other is undefined', () => {
    expect(mergeAppearance(undefined, { mode: 'dark' })?.mode).toBe('dark');
    expect(mergeAppearance({ mode: 'light' }, undefined)?.mode).toBe('light');
    expect(mergeAppearance(undefined, undefined)).toBeUndefined();
  });

  it('merges the dark override layer per field', () => {
    const merged = mergeAppearance(
      { colors: { dark: { background: '#000' } } },
      { colors: { dark: { foreground: '#FFF' } } },
    );
    expect(merged?.colors?.dark?.background).toBe('#000');
    expect(merged?.colors?.dark?.foreground).toBe('#FFF');
  });

  it('merges icons per-slot and loader per-field', () => {
    const merged = mergeAppearance(
      { icons: { success: 'a.png' }, loader: { imageUrl: 'x.gif' } },
      { icons: { review: 'b.png' }, loader: { style: 'dots' } },
    );
    expect(merged?.icons?.success).toBe('a.png');
    expect(merged?.icons?.review).toBe('b.png');
    expect(merged?.loader?.imageUrl).toBe('x.gif');
    expect(merged?.loader?.style).toBe('dots');
  });
});

describe('resolveTheme', () => {
  it('overrides the base palette from appearance, leaving the rest default', () => {
    const t = resolveTheme({ colors: { primary: '#123456' } }, false);
    expect(t.primary).toBe('#123456');
    expect(t.bg).toBe(LIGHT_THEME.bg);
    expect(t.fg).toBe(LIGHT_THEME.fg);
  });

  it('applies the dark-layer overrides only in dark mode', () => {
    const appearance = { colors: { background: '#EEE', dark: { background: '#111' } } };
    expect(resolveTheme(appearance, false).bg).toBe('#EEE');
    expect(resolveTheme(appearance, true).bg).toBe('#111');
  });

  it('maps shape, loader and icons onto the resolved theme', () => {
    const t = resolveTheme(
      { shape: { buttonRadius: 4, buttonStyle: 'outline' }, loader: { imageUrl: 'x.gif' }, icons: { success: 's.png' } },
      false,
    );
    expect(t.buttonRadius).toBe(4);
    expect(t.buttonStyle).toBe('outline');
    expect(t.loader?.imageUrl).toBe('x.gif');
    expect(t.icons?.success).toBe('s.png');
  });

  it('treats a blank color override as unset (falls back, never a broken value)', () => {
    expect(resolveTheme({ colors: { primary: '' } }, false).primary).toBe(LIGHT_THEME.primary);
    expect(resolveTheme({ colors: { primary: '   ' } }, false).primary).toBe(LIGHT_THEME.primary);
    expect(resolveTheme({ colors: { primary: '#abc' } }, false).primary).toBe('#abc');
  });

  it('background.color paints light mode only, never over the dark palette', () => {
    const a = { background: { color: '#FFFFFF' } };
    expect(resolveTheme(a, false).bg).toBe('#FFFFFF');
    expect(resolveTheme(a, true).bg).toBe(DARK_THEME.bg);
  });

  it('returns the built-in defaults when no appearance is given', () => {
    expect(resolveTheme(undefined, false)).toEqual(LIGHT_THEME);
    expect(resolveTheme(undefined, true)).toEqual(DARK_THEME);
  });
});

describe('mergeCopy + txt', () => {
  it('SDK copy wins and groups deep-merge', () => {
    const merged = mergeCopy(
      { face: { title: 'Hi' } },
      { face: { title: 'Yo', body: 'B' }, form: { title: 'F' } },
    );
    expect(merged?.face?.title).toBe('Hi');
    expect(merged?.face?.body).toBe('B');
    expect(merged?.form?.title).toBe('F');
  });

  it('txt falls back on blank/undefined, keeps a real override', () => {
    expect(txt(undefined, 'def')).toBe('def');
    expect(txt('   ', 'def')).toBe('def');
    expect(txt('custom', 'def')).toBe('custom');
  });
});
