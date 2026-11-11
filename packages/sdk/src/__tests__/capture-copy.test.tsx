/**
 * BRAND-v1 section 9: `copy.capture` fallbacks, blank overrides and placeholders.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CaptureStrings, CAPTURE_COPY_DEFAULTS, mergeCaptureCopy, fillPlaceholders } from '../capture/capture-copy';
import { EXTRA_CHECK_COPY, endScreenCopy, primerCopy, headTurnTitle, extraCheckSentence, ChallengeRunner, inlineStepUpGuidance, challengePausedSub } from '../capture/extra-check';
import { GATE_HINTS } from '../capture/quality-gate';
import { mergeCopy } from '../flows/copy';
import { CapturePreview } from '../components/CapturePreview';

describe('defaults are the shipped strings (byte-identical)', () => {
  it('guidance matches GATE_HINTS', () => {
    const g = CAPTURE_COPY_DEFAULTS.guidance;
    expect([g.ready, g.centre, g.closer, g.back, g.straight, g.dark, g.darkHint, g.bright, g.brightHint, g.blur, g.eyes, g.onePerson, g.showFace, g.covered, g.holdStill, g.shutterHint])
      .toEqual([GATE_HINTS.still, GATE_HINTS.in_frame, GATE_HINTS.too_far, GATE_HINTS.too_close, GATE_HINTS.pose, GATE_HINTS.too_dark, GATE_HINTS.too_dark_sub, GATE_HINTS.too_bright, GATE_HINTS.too_bright_sub, GATE_HINTS.sharpness, GATE_HINTS.eyes, GATE_HINTS.one_person, GATE_HINTS.face, GATE_HINTS.covered, GATE_HINTS.stillness, GATE_HINTS.shutter]);
  });
  it('extra check and leave match EXTRA_CHECK_COPY', () => {
    const x = CAPTURE_COPY_DEFAULTS.extraCheck;
    expect(x.sheetTitle).toBe(EXTRA_CHECK_COPY.sheetTitle);
    expect(x.continue).toBe(EXTRA_CHECK_COPY.continue);
    expect(x.tryNext).toBe(EXTRA_CHECK_COPY.nextOne);
    expect(x.tryAgain).toBe(EXTRA_CHECK_COPY.retry);
    expect(x.followDot).toBe(EXTRA_CHECK_COPY.dotFirst);
    expect(x.speakDigits).toBe(EXTRA_CHECK_COPY.digits);
    expect(x.cantHear).toBe(EXTRA_CHECK_COPY.digitsQuiet.text);
    expect(CAPTURE_COPY_DEFAULTS.leave).toEqual({ title: EXTRA_CHECK_COPY.leave.title, body: EXTRA_CHECK_COPY.leave.body, leave: EXTRA_CHECK_COPY.leave.leave, keepGoing: EXTRA_CHECK_COPY.leave.stay });
  });
  it('end screens and primers read exactly as 4.13.0', () => {
    expect(endScreenCopy('approved', 'Acme').body).toBe('Thanks. You can carry on in Acme.');
    expect(endScreenCopy('approved', null).body).toBe('Thanks. You can carry on now.');
    expect(endScreenCopy('review', null).body).toBe("This can take a few minutes. You'll be told the result.");
    expect(endScreenCopy('rejected', 'Acme').body).toBe('Please contact Acme for help.');
    expect(endScreenCopy('rejected', null).body).toBe('Please contact the service you are verifying with for help.');
    expect(endScreenCopy('rejected_retry').tips).toEqual(['Face a window or a lamp', 'Hold your phone at eye level']);
    expect(primerCopy('speak_phrase').body).toBe('A selfie scan, then say a few numbers out loud. About 10 seconds.');
    expect(headTurnTitle('down', false).text).toBe('Now look down');
    expect(extraCheckSentence('speak_phrase')).toBe("Say the numbers you see out loud. We'll need your microphone.");
    expect(inlineStepUpGuidance('flash')).toMatchObject({ text: 'Hold still', sub: 'The screen will change colour' });
  });
});

describe('overrides', () => {
  const S = new CaptureStrings({
    primer: { selfieTitle: 'Verify it is you', selfieTips: ['Tip A', '  '] },
    guidance: { closer: 'Come closer', dark: '' },
    extraCheck: { headTurn: 'Gira la cabeza {side}', headTurnNext: '   ', sheetBody: 'Turn {side} please', tryNext: 'Next {unknown}' },
    result: { approvedBody: 'Back to {app}', rejectedBody: 'Call {app}' },
    leave: { keepGoing: 'Stay' },
    upload: { title: '\t' },
  }, 'Acme Bank', 'Host page');

  it('use a set key', () => {
    expect(S.primer('none').title).toBe('Verify it is you');
    expect(S.gateHint('too_far')).toEqual({ text: 'Come closer' });
    expect(S.t('leave', 'keepGoing')).toBe('Stay');
  });
  it('blank values fall back to the default', () => {
    expect(S.gateHint('too_dark')).toEqual({ text: 'Find more light', sub: 'Face a window or lamp' });
    expect(S.t('upload', 'title')).toBe("Checking it's you");
    expect(S.headTurn('right', false).text).toBe('Now to the right');
  });
  it('lists drop blank items, and an all-blank list falls back', () => {
    expect(S.list('primer', 'selfieTips')).toEqual(['Tip A']);
    expect(new CaptureStrings({ primer: { selfieTips: ['', ' '] } }).list('primer', 'selfieTips')).toEqual(CAPTURE_COPY_DEFAULTS.primer.selfieTips);
    expect(new CaptureStrings({ primer: { selfieTips: [] } }).list('primer', 'selfieTips')).toEqual(CAPTURE_COPY_DEFAULTS.primer.selfieTips);
  });
  it('{side} is filled as the SDK words it, for every direction', () => {
    expect(S.headTurn('left', true)).toEqual({ text: 'Gira la cabeza to the left', sub: 'Slowly' });
    expect(S.headTurn('up', true).text).toBe('Gira la cabeza up');
    expect(S.sheetBody('head_turn', ['center', 'right'])).toBe('Turn to the right please');
  });
  it('{app} is the display name; unknown placeholders render literally', () => {
    expect(S.t('result', 'approvedBody')).toBe('Back to Acme Bank');
    expect(S.t('extraCheck', 'tryNext')).toBe('Next {unknown}');
    expect(fillPlaceholders('{app} {side} {x}', { app: 'A' })).toBe('A {side} {x}');
  });
  it('{app} without a display name uses the host page name', () => {
    const N = new CaptureStrings({ result: { approvedBody: 'Back to {app}' } }, null, 'Host page');
    expect(N.t('result', 'approvedBody')).toBe('Back to Host page');
    // A default string without a display name keeps the shipped no-name wording.
    expect(N.t('result', 'reviewBody')).toBe("This can take a few minutes. You'll be told the result.");
  });
  it('reach the challenge runner and the paused lines', () => {
    const R = new ChallengeRunner({ kind: 'head_turn', steps: [{ direction: 'left', duration_ms: 1500, index: 0 }] as never }, 1, S);
    R.advance({ now: 0, faceOk: true, yaw: 0, pitch: 0, held: false, hint: null });
    R.advance({ now: 100, faceOk: true, yaw: 0, pitch: 0, held: false, hint: null });
    expect(R.display().text).toBe('Gira la cabeza to the left');
    expect(challengePausedSub('follow_dot', new CaptureStrings({ extraCheck: { pausedDot: 'Wait' } }))).toBe('Wait');
  });
});

describe('paused turn keys (Android A03 parity)', () => {
  it('pausedTurnSide fills {side} for every direction once set; pausedLookCentre for centre steps', () => {
    const S = new CaptureStrings({ extraCheck: { pausedTurnSide: 'Sigue girando {side}', pausedLookCentre: 'Mira al frente' } });
    expect(S.pausedTurn('left')).toBe('Sigue girando to the left');
    expect(S.pausedTurn('up')).toBe('Sigue girando up');
    expect(S.pausedTurn('center')).toBe('Mira al frente');
    expect(S.pausedTurn(null)).toBe('Then keep turning');
  });
  it('a paused runner shows the step direction', () => {
    const R = new ChallengeRunner({ kind: 'head_turn', steps: [{ direction: 'right', duration_ms: 1500, index: 0 }] as never });
    R.advance({ now: 0, faceOk: true, yaw: 0, pitch: 0, held: false, hint: null });
    R.advance({ now: 100, faceOk: false, yaw: 0, pitch: 0, held: false, hint: null });
    R.advance({ now: 600, faceOk: false, yaw: 0, pitch: 0, held: false, hint: null });
    expect(R.display()).toMatchObject({ paused: true, sub: 'Then keep turning to the right' });
  });
});

describe('merging layers', () => {
  it('code over dashboard key by key; blank code keeps the dashboard value', () => {
    const m = mergeCaptureCopy({ result: { approvedTitle: 'Done!', reviewTitle: '' } }, { result: { reviewTitle: 'Under review', approvedTitle: 'X' }, leave: { title: 'Leave?' } });
    expect(m).toEqual({ result: { approvedTitle: 'Done!', reviewTitle: 'Under review' }, leave: { title: 'Leave?' } });
  });
  it('mergeCopy carries the capture group', () => {
    expect(mergeCopy({ capture: { leave: { leave: 'Go' } } }, { capture: { leave: { body: 'Sure?' } } })?.capture).toEqual({ leave: { leave: 'Go', body: 'Sure?' } });
  });
});

describe('the screens render the copy', () => {
  const html = (el: React.ReactElement) => renderToStaticMarkup(el);
  it('end page, with the brand header and Powered by Sense', () => {
    const out = html(<CapturePreview screen="approved" displayName="Acme Bank" copy={{ capture: { result: { approvedTitle: 'All set' } } }} />);
    expect(out).toContain('All set');
    expect(out).toContain('Thanks. You can carry on in Acme Bank.');
    expect(out).toContain('class="usesense-xc-header-name"');
    expect(out).toContain('Powered by Sense');
  });
  it('leave dialog and upload sheet', () => {
    expect(html(<CapturePreview screen="leave" copy={{ capture: { leave: { title: 'Quit?' } } }} />)).toContain('Quit?');
    expect(html(<CapturePreview screen="upload" branding={{ copy: { capture: { upload: { caption: 'One moment' } } } }} />)).toContain('One moment');
  });
  it('appearance.icons replaces the result tile; placement none hides the header', () => {
    const out = html(<CapturePreview screen="rejected" appearance={{ icons: { notVerified: 'https://a/x.svg' }, logo: { placement: 'none' } }} displayName="Acme" />);
    expect(out).toContain('src="https://a/x.svg"');
    expect(out).not.toContain('class="usesense-xc-header');
  });
});
