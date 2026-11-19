import { describe, expect, it } from 'vitest';
import { ATTACKS, changed, DIAL_GROUPS, describeDials, flowReasons, GENUINE, labOutcome, questions, readReason, type LabFlow } from './lab';
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
  idn: ['none', 'mine', 'stolen', 'synth'],
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
    expect(questions(base)).toEqual({ real: 'yes', right: null, one: 'yes' });
    expect(questions({ ...base, device: 'flag' }).real).toBe('unsure');
    expect(questions({ ...base, liveness: 'fail', device: 'flag' }).real).toBe('no');
    expect(questions({ ...base, dedupe: 'fail' }).one).toBe('no');
    expect(questions({ ...base, device: 'skip' }).real).toBe('yes');
  });
});

describe('the lab Flow (ID dials)', () => {
  const flow = (outcome: string | null, bvn: string, match: string | null, score?: number): LabFlow => ({
    state: outcome ? 'completed' : 'running', outcome, sessionId: 'ses_1',
    steps: [
      { stepId: 'live', toolId: 'face_liveness_enrollment', verdict: 'pass', scores: {}, detail: null },
      { stepId: 'bvn', toolId: 'bvn_lookup', verdict: bvn, scores: {}, detail: null },
      ...(match ? [{ stepId: 'match', toolId: 'face_to_document_match', verdict: match, scores: score != null ? { matchScore: score } : {}, detail: null }] : []),
    ],
  });
  it('answers Right person? from the registry and Face Match', () => {
    expect(questions(null, flow('APPROVE', 'pass', 'pass', 99.9)).right).toBe('yes');
    expect(questions(null, flow('REJECT', 'pass', 'reject', 12.4)).right).toBe('no');
    expect(questions(null, flow('REJECT', 'reject', null)).right).toBe('no');
  });
  it('takes the verdict from the Flow outcome', () => {
    expect(labOutcome(null, flow('APPROVE', 'pass', 'pass'))).toBe('let');
    expect(labOutcome(null, flow('REJECT', 'pass', 'reject'))).toBe('stop');
    expect(labOutcome(null, flow(null, 'pass', null))).toBe('pending');
  });
  it('explains the ID steps with their score and setting', () => {
    expect(flowReasons(flow('REJECT', 'pass', 'reject', 12.4))).toEqual([
      { action: 'note', text: 'The BVN is real: the registry returned a record with a photo', setting: 'Registry · BVN lookup' },
      { action: 'block', text: 'The selfie doesn’t match the ID’s record photo (12.4)', setting: 'Face Match (registry) · threshold' },
    ]);
    expect(flowReasons(flow('REJECT', 'reject', null))[0].text).toBe('The registry has no record for this BVN');
  });
});
