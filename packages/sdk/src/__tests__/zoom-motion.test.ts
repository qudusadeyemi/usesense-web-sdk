/**
 * Unit tests for ZoomMotionController (X-3).
 *
 * Feeds hand-crafted landmark streams and asserts the terminal state.
 * Per ticket acceptance criteria we cover:
 *   (a) valid zoom -> complete
 *   (b) no motion -> no_motion
 *   (c) too-fast motion -> still a valid complete (there is no upper
 *                         velocity gate; speed is OK if the motion
 *                         eventually lands and dwells in the target band)
 *   (d) head turn during motion -> head_turn
 */

import { describe, it, expect } from 'vitest';

import {
  ZoomMotionController,
  type FaceBoundingBox,
  type HeadPoseDegrees,
  type ZoomObservation,
  type ZoomState,
  type ZoomFailureReason,
} from '../capture/zoom-motion';

// Centre bbox at (640,360) in a 1280x720 frame. Width and height grow with t.
function bboxAtScale(linearScale: number): FaceBoundingBox {
  const baseW = 240;
  const baseH = 320;
  return {
    cx: 640,
    cy: 360,
    w: baseW * linearScale,
    h: baseH * linearScale,
  };
}

function pose(yaw = 0, pitch = 0, roll = 0): HeadPoseDegrees {
  return { yaw, pitch, roll };
}

function feed(
  ctrl: ZoomMotionController,
  stream: Array<{ t: number; scale: number; pose?: HeadPoseDegrees }>,
): ZoomState {
  for (const step of stream) {
    const obs: ZoomObservation = {
      timestampMs: step.t,
      bbox: bboxAtScale(step.scale),
      headPose: step.pose ?? pose(),
    };
    ctrl.observe(obs);
    const s = ctrl.getState();
    if (s === 'complete' || s === 'failed') return s;
  }
  return ctrl.getState();
}

describe('ZoomMotionController (X-3)', () => {
  it('valid zoom: linear growth over 1.4s completes', () => {
    const ctrl = new ZoomMotionController();
    const failures: ZoomFailureReason[] = [];
    ctrl.on((_next, _prev, _stats, failure) => {
      if (failure) failures.push(failure);
    });
    ctrl.start();

    // 30fps stream: 45 frames over 1.5s, linear scale 1.0 -> 1.4
    // area scale = 1.4^2 = 1.96, solidly in the 1.7-2.4 band
    const stream = Array.from({ length: 45 }, (_, i) => {
      const t = 100 + i * 33;
      const linear = 1.0 + (0.4 * i) / 44;
      return { t, scale: linear };
    });
    // Add a small dwell at the top so the completion band triggers.
    for (let i = 0; i < 10; i++) {
      stream.push({ t: 100 + 45 * 33 + i * 33, scale: 1.4 });
    }

    const terminal = feed(ctrl, stream);
    expect(terminal).toBe('complete');
    expect(failures).toHaveLength(0);
    const stats = ctrl.stats();
    expect(stats.scaleRatio).toBeGreaterThan(1.7);
    expect(stats.scaleRatio).toBeLessThan(2.4);
    expect(stats.observationCount).toBeGreaterThan(0);
  });

  it('no_motion: user holds phone still', () => {
    const ctrl = new ZoomMotionController();
    ctrl.start();
    const stream = Array.from({ length: 60 }, (_, i) => ({
      t: 100 + i * 33,
      scale: 1.0,
    }));
    const terminal = feed(ctrl, stream);
    expect(terminal).toBe('failed');
  });

  it('too-fast motion: still completes if it dwells in the band', () => {
    const ctrl = new ZoomMotionController();
    ctrl.start();
    // 500ms ramp from 1.0 to 1.4, then dwell.
    const ramp = Array.from({ length: 15 }, (_, i) => ({
      t: 100 + i * 33,
      scale: 1.0 + (0.4 * i) / 14,
    }));
    const dwell = Array.from({ length: 15 }, (_, i) => ({
      t: 100 + 15 * 33 + i * 33,
      scale: 1.4,
    }));
    const terminal = feed(ctrl, [...ramp, ...dwell]);
    expect(terminal).toBe('complete');
  });

  it('head_turn: yaw > 15 during motion fails with head_turn reason', () => {
    const ctrl = new ZoomMotionController();
    const failures: ZoomFailureReason[] = [];
    ctrl.on((_n, _p, _s, failure) => { if (failure) failures.push(failure); });
    ctrl.start();

    const stream = [
      { t: 100, scale: 1.0, pose: pose(0) },
      { t: 133, scale: 1.05, pose: pose(5) },
      { t: 166, scale: 1.1, pose: pose(12) },
      { t: 200, scale: 1.15, pose: pose(20) }, // exceeds 15-degree gate
    ];
    const terminal = feed(ctrl, stream);
    expect(terminal).toBe('failed');
    expect(failures).toContain('head_turn');
  });

  it('timeout: total wall-clock exceeded without completion', () => {
    const ctrl = new ZoomMotionController({ timeoutMs: 500, noMotionGraceMs: 2000 });
    ctrl.start();
    const stream: Array<{ t: number; scale: number; pose?: HeadPoseDegrees }> = [];
    for (let i = 0; i < 40; i++) {
      // Slow drift in growth that does not reach the completion band.
      stream.push({ t: 100 + i * 25, scale: 1.0 + 0.01 * i });
    }
    const terminal = feed(ctrl, stream);
    expect(terminal).toBe('failed');
  });

  it('state transitions: watching -> moving -> complete', () => {
    const ctrl = new ZoomMotionController();
    const trail: ZoomState[] = [];
    ctrl.on((next) => trail.push(next));
    ctrl.start();

    // Ramp
    const stream = Array.from({ length: 15 }, (_, i) => ({
      t: 100 + i * 33,
      scale: 1.0 + (0.4 * i) / 14,
    }));
    for (let i = 0; i < 15; i++) stream.push({ t: 100 + 15 * 33 + i * 33, scale: 1.4 });
    feed(ctrl, stream);

    expect(trail[0]).toBe('watching');
    expect(trail).toContain('moving');
    expect(trail[trail.length - 1]).toBe('complete');
  });

  it('stats: captures peak head yaw and pitch', () => {
    const ctrl = new ZoomMotionController();
    ctrl.start();
    const stream = [
      { t: 100, scale: 1.0, pose: pose(3, -2) },
      { t: 200, scale: 1.1, pose: pose(7, -5) },
      { t: 300, scale: 1.2, pose: pose(-4, 6) },
    ];
    feed(ctrl, stream);
    const s = ctrl.stats();
    expect(s.maxHeadYawAbsDeg).toBe(7);
    expect(s.maxHeadPitchAbsDeg).toBe(6);
  });

  it('observe() before start() is a no-op', () => {
    const ctrl = new ZoomMotionController();
    ctrl.observe({ timestampMs: 0, bbox: bboxAtScale(1), headPose: pose() });
    expect(ctrl.getState()).toBe('idle');
  });

  it('stale observations are dropped without changing state or stats', () => {
    const ctrl = new ZoomMotionController();
    ctrl.start();
    ctrl.observe({ timestampMs: 100, bbox: bboxAtScale(1), headPose: pose() });
    const statsBefore = ctrl.stats();
    ctrl.observe({ timestampMs: 50, bbox: bboxAtScale(1.5), headPose: pose() });
    const statsAfter = ctrl.stats();
    expect(statsAfter.observationCount).toBe(statsBefore.observationCount);
    // latest bbox should still be the first (fresh) observation
    expect(statsAfter.endBbox?.w).toBe(statsBefore.endBbox?.w);
  });
});
