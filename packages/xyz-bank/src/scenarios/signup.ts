import { SRC, ans, captureStep, kycOnlyPanel, meta, moneyGone, notAtSignup, okResult, reviewResult, signupIntro, stopResult } from './build';
import type { Scenario, ScenarioContext, Variant } from './types';

/* The genuine sign-up every scenario shares: a real person, passive check, through in seconds. */
export function genuineSignup(c: ScenarioContext, sensei?: string): Variant {
  const name = c.m.people.genuine;
  return {
    steps: [
      ...signupIntro(c, name),
      captureStep('genuine', 'A real person looks at the camera. No head turns, no blinking on command.', { text: 'Face check: live person, phone’s own camera', tone: 'ok' }),
      okResult(c, name, 'Through in about two seconds. Good customers barely notice Sense.'),
    ],
    panel: {
      subject: `${name} · new applicant`,
      meta: meta(c, 'Open account'),
      outcome: 'let',
      answers: [
        ans('real', 'pass', SRC.live, 'Live person on the phone’s own camera. Passive check only.'),
        ans('right', 'pass', SRC.kyc, `${c.m.idType.replace(/^\w/, (x) => x.toUpperCase())} is valid and the face matches the ID photo.`),
        ans('one', 'pass', SRC.match, 'First time we have seen this face, here or in Sense Network.'),
        notAtSignup,
      ],
      sensei: {
        text: sensei ?? 'Low risk: known device type, home network, a normal pace through the form. Sensei kept this to a passive check, so it took about two seconds.',
        actions: ['See risk signals'],
      },
    },
  };
}

export function signupScenarios(c: ScenarioContext): Scenario[] {
  const { victim, alias, genuine } = c.m.people;
  const idT = c.m.idType;

  const fastPath: Scenario = {
    id: 'fast-path',
    title: 'Good customers, fast',
    journey: 'signup', question: 'real',
    blurb: 'A real person signs up in two minutes. A riskier context gets one extra step, not a wall.',
    caughtBy: 'LiveSense, DeepSense, Sensei risk policy',
    attackOutcome: 'let',
    live: { kind: 'enroll', label: 'Run the face check live', hint: 'Take the check yourself. Sense decides in seconds.' },
    variants: {
      genuine: genuineSignup(c),
      attack: {
        steps: [
          ...signupIntro(c, genuine, { say: ['Same customer, but tonight she is on hotel Wi-Fi with a new phone.', 'Nothing about her is wrong. The context is riskier.', `Her ${idT} checks out.`] }),
          { ...captureStep('genuine', 'Sensei asks for one head turn because the context is riskier. Still about five seconds.', { text: 'Sensei added a head turn: new device, public network', tone: 'warn' }), screen: { kind: 'capture', mode: 'genuine', title: 'Turn your head slowly to the left' } },
          okResult(c, genuine, 'Through. One extra step for a riskier context, not a wall for everyone.'),
        ],
        panel: {
          subject: `${genuine} · new applicant`, meta: meta(c, 'Open account', '23:12:40', 'Pixel 8 (new)'),
          outcome: 'let',
          answers: [
            ans('real', 'pass', SRC.live, 'Live person, and the head turn matched the first frames.'),
            ans('right', 'pass', SRC.kyc, 'ID valid and the face matches the ID photo.'),
            ans('one', 'pass', SRC.match, 'First time we have seen this face.'),
            notAtSignup,
          ],
          sensei: { text: 'New phone on a public network late at night. Not suspicious on its own, so Sensei asked for one head turn instead of stopping her. She passed in five seconds.', actions: ['Why a head turn?'] },
        },
      },
      nosense: {
        steps: [
          ...signupIntro(c, genuine, { say: ['Without risk-based checks, everyone gets the hardest path.', 'The same customer, same details.', 'ID valid.'] }),
          { ...captureStep('genuine', 'Blink, smile, turn left, turn right, read numbers aloud. For everyone, every time.', { text: 'Five active challenges for every applicant', tone: 'warn' }), screen: { kind: 'capture', mode: 'genuine', title: 'Now read the numbers out loud: 4 8 2 1' } },
          { id: 'decision', label: 'Afterwards', decide: true, ms: 3800, say: 'Good customers give up. You pay for the fraud checks and still lose the customer.', screen: { kind: 'result', tone: 'hold', title: 'Step 4 of 7', body: 'Next: upload a utility bill and a selfie holding your ID.', cta: 'Continue later' }, event: { text: 'Applicant left at step 4', tone: 'bad' } },
        ],
        panel: kycOnlyPanel(c, genuine, { real: 'Checked with the same five challenges for everyone.' }, 'Heavy checks for everyone push good people away. Many apps lose a large share of real applicants at the selfie step.'),
      },
    },
    talk: {
      setup: 'Start here so the prospect sees what their good customers will feel. It answers “will this hurt conversion?” before they ask.',
      attack: 'Show the riskier context. Sensei adds one step only for this person, because of the device and network.',
      contrast: 'Without risk-based checks, every customer gets every challenge. That is where sign-ups go to die.',
      close: 'Sense is easy for good users and tough on risk. You set the policy; Sensei applies it per person.',
    },
  };

  const faceSwap: Scenario = {
    id: 'face-swap-stolen-id',
    title: 'Face swap on a stolen ID',
    journey: 'signup', question: 'real',
    blurb: `A real ${idT} and a generated face streamed through a virtual camera. KYC passes it.`,
    caughtBy: 'LiveSense, DeepSense',
    attackOutcome: 'stop',
    live: { kind: 'enroll', label: 'Run the genuine path live', hint: 'Take the check yourself to show the real customer path.' },
    variants: {
      genuine: genuineSignup(c),
      attack: {
        steps: [
          ...signupIntro(c, victim, { say: [`This applicant bought ${victim}’s details online for less than a takeaway.`, 'Real name, real phone number, real email.', `The ${idT} is real. Your KYC says yes.`] }),
          captureStep('deepfake', 'Now the face. This is a face swap, streamed through a virtual camera. It looks perfect to a person.', { text: 'Capture source: OBS Virtual Camera', tone: 'bad' }),
          stopResult('Sense stops it. The ID is real; the face isn’t.'),
        ],
        panel: {
          subject: `${victim} · new applicant`, meta: meta(c, 'Open account', '9:41:07', 'Windows laptop'),
          outcome: 'stop',
          answers: [
            ans('real', 'fail', SRC.live, 'Face swap found in the capture. The stream came from a virtual camera, not a real one.'),
            ans('right', 'pass', SRC.kyc, `The ${idT} is real and matches the name given.`),
            ans('one', 'pass', SRC.match, 'No other account uses this face.'),
            notAtSignup,
          ],
          sensei: { text: `Your KYC passed this person; Sense stopped them. The ${idT} belongs to a real person, but the face was generated and streamed through a virtual camera. This device tried two other names this week.`, actions: ['Block this device', 'Show the other two'] },
        },
      },
      nosense: {
        steps: [
          ...signupIntro(c, victim, { say: ['Same attacker, same stolen details.', 'Same real name and number.', 'KYC says the ID is valid.'] }),
          captureStep('deepfake', 'The face swap goes straight through. Nothing looks at whether the face is real.', { text: 'Selfie accepted', tone: 'warn' }),
          moneyGone(c, victim),
        ],
        panel: kycOnlyPanel(c, victim, { one: 'Two other names from this device, never compared.', still: 'Three new payees in eleven minutes, no check.' }, `What KYC alone let through: ${c.ind.product} for a person who doesn’t exist, and the money gone within the hour.`),
      },
    },
    talk: {
      setup: 'Ask: what does your KYC do when the ID is real but the person isn’t? Most prospects have never been asked.',
      attack: 'Point at the right panel. Right person? says yes, because the ID is real. Real person? says no. That gap is what Sense closes.',
      contrast: 'Replay it without Sense. The account opens and the money leaves. This is the loss they already have.',
      close: 'Keep your KYC provider. Sense sits on top and answers the question it can’t.',
    },
  };

  const screen: Scenario = {
    id: 'photo-of-screen',
    title: 'Photo of a screen',
    journey: 'signup', question: 'real',
    blurb: 'Someone holds a phone showing the victim’s photo up to the camera. Try it for real.',
    caughtBy: 'LiveSense',
    attackOutcome: 'stop',
    live: { kind: 'screen', label: 'Try it live: hold up a photo', hint: 'Show a photo of a person on another phone to the camera. Sense should stop it.' },
    variants: {
      genuine: genuineSignup(c),
      attack: {
        steps: [
          ...signupIntro(c, victim, { say: ['The cheapest attack there is: a photo on another phone.', 'Stolen details again.', 'A real ID.'] }),
          captureStep('screen', 'They hold a phone with the victim’s photo up to the camera. Screen glare, pixels, flat light.', { text: 'Screen edges and moiré in frame', tone: 'bad' }),
          stopResult('Stopped. LiveSense sees a screen, not a face.'),
        ],
        panel: {
          subject: `${victim} · new applicant`, meta: meta(c, 'Open account', '14:02:19', 'Samsung A14'),
          outcome: 'stop',
          answers: [
            ans('real', 'fail', SRC.liveOnly, 'A photo shown on a screen: screen edges, moiré and no depth.'),
            ans('right', 'pass', SRC.kyc, `The ${idT} is real.`),
            ans('one', 'pass', SRC.match, 'No other account uses this face.'),
            notAtSignup,
          ],
          sensei: { text: 'A photo held up on another screen. This is the most common attack we see, and the easiest to stop. No action needed.', actions: ['See the frames'] },
        },
      },
      nosense: {
        steps: [
          ...signupIntro(c, victim, { say: ['Same photo trick.', 'Same details.', 'Valid ID.'] }),
          captureStep('screen', 'A selfie step that only checks for “a face” accepts a photo of a face.', { text: 'Selfie accepted', tone: 'warn' }),
          moneyGone(c, victim, { amounts: [900, 850, 700] }),
        ],
        panel: kycOnlyPanel(c, victim, { real: 'A face was present. Nobody checked it was alive.' }, 'A photo on a phone opened a real account. It costs the attacker nothing.'),
      },
    },
    talk: {
      setup: 'This one you can do live. Have a photo of a person ready on a second phone.',
      attack: 'Hold the photo up during the live check. Let the prospect watch it get stopped on your real Sense account.',
      contrast: 'If their current selfie step only looks for a face, this passes today.',
      close: 'Then run it with your own face and it goes straight through. Same check, opposite results.',
    },
  };

  const replay: Scenario = {
    id: 'replayed-record-photo',
    title: 'Replayed record photo',
    journey: 'signup', question: 'real',
    blurb: 'The attacker shows the victim’s government record photo back to the camera.',
    caughtBy: 'LiveSense',
    attackOutcome: 'stop',
    variants: {
      genuine: genuineSignup(c),
      attack: {
        steps: [
          ...signupIntro(c, victim, { say: ['A smarter attacker. They have the victim’s record photo from a leak.', 'Real details.', 'Valid ID, and the photo on file will match.'] }),
          captureStep('replay', 'They play the official photo back to the camera. Face match would say yes, because it is the same photo.', { text: 'Frame matches the record photo pixel for pixel', tone: 'bad' }),
          stopResult('Stopped. A live face never matches the record photo that perfectly.'),
        ],
        panel: {
          subject: `${victim} · new applicant`, meta: meta(c, 'Open account', '11:20:51', 'Android emulator?'),
          outcome: 'stop',
          answers: [
            ans('real', 'fail', SRC.liveOnly, 'The capture is the record photo itself, replayed. A live face never matches it this closely.'),
            ans('right', 'flag', SRC.kyc, 'Face match to the record is 99.8%: too perfect to be a live capture.'),
            ans('one', 'pass', SRC.match, 'No other account uses this face.'),
            notAtSignup,
          ],
          sensei: { text: 'This is a replay of the government photo. Face match alone would have approved it, which is why Sense treats a perfect match as a warning, not a pass.', actions: ['Compare with the record'] },
        },
      },
      nosense: {
        steps: [
          ...signupIntro(c, victim, { say: ['Same replay.', 'Same details.', 'Valid ID.'] }),
          captureStep('replay', 'Face match to the record: 99.8%. Approved, with the strongest possible score.', { text: 'Face match 99.8%: approved', tone: 'warn' }),
          moneyGone(c, victim),
        ],
        panel: kycOnlyPanel(c, victim, { right: 'Face matches the record at 99.8%. KYC calls that a strong pass.' }, 'The best score KYC ever gave was for an attacker holding up the official photo.'),
      },
    },
    talk: {
      setup: 'Ask how they treat a near-perfect face match today. Most auto-approve it.',
      attack: 'Sense knows a live face never matches the record photo that closely, so a perfect score is a red flag.',
      contrast: 'KYC alone gives this attacker its best score.',
      close: 'This is why liveness has to sit next to face match, not behind it.',
    },
  };

  const wrongFace: Scenario = {
    id: 'real-record-wrong-face',
    title: 'Real record, wrong face',
    journey: 'signup', question: 'right',
    blurb: 'The ID checks out on the record, but the live face is someone else.',
    caughtBy: 'Your KYC or Sense KYC, MatchSense',
    attackOutcome: 'stop',
    variants: {
      genuine: genuineSignup(c),
      attack: {
        steps: [
          ...signupIntro(c, victim, { say: [`A real person this time, using ${victim}’s identity.`, 'Real details.', 'The record exists and is valid.'] }),
          captureStep('otherface', 'They are alive and on a real phone, so liveness passes. But it is the wrong face.', { text: 'Live face does not match the record photo', tone: 'bad' }),
          stopResult('Stopped. A live person, the wrong person.'),
        ],
        panel: {
          subject: `${victim} · new applicant`, meta: meta(c, 'Open account', '16:44:03'),
          outcome: 'stop',
          answers: [
            ans('real', 'pass', SRC.live, 'A live person on a real camera.'),
            ans('right', 'fail', `${SRC.kyc} · ${SRC.matchOnly}`, 'The live face does not match the record photo for this ID.'),
            ans('one', 'pass', SRC.match, 'No other account uses this face.'),
            notAtSignup,
          ],
          sensei: { text: 'A real person borrowing someone else’s identity. The record is genuine and they are live, but the faces don’t match. Often a family member or a paid stand-in.', actions: ['Compare faces'] },
        },
      },
      nosense: {
        steps: [
          ...signupIntro(c, victim, { say: ['Without a face to record match.', 'Same identity.', 'The record is valid.'] }),
          captureStep('otherface', 'A selfie is taken but never compared with the record.', { text: 'Selfie stored', tone: 'warn' }),
          moneyGone(c, victim, { footnote: `${victim} will be chased for a debt they never took.` }),
        ],
        panel: kycOnlyPanel(c, victim, { right: 'The record is valid. Nobody compared the face with it.' }, 'A valid record was used by someone else. The real owner carries the debt.'),
      },
    },
    talk: {
      setup: 'Use this when the prospect already does document or record checks and feels covered.',
      attack: 'Point out that Real person? passes here. It takes both questions to stop this.',
      contrast: 'If the face is never compared with the record, a valid ID is enough.',
      close: 'Sense uses your KYC provider’s record or Sense KYC, whichever they have.',
    },
  };

  const duplicate: Scenario = {
    id: 'same-face-new-name',
    title: 'Same face, new name',
    journey: 'signup', question: 'one',
    blurb: `One person, two identities. Loan stacking, bonus abuse and multi-accounting.`,
    caughtBy: 'MatchSense',
    attackOutcome: 'stop',
    live: { kind: 'duplicate', label: 'Run it live twice', hint: 'Run once as yourself, then again under a new name. The second run is stopped.' },
    variants: {
      genuine: genuineSignup(c),
      attack: {
        steps: [
          ...signupIntro(c, alias, { say: [`${genuine} opened ${c.ind.product} last week. Here she is again.`, `This time as “${alias}”, with a cousin’s details.`, `A different, valid ${idT}.`] }),
          captureStep('genuine', 'A real, live person. Liveness passes. But Sense has seen this face before.', { text: `Face matches an existing customer: ${genuine}`, tone: 'bad' }),
          stopResult('Stopped. One person, one account.', 'You already have an account with us, so we can’t open another one. Sign in instead.'),
        ],
        panel: {
          subject: `${alias} · new applicant`, meta: meta(c, 'Open account', '10:02:15'),
          outcome: 'stop',
          answers: [
            ans('real', 'pass', SRC.live, 'Live person, real camera.'),
            ans('right', 'pass', SRC.kyc, `${alias}’s ${idT} is real.`),
            ans('one', 'fail', SRC.matchOnly, `Same face as ${genuine}, who opened ${c.ind.product} 6 days ago.`),
            notAtSignup,
          ],
          sensei: { text: `One person, two names, six days apart. This is how ${c.ind.id === 'lender' ? 'loan stacking' : c.ind.id === 'gaming' ? 'bonus abuse' : 'multi-accounting'} starts. ${genuine}’s first ${c.ind.productNoun} is still open; you may want to review it.`, actions: [`Review ${genuine}`, 'Add face to blocklist'] },
          extra: { kind: 'match', a: genuine, b: alias, when: '6 days apart', score: '99.1% face match' },
        },
      },
      nosense: {
        steps: [
          ...signupIntro(c, alias, { say: ['Same person, second name.', 'Different details.', 'Valid ID.'] }),
          captureStep('genuine', 'A real person, so a liveness-only check passes them.', { text: 'Selfie accepted', tone: 'warn' }),
          { id: 'aftermath', label: 'Afterwards', ms: 4200, say: 'Two accounts, one person. The second loan never gets repaid.', screen: { kind: 'nosense', headline: `Second ${c.ind.productNoun} opened for “${alias}”`, title: `${c.money(4000)} approved twice to one person`, lines: [{ who: `${genuine} · ${c.ind.productNoun} 1`, when: '6 days ago', amount: -c.amt(4000) }, { who: `${alias} · ${c.ind.productNoun} 2`, when: 'Today', amount: -c.amt(4000) }], footnote: 'Neither will be repaid.' }, event: { text: 'Second account approved', tone: 'bad' } },
        ],
        panel: kycOnlyPanel(c, alias, { real: 'A live person, which is all liveness can say.', one: 'Never compared with existing customers.' }, 'KYC checks each identity on its own. It can’t see one person behind two of them.'),
      },
    },
    talk: {
      setup: 'Lenders, gaming and gig: lead with this. Ask how many of their customers they think are the same person twice.',
      attack: 'Run it live: once as yourself, once under a new name. The prospect watches their own demo create the duplicate.',
      contrast: 'Every check passes each identity on its own. Only a face search across customers sees it.',
      close: 'Offer the free fraud scan: we find the duplicates already on their book.',
    },
  };

  const botFarm: Scenario = {
    id: 'bot-farm',
    title: 'Bot farm sign-ups',
    journey: 'signup', question: 'real',
    blurb: 'Forty applications in an hour from emulators and rooted phones, each with a fresh identity.',
    caughtBy: 'DeepSense',
    attackOutcome: 'stop',
    variants: {
      genuine: genuineSignup(c),
      attack: {
        steps: [
          { id: 'farm', label: 'The farm', screen: { kind: 'botfarm', count: 40 }, say: 'Forty sign-ups in an hour. Each one has a different name and a valid ID bought in bulk.', event: { text: '40 sign-ups from 3 devices in 60 minutes', tone: 'warn' }, ms: 3400 },
          ...signupIntro(c, alias, { say: ['Here is one of the forty.', 'Scripted details, typed at machine speed.', 'A real, bought ID.'] }).slice(1),
          captureStep('emulator', 'The “phone” is an emulator with a virtual camera.', { text: 'Device: Android emulator, rooted, virtual camera', tone: 'bad' }),
          stopResult('Stopped, along with the other thirty-nine.'),
        ],
        panel: {
          subject: `${alias} · 1 of 40`, meta: meta(c, 'Open account', '02:14:09', 'Android emulator'),
          outcome: 'stop',
          answers: [
            ans('real', 'fail', SRC.deep, 'Emulator, rooted, with a virtual camera. Not a real phone.'),
            ans('right', 'pass', SRC.kyc, `The ${idT} is real.`),
            ans('one', 'flag', SRC.match, 'This device has opened 13 applications tonight.'),
            notAtSignup,
          ],
          sensei: { text: 'A bot farm: 40 applications from 3 emulated devices between 1am and 2am, each with a different real ID. All 40 are stopped. Blocking the 3 devices stops the next batch too.', actions: ['Block 3 devices', 'See all 40'] },
          extra: { kind: 'botfarm', total: 40, window: '01:12 to 02:14', devices: [{ label: 'Emulator A · rooted', count: 16 }, { label: 'Emulator B · virtual camera', count: 13 }, { label: 'Emulator C · automation', count: 11 }] },
        },
      },
      nosense: {
        steps: [
          { id: 'farm', label: 'The farm', screen: { kind: 'botfarm', count: 40 }, say: 'Same forty sign-ups.', event: { text: '40 sign-ups overnight', tone: 'warn' }, ms: 3000 },
          ...signupIntro(c, alias, { say: ['', 'Each one looks normal on its own.', 'Valid IDs.'] }).slice(1),
          captureStep('emulator', 'Nothing checks the device, so the emulator passes.', { text: 'Selfie accepted', tone: 'warn' }),
          { id: 'aftermath', label: 'Afterwards', ms: 4200, say: 'Forty accounts by morning, ready to sell or to receive stolen money.', screen: { kind: 'nosense', headline: '40 accounts opened overnight', title: 'Sold on as mule accounts', lines: [{ who: 'Accounts 1 to 16', when: 'Emulator A', amount: -c.amt(16 * 300) }, { who: 'Accounts 17 to 29', when: 'Emulator B', amount: -c.amt(13 * 300) }, { who: 'Accounts 30 to 40', when: 'Emulator C', amount: -c.amt(11 * 300) }], footnote: 'You find them when the police ask.' }, event: { text: '40 accounts opened', tone: 'bad' } },
        ],
        panel: kycOnlyPanel(c, alias, { real: 'Nobody checked the device or camera.', one: 'Never compared across the 40.' }, 'Each application looked fine on its own. Together they were a farm.'),
      },
    },
    talk: {
      setup: 'For marketplaces and anyone with sign-up bonuses: ask what their overnight sign-ups look like.',
      attack: 'DeepSense looks at the device and camera, so the whole farm is stopped, not one account at a time.',
      contrast: 'Without device checks, each of the forty passes on its own.',
      close: 'One click blocks the devices, so tomorrow’s batch is stopped too.',
    },
  };

  const mule: Scenario = {
    id: 'recruited-mule',
    title: 'Recruited mule',
    journey: 'signup', question: 'one',
    blurb: 'A real person, paid to open an account they will hand over. Sensei sees the pattern.',
    caughtBy: 'Sensei risk policy, device and network signals',
    attackOutcome: 'review',
    variants: {
      genuine: genuineSignup(c),
      attack: {
        steps: [
          ...signupIntro(c, 'Joy Adeyemi', { say: ['The hardest one. A real student, paid to open an account and hand it over.', 'Her own details, typed while someone reads them out.', 'Her own, valid ID.'] }),
          captureStep('genuine', 'She is real and live. Everything “passes”. But the context doesn’t fit.', { text: 'Device seen on 4 other new accounts this week', tone: 'warn' }),
          reviewResult('Not stopped, not let through. Sent to Review with Sensei’s write-up.'),
        ],
        panel: {
          subject: 'Joy Adeyemi · new applicant', meta: meta(c, 'Open account', '15:33:48', 'Tecno Spark 10'),
          outcome: 'review',
          answers: [
            ans('real', 'pass', SRC.live, 'Live person on a real camera.'),
            ans('right', 'pass', SRC.kyc, 'Her own valid ID, and her own face.'),
            ans('one', 'flag', SRC.match, 'This phone opened 4 other accounts this week, all with different faces.'),
            notAtSignup,
          ],
          sensei: { text: 'Likely a recruited mule. She is who she says she is, but the phone has opened four other accounts this week, the form was filled at reading pace and the address is 40 km from the device. Suggest: approve with no outbound transfers for 30 days, or ask for a short call.', actions: ['Approve with limits', 'Ask for a call'] },
        },
      },
      nosense: {
        steps: [
          ...signupIntro(c, 'Joy Adeyemi', { say: ['Same recruited student.', 'Her own details.', 'Her own ID.'] }),
          captureStep('genuine', 'Everything passes, because she is real.', { text: 'Selfie accepted', tone: 'warn' }),
          moneyGone(c, 'Joy Adeyemi', { headline: 'Account opened, then handed over', say: 'Two days later the account receives scam money and moves it on in minutes.', footnote: 'Regulators now expect you to stop accounts like this.' }),
        ],
        panel: kycOnlyPanel(c, 'Joy Adeyemi', { real: 'A real person. KYC is right about that.', one: 'Four other accounts from this phone, never connected.' }, 'Every check passed, because the person is real. The pattern around her was the signal.'),
      },
    },
    talk: {
      setup: 'Use with banks and wallets, and anyone worried about mule account rules.',
      attack: 'Point out that nothing failed. Sensei explains why it is still worth a look and suggests a proportionate action.',
      contrast: 'Without the device and pattern view, a recruited mule is a perfect customer.',
      close: 'This is where Sensei earns its place: cases arrive already investigated.',
    },
  };

  return [fastPath, faceSwap, screen, replay, wrongFace, duplicate, botFarm, mule];
}
