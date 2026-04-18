/**
 * SNRChallengeController unit tests.
 *
 * These run with real timers: the Phase 1 envelope is 600ms total, so the
 * whole suite finishes in a few seconds. Fake timers would need to also fake
 * performance.now(), which complicates the controller's wallclock-based hold
 * loop for marginal benefit at Phase 1.
 *
 * Run: npx vitest run src/__tests__/snr-controller.test.ts
 */

import { describe, expect, it } from 'vitest';
import {
  SNRChallengeController,
  type SNRChallengeEnvelope,
} from '../snr/SNRChallengeController';

const envelope = (): SNRChallengeEnvelope => ({
  version: 'snr-flash-v1',
  kind: 'snr-flash-v1',
  challenge_id: 'snrch_test_0001',
  states: [
    { h: 0, s: 0.7, l: 0.5, dur_ms: 100 },
    { h: 150, s: 0.7, l: 0.5, dur_ms: 100 },
    { h: 210, s: 0.7, l: 0.65, dur_ms: 100 },
    { h: 0, s: 0.7, l: 0.5, dur_ms: 100 },
    { h: 150, s: 0.7, l: 0.65, dur_ms: 100 },
    { h: 210, s: 0.7, l: 0.5, dur_ms: 100 },
  ],
  accessibility_profile: 'default',
  issued_at: new Date(Date.now() - 1000).toISOString(),
  expires_at: new Date(Date.now() + 10_000).toISOString(),
  hmac: 'a'.repeat(64),
});

describe('SNRChallengeController', () => {
  it('rejects envelopes with unsupported version', () => {
    const bad = { ...envelope(), version: 'unknown' } as unknown as SNRChallengeEnvelope;
    expect(
      () =>
        new SNRChallengeController(bad, {
          setEmissionColor: () => undefined,
          getCurrentFrameIndex: () => 0,
        }),
    ).toThrow(/unsupported challenge version/);
  });

  it('rejects envelopes with no states', () => {
    const bad = { ...envelope(), states: [] };
    expect(
      () =>
        new SNRChallengeController(bad, {
          setEmissionColor: () => undefined,
          getCurrentFrameIndex: () => 0,
        }),
    ).toThrow(/no states/);
  });

  it('rejects already-expired envelopes', async () => {
    const expired = { ...envelope(), expires_at: new Date(Date.now() - 1).toISOString() };
    const controller = new SNRChallengeController(expired, {
      setEmissionColor: () => undefined,
      getCurrentFrameIndex: () => 0,
    });
    await expect(controller.run()).rejects.toThrow(/expired_before_start/);
  });

  it('emits a manifest with every state represented', async () => {
    let frameIdx = 0;
    const controller = new SNRChallengeController(envelope(), {
      setEmissionColor: (state) => {
        if (state) frameIdx++;
      },
      getCurrentFrameIndex: () => frameIdx,
    });

    const result = await controller.run();

    expect(result.consumedChallenge.challenge_id).toBe('snrch_test_0001');
    const stateCoverage = new Set(result.manifest.map((e) => e.state_index));
    expect(stateCoverage.size).toBe(envelope().states.length);
  });

  it('abort stops the run and throws snr_aborted', async () => {
    const controller = new SNRChallengeController(envelope(), {
      setEmissionColor: () => undefined,
      getCurrentFrameIndex: () => 0,
    });

    const runPromise = controller.run().catch((e) => e);
    controller.abort('user_abort');
    const err = await runPromise;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/snr_aborted:user_abort/);
  });

  it('clears overlay on completion', async () => {
    const calls: Array<'set' | 'clear'> = [];
    const controller = new SNRChallengeController(envelope(), {
      setEmissionColor: (st) => calls.push(st ? 'set' : 'clear'),
      getCurrentFrameIndex: () => 0,
    });

    await controller.run();
    expect(calls[calls.length - 1]).toBe('clear');
  });

  it('does not allow re-running the same controller', async () => {
    const controller = new SNRChallengeController(envelope(), {
      setEmissionColor: () => undefined,
      getCurrentFrameIndex: () => 0,
    });
    const first = controller.run();
    await expect(controller.run()).rejects.toThrow(/already running/);
    await first;
  });
});
