/**
 * UI events emitted by `runBiometricSession`.
 *
 * The straight-line session function owns time and pure logic. It does not
 * touch React. Instead, it emits typed events through a single channel
 * (`onUiEvent`) which the React shell maps to setState calls.
 *
 * v1 scope: tracer-bullet for `challenge_type === 'none'` with no step-up
 * and no retries. Events for challenges, step-up, and audio recording are
 * declared in the union for forward-compatibility but are NOT emitted yet.
 *
 * Naming follows the SDK convention: flat camelCase at the SDK boundary.
 */

import type { CapturePhase, FaceGuideStatus } from '../types';

export type UiEvent =
  // Phase transitions (mirror `CapturePhase`).
  | { type: 'phase'; phase: CapturePhase; label: string }
  // Progress bar 0..100.
  | { type: 'progress'; value: number }
  // Face-guide status (oval color, ready flag, message).
  | { type: 'faceGuide'; status: FaceGuideStatus | null }
  // Frame counter (for the demo's frame badge).
  | { type: 'framesCollected'; count: number }
  // Environment warning string or null to clear.
  | { type: 'envWarning'; message: string | null }
  // Camera permission / not-found / in-use error.
  | { type: 'cameraError'; message: string }
  // Countdown digit 3,2,1 or null to hide.
  | { type: 'countdown'; n: number | null }
  // Follow-dot waypoint position in viewport %.
  | { type: 'dot'; position: { x: number; y: number } | null }
  // Head-turn direction or null to hide.
  | { type: 'direction'; direction: string | null }
  // Speak-phrase text or null to hide.
  | { type: 'phrase'; text: string | null }
  // Audio recording on/off.
  | { type: 'recording'; active: boolean }
  // Step-up phase (idle | intro | flash | rmas | complete).
  | { type: 'stepUpPhase'; phase: 'idle' | 'intro' | 'flash' | 'rmas' | 'complete' }
  // Flash overlay color or null.
  | { type: 'flashColor'; color: string | null }
  // RMAS prompt state.
  | {
      type: 'rmas';
      state: { label: string; step: number; total: number; countdown: number } | null;
    };

/**
 * Single channel for a session to talk to its host. The host translates
 * these events into setState (React) or any other rendering layer.
 *
 * Sync by design: the session does not await the host. If the host needs
 * to do async work in response to an event, it owns that.
 */
export type OnUiEvent = (event: UiEvent) => void;
