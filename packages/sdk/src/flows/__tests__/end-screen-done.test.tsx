/**
 * The Flow end screen carries a Done button, and the runner resolves only
 * when it is tapped (as iOS and Android do). Before, flows.run resolved the
 * moment the run settled and unmounted the runner, so "Under review" or
 * "You're verified" was never seen.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TerminalScreen } from '../FlowRunner';
import type { FlowRunView } from '../types';

function view(flowRun: Partial<FlowRunView['flowRun']>, redirect: string | null = null): FlowRunView {
  return {
    flowRun: { id: 'fr_1', state: 'completed', outcome: null, cursorStepId: null, environment: 'production', pendingAction: null, ...flowRun },
    definitionSteps: [],
    stepRuns: [],
    branding: { display_name: 'Acme', logo_url: null, primary_color: '#123456', redirect_url: redirect },
  };
}

const render = (v: FlowRunView, onDone?: () => void) =>
  renderToStaticMarkup(<TerminalScreen view={v} brand={v.branding} primary="#123456" onDone={onDone} />);

describe('Flow end screen', () => {
  it('shows Done on the review screen', () => {
    const html = render(view({ state: 'awaiting_review', pendingAction: { kind: 'await_review', stepId: 's' } }), () => {});
    expect(html).toContain('Under review');
    expect(html).toContain('>Done<');
  });

  it('shows Done on approve, reject and error', () => {
    for (const v of [view({ outcome: 'APPROVE' }), view({ outcome: 'REJECT' }), view({ state: 'errored' })]) {
      expect(render(v, () => {})).toContain('>Done<');
    }
  });

  it('keeps Continue (and no Done) when an approved run has a redirect', () => {
    const html = render(view({ outcome: 'APPROVE' }, 'https://acme.example/next'), () => {});
    expect(html).toContain('Continue');
    expect(html).toContain('https://acme.example/next');
    expect(html).not.toContain('>Done<');
  });

  it('renders no button without onDone (embedding the screen on its own)', () => {
    expect(render(view({ outcome: 'REJECT' }))).not.toContain('<button');
  });
});
