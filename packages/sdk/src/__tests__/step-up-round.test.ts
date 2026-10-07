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
