/**
 * Unit tests for ZoomPrompt (X-2).
 *
 * Environment: node + react-dom/server. We render to static HTML and
 * assert the markup contains the correct text, state attribute, and
 * transform values. This exercises every branch the component has,
 * without needing jsdom.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  ZoomPrompt,
  ZOOM_PROMPT_TRANSITION_MS,
  ZOOM_PROMPT_ENLARGED_SCALE,
} from '../components/ZoomPrompt';

function render(el: React.ReactElement): string {
  return renderToStaticMarkup(el);
}

describe('ZoomPrompt (X-2)', () => {
  it('renders the guidance text', () => {
    const html = render(
      React.createElement(ZoomPrompt, {
        state: 'framing',
        guidance: 'Fit your face in the oval',
      }),
    );
    expect(html).toContain('Fit your face in the oval');
    expect(html).toContain('aria-live="polite"');
  });

  it('stamps data-state=framing in the framing state', () => {
    const html = render(
      React.createElement(ZoomPrompt, {
        state: 'framing',
        guidance: 'g',
      }),
    );
    expect(html).toContain('data-state="framing"');
    expect(html).toContain('scale(1)');
  });

  it('stamps data-state=enlarged and 1.4x scale in the enlarged state', () => {
    const html = render(
      React.createElement(ZoomPrompt, {
        state: 'enlarged',
        guidance: 'Move closer',
        reducedMotionOverride: false,
      }),
    );
    expect(html).toContain('data-state="enlarged"');
    expect(html).toContain(`scale(${ZOOM_PROMPT_ENLARGED_SCALE})`);
  });

  it('skips the transition when prefers-reduced-motion is on', () => {
    const html = render(
      React.createElement(ZoomPrompt, {
        state: 'enlarged',
        guidance: 'g',
        reducedMotionOverride: true,
      }),
    );
    // Reduced motion: transition should be 'none'
    expect(html).toContain('transition:none');
  });

  it('uses a declared CSS transition when motion is not reduced', () => {
    const html = render(
      React.createElement(ZoomPrompt, {
        state: 'framing',
        guidance: 'g',
        reducedMotionOverride: false,
      }),
    );
    // Should contain the transition ms value (React serialises inline styles).
    expect(html).toContain(`transform ${ZOOM_PROMPT_TRANSITION_MS}ms`);
  });

  it('colours the guidance per tone', () => {
    const pos = render(
      React.createElement(ZoomPrompt, {
        state: 'framing',
        guidance: 'g',
        tone: 'positive',
        primaryColor: '#abcdef',
      }),
    );
    expect(pos).toContain('color:#abcdef');

    const warn = render(
      React.createElement(ZoomPrompt, {
        state: 'framing',
        guidance: 'g',
        tone: 'warning',
      }),
    );
    expect(warn).toContain('color:#F6C36B');
  });

  it('renders exposed timing constants', () => {
    expect(ZOOM_PROMPT_TRANSITION_MS).toBe(250);
    expect(ZOOM_PROMPT_ENLARGED_SCALE).toBe(1.4);
  });
});
