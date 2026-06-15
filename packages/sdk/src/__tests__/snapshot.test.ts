import { describe, it, expect } from 'vitest';
import {
  initialSnapshot,
  reduce,
  showReadyButton,
  showProgress,
  showFaceGuideMessage,
} from '../session/snapshot';
import type { FaceGuideStatus } from '../types';

const goodGuide: FaceGuideStatus = {
  faceDetected: true,
  faceCentered: true,
  faceDistance: 'good',
  faceVisible: true,
  message: 'Hold still',
  ready: true,
};

describe('SessionSnapshot.reduce', () => {
  it('updates phase and label on phase event', () => {
    const next = reduce(initialSnapshot, {
      type: 'phase',
      phase: 'face-guide',
      label: 'Position your face',
    });
    expect(next.phase).toBe('face-guide');
    expect(next.phaseLabel).toBe('Position your face');
  });

  it('updates progress', () => {
    const next = reduce(initialSnapshot, { type: 'progress', value: 42 });
    expect(next.progress).toBe(42);
  });

  it('updates faceGuide and framesCount', () => {
    const a = reduce(initialSnapshot, { type: 'faceGuide', status: goodGuide });
    expect(a.faceGuide).toBe(goodGuide);
    const b = reduce(a, { type: 'framesCollected', count: 12 });
    expect(b.framesCount).toBe(12);
    expect(b.faceGuide).toBe(goodGuide); // preserved
  });

  it('records cameraError', () => {
    const next = reduce(initialSnapshot, {
      type: 'cameraError',
      message: 'NotAllowedError',
    });
    expect(next.cameraError).toBe('NotAllowedError');
  });

  it('returns input unchanged for unhandled event types', () => {
    const next = reduce(initialSnapshot, { type: 'recording', active: true });
    expect(next).toBe(initialSnapshot);
  });

  it('does not mutate input', () => {
    const before = { ...initialSnapshot };
    reduce(initialSnapshot, { type: 'progress', value: 99 });
    expect(initialSnapshot).toEqual(before);
  });
});

describe('SessionSnapshot derived selectors', () => {
  it('showReadyButton is true only during face-guide phase', () => {
    expect(showReadyButton(initialSnapshot)).toBe(false);
    const onGuide = reduce(initialSnapshot, {
      type: 'phase', phase: 'face-guide', label: 'x',
    });
    expect(showReadyButton(onGuide)).toBe(true);
    const onBaseline = reduce(onGuide, {
      type: 'phase', phase: 'baseline', label: 'x',
    });
    expect(showReadyButton(onBaseline)).toBe(false);
  });

  it('showProgress is true between 0 and 100 exclusive', () => {
    expect(showProgress({ ...initialSnapshot, progress: 0 })).toBe(false);
    expect(showProgress({ ...initialSnapshot, progress: 50 })).toBe(true);
    expect(showProgress({ ...initialSnapshot, progress: 100 })).toBe(false);
  });

  it('showFaceGuideMessage requires face-guide phase AND a status', () => {
    const noGuide = reduce(initialSnapshot, {
      type: 'phase', phase: 'face-guide', label: 'x',
    });
    expect(showFaceGuideMessage(noGuide)).toBe(false);
    const withGuide = reduce(noGuide, { type: 'faceGuide', status: goodGuide });
    expect(showFaceGuideMessage(withGuide)).toBe(true);
    const moved = reduce(withGuide, {
      type: 'phase', phase: 'baseline', label: 'x',
    });
    expect(showFaceGuideMessage(moved)).toBe(false);
  });
});
