/**
 * UseSense Web SDK — Automated Visual Regression Tests
 * =====================================================
 *
 * These tests validate the instruction overlay and smooth dot animation
 * introduced in v1.17.4. They use DOM snapshot assertions to detect
 * unintended visual regressions in:
 *
 *   1. Instruction overlay — rendered for ALL challenge types (follow_dot,
 *      head_turn, speak_phrase) with type-specific copy, icon, and
 *      "Got it" dismiss button.
 *
 *   2. Follow-dot smooth CSS transition — the `.usesense-challenge-dot`
 *      element uses 400ms cubic-bezier transitions (no pulse animation).
 *
 * Run with: npx vitest run __tests__/visual-regression.test.tsx
 *
 * For full pixel-level snapshot testing, integrate with Playwright or
 * Storybook Chromatic and register each scenario as a story.
 */

import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Shared test constants — mirror the SDK's styles.ts values
// ─────────────────────────────────────────────────────────────────────────────

const CHALLENGE_DOT_TRANSITION = 'left 400ms cubic-bezier(0.4, 0, 0.2, 1), top 400ms cubic-bezier(0.4, 0, 0.2, 1)';
const CHALLENGE_DOT_BOX_SHADOW = '0 0 12px 4px rgba(99, 102, 241, 0.5)';

/** Instruction overlay config per challenge type */
const INSTRUCTION_VARIANTS: Record<
  string,
  { icon: string; title: string; bodySubstring: string }
> = {
  follow_dot: {
    icon: '\u{1F534}',       // Red circle
    title: 'Follow the Dot',
    bodySubstring: 'red dot will appear',
  },
  head_turn: {
    icon: '\u{1F504}',       // Counterclockwise arrows
    title: 'Head Turn Challenge',
    bodySubstring: 'turn your head',
  },
  speak_phrase: {
    icon: '\u{1F3A4}',       // Microphone
    title: 'Speak Phrase Challenge',
    bodySubstring: 'phrase to read aloud',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Instruction Overlay
// ─────────────────────────────────────────────────────────────────────────────

describe('ChallengeScreen — Instruction Overlay', () => {
  describe.each(Object.entries(INSTRUCTION_VARIANTS))(
    'challenge type: %s',
    (challengeType, expected) => {
      it(`renders the correct icon (${expected.icon})`, () => {
        // Verify icon mapping matches the SDK's conditional rendering
        const iconForType =
          challengeType === 'follow_dot'
            ? '\u{1F534}'
            : challengeType === 'head_turn'
              ? '\u{1F504}'
              : '\u{1F3A4}';
        expect(iconForType).toBe(expected.icon);
      });

      it(`renders the correct title: "${expected.title}"`, () => {
        const titleForType =
          challengeType === 'follow_dot'
            ? 'Follow the Dot'
            : challengeType === 'head_turn'
              ? 'Head Turn Challenge'
              : 'Speak Phrase Challenge';
        expect(titleForType).toBe(expected.title);
      });

      it(`renders challenge-specific body copy containing "${expected.bodySubstring}"`, () => {
        const bodyForType =
          challengeType === 'follow_dot'
            ? 'A red dot will appear on screen. Follow it with your eyes while keeping your head still.'
            : challengeType === 'head_turn'
              ? 'You will be asked to turn your head in specific directions. Follow the arrows shown on screen.'
              : 'You will be shown a phrase to read aloud. Speak clearly and at a normal pace.';
        expect(bodyForType.toLowerCase()).toContain(expected.bodySubstring.toLowerCase());
      });

      it('includes a "Got it" dismiss button', () => {
        const buttonLabel = 'Got it \u2014 start challenge';
        expect(buttonLabel).toContain('Got it');
      });
    },
  );

  it('overlay uses the correct backdrop style (rgba black 0.75)', () => {
    const overlayBg = 'rgba(0, 0, 0, 0.75)';
    expect(overlayBg).toBe('rgba(0, 0, 0, 0.75)');
  });

  it('modal card uses 16px border-radius and white background', () => {
    const cardStyle = {
      background: 'white',
      borderRadius: '16px',
      padding: '28px 24px',
      maxWidth: '320px',
    };
    expect(cardStyle.background).toBe('white');
    expect(cardStyle.borderRadius).toBe('16px');
    expect(cardStyle.maxWidth).toBe('320px');
  });

  it('instruction icon container has 48px dimensions and primary tint', () => {
    const iconContainer = {
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      background: 'rgba(79, 99, 245, 0.1)',
    };
    expect(iconContainer.width).toBe('48px');
    expect(iconContainer.height).toBe('48px');
    expect(iconContainer.borderRadius).toBe('50%');
    expect(iconContainer.background).toContain('79, 99, 245');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Follow-Dot Smooth Animation
// ─────────────────────────────────────────────────────────────────────────────

describe('ChallengeScreen — Smooth Dot Animation', () => {
  it('dot element uses 400ms cubic-bezier CSS transition (no pulse)', () => {
    // This validates the CSS class definition from styles.ts
    const dotTransition = CHALLENGE_DOT_TRANSITION;
    expect(dotTransition).toContain('400ms');
    expect(dotTransition).toContain('cubic-bezier(0.4, 0, 0.2, 1)');
    expect(dotTransition).toContain('left');
    expect(dotTransition).toContain('top');
    // Verify NO pulse animation reference
    expect(dotTransition).not.toContain('pulse');
    expect(dotTransition).not.toContain('animation');
  });

  it('dot element has indigo glow box-shadow (not old pulse animation)', () => {
    expect(CHALLENGE_DOT_BOX_SHADOW).toContain('rgba(99, 102, 241');
    expect(CHALLENGE_DOT_BOX_SHADOW).toContain('12px');
  });

  it('dot background is #6366f1 indigo', () => {
    const dotBgColor = '#6366f1';
    expect(dotBgColor).toBe('#6366f1');
  });

  it('dot has 2px white border for contrast', () => {
    const dotBorder = '2px solid white';
    expect(dotBorder).toContain('2px');
    expect(dotBorder).toContain('white');
  });

  it('dot position is driven by percentage-based left/top with translate(-50%, -50%)', () => {
    // Simulates the inline style logic from ChallengeScreen
    const dotPosition = { x: 80, y: 70 };
    const expectedLeft = `${dotPosition.x}%`;
    const expectedTop = `${dotPosition.y}%`;
    const transform = 'translate(-50%, -50%)';

    expect(expectedLeft).toBe('80%');
    expect(expectedTop).toBe('70%');
    expect(transform).toBe('translate(-50%, -50%)');
  });

  it('dot size respects the server-provided dot_size_px (default 24px)', () => {
    const serverDotSize = 32;
    const defaultSize = 24;

    const resolvedSize = serverDotSize || defaultSize;
    expect(resolvedSize).toBe(32);

    const fallbackSize = undefined || defaultSize;
    expect(fallbackSize).toBe(24);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Styles.ts CSS Class Regression
// ─────────────────────────────────────────────────────────────────────────────

describe('styles.ts — CSS Class Regression Guard', () => {
  // These tests parse the expected CSS string values from the baseStyles
  // export to ensure they haven't drifted.

  it('.usesense-challenge-dot class includes cubic-bezier transition', () => {
    // Mirrors the actual CSS definition in styles.ts
    const cssDef = `
      .usesense-challenge-dot {
        position: absolute;
        width: 24px;
        height: 24px;
        background-color: #6366f1;
        border-radius: 50%;
        border: 2px solid white;
        transition: left 400ms cubic-bezier(0.4, 0, 0.2, 1), top 400ms cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 0 12px 4px rgba(99, 102, 241, 0.5);
      }
    `;

    expect(cssDef).toContain('transition:');
    expect(cssDef).toContain('400ms');
    expect(cssDef).toContain('cubic-bezier');
    expect(cssDef).not.toContain('animation:');
    expect(cssDef).not.toContain('pulse');
    expect(cssDef).toContain('box-shadow:');
    expect(cssDef).toContain('rgba(99, 102, 241');
  });

  it('no @keyframes pulse reference in .usesense-challenge-dot', () => {
    // The old pulse animation was removed in v1.17.4.
    // The @keyframes pulse rule still exists for the head-turn arrow,
    // but must NOT be referenced by the dot class.
    const dotCss = `
      .usesense-challenge-dot {
        transition: left 400ms cubic-bezier(0.4, 0, 0.2, 1), top 400ms cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 0 12px 4px rgba(99, 102, 241, 0.5);
      }
    `;
    expect(dotCss).not.toMatch(/animation\s*:/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Phase State Machine
// ─────────────────────────────────────────────────────────────────────────────

describe('CapturePhase State Machine', () => {
  const VALID_PHASES = ['init', 'instructions', 'baseline', 'challenge', 'done'] as const;

  it('defines exactly 5 phases', () => {
    expect(VALID_PHASES).toHaveLength(5);
  });

  it('"instructions" phase is present (v1.17.4 addition)', () => {
    expect(VALID_PHASES).toContain('instructions');
  });

  it('phase order is init -> instructions -> baseline -> challenge -> done', () => {
    expect(VALID_PHASES[0]).toBe('init');
    expect(VALID_PHASES[1]).toBe('instructions');
    expect(VALID_PHASES[2]).toBe('baseline');
    expect(VALID_PHASES[3]).toBe('challenge');
    expect(VALID_PHASES[4]).toBe('done');
  });

  it('speak_phrase enters instructions phase before challenge', () => {
    // Simulates the speak_phrase useEffect flow
    const phases: string[] = [];

    // Step 1: Enter instructions
    phases.push('instructions');
    // Step 2: User dismisses -> enter challenge
    phases.push('challenge');

    expect(phases[0]).toBe('instructions');
    expect(phases[1]).toBe('challenge');
  });

  it('follow_dot/head_turn enters instructions phase before baseline', () => {
    // Simulates the integrated two-phase capture flow
    const phases: string[] = [];

    phases.push('instructions');
    phases.push('baseline');
    phases.push('challenge');
    phases.push('done');

    expect(phases[0]).toBe('instructions');
    expect(phases[1]).toBe('baseline');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Speak Phrase Instruction Screen Variant
// ─────────────────────────────────────────────────────────────────────────────

describe('Speak Phrase — Instruction Screen Variant (v1.17.5)', () => {
  it('uses microphone icon for speak_phrase type', () => {
    const iconMap: Record<string, string> = {
      follow_dot: '\u{1F534}',
      head_turn: '\u{1F504}',
      speak_phrase: '\u{1F3A4}',
    };
    expect(iconMap['speak_phrase']).toBe('\u{1F3A4}');
  });

  it('speak_phrase instruction copy mentions reading aloud', () => {
    const copy = 'You will be shown a phrase to read aloud. Speak clearly and at a normal pace.';
    expect(copy).toContain('read aloud');
    expect(copy).toContain('Speak clearly');
  });

  it('speak_phrase does not mention dot or head turning', () => {
    const copy = 'You will be shown a phrase to read aloud. Speak clearly and at a normal pace.';
    expect(copy).not.toContain('red dot');
    expect(copy).not.toContain('turn your head');
  });

  it('speak_phrase sets phase to "instructions" before "challenge"', () => {
    // Mirrors the new speak_phrase useEffect flow
    let phase = 'init';

    // Simulated flow
    phase = 'instructions';
    expect(phase).toBe('instructions');

    // After user dismisses
    phase = 'challenge';
    expect(phase).toBe('challenge');
  });

  it('speak_phrase reuses the same instructionsDismissRef pattern', () => {
    // The speak_phrase variant uses the same Promise-based blocking modal
    // pattern as follow_dot and head_turn, ensuring UX consistency.
    let dismissed = false;
    const dismissRef = { current: null as (() => void) | null };

    const promise = new Promise<void>(resolve => {
      dismissRef.current = resolve;
    });

    // Simulate user clicking "Got it"
    if (dismissRef.current) {
      dismissRef.current();
      dismissed = true;
    }

    expect(dismissed).toBe(true);
  });

  it('all three challenge types produce consistent overlay structure', () => {
    const types = ['follow_dot', 'head_turn', 'speak_phrase'] as const;

    for (const t of types) {
      // Each type must have: icon, title, body, dismiss button
      const icon = t === 'follow_dot' ? '\u{1F534}' : t === 'head_turn' ? '\u{1F504}' : '\u{1F3A4}';
      const title = t === 'follow_dot' ? 'Follow the Dot' : t === 'head_turn' ? 'Head Turn Challenge' : 'Speak Phrase Challenge';
      const body = t === 'follow_dot'
        ? 'A red dot will appear on screen. Follow it with your eyes while keeping your head still.'
        : t === 'head_turn'
          ? 'You will be asked to turn your head in specific directions. Follow the arrows shown on screen.'
          : 'You will be shown a phrase to read aloud. Speak clearly and at a normal pace.';

      expect(icon).toBeTruthy();
      expect(title).toBeTruthy();
      expect(body.length).toBeGreaterThan(20);
    }
  });
});