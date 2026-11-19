import { describe, expect, it } from 'vitest';
import { ATTACKS, changed, DIAL_GROUPS, describeDials, GENUINE, questions, readReason } from './lab';
import type { LiveResult } from './live';

/* Mirrors DIALS in usesense-watchtower modules/demo-shares/simulation.ts. If
   Watchtower gains a value, add it there first: unknown values are dropped. */
const SERVER_DIALS: Record<string, string[]> = {
  camera: ['real', 'vc', 'vci', 'vcr'],
  bot: ['ok', 'head', 'wd', 'sw'],
  net: ['home', 'vpn', 'proxy', 'tor', 'dc'],
  vel: ['ok', 'high'],
  who: ['me', 'ai', 'swap', 'print', 'screen', 'mask'],
  org: ['new', 'dup'],
};

describe('dials', () => {
  it('offer exactly the values Watchtower accepts, genuine first', () => {
    const dials = DIAL_GROUPS.flatMap((g) => g.dials);
    expect(Object.fromEntries(dials.map((d) => [d.key, d.options.map(([v]) => v)]))).toEqual(SERVER_DIALS);
    for (const [k, vs] of Object.entries(SERVER_DIALS)) expect(GENUINE[k as keyof typeof GENUINE]).toBe(vs[0]);
  });

  it('send only what changed', () => {
    expect(changed({ camera: 'vc', net: 'home', who: 'nope' })).toEqual({ camera: 'vc' });
    expect(describeDials({})).toBe('Genuine customer');
    expect(describeDials({ camera: 'vc', net: 'vpn' })).toBe('Virtual camera used, VPN');
  });

  it('every planned attack uses valid dials, and the first is genuine', () => {
    expect(ATTACKS[0].dials).toEqual({});
    for (const a of ATTACKS.slice(1)) expect(Object.keys(changed(a.dials)).length).toBe(Object.keys(a.dials).length);
  });
});

describe('reasons', () => {
  it('name the policy setting behind each engine reason', () => {
    expect(readReason('Hard gate: LiveSense 8 < floor 20')).toEqual({ action: 'block', text: 'Liveness scored 8: not a live person', setting: 'Liveness floor · 20' });
    expect(readReason('Hard gate: Dedupe risk 100 > ceiling 85').setting).toBe('Duplicate ceiling · 85');
    expect(readReason('Hard gate: Virtual camera selected (OBS Virtual Camera) [virtual_camera_selected]')).toEqual({
      action: 'block', text: 'The selfie came through camera software', setting: 'Policy gate · virtual camera selected',
    });
    expect(readReason('Review: Virtual camera installed on the device: OBS [virtual_camera_installed]').action).toBe('review');
    expect(readReason('Weakest Link: borderline pillar(s) — deepsense').action).toBe('review');
    expect(readReason('Weakest Link: pillar(s) failed — livesense').action).toBe('block');
    expect(readReason('Weighted Composite: 91 >= approve 85')).toEqual({ action: 'note', text: 'Overall score 91', setting: 'Approve threshold · 85' });
    expect(readReason('Something new')).toEqual({ action: 'note', text: 'Something new', setting: null });
  });
});

describe('questions', () => {
  const base: LiveResult = { sessionId: 's', identityId: null, outcome: 'let', liveness: 'pass', device: 'pass', dedupe: 'pass', scores: {}, reasons: [], type: 'enrollment', env: 'sandbox' };
  it('answer from the pillars', () => {
    expect(questions(base)).toEqual({ real: 'yes', one: 'yes' });
    expect(questions({ ...base, device: 'flag' }).real).toBe('unsure');
    expect(questions({ ...base, liveness: 'fail', device: 'flag' }).real).toBe('no');
    expect(questions({ ...base, dedupe: 'fail' }).one).toBe('no');
    expect(questions({ ...base, device: 'skip' }).real).toBe('yes');
  });
});
