import { describe, it, expect } from 'vitest';
import { buildChallengeResponse, readStepUpInstruction, SDK_CAPABILITIES } from '../capture/step-up-round';
import { signalsUrl } from '../api-client';

// Server step-up: after round 1 uploads, the server can ask for one more
// challenge in the same session. Contract: usesense-watchtower
// docs/sdk/step-up-protocol.md.

const headTurn = {
  type: 'head_turn',
  seed: 'abc123',
  sequence: [{ index: 0, direction: 'left', duration_ms: 1500 }],
  total_duration_ms: 1500,
};

describe('readStepUpInstruction', () => {
  it('reads a head_turn step-up with the server frame budget', () => {
    const out = readStepUpInstruction({ received: true, step_up: { round: 2, challenge: headTurn, upload: { max_frames: 18 } } });
    expect(out?.challenge.type).toBe('head_turn');
    expect(out?.maxFrames).toBe(18);
  });

  it('defaults the frame budget when the server omits it', () => {
    expect(readStepUpInstruction({ step_up: { round: 2, challenge: headTurn } })?.maxFrames).toBe(20);
  });

  it('returns null when there is nothing to do', () => {
    expect(readStepUpInstruction({ received: true })).toBeNull();
    expect(readStepUpInstruction(null)).toBeNull();
  });

  it('ignores what this SDK cannot render, so the session completes as before', () => {
    expect(readStepUpInstruction({ step_up: { round: 2, challenge: { type: 'speak_phrase', seed: 's' } } })).toBeNull();
    expect(readStepUpInstruction({ step_up: { round: 2, challenge: { type: 'head_turn', seed: 's', sequence: [] } } })).toBeNull();
    expect(readStepUpInstruction({ step_up: { round: 3, challenge: headTurn } })).toBeNull();
    expect(readStepUpInstruction({ step_up: { round: 2, challenge: { ...headTurn, seed: '' } } })).toBeNull();
  });
});

describe('buildChallengeResponse', () => {
  it('uses step_frames for head_turn and waypoint_frames for follow_dot', () => {
    const ht = buildChallengeResponse(headTurn as any, { '0': [1, 2] }, 'a', 'b', [10, 20]);
    expect(ht).toMatchObject({ type: 'head_turn', seed: 'abc123', completed: true, step_frames: { '0': [1, 2] }, frame_timestamps: [10, 20] });
    const fd = buildChallengeResponse({ type: 'follow_dot', seed: 'x', waypoints: [] } as any, { '0': [3] }, 'a', 'b', []);
    expect(fd).toMatchObject({ type: 'follow_dot', waypoint_frames: { '0': [3] } });
    expect('step_frames' in fd).toBe(false);
  });
});

describe('signalsUrl', () => {
  it('adds round=2 only for a step-up round', () => {
    expect(signalsUrl('https://api', 's1', 'production', 'n&1')).toBe('https://api/sessions/s1/signals?env=production&nonce=n%261');
    expect(signalsUrl('https://api', 's1', 'production', 'n', 2)).toBe('https://api/sessions/s1/signals?env=production&nonce=n&round=2');
  });
});

describe('capabilities', () => {
  it('declares the step-up capability', () => {
    expect(SDK_CAPABILITIES).toContain('step_up_v1');
  });
});

describe('buildStepUpRoundMetadata', () => {
  it('carries the same signals as round 1, in round 1\'s keys', async () => {
    const { buildStepUpRoundMetadata } = await import('../capture/step-up-round');
    const integrity = { webdriver: false, capture_source: { schema: 1 } } as any;
    const suspicion = { final_score: 12, triggered: false, snapshot: { score: 12, signals: [], framesAnalyzed: 6, reliable: true, timestamp: 1 } } as any;
    const pkg = { frames: [{ frameIndex: 0 }], crossFrameConsistency: 0.9 } as any;
    const m = buildStepUpRoundMetadata({
      sessionId: 's', sdkVersion: '4.13.0', challenge: headTurn as any, frameMap: { 0: [0, 1] },
      startedAt: 'a', completedAt: 'b',
      frames: [{ index: 0, timestamp: 10, hash: 'h0', resolution: { w: 4, h: 3 } }, { index: 1, timestamp: 20, hash: 'h1', resolution: { w: 4, h: 3 } }],
      meshSignals: [{ frameIndex: 0, timestamp: 10, headPose: { yaw: -20, pitch: 0, roll: 0 } }],
      captureStartedAtMs: 1, captureEndedAtMs: 2,
      channelIntegrity: integrity, suspicion, verificationPackage: pkg,
    });
    expect(m.step_up_round).toBe(2);
    expect(m.channel_integrity).toBe(integrity);
    expect(m.suspicion).toBe(suspicion);
    expect(m.verification_package).toBe(pkg);
    expect(m).toHaveProperty('deep_classifier_on_device', null);
    expect(m.frame_hashes).toEqual(['h0', 'h1']);
    expect(m.frames_manifest).toHaveLength(2);
    expect(m.face_mesh_signals?.frame_count).toBe(1);
    expect((m.challenge_response as any).step_frames).toEqual({ 0: [0, 1] });
    // Every round-1 signal key the server reads is present.
    for (const k of ['channel_integrity', 'suspicion', 'verification_package', 'deep_classifier_on_device', 'frame_hashes', 'frames_manifest', 'face_mesh_signals']) {
      expect(m, k).toHaveProperty(k);
    }
  });
});

describe('challenge response extras (iOS parity)', () => {
  it('carries step_events and, for Follow Dot, preview_mirrored', () => {
    const dot = { type: 'follow_dot', seed: 's', waypoints: [{ index: 0, x: 0.5, y: 0.4, duration_ms: 1000 }] } as any;
    const ev = [{ index: 0, prompted_at_ms: 1, ended_at_ms: 2, hinted: false, outcome: 'reached' }];
    const r = buildChallengeResponse(dot, { 0: [0] }, 'a', 'b', [1], { step_events: ev, preview_mirrored: true });
    expect(r).toMatchObject({ type: 'follow_dot', waypoint_frames: { 0: [0] }, step_events: ev, preview_mirrored: true });
  });
});
