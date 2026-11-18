/* Two attacks the usesense.ai industry pages name that the library lacked:
   an edited driving licence (mobility and gig) and a synthetic identity
   (payments and wallets). */
import { SRC, ans, captureStep, kycOnlyPanel, meta, moneyGone, notAtSignup, signupIntro, stopResult } from './build';
import { genuineSignup } from './signup';
import type { Scenario, ScenarioContext } from './types';

export function extraScenarios(c: ScenarioContext): Scenario[] {
  const { victim } = c.m.people;
  const idT = c.m.idType;

  const editedLicence: Scenario = {
    id: 'edited-licence',
    title: 'Edited driving licence',
    journey: 'signup', question: 'right',
    blurb: 'A real licence number with the photo swapped for the applicant’s own. The card looks right; the record photo does not match.',
    caughtBy: 'Your KYC or Sense KYC, MatchSense',
    attackOutcome: 'stop',
    variants: {
      genuine: genuineSignup(c),
      attack: {
        steps: [
          ...signupIntro(c, victim, { say: [`A driver who was banned elsewhere wants back in, using ${victim}’s licence.`, 'Real details from the licence.', 'The licence number is valid on the record.'] }),
          { id: 'doc', label: 'Licence', screen: { kind: 'idnumber', idType: 'driving licence', value: c.m.idSample, status: 'valid' }, say: 'The card was edited: the photo on it is now the applicant’s. To a reviewer it looks fine.', event: { text: 'Licence photo matches the applicant', tone: 'warn' }, ms: 2800 },
          captureStep('otherface', 'They are live, and their face matches the edited card. It does not match the photo on the government record.', { text: 'Live face does not match the record photo', tone: 'bad' }),
          stopResult('Stopped. The card was edited; the record wasn’t.'),
        ],
        panel: {
          subject: `${victim} · new driver`, meta: meta(c, 'Driver sign-up', '07:12:44', 'Galaxy A14'),
          outcome: 'stop',
          answers: [
            ans('real', 'pass', SRC.live, 'A live person on a real camera.'),
            ans('right', 'fail', `${SRC.kyc} · ${SRC.matchOnly}`, 'The face matches the photo on the card, but not the photo on the government record. The card was edited.'),
            ans('one', 'pass', SRC.match, 'No other account uses this face.'),
            notAtSignup,
          ],
          sensei: { text: 'An edited licence: the number is real, the photo was replaced. A check against the card alone passes; the record photo shows a different person. Often a banned driver coming back.', actions: ['Compare with the record photo'] },
        },
      },
      nosense: {
        steps: [
          ...signupIntro(c, victim, { say: ['Without a record photo check.', 'Same details.', 'The licence number is valid.'] }),
          captureStep('otherface', 'The selfie matches the photo on the edited card, so it passes.', { text: 'Selfie matches the card', tone: 'warn' }),
          moneyGone(c, victim, { headline: `Driver account opened for “${victim}”`, say: 'A banned driver is back on the road under someone else’s name.', footnote: `${victim} gets the complaints and the fines.`, amounts: [180, 240, 210] }),
        ],
        panel: kycOnlyPanel(c, victim, { right: 'The card and the selfie match. Nobody checked the record photo.' }, 'An edited card is enough when the face is only compared with the card.'),
      },
    },
    talk: {
      setup: 'Use this with mobility and gig platforms that check the licence card but not the record.',
      attack: 'Point at Right person? It fails on the record photo, not the card.',
      contrast: 'Compare against the card alone and an edited card wins.',
      close: 'Sense checks the face against the record your KYC returns, or Sense KYC fetches it.',
    },
  };

  const synthetic: Scenario = {
    id: 'synthetic-identity',
    title: 'Synthetic identity',
    journey: 'signup', question: 'real',
    blurb: 'Real-looking data stitched together, with a generated face. There is no real person behind it.',
    caughtBy: 'LiveSense, DeepSense, Sense KYC',
    attackOutcome: 'stop',
    variants: {
      genuine: genuineSignup(c),
      attack: {
        steps: [
          ...signupIntro(c, 'Tobi Adler', { say: ['This person does not exist. The name, number and address were stitched together.', 'Clean details, nothing on any blocklist.', `The ${idT} number passes a format check.`] }),
          captureStep('deepfake', 'The face is generated too, played into the camera. No real person is in front of it.', { text: 'Generated face; capture from an emulator', tone: 'bad' }),
          stopResult('Stopped. Nobody real was there.'),
        ],
        panel: {
          subject: 'Tobi Adler · new applicant', meta: meta(c, 'Open wallet', '02:18:09', 'Android emulator'),
          outcome: 'stop',
          answers: [
            ans('real', 'fail', SRC.live, 'Generated face, captured on an emulator instead of a real phone.'),
            ans('right', 'flag', SRC.kyc, `The ${idT} number is well formed but no record photo matches any face.`),
            ans('one', 'pass', SRC.match, 'A new face, because it was made for this sign-up.'),
            notAtSignup,
          ],
          sensei: { text: 'A synthetic identity: real-looking data with no real person behind it. The face was generated and the phone was an emulator. Wallets like this receive money and pass it on within the hour.', actions: ['Block this device'] },
        },
      },
      nosense: {
        steps: [
          ...signupIntro(c, 'Tobi Adler', { say: ['Without Sense.', 'Clean details.', 'The number passes.'] }),
          captureStep('deepfake', 'A selfie is uploaded. Nothing asks whether a person took it.', { text: 'Selfie accepted', tone: 'warn' }),
          moneyGone(c, 'Tobi Adler', { headline: 'Wallet opened for “Tobi Adler”', say: 'The wallet receives stolen money and moves it on.', footnote: 'There is nobody to chase. Tobi Adler never existed.' }),
        ],
        panel: kycOnlyPanel(c, 'Tobi Adler', {}, 'A wallet for a person who does not exist, used to move stolen money.'),
      },
    },
    talk: {
      setup: 'For payments and wallets: ask how they know a real person opened each wallet.',
      attack: 'Point at Real person? The face was generated and the phone was an emulator.',
      contrast: 'Without Sense the wallet opens and becomes a mule.',
      close: 'Sense answers whether a real person is there before the wallet exists.',
    },
  };

  return [editedLicence, synthetic];
}
