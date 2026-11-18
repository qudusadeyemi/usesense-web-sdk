import { SRC, ans, captureStep, kycOnlyPanel, meta, moneyGone, notAtSignup, reviewResult, signupIntro, stopResult } from './build';
import { genuineSignup } from './signup';
import type { Scenario, ScenarioContext } from './types';

export function agentScenarios(c: ScenarioContext): Scenario[] {
  const { genuine, alias, victim } = c.m.people;
  const first = genuine.split(' ')[0];
  const operator = 'A personal AI assistant';

  const assistant: Scenario = {
    id: 'assistant-opens-account',
    title: 'Assistant opens an account',
    journey: 'agents', question: 'real',
    blurb: 'An AI assistant fills the application. The person finishes the face check on their own phone.',
    caughtBy: 'AI agents policy, phone hand-off',
    attackOutcome: 'stop',
    live: { kind: 'agent', label: 'Hand the face check to a phone', hint: 'Shows a QR code. The prospect scans it and takes the check on their own phone.' },
    variants: {
      genuine: {
        steps: [
          { id: 'agent', label: 'Assistant', screen: { kind: 'agent', stage: 'filling', operator }, say: `${first} asks her AI assistant to open ${c.ind.product}. It fills everything in.`, event: { text: 'Declared AI agent, signed request', tone: 'info' }, ms: 3000 },
          ...signupIntro(c, genuine, { byAgent: true, say: ['', 'The assistant types her details. That’s fine.', 'And her ID. Also fine.'] }).slice(1),
          { id: 'handoff', label: 'Hand-off', screen: { kind: 'agent', stage: 'handoff', operator }, say: 'But an assistant can’t be her face. The check moves to her own phone.', event: { text: 'Face check handed to the person’s phone', tone: 'info' }, ms: 3200 },
          { id: 'phone', label: 'Her phone', screen: { kind: 'agent', stage: 'phone', operator }, say: `${first} scans the code and looks at her own camera.`, event: { text: 'Live person, on a different, human device', tone: 'ok' }, ms: 3200 },
          { id: 'decision', label: 'Done', decide: true, screen: { kind: 'agent', stage: 'done', operator }, say: 'Done. The assistant saved her ten minutes; Sense made sure it was really her.', event: { text: 'Let through', tone: 'ok' }, ms: 3000 },
        ],
        panel: {
          subject: `${genuine} · via AI assistant`, meta: meta(c, 'Agent sign-up', '12:05:44', 'Assistant + iPhone 15'),
          outcome: 'let',
          answers: [
            ans('real', 'pass', `${SRC.agents} · ${SRC.liveOnly}`, 'Form filled by a declared assistant; face check done live by the person on her own phone.'),
            ans('right', 'pass', SRC.kyc, 'ID valid and the face matches it.'),
            ans('one', 'pass', SRC.match, 'First time we have seen this face.'),
            notAtSignup,
          ],
          sensei: { text: 'A declared assistant acting for a real person. It signed its requests, and the person approved on her own phone. Your policy allows this, so she is through.', actions: ['See agent details'] },
          extra: { kind: 'agent', operator, declared: true, detail: 'Signed with Web Bot Auth. Operator key checked.' },
        },
      },
      attack: {
        steps: [
          { id: 'agent', label: 'Agent', screen: { kind: 'agent', stage: 'filling', operator: 'An agent' }, say: 'Now an agent runs this for a fraudster, with stolen details.', event: { text: 'Declared AI agent', tone: 'info' }, ms: 2800 },
          ...signupIntro(c, victim, { byAgent: true, say: ['', 'Stolen details, typed by the agent.', 'A real, stolen ID.'] }).slice(1),
          { id: 'handoff', label: 'Hand-off', screen: { kind: 'agent', stage: 'handoff', operator: 'An agent' }, say: 'The face check moves to a phone. The fraudster tries to approve it from the same machine.', event: { text: 'Approval tried from the agent’s own browser', tone: 'bad' }, ms: 3200 },
          stopResult('Refused. The approval has to come from a different, human device, with a live face that matches.', 'This check has to be done by the person, on their own phone.'),
        ],
        panel: {
          subject: `${victim} · via agent`, meta: meta(c, 'Agent sign-up', '02:41:10', 'Headless browser'),
          outcome: 'stop',
          answers: [
            ans('real', 'fail', SRC.agents, 'Approval came from the same automated browser as the agent. No human device.'),
            ans('right', 'pass', SRC.kyc, `The ${c.m.idType} is real.`),
            ans('one', 'pass', SRC.match, 'No face captured.'),
            notAtSignup,
          ],
          sensei: { text: 'An agent filled in a real person’s details and then tried to approve its own face check from the same browser. Agents may fill forms; only the person can be the face.', actions: ['Block this operator'] },
          extra: { kind: 'agent', operator: 'An agent', declared: true, detail: 'Same browser and IP tried to approve. Refused.' },
        },
      },
      nosense: {
        steps: [
          { id: 'agent', label: 'Agent', screen: { kind: 'agent', stage: 'filling', operator: 'An agent' }, say: 'Same agent, no agent policy.', event: { text: 'Automated browser, not detected', tone: 'warn' }, ms: 2800 },
          captureStep('deepfake', 'The agent supplies a generated face too. It never had to hand anything to a human.', { text: 'Selfie accepted', tone: 'warn' }),
          moneyGone(c, victim, { say: 'Accounts at the speed of software.' }),
        ],
        panel: kycOnlyPanel(c, victim, { real: 'Nothing told a person from an agent.' }, 'When agents can do the whole journey, one fraudster becomes a thousand applications a day.'),
      },
    },
    talk: {
      setup: 'Everyone is asking about agents. Show that Sense lets good agents help without letting them be the person.',
      attack: 'Agents fill forms. Only a person on their own phone can pass the face check.',
      contrast: 'Without an agent policy, an agent can do the whole journey, face included.',
      close: 'Three modes: record only, ask the person, or stop agents. Set per Flow.',
    },
  };

  const automation: Scenario = {
    id: 'undeclared-automation',
    title: 'Undeclared automation',
    journey: 'agents', question: 'real',
    blurb: 'A script drives a headless browser through sign-up at scale.',
    caughtBy: 'AI agents detection, DeepSense',
    attackOutcome: 'stop',
    variants: {
      genuine: genuineSignup(c),
      attack: {
        steps: [
          ...signupIntro(c, alias, { say: ['A script, not a person, and it doesn’t say so.', 'Fields filled in 40 milliseconds each.', 'A bought ID.'] }),
          captureStep('emulator', 'Headless browser, automation flags, injected camera.', { text: 'Playwright automation, headless Chrome', tone: 'bad' }),
          stopResult('Stopped. Your policy says undeclared automation gets stopped.'),
        ],
        panel: {
          subject: `${alias} · new applicant`, meta: meta(c, 'Open account', '04:02:51', 'Headless Chrome'),
          outcome: 'stop',
          answers: [
            ans('real', 'fail', `${SRC.agents} · ${SRC.deep}`, 'Automated browser that did not declare itself, with an injected camera.'),
            ans('right', 'pass', SRC.kyc, `The ${c.m.idType} is real.`),
            ans('one', 'flag', SRC.match, 'Same automation fingerprint on 22 sign-ups today.'),
            notAtSignup,
          ],
          sensei: { text: 'Undeclared automation: a headless browser filled the form in under a second and streamed an injected camera. 22 sign-ups share this fingerprint today. Your policy is set to stop these.', actions: ['See all 22', 'Change agent policy'] },
        },
      },
      nosense: {
        steps: [
          ...signupIntro(c, alias, { say: ['Same script.', 'Same speed.', 'Same bought ID.'] }),
          captureStep('emulator', 'Nothing checks for automation.', { text: 'Selfie accepted', tone: 'warn' }),
          moneyGone(c, alias),
        ],
        panel: kycOnlyPanel(c, alias, { real: 'Nothing checked for automation.' }, 'A script opened an account as easily as a person.'),
      },
    },
    talk: {
      setup: 'Contrast with the declared assistant: this one hides.',
      attack: 'Detection is on by default; what happens next is the prospect’s policy.',
      contrast: 'Without detection, scripts sign up as fast as you can process them.',
      close: 'Start in record-only mode, look at the numbers, then decide.',
    },
  };

  return [assistant, automation];
}

export function networkScenarios(c: ScenarioContext): Scenario[] {
  const { alias } = c.m.people;
  const idT = c.m.idType;

  const network: Scenario = {
    id: 'network-match',
    title: 'Stopped somewhere else',
    journey: 'network', question: 'one',
    blurb: `A fraudster another Sense member stopped last week tries ${c.brand.name} today.`,
    caughtBy: 'Sense Network',
    attackOutcome: 'stop',
    variants: {
      genuine: genuineSignup(c),
      attack: {
        steps: [
          ...signupIntro(c, alias, { say: [`First time at ${c.brand.name}. Not their first time with Sense.`, 'New name, new email.', `A different, valid ${idT}.`] }),
          captureStep('genuine', 'A live person, and a face another member stopped last week.', { text: 'Seen in Sense Network', tone: 'bad' }),
          stopResult(`Stopped. ${c.brand.name} learns from fraud it has never seen.`),
        ],
        panel: {
          subject: `${alias} · new applicant`, meta: meta(c, 'Open account', '13:15:02'),
          outcome: 'stop',
          answers: [
            ans('real', 'pass', SRC.live, 'Live person, real camera.'),
            ans('right', 'pass', SRC.kyc, `This ${idT} is real.`),
            ans('one', 'fail', SRC.network, 'This face was stopped by another member 8 days ago under a different name.'),
            notAtSignup,
          ],
          sensei: { text: 'Seen in Sense Network: a lender stopped this face 8 days ago for a stolen identity. Today it is back with a different, real ID. Only the matching signal is shared, never names or documents.', actions: ['Add to my blocklist'] },
          extra: { kind: 'network', member: 'A lender in Sense Network', when: '8 days ago', reason: 'Stopped for a stolen identity' },
        },
      },
      nosense: {
        steps: [
          ...signupIntro(c, alias, { say: ['Same fraudster, first time here.', 'New name.', 'Valid ID.'] }),
          captureStep('genuine', 'You have never seen this face, so nothing to compare with.', { text: 'Selfie accepted', tone: 'warn' }),
          moneyGone(c, alias),
        ],
        panel: kycOnlyPanel(c, alias, { one: 'Compared only with your own customers, and there was nothing.' }, 'They were caught somewhere else last week. On your own, you start from zero.'),
      },
    },
    talk: {
      setup: 'Ask: what happens when a fraudster your competitor caught comes to you next?',
      attack: 'Sense Network shares the matching signal, not the data. Opt in per signal.',
      contrast: 'Alone, every company learns about every fraudster the hard way.',
      close: 'Stopped somewhere once, stopped everywhere.',
    },
  };

  const ring: Scenario = {
    id: 'mule-ring',
    title: 'Mule ring',
    journey: 'network', question: 'one',
    blurb: 'Six accounts linked by two faces and one phone, drawn as a ring.',
    caughtBy: 'Fraud rings',
    attackOutcome: 'stop',
    variants: {
      genuine: genuineSignup(c),
      attack: {
        steps: [
          ...signupIntro(c, 'Ife Martins', { say: ['The seventh account in a ring. Each one looked fine alone.', 'Different name, different email.', 'Valid ID.'] }),
          captureStep('genuine', 'This face, and this phone, connect to six other accounts.', { text: 'Linked to 6 accounts by face and device', tone: 'bad' }),
          stopResult('Stopped, and the whole ring is laid out for the fraud team.'),
        ],
        panel: {
          subject: 'Ife Martins · new applicant', meta: meta(c, 'Open account', '17:48:30', 'Infinix Hot 30'),
          outcome: 'stop',
          answers: [
            ans('real', 'pass', SRC.live, 'Live person.'),
            ans('right', 'pass', SRC.kyc, 'Valid ID.'),
            ans('one', 'fail', 'Fraud rings', 'Same face as 2 accounts and same phone as 4 more. Seven accounts, two people.'),
            notAtSignup,
          ],
          sensei: { text: 'A ring: two people behind seven accounts, joined by one phone. Four of them received money from reported scams last month. Suggest freezing the four and reviewing the rest.', actions: ['Freeze 4 accounts', 'Export evidence'] },
          extra: {
            kind: 'ring',
            nodes: [
              { id: 'a1', label: 'Ife M.', type: 'account', flagged: true },
              { id: 'a2', label: 'Tobi A.', type: 'account' },
              { id: 'a3', label: 'Grace O.', type: 'account' },
              { id: 'a4', label: 'Musa K.', type: 'account' },
              { id: 'a5', label: 'Ada N.', type: 'account' },
              { id: 'a6', label: 'Sam E.', type: 'account' },
              { id: 'a7', label: 'Bisi L.', type: 'account' },
              { id: 'f1', label: 'Face 1', type: 'face' },
              { id: 'f2', label: 'Face 2', type: 'face' },
              { id: 'd1', label: 'Phone', type: 'device' },
            ],
            edges: [['f1', 'a1'], ['f1', 'a2'], ['f1', 'a3'], ['f2', 'a4'], ['f2', 'a5'], ['d1', 'a1'], ['d1', 'a4'], ['d1', 'a6'], ['d1', 'a7'], ['f2', 'a6']],
          },
        },
      },
      nosense: {
        steps: [
          ...signupIntro(c, 'Ife Martins', { say: ['Same seventh account.', 'Looks fine.', 'Valid ID.'] }),
          captureStep('genuine', 'Each account is checked alone, so the ring is invisible.', { text: 'Selfie accepted', tone: 'warn' }),
          moneyGone(c, 'Ife Martins', { headline: 'Seventh ring account opened', footnote: 'The ring moves money through seven accounts so no single one looks big.' }),
        ],
        panel: kycOnlyPanel(c, 'Ife Martins', { one: 'Each account checked on its own.' }, 'Seven clean-looking accounts. One ring.'),
      },
    },
    talk: {
      setup: 'For fraud teams: show them the picture they never get from row-by-row checks.',
      attack: 'Faces and phones join accounts that share nothing else.',
      contrast: 'Row by row, every account in a ring looks fine.',
      close: 'The free fraud scan draws these rings from their existing customer file.',
    },
  };

  return [network, ring];
}

export function reviewScenarios(c: ScenarioContext): Scenario[] {
  const { genuine } = c.m.people;
  const grey: Scenario = {
    id: 'grey-case',
    title: 'The grey case',
    journey: 'review', question: 'real',
    blurb: 'Bad light, an old phone, a borderline match. Sensei writes the case up and suggests a retake.',
    caughtBy: 'Review, Sensei case analysis',
    attackOutcome: 'review',
    variants: {
      genuine: genuineSignup(c),
      attack: {
        steps: [
          ...signupIntro(c, 'Peter Okonkwo', { say: ['Not every case is fraud. Some are just hard.', 'An older customer on an old phone.', 'Valid ID, photo taken 9 years ago.'] }),
          captureStep('lowlight', 'Evening, one bulb, a cracked camera. The signals are weak, not bad.', { text: 'Low light, low camera quality', tone: 'warn' }),
          reviewResult('Sense doesn’t guess. It sends it to Review with the evidence and a suggested next step.'),
        ],
        panel: {
          subject: 'Peter Okonkwo · new applicant', meta: meta(c, 'Open account', '20:51:12', 'Galaxy J7 (2017)'),
          outcome: 'review',
          answers: [
            ans('real', 'flag', SRC.live, 'Probably live, but the light is too low to be sure.'),
            ans('right', 'flag', SRC.kyc, 'ID valid. Face match 71% against a 9-year-old photo.'),
            ans('one', 'pass', SRC.match, 'First time we have seen this face.'),
            notAtSignup,
          ],
          sensei: { text: 'Likely a genuine customer with a hard capture: low light, a 2017 phone and an ID photo from 9 years ago. Nothing points to fraud. Suggest asking for a retake in daylight; it usually passes.', actions: ['Ask for a retake', 'Approve'] },
        },
      },
      nosense: {
        steps: [
          ...signupIntro(c, 'Peter Okonkwo', { say: ['Same customer.', 'Same old phone.', 'Same old ID photo.'] }),
          captureStep('lowlight', 'A strict threshold, no review queue.', { text: 'Face match below threshold', tone: 'bad' }),
          { id: 'decision', label: 'Afterwards', decide: true, ms: 3600, say: 'A good customer, rejected by a number. He goes to a competitor.', screen: { kind: 'result', tone: 'stop', title: 'Application declined', body: 'We can’t open an account for you at this time.', cta: 'Close' }, event: { text: 'Rejected, no reason given', tone: 'bad' } },
        ],
        panel: kycOnlyPanel(c, 'Peter Okonkwo', { right: 'Face match 71%: under the threshold, so rejected.' }, 'Hard cases get rejected by a threshold. Good customers leave and nobody knows why.'),
      },
    },
    talk: {
      setup: `Use this when ops or compliance are on the call. ${genuine} was easy; most queues are full of cases like this one.`,
      attack: 'Sensei writes up the case and suggests the next step. One click to retake or approve.',
      contrast: 'Without review, hard cases become lost customers.',
      close: 'Then open Watchtower Review to show the real queue, keyboard-fast.',
    },
  };
  return [grey];
}
