/* Building blocks shared by the scenarios: the common sign-up path, the
   standard answers, and the "without Sense" ending. */
import { formatMoney } from '../lib/presets';
import type { Answer, AnswerState, CaptureMode, Panel, Question, ScenarioContext, Step } from './types';

export const ans = (q: Question, state: AnswerState, source: string, text: string): Answer => ({ q, state, source, text });

export const SRC = {
  live: 'LiveSense · DeepSense',
  liveOnly: 'LiveSense',
  deep: 'DeepSense',
  kyc: 'Your KYC',
  match: 'MatchSense · Network',
  matchOnly: 'MatchSense',
  network: 'Sense Network',
  protect: 'Account protection',
  sensei: 'Sensei risk policy',
  agents: 'AI agents policy',
  none: 'Not checked',
};

export const notAtSignup = ans('still', 'skip', SRC.protect, 'Not asked at sign-up.');

export function signupIntro(c: ScenarioContext, name: string, opts: { byAgent?: boolean; say?: [string, string, string] } = {}): Step[] {
  const email = name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '') + '@mail.com';
  const say = opts.say ?? [
    `This is ${c.brand.name}. Think of it as your app.`,
    `They type their details like anyone would.`,
    `The ${c.m.idType} goes to your KYC provider. It comes back valid.`,
  ];
  return [
    { id: 'welcome', label: 'Welcome', screen: { kind: 'welcome' }, say: say[0], ms: 2200 },
    {
      id: 'details', label: 'Details',
      screen: { kind: 'details', name, email, phone: c.m.phone, byAgent: opts.byAgent },
      say: say[1], event: { text: `Details entered for ${name}`, tone: 'info' }, ms: 2600,
    },
    {
      id: 'id', label: c.m.idType.replace(/^\w/, (x) => x.toUpperCase()),
      screen: { kind: 'idnumber', idType: c.m.idType, value: c.m.idSample, status: 'valid' },
      say: say[2], event: { text: `${cap(c.m.idType)} is valid on the record (your KYC)`, tone: 'ok' }, ms: 2600,
    },
  ];
}

export function captureStep(mode: CaptureMode, say: string, event?: Step['event'], title?: string): Step {
  return { id: 'face', label: 'Face check', screen: { kind: 'capture', mode, title }, say, event, ms: 3400 };
}

export function okResult(c: ScenarioContext, name: string, say: string, extra?: Partial<Step>): Step {
  const first = name.split(' ')[0];
  return {
    id: 'decision', label: 'Decision', decide: true, say, ms: 3000,
    screen: { kind: 'result', tone: 'ok', title: `You’re in, ${first}`, body: `Your ${c.ind.productNoun} is ready. It took about two minutes.`, cta: 'Go to my account', detail: c.m.accountLine },
    event: { text: 'Let through', tone: 'ok' },
    ...extra,
  };
}

export function stopResult(say: string, body = 'We couldn’t confirm it’s you, so we’ve paused this application. If this is a mistake, our team will help.'): Step {
  return {
    id: 'decision', label: 'Decision', decide: true, say, ms: 3200,
    screen: { kind: 'result', tone: 'stop', title: 'We couldn’t confirm it’s you', body, cta: 'Contact support' },
    event: { text: 'Stopped', tone: 'bad' },
  };
}

export function reviewResult(say: string, body = 'Thanks. We’re checking a few details and will let you know shortly, usually within the hour.'): Step {
  return {
    id: 'decision', label: 'Decision', decide: true, say, ms: 3200,
    screen: { kind: 'result', tone: 'review', title: 'Almost there', body, cta: 'Got it' },
    event: { text: 'Sent to Review', tone: 'warn' },
  };
}

/** The KYC-only ending: the account opens and the money goes. */
export function moneyGone(c: ScenarioContext, name: string, opts: { headline?: string; say?: string; footnote?: string; amounts?: [number, number, number] } = {}): Step {
  const [a, b, d] = opts.amounts ?? [2000, 1980, 1500];
  const p = c.m.people.payees;
  const lost = c.amt(a) + c.amt(b) + c.amt(d);
  return {
    id: 'aftermath', label: 'Afterwards', ms: 4200,
    say: opts.say ?? 'This is what your KYC alone lets through. Eleven minutes later, the money is gone.',
    screen: {
      kind: 'nosense',
      headline: opts.headline ?? `${cap(c.ind.productNoun)} opened for “${name}”`,
      title: `${formatMoney(-lost, c.m)} sent to 3 new payees`,
      lines: [
        { who: p[0], when: 'New payee · 9:49', amount: -c.amt(a) },
        { who: p[1], when: 'New payee · 9:50', amount: -c.amt(b) },
        { who: p[2], when: 'New payee · 9:52', amount: -c.amt(d) },
      ],
      footnote: opts.footnote ?? `The real ${name} finds out next month.`,
    },
    event: { text: 'Money moved out to new payees', tone: 'bad' },
  };
}

export function kycOnlyPanel(c: ScenarioContext, name: string, rows: { real?: string; one?: string; still?: string; right?: string }, loss: string): Panel {
  return {
    subject: `${name} · new applicant`,
    meta: `KYC only · 9:41:07 · ${c.m.city}`,
    outcome: 'kyc',
    answers: [
      ans('real', 'unknown', SRC.none, rows.real ?? 'KYC saw a face. It could not tell whether a live person was behind it.'),
      ans('right', 'pass', SRC.kyc, rows.right ?? `The ${c.m.idType} is real. That is all KYC can say.`),
      ans('one', 'unknown', SRC.none, rows.one ?? 'Never compared with the people you already have.'),
      ans('still', 'unknown', SRC.none, rows.still ?? 'Nobody checked it was still them when the money moved.'),
    ],
    sensei: { text: loss, actions: [] },
  };
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function meta(c: ScenarioContext, flow: string, time = '9:41:07', device = 'iPhone 15'): string {
  return `${flow} · ${time} · ${device} · ${c.m.city}`;
}
