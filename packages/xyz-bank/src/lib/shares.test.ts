// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pageFor, settingsFor, shareUrl } from './shares';
import { brandFor, DEFAULT_SETTINGS, type DemoSettings } from './settings';

const s: DemoSettings = {
  ...DEFAULT_SETTINGS,
  prospect: 'Northline', website: 'northline.example', brandColor: '#1F3A93', logo: 'https://northline.example/logo.svg',
  site: { logoDark: 'https://northline.example/w.svg', fontFamily: '"Inter", sans-serif', buttonRadius: 999, sources: { 'appearance.colors.primary': 'website' } },
  sandboxKey: 'sk_test_secret', liveKey: 'sk_live_secret',
};
const row = { prospect: 'Northline', industry: 'wallet', market: 'ng', scenarios: ['new-payee'] };

describe('prospect links', () => {
  it('carries the brand for this prospect, and never a key', () => {
    const p = pageFor(s, row);
    expect(p.brand.color).toBe('#1F3A93');
    expect(p.brand.logoDark).toBe('https://northline.example/w.svg');
    expect(p.brand.site).not.toHaveProperty('sources');
    expect(JSON.stringify(p)).not.toContain('sk_');
  });

  it('carries only the name when the brand on Set up is another prospect’s', () => {
    const p = pageFor(s, { ...row, prospect: 'Other Co' });
    expect(p.prospect).toBe('Other Co');
    expect(p.brand).toEqual({ color: null, logo: null, logoDark: null, site: null });
  });

  it('round-trips into a branded, key-free, live-off page', () => {
    const back = { ...DEFAULT_SETTINGS, ...settingsFor(pageFor(s, row)) };
    const b = brandFor(back);
    expect(b.name).toBe('Northline');
    expect(b.logoDark).toBe('https://northline.example/w.svg');
    expect(b.site?.buttonRadius).toBe(999);
    expect(back.liveMode).toBe('off');
    expect(back.sandboxKey).toBe('');
    expect(back.industry).toBe('wallet');
  });

  it('builds the public URL', () => {
    expect(shareUrl('https://try.usesense.ai', 'ds_abc')).toBe('https://try.usesense.ai/xyz/p/ds_abc');
  });
});
