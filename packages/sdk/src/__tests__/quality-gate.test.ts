import { describe, it, expect } from 'vitest';
import {
  QualityGate,
  HintScheduler,
  GATE_CHECKS,
  GATE_HINTS,
  GATE_THRESHOLDS,
  HINT_TIMING,
  CAPTURE_COLOR_DEFAULTS,
  allInsideEllipse,
  expectedFaceCentre,
  maxEllipseRadius,
  anchorJitter,
  contrastRatio,
  evaluatePixelOnlyGate,
  eyeDistance,
  faceAreaStats,
  hintFor,
  hintableResult,
  poseFromMatrix,
  referenceFrameWidth,
  resolveCaptureColors,
  type Ellipse,
  type GateFrameInput,
  type GateResult,
  type Point2,
} from '../capture/quality-gate';
import { buildDepthField, captureOval, gaussBlur } from '../capture/contour-scan';
import { coverMapper } from '../capture/gate-dom';
import { pickSubjectFace } from '../capture/media-pipe';

// ── Fixtures ────────────────────────────────────────────────────────────

const OVAL: Ellipse = { cx: 200, cy: 300, rx: 144, ry: 160 };
// referenceFrameWidth(OVAL) = 288 / 0.72 = 400 px
// referenceFrameWidth(OVAL) = 240 / 0.6 -> now 240 / 0.72

/**
 * 478 points in a small ellipse centred in the oval. Iris centres (468, 473)
 * are `eyePx` apart, so eyeRatio = eyePx / 400.
 */
function face(opts: { dx?: number; dy?: number; scale?: number; eyePx?: number } = {}): Point2[] {
  const { dx = 0, dy = 0, scale = 1, eyePx = 92 } = opts;
  const pts: Point2[] = [];
  for (let i = 0; i < 478; i++) {
    const a = (i / 478) * Math.PI * 2;
    const r = (i % 7) / 7;
    pts.push({ x: OVAL.cx + dx + Math.cos(a) * 80 * scale * r, y: OVAL.cy + dy + Math.sin(a) * 110 * scale * r });
  }
  // Forehead/chin and cheeks, symmetric about the face centre.
  pts[10] = { x: OVAL.cx + dx, y: OVAL.cy + dy - 110 * scale };
  pts[152] = { x: OVAL.cx + dx, y: OVAL.cy + dy + 110 * scale };
  pts[234] = { x: OVAL.cx + dx - 80 * scale, y: OVAL.cy + dy };
  pts[454] = { x: OVAL.cx + dx + 80 * scale, y: OVAL.cy + dy };
  pts[468] = { x: OVAL.cx + dx - eyePx / 2, y: OVAL.cy + dy - 30 };
  pts[473] = { x: OVAL.cx + dx + eyePx / 2, y: OVAL.cy + dy - 30 };
  return pts;
}

const FRONTAL = { yaw: 0, pitch: 0, roll: 0 };
const GOOD_PIXELS = { meanLuma: 130, clippedFraction: 0.01, sharpness: 60 };

function input(now: number, over: Partial<GateFrameInput> = {}): GateFrameInput {
  return {
    now,
    faceCount: 1,
    screenLandmarks: face(),
    oval: OVAL,
    pose: FRONTAL,
    eyeBlink: { left: 0.1, right: 0.1 },
    pixels: GOOD_PIXELS,
    ...over,
  };
}

/** Run a gate with a still, good face for `ms`, returning the last result. */
function settle(gate: QualityGate, ms = 400, over: Partial<GateFrameInput> = {}): GateResult {
  let r!: GateResult;
  for (let t = 0; t <= ms; t += 33) r = gate.evaluate(input(t, over));
  return r;
}

// ── Gate ────────────────────────────────────────────────────────────────

describe('QualityGate', () => {
  it('passes a framed, frontal, lit, sharp, open-eyed, still face', () => {
    const r = settle(new QualityGate());
    expect(r.allPass).toBe(true);
    expect(r.firstFailing).toBeNull();
    for (const c of GATE_CHECKS) expect(r.checks[c]).not.toBe('fail');
    expect(r.measurements.eyeRatio).toBeCloseTo(92 / 400, 5);
  });

  it('needs one face for 3 frames in a row', () => {
    const g = new QualityGate();
    expect(g.evaluate(input(0)).checks.face).toBe('fail');
    expect(g.evaluate(input(33)).checks.face).toBe('fail');
    expect(g.evaluate(input(66)).checks.face).toBe('pass');
    // Losing the face resets the streak.
    expect(g.evaluate(input(99, { faceCount: 0, screenLandmarks: undefined })).firstFailing).toBe('face');
    expect(g.evaluate(input(132)).checks.face).toBe('fail');
  });

  it('blocks a second face', () => {
    const r = settle(new QualityGate(), 400, { faceCount: 2 });
    expect(r.firstFailing).toBe('one_person');
  });

  it('requires the face silhouette inside the oval with 15% slack', () => {
    const off = settle(new QualityGate(), 400, { screenLandmarks: face({ dx: 110 }) });
    expect(off.firstFailing).toBe('in_frame');
    expect(off.inFrame).toBe('off_centre');
    expect(hintFor('in_frame', { inFrame: off.inFrame }).text).toBe('Move your face to the centre');
    expect(allInsideEllipse([{ x: OVAL.cx + OVAL.rx * 1.14, y: OVAL.cy }], OVAL, GATE_THRESHOLDS.ovalSlack)).toBe(true);
    expect(allInsideEllipse([{ x: OVAL.cx + OVAL.rx * 1.16, y: OVAL.cy }], OVAL, GATE_THRESHOLDS.ovalSlack)).toBe(false);
  });

  it('only checks the FACE_OVAL silhouette, not every landmark', () => {
    const lm = face();
    lm[468] = { x: OVAL.cx - 46, y: OVAL.cy - 30 };
    lm[1] = { x: OVAL.cx + OVAL.rx * 1.5, y: OVAL.cy }; // nose tip is not a silhouette point
    expect(settle(new QualityGate(), 400, { screenLandmarks: lm }).checks.in_frame).toBe('pass');
  });

  it('calls a face at the expected centre that spills past 1.15 too close: "Move back a little"', () => {
    // Expected face centre = (cx, cy + 0.25 ry). Eye ratio stays inside the band.
    const dy = 0.25 * OVAL.ry;
    const big = settle(new QualityGate(), 400, { screenLandmarks: face({ scale: 1.8, dy }) });
    expect(big.checks.distance).toBe('pass');
    expect(big.firstFailing).toBe('in_frame');
    expect(big.measurements.ovalFit!).toBeGreaterThan(GATE_THRESHOLDS.ovalSlack);
    expect(big.measurements.centreOffset!).toBeLessThanOrEqual(0.08);
    expect(big.inFrame).toBe('too_close');
    expect(hintFor('in_frame', { inFrame: big.inFrame })).toEqual({ id: 'too_close', text: 'Move back a little' });
  });

  it('a spilling face centred on the oval centre (not the expected centre) is off-centre', () => {
    const atOvalCentre = settle(new QualityGate(), 400, { screenLandmarks: face({ scale: 1.8 }) });
    expect(atOvalCentre.inFrame).toBe('off_centre');
    expect(atOvalCentre.measurements.centreOffset!).toBeCloseTo(0.25, 6);
    // 8% applies to each axis separately.
    const sideways = settle(new QualityGate(), 400, { screenLandmarks: face({ scale: 1.8, dy: 0.25 * OVAL.ry, dx: 0.09 * OVAL.rx }) });
    expect(sideways.inFrame).toBe('off_centre');
  });

  it('checks distance as eye distance / frame width, 0.17 to 0.32', () => {
    const far = settle(new QualityGate(), 400, { screenLandmarks: face({ eyePx: 0.16 * 400 }) });
    expect(far.firstFailing).toBe('distance');
    expect(far.distance).toBe('too_far');
    const close = settle(new QualityGate(), 400, { screenLandmarks: face({ eyePx: 0.33 * 400 }) });
    expect(close.firstFailing).toBe('distance');
    expect(close.distance).toBe('too_close');
    expect(settle(new QualityGate(), 400, { screenLandmarks: face({ eyePx: 0.18 * 400 }) }).checks.distance).toBe('pass');
    expect(settle(new QualityGate(), 400, { screenLandmarks: face({ eyePx: 0.315 * 400 }) }).checks.distance).toBe('pass');
    // Distance runs before in-frame: a too-close face gets size guidance.
    const both = settle(new QualityGate(), 400, { screenLandmarks: face({ eyePx: 0.33 * 400, dx: 110 }) });
    expect(both.firstFailing).toBe('distance');
  });

  it('uses the oval to define frame width so a phone gets the spec band exactly', () => {
    // Phone layout: rx = 0.36 W on a full-width preview.
    expect(referenceFrameWidth(captureOval(390, 844))).toBeCloseTo(390, 6);
    // Desktop: the oval sits in a phone-shaped column, not the 1280 px frame.
    expect(referenceFrameWidth(captureOval(1280, 800))).toBeCloseTo((800 * 390) / 844, 6);
  });

  it('checks pose against |yaw|<15, |pitch|<15, |roll|<12', () => {
    expect(settle(new QualityGate(), 400, { pose: { yaw: 16, pitch: 0, roll: 0 } }).firstFailing).toBe('pose');
    expect(settle(new QualityGate(), 400, { pose: { yaw: 0, pitch: -16, roll: 0 } }).firstFailing).toBe('pose');
    expect(settle(new QualityGate(), 400, { pose: { yaw: 0, pitch: 0, roll: 12.5 } }).firstFailing).toBe('pose');
    expect(settle(new QualityGate(), 400, { pose: { yaw: 14, pitch: 14, roll: 11 } }).checks.pose).toBe('pass');
  });

  it('checks face-area light 70 to 200 with < 8% clipped', () => {
    const dark = settle(new QualityGate(), 400, { pixels: { ...GOOD_PIXELS, meanLuma: 60 } });
    expect(dark.firstFailing).toBe('light');
    expect(dark.light).toBe('too_dark');
    const bright = settle(new QualityGate(), 400, { pixels: { ...GOOD_PIXELS, meanLuma: 210 } });
    expect(bright.light).toBe('too_bright');
    const clipped = settle(new QualityGate(), 400, { pixels: { ...GOOD_PIXELS, clippedFraction: 0.09 } });
    expect(clipped.light).toBe('too_bright');
  });

  it('checks sharpness, then eyes open (both blinks < 0.6)', () => {
    expect(settle(new QualityGate(), 400, { pixels: { ...GOOD_PIXELS, sharpness: 2 } }).firstFailing).toBe('sharpness');
    expect(settle(new QualityGate(), 400, { eyeBlink: { left: 0.7, right: 0.1 } }).firstFailing).toBe('eyes');
    // Without blendshapes the check is unknown, which does not block.
    expect(settle(new QualityGate(), 400, { eyeBlink: undefined }).checks.eyes).toBe('unknown');
  });

  it('reuses the last pixel stats on frames where pixels were not sampled', () => {
    const g = new QualityGate();
    settle(g, 400, { pixels: { ...GOOD_PIXELS, meanLuma: 50 } });
    expect(g.evaluate(input(500, { pixels: undefined })).checks.light).toBe('fail');
  });

  it('fails stillness until a 300 ms window is filled, then measures jitter', () => {
    const g = new QualityGate();
    let r!: GateResult;
    for (let t = 0; t < 200; t += 33) r = g.evaluate(input(t));
    expect(r.checks.stillness).toBe('fail');
    r = settle(g, 600);
    expect(r.checks.stillness).toBe('pass');
    // Shaking by 10% of eye distance fails.
    const shaky = new QualityGate();
    for (let t = 0; t <= 600; t += 33) {
      r = shaky.evaluate(input(t, { screenLandmarks: face({ dx: (t / 33) % 2 ? 9 : -9 }) }));
    }
    expect(r.firstFailing).toBe('stillness');
    expect(r.measurements.jitter!).toBeGreaterThan(GATE_THRESHOLDS.maxJitter);
  });

  it('treats light as advice only: it never blocks, sharpness is still judged', () => {
    const dark = settle(new QualityGate(), 400, { pixels: { ...GOOD_PIXELS, meanLuma: 40 } });
    expect(dark.checks.light).toBe('fail');
    expect(dark.light).toBe('too_dark');
    expect(dark.firstFailing).toBe('light');
    expect(dark.firstBlocking).toBeNull();
    expect(dark.allPass).toBe(true);
    // Blur in the dark still blocks.
    const darkBlur = settle(new QualityGate(), 400, { pixels: { meanLuma: 40, clippedFraction: 0, sharpness: 2 } });
    expect(darkBlur.firstBlocking).toBe('sharpness');
    expect(darkBlur.allPass).toBe(false);
    // Without MediaPipe too.
    expect(evaluatePixelOnlyGate({ ...GOOD_PIXELS, meanLuma: 30 }, 1).allPass).toBe(true);
  });

  it('widens the distance band to 0.15-0.34 once scanning (hysteresis)', () => {
    const at = (ratio: number, scanning: boolean) => {
      const g = new QualityGate();
      let r!: GateResult;
      for (let t = 0; t <= 400; t += 33) r = g.evaluate(input(t, { screenLandmarks: face({ eyePx: ratio * 400 }) }), { scanning });
      return r.checks.distance;
    };
    expect(at(0.33, false)).toBe('fail');
    expect(at(0.33, true)).toBe('pass');
    expect(at(0.16, false)).toBe('fail');
    expect(at(0.16, true)).toBe('pass');
    expect(at(0.35, true)).toBe('fail');
    expect(at(0.14, true)).toBe('fail');
  });

  it('reports only the highest-priority failure', () => {
    const r = settle(new QualityGate(), 400, {
      faceCount: 2,
      pose: { yaw: 40, pitch: 0, roll: 0 },
      pixels: { meanLuma: 10, clippedFraction: 0, sharpness: 0 },
    });
    expect(r.firstFailing).toBe('one_person');
  });
});

describe('expectedFaceCentre', () => {
  it('sits a quarter of ry below the oval centre', () => {
    expect(expectedFaceCentre(OVAL)).toEqual({ x: OVAL.cx, y: OVAL.cy + 0.25 * OVAL.ry });
  });
});

describe('maxEllipseRadius', () => {
  it('is 1 on the oval and reported as ovalFit', () => {
    expect(maxEllipseRadius([{ x: OVAL.cx + OVAL.rx, y: OVAL.cy }], OVAL)).toBeCloseTo(1, 6);
    expect(maxEllipseRadius([{ x: OVAL.cx, y: OVAL.cy + OVAL.ry * 1.2 }], OVAL)).toBeCloseTo(1.2, 6);
    const r = settle(new QualityGate());
    expect(r.measurements.ovalFit!).toBeLessThan(GATE_THRESHOLDS.ovalSlack);
  });
});

describe('anchorJitter', () => {
  it('is the mean over anchors of the max distance from the anchor mean', () => {
    const s = [{ pts: [{ x: 0, y: 0 }, { x: 0, y: 0 }] }, { pts: [{ x: 2, y: 0 }, { x: 0, y: 0 }] }];
    // Anchor 0: mean x=1, max dist 1. Anchor 1: 0. Mean = 0.5.
    expect(anchorJitter(s)).toBeCloseTo(0.5, 6);
  });
});

describe('eyeDistance', () => {
  it('uses iris centres and falls back to eye-corner midpoints on 468 points', () => {
    expect(eyeDistance(face({ eyePx: 100 }))).toBeCloseTo(100, 6);
    const lm = face().slice(0, 468);
    lm[33] = { x: 0, y: 0 }; lm[133] = { x: 10, y: 0 };
    lm[362] = { x: 50, y: 0 }; lm[263] = { x: 60, y: 0 };
    expect(eyeDistance(lm)).toBeCloseTo(50, 6);
  });
});

describe('poseFromMatrix', () => {
  const rowMajor = (R: number[][]) => [
    R[0][0], R[0][1], R[0][2], 0,
    R[1][0], R[1][1], R[1][2], 0,
    R[2][0], R[2][1], R[2][2], 0,
    0, 0, 0, 1,
  ];
  const rad = (d: number) => (d * Math.PI) / 180;
  it('is zero for the identity', () => {
    const p = poseFromMatrix(rowMajor([[1, 0, 0], [0, 1, 0], [0, 0, 1]]));
    expect(Math.abs(p.yaw) + Math.abs(p.pitch) + Math.abs(p.roll)).toBeCloseTo(0, 6);
  });
  it('reads a turn about Y as yaw, about X as pitch, about Z as roll', () => {
    const a = rad(20);
    const ry = [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
    expect(poseFromMatrix(rowMajor(ry)).yaw).toBeCloseTo(20, 4);
    const rx = [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
    expect(poseFromMatrix(rowMajor(rx)).pitch).toBeCloseTo(20, 4);
    const rz = [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
    expect(poseFromMatrix(rowMajor(rz)).roll).toBeCloseTo(20, 4);
  });
});

describe('faceAreaStats', () => {
  it('measures mean, clipped fraction and Laplacian variance', () => {
    const w = 16, h = 16;
    const flat = new Float32Array(w * h).fill(100);
    const f = faceAreaStats(flat, w, h);
    expect(f.meanLuma).toBeCloseTo(100, 6);
    expect(f.clippedFraction).toBe(0);
    expect(f.sharpness).toBeCloseTo(0, 6);
    const checker = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) checker[i] = ((i % w) + Math.floor(i / w)) % 2 ? 255 : 0;
    const c = faceAreaStats(checker, w, h);
    expect(c.clippedFraction).toBeCloseTo(0.5, 2);
    expect(c.sharpness).toBeGreaterThan(1000);
  });
});

describe('evaluatePixelOnlyGate (MediaPipe unavailable)', () => {
  it('blocks on light, sharpness and motion', () => {
    expect(evaluatePixelOnlyGate(GOOD_PIXELS, 1).allPass).toBe(true);
    expect(evaluatePixelOnlyGate({ ...GOOD_PIXELS, meanLuma: 30 }, 1).light).toBe('too_dark');
    expect(evaluatePixelOnlyGate(GOOD_PIXELS, 20).firstFailing).toBe('stillness');
    expect(evaluatePixelOnlyGate(undefined, undefined).allPass).toBe(true);
  });
});

// ── Hints ───────────────────────────────────────────────────────────────

function failing(...ids: GateResult['firstFailing'][]): GateResult {
  const checks = Object.fromEntries(GATE_CHECKS.map((c) => [c, ids.includes(c) ? 'fail' : 'pass'])) as GateResult['checks'];
  const firstFailing = GATE_CHECKS.find((c) => checks[c] === 'fail') ?? null;
  const firstBlocking = GATE_CHECKS.find((c) => checks[c] === 'fail' && c !== 'light') ?? null;
  return { checks, firstFailing, firstBlocking, allPass: firstBlocking === null, measurements: {} };
}
const copy = (c: Parameters<typeof hintFor>[0]) => hintFor(c, {});

describe('hintableResult', () => {
  it('drops the light advice mid-scan and while the fill light settles, and keeps it otherwise', () => {
    const r = failing('light', 'stillness');
    expect(hintableResult(r, { scanning: false, fillLightSettling: false }).firstFailing).toBe('light');
    expect(hintableResult(r, { scanning: true, fillLightSettling: false }).firstFailing).toBe('stillness');
    expect(hintableResult(r, { scanning: false, fillLightSettling: true }).firstFailing).toBe('stillness');
    expect(hintableResult(failing('light'), { scanning: true, fillLightSettling: false }).firstFailing).toBeNull();
  });
});

describe('HintScheduler', () => {
  it('waits 400 ms of continuous failure before showing a hint', () => {
    const s = new HintScheduler();
    expect(s.update(failing('pose'), 0, copy)).toBeNull();
    expect(s.update(failing('pose'), 399, copy)).toBeNull();
    expect(s.update(failing('pose'), 400, copy)?.text).toBe(GATE_HINTS.pose);
  });

  it('restarts the onset clock when the check recovers', () => {
    const s = new HintScheduler();
    s.update(failing('pose'), 0, copy);
    s.update(failing(), 300, copy);
    expect(s.update(failing('pose'), 350, copy)).toBeNull();
    expect(s.update(failing('pose'), 749, copy)).toBeNull();
    expect(s.update(failing('pose'), 750, copy)?.id).toBe('pose');
  });

  it('keeps a hint up at least 1.2 s, then switches to the highest failing check', () => {
    const s = new HintScheduler();
    s.update(failing('stillness'), 0, copy);
    expect(s.update(failing('stillness'), 400, copy)?.id).toBe('stillness');
    // A higher-priority check starts failing and the old one recovers.
    s.update(failing('face'), 500, copy);
    expect(s.update(failing('face'), 1000, copy)?.id).toBe('stillness');
    expect(s.update(failing('face'), 400 + HINT_TIMING.minVisibleMs - 1, copy)?.id).toBe('stillness');
    expect(s.update(failing('face'), 400 + HINT_TIMING.minVisibleMs, copy)?.id).toBe('face');
  });

  it('clears after the minimum when nothing fails', () => {
    const s = new HintScheduler();
    s.update(failing('eyes'), 0, copy);
    s.update(failing('eyes'), 400, copy);
    expect(s.update(failing(), 800, copy)?.id).toBe('eyes');
    expect(s.update(failing(), 1600, copy)).toBeNull();
  });

  it('never changes the visible hint twice within 1.2 s (aria-live rate limit)', () => {
    const s = new HintScheduler();
    const order: GateResult['firstFailing'][] = ['face', 'pose', 'light', 'stillness', null];
    let last: string | null = null;
    let lastChange = -Infinity;
    for (let t = 0; t < 10000; t += 16) {
      const id = order[Math.floor(t / 230) % order.length];
      const h = s.update(id ? failing(id) : failing(), t, copy);
      const cur = h?.id ?? null;
      if (cur !== last) {
        if (cur !== null && last !== null) expect(t - lastChange).toBeGreaterThanOrEqual(HINT_TIMING.minVisibleMs);
        if (cur !== null) lastChange = t;
        last = cur;
      }
    }
  });

  it('reports a sustained failure only after the onset', () => {
    const s = new HintScheduler();
    s.update(failing('pose'), 0, copy);
    expect(s.hasSustainedFailure(100)).toBe(false);
    s.update(failing('pose'), 400, copy);
    expect(s.hasSustainedFailure(400)).toBe(true);
  });
});

describe('hint copy', () => {
  it('matches the v1.1 copy table', () => {
    expect(copy('face').text).toBe('Show your face in the oval');
    expect(copy('one_person').text).toBe('Only you in the picture');
    expect(copy('in_frame').text).toBe('Move your face to the centre');
    expect(hintFor('distance', { distance: 'too_far' }).text).toBe('Move a little closer');
    expect(hintFor('distance', { distance: 'too_close' }).text).toBe('Move back a little');
    expect(copy('pose').text).toBe('Look straight ahead');
    expect(hintFor('light', { light: 'too_dark' })).toEqual({ id: 'too_dark', text: 'Find more light', sub: 'Face a window or lamp' });
    expect(hintFor('light', { light: 'too_bright' })).toEqual({ id: 'too_bright', text: 'Too much light behind you', sub: 'Turn away from the window' });
    expect(copy('sharpness').text).toBe('Hold your phone steady');
    expect(copy('eyes').text).toBe('Keep your eyes open');
    expect(copy('stillness').text).toBe('Hold still');
    expect(GATE_HINTS.shutter).toBe("Tap the button when you're ready");
    // Only light guidance has a second line.
    for (const c of GATE_CHECKS) {
      if (c === 'light') continue;
      expect(hintFor(c, { distance: 'too_far' }).sub).toBeUndefined();
    }
  });
});

// ── Colours ─────────────────────────────────────────────────────────────

describe('resolveCaptureColors', () => {
  it('uses the Sense defaults with no overrides', () => {
    expect(resolveCaptureColors()).toEqual(CAPTURE_COLOR_DEFAULTS);
  });
  it('defaults all pass 3:1 on the camera reference #333333', () => {
    for (const c of Object.values(CAPTURE_COLOR_DEFAULTS)) expect(contrastRatio(c, '#333333')).toBeGreaterThanOrEqual(3);
  });
  it('accepts a readable custom colour and rejects a low-contrast or invalid one', () => {
    const r = resolveCaptureColors({ ring: '#00D4AA', challenge: '#222244', warning: '#fff' });
    expect(r.ring).toBe('#00D4AA');
    expect(r.challenge).toBe(CAPTURE_COLOR_DEFAULTS.challenge);
    expect(r.warning).toBe('#fff');
    expect(resolveCaptureColors({ warning: 'not-a-colour' }).warning).toBe(CAPTURE_COLOR_DEFAULTS.warning);
  });
});

// ── Contour + mapping ───────────────────────────────────────────────────

describe('buildDepthField', () => {
  // A synthetic 478-point face: a dome of points, nose (index 1) nearest.
  function synthFace(cx: number, cy: number, w: number, h: number) {
    const lm = [] as { x: number; y: number; z: number }[];
    for (let i = 0; i < 478; i++) {
      const a = (i * 2.399963) % (Math.PI * 2);
      const r = Math.sqrt((i + 0.5) / 478);
      const x = cx + Math.cos(a) * r * w / 2, y = cy + Math.sin(a) * r * h / 2;
      lm.push({ x, y, z: r * r * 0.1 });
    }
    lm[1] = { x: cx, y: cy, z: -0.05 };
    lm[10] = { x: cx, y: cy - h / 2, z: 0.1 };
    lm[152] = { x: cx, y: cy + h / 2, z: 0.1 };
    lm[234] = { x: cx - w / 2, y: cy, z: 0.1 };
    lm[454] = { x: cx + w / 2, y: cy, z: 0.1 };
    return lm;
  }
  it('lifts over the head, is flat far away, and is smooth', () => {
    const W = 390, H = 844, cols = 96, rows = Math.round(96 * H / W), cell = W / cols;
    const { field, faceH } = buildDepthField(synthFace(195, 340, 200, 260), cols, rows, cell);
    expect(faceH).toBeCloseTo(260, 6);
    const at = (x: number, y: number) => field[Math.floor(y / cell) * cols + Math.floor(x / cell)];
    expect(at(195, 340)).toBeGreaterThan(0.6);
    expect(at(10, 800)).toBe(0);
    // Above the forehead, inside the dome: lines lift over the hair.
    expect(at(195, 340 - 150)).toBeGreaterThan(0.1);
    // No cell-to-cell jumps (the old field rippled).
    let maxStep = 0;
    for (let y = 0; y < rows; y++) for (let x = 1; x < cols; x++) {
      maxStep = Math.max(maxStep, Math.abs(field[y * cols + x] - field[y * cols + x - 1]));
    }
    expect(maxStep).toBeLessThan(0.12);
    for (const v of field) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
  it('gaussBlur preserves a constant field', () => {
    const f = new Float32Array(100).fill(0.5);
    for (const v of gaussBlur(f, 10, 10, 1.8)) expect(v).toBeCloseTo(0.5, 5);
  });
});

describe('coverMapper', () => {
  it('maps a mirrored, object-fit: cover video into the container', () => {
    // 1280x720 video into a 400x800 portrait container: scale = 800/720.
    const m = coverMapper(1280, 720, 400, 800, true);
    const centre = m.map(0.5, 0.5);
    expect(centre.x).toBeCloseTo(200, 6);
    expect(centre.y).toBeCloseTo(400, 6);
    // Mirrored: the video's left edge lands on the right.
    expect(m.map(0, 0.5).x).toBeGreaterThan(m.map(1, 0.5).x);
    expect(m.renderedWidth).toBeCloseTo(1280 * (800 / 720), 6);
  });
});

describe('pickSubjectFace', () => {
  it('picks the largest face, not index 0', () => {
    const small = [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }];
    const big = [{ x: 0.3, y: 0.3 }, { x: 0.8, y: 0.9 }];
    expect(pickSubjectFace([small, big])).toBe(1);
    expect(pickSubjectFace([big])).toBe(0);
  });
});
