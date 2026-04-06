/**
 * Suspicion Engine -- Client-side screen replay detection.
 *
 * Runs alongside the face detection loop during capture. Analyzes every 2nd
 * frame to compute a rolling 0-100 suspicion score. When the score exceeds
 * the configured threshold, the step-up orchestrator is triggered.
 *
 * Signals (4 weighted):
 *   - Pose Micro-Tremor (0.35): Real faces jitter 0.08-0.8 deg per frame
 *   - Temporal Smoothness (0.25): Real capture has irregular jerk
 *   - Brightness Stability (0.20): Screens have very stable luminance
 *   - Sharpness Pattern (0.20): Camera-to-screen double-sampling loses detail
 */

import type { SuspicionData, SuspicionSnapshot, SuspicionSignal } from '../types';

interface FrameEntry {
  yaw: number;
  pitch: number;
  roll: number;
  luminance: number;
  sharpness: number;
  timestamp: number;
}

const WINDOW_SIZE = 30;
const EMA_ALPHA = 0.3;
const MIN_FRAMES_BEFORE_TRIGGER = 6;

export class SuspicionEngine {
  private buffer: FrameEntry[] = [];
  private emaScore = 0;
  private framesAnalyzed = 0;
  private triggered = false;
  private threshold: number;
  private frameCounter = 0;

  constructor(threshold: number = 55) {
    this.threshold = threshold;
  }

  /**
   * Push a new frame's data into the engine. Called on every captured frame;
   * analysis runs every 2nd frame for performance.
   */
  push(
    headPose: { yaw: number; pitch: number; roll: number },
    luminance: number,
    sharpness: number
  ): void {
    this.frameCounter++;
    this.buffer.push({
      yaw: headPose.yaw,
      pitch: headPose.pitch,
      roll: headPose.roll,
      luminance,
      sharpness,
      timestamp: Date.now(),
    });

    // Maintain sliding window
    if (this.buffer.length > WINDOW_SIZE) {
      this.buffer.shift();
    }

    // Analyze every 2nd frame
    if (this.frameCounter % 2 === 0 && this.buffer.length >= 3) {
      this.evaluate();
    }
  }

  /** Whether the suspicion threshold has been exceeded. */
  shouldTrigger(): boolean {
    return this.triggered && this.framesAnalyzed >= MIN_FRAMES_BEFORE_TRIGGER;
  }

  /** Current EMA score (0-100). */
  getScore(): number {
    return Math.round(this.emaScore);
  }

  /** Build the snapshot for metadata upload. */
  getSnapshot(): SuspicionData {
    const signals = this.computeSignals();
    const snapshot: SuspicionSnapshot = {
      score: this.getScore(),
      signals,
      framesAnalyzed: this.framesAnalyzed,
      reliable: this.framesAnalyzed >= MIN_FRAMES_BEFORE_TRIGGER,
      timestamp: Date.now(),
    };
    return {
      final_score: this.getScore(),
      triggered: this.triggered,
      snapshot,
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private evaluate(): void {
    this.framesAnalyzed++;
    const signals = this.computeSignals();

    // Weighted average of available signals
    let weightSum = 0;
    let scoreSum = 0;
    for (const s of signals) {
      if (s.score >= 0) {
        scoreSum += s.score * s.weight;
        weightSum += s.weight;
      }
    }

    const instantScore = weightSum > 0 ? scoreSum / weightSum : 0;

    // Exponential moving average
    this.emaScore = EMA_ALPHA * instantScore + (1 - EMA_ALPHA) * this.emaScore;

    if (this.emaScore >= this.threshold && this.framesAnalyzed >= MIN_FRAMES_BEFORE_TRIGGER) {
      this.triggered = true;
    }
  }

  private computeSignals(): SuspicionSignal[] {
    return [
      this.computeMicroTremor(),
      this.computeTemporalSmoothness(),
      this.computeBrightnessStability(),
      this.computeSharpnessPattern(),
    ];
  }

  /**
   * Pose Micro-Tremor (weight 0.35).
   * Real faces have involuntary 0.08-0.8 deg frame-to-frame jitter.
   * Screens are stable or unnaturally smooth.
   */
  private computeMicroTremor(): SuspicionSignal {
    if (this.buffer.length < 3) {
      return { name: 'micro_tremor', score: -1, weight: 0.35, detail: 'insufficient data' };
    }

    const deltas: number[] = [];
    for (let i = 1; i < this.buffer.length; i++) {
      const dy = Math.abs(this.buffer[i].yaw - this.buffer[i - 1].yaw);
      const dp = Math.abs(this.buffer[i].pitch - this.buffer[i - 1].pitch);
      const dr = Math.abs(this.buffer[i].roll - this.buffer[i - 1].roll);
      deltas.push(Math.sqrt(dy * dy + dp * dp + dr * dr));
    }

    const sorted = [...deltas].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const cv = mean > 0.001 ? Math.sqrt(deltas.reduce((s, d) => s + (d - mean) ** 2, 0) / deltas.length) / mean : 0;

    // Low median + low CV = screen (high suspicion)
    // Real face: median 0.08-0.8 with CV > 0.5
    let score: number;
    if (median < 0.05) {
      score = 90; // Very stable -- likely screen
    } else if (median < 0.08) {
      score = 70;
    } else if (median > 0.8) {
      score = 30; // Excessive movement (real but noisy)
    } else {
      // Normal range: score depends on CV (irregularity)
      score = cv > 0.5 ? Math.max(0, 40 - cv * 20) : Math.min(80, 60 - cv * 10);
    }

    return {
      name: 'micro_tremor',
      score: Math.round(Math.max(0, Math.min(100, score))),
      weight: 0.35,
      detail: `median=${median.toFixed(3)}, cv=${cv.toFixed(2)}`,
    };
  }

  /**
   * Temporal Smoothness (weight 0.25).
   * Compute jerk (3rd derivative of yaw) and zero-crossing rate.
   * Screens have low jerk and low ZCR.
   */
  private computeTemporalSmoothness(): SuspicionSignal {
    if (this.buffer.length < 5) {
      return { name: 'temporal_smoothness', score: -1, weight: 0.25, detail: 'insufficient data' };
    }

    // Compute velocity (1st derivative of yaw)
    const vel: number[] = [];
    for (let i = 1; i < this.buffer.length; i++) {
      vel.push(this.buffer[i].yaw - this.buffer[i - 1].yaw);
    }

    // Acceleration (2nd derivative)
    const acc: number[] = [];
    for (let i = 1; i < vel.length; i++) {
      acc.push(vel[i] - vel[i - 1]);
    }

    // Jerk (3rd derivative)
    const jerk: number[] = [];
    for (let i = 1; i < acc.length; i++) {
      jerk.push(acc[i] - acc[i - 1]);
    }

    if (jerk.length === 0) {
      return { name: 'temporal_smoothness', score: -1, weight: 0.25, detail: 'insufficient jerk data' };
    }

    const avgJerk = jerk.reduce((s, j) => s + Math.abs(j), 0) / jerk.length;

    // Zero-crossing rate of jerk
    let zeroCrossings = 0;
    for (let i = 1; i < jerk.length; i++) {
      if ((jerk[i] > 0 && jerk[i - 1] < 0) || (jerk[i] < 0 && jerk[i - 1] > 0)) {
        zeroCrossings++;
      }
    }
    const zcr = jerk.length > 1 ? zeroCrossings / (jerk.length - 1) : 0;

    // Low jerk + low ZCR = smooth (screen)
    let score: number;
    if (avgJerk < 0.05 && zcr < 0.2) {
      score = 85;
    } else if (avgJerk < 0.1) {
      score = 65;
    } else {
      score = Math.max(0, 50 - avgJerk * 100);
    }

    return {
      name: 'temporal_smoothness',
      score: Math.round(Math.max(0, Math.min(100, score))),
      weight: 0.25,
      detail: `jerk=${avgJerk.toFixed(3)}, zcr=${zcr.toFixed(2)}`,
    };
  }

  /**
   * Brightness Stability (weight 0.20).
   * Screens produce very stable frame-to-frame brightness (CV < 0.02).
   * Real environments fluctuate naturally (CV > 0.05).
   */
  private computeBrightnessStability(): SuspicionSignal {
    if (this.buffer.length < 5) {
      return { name: 'brightness_stability', score: -1, weight: 0.20, detail: 'insufficient data' };
    }

    const lums = this.buffer.map(f => f.luminance);
    const mean = lums.reduce((a, b) => a + b, 0) / lums.length;
    const variance = lums.reduce((s, l) => s + (l - mean) ** 2, 0) / lums.length;
    const cv = mean > 0.001 ? Math.sqrt(variance) / mean : 0;

    // Very stable (low CV) = screen
    let score: number;
    if (cv < 0.02) {
      score = 85;
    } else if (cv < 0.05) {
      score = 60;
    } else {
      score = Math.max(0, 30 - cv * 100);
    }

    return {
      name: 'brightness_stability',
      score: Math.round(Math.max(0, Math.min(100, score))),
      weight: 0.20,
      detail: `cv=${cv.toFixed(4)}, mean=${mean.toFixed(1)}`,
    };
  }

  /**
   * Sharpness Pattern (weight 0.20).
   * Screens produce uniformly low, stable sharpness.
   * Real captures have natural variation.
   */
  private computeSharpnessPattern(): SuspicionSignal {
    if (this.buffer.length < 5) {
      return { name: 'sharpness_pattern', score: -1, weight: 0.20, detail: 'insufficient data' };
    }

    const sharps = this.buffer.map(f => f.sharpness);
    const mean = sharps.reduce((a, b) => a + b, 0) / sharps.length;
    const cv = mean > 0.001
      ? Math.sqrt(sharps.reduce((s, v) => s + (v - mean) ** 2, 0) / sharps.length) / mean
      : 0;

    // Low sharpness with low CV = screen (double-sampled image)
    let score: number;
    if (mean < 45 && cv < 0.1) {
      score = 80;
    } else if (mean < 45) {
      score = 55;
    } else if (cv < 0.06) {
      score = 60; // Good sharpness but too uniform
    } else {
      score = Math.max(0, 30 - cv * 50);
    }

    return {
      name: 'sharpness_pattern',
      score: Math.round(Math.max(0, Math.min(100, score))),
      weight: 0.20,
      detail: `mean=${mean.toFixed(1)}, cv=${cv.toFixed(3)}`,
    };
  }
}
