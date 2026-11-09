import { describe, it, expect } from 'vitest';
import { CoverWatch, COVER_WATCH, measureFaceRegions, distinctFaceCount, boxIoU, SAME_FACE_IOU } from '../capture/face-cover';
import { FACE_OVAL, QualityGate, GATE_CHECKS, GATE_HINTS, hintFor, shouldTurnOnFillLight, withCoverWatch, isSteadyForCoverWatch } from '../capture/quality-gate';

/**
 * Synthetic landmarks (no real face): 478 points in normalised frame
 * coordinates, FACE_OVAL on an ellipse centred at (cx, cy) with half-sizes
 * (rx, ry), the change-watch anchors inside it.
 */
function synthLandmarks(cx = 0.5, cy = 0.5, rx = 0.2, ry = 0.28) {
  const lm = Array.from({ length: 478 }, () => ({ x: cx, y: cy }));
  FACE_OVAL.forEach((k, n) => {
    const t = (n / FACE_OVAL.length) * Math.PI * 2 - Math.PI / 2;
    lm[k] = { x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry };
  });
  lm[234] = { x: cx - rx, y: cy };
  lm[454] = { x: cx + rx, y: cy };
  lm[151] = { x: cx, y: cy - 0.55 * ry }; // forehead
  lm[50] = { x: cx - 0.5 * rx, y: cy + 0.1 * ry }; // cheeks
  lm[280] = { x: cx + 0.5 * rx, y: cy + 0.1 * ry };
  lm[5] = { x: cx, y: cy }; // nose
  lm[13] = { x: cx, y: cy + 0.4 * ry }; // mouth
  lm[199] = { x: cx, y: cy + 0.7 * ry }; // chin
  return lm;
}

/** A W x H RGBA image of a smooth "skin" gradient; `paint` overrides pixels. */
function image(W: number, H: number, gain = 1, paint?: (x: number, y: number) => [number, number, number] | undefined) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const p = paint?.(x, y) ?? [200 - y * 0.2, 150 - y * 0.15, 120 - y * 0.1];
    d[i] = p[0] * gain; d[i + 1] = p[1] * gain; d[i + 2] = p[2] * gain; d[i + 3] = 255;
  }
  return d;
}

describe('CoverWatch (six-region change watch)', () => {
  const W = 200, H = 260;
  const pts = synthLandmarks(0.5, 0.5, 0.35, 0.3).map((p) => ({ x: p.x * W, y: p.y * H }));
  const regions = (gain = 1, paint?: Parameters<typeof image>[3]) => measureFaceRegions(image(W, H, gain, paint), W, H, pts);

  it('stays clear on a steady face and through a global brightness change (fill light)', () => {
    const w = new CoverWatch();
    for (let i = 0; i < 3; i++) expect(w.covered(regions())).toBe(false);
    expect(w.covered(regions())).toBe(false);
    expect(w.covered(regions(1.15))).toBe(false);
  });

  it('flags a hand over the mouth and chin (colour and edges change)', () => {
    const w = new CoverWatch();
    for (let i = 0; i < 3; i++) w.covered(regions());
    const hand = (x: number, y: number): [number, number, number] | undefined =>
      y > pts[13].y - 12 ? (((x >> 2) & 1) ? [235, 175, 160] : [120, 80, 70]) : undefined;
    expect(w.covered(regions(1, hand))).toBe(false); // one frame is not enough
    expect(w.covered(regions(1, hand))).toBe(true);
    expect([4, 5]).toContain(w.lastRegion); // mouth or chin
  });

  it('flags a flat object (paper) over the nose', () => {
    const w = new CoverWatch();
    for (let i = 0; i < 3; i++) w.covered(regions());
    const paper = (x: number, y: number): [number, number, number] | undefined =>
      Math.abs(x - pts[5].x) < 30 && Math.abs(y - pts[5].y) < 30 ? [245, 245, 245] : undefined;
    expect(w.covered(regions(1, paper))).toBe(false);
    expect(w.covered(regions(1, paper))).toBe(true);
  });

  it('takes a new baseline after reset, and ignores a missing measurement', () => {
    const w = new CoverWatch();
    for (let i = 0; i < 3; i++) w.covered(regions());
    w.reset();
    const tinted = (): [number, number, number] => [120, 160, 200];
    for (let i = 0; i < 3; i++) expect(w.covered(regions(1, tinted))).toBe(false);
    expect(w.covered(regions(1, tinted))).toBe(false);
    expect(w.covered(null)).toBe(false);
  });

  describe('2 consecutive failing frames on the same region (false-trip guard)', () => {
    // Regions as the watch sees them: 6 x [luma ratio, red, blue, edge].
    const frame = (lumaShift: Record<number, number> = {}) => {
      const v = new Float32Array(24);
      for (let r = 0; r < 6; r++) { v[r * 4] = 1 + (lumaShift[r] ?? 0); v[r * 4 + 1] = 0.4; v[r * 4 + 2] = 0.25; v[r * 4 + 3] = 20; }
      return v;
    };
    const primed = () => { const w = new CoverWatch(); for (let i = 0; i < 3; i++) w.covered(frame()); return w; };
    const trip = 0.235; // the iPhone's single-frame luma change (limit 0.22)

    it('one failing frame does not pause', () => {
      const w = primed();
      expect(w.covered(frame({ 3: trip }))).toBe(false);
      expect(w.lastScore).toBeGreaterThanOrEqual(1);
      expect(w.covered(frame())).toBe(false);
    });

    it('two in a row on the same region do', () => {
      const w = primed();
      expect(w.covered(frame({ 5: trip }))).toBe(false);
      expect(w.covered(frame({ 5: trip }))).toBe(true);
      expect(w.lastRegion).toBe(5);
    });

    it('failures alternating between regions do not', () => {
      const w = primed();
      for (let i = 0; i < 6; i++) expect(w.covered(frame(i % 2 ? { 3: trip } : { 5: trip }))).toBe(false);
    });

    it('a passing frame resets the region\'s count', () => {
      const w = primed();
      expect(w.covered(frame({ 3: trip }))).toBe(false);
      expect(w.covered(frame())).toBe(false);
      expect(w.covered(frame({ 3: trip }))).toBe(false);
      expect(w.covered(frame({ 3: trip }))).toBe(true);
    });

    it('limits are unchanged; reset clears the counts', () => {
      expect(COVER_WATCH.lumaLimit).toBe(0.22);
      expect(COVER_WATCH.chromaLimit).toBe(0.035);
      expect(COVER_WATCH.edgeRatioLimit).toBe(2.2);
      expect(COVER_WATCH.confirmFrames).toBe(2);
      const w = primed();
      w.covered(frame({ 3: trip }));
      w.reset();
      for (let i = 0; i < 3; i++) w.covered(frame());
      expect(w.covered(frame({ 3: trip }))).toBe(false);
    });
  });

  describe('fill light and the change watch', () => {
    const frame = (luma = 1, gain = 1) => {
      const v = new Float32Array(24);
      for (let r = 0; r < 6; r++) { v[r * 4] = luma; v[r * 4 + 1] = 0.4; v[r * 4 + 2] = 0.25; v[r * 4 + 3] = 20 * gain; }
      return v;
    };
    // How the A03's nose looked once the veil came on behind the baseline.
    const veiled = () => { const v = frame(); v[3 * 4] = 1 + 0.22 * 2.8; return v; };

    it('the veil is never toggled while scanning', () => {
      expect(shouldTurnOnFillLight({ tooDark: true, on: false, scanning: true })).toBe(false);
      expect(shouldTurnOnFillLight({ tooDark: true, on: false, scanning: false })).toBe(true);
      expect(shouldTurnOnFillLight({ tooDark: true, on: true, scanning: false })).toBe(false);
      expect(shouldTurnOnFillLight({ tooDark: false, on: false, scanning: false })).toBe(false);
    });

    it('a veil change mid-scan pauses the watch 500 ms, then takes a new baseline', () => {
      const w = new CoverWatch();
      let t = 0;
      for (let i = 0; i < 3; i++) { w.setVeil(false, t); w.covered(frame(), t); t += 100; }
      // The veil comes on: the face looks different (would read as covered).
      w.setVeil(true, t);
      expect(w.isSettling(t)).toBe(true);
      for (; t < 300 + 500; t += 100) { w.setVeil(true, t); expect(w.covered(veiled(), t)).toBe(false); }
      // Settled: 3 new baseline frames under the veil, then no false trip.
      for (let i = 0; i < 5; i++, t += 100) { w.setVeil(true, t); expect(w.covered(veiled(), t)).toBe(false); }
      // A real change under the new baseline still counts.
      const hand = veiled(); hand[5 * 4] = 1.5;
      expect(w.covered(hand, t)).toBe(false);
      expect(w.covered(hand, t + 100)).toBe(true);
    });

    it('a brightness jump with no veil change does not re-baseline', () => {
      const w = new CoverWatch();
      let t = 0;
      for (let i = 0; i < 3; i++) { w.setVeil(false, t); w.covered(frame(), t); t += 100; }
      // Brighter overall (luma is relative, so the regions read the same).
      w.setVeil(false, t);
      expect(w.covered(frame(1, 1.2), t)).toBe(false);
      expect(w.isSettling(t)).toBe(false);
      // The old baseline is still in force: a covered region trips it.
      const hand = frame(); hand[5 * 4] = 1.5;
      w.setVeil(false, t + 100); expect(w.covered(hand, t + 100)).toBe(false);
      w.setVeil(false, t + 200); expect(w.covered(hand, t + 200)).toBe(true);
    });
  });

  describe('steady baseline and motion', () => {
    const frame = (shift: Record<number, number> = {}, base = 1) => {
      const v = new Float32Array(24);
      for (let r = 0; r < 6; r++) { v[r * 4] = base + (shift[r] ?? 0); v[r * 4 + 1] = 0.4; v[r * 4 + 2] = 0.25; v[r * 4 + 3] = 20; }
      return v;
    };
    const hand = () => frame({ 4: 0.5, 5: 0.5 });

    it('moving frames are skipped for the baseline (3 consecutive steady frames)', () => {
      const w = new CoverWatch();
      for (let i = 0; i < 5; i++) w.covered(frame({ 3: i * 0.1 }), 0, false);
      expect(w.hasBaseline).toBe(false);
      w.covered(frame(), 0, true);
      w.covered(frame(), 0, true);
      w.covered(frame({ 3: 0.4 }), 0, false); // movement breaks the run
      w.covered(frame(), 0, true);
      w.covered(frame(), 0, true);
      expect(w.hasBaseline).toBe(false);
      w.covered(frame(), 0, true);
      expect(w.hasBaseline).toBe(true);
    });

    it('the watch is off until a steady baseline exists', () => {
      const w = new CoverWatch();
      for (let i = 0; i < 4; i++) {
        expect(w.covered(hand(), 0, false)).toBe(false);
        expect(w.state).toBe('off');
      }
    });

    it('a manual start waits for a steady baseline, then judges against it', () => {
      const w = new CoverWatch();
      w.reset(); // the scan starts on the first face frame, user still moving in
      for (let i = 0; i < 6; i++) { w.covered(frame({ 3: 0.6 - i * 0.1, 5: 0.6 - i * 0.1 }), 0, false); expect(w.state).toBe('off'); }
      for (let i = 0; i < 3; i++) w.covered(frame(), 0, true);
      // Settled face: clear, no false trip from the moving-in frames.
      for (let i = 0; i < 5; i++) { expect(w.covered(frame(), 0, true)).toBe(false); expect(w.state).toBe('clear'); }
    });

    it('stillness failing shows "Hold still" and resets the 2-frame count', () => {
      const w = new CoverWatch();
      for (let i = 0; i < 3; i++) w.covered(frame(), 0, true);
      expect(w.covered(hand(), 0, true)).toBe(false); // 1 of 2
      expect(w.covered(hand(), 0, false)).toBe(false); // moving: no judgement
      expect(w.state).toBe('off');
      expect(w.covered(hand(), 0, true)).toBe(false); // count restarted: 1 of 2
      expect(w.covered(hand(), 0, true)).toBe(true);

      // In the gate: an unsteady frame leaves "covered" unknown, so the hint is "Hold still".
      const g = new QualityGate();
      const lm = synthLandmarks(195, 330, 90, 120);
      lm[468] = { x: 165, y: 300 }; lm[473] = { x: 225, y: 300 };
      // The head moving in: the face is found, but stillness fails.
      const moved = (dx: number) => lm.map((p) => ({ x: p.x + dx, y: p.y }));
      let g0 = g.evaluate({ now: 0, faceCount: 1, screenLandmarks: moved(0) });
      for (let t = 1; t <= 12; t++) g0 = g.evaluate({ now: t * 30, faceCount: 1, screenLandmarks: moved(t * 8) });
      const r = withCoverWatch(g0, 'off');
      expect(r.checks.covered).toBe('unknown');
      expect(r.checks.stillness).toBe('fail');
      expect(hintFor(r.firstBlocking!, {}).text).toBe('Hold still');
    });

    it('a hand on a still head is still caught, with the covered copy', () => {
      const w = new CoverWatch();
      for (let i = 0; i < 3; i++) w.covered(frame(), 0, true);
      w.covered(hand(), 0, true);
      expect(w.covered(hand(), 0, true)).toBe(true);
      expect(w.state).toBe('covered');
      const g = new QualityGate();
      const lm = synthLandmarks(195, 330, 90, 120);
      lm[468] = { x: 165, y: 300 }; lm[473] = { x: 225, y: 300 };
      let r = g.evaluate({ now: 0, faceCount: 1, screenLandmarks: lm });
      for (let t = 30; t <= 600; t += 30) r = g.evaluate({ now: t, faceCount: 1, screenLandmarks: lm });
      r = withCoverWatch(r, w.state);
      expect(r.checks.covered).toBe('fail');
      expect(r.allPass).toBe(false);
      expect(GATE_CHECKS.indexOf('covered')).toBeLessThan(GATE_CHECKS.indexOf('stillness'));
      expect(hintFor('covered', {}).text).toBe('Keep your face uncovered');
    });

    it('steadiness means stillness and in-frame both pass', () => {
      const base = { checks: { stillness: 'pass', in_frame: 'pass' } } as any;
      expect(isSteadyForCoverWatch(base)).toBe(true);
      expect(isSteadyForCoverWatch({ checks: { stillness: 'fail', in_frame: 'pass' } } as any)).toBe(false);
      expect(isSteadyForCoverWatch({ checks: { stillness: 'pass', in_frame: 'unknown' } } as any)).toBe(false);
    });
  });

  it('returns null when a patch falls off the image', () => {
    const off = pts.map((p) => ({ x: p.x + 500, y: p.y }));
    expect(measureFaceRegions(image(W, H), W, H, off)).toBeNull();
  });
});

describe('one person: the same face found twice', () => {
  const face = (cx: number, s = 0.2) => [{ x: cx - s, y: 0.3 }, { x: cx + s, y: 0.7 }];

  it('counts an overlapping duplicate (IoU >= 0.3) once and a separate face twice', () => {
    expect(SAME_FACE_IOU).toBe(0.3);
    expect(boxIoU([0, 0, 1, 1], [0, 0, 1, 1])).toBe(1);
    expect(distinctFaceCount([face(0.5), face(0.52)], 0)).toBe(1);
    expect(distinctFaceCount([face(0.3, 0.1), face(0.75, 0.1)], 0)).toBe(2);
    expect(distinctFaceCount([face(0.5)], 0)).toBe(1);
    expect(distinctFaceCount([], 0)).toBe(0);
  });
});

describe('quality gate: covered', () => {
  const lm = synthLandmarks(195, 330, 90, 120);
  lm[468] = { x: 165, y: 300 }; // irises, so the eye distance (stillness scale) is set
  lm[473] = { x: 225, y: 300 };
  const base = { faceCount: 1, screenLandmarks: lm };

  it('sits after one_person in the check order, with the shared copy', () => {
    expect(GATE_CHECKS.indexOf('covered')).toBe(GATE_CHECKS.indexOf('one_person') + 1);
    expect(GATE_CHECKS.indexOf('covered')).toBeLessThan(GATE_CHECKS.indexOf('distance'));
    expect(GATE_HINTS.covered).toBe('Keep your face uncovered');
    expect(hintFor('covered', {})).toEqual({ id: 'covered', text: 'Keep your face uncovered' });
  });

  it('fails and blocks when covered, passes when clear, unknown when not checked', () => {
    const g = new QualityGate();
    for (let i = 0; i < 3; i++) g.evaluate({ ...base, now: i * 30 });
    const r = g.evaluate({ ...base, now: 100, covered: true });
    expect(r.checks.covered).toBe('fail');
    expect(r.firstBlocking).toBe('covered');
    expect(r.allPass).toBe(false);
    expect(g.evaluate({ ...base, now: 130, covered: false }).checks.covered).toBe('pass');
    expect(g.evaluate({ ...base, now: 160 }).checks.covered).toBe('unknown');
  });
});
