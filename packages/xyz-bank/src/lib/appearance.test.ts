import { describe, expect, it } from 'vitest';
import { appearanceOf, brandFor } from './settings';

/* Every demo check runs in the Sense Demo org, whose dashboard brand belongs
   to someone else (it was XTransfer on 2026-11-19). The capture falls back to
   it for anything the demo doesn't set, so the demo always sets its logo. */
describe("the capture never falls back to the org's logo", () => {
  it("sends the demo's logo", () => {
    const a = appearanceOf(brandFor({ prospect: 'OmniPay', logo: 'https://omnipay.example/logo.png', brandColor: '#1d4ed8' }));
    expect(a.logo).toEqual({ url: 'https://omnipay.example/logo.png', placement: 'header' });
  });
  it('says no logo when the demo has none', () => {
    expect(appearanceOf(brandFor({ prospect: 'OmniPay', logo: null, brandColor: null })).logo).toEqual({ placement: 'none' });
  });
  it('says no logo in a QR link that has no room for it (the phone fetches it)', () => {
    const a = appearanceOf(brandFor({ prospect: 'OmniPay', logo: `data:image/png;base64,${'A'.repeat(5000)}`, brandColor: null }), { inlineAssets: false });
    expect(a.logo).toEqual({ placement: 'none' });
  });
});
