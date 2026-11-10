import { describe, it, expect } from 'vitest';
import {
  HeadTurnTracker,
  FollowDotTracker,
  QuietDetector,
  EXTRA_CHECK_COPY,
  EXTRA_CHECK_TIMING,
  headOffset,
  turnReached,
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

/** Feed a tracker frames at 30 fps until `until` ms. */
function run<T extends { update(i: any): any }>(t: T, from: number, until: number, input: (now: number) => any) {
  let last: any;
  for (let now = from; now <= until; now += 33) last = t.update({ now, ...input(now) });
  return last;
}

describe('copy', () => {
  it('builds the Head Turn sheet sentence from the sequence', () => {
    expect(headTurnSentence(LR)).toBe('Slowly turn your head to the left, then to the right.');
    expect(headTurnSentence([{ direction: 'right' }])).toBe('Slowly turn your head to the right.');
    expect(headTurnSentence([])).toBe(EXTRA_CHECK_COPY.sheet.head_turn);
  });

  it('uses the storyboard sentences for the sheet', () => {
    expect(extraCheckSentence('follow_dot')).toBe('Keep your face in the oval and follow the dot with your head.');
    expect(extraCheckSentence('head_turn', LR)).toBe('Slowly turn your head to the left, then to the right.');
  });

  it('says the first turn in full and later ones as "Now ..."', () => {
    expect(headTurnTitle('left', true)).toEqual({ text: 'Turn your head to the left', sub: 'Slowly' });
    expect(headTurnTitle('right', false)).toEqual({ text: 'Now to the right' });
    expect(headTurnTitle('up', true).text).toBe('Tilt your head up');
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

describe('headOffset (mirrored screen space)', () => {
  const face = (noseX: number) => {
    const pts = Array.from({ length: 478 }, () => ({ x: 200, y: 400 }));
    pts[234] = { x: 100, y: 400 }; // cheek, screen left
    pts[454] = { x: 300, y: 400 }; // cheek, screen right
    pts[1] = { x: noseX, y: 430 };
    pts[33] = { x: 160, y: 380 }; pts[263] = { x: 240, y: 380 };
    pts[152] = { x: 200, y: 500 };
    return pts;
  };

  it('is 0 facing forward and negative when the nose points to screen left', () => {
    expect(headOffset(face(200))!.x).toBeCloseTo(0);
    expect(headOffset(face(150))!.x).toBeCloseTo(-0.5);
    expect(headOffset(face(260))!.x).toBeCloseTo(0.6);
    expect(headOffset(face(200))!.y).toBeCloseTo(50 / 120);
  });

  it('is null without a full mesh', () => {
    expect(headOffset(null)).toBeNull();
    expect(headOffset([{ x: 1, y: 1 }])).toBeNull();
  });

  it('turnReached matches the side the arrow is on', () => {
    expect(turnReached('left', { x: -0.35, y: 0.45 }, 0.45)).toBe(true);
    expect(turnReached('left', { x: 0.35, y: 0.45 }, 0.45)).toBe(false);
    expect(turnReached('right', { x: 0.35, y: 0.45 }, 0.45)).toBe(true);
    expect(turnReached('up', { x: 0, y: 0.3 }, 0.45)).toBe(true);
    expect(turnReached('down', { x: 0, y: 0.6 }, 0.45)).toBe(true);
    expect(turnReached('center', { x: 0.05, y: 0.45 }, 0.45)).toBe(true);
  });
});

describe('HeadTurnTracker', () => {
  it('turns left then right, filling the ring, then is done', () => {
    const t = new HeadTurnTracker(LR);
    const s1 = run(t, 0, 1600, () => ({ faceOk: true, offset: { x: -0.4, y: 0.45 } }));
    expect(s1.index).toBe(1);
    expect(s1.text).toBe('Now to the right');
    expect(s1.progress).toBeGreaterThanOrEqual(0.5);
    const s2 = run(t, 1633, 3300, () => ({ faceOk: true, offset: { x: 0.4, y: 0.45 } }));
    expect(s2.done).toBe(true);
    expect(s2.progress).toBe(1);
    expect(s2.text).toBe(EXTRA_CHECK_COPY.done);
  });

  it('starts with the full first-turn copy', () => {
    const t = new HeadTurnTracker(LR);
    const s = t.update({ now: 0, faceOk: true, offset: { x: 0, y: 0.45 } });
    expect(s).toMatchObject({ text: 'Turn your head to the left', sub: 'Slowly', capture: true, paused: false });
    expect(t.direction).toBe('left');
  });

  it('pauses when the face leaves the oval, says what to fix, and never fails', () => {
    const t = new HeadTurnTracker(LR);
    run(t, 0, 500, () => ({ faceOk: true, offset: { x: -0.1, y: 0.45 } }));
    const before = t.update({ now: 533, faceOk: true, offset: null }).progress;
    // Out of the oval for 5 s: the clock stops after the 300 ms grace.
    const paused = run(t, 566, 5566, () => ({ faceOk: false, offset: null }));
    expect(paused).toMatchObject({ paused: true, capture: false, text: 'Move your face to the centre', sub: 'Then keep turning', done: false });
    expect(paused.progress - before).toBeLessThan(0.15);
    // Back in the oval: carries on.
    const back = t.update({ now: 5600, faceOk: true, offset: { x: -0.4, y: 0.45 } });
    expect(back.paused).toBe(false);
    expect(back.text).toBe('Turn your head to the left');
  });

  it('gives ONE retry with a hint for a missed turn, then leaves it to the server', () => {
    const t = new HeadTurnTracker(LR);
    const w = HeadTurnTracker.windowMs(LR[0]);
    const retry = run(t, 0, w + 100, () => ({ faceOk: true, offset: { x: -0.1, y: 0.45 } }));
    expect(retry).toMatchObject({ text: "Let's try that again", sub: 'Turn a little further to the left', index: 0 });
    expect(t.retried).toBe(true);
    // Missed again: moves on to the next step (no second retry).
    const next = run(t, w + 133, 2 * w + 300, () => ({ faceOk: true, offset: { x: -0.1, y: 0.45 } }));
    expect(next.index).toBe(1);
    expect(next.text).toBe('Now to the right');
    // The second step missed too: done, no more retries.
    const end = run(t, 2 * w + 333, 3 * w + 600, () => ({ faceOk: true, offset: { x: 0, y: 0.45 } }));
    expect(end.done).toBe(true);
  });

  it('runs on time alone without face tracking', () => {
    const t = new HeadTurnTracker(LR, 1, false);
    const s = run(t, 0, 3300, () => ({ faceOk: true, offset: null }));
    expect(s.done).toBe(true);
  });
});

describe('FollowDotTracker', () => {
  const wps = [
    { index: 0, x: 0.8, y: 0.25, duration_ms: 1000 },
    { index: 1, x: 0.2, y: 0.55, duration_ms: 1000 },
  ];

  it('glides to each waypoint, keeps a trail and ends', () => {
    const t = new FollowDotTracker(wps);
    const s0 = t.update({ now: 0, faceOk: true });
    expect(s0.text).toBe('Follow the dot with your head');
    run(t, 33, 600, () => ({ faceOk: true }));
    expect(t.dot.x).toBeCloseTo(0.8, 2);
    const s1 = run(t, 633, 1200, () => ({ faceOk: true }));
    expect(s1.index).toBe(1);
    expect(s1.text).toBe('Keep following');
    expect(t.trail.length).toBeGreaterThanOrEqual(3);
    const end = run(t, 1233, 2200, () => ({ faceOk: true }));
    expect(end.done).toBe(true);
  });

  it('waits in place while the face is lost', () => {
    const t = new FollowDotTracker(wps);
    run(t, 0, 200, () => ({ faceOk: true }));
    const at = { ...t.dot };
    const lost = run(t, 233, 4233, () => ({ faceOk: false }));
    expect(lost).toMatchObject({ paused: true, capture: false, text: 'Show your face in the oval', sub: 'The dot will wait for you', index: 0 });
    // Within the grace the dot moves a little; then it holds.
    expect(Math.abs(t.dot.x - at.x)).toBeLessThan(0.3);
    const held = { ...t.dot };
    run(t, 4266, 6000, () => ({ faceOk: false }));
    expect(t.dot).toEqual(held);
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

describe('the scan gate during a challenge (same rules as the passive scan)', () => {
  const pass = (over: Partial<Record<string, 'pass' | 'fail' | 'unknown'>> = {}, pose = { yaw: 0, pitch: 0, roll: 0 }) => ({
    checks: {
      face: 'pass', one_person: 'pass', covered: 'pass', distance: 'pass', in_frame: 'pass', pose: 'pass',
      light: 'pass', sharpness: 'pass', eyes: 'pass', stillness: 'pass', ...over,
    },
    firstFailing: null, firstBlocking: null, allPass: true, measurements: { pose },
  }) as any;

  it('keeps every blocking check: covered, one person, distance, in frame, eyes, sharpness', async () => {
    const { relaxGateForChallenge } = await import('../capture/extra-check');
    for (const c of ['face', 'covered', 'one_person', 'distance', 'in_frame', 'eyes', 'sharpness']) {
      const r = relaxGateForChallenge(pass({ [c]: 'fail' }), { kind: 'head_turn', direction: 'left', offset: { x: -0.4, y: 0.45 } });
      expect(r.allPass, c).toBe(false);
      expect(r.firstBlocking, c).toBe(c);
    }
  });

  it('light stays advice only, as in the scan', async () => {
    const { relaxGateForChallenge } = await import('../capture/extra-check');
    expect(relaxGateForChallenge(pass({ light: 'fail' }), { kind: 'follow_dot', dot: { x: 0.5, y: 0.4 } }).allPass).toBe(true);
  });

  it('relaxes pose only toward the side the step asks for', async () => {
    const { relaxGateForChallenge } = await import('../capture/extra-check');
    const turned = pass({ pose: 'fail' }, { yaw: 35, pitch: 3, roll: 4 });
    // Turning left (nose to screen left) on a "left" step: allowed.
    expect(relaxGateForChallenge(turned, { kind: 'head_turn', direction: 'left', offset: { x: -0.5, y: 0.45 } }).allPass).toBe(true);
    // Turning the other way: the scan's limits apply.
    expect(relaxGateForChallenge(turned, { kind: 'head_turn', direction: 'left', offset: { x: 0.5, y: 0.45 } }).firstBlocking).toBe('pose');
    // Centre steps and Speak Digits keep the scan's limits.
    expect(relaxGateForChallenge(turned, { kind: 'head_turn', direction: 'center', offset: { x: -0.5, y: 0.45 } }).firstBlocking).toBe('pose');
    expect(relaxGateForChallenge(turned, { kind: 'speak_phrase', offset: { x: -0.5, y: 0.45 } }).firstBlocking).toBe('pose');
    // Even toward the step, there is a limit.
    const far = pass({ pose: 'fail' }, { yaw: 70, pitch: 0, roll: 0 });
    expect(relaxGateForChallenge(far, { kind: 'head_turn', direction: 'left', offset: { x: -0.9, y: 0.45 } }).firstBlocking).toBe('pose');
    // Follow Dot: toward the dot's side.
    expect(relaxGateForChallenge(turned, { kind: 'follow_dot', dot: { x: 0.2, y: 0.5 }, offset: { x: -0.5, y: 0.45 } }).allPass).toBe(true);
    expect(relaxGateForChallenge(turned, { kind: 'follow_dot', dot: { x: 0.8, y: 0.5 }, offset: { x: -0.5, y: 0.45 } }).firstBlocking).toBe('pose');
  });

  it('applies stillness to Speak Digits only', async () => {
    const { relaxGateForChallenge } = await import('../capture/extra-check');
    const moving = pass({ stillness: 'fail' });
    expect(relaxGateForChallenge(moving, { kind: 'head_turn', direction: 'left' }).allPass).toBe(true);
    expect(relaxGateForChallenge(moving, { kind: 'follow_dot', dot: { x: 0.5, y: 0.4 } }).allPass).toBe(true);
    expect(relaxGateForChallenge(moving, { kind: 'speak_phrase' }).firstBlocking).toBe('stillness');
  });

  it('banks no frames on a failing frame, and pauses after the grace', () => {
    const t = new HeadTurnTracker(LR);
    t.update({ now: 0, faceOk: true, offset: { x: 0, y: 0.45 } });
    const s = t.update({ now: 33, faceOk: false, offset: null });
    expect(s.capture).toBe(false);
    expect(s.paused).toBe(false);
    const p = run(t, 66, 600, () => ({ faceOk: false, offset: null }));
    expect(p).toMatchObject({ paused: true, capture: false });
    const d = new FollowDotTracker([{ index: 0, x: 0.8, y: 0.3, duration_ms: 1000 }]);
    d.update({ now: 0, faceOk: true });
    expect(d.update({ now: 33, faceOk: false }).capture).toBe(false);
  });

  it('pairs the failing check with how to go on', async () => {
    const { challengePausedSub } = await import('../capture/extra-check');
    expect(challengePausedSub('head_turn')).toBe('Then keep turning');
    expect(challengePausedSub('follow_dot')).toBe('The dot will wait for you');
    expect(challengePausedSub('speak_phrase')).toBe('Then say the numbers');
  });
});
