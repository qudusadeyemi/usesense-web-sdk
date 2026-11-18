/* The story a demo tells, in the website's order and words.
   Every attack plays in three beats: what the fraudster does, what the KYC
   (or the business without Sense) saw, and what Sense saw. The opener, a good
   customer, plays in two: the customer, then Sense letting them through. */
import type { IndustryId, MarketId } from './presets';
import { OUTCOME_LABEL, QUESTION_LABEL, type Panel, type Question, type Scenario, type Step } from '../scenarios/types';

export const OPENER = 'fast-path';

/** From usesense.ai/solutions/*: the three attacks each industry page names. */
export const RECOMMENDED: Record<IndustryId, string[]> = {
  bank: ['face-swap-stolen-id', 'recruited-mule', 'sim-swap-new-phone'],
  lender: ['same-face-new-name', 'real-record-wrong-face', 'rented-account'],
  gig: ['rented-account', 'same-face-new-name', 'edited-licence'],
  wallet: ['mule-ring', 'sim-swap-new-phone', 'synthetic-identity'],
  marketplace: ['same-face-new-name', 'face-swap-stolen-id', 'new-payee'],
  gaming: ['bot-farm', 'mule-ring', 'new-payee'],
};

/** The website's headline for each industry, shown when the story is picked. */
export const INDUSTRY_LINE: Record<IndustryId, { page: string; line: string }> = {
  bank: { page: 'fintechs', line: 'Open accounts fast. Not for mules.' },
  lender: { page: 'lenders', line: 'One borrower, one identity, one loan' },
  gig: { page: 'mobility-and-gig', line: 'The person on the bike is the person you checked' },
  wallet: { page: 'payments-and-wallets', line: 'Don’t be where stolen money lands' },
  marketplace: { page: 'marketplaces', line: 'Real sellers. Real buyers.' },
  gaming: { page: 'digital-assets-and-gaming', line: 'One player, one account, one bonus' },
};

export const MAX_ATTACKS = 4;

export function recommendedStory(ind: IndustryId): string[] {
  return [OPENER, ...RECOMMENDED[ind]];
}

/** Watchtower's brand import guesses a sector from the website. */
export function industryFromSector(sector: string | null | undefined): IndustryId | null {
  switch (sector) {
    case 'bank': return 'bank';
    case 'wallet': return 'wallet';
    case 'lending': return 'lender';
    case 'gig': return 'gig';
    case 'marketplace': return 'marketplace';
    default: return null;
  }
}

/** A market from the website's domain, when the domain says so. */
export function marketFromHost(host: string): MarketId | null {
  const h = host.toLowerCase();
  if (/\.(uk)$/.test(h)) return 'gb';
  if (/\.ng$/.test(h)) return 'ng';
  if (/\.ke$/.test(h)) return 'ke';
  if (/\.in$/.test(h)) return 'in';
  if (/\.za$/.test(h)) return 'za';
  if (/\.us$/.test(h)) return 'us';
  if (/\.(ie|de|fr|es|it|nl|be|pt|at|fi|eu|se|dk|pl)$/.test(h)) return 'eu';
  return null;
}

/** Words prospects use for each attack, so a rep can find it mid-call. */
export const KEYWORDS: Record<string, string> = {
  'fast-path': 'good customers drop-off conversion friction speed passive',
  'face-swap-stolen-id': 'deepfake face swap virtual camera stolen id injection',
  'photo-of-screen': 'screen replay photo video presentation attack',
  'replayed-record-photo': 'record photo replay bvn nin government photo',
  'real-record-wrong-face': 'borrowed identity family stand-in wrong face impersonation',
  'same-face-new-name': 'duplicate loan stacking bonus abuse multi-accounting banned returning second id',
  'bot-farm': 'bots automation farm emulators mass sign-ups bonus',
  'recruited-mule': 'mule paid account holder money mule app fraud',
  'new-payee': 'payout transfer new payee app fraud withdrawal',
  'sim-swap-new-phone': 'sim swap account takeover new device otp',
  'rented-account': 'rented account lending driver rider shift handover',
  'dormant-account': 'dormant sleeper account takeover',
  'assistant-opens-account': 'ai agent assistant automation operator',
  'undeclared-automation': 'bot agent headless playwright selenium',
  'network-match': 'sense network consortium other banks stopped elsewhere',
  'mule-ring': 'ring mules shared device network off-ramp',
  'grey-case': 'review sensei analyst case manual',
  'edited-licence': 'driving licence document fake id edited photo banned driver',
  'synthetic-identity': 'synthetic fake person generated identity made up',
};

export function matchScenarios(all: Scenario[], q: string): Scenario[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return all;
  return all
    .map((s) => {
      const hay = `${s.title} ${s.blurb} ${QUESTION_LABEL[s.question]} ${KEYWORDS[s.id] ?? ''}`.toLowerCase();
      const score = words.reduce((n, w) => n + (hay.includes(w) ? (s.title.toLowerCase().includes(w) ? 3 : 1) : 0), 0);
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
}

export type BeatId = 'journey' | 'attack' | 'kyc' | 'sense';

export interface Beat {
  id: BeatId;
  /** Short label for the progress bar and the notes. */
  label: string;
  /** Phone screens for this beat; they play on a timer. */
  steps: Step[];
  /** The decision card shown beside the phone, if any. */
  panel?: Panel;
  /** One line under the phone, written for the prospect. */
  caption: string;
  /** The line the decision card leads with. */
  headline?: string;
  /** For the rep only: what to say. */
  say: string;
}

function split(steps: Step[]): [Step[], Step[]] {
  const at = steps.findIndex((s) => s.decide);
  const i = at === -1 ? steps.length - 1 : at;
  return [steps.slice(0, i), steps.slice(i)];
}

export function isOpener(s: Scenario): boolean {
  return s.attackOutcome === 'let';
}

/** What Sense decided, in the website's words. */
export function senseHeadline(s: Scenario): string {
  const signup = s.journey === 'signup' || s.journey === 'agents';
  if (s.attackOutcome === 'stop') return signup ? 'Passed your KYC. Stopped by Sense.' : 'Stopped by Sense.';
  if (s.attackOutcome === 'review') return signup ? 'Passed your KYC. Sent to Review by Sense.' : 'Sent to Review by Sense.';
  return 'Let through, in seconds.';
}

/** Beat two's name: KYC for sign-ups, the business without Sense otherwise. */
export function contrastLabel(s: Scenario): string {
  return s.journey === 'signup' ? 'Your KYC' : 'Without Sense';
}

export function beatsFor(s: Scenario): Beat[] {
  if (isOpener(s)) {
    const [pre, post] = split(s.variants.genuine.steps);
    return [
      { id: 'journey', label: 'The customer', steps: pre, caption: s.blurb, say: s.talk.setup },
      { id: 'sense', label: 'Sense', steps: post, panel: s.variants.genuine.panel, caption: 'A real, live, unique person. Through without extra steps.', headline: senseHeadline(s), say: s.talk.close },
    ];
  }
  const [atkPre, atkPost] = split(s.variants.attack.steps);
  const [, nsPost] = split(s.variants.nosense.steps);
  const aftermath = nsPost.at(-1)?.say ?? 'Without Sense, it goes through.';
  return [
    { id: 'attack', label: 'The attack', steps: atkPre, caption: s.blurb, say: `${s.talk.setup} ${s.talk.attack}` },
    { id: 'kyc', label: contrastLabel(s), steps: nsPost, panel: s.variants.nosense.panel, caption: aftermath, headline: s.journey === 'signup' ? 'Your KYC: passed.' : 'Without Sense: it goes through.', say: s.talk.contrast },
    { id: 'sense', label: 'Sense', steps: atkPost, panel: s.variants.attack.panel, caption: s.variants.attack.panel.sensei.text, headline: senseHeadline(s), say: s.talk.close },
  ];
}

/** Which question an attack answers, and the outcome, for chips. */
export function attackTag(s: Scenario): { q: Question; label: string; outcome: string } {
  return { q: s.question, label: QUESTION_LABEL[s.question], outcome: OUTCOME_LABEL[s.attackOutcome] };
}

/** Other attacks on the same question, for "if they ask" in the notes. */
export function related(all: Scenario[], s: Scenario, n = 2): Scenario[] {
  return all.filter((x) => x.id !== s.id && x.question === s.question && !isOpener(x)).slice(0, n);
}
