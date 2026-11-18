import { describe, expect, it } from 'vitest';
import { INDUSTRIES, MARKETS, type IndustryId } from './presets';
import { brandFor } from './settings';
import { allScenarios, makeContext } from '../scenarios';
import { beatsFor, industryFromSector, marketFromHost, matchScenarios, OPENER, recommendedStory, RECOMMENDED, senseHeadline } from './story';
import { createDemo, getDemo, listDemos, moveInStory, readSettings } from './demos';

const c = makeContext(MARKETS.gb, INDUSTRIES.bank, brandFor({ prospect: '', logo: null, brandColor: null }));
const all = allScenarios(c);
const byId = new Map(all.map((s) => [s.id, s]));

describe('the story', () => {
  it('recommends the website’s three attacks per industry, after the opener, and they all exist', () => {
    for (const ind of Object.keys(RECOMMENDED) as IndustryId[]) {
      const story = recommendedStory(ind);
      expect(story[0]).toBe(OPENER);
      expect(story).toHaveLength(4);
      for (const id of story) expect(byId.has(id), `${ind}: ${id}`).toBe(true);
    }
  });

  it('plays every attack in three beats and the opener in two', () => {
    for (const s of all) {
      const beats = beatsFor(s);
      if (s.id === OPENER) { expect(beats.map((b) => b.id)).toEqual(['journey', 'sense']); continue; }
      expect(beats.map((b) => b.id), s.id).toEqual(['attack', 'kyc', 'sense']);
      expect(beats[0].steps.length, `${s.id} attack steps`).toBeGreaterThan(0);
      expect(beats[2].panel?.outcome).toBe(s.attackOutcome);
      expect(beats[1].panel?.outcome).toBe('kyc');
      for (const b of beats) expect(b.say.length, `${s.id} notes`).toBeGreaterThan(10);
    }
  });

  it('says it in the website’s words', () => {
    expect(senseHeadline(byId.get('face-swap-stolen-id')!)).toBe('Passed your KYC. Stopped by Sense.');
    expect(senseHeadline(byId.get('sim-swap-new-phone')!)).toBe('Stopped by Sense.');
  });

  it('finds an attack from what a prospect asks', () => {
    expect(matchScenarios(all, 'loan stacking')[0].id).toBe('same-face-new-name');
    expect(matchScenarios(all, 'sim swap')[0].id).toBe('sim-swap-new-phone');
    expect(matchScenarios(all, 'deepfake')[0].id).toBe('face-swap-stolen-id');
  });

  it('guesses industry and market from the website', () => {
    expect(industryFromSector('lending')).toBe('lender');
    expect(industryFromSector('other')).toBeNull();
    expect(marketFromHost('northline.co.uk')).toBe('gb');
    expect(marketFromHost('kuda.ng')).toBe('ng');
    expect(marketFromHost('example.com')).toBeNull();
  });
});

describe('demos', () => {
  it('keeps the opener first when reordering', () => {
    const s = ['fast-path', 'a', 'b', 'c'];
    expect(moveInStory(s, 'a', -1)).toEqual(s);
    expect(moveInStory(s, 'b', -1)).toEqual(['fast-path', 'b', 'a', 'c']);
    expect(moveInStory(s, 'c', 1)).toEqual(s);
  });

  it('creates a demo with its own settings', () => {
    const mem = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); } } });
    const d = createDemo({ prospect: 'Northline', industry: 'lender' }, recommendedStory('lender'));
    expect(getDemo(d.id)?.story[1]).toBe('same-face-new-name');
    expect(readSettings(d.id).prospect).toBe('Northline');
    expect(listDemos().some((x) => x.id === d.id)).toBe(true);
  });
});
