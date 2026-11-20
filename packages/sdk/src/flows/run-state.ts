// run-state.ts: when the runner stops driving a run, and what it shows then.
//
// Pure helpers so the decision is testable without a DOM. FlowRunner reads
// them to pick the end screen and to resolve `onResult`.

import { txt, type FlowCopy } from './copy';
import type { FlowRunResult, FlowRunView } from './types';

/** States the run never leaves on its own: the runner stops and reports. */
export const TERMINAL_STATES: ReadonlySet<string> = new Set(['completed', 'errored', 'cancelled', 'abandoned']);

/**
 * True when the run is parked for a human reviewer. The server sets the state
 * to `awaiting_review` and the pending action to `{ kind: 'await_review' }`
 * together; either one is enough. Nothing is left for the person to do, so the
 * runner shows the review screen and reports the result (as iOS does) instead
 * of waiting on a reviewer behind a spinner.
 */
export function isAwaitingReview(view: FlowRunView): boolean {
  return view.flowRun.state === 'awaiting_review' || view.flowRun.pendingAction?.kind === 'await_review';
}

/** True when the runner is done with the run: terminal, or held for review. */
export function isSettled(view: FlowRunView): boolean {
  return TERMINAL_STATES.has(view.flowRun.state) || isAwaitingReview(view);
}

/** The result `onResult` / `flows.run()` resolves with for a settled run. */
export function resultFor(view: FlowRunView): FlowRunResult {
  return {
    flowRunId: view.flowRun.id,
    state: isAwaitingReview(view) ? 'awaiting_review' : view.flowRun.state,
    outcome: view.flowRun.outcome,
  };
}

export type EndScreenKind = 'success' | 'review' | 'notVerified' | 'cancelled';

/** Which end screen a settled run shows. */
export function endScreenKind(view: FlowRunView): EndScreenKind {
  const { outcome, state } = view.flowRun;
  if (outcome === 'APPROVE') return 'success';
  if (outcome === 'MANUAL_REVIEW' || isAwaitingReview(view)) return 'review';
  if (state === 'cancelled') return 'cancelled';
  return 'notVerified';
}

/** Title and body for an end screen, with copy overrides applied. */
export function endScreenCopy(kind: EndScreenKind, copy: FlowCopy | undefined): { title: string; body: string } {
  switch (kind) {
    case 'success':
      return {
        title: txt(copy?.result?.successTitle, 'Verification complete'),
        body: txt(copy?.result?.successBody, 'Thank you. You can close this page.'),
      };
    case 'review':
      return {
        title: txt(copy?.result?.reviewTitle, 'Under review'),
        body: txt(copy?.result?.reviewBody, 'Your details are being reviewed.'),
      };
    case 'cancelled':
      return {
        title: txt(copy?.result?.cancelledTitle, 'Cancelled'),
        body: 'No problem. You can try again whenever you are ready.',
      };
    default:
      return {
        title: txt(copy?.result?.notVerifiedTitle, 'Not verified'),
        body: txt(copy?.result?.notVerifiedBody, 'We could not complete your verification.'),
      };
  }
}

/** Title and body for a step this SDK version cannot show. */
export function unsupportedStepCopy(copy: FlowCopy | undefined): { title: string; body: string; retry: string } {
  return {
    title: txt(copy?.errors?.generic, 'Something went wrong'),
    body: txt(copy?.errors?.unsupportedStep, 'This step could not be shown here. Try again, or come back later.'),
    retry: txt(copy?.buttons?.tryAgain, 'Try again'),
  };
}
