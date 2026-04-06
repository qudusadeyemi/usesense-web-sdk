/**
 * Randomized Micro-Action Sequence (RMAS) -- Inline step-up challenge.
 *
 * Prompts 2-3 random facial actions with tight 1.5s response windows.
 * Pre-recorded video cannot respond to unpredictable real-time prompts.
 *
 * Actions are validated using MediaPipe FaceMesh landmark geometry:
 *   - blink: Eye Aspect Ratio (EAR) < 0.2
 *   - smile: Mouth width increase > 15% from baseline
 *   - raise_eyebrows: Brow landmark displacement > 0.008 upward
 *   - open_mouth: Lip distance > 0.025
 *   - turn_left/right: Head yaw > 12 degrees
 */

import type { RMASAction, RMASEvidence } from '../types';
import { extractFrameSignal, isFaceMeshReady } from './media-pipe';

const ACTION_WINDOW_MS = 1500;
const POLL_INTERVAL_MS = 100;
const PAUSE_BETWEEN_MS = 300;

interface ActionDef {
  type: string;
  label: string;
  validate: (baseline: BaselineFace, current: CurrentFace) => boolean;
}

interface BaselineFace {
  mouthWidth: number;
  browY: number;
  lipDistance: number;
  yaw: number;
}

interface CurrentFace {
  leftEAR: number;
  rightEAR: number;
  mouthWidth: number;
  browY: number;
  lipDistance: number;
  yaw: number;
}

const ACTION_POOL: ActionDef[] = [
  {
    type: 'blink',
    label: 'Blink twice',
    validate: (_b, c) => c.leftEAR < 0.2 || c.rightEAR < 0.2,
  },
  {
    type: 'smile',
    label: 'Smile',
    validate: (b, c) => b.mouthWidth > 0 && (c.mouthWidth - b.mouthWidth) / b.mouthWidth > 0.15,
  },
  {
    type: 'raise_eyebrows',
    label: 'Raise your eyebrows',
    validate: (b, c) => (b.browY - c.browY) > 0.008, // Y decreases when brow moves up (normalized coords)
  },
  {
    type: 'open_mouth',
    label: 'Open your mouth',
    validate: (b, c) => (c.lipDistance - b.lipDistance) > 0.025,
  },
  {
    type: 'turn_left',
    label: 'Turn head left',
    validate: (_b, c) => c.yaw > 12,
  },
  {
    type: 'turn_right',
    label: 'Turn head right',
    validate: (_b, c) => c.yaw < -12,
  },
];

/** Callback to update the RMAS UI: shows action label, step, and countdown progress. */
export type RMASUICallback = (state: {
  label: string;
  step: number;
  total: number;
  countdown: number; // 0-100 (percentage remaining)
} | null) => void;

/**
 * Run the RMAS challenge sequence.
 *
 * @param videoElement - Active camera video element (for MediaPipe detection)
 * @param uiCallback - Callback to drive the prompt UI
 * @returns Evidence object with per-action results
 */
export async function runRMAS(
  videoElement: HTMLVideoElement,
  uiCallback: RMASUICallback
): Promise<RMASEvidence> {
  // Pick 3 random actions (no duplicates)
  const shuffled = [...ACTION_POOL].sort(() => Math.random() - 0.5);
  const selectedActions = shuffled.slice(0, 3);

  // Capture baseline face state
  const baseline = captureBaselineFace(videoElement);

  const actions: RMASAction[] = [];

  for (let i = 0; i < selectedActions.length; i++) {
    const actionDef = selectedActions[i];

    // Show prompt
    uiCallback({
      label: actionDef.label,
      step: i + 1,
      total: selectedActions.length,
      countdown: 100,
    });

    const startTime = Date.now();
    let completed = false;
    let reactionTimeMs: number | null = null;

    // Poll face detection every 100ms within the window
    while (Date.now() - startTime < ACTION_WINDOW_MS) {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / ACTION_WINDOW_MS) * 100);

      uiCallback({
        label: actionDef.label,
        step: i + 1,
        total: selectedActions.length,
        countdown: remaining,
      });

      const currentFace = detectCurrentFace(videoElement);
      if (currentFace && actionDef.validate(baseline, currentFace)) {
        completed = true;
        reactionTimeMs = Date.now() - startTime;
        break;
      }

      await sleep(POLL_INTERVAL_MS);
    }

    actions.push({
      actionType: actionDef.type,
      label: actionDef.label,
      windowMs: ACTION_WINDOW_MS,
      completed,
      reactionTimeMs,
    });

    // Brief pause between actions
    if (i < selectedActions.length - 1) {
      uiCallback(null);
      await sleep(PAUSE_BETWEEN_MS);
    }
  }

  uiCallback(null);

  const completedCount = actions.filter(a => a.completed).length;
  const passed = completedCount >= 2;

  return {
    type: 'rmas',
    actions,
    passed,
    confidence: Math.round((completedCount / actions.length) * 100),
    actionsCompleted: completedCount,
    actionsTotal: actions.length,
  };
}

/**
 * Capture baseline face measurements from current frame.
 */
function captureBaselineFace(video: HTMLVideoElement): BaselineFace {
  const signal = isFaceMeshReady() ? extractFrameSignal(video, 0, 'baseline') : null;
  if (!signal || signal.landmarks.length < 1404) {
    return { mouthWidth: 0.1, browY: 0.3, lipDistance: 0.01, yaw: 0 };
  }

  const lm = signal.landmarks;
  return {
    mouthWidth: dist2d(lm, 61, 291),
    browY: lm[10 * 3 + 1], // Forehead/brow landmark Y
    lipDistance: Math.abs(lm[13 * 3 + 1] - lm[14 * 3 + 1]),
    yaw: signal.headPose.yaw,
  };
}

/**
 * Detect current face state for action validation.
 */
function detectCurrentFace(video: HTMLVideoElement): CurrentFace | null {
  if (!isFaceMeshReady()) return null;

  const signal = extractFrameSignal(video, 0, 'baseline');
  if (!signal || signal.landmarks.length < 1404) return null;

  const lm = signal.landmarks;
  return {
    leftEAR: signal.leftEAR,
    rightEAR: signal.rightEAR,
    mouthWidth: dist2d(lm, 61, 291),
    browY: lm[10 * 3 + 1],
    lipDistance: Math.abs(lm[13 * 3 + 1] - lm[14 * 3 + 1]),
    yaw: signal.headPose.yaw,
  };
}

/** 2D distance between two landmarks. */
function dist2d(lm: number[], a: number, b: number): number {
  const dx = lm[a * 3] - lm[b * 3];
  const dy = lm[a * 3 + 1] - lm[b * 3 + 1];
  return Math.sqrt(dx * dx + dy * dy);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
