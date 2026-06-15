/**
 * Mixed verification flow — pure state machine
 *
 * Functional core: deterministic, no side effects, no React, no I/O.
 * The React shell (`<VerificationFlow/>`) drives this machine and renders
 * the appropriate capture component for the current step.
 *
 * Transitions:
 *   - `init(steps)`     → idle | in-progress
 *   - `recordResult`    → in-progress | complete
 *   - `cancel`          → cancelled
 *
 * `goBack` is intentionally absent for v1; add as a new transition later.
 */

import { assertIdSubtypeShape, assertSideForSubtype } from '../documents';
import type {
  FlowState,
  FlowStep,
  FlowStepResult,
  MixedFlowResult,
} from './types';

export class InvalidFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFlowError';
  }
}

/**
 * Build the initial flow state. Validates that the step list is non-empty
 * and well-formed; throws InvalidFlowError otherwise.
 */
export function init(steps: FlowStep[]): FlowState {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new InvalidFlowError('Flow must have at least one step');
  }
  for (const [i, step] of steps.entries()) {
    if (step.kind === 'biometric') continue;
    if (step.kind === 'document') {
      if (step.side !== 'front' && step.side !== 'back') {
        throw new InvalidFlowError(`Step ${i}: invalid document side`);
      }
      if (!step.documentType) {
        throw new InvalidFlowError(`Step ${i}: document step missing documentType`);
      }
      try {
        assertIdSubtypeShape(step.documentType, step.idSubtype);
        assertSideForSubtype(step.idSubtype, step.side);
      } catch (err) {
        throw new InvalidFlowError(`Step ${i}: ${(err as Error).message}`);
      }
      continue;
    }
    throw new InvalidFlowError(`Step ${i}: unknown step kind`);
  }
  return {
    steps,
    cursor: 0,
    results: [],
    status: 'in-progress',
  };
}

/** Returns the current step, or null if the flow is complete or cancelled. */
export function currentStep(state: FlowState): FlowStep | null {
  if (state.status !== 'in-progress') return null;
  return state.steps[state.cursor] ?? null;
}

/**
 * Append a result for the current step and advance the cursor.
 *
 * The result kind must match the current step kind; document results
 * must match documentType + side. Mismatches throw — they indicate a
 * shell wiring bug, not a recoverable runtime condition.
 */
export function recordResult(state: FlowState, result: FlowStepResult): FlowState {
  if (state.status !== 'in-progress') {
    throw new InvalidFlowError(`Cannot record result while status=${state.status}`);
  }
  const step = state.steps[state.cursor];
  if (!step) {
    throw new InvalidFlowError('No current step');
  }
  if (step.kind !== result.kind) {
    throw new InvalidFlowError(
      `Step ${state.cursor} expects ${step.kind} result, got ${result.kind}`,
    );
  }
  if (step.kind === 'document' && result.kind === 'document') {
    if (step.side !== result.side || step.documentType !== result.documentType) {
      throw new InvalidFlowError(
        `Step ${state.cursor} expects ${step.documentType}/${step.side}, ` +
          `got ${result.documentType}/${result.side}`,
      );
    }
    if ((step.idSubtype ?? null) !== (result.idSubtype ?? null)) {
      throw new InvalidFlowError(
        `Step ${state.cursor} expects idSubtype=${step.idSubtype ?? 'none'}, ` +
          `got ${result.idSubtype ?? 'none'}`,
      );
    }
  }
  const nextCursor = state.cursor + 1;
  const nextResults = [...state.results, result];
  const done = nextCursor >= state.steps.length;
  return {
    ...state,
    cursor: nextCursor,
    results: nextResults,
    status: done ? 'complete' : 'in-progress',
  };
}

/** Mark the flow as cancelled. Idempotent. */
export function cancel(state: FlowState): FlowState {
  if (state.status === 'complete') return state;
  return { ...state, status: 'cancelled' };
}

/** True if every step has a recorded result. */
export function isComplete(state: FlowState): boolean {
  return state.status === 'complete';
}

/** Snapshot the aggregated result. Safe to call at any point. */
export function toResult(state: FlowState): MixedFlowResult {
  return { steps: state.results };
}

/**
 * Progress as a `(completed, total)` tuple for UI step indicators.
 * `completed` is capped at `total`.
 */
export function progress(state: FlowState): { completed: number; total: number } {
  const total = state.steps.length;
  const completed = Math.min(state.results.length, total);
  return { completed, total };
}
