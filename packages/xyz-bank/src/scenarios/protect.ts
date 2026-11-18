import { formatMoney } from '../lib/presets';
import { SRC, ans, kycOnlyPanel, meta } from './build';
import type { Panel, Scenario, ScenarioContext, Step, Variant } from './types';

const signedUpLine = (c: ScenarioContext) => ans('right', 'pass', SRC.kyc, `Verified at sign-up with a valid ${c.m.idType}.`);

function ownerPanel(c: ScenarioContext, flow: string, text: string, sensei: string, device = 'iPhone 15'): Panel {
  const name = c.m.people.genuine;
  return {
    subject: `${name} · customer since March`, meta: meta(c, flow, '18:20:31', device),
    outcome: 'let',
    answers: [
      ans('real', 'pass', SRC.live, 'Live person on a real camera.'),
      signedUpLine(c),
      ans('one', 'pass', SRC.matchOnly, 'Only account for this face.'),
      ans('still', 'pass', SRC.protect, text),
    ],
    sensei: { text: sensei, actions: ['See timeline'] },
  };
}

function thiefPanel(c: ScenarioContext, flow: string, text: string, sensei: string, device: string, actions = ['Lock the account', 'Call the customer']): Panel {
  const name = c.m.people.genuine;
  return {
    subject: `${name} · customer since March`, meta: meta(c, flow, '03:12:44', device),
    outcome: 'stop',
    answers: [
      ans('real', 'pass', SRC.live, 'A live person, but see below.'),
      signedUpLine(c),
      ans('one', 'pass', SRC.matchOnly, 'Only account for this face.'),
      ans('still', 'fail', SRC.protect, text),
    ],
    sensei: { text: sensei, actions },
  };
}

function home(c: ScenarioContext, say: string, banner?: string): Step {
  return { id: 'home', label: 'Home', screen: { kind: 'home', name: c.m.people.genuine, balance: c.exact(12480.22), delta: c.amt(2140), banner }, say, ms: 2600 };
}

function payeeSteps(c: ScenarioContext, mode: 'genuine' | 'thief', sayAsk: string, sayScan: string): Step[] {
  const payee = mode === 'genuine' ? 'Tola Bakare' : c.m.people.payees[0];
  const amount = c.amt(2500);
  const reason = `It’s a new payee and more than you usually send.`;
  return [
    { id: 'send', label: c.ind.payoutVerb, screen: { kind: 'send', payee, amount, isNew: true, reference: mode === 'genuine' ? 'Car deposit' : 'Invoice 2231' }, say: mode === 'genuine' ? 'She sends a deposit to someone new.' : 'The thief sends the balance to a new payee.', event: { text: `New payee and ${c.money(2500)}: above her usual`, tone: 'warn' }, ms: 2800 },
    { id: 'ask', label: 'Step-up', screen: { kind: 'stepup', payee, amount, reason, mode: mode === 'genuine' ? 'genuine' : 'thief', phase: 'ask' }, say: sayAsk, event: { text: 'Face check requested before the money moves', tone: 'info' }, ms: 2600 },
    { id: 'scan', label: 'Face check', screen: { kind: 'stepup', payee, amount, reason, mode: mode === 'genuine' ? 'genuine' : 'thief', phase: 'scan' }, say: sayScan, event: mode === 'genuine' ? { text: 'Matches the face from sign-up', tone: 'ok' } : { text: 'Does not match the face from sign-up', tone: 'bad' }, ms: 3200 },
  ];
}

export function protectScenarios(c: ScenarioContext): Scenario[] {
  const name = c.m.people.genuine;
  const first = name.split(' ')[0];

  const payeeGenuine: Variant = {
    steps: [
      home(c, `${first} has banked with ${c.brand.name} since March.`),
      ...payeeSteps(c, 'genuine', 'Before money goes to someone new, a three-second sheet. It says why in one line.', 'She looks at the camera. It matches the face from sign-up.'),
      { id: 'decision', label: 'Sent', decide: true, ms: 3000, say: 'Sent. Three seconds for her; impossible for a thief.', screen: { kind: 'result', tone: 'ok', title: 'Sent', body: `${c.money(2500)} is on its way to Tola Bakare.`, cta: 'Done' }, event: { text: 'Payment confirmed by the owner', tone: 'ok' } },
    ],
    panel: ownerPanel(c, 'Confirm payment', 'Matches the face from sign-up. Confirmed in 3 seconds.', 'The owner, on her usual phone, confirming a payment she started. Nothing else to do.'),
  };

  const newPayee: Scenario = {
    id: 'new-payee',
    title: 'Big payment to a new payee',
    journey: 'protect', question: 'still',
    blurb: 'Money leaves to someone new. The owner confirms in three seconds; a thief can’t.',
    caughtBy: 'Account protection face check',
    attackOutcome: 'stop',
    live: { kind: 'auth', label: 'Confirm the payment live', hint: 'Uses the face from your live sign-up. Run a live sign-up first.' },
    variants: {
      genuine: payeeGenuine,
      attack: {
        steps: [
          home(c, `Someone has ${first}’s password. They phished it last night.`, 'Signed in from a new browser'),
          ...payeeSteps(c, 'thief', 'The password got them in. It can’t get them past this.', 'Their face is not the face Sense saw at sign-up.'),
          { id: 'decision', label: 'Stopped', decide: true, ms: 3200, say: 'Stopped, and the account is locked until she confirms.', screen: { kind: 'result', tone: 'stop', title: 'Payment stopped', body: 'We couldn’t confirm it was you, so we stopped this payment and locked new payments. We’ve sent you a message.', cta: 'This was me' }, event: { text: 'Payment stopped, account locked', tone: 'bad' } },
        ],
        panel: thiefPanel(c, 'Confirm payment', 'Face does not match the owner. Payment stopped before the money moved.', `${first}’s password was used from a new browser at 3am, and the face at the payment check is not hers. Stopped before ${c.money(2500)} left. She has been sent a message.`, 'Chrome on Windows (new)'),
      },
      nosense: {
        steps: [
          home(c, 'Same stolen password.', 'Signed in from a new browser'),
          { id: 'send', label: c.ind.payoutVerb, screen: { kind: 'send', payee: c.m.people.payees[0], amount: c.amt(2500), isNew: true, reference: 'Invoice 2231' }, say: 'A one-time code? Sent to the phone number they already changed.', event: { text: 'SMS code entered', tone: 'warn' }, ms: 2800 },
          { id: 'aftermath', label: 'Afterwards', ms: 4200, say: 'The balance is gone, and the bank is asked to pay it back.', screen: { kind: 'nosense', headline: `${first}’s account emptied`, title: `${formatMoney(-(c.amt(2500) + c.amt(4500) + c.amt(5400)), c.m)} gone in 3 payments`, lines: [{ who: c.m.people.payees[0], when: '03:14', amount: -c.amt(2500) }, { who: c.m.people.payees[1], when: '03:16', amount: -c.amt(4500) }, { who: c.m.people.payees[2], when: '03:19', amount: -c.amt(5400) }], footnote: 'In some markets you now refund the customer.' }, event: { text: 'Balance emptied', tone: 'bad' } },
        ],
        panel: kycOnlyPanel(c, name, { real: 'Not asked after sign-up.', one: 'Not relevant here.', still: 'A password and an SMS code. Both were stolen.' }, 'Passwords and SMS codes prove someone has them, not that they are the owner.'),
      },
    },
    talk: {
      setup: 'For anyone who moves money: banks, wallets, payouts. Ask how they confirm a risky payment today.',
      attack: 'A stolen password gets the thief in, but not past a face check matched to sign-up.',
      contrast: 'SMS codes are stolen with the phone number. That is why they keep losing.',
      close: 'Only at risky moments, so good customers almost never see it.',
    },
  };

  const simSwap: Scenario = {
    id: 'sim-swap-new-phone',
    title: 'SIM swap, new phone',
    journey: 'protect', question: 'still',
    blurb: 'An attacker takes the number, resets the password and signs in on a new phone.',
    caughtBy: 'Account protection face check',
    attackOutcome: 'stop',
    live: { kind: 'auth', label: 'Sign in on a new phone live', hint: 'Uses the face from your live sign-up. Run a live sign-up first.' },
    variants: {
      genuine: {
        steps: [
          { id: 'signin', label: 'New phone', screen: { kind: 'signin', device: 'iPhone 16', note: 'You’re signing in on a new phone.' }, say: `${first} bought a new phone and signs in.`, event: { text: 'Sign-in from a new device', tone: 'warn' }, ms: 2800 },
          { id: 'scan', label: 'Face check', screen: { kind: 'capture', mode: 'genuine', title: 'New phone, same you?', sub: 'Look at the camera' }, say: 'One look, and the new phone is trusted.', event: { text: 'Matches the face from sign-up', tone: 'ok' }, ms: 3000 },
          { id: 'decision', label: 'Signed in', decide: true, ms: 2800, say: 'In. No call centre, no waiting.', screen: { kind: 'home', name, balance: c.exact(12480.22), delta: c.amt(2140), banner: 'This phone is now trusted' }, event: { text: 'New phone trusted', tone: 'ok' } },
        ],
        panel: ownerPanel(c, 'New phone', 'Matches the face from sign-up. New phone trusted.', 'The owner moving to a new phone. Same face, same city, normal hours.', 'iPhone 16 (new)'),
      },
      attack: {
        steps: [
          { id: 'otp', label: 'SIM swap', screen: { kind: 'otp', phone: c.m.phone, note: 'Your code is 482113' }, say: `Last night someone talked the mobile network into moving ${first}’s number to their SIM.`, event: { text: 'Password reset by SMS', tone: 'warn' }, ms: 3000 },
          { id: 'signin', label: 'New phone', screen: { kind: 'signin', device: 'Galaxy A05', note: 'You’re signing in on a new phone.' }, say: 'New password, new phone. Everything a bank usually trusts.', event: { text: 'Sign-in from a new device, 300 km away', tone: 'warn' }, ms: 2800 },
          { id: 'scan', label: 'Face check', screen: { kind: 'capture', mode: 'thief', title: 'New phone, same you?', sub: 'Look at the camera' }, say: 'But a new phone has to show the owner’s face.', event: { text: 'Does not match the face from sign-up', tone: 'bad' }, ms: 3000 },
          { id: 'decision', label: 'Stopped', decide: true, ms: 3000, say: 'Stopped. The number is theirs; the account isn’t.', screen: { kind: 'result', tone: 'stop', title: 'We couldn’t confirm it’s you', body: 'This phone can’t use the account yet. If you’ve changed phones, visit a branch or call us.', cta: 'Get help' }, event: { text: 'New phone refused', tone: 'bad' } },
        ],
        panel: thiefPanel(c, 'New phone', 'Face does not match the owner. New phone refused.', `Classic SIM swap: SMS password reset at 2:58am, then a new phone 300 km from ${first}’s usual city. The face doesn’t match. The account stays safe and ${first} is told.`, 'Galaxy A05 (new)'),
      },
      nosense: {
        steps: [
          { id: 'otp', label: 'SIM swap', screen: { kind: 'otp', phone: c.m.phone, note: 'Your code is 482113' }, say: 'Same SIM swap.', event: { text: 'Password reset by SMS', tone: 'warn' }, ms: 2800 },
          { id: 'signin', label: 'New phone', screen: { kind: 'signin', device: 'Galaxy A05', note: 'Welcome back.' }, say: 'The SMS code is all it takes.', event: { text: 'New phone trusted by SMS code', tone: 'warn' }, ms: 2600 },
          { id: 'aftermath', label: 'Afterwards', ms: 4200, say: 'The account is theirs.', screen: { kind: 'nosense', headline: `${first}’s account taken over`, title: `${formatMoney(-(c.amt(6000) + c.amt(6400)), c.m)} moved before breakfast`, lines: [{ who: c.m.people.payees[0], when: '03:20', amount: -c.amt(6000) }, { who: c.m.people.payees[1], when: '03:22', amount: -c.amt(6400) }], footnote: `${first} finds out when her phone stops working.` }, event: { text: 'Account taken over', tone: 'bad' } },
        ],
        panel: kycOnlyPanel(c, name, { still: 'A new phone was trusted because of an SMS code.' }, 'The SMS code went to the attacker. Nothing else stood in the way.'),
      },
    },
    talk: {
      setup: 'Ask how a new phone gets trusted today. If the answer is an SMS code, this is their gap.',
      attack: 'The attacker has the number and the password. They don’t have her face.',
      contrast: 'With SMS as the only check, a SIM swap is a full takeover.',
      close: 'The same check makes a real phone change painless for good customers.',
    },
  };

  const rented: Scenario = {
    id: 'rented-account',
    title: 'Rented account',
    journey: 'protect', question: 'still',
    blurb: 'A verified driver lends the account to someone else for the shift.',
    caughtBy: 'Account protection at start of shift',
    attackOutcome: 'stop',
    variants: {
      genuine: {
        steps: [
          { id: 'shift', label: 'Start shift', screen: { kind: 'shift', name, mode: 'genuine', phase: 'ask' }, say: `${first} is a verified driver. Each shift starts with a quick look.`, event: { text: 'Start of shift', tone: 'info' }, ms: 2600 },
          { id: 'scan', label: 'Face check', screen: { kind: 'shift', name, mode: 'genuine', phase: 'scan' }, say: 'Two seconds, and she is online.', event: { text: 'Matches the face from sign-up', tone: 'ok' }, ms: 2800 },
          { id: 'decision', label: 'Online', decide: true, ms: 2600, say: 'The person on the road is the person you checked.', screen: { kind: 'result', tone: 'ok', title: 'You’re online', body: 'Drive safe. Your first trip is 4 minutes away.', cta: 'Go' }, event: { text: 'Shift started', tone: 'ok' } },
        ],
        panel: ownerPanel(c, 'Start shift', 'Matches the face from sign-up.', 'The verified driver, on her usual phone, at her usual time.', 'Samsung A14'),
      },
      attack: {
        steps: [
          { id: 'shift', label: 'Start shift', screen: { kind: 'shift', name, mode: 'thief', phase: 'ask' }, say: `${first} rents her account to a friend who failed your checks.`, event: { text: 'Start of shift', tone: 'info' }, ms: 2600 },
          { id: 'scan', label: 'Face check', screen: { kind: 'shift', name, mode: 'thief', phase: 'scan' }, say: 'Same phone, same password. Different face.', event: { text: 'Does not match the face from sign-up', tone: 'bad' }, ms: 2800 },
          { id: 'decision', label: 'Stopped', decide: true, ms: 3000, say: 'Stopped before the first passenger gets in.', screen: { kind: 'result', tone: 'stop', title: 'We couldn’t confirm it’s you', body: 'Only the verified driver can go online. Try again in good light, or contact support.', cta: 'Try again' }, event: { text: 'Shift blocked', tone: 'bad' } },
        ],
        panel: thiefPanel(c, 'Start shift', 'A different person is trying to start the shift.', `Someone other than ${first} tried to start a shift on her phone. This account also had 2 failed starts last week. Suggest a call with ${first} before the next shift.`, 'Samsung A14', ['Suspend until reviewed', 'Call the driver']),
      },
      nosense: {
        steps: [
          { id: 'shift', label: 'Start shift', screen: { kind: 'home', name, balance: c.amt(340), banner: 'You’re online' }, say: 'Without a shift check, the password is enough.', event: { text: 'Shift started with a password', tone: 'warn' }, ms: 2800 },
          { id: 'aftermath', label: 'Afterwards', ms: 4200, say: 'An unverified driver carries your passengers under someone else’s name.', screen: { kind: 'nosense', headline: 'Unverified driver on the road', title: '9 trips under someone else’s name', lines: [{ who: 'Trips 1 to 9', when: 'Tonight', amount: c.amt(180) }], footnote: 'If something happens, the record shows the wrong person.' }, event: { text: 'Unverified person drove 9 trips', tone: 'bad' } },
        ],
        panel: kycOnlyPanel(c, name, { still: 'Never asked at the start of a shift.' }, 'The checks at sign-up were real. Nobody checked who turned up for the shift.'),
      },
    },
    talk: {
      setup: 'Lead with this for mobility and gig. Rented accounts are their safety and brand risk.',
      attack: 'Same phone, same password, different face. Only a face check sees it.',
      contrast: 'Sign-up checks don’t help if the account is lent out the next day.',
      close: 'Two seconds at the start of a shift. Drivers get used to it within a week.',
    },
  };

  const dormant: Scenario = {
    id: 'dormant-account',
    title: 'Dormant account wakes up',
    journey: 'protect', question: 'still',
    blurb: 'An old account, bought online, signs in from abroad and adds payees.',
    caughtBy: 'Account protection, Sensei',
    attackOutcome: 'stop',
    variants: {
      genuine: payeeGenuine,
      attack: {
        steps: [
          { id: 'signin', label: 'Sign in', screen: { kind: 'signin', device: 'Pixel 7', note: 'Welcome back. It’s been a while.' }, say: 'This account was opened two years ago and went quiet. Someone bought it online last week.', event: { text: 'First sign-in in 14 months, from another country', tone: 'warn' }, ms: 3000 },
          { id: 'scan', label: 'Face check', screen: { kind: 'capture', mode: 'thief', title: 'Welcome back', sub: 'A quick look before you continue' }, say: 'Sensei asks for a face check because of how unusual this is.', event: { text: 'Does not match the face from sign-up', tone: 'bad' }, ms: 3000 },
          { id: 'decision', label: 'Stopped', decide: true, ms: 3000, say: 'Stopped. The buyer can’t use what they paid for.', screen: { kind: 'result', tone: 'stop', title: 'We couldn’t confirm it’s you', body: 'For your safety this account is paused. Visit a branch or call us to unlock it.', cta: 'Get help' }, event: { text: 'Account paused', tone: 'bad' } },
        ],
        panel: thiefPanel(c, 'Sign in', 'Face does not match the person who opened the account.', 'Dormant for 14 months, then a sign-in from another country and three payees added in five minutes. The face doesn’t match the owner. Accounts like this are often sold as ready-made mule accounts.', 'Pixel 7 (new)', ['Close the account', 'Report as mule']),
      },
      nosense: {
        steps: [
          { id: 'signin', label: 'Sign in', screen: { kind: 'signin', device: 'Pixel 7', note: 'Welcome back.' }, say: 'Same buyer, same login.', event: { text: 'Sign-in accepted', tone: 'warn' }, ms: 2800 },
          moneyGoneDormant(c),
        ],
        panel: kycOnlyPanel(c, name, { still: 'A correct password from another country, after 14 months.' }, 'A verified, aged account is worth more to criminals than a new one, because nobody looks at it.'),
      },
    },
    talk: {
      setup: 'For anyone with old accounts: gaming, wallets, banks. Aged accounts sell for more.',
      attack: 'Sensei notices the pattern and asks for a face check only here.',
      contrast: 'A correct password is all an aged account needs today.',
      close: 'Ask to verify again works from the dashboard too, for any account you are unsure about.',
    },
  };

  return [newPayee, simSwap, rented, dormant];
}

function moneyGoneDormant(c: ScenarioContext): Step {
  return {
    id: 'aftermath', label: 'Afterwards', ms: 4200,
    say: 'The account becomes a pipe for scam money.',
    screen: {
      kind: 'nosense',
      headline: 'Old account now a mule',
      title: `${c.money(18000)} in and out in 2 days`,
      lines: [
        { who: 'In from 6 scam victims', when: 'Mon', amount: c.amt(18000) },
        { who: `Out to ${c.m.people.payees[0]}`, when: 'Mon', amount: -c.amt(9000) },
        { who: `Out to ${c.m.people.payees[1]}`, when: 'Tue', amount: -c.amt(9000) },
      ],
      footnote: 'Your name is on the account the regulator asks about.',
    },
    event: { text: 'Account used to move scam money', tone: 'bad' },
  };
}
