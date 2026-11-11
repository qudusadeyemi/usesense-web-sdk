/**
 * BRAND-v1 section 9: every capture element reads a token or is on the fixed
 * list. Fails on any new literal colour in the capture UI code.
 *
 * - Guided capture files: no literal colours at all. Colours come from
 *   `var(--us-*)` (the resolved theme) or CAPTURE_FIXED_COLORS.
 * - The legacy ("I'm Ready") flow keeps its literals, frozen: adding one
 *   fails; removing one only needs this list trimmed.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureThemeVars, resolveCaptureTheme } from '../capture/capture-theme';

const SRC = join(__dirname, '..');
const read = (f: string) => readFileSync(join(SRC, f), 'utf8');

/** Literal colours in source, with comments removed. */
function literalColours(src: string): string[] {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const re = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(\s*[\d.]+[^)]*\)/g;
  return (code.match(re) ?? []).map((m) => m.replace(/\s+/g, '').toLowerCase());
}

const GUIDED_FILES = [
  'components/capture-styles.ts',
  'components/ExtraCheck.tsx',
  'components/CapturePreview.tsx',
  'components/capture-brand.ts',
  'capture/capture-copy.ts',
  'capture/contour-scan.ts',
  'capture/extra-check.ts',
];

/** The legacy flow's literals (frozen). */
const LEGACY_ALLOWED: Record<string, string[]> = {
  'components/VerificationCaptureEngine.tsx': ['rgba(255,255,255,0.1)', '#fff', '#00d4aa'],
  'components/styles.ts': [
    '#1c1a17', '#ffffff', '#6b6760', '#f5f3ef', '#e8e5de', '#00d4aa', '#ff6b4a', '#ffb84d', '#fdfcfa',
    '#00aa88', 'rgba(0,212,170,0.2)', 'rgba(0,212,170,0.08)', 'rgba(255,255,255,0.85)', 'rgba(28,26,23,0.65)',
    'rgba(255,255,255,0.5)', 'rgba(255,255,255,0.08)', '#0c0b09', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0.2)',
    'rgba(12,11,9,0.8)', 'rgba(79,124,255,0.15)', '#d0ccbf', '#db4e33', 'rgba(12,11,9,0.5)', 'rgba(0,0,0,0.5)',
    'rgba(255,107,74,0.8)', 'rgba(255,107,74,0.4)', 'rgba(28,26,23,0.82)', 'rgba(255,107,74,0.08)', 'rgba(255,107,74,0.2)',
    'rgba(12,11,9,0.7)', 'rgba(0,212,170,0.15)', 'rgba(0,212,170,0.3)', 'rgba(255,184,77,0.08)', 'rgba(255,184,77,0.2)',
    '#db973a', 'rgba(255,107,74,0.06)', 'rgba(255,184,77,0.06)', 'rgba(255,255,255,0.1)', 'rgba(0,0,0,0.08)',
    'rgba(255,255,255,0.3)', '#9e9a92', 'rgba(0,0,0,0.65)', '#fff', 'rgba(0,0,0,0.75)', 'rgba(255,255,255,0.6)',
    'rgba(255,255,255,0.15)', 'rgba(0,0,0,0.7)', 'rgba(255,255,255,0.7)',
  ],
};

describe('no literal colours in guided capture UI code', () => {
  for (const f of GUIDED_FILES) {
    it(f, () => {
      expect(literalColours(read(f))).toEqual([]);
    });
  }
});

describe('the legacy flow gains no new literal colours', () => {
  for (const [f, allowed] of Object.entries(LEGACY_ALLOWED)) {
    it(f, () => {
      const extra = [...new Set(literalColours(read(f)))].filter((c) => !allowed.includes(c));
      expect(extra).toEqual([]);
    });
  }
});

describe('every token the capture styles read is defined by the theme', () => {
  it('capture-styles.ts', () => {
    const used = new Set((read('components/capture-styles.ts').match(/var\((--us-[a-z0-9-]+)\)/g) ?? []).map((m) => m.slice(4, -1)));
    const defined = new Set(Object.keys(captureThemeVars(resolveCaptureTheme())));
    expect([...used].filter((v) => !defined.has(v))).toEqual([]);
  });
});
