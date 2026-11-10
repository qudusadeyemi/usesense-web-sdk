/**
 * Server step-up, round 2.
 *
 * When a Step-up rule on the server matches the uploaded capture, the
 * /signals response asks for one more challenge in the same session. The SDK
 * runs it on the still-open camera, uploads it with `?round=2`, then completes.
 * Server contract: docs/sdk/step-up-protocol.md in usesense-watchtower.
 */

import type {
  FollowDotChallenge,
  HeadTurnChallenge,
  UploadSignalsResponse,
  StepUpRoundMetadata,
  SignalMetadata,
  SuspicionData,
  WebIntegritySignals,
} from '../types';

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
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  const base = {
    type: spec.type,
    seed: spec.seed || '',
    completed: true,
    started_at: startedAt,
    completed_at: completedAt,
    frame_timestamps: frameTimestamps,
  };
  // extras: step_events (per-step timing) and, for Follow Dot,
  // preview_mirrored, as the iOS SDK sends them.
  return spec.type === 'head_turn'
    ? { ...base, ...extras, step_frames: frameMap }
    : { ...base, ...extras, waypoint_frames: frameMap };
}

/** What one round-2 upload is built from (the engine's refs at upload time). */
export interface StepUpRoundInput {
  sessionId: string;
  sdkVersion: string;
  challenge: HeadTurnChallenge | FollowDotChallenge;
  frameMap: Record<string, number[]>;
  startedAt: string;
  completedAt: string;
  frames: { index: number; timestamp: number; hash: string; resolution: { w: number; h: number } }[];
  meshSignals: {
    frameIndex: number;
    timestamp: number;
    headPose: { yaw: number; pitch: number; roll: number };
    leftEAR?: number;
    rightEAR?: number;
    bbox?: { x: number; y: number; w: number; h: number };
  }[];
  captureStartedAtMs: number;
  captureEndedAtMs: number;
  /** step_events / preview_mirrored for the challenge response. */
  responseExtras?: Record<string, unknown>;
  channelIntegrity: WebIntegritySignals;
  suspicion: SuspicionData;
  verificationPackage: SignalMetadata['verification_package'];
}

/**
 * Round-2 metadata. Besides the challenge response it carries the same
 * signals as round 1, in round 1's keys (channel_integrity, suspicion,
 * verification_package, deep_classifier_on_device, frame_hashes,
 * frames_manifest, face_mesh_signals), all describing round 2's frames.
 */
export function buildStepUpRoundMetadata(i: StepUpRoundInput): StepUpRoundMetadata {
  return {
    session_id: i.sessionId,
    sdk_version: i.sdkVersion,
    platform: 'web',
    source: 'sdk',
    step_up_round: 2,
    client_capabilities: SDK_CAPABILITIES,
    challenge_response: buildChallengeResponse(i.challenge, i.frameMap, i.startedAt, i.completedAt, i.frames.map((f) => f.timestamp), i.responseExtras),
    frame_hashes: i.frames.map((f) => f.hash),
    frames_manifest: i.frames.map((f) => ({
      frame_index: f.index,
      capture_timestamp_ms: f.timestamp,
      resolution_w: f.resolution.w,
      resolution_h: f.resolution.h,
    })),
    face_mesh_signals: i.meshSignals.length > 0 ? {
      model: 'mediapipe_face_landmarker_v2',
      frame_count: i.meshSignals.length,
      frames: i.meshSignals.map((sig) => ({
        frame_index: sig.frameIndex,
        timestamp_ms: sig.timestamp,
        headPose: sig.headPose,
        leftEAR: sig.leftEAR,
        rightEAR: sig.rightEAR,
        bbox: sig.bbox,
      })),
    } as StepUpRoundMetadata['face_mesh_signals'] : null,
    timestamps: { capture_started_at_ms: i.captureStartedAtMs, capture_ended_at_ms: i.captureEndedAtMs },
    channel_integrity: i.channelIntegrity,
    suspicion: i.suspicion,
    verification_package: i.verificationPackage,
    // Same key as round 1; the web SDK runs no on-device classifier yet.
    deep_classifier_on_device: null,
  };
}
