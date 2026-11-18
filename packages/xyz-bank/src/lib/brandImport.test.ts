// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { applyImport, cleanWebsite, foundPaths, setByRep, theirs, type BrandImportResult } from './brandImport';
import { packHandoff, unpackHandoff } from './live';
import { appearanceOf, brandFor, DEFAULT_SETTINGS, type DemoSettings } from './settings';

const result: BrandImportResult = {
  url: 'https://northline.example/',
  host: 'northline.example',
  fields: {
    display_name: { value: 'Northline', source: 'og:site_name' },
    'appearance.logo.url': { value: 'https://northline.example/logo.svg', source: 'Header logo' },
    'appearance.logo.darkUrl': { value: 'https://northline.example/logo-white.svg', source: 'Footer logo' },
    'appearance.colors.primary': { value: '#1F3A93', source: 'Main button' },
    'appearance.colors.primaryForeground': { value: '#ffffff', source: 'Contrast check' },
    'appearance.colors.accent': { value: '#FFD166', source: '--accent' },
    'appearance.typography.fontFamily': { value: '"Inter", sans-serif', source: 'body' },
    'appearance.typography.displayFamily': { value: '"Fraunces", serif', source: 'h1' },
    'appearance.typography.fontCss': { value: "@import url('https://fonts.googleapis.com/css2?family=Inter&family=Fraunces&display=swap');", source: 'Google Fonts link' },
    'appearance.typography.headingCase': { value: 'upper', source: 'h1 text-transform' },
    'appearance.shape.buttonRadius': { value: 999, source: 'Main button' },
    'appearance.shape.buttonStyle': { value: 'filled', source: 'Main button' },
  },
  missing: [],
  contrast: { primary: '#1F3A93', foreground: '#ffffff', ratio: 10.4, passes: true },
  palette: [],
  notes: [],
};

const fresh: DemoSettings = { ...DEFAULT_SETTINGS };

describe('website brand import', () => {
  it('rewords the job for a prospect', () => {
    expect(theirs("Your site's name")).toBe("Their site's name");
    expect(theirs('Your site’s structured data names it as your logo')).toBe('Their site’s structured data names it as their logo');
    expect(theirs('Learning what you do')).toBe('Learning what they do');
    expect(theirs('Yourself and yours')).toBe('Yourself and theirs');
  });

  it('cleans website input the way the import expects', () => {
    expect(cleanWebsite('https://www.Northline.example/')).toBe('northline.example');
    expect(cleanWebsite('northline.example/business')).toBe('northline.example/business');
    expect(cleanWebsite('not a site')).toBeNull();
    expect(cleanWebsite('ftp://x.com')).toBeNull();
  });

  it('lists found fields, with text on buttons riding on the primary colour', () => {
    const f = foundPaths(result);
    expect(f).toContain('appearance.colors.primary');
    expect(f).not.toContain('appearance.colors.primaryForeground');
  });

  it('fills name, logo, colour and the rest, and marks them as from the website', () => {
    const next = { ...fresh, ...applyImport(fresh, result, foundPaths(result)) };
    expect(next.prospect).toBe('Northline');
    expect(next.logo).toBe('https://northline.example/logo.svg');
    expect(next.brandColor).toBe('#1F3A93');
    expect(next.website).toBe('northline.example');
    expect(next.site).toMatchObject({ logoDark: 'https://northline.example/logo-white.svg', onBrand: '#ffffff', headingCase: 'upper', buttonRadius: 999, buttonStyle: 'filled' });
    // A re-import may replace what came from the website, but hand edits start unticked.
    expect(setByRep(next, 'display_name')).toBe(false);
    expect(setByRep({ ...fresh, prospect: 'Typed by rep' }, 'display_name')).toBe(true);
  });

  it('applies only the chosen fields', () => {
    const p = applyImport(fresh, result, ['appearance.logo.url']);
    expect(p.logo).toBeTruthy();
    expect(p.brandColor).toBeUndefined();
    expect(p.prospect).toBeUndefined();
    expect(p.site?.fontFamily).toBeUndefined();
  });

  it('turns the imported brand into the SDK appearance, keeping Sense result colours', () => {
    const s = { ...fresh, ...applyImport(fresh, result, foundPaths(result)) };
    const a = appearanceOf(brandFor(s));
    expect(a.colors).toEqual({ primary: '#1F3A93', primaryForeground: '#ffffff' });
    expect(a.typography?.fontFamily).toContain('Inter');
    expect(a.typography?.fontCss).toContain('fonts.googleapis.com');
    expect(a.shape).toEqual({ buttonRadius: 999, buttonStyle: 'filled' });
    expect(a.logo?.url).toBe('https://northline.example/logo.svg');
  });

  it('never uses text on buttons that fails on a colour the rep changed', () => {
    const s = { ...fresh, ...applyImport(fresh, result, foundPaths(result)) };
    const b = brandFor({ ...s, brandColor: '#FFE600' });
    expect(b.onBrand).toBe('#0B1F1A');
  });

  it('keeps the QR link small: no inline logo data in the hand-off', async () => {
    const s = { ...fresh, ...applyImport(fresh, result, foundPaths(result)), logo: `data:image/png;base64,${'A'.repeat(200_000)}` };
    const a = appearanceOf(brandFor(s), { inlineAssets: false });
    expect(a.logo).toBeUndefined();
    const session = { session_id: 'ses_x', session_token: 't'.repeat(200), environment: 'sandbox' } as never;
    const packed = await packHandoff(session, 'https://api.usesense.ai', { name: 'Northline', color: '#1F3A93', appearance: a });
    expect(packed.length).toBeLessThan(900);
    expect((await unpackHandoff(packed))?.a?.colors?.primary).toBe('#1F3A93');
  });
});
