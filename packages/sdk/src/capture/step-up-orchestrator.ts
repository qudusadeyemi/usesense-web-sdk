/**
 * Step-Up Orchestrator -- Sequences inline step-up challenges.
 *
 * When the suspicion engine triggers, this orchestrator:
 *   1. Determines which challenges to run (auto/flash/rmas)
 *   2. Runs the challenges in sequence
 *   3. Aggregates evidence into InlineStepUpEvidence
 *   4. Enforces a 15s timeout
 */

import type { InlineStepUpEvidence, FlashReflectionEvidence, RMASEvidence } from '../types';
import { runFlashReflection } from './flash-reflection';
import { runRMAS } from './rmas';
import type { RMASUICallback } from './rmas';

const STEP_UP_TIMEOUT_MS = 15000;

export interface StepUpCallbacks {
  /** Set flash overlay color (null to clear) */
  setFlashOverlayColor: (color: string | null) => void;
  /** Update RMAS UI state */
  setRMASState: RMASUICallback;
  /** Update the current step-up phase */
  setStepUpPhase: (phase: 'intro' | 'flash' | 'rmas' | 'complete') => void;
}

/**
 * Run the inline step-up flow.
 *
 * @param suspicionScore - The score that triggered step-up
 * @param threshold - The suspicion_threshold from policy
 * @param preferredChallenge - 'auto', 'flash_reflection', or 'rmas'
 * @param videoElement - Active camera video element
 * @param callbacks - UI callbacks for overlay/prompt rendering
 * @returns Evidence for metadata upload
 */
export async function runStepUp(
  suspicionScore: number,
  threshold: number,
  preferredChallenge: 'auto' | 'flash_reflection' | 'rmas',
  videoElement: HTMLVideoElement,
  callbacks: StepUpCallbacks
): Promise<InlineStepUpEvidence> {
  // Determine which challenges to run
  const challengesToRun = selectChallenges(suspicionScore, threshold, preferredChallenge);

  // Wrap in timeout
  const timeoutPromise = new Promise<InlineStepUpEvidence>((resolve) => {
    setTimeout(() => {
      resolve({
        challengesRun: [],
        triggerSuspicionScore: suspicionScore,
        flashReflection: null,
        rmas: null,
        passed: false,
        hardReject: false,
        timestamp: new Date().toISOString(),
      });
    }, STEP_UP_TIMEOUT_MS);
  });

  const challengePromise = executeStepUp(
    suspicionScore,
    challengesToRun,
    videoElement,
    callbacks
  );

  return Promise.race([challengePromise, timeoutPromise]);
}

function selectChallenges(
  score: number,
  threshold: number,
  preferred: 'auto' | 'flash_reflection' | 'rmas'
): string[] {
  if (preferred === 'flash_reflection') return ['flash_reflection'];
  if (preferred === 'rmas') return ['rmas'];

  // Auto mode: moderate suspicion = flash only, high = flash + RMAS
  if (score >= threshold + 20) {
    return ['flash_reflection', 'rmas'];
  }
  return ['flash_reflection'];
}

async function executeStepUp(
  suspicionScore: number,
  challengesToRun: string[],
  videoElement: HTMLVideoElement,
  callbacks: StepUpCallbacks
): Promise<InlineStepUpEvidence> {
  let flashResult: FlashReflectionEvidence | null = null;
  let rmasResult: RMASEvidence | null = null;

  // Intro phase (1.5s)
  callbacks.setStepUpPhase('intro');
  await sleep(1500);

  // Run Flash Reflection
  if (challengesToRun.includes('flash_reflection')) {
    callbacks.setStepUpPhase('flash');
    flashResult = await runFlashReflection(videoElement, callbacks.setFlashOverlayColor);
  }

  // Run RMAS
  if (challengesToRun.includes('rmas')) {
    callbacks.setStepUpPhase('rmas');
    rmasResult = await runRMAS(videoElement, callbacks.setRMASState);
  }

  // Completion phase (0.5s)
  callbacks.setStepUpPhase('complete');
  await sleep(500);

  // Determine pass/fail
  const passed = determinePassed(flashResult, rmasResult, challengesToRun);
  const hardReject = determineHardReject(flashResult, rmasResult, challengesToRun);

  return {
    challengesRun: challengesToRun,
    triggerSuspicionScore: suspicionScore,
    flashReflection: flashResult,
    rmas: rmasResult,
    passed,
    hardReject,
    timestamp: new Date().toISOString(),
  };
}

function determinePassed(
  flash: FlashReflectionEvidence | null,
  rmas: RMASEvidence | null,
  challengesRun: string[]
): boolean {
  if (challengesRun.length === 0) return false;

  // If only one challenge ran, its result determines pass
  if (challengesRun.length === 1) {
    if (flash) return flash.passed;
    if (rmas) return rmas.passed;
    return false;
  }

  // Both ran: pass if at least one passed
  return (flash?.passed ?? false) || (rmas?.passed ?? false);
}

function determineHardReject(
  flash: FlashReflectionEvidence | null,
  rmas: RMASEvidence | null,
  challengesRun: string[]
): boolean {
  // Flash: avg color delta < 3 across ALL flashes
  const flashHardFail = flash != null && flash.overallColorDelta < 3;

  // RMAS: 0 of 3 actions completed
  const rmasHardFail = rmas != null && rmas.actionsCompleted === 0;

  // Both challenges run and both decisively failed
  if (challengesRun.length >= 2 && flashHardFail && rmasHardFail) {
    return true;
  }

  // Single challenge hard failures
  if (challengesRun.length === 1 && flashHardFail) return true;
  if (challengesRun.length === 1 && rmasHardFail) return true;

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
