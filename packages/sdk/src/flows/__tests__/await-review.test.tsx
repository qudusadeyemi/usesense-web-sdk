/**
 * A Flow run held for manual review. The server's SDK and hosted views return
 * `state: 'awaiting_review'` with `pendingAction: { kind: 'await_review' }`
 * (watchtower modules/flows/runtime.ts). The runner must treat it as the end
 * of the person's part: show the review screen and resolve with the review
 * result, as iOS does, instead of failing with `unsupported_action`.
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { endScreenCopy, endScreenKind, isAwaitingReview, isSettled, resultFor, unsupportedStepCopy } from '../run-state';
import { TerminalScreen, UnsupportedSurface } from '../FlowRunner';
import type { FlowRunView } from '../types';

function view(flowRun: Partial<FlowRunView['flowRun']>): FlowRunView {
  return {
    flowRun: { id: 'fr_1', state: 'in_progress', outcome: null, cursorStepId: 'review', environment: 'production', pendingAction: null, ...flowRun },
    definitionSteps: [],
    stepRuns: [],
    branding: { display_name: 'Acme', logo_url: null, primary_color: '#123456', redirect_url: null },
  };
}

// Exactly what hostedView() serialises for a run parked at a review hold.
const AWAITING = view({
  state: 'awaiting_review',
  outcome: null,
  pendingAction: { kind: 'await_review', stepId: 'review', instructions: 'One or more checks were flagged for manual review.' },
});

describe('awaiting review', () => {
  it('is settled, with the review result', () => {
    expect(isAwaitingReview(AWAITING)).toBe(true);
    expect(isSettled(AWAITING)).toBe(true);
    expect(resultFor(AWAITING)).toEqual({ flowRunId: 'fr_1', state: 'awaiting_review', outcome: null });
    expect(endScreenKind(AWAITING)).toBe('review');
  });

  it('settles on either signal alone', () => {
    const stateOnly = view({ state: 'awaiting_review' });
    const actionOnly = view({ state: 'stalled', pendingAction: { kind: 'await_review', stepId: 'review' } });
    for (const v of [stateOnly, actionOnly]) {
      expect(isSettled(v)).toBe(true);
      expect(resultFor(v).state).toBe('awaiting_review');
      expect(endScreenKind(v)).toBe('review');
    }
  });

  it('keeps other runs as they were', () => {
    expect(isSettled(view({ state: 'stalled', pendingAction: { kind: 'capture', capture: 'face' } }))).toBe(false);
    expect(isSettled(view({ state: 'pending' }))).toBe(false);
    expect(endScreenKind(view({ state: 'completed', outcome: 'APPROVE' }))).toBe('success');
    expect(endScreenKind(view({ state: 'completed', outcome: 'MANUAL_REVIEW' }))).toBe('review');
    expect(endScreenKind(view({ state: 'completed', outcome: 'REJECT' }))).toBe('notVerified');
    expect(endScreenKind(view({ state: 'cancelled' }))).toBe('cancelled');
    expect(endScreenKind(view({ state: 'errored' }))).toBe('notVerified');
    expect(resultFor(view({ state: 'completed', outcome: 'APPROVE' }))).toEqual({ flowRunId: 'fr_1', state: 'completed', outcome: 'APPROVE' });
  });

  it('renders the review screen, not the reviewer note', () => {
    const html = renderToStaticMarkup(<TerminalScreen view={AWAITING} brand={AWAITING.branding} primary="#123456" />);
    expect(html).toContain('Under review');
    expect(html).toContain('Your details are being reviewed.');
    expect(html).not.toContain('flagged for manual review');
  });

  it('review copy is overridable like the other result screens', () => {
    const c = endScreenCopy('review', { result: { reviewTitle: 'Thanks, we are on it', reviewBody: 'We will email you.' } });
    expect(c).toEqual({ title: 'Thanks, we are on it', body: 'We will email you.' });
    // A blank override keeps the default.
    expect(endScreenCopy('review', { result: { reviewTitle: '  ' } }).title).toBe('Under review');
  });
});

describe('unknown pending action', () => {
  it('renders a retry screen instead of nothing', () => {
    const html = renderToStaticMarkup(<UnsupportedSurface kind="future_kind" color="#123456" onReport={() => {}} onRetry={() => {}} />);
    expect(html).toContain('Something went wrong');
    expect(html).toContain('This step could not be shown here.');
    expect(html).toContain('Try again');
  });

  it('does not report during render', () => {
    let reported = 0;
    renderToStaticMarkup(<UnsupportedSurface kind="future_kind" color="#123456" onReport={() => { reported++; }} onRetry={() => {}} />);
    expect(reported).toBe(0);
  });

  it('copy is overridable', () => {
    expect(unsupportedStepCopy({ errors: { generic: 'Oops', unsupportedStep: 'Update the app.' }, buttons: { tryAgain: 'Retry' } }))
      .toEqual({ title: 'Oops', body: 'Update the app.', retry: 'Retry' });
  });
});
