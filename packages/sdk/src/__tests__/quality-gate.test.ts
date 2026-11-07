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
  anchorJitter,
  contrastRatio,
  evaluatePixelOnlyGate,
  eyeDistance,
  faceAreaStats,
  hintFor,
  poseFromMatrix,
  referenceFrameWidth,
  resolveCaptureColors,
  type Ellipse,
  type GateFrameInput,
  type GateResult,
  type Point2,
} from '../capture/quality-gate';
import { rasteriseDepth, DEPTH_GRID } from '../capture/contour-scan';
import { coverMapper } from '../capture/gate-dom';
import { pickSubjectFace } from '../capture/media-pipe';

// ── Fixtures ────────────────────────────────────────────────────────────

const OVAL: Ellipse = { cx: 200, cy: 300, rx: 120, ry: 160 };
// referenceFrameWidth(OVAL) = 240 / 0.6 = 400 px

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

  it('requires every landmark inside the oval with 4% slack', () => {
    expect(settle(new QualityGate(), 400, { screenLandmarks: face({ dx: 70 }) }).firstFailing).toBe('in_frame');
    // A point just past the drawn edge but within 4% passes.
    expect(allInsideEllipse([{ x: OVAL.cx + OVAL.rx * 1.03, y: OVAL.cy }], OVAL, GATE_THRESHOLDS.ovalSlack)).toBe(true);
    expect(allInsideEllipse([{ x: OVAL.cx + OVAL.rx * 1.05, y: OVAL.cy }], OVAL, GATE_THRESHOLDS.ovalSlack)).toBe(false);
  });

  it('checks distance as eye distance / frame width, 0.17 to 0.30', () => {
    const far = settle(new QualityGate(), 400, { screenLandmarks: face({ eyePx: 0.16 * 400 }) });
    expect(far.firstFailing).toBe('distance');
    expect(far.distance).toBe('too_far');
    const close = settle(new QualityGate(), 400, { screenLandmarks: face({ eyePx: 0.31 * 400 }) });
    expect(close.firstFailing).toBe('distance');
    expect(close.distance).toBe('too_close');
    expect(settle(new QualityGate(), 400, { screenLandmarks: face({ eyePx: 0.18 * 400 }) }).checks.distance).toBe('pass');
  });

  it('uses the oval to define frame width so a phone gets the spec band exactly', () => {
    // Mobile layout: the oval is 60vw on a full-width preview.
    expect(referenceFrameWidth({ cx: 0, cy: 0, rx: 0.3 * 375, ry: 200 })).toBeCloseTo(375, 6);
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

  it('reports only the highest-priority failure', () => {
    const r = settle(new QualityGate(), 400, {
      faceCount: 2,
      pose: { yaw: 40, pitch: 0, roll: 0 },
      pixels: { meanLuma: 10, clippedFraction: 0, sharpness: 0 },
    });
    expect(r.firstFailing).toBe('one_person');
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
  return { checks, firstFailing, allPass: firstFailing === null, measurements: {} };
}
const copy = (c: Parameters<typeof hintFor>[0]) => hintFor(c, {});

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
  it('matches the spec', () => {
    expect(copy('face').text).toBe('Show your face in the oval');
    expect(copy('one_person').text).toBe('Only one person in view, please');
    expect(copy('in_frame').text).toBe('Move your face to the centre');
    expect(hintFor('distance', { distance: 'too_far' }).text).toBe('Move closer');
    expect(hintFor('distance', { distance: 'too_close' }).text).toBe('Move back a little');
    expect(copy('pose').text).toBe('Look straight at the screen');
    expect(hintFor('light', { light: 'too_dark', fillLightSettling: true })).toEqual({
      id: 'light_filling', text: 'Brightening your screen', sub: "If it's still dark, face a window or lamp",
    });
    expect(hintFor('light', { light: 'too_dark' }).text).toBe('Face a light');
    expect(copy('sharpness').text).toBe('Hold the phone steady');
    expect(copy('eyes').text).toBe('Keep your eyes open');
    expect(copy('stillness').text).toBe('Hold still');
  });
});

// ── Colours ─────────────────────────────────────────────────────────────

describe('resolveCaptureColors', () => {
  it('uses the Sense defaults with no overrides', () => {
    expect(resolveCaptureColors()).toEqual(CAPTURE_COLOR_DEFAULTS);
  });
  it('defaults all pass 3:1 on the dark camera background', () => {
    for (const c of Object.values(CAPTURE_COLOR_DEFAULTS)) expect(contrastRatio(c, '#1A1A1A')).toBeGreaterThanOrEqual(3);
  });
  it('accepts a readable custom colour and rejects a low-contrast or invalid one', () => {
    const r = resolveCaptureColors({ ring: '#00D4AA', contourStart: '#222244', contourEnd: 'not-a-colour', warning: '#fff' });
    expect(r.ring).toBe('#00D4AA');
    expect(r.contourStart).toBe(CAPTURE_COLOR_DEFAULTS.contourStart);
    expect(r.contourEnd).toBe(CAPTURE_COLOR_DEFAULTS.contourEnd);
    expect(r.warning).toBe('#fff');
  });
});

// ── Contour + mapping ───────────────────────────────────────────────────

describe('rasteriseDepth', () => {
  it('splats depth where landmarks are and leaves the rest flat', () => {
    const box = { x0: 0, y0: 0, w: 100, h: 100 };
    const grid = rasteriseDepth([{ x: 50, y: 50, d: 10 }], box);
    const centre = Math.round(0.5 * (DEPTH_GRID - 1));
    expect(grid[centre * DEPTH_GRID + centre]).toBeGreaterThan(5);
    expect(grid[0]).toBe(0);
    expect(grid.length).toBe(DEPTH_GRID * DEPTH_GRID);
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
