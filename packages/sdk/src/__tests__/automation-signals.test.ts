import { describe, expect, it } from 'vitest';
import { automationMarkers, userAgentHintsMismatch } from '../capture/web-integrity';

describe('automation markers', () => {
  it('finds nothing on a plain browser', () => {
    expect(automationMarkers({}, { documentElement: { getAttribute: () => null } }, { userAgent: 'Mozilla/5.0 Chrome/130' })).toEqual([]);
  });

  it('names the framework that left traces', () => {
    const doc = { documentElement: { getAttribute: () => null }, $cdc_asdjflasutopfhvcZLmcfl_: {} };
    expect(automationMarkers({ __playwright__binding__: {} }, doc, {})).toEqual(expect.arrayContaining(['playwright', 'cdp']));
    expect(automationMarkers({ callPhantom: () => 0 }, { documentElement: { getAttribute: () => null } }, {})).toEqual(['phantomjs']);
    expect(automationMarkers({}, { documentElement: { getAttribute: () => '' } }, {})).toEqual(['webdriver_attr']);
    expect(automationMarkers({}, { documentElement: { getAttribute: () => null } }, { userAgentData: { brands: [{ brand: 'HeadlessChrome' }] } })).toEqual(['cdp']);
  });
});

describe('user agent vs client hints', () => {
  it('agrees for a normal Chrome on macOS', () => {
    const nav = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0', userAgentData: { platform: 'macOS', brands: [{ brand: 'Google Chrome' }, { brand: 'Chromium' }] } };
    expect(userAgentHintsMismatch(nav).mismatch).toBe(false);
  });

  it('flags a spoofed user agent', () => {
    const nav = { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0', userAgentData: { platform: 'Linux', brands: [{ brand: 'Chromium' }] } };
    expect(userAgentHintsMismatch(nav)).toEqual({ mismatch: true, detail: 'platform linux vs ua windows' });
  });

  it('says nothing without client hints (Safari, Firefox)', () => {
    expect(userAgentHintsMismatch({ userAgent: 'Mozilla/5.0 Safari/605' }).mismatch).toBe(false);
  });
});
