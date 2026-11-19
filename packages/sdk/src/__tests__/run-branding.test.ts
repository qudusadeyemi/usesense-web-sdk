import { describe, expect, it } from 'vitest';
import { codeFirstBranding } from '../flows/run-branding';

const server = {
  display_name: 'XTransfer',
  logo_url: 'https://static.xtransfer.com/logo.png',
  primary_color: '#fe6c03',
  redirect_url: null,
  appearance: { colors: { primary: '#fe6c03' } },
};

describe('Flow runner branding is code first (BRAND-v1)', () => {
  it("uses the developer's logo and name over the dashboard's", () => {
    const b = codeFirstBranding(server, { appearance: { logo: { url: 'data:image/png;base64,AAAA' } }, displayName: 'OmniPay' });
    expect(b?.logo_url).toBe('data:image/png;base64,AAAA');
    expect(b?.display_name).toBe('OmniPay');
    expect(b?.appearance).toEqual(server.appearance);
  });
  it('placement none from code shows no logo, never the dashboard one', () => {
    expect(codeFirstBranding(server, { appearance: { logo: { placement: 'none' } }, displayName: 'OmniPay' })?.logo_url).toBeNull();
  });
  it('keeps the dashboard brand when the developer sets neither', () => {
    expect(codeFirstBranding(server, {})).toBe(server);
    expect(codeFirstBranding(server, { displayName: 'OmniPay' })?.logo_url).toBe(server.logo_url);
  });
  it('works with no dashboard brand', () => {
    expect(codeFirstBranding(null, { displayName: 'OmniPay' })).toMatchObject({ display_name: 'OmniPay', logo_url: null });
    expect(codeFirstBranding(null, {})).toBeNull();
  });
});
