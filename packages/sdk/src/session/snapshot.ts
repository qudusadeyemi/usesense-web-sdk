/**
 * SessionSnapshot -- the entire UI state of a biometric session in one struct.
 *
 * Casey: 7 useState cells in the React shell is a god-component restarting
 * in miniature. Each cell encodes an implicit invariant ("if phase is X,
 * then showReady must be true"). One snapshot makes invariants explicit
 * and derived flags impossible to desync.
 *
 * `reduce(snapshot, event)` is pure. Tests run it directly without React,
 * without DOM, without timers.
 */

import type { CapturePhase, FaceGuideStatus } from '../types';
import type { UiEvent } from './ui-event';

export interface SessionSnapshot {
  phase: CapturePhase;
  phaseLabel: string;
  /** Baseline-capture progress 0..100. */
  progress: number;
  /** Frames captured so far (HUD badge). */
  framesCount: number;
  /** Last face-guide evaluation, or null before face-guide phase. */
  faceGuide: FaceGuideStatus | null;
  /** Camera permission/not-found error, or null when camera is healthy. */
  cameraError: string | null;
}

export const initialSnapshot: SessionSnapshot = {
  phase: 'initializing',
  phaseLabel: 'Getting ready...',
  progress: 0,
  framesCount: 0,
  faceGuide: null,
  cameraError: null,
};

/**
 * Pure reducer. Given the current snapshot and a UI event, returns the next
 * snapshot. Never mutates input. Unknown events return input unchanged.
 */
export function reduce(snap: SessionSnapshot, event: UiEvent): SessionSnapshot {
  switch (event.type) {
    case 'phase':
      return { ...snap, phase: event.phase, phaseLabel: event.label };
    case 'progress':
      return { ...snap, progress: event.value };
    case 'framesCollected':
      return { ...snap, framesCount: event.count };
    case 'faceGuide':
      return { ...snap, faceGuide: event.status };
    case 'cameraError':
      return { ...snap, cameraError: event.message };
    default:
      return snap;
  }
}

/**
 * Derived selectors. Read from the snapshot; never stored separately. This
 * is what eliminates the "showReadyButton out of sync with phase" class of
 * bug from the old shell.
 */
export const showReadyButton = (snap: SessionSnapshot): boolean =>
  snap.phase === 'face-guide';

export const showProgress = (snap: SessionSnapshot): boolean =>
  snap.progress > 0 && snap.progress < 100;

export const showFaceGuideMessage = (snap: SessionSnapshot): boolean =>
  snap.phase === 'face-guide' && snap.faceGuide !== null;
