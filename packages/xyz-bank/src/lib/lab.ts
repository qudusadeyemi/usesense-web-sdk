/* Attack lab: dials a rep sets before a real check in the Sense Demo org.
   Watchtower applies them where scoring reads each signal
   (modules/demo-shares/simulation.ts), then the real engine and the Sense
   Demo policy decide. This file holds the dials, the planned attacks, and
   how a decision's reasons read on screen. The verdict always comes from
   the run; nothing here predicts it. */
import type { LiveResult } from './live';

export type DialKey = 'camera' | 'bot' | 'net' | 'vel' | 'who' | 'org' | 'idn';
export type Dials = Partial<Record<DialKey, string>>;

export interface DialDef { key: DialKey; label: string; options: [string, string][] }
export interface DialGroup { id: 'device' | 'face' | 'identity' | 'history'; label: string; dials: DialDef[] }

/* The values Watchtower accepts (simulation.ts DIALS). The first option is genuine. */
export const DIAL_GROUPS: DialGroup[] = [
  {
    id: 'device', label: 'Device', dials: [
      { key: 'camera', label: 'Camera', options: [['real', 'Real camera'], ['vc', 'Virtual camera used'], ['vci', 'Virtual camera installed only'], ['vcr', 'Virtual camera, renamed']] },
      { key: 'bot', label: 'Browser', options: [['ok', 'Normal'], ['head', 'Headless'], ['wd', 'Webdriver'], ['sw', 'Software renderer']] },
      { key: 'net', label: 'Network', options: [['home', 'Home / mobile'], ['vpn', 'VPN'], ['proxy', 'Proxy'], ['tor', 'Tor'], ['dc', 'Datacenter']] },
      { key: 'vel', label: 'Velocity', options: [['ok', 'Normal'], ['high', 'Many attempts this hour']] },
    ],
  },
  {
    id: 'face', label: 'Liveness', dials: [
      { key: 'who', label: 'In front of camera', options: [['me', 'Me, live'], ['ai', 'AI-generated face'], ['swap', 'Deepfake face swap'], ['print', 'Printed photo'], ['screen', 'Video on a screen'], ['mask', '3D mask']] },
    ],
  },
  {
    /* Any ID option runs the lab Flow in Watchtower (demo-shares/lab-flow.ts):
       a real BVN lookup on a sandbox test number, then Face Match against the
       record photo. "Not asked" keeps the plain face check. */
    id: 'identity', label: 'Identity', dials: [
      { key: 'idn', label: 'ID number', options: [['none', 'Not asked'], ['mine', 'My own ID'], ['stolen', 'Stolen ID (real person)'], ['synth', 'Synthetic (no such person)']] },
    ],
  },
  {
    id: 'history', label: 'Face history', dials: [
      { key: 'org', label: 'In this org', options: [['new', 'Never seen'], ['dup', 'Enrolled under another name']] },
    ],
  },
];

const ALL = DIAL_GROUPS.flatMap((g) => g.dials);
export const GENUINE: Record<DialKey, string> = Object.fromEntries(ALL.map((d) => [d.key, d.options[0][0]])) as Record<DialKey, string>;

/** Only the dials off genuine, as Watchtower stores them. */
export function changed(d: Dials): Dials {
  const out: Dials = {};
  for (const def of ALL) {
    const v = d[def.key];
    if (v && v !== GENUINE[def.key] && def.options.some(([o]) => o === v)) out[def.key] = v;
  }
  return out;
}

export const optionLabel = (key: DialKey, value: string): string =>
  ALL.find((d) => d.key === key)?.options.find(([o]) => o === value)?.[1] ?? value;

/** "Virtual camera used, VPN" for a run's dials; "Genuine customer" when none changed. */
export function describeDials(d: Dials): string {
  const c = changed(d);
  const parts = (Object.keys(c) as DialKey[]).map((k) => optionLabel(k, c[k]!));
  return parts.length ? parts.join(', ') : 'Genuine customer';
}

export interface LabAttack { id: string; label: string; dials: Dials; line: string }

export const ATTACKS: LabAttack[] = [
  { id: 'genuine', label: 'Genuine customer', dials: {}, line: 'A real person on a real device. Sense lets them straight through.' },
  { id: 'deepfake-vcam', label: 'Deepfake via virtual camera', dials: { camera: 'vc', who: 'swap' }, line: 'A face swap fed in through OBS. Caught at the camera and by liveness.' },
  { id: 'renamed-vcam', label: 'Disguised virtual camera', dials: { camera: 'vcr' }, line: 'Camera software renamed to look like a webcam. Its settings give it away.' },
  { id: 'printed', label: 'Printed photo', dials: { who: 'print' }, line: 'Holding up a photo of someone. Liveness stops it.' },
  { id: 'bot', label: 'Bot from a datacenter', dials: { bot: 'head', net: 'dc', vel: 'high' }, line: 'A script driving a headless browser from a cloud server, many times an hour.' },
  { id: 'own-id', label: 'Genuine, with their ID', dials: { idn: 'mine' }, line: 'A real person with their own BVN. The registry photo matches the selfie.' },
  { id: 'stolen-id', label: 'Stolen ID', dials: { idn: 'stolen' }, line: 'A real person’s BVN, a different face. Face Match against the record photo stops it.' },
  { id: 'synthetic-id', label: 'Synthetic identity', dials: { idn: 'synth' }, line: 'An invented BVN. The registry has no such person.' },
  { id: 'repeat', label: 'Repeat sign-up', dials: { org: 'dup' }, line: 'The same face trying again under a new name.' },
  { id: 'mask', label: '3D mask', dials: { who: 'mask' }, line: 'A mask passes the basic checks, so Sense holds it for review.' },
];

/* ---------- Reading a decision ---------- */

export type ReasonAction = 'block' | 'review' | 'note';
export interface LabReason { action: ReasonAction; text: string; setting: string | null }

const GATE_WORDS: Record<string, string> = {
  virtual_camera_selected: 'The selfie came through camera software',
  virtual_camera_label: "The camera's name looks like camera software",
  virtual_camera_suspected: "The camera's settings look like software",
  virtual_camera_installed: 'Camera software is installed, a real camera took the selfie',
  device_shared_identities: 'Several people on one device',
};

/** One engine reason in plain words, with the policy setting that produced it. */
export function readReason(raw: string): LabReason {
  const r = raw.trim();
  let m = r.match(/^Hard gate: LiveSense (\d+) < floor (\d+)/);
  if (m) return { action: 'block', text: `Liveness scored ${m[1]}: not a live person`, setting: `Liveness floor · ${m[2]}` };
  m = r.match(/^Hard gate: DeepSense (\d+) < floor (\d+)/);
  if (m) return { action: 'block', text: `Device trust scored ${m[1]}`, setting: `Device trust floor · ${m[2]}` };
  m = r.match(/^Hard gate: Dedupe risk (\d+) > ceiling (\d+)/);
  if (m) return { action: 'block', text: 'This face is already enrolled under another name', setting: `Duplicate ceiling · ${m[2]}` };
  m = r.match(/^(Hard gate|Review): (.+?) \[([a-z_]+)\]$/);
  if (m) return { action: m[1] === 'Review' ? 'review' : 'block', text: GATE_WORDS[m[3]] ?? m[2], setting: `Policy gate · ${m[3].replace(/_/g, ' ')}` };
  m = r.match(/^Weakest Link: (borderline )?pillar\(s\)( failed)? (?:—|-) (.+)$/);
  if (m) return { action: m[1] ? 'review' : 'block', text: `${m[1] ? 'Borderline' : 'Failed'}: ${m[3]}`, setting: 'Decision logic · weakest link' };
  m = r.match(/^Weighted Composite: (\d+) ([<>]=?) (approve|review) (\d+)/);
  if (m) return { action: 'note', text: `Overall score ${m[1]}`, setting: `${m[3] === 'approve' ? 'Approve' : 'Review'} threshold · ${m[4]}` };
  m = r.match(/^Hard gate: (.+)$/);
  if (m) return { action: 'block', text: m[1].replace(/\s+(?:—|-)\s+/g, ': '), setting: null };
  return { action: 'note', text: r, setting: null };
}

export type Answer = 'yes' | 'no' | 'unsure';
export interface LabQuestions { real: Answer; right: Answer | null; one: Answer }

/* ---------- The lab Flow (ID dials) ---------- */

export interface LabStep { stepId: string; toolId: string | null; verdict: string | null; scores: Record<string, number>; detail: string | null }
export interface LabFlow { state: string; outcome: string | null; sessionId: string | null; steps: LabStep[] }

const stepOf = (f: LabFlow | null | undefined, id: string) => f?.steps.find((s) => s.stepId === id) ?? null;

/** The run's verdict: the Flow's outcome when it ran one, else the face check's decision. */
export function labOutcome(r: LiveResult | null, f: LabFlow | null | undefined): LiveResult['outcome'] {
  if (f) {
    if (f.outcome === 'APPROVE') return 'let';
    if (f.outcome === 'REJECT') return 'stop';
    if (f.state === 'awaiting_review' || f.outcome === 'REVIEW') return 'review';
    return 'pending';
  }
  return r?.outcome ?? 'pending';
}

/** "Right person?" from the registry and Face Match steps; null when no ID was asked. */
export function rightPerson(f: LabFlow | null | undefined): Answer | null {
  if (!f) return null;
  const bvn = stepOf(f, 'bvn');
  const match = stepOf(f, 'match');
  if (bvn?.verdict === 'reject' || match?.verdict === 'reject') return 'no';
  if (match?.verdict === 'pass') return 'yes';
  return 'unsure';
}

/** The Flow's ID steps as reasons, with the setting that decided them. */
export function flowReasons(f: LabFlow | null | undefined): LabReason[] {
  if (!f) return [];
  const out: LabReason[] = [];
  const bvn = stepOf(f, 'bvn');
  const match = stepOf(f, 'match');
  if (bvn?.verdict === 'reject') out.push({ action: 'block', text: 'The registry has no record for this BVN', setting: 'Registry · BVN lookup' });
  else if (bvn?.verdict === 'pass') out.push({ action: 'note', text: 'The BVN is real: the registry returned a record with a photo', setting: 'Registry · BVN lookup' });
  else if (bvn?.verdict === 'error') out.push({ action: 'note', text: bvn.detail || 'The registry lookup didn’t finish', setting: null });
  const score = match?.scores.matchScore;
  const s = typeof score === 'number' ? ` (${Math.round(score * 10) / 10})` : '';
  if (match?.verdict === 'reject') out.push({ action: 'block', text: `The selfie doesn’t match the ID’s record photo${s}`, setting: 'Face Match (registry) · threshold' });
  else if (match?.verdict === 'review') out.push({ action: 'review', text: `The selfie is close to the record photo${s}`, setting: 'Face Match (registry) · review band' });
  else if (match?.verdict === 'pass') out.push({ action: 'note', text: `The selfie matches the ID’s record photo${s}`, setting: 'Face Match (registry) · threshold' });
  return out;
}

/** The four questions from the run's pillars and, with an ID dial, the Flow's ID steps. */
export function questions(r: LiveResult | null, f?: LabFlow | null): LabQuestions {
  // 'skip' is a pillar that wasn't scored: no evidence against the person.
  const st = (s: LiveResult['liveness'] | undefined): Answer => (s === 'fail' ? 'no' : s === 'flag' ? 'unsure' : 'yes');
  const real = [st(r?.liveness), st(r?.device)];
  return {
    real: real.includes('no') ? 'no' : real.includes('unsure') ? 'unsure' : 'yes',
    right: rightPerson(f),
    one: st(r?.dedupe),
  };
}

/** Watchtower's decision page: a lab Flow run (fr_...) or a plain face check. */
export const decisionUrl = (id: string) =>
  `https://watchtower.usesense.ai/decisions/${id.startsWith('fr_') ? 'flow_run' : 'session'}.${encodeURIComponent(id)}`;
