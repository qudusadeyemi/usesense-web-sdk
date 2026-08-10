import { describe, it, expect } from 'vitest';
import { computeCrossFrameConsistency } from '../capture/media-pipe';
import type { OnDevice3DMMFit } from '../types';

/**
 * The server only recomputes crossFrameConsistency when the client reports 0.
 * Any non-zero value we send is trusted verbatim and used for scoring, so the
 * client implementation has to agree with the server's. These tests pin that
 * agreement. See usesense-watchtower issue #795.
 */

/**
 * Reference implementation, transcribed from computeMeshIntegrity() in
 * usesense-watchtower/supabase/functions/watchtower-api/geometric-coherence-engine.tsx
 * (the `crossFrameConsistency === 0` recompute branch). If the server changes,
 * update this copy and the parity test will show what drifted.
 */
function serverReference(fits: OnDevice3DMMFit[]): number {
  const validFrames = fits.filter(f => f.shapeParams && f.shapeParams.length > 0);
  if (validFrames.length < 2) return 0;

  const l2Norm = (a: number[], b: number[]): number => {
    if (a.length === 0 || b.length === 0) return 0;
    const len = Math.min(a.length, b.length);
    let sum = 0;
    for (let i = 0; i < len; i++) {
      const d = (a[i] ?? 0) - (b[i] ?? 0);
      sum += d * d;
    }
    return Math.sqrt(sum);
  };
  const mean = (arr: number[]): number =>
    arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const distances: number[] = [];
  for (let i = 0; i < validFrames.length; i++) {
    for (let j = i + 1; j < validFrames.length; j++) {
      distances.push(l2Norm(validFrames[i].shapeParams, validFrames[j].shapeParams));
    }
  }
  const meanDist = mean(distances);

  const magnitudes = validFrames.map(f => {
    let sum = 0;
    for (const v of f.shapeParams) sum += v * v;
    return Math.sqrt(sum);
  });
  const meanMag = mean(magnitudes);

  const cv = meanMag > 0.001 ? meanDist / meanMag : 0;
  return Math.round(clamp(100 - (cv / 0.50) * 100, 0, 100));
}

const fit = (shapeParams: number[]): OnDevice3DMMFit => ({
  shapeParams,
  pose: { yaw: 0, pitch: 0, roll: 0 },
  depthPlausibility: 45,
  geometricRatios: [],
  poseRatios2D: [],
});

/** Deterministic PRNG so the parity fixtures never flake. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * Shape params are inter-landmark distances normalised by inter-eye distance,
 * so element 0 is always 1.0 and the rest sit roughly in [0.3, 2.0].
 */
function syntheticFrames(count: number, jitter: number, seed = 42): OnDevice3DMMFit[] {
  const rand = lcg(seed);
  const base = [1.0, 1.55, 0.42, 0.42, 0.78, 0.21, 1.62, 1.71, 0.61, 0.61, 0.93, 0.93];
  return Array.from({ length: count }, () =>
    fit(base.map(v => v + (rand() - 0.5) * 2 * jitter))
  );
}

describe('computeCrossFrameConsistency', () => {
  it('returns 0 when there are fewer than two usable fits', () => {
    expect(computeCrossFrameConsistency([])).toBe(0);
    expect(computeCrossFrameConsistency([fit([1.0, 1.5])])).toBe(0);
  });

  it('ignores fits that carry no shape params', () => {
    const fits = [fit([1.0, 1.5]), fit([]), fit([])];
    // Only one usable fit remains, so this is the under-two case.
    expect(computeCrossFrameConsistency(fits)).toBe(0);
  });

  it('scores identical frames as perfectly consistent', () => {
    const fits = syntheticFrames(8, 0);
    expect(computeCrossFrameConsistency(fits)).toBe(100);
  });

  it('degrades as frames diverge, without collapsing to 0 on genuine motion', () => {
    const still = computeCrossFrameConsistency(syntheticFrames(8, 0.01));
    const moving = computeCrossFrameConsistency(syntheticFrames(8, 0.08));
    const wild = computeCrossFrameConsistency(syntheticFrames(8, 0.9));

    expect(still).toBeGreaterThan(moving);
    expect(moving).toBeGreaterThan(wild);
    // The regression this replaces: a follow-dot session with real head motion
    // clamped to 0 under the old fixed 0.05 absolute-distance threshold.
    expect(moving).toBeGreaterThan(0);
  });

  it('scores a production-like session well above the hard gate floor', () => {
    // sess_604c4bef (2026-08-10) recorded shapeParamVariance 0.0034 over 12
    // params, i.e. a per-param sigma near 0.058. That session reported
    // crossFrameConsistency=0 and preliminaryScore=27 against a default
    // hardGateFloor of 20.
    const score = computeCrossFrameConsistency(syntheticFrames(8, 0.1, 7));
    expect(score).toBeGreaterThan(0);

    // preliminaryScore = avgDepth * 0.6 + consistency * 0.4, with the observed
    // avgDepth of 45. The old zero dragged this to 27; it must now clear 20
    // with real margin.
    const preliminary = Math.round(45 * 0.6 + score * 0.4);
    expect(preliminary).toBeGreaterThan(27);
  });

  it('is scale-invariant: uniformly scaling every vector does not change the score', () => {
    const fits = syntheticFrames(8, 0.05);
    const scaled = fits.map(f => fit(f.shapeParams.map(v => v * 10)));
    expect(computeCrossFrameConsistency(scaled)).toBe(computeCrossFrameConsistency(fits));
  });

  it('matches the server reference across frame counts and jitter levels', () => {
    for (const count of [2, 3, 5, 8, 12]) {
      for (const jitter of [0, 0.01, 0.05, 0.1, 0.3, 0.9]) {
        const fits = syntheticFrames(count, jitter, count * 31 + Math.round(jitter * 100));
        expect(
          computeCrossFrameConsistency(fits),
          `count=${count} jitter=${jitter}`
        ).toBe(serverReference(fits));
      }
    }
  });

  it('matches the server reference when vectors have differing lengths', () => {
    const fits = [
      fit([1.0, 1.55, 0.42, 0.42]),
      fit([1.0, 1.56, 0.43]),
      fit([1.0, 1.54, 0.41, 0.43, 0.79]),
    ];
    expect(computeCrossFrameConsistency(fits)).toBe(serverReference(fits));
  });
});
