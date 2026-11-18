import { describe, expect, it } from 'vitest';
import { INDUSTRIES, MARKETS, type IndustryId, type MarketId } from '../lib/presets';
import { brandFor } from '../lib/settings';
import { allScenarios, makeContext, orderedFor } from './index';

const ctxFor = (m: MarketId, i: IndustryId, prospect = '') =>
  makeContext(MARKETS[m], INDUSTRIES[i], brandFor({ prospect, logo: null, brandColor: null }));

describe('scenario library', () => {
  const c = ctxFor('gb', 'bank');
  const all = allScenarios(c);

  it('has the 17 scenarios from the proposal, with unique ids', () => {
    expect(all).toHaveLength(17);
    expect(new Set(all.map((s) => s.id)).size).toBe(17);
  });

  it('every variant has steps, exactly one decision step or an aftermath, and four answers', () => {
    for (const s of all) {
      for (const [vid, v] of Object.entries(s.variants)) {
        expect(v.steps.length, `${s.id}/${vid}`).toBeGreaterThan(1);
        expect(new Set(v.steps.map((x) => x.id)).size, `${s.id}/${vid} step ids`).toBe(v.steps.length);
        expect(v.steps.filter((x) => x.decide).length, `${s.id}/${vid} decide`).toBeLessThanOrEqual(1);
        expect(v.panel.answers.map((a) => a.q).sort(), `${s.id}/${vid}`).toEqual(['one', 'real', 'right', 'still']);
      }
    }
  });

  it('the attack variant ends in the outcome the scenario claims', () => {
    for (const s of all) expect(s.variants.attack.panel.outcome, s.id).toBe(s.attackOutcome);
  });

  it('without Sense is always the KYC-only view', () => {
    for (const s of all) expect(s.variants.nosense.panel.outcome, s.id).toBe('kyc');
  });

  it('every industry lead points at a real scenario', () => {
    const ids = new Set(all.map((s) => s.id));
    for (const ind of Object.values(INDUSTRIES)) for (const id of ind.leads) expect(ids.has(id), `${ind.id}:${id}`).toBe(true);
  });

  it('orders scenarios by the industry leads', () => {
    expect(orderedFor(ctxFor('gb', 'gig'))[0].id).toBe('rented-account');
    expect(orderedFor(ctxFor('gb', 'lender'))[0].id).toBe('same-face-new-name');
  });

  it('copy has no em dashes and no unfilled placeholders, in every market', () => {
    for (const m of Object.keys(MARKETS) as MarketId[]) {
      const text = JSON.stringify(allScenarios(ctxFor(m, 'bank', 'Northline Credit')));
      expect(text.includes('\u2014'), m).toBe(false);
      expect(/undefined|NaN|\{[a-z]+\}/.test(text), m).toBe(false);
    }
  });

  it('uses the co-brand name in copy', () => {
    const text = JSON.stringify(allScenarios(ctxFor('ng', 'wallet', 'Northline Credit')));
    expect(text).toContain('Northline Credit');
    expect(text).toContain('NIN');
  });
});
