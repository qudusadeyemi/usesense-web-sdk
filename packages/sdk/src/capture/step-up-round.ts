/**
 * Server step-up, round 2.
 *
 * When a Step-up rule on the server matches the uploaded capture, the
 * /signals response asks for one more challenge in the same session. The SDK
 * runs it on the still-open camera, uploads it with `?round=2`, then completes.
 * Server contract: docs/sdk/step-up-protocol.md in usesense-watchtower.
 */

import type { FollowDotChallenge, HeadTurnChallenge, UploadSignalsResponse } from '../types';

/** Capability this SDK declares at session start and in the round-1 upload. */
export const STEP_UP_CAPABILITY = 'step_up_v1';

/** Every capability this SDK version supports. */
export const SDK_CAPABILITIES: string[] = [STEP_UP_CAPABILITY];

/** Frames allowed in round 2 when the server doesn't say. */
export const DEFAULT_STEP_UP_MAX_FRAMES = 20;

export interface StepUpInstruction {
  round: 2;
  challenge: HeadTurnChallenge | FollowDotChallenge;
  maxFrames: number;
}

/**
 * The step-up the server asked for, or null. Anything this SDK can't render
 * (an unknown challenge type, a spec missing its steps) returns null, so the
 * SDK completes as before and the server applies its own fallback.
 */
export function readStepUpInstruction(response: UploadSignalsResponse | null | undefined): StepUpInstruction | null {
  const su = response?.step_up;
  if (!su || su.round !== 2 || !su.challenge || typeof su.challenge !== 'object') return null;
  const c = su.challenge as any;
  if (typeof c.seed !== 'string' || !c.seed) return null;
  const valid =
    (c.type === 'head_turn' && Array.isArray(c.sequence) && c.sequence.length > 0) ||
    (c.type === 'follow_dot' && Array.isArray(c.waypoints) && c.waypoints.length > 0);
  if (!valid) return null;
  const maxFrames = typeof su.upload?.max_frames === 'number' && su.upload.max_frames > 0
    ? Math.floor(su.upload.max_frames)
    : DEFAULT_STEP_UP_MAX_FRAMES;
  return { round: 2, challenge: c, maxFrames };
}

/** The challenge_response for a head_turn or follow_dot round, in the server's format. */
export function buildChallengeResponse(
  spec: HeadTurnChallenge | FollowDotChallenge,
  frameMap: Record<string, number[]>,
  startedAt: string,
  completedAt: string,
  frameTimestamps: number[],
): Record<string, unknown> {
  const base = {
    type: spec.type,
    seed: spec.seed || '',
    completed: true,
    started_at: startedAt,
    completed_at: completedAt,
    frame_timestamps: frameTimestamps,
  };
  return spec.type === 'head_turn'
    ? { ...base, step_frames: frameMap }
    : { ...base, waypoint_frames: frameMap };
}
