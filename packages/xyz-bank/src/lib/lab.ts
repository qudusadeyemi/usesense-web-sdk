/* Attack lab: dials a rep sets before a real check in the Sense Demo org.
   Watchtower applies them where scoring reads each signal
   (modules/demo-shares/simulation.ts), then the real engine and the Sense
   Demo policy decide. This file holds the dials, the planned attacks, and
   how a decision's reasons read on screen. The verdict always comes from
   the run; nothing here predicts it. */
import type { LiveResult } from './live';

export type DialKey = 'camera' | 'bot' | 'net' | 'vel' | 'who' | 'org';
export type Dials = Partial<Record<DialKey, string>>;

export interface DialDef { key: DialKey; label: string; options: [string, string][] }
export interface DialGroup { id: 'device' | 'face' | 'history'; label: string; dials: DialDef[] }

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
export interface LabQuestions { real: Answer; one: Answer }

/** "Real person?" and "Only one?" from the run's pillars. ("Right person?" needs an ID step.) */
export function questions(r: LiveResult): LabQuestions {
  // 'skip' is a pillar that wasn't scored: no evidence against the person.
  const st = (s: LiveResult['liveness']): Answer => (s === 'fail' ? 'no' : s === 'flag' ? 'unsure' : 'yes');
  const real = [st(r.liveness), st(r.device)];
  return {
    real: real.includes('no') ? 'no' : real.includes('unsure') ? 'unsure' : 'yes',
    one: st(r.dedupe),
  };
}

export const decisionUrl = (sessionId: string) => `https://watchtower.usesense.ai/decisions/session.${encodeURIComponent(sessionId)}`;
