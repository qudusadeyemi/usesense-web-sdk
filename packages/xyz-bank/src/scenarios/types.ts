import type { Brand } from '../lib/settings';
import type { Industry, Market } from '../lib/presets';

export type Question = 'real' | 'right' | 'one' | 'still';
export type Outcome = 'let' | 'stop' | 'review' | 'kyc';
export type Journey = 'signup' | 'protect' | 'agents' | 'network' | 'review';
export type VariantId = 'genuine' | 'attack' | 'nosense';

export const QUESTION_LABEL: Record<Question, string> = {
  real: 'Real person?',
  right: 'Right person?',
  one: 'Only one?',
  still: 'Still them?',
};

export const JOURNEY_LABEL: Record<Journey, string> = {
  signup: 'Sign-up',
  protect: 'Account protection',
  agents: 'AI agents',
  network: 'Sense Network',
  review: 'Review and Sensei',
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  let: 'Let through',
  stop: 'Stopped',
  review: 'In review',
  kyc: 'KYC: passed',
};

export type CaptureMode = 'genuine' | 'deepfake' | 'screen' | 'replay' | 'emulator' | 'otherface' | 'lowlight' | 'thief';

/** What the XYZ Bank phone shows at a step. */
export type Screen =
  | { kind: 'welcome' }
  | { kind: 'details'; name: string; email: string; phone: string; byAgent?: boolean }
  | { kind: 'idnumber'; idType: string; value: string; status: 'typing' | 'checking' | 'valid' }
  | { kind: 'capture'; mode: CaptureMode; title?: string; sub?: string }
  | { kind: 'result'; tone: 'ok' | 'stop' | 'review' | 'hold'; title: string; body: string; cta?: string; detail?: string }
  | { kind: 'home'; name: string; balance: number; delta?: number; banner?: string }
  | { kind: 'send'; payee: string; amount: number; isNew: boolean; reference: string }
  | { kind: 'stepup'; payee: string; amount: number; reason: string; mode: CaptureMode; phase: 'ask' | 'scan' }
  | { kind: 'signin'; device: string; note: string }
  | { kind: 'otp'; phone: string; note: string }
  | { kind: 'shift'; name: string; mode: CaptureMode; phase: 'ask' | 'scan' }
  | { kind: 'agent'; stage: 'filling' | 'handoff' | 'phone' | 'done'; operator: string }
  | { kind: 'botfarm'; count: number }
  | { kind: 'nosense'; headline: string; title: string; lines: { who: string; when: string; amount: number }[]; footnote: string };

export type AnswerState = 'pass' | 'fail' | 'skip' | 'unknown' | 'flag';

export interface Answer {
  q: Question;
  state: AnswerState;
  source: string;
  text: string;
}

export type Extra =
  | { kind: 'ring'; nodes: { id: string; label: string; type: 'account' | 'face' | 'device'; flagged?: boolean }[]; edges: [string, string][] }
  | { kind: 'network'; member: string; when: string; reason: string }
  | { kind: 'botfarm'; total: number; window: string; devices: { label: string; count: number }[] }
  | { kind: 'agent'; operator: string; declared: boolean; detail: string }
  | { kind: 'match'; a: string; b: string; when: string; score: string };

export interface Panel {
  subject: string;
  meta: string;
  outcome: Outcome;
  answers: Answer[];
  sensei: { text: string; actions: string[] };
  extra?: Extra;
}

export interface FeedEvent {
  text: string;
  tone?: 'ok' | 'bad' | 'warn' | 'info';
}

export interface Step {
  id: string;
  label: string;
  screen: Screen;
  /** One line the rep can say at this step. */
  say?: string;
  event?: FeedEvent;
  /** The decision appears at this step. */
  decide?: boolean;
  ms?: number;
}

export interface Variant {
  steps: Step[];
  panel: Panel;
}

/** How the live version of a scenario runs against Sense. */
export type LiveKind = 'enroll' | 'duplicate' | 'screen' | 'auth' | 'agent';

export interface Scenario {
  id: string;
  title: string;
  journey: Journey;
  question: Question;
  blurb: string;
  caughtBy: string;
  attackOutcome: Outcome;
  live?: { kind: LiveKind; label: string; hint: string };
  variants: Record<VariantId, Variant>;
  talk: { setup: string; attack: string; contrast: string; close: string };
}

export interface ScenarioContext {
  m: Market;
  ind: Industry;
  brand: Brand;
  /** Market-scaled amount for a base value. */
  amt: (base: number) => number;
  /** Market amount with cents kept, for balances. */
  exact: (base: number) => number;
  /** Formatted market money for a base value. */
  money: (base: number) => string;
}
