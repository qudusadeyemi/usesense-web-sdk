import { describe, it, expect } from 'vitest';
import {
  ChallengeRunner,
  QuietDetector,
  EXTRA_CHECK_COPY,
  EXTRA_CHECK_TIMING,
  atTurnTarget,
  atDotTarget,
  stepFrameQuota,
  relaxGateForChallenge,
  challengeGateLimits,
  challengePausedSub,
  headTurnSentence,
  headTurnTitle,
  headTurnRetrySub,
  extraCheckSentence,
  meterBars,
  digitsText,
  resultScreen,
  classifyFailure,
  classifyCameraError,
  endScreenCopy,
  primerCopy,
  type EndScreen,
} from '../capture/extra-check';
import type { HeadTurnStep } from '../types';

// The extra check (end-user storyboard flows 4 to 6). Copy is the approved
// copy; no em dashes anywhere.

const LR: HeadTurnStep[] = [
  { index: 0, direction: 'left', duration_ms: 1500 },
  { index: 1, direction: 'right', duration_ms: 1500 },
];

/** Feed the runner frames at 30 fps from `from` to `until` ms. */
function run(r: ChallengeRunner, from: number, until: number, input: (now: number) => Record<string, unknown>) {
  let last: any;
  for (let now = from; now <= until; now += 33) last = r.advance({ now, faceOk: true, ...input(now) } as any);
  return last;
}
// Person's left = negative yaw on the web (measured); up = positive pitch.
const LEFT = { yaw: -25, pitch: 0 }, RIGHT = { yaw: 25, pitch: 0 }, AHEAD = { yaw: 0, pitch: 0 };

describe('copy', () => {
  it('builds the Head Turn sheet sentence from the sequence', () => {
    expect(headTurnSentence(LR)).toBe('Slowly turn your head to the left, then to the right.');
    expect(headTurnSentence([{ direction: 'right' }])).toBe('Slowly turn your head to the right.');
    // Names the first two sides the server asked for (as iOS).
    expect(headTurnSentence([{ direction: 'right' }, { direction: 'up' }, { direction: 'left' }])).toBe('Slowly turn your head to the right, then up.');
    expect(headTurnSentence([])).toBe(EXTRA_CHECK_COPY.sheet.head_turn);
  });

  it('uses the storyboard sentences for the sheet', () => {
    expect(extraCheckSentence('follow_dot')).toBe('Keep your face in the oval and follow the dot with your head.');
    expect(extraCheckSentence('head_turn', LR)).toBe('Slowly turn your head to the left, then to the right.');
  });

  it('says the first turn in full and later ones as "Now ..."', () => {
    expect(headTurnTitle('left', true)).toEqual({ text: 'Turn your head to the left', sub: 'Slowly' });
    expect(headTurnTitle('right', false)).toEqual({ text: 'Now to the right' });
    expect(headTurnTitle('up', true).text).toBe('Look up');
    expect(headTurnTitle('up', false).text).toBe('Now look up');
    expect(headTurnTitle('center', false).text).toBe('Now look straight ahead');
    expect(headTurnRetrySub('left')).toBe('Turn a little further to the left');
  });

  it('follows the dot with the head, not the eyes', () => {
    expect(EXTRA_CHECK_COPY.dotFirst).toBe('Follow the dot with your head');
  });

  it('has no em dashes', () => {
    const all = JSON.stringify(EXTRA_CHECK_COPY) +
      (['approved', 'review', 'rejected_retry', 'rejected', 'camera_denied', 'camera_stopped', 'offline', 'expired', 'mic_denied', 'error'] as EndScreen[])
        .map((s) => JSON.stringify(endScreenCopy(s, 'Acme'))).join('') +
      JSON.stringify(primerCopy('head_turn')) + JSON.stringify(primerCopy('none'));
    expect(all).not.toMatch(/—/);
  });

  it('primer says "Two quick steps" only when the policy has a challenge', () => {
    expect(primerCopy('none').title).toBe('Take a quick selfie');
    expect(primerCopy('head_turn')).toMatchObject({ title: 'Two quick steps', body: 'A selfie scan, then a short movement. About 10 seconds.' });
    expect(primerCopy('follow_dot').title).toBe('Two quick steps');
    expect(primerCopy('speak_phrase').body).toMatch(/numbers/);
  });
});

describe('Speak Digits helpers', () => {
  it('shows "We can\'t hear you" after 2 s of a flat meter, and clears on sound', () => {
    const q = new QuietDetector();
    expect(q.update(0.01, 0)).toBe(false);
    expect(q.update(0.01, EXTRA_CHECK_TIMING.quietMs - 1)).toBe(false);
    expect(q.update(0.01, EXTRA_CHECK_TIMING.quietMs)).toBe(true);
    expect(q.update(0.2, EXTRA_CHECK_TIMING.quietMs + 50)).toBe(false);
  });

  it('draws 9 bars of 4 to 34 px', () => {
    expect(meterBars([])).toEqual(Array(9).fill(4));
    const bars = meterBars([0, 0.05, 0.1, 0.25, 0.5, 1, 0, 0, 0.12]);
    expect(bars).toHaveLength(9);
    expect(Math.min(...bars)).toBe(4);
    expect(Math.max(...bars)).toBe(34);
  });

  it('spaces digits for the pill', () => {
    expect(digitsText('4729')).toBe('4 7 2 9');
    expect(digitsText('4 7 2 9')).toBe('4 7 2 9');
    expect(digitsText('open sesame')).toBe('open sesame');
  });
});

describe('end screens', () => {
  it('maps decisions, offering Try again only when the integrator allows it', () => {
    expect(resultScreen('APPROVE', false)).toBe('approved');
    expect(resultScreen('MANUAL_REVIEW', false)).toBe('review');
    expect(resultScreen('REJECT', false)).toBe('rejected');
    expect(resultScreen('REJECT', true)).toBe('rejected_retry');
    expect(endScreenCopy('rejected_retry').tips).toHaveLength(2);
    expect(endScreenCopy('rejected').secondary).toBeUndefined();
  });

  it('names the app when it has a name', () => {
    expect(endScreenCopy('approved', 'Acme').body).toBe('Thanks. You can carry on in Acme.');
    expect(endScreenCopy('approved', null).body).not.toMatch(/\[App\]/);
  });

  it('says how to allow the camera and microphone in a browser (no Open Settings)', () => {
    expect(endScreenCopy('camera_denied').primary).toBe('Try again');
    expect(endScreenCopy('camera_denied').body).toMatch(/browser/);
    expect(endScreenCopy('mic_denied')).toMatchObject({ title: 'Microphone needed', secondary: 'Do a head movement instead' });
    expect(JSON.stringify(endScreenCopy('mic_denied'))).not.toMatch(/Open Settings/);
  });

  it('classifies failures', () => {
    expect(classifyFailure(Object.assign(new Error('Network unavailable'), { name: 'NetworkError' }), true)).toBe('offline');
    expect(classifyFailure(new Error('Upload failed (500)'), false)).toBe('offline');
    expect(classifyFailure(new Error('Session expired'), true)).toBe('expired');
    expect(classifyFailure(new Error('Upload failed (500)'), true)).toBe('error');
    expect(classifyCameraError({ name: 'NotAllowedError' })).toBe('camera_denied');
    expect(classifyCameraError({ name: 'NotReadableError' })).toBe('camera_stopped');
  });
});

describe('client inline step-up on the guided screen', () => {
  it('runs whenever the policy has not turned it off and the suspicion engine triggered', async () => {
    const { shouldRunInlineStepUp } = await import('../capture/extra-check');
    expect(shouldRunInlineStepUp({ enabled: true }, true)).toBe(true);
    expect(shouldRunInlineStepUp(undefined, true)).toBe(true);
    expect(shouldRunInlineStepUp({ enabled: false }, true)).toBe(false);
    expect(shouldRunInlineStepUp({ enabled: true }, false)).toBe(false);
  });

  it('shows plain guidance with an amber ring while waiting and a green tick when done', async () => {
    const { inlineStepUpGuidance } = await import('../capture/extra-check');
    expect(inlineStepUpGuidance('intro')).toMatchObject({ text: 'One more moment', sub: 'Keep your face in the oval', ring: 'warning', tick: false });
    expect(inlineStepUpGuidance('flash')).toMatchObject({ text: 'Hold still', ring: 'warning' });
    expect(inlineStepUpGuidance('rmas', { label: 'Blink twice', step: 1, total: 3, countdown: 40 }))
      .toEqual({ text: 'Blink twice', sub: '1 of 3', ring: 'warning', progress: 0.4, tick: false });
    expect(inlineStepUpGuidance('complete')).toMatchObject({ text: 'Done', ring: 'done', tick: true });
    expect(inlineStepUpGuidance('idle')).toBeNull();
  });
});

describe('ChallengeRunner: Head Turn, closed loop (iOS parity)', () => {
  it('ends a step only after the pose has held the target for 0.6 s', () => {
    const r = new ChallengeRunner({ kind: 'head_turn', steps: LR });
    expect(run(r, 0, 300, () => AHEAD).text).toBe('Turn your head to the left');
    // Turning, but not held long enough yet.
    run(r, 333, 700, () => LEFT);
    expect(r.stepIndex).toBe(0);
    expect(r.bankReason).toBe('on_target');
    const d = run(r, 733, 1100, () => LEFT);
    expect(r.stepIndex).toBe(1);
    expect(d.text).toBe('Now to the right');
    // Facing ahead on a "right" step: no frames bank (not on target).
    run(r, 1133, 1300, () => AHEAD);
    expect(r.bankReason).toBe('none');
    const end = run(r, 1333, 2200, () => RIGHT);
    expect(end.finished).toBe(true);
    expect(end.progress).toBe(1);
    const ev = r.stepEvents(1000);
    expect(ev.map((e) => e.outcome)).toEqual(['reached', 'reached']);
    expect(ev[0]).toHaveProperty('reaction_ms');
  });

  it('waits for the turn: one hint per challenge, then "Let\'s try the next one" and on', () => {
    const r = new ChallengeRunner({ kind: 'head_turn', steps: LR });
    const hint = run(r, 0, EXTRA_CHECK_TIMING.hintAfterMs + 100, () => AHEAD);
    expect(hint).toMatchObject({ text: "Let's try that again", sub: 'Turn a little further to the left', arrow: 'left' });
    const missed = run(r, EXTRA_CHECK_TIMING.hintAfterMs + 133, 2 * EXTRA_CHECK_TIMING.hintAfterMs + 200, () => AHEAD);
    expect(r.stepIndex).toBe(1);
    expect(missed).toMatchObject({ text: "Let's try the next one", warning: true });
    // The ring fills only for steps done: a missed step leaves its segment empty.
    expect(missed.progress).toBe(0);
    const end = run(r, 2 * EXTRA_CHECK_TIMING.hintAfterMs + 233, 3 * EXTRA_CHECK_TIMING.hintAfterMs + 400, () => AHEAD);
    expect(end.finished).toBe(true);
    expect(r.stepEvents(0).map((e) => [e.outcome, e.hinted])).toEqual([['timed_out', true], ['timed_out', false]]);
  });

  it('pauses (debounced) while the gate fails, names the check, then resumes', () => {
    const r = new ChallengeRunner({ kind: 'head_turn', steps: LR });
    run(r, 0, 300, () => AHEAD);
    expect(r.advance({ now: 333, faceOk: false, hint: { text: 'Keep your face uncovered' } }).paused).toBe(false);
    const p = run(r, 366, 2000, () => ({ faceOk: false, hint: { text: 'Keep your face uncovered' } }));
    expect(p).toMatchObject({ paused: true, warning: true, text: 'Keep your face uncovered', sub: 'Then keep turning to the left', arrow: null });
    expect(r.stepIndex).toBe(0);
    const back = run(r, 2033, 2300, () => AHEAD);
    expect(back.paused).toBe(false);
  });

  it('runs on the server\'s step time with no pose to judge', () => {
    const r = new ChallengeRunner({ kind: 'head_turn', steps: LR });
    const end = run(r, 0, 3300, () => ({ yaw: null, pitch: null }));
    expect(end.finished).toBe(true);
    expect(r.stepEvents(0).map((e) => e.outcome)).toEqual(['timed', 'timed']);
  });

  it('judges turns with the measured signs', () => {
    expect(atTurnTarget('left', -20, 0)).toBe(true);
    expect(atTurnTarget('left', 20, 0)).toBe(false);
    expect(atTurnTarget('right', 20, 0)).toBe(true);
    expect(atTurnTarget('up', 0, 14)).toBe(true);
    expect(atTurnTarget('down', 0, -14)).toBe(true);
    expect(atTurnTarget('center', 4, -3)).toBe(true);
    expect(atTurnTarget('left', null, 0)).toBeNull();
  });
});

describe('ChallengeRunner: Follow Dot, closed loop (iOS parity)', () => {
  const wps = [
    { index: 0, x: 0.5, y: 0.4, duration_ms: 1000 },
    { index: 1, x: 0.85, y: 0.4, duration_ms: 1000 },
    { index: 2, x: 0.2, y: 0.4, duration_ms: 1000 },
  ];

  it('waits at each waypoint until the head moves toward it', () => {
    const r = new ChallengeRunner({ kind: 'follow_dot', waypoints: wps });
    // First waypoint: the glide (0.4 s), then a straight face held 0.6 s (the reference).
    run(r, 0, 1100, () => AHEAD);
    expect(r.stepIndex).toBe(1);
    // The dot moved right; the head stays ahead: the dot waits.
    run(r, 1133, 3000, () => AHEAD);
    expect(r.stepIndex).toBe(1);
    // Following it (person's right = positive yaw): reached.
    run(r, 3033, 3800, () => RIGHT);
    expect(r.stepIndex).toBe(2);
    // The next move (left) is measured from where the head is now (right).
    run(r, 3833, 4300, () => RIGHT);
    expect(r.stepIndex).toBe(2);
    const end = run(r, 4333, 5200, () => AHEAD);
    expect(end.finished).toBe(true);
  });

  it('banks a couple of settled frames once the dot has arrived, even off target', () => {
    const r = new ChallengeRunner({ kind: 'follow_dot', waypoints: wps });
    run(r, 0, 1100, () => AHEAD);
    expect(r.stepIndex).toBe(1);
    run(r, 1133, 1300, () => AHEAD);
    expect(r.bankReason).toBe('none'); // still gliding, head not on it
    run(r, 1333, 2200, () => AHEAD);
    expect(r.bankReason).toBe('settled');
  });

  it('follows the main direction; the other axis may go a little the wrong way', () => {
    const from = { x: 0.5, y: 0.4 };
    // Dot right and a little down: turning right counts; a small upward tilt is tolerated...
    expect(atDotTarget({ x: 0.85, y: 0.55 }, from, 12, 3, 0, 0)).toBe(true);
    // ...a clear tilt the wrong way (up while the dot went down) is not.
    expect(atDotTarget({ x: 0.85, y: 0.55 }, from, 12, 15, 0, 0)).toBe(false);
    // Not far enough along the main direction.
    expect(atDotTarget({ x: 0.85, y: 0.4 }, from, 6, 0, 0, 0)).toBe(false);
    expect(atDotTarget({ x: 0.5, y: 0.1 }, from, 0, 9, 0, 0)).toBe(true); // dot up, head up
    expect(atDotTarget({ x: 0.52, y: 0.42 }, from, 0, 0, 0, 0)).toBe(true); // no real move
  });

  it('waits in place while the gate fails', () => {
    const r = new ChallengeRunner({ kind: 'follow_dot', waypoints: wps });
    run(r, 0, 1100, () => AHEAD);
    run(r, 1133, 1400, () => AHEAD);
    const held = run(r, 1233, 3000, () => ({ faceOk: false }));
    expect(held).toMatchObject({ paused: true, text: 'Show your face in the oval', sub: 'The dot will wait for you' });
    const at = held.dot;
    expect(run(r, 3033, 4000, () => ({ faceOk: false })).dot).toEqual(at);
  });
});

describe('frame budget per step', () => {
  it('gives every step its share of what is left', () => {
    expect(stepFrameQuota(30, 4)).toBe(7);
    expect(stepFrameQuota(3, 4)).toBe(2);
    expect(stepFrameQuota(1, 4)).toBe(1);
    expect(stepFrameQuota(0, 2)).toBe(0);
    expect(stepFrameQuota(9, 0)).toBe(9);
  });
});

describe('the scan gate during a challenge (same rules as the passive scan)', () => {
  const pass = (over: Partial<Record<string, 'pass' | 'fail' | 'unknown'>> = {}, pose = { yaw: 0, pitch: 0, roll: 0 }) => ({
    checks: {
      face: 'pass', one_person: 'pass', covered: 'pass', distance: 'pass', in_frame: 'pass', pose: 'pass',
      light: 'pass', sharpness: 'pass', eyes: 'pass', stillness: 'pass', ...over,
    },
    firstFailing: null, firstBlocking: null, allPass: true, measurements: { pose },
  }) as any;

  it('keeps every blocking check: covered, one person, distance, in frame, eyes', () => {
    for (const c of ['face', 'covered', 'one_person', 'distance', 'in_frame', 'eyes']) {
      const r = relaxGateForChallenge(pass({ [c]: 'fail' }), { kind: 'head_turn', direction: 'left' });
      expect(r.allPass, c).toBe(false);
      expect(r.firstBlocking, c).toBe(c);
    }
  });

  it('light stays advice only, as in the scan', () => {
    expect(relaxGateForChallenge(pass({ light: 'fail' }), { kind: 'follow_dot' }).allPass).toBe(true);
  });

  it('relaxes only pose, per step (iOS ChallengeGateRules)', () => {
    expect(challengeGateLimits('head_turn', 'left')).toMatchObject({ yaw: 50, roll: 20 });
    expect(challengeGateLimits('head_turn', 'up')).toMatchObject({ pitch: 40 });
    expect(challengeGateLimits('head_turn', 'center')).toMatchObject({ yaw: 30, pitch: 30 });
    expect(challengeGateLimits('follow_dot')).toMatchObject({ yaw: 40, pitch: 35 });
    expect(challengeGateLimits('speak_phrase')).toMatchObject({ yaw: 15, pitch: 15, roll: 12, stillness: true });
    const turned = pass({ pose: 'fail' }, { yaw: 35, pitch: 3, roll: 4 });
    expect(relaxGateForChallenge(turned, { kind: 'head_turn', direction: 'left' }).allPass).toBe(true);
    expect(relaxGateForChallenge(turned, { kind: 'head_turn', direction: 'right' }).allPass).toBe(true);
    expect(relaxGateForChallenge(turned, { kind: 'head_turn', direction: 'up' }).firstBlocking).toBe('pose');
    expect(relaxGateForChallenge(turned, { kind: 'speak_phrase' }).firstBlocking).toBe('pose');
    expect(relaxGateForChallenge(pass({ pose: 'fail' }, { yaw: 60, pitch: 0, roll: 0 }), { kind: 'head_turn', direction: 'left' }).firstBlocking).toBe('pose');
  });

  it('applies stillness to Speak Digits only', () => {
    const moving = pass({ stillness: 'fail' });
    expect(relaxGateForChallenge(moving, { kind: 'head_turn', direction: 'left' }).allPass).toBe(true);
    expect(relaxGateForChallenge(moving, { kind: 'follow_dot' }).allPass).toBe(true);
    expect(relaxGateForChallenge(moving, { kind: 'speak_phrase' }).firstBlocking).toBe('stillness');
  });

  it('lets sharpness give way while moving (a dark head turn blurs every frame); Speak Digits keeps it', () => {
    const soft = pass({ sharpness: 'fail' });
    expect(relaxGateForChallenge(soft, { kind: 'head_turn', direction: 'left' }).allPass).toBe(true);
    expect(relaxGateForChallenge(soft, { kind: 'head_turn', direction: 'center' }).allPass).toBe(true);
    expect(relaxGateForChallenge(soft, { kind: 'follow_dot' }).allPass).toBe(true);
    expect(relaxGateForChallenge(soft, { kind: 'speak_phrase' }).firstBlocking).toBe('sharpness');
  });

  it('says which way to keep turning while paused (Android A03 parity)', () => {
    expect(challengePausedSub('head_turn', undefined, 'left')).toBe('Then keep turning to the left');
    expect(challengePausedSub('head_turn', undefined, 'right')).toBe('Then keep turning to the right');
    expect(challengePausedSub('head_turn', undefined, 'up')).toBe('Then keep tilting your head up');
    expect(challengePausedSub('head_turn', undefined, 'down')).toBe('Then keep tilting your head down');
    expect(challengePausedSub('head_turn', undefined, 'center')).toBe('Then look straight ahead');
  });

  it('pairs the failing check with how to go on', () => {
    expect(challengePausedSub('head_turn')).toBe('Then keep turning');
    expect(challengePausedSub('follow_dot')).toBe('The dot will wait for you');
    expect(challengePausedSub('speak_phrase')).toBe('Then say the numbers');
  });
});
