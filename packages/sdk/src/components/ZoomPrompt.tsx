/**
 * ZoomPrompt
 *
 * Phase 1 ticket X-2.
 *
 * Renders the v4 zoom-motion UI: a framing oval whose size transitions
 * between a "framing" state (user at arm's length, approximately 30cm)
 * and an "enlarged" state (user has moved the phone/webcam closer,
 * approximately 18cm). The visible transition is the instruction itself;
 * the user naturally moves the camera closer to re-frame their face in
 * the larger oval, producing the perspective-distortion signal the
 * server scores.
 *
 * This component is purely presentational. It does not touch the camera,
 * does not measure bounding boxes, and does not emit events on its own.
 * The parent wires it to a state machine (see X-5) and an event source
 * (see X-3 zoom-motion controller).
 *
 * Accessibility:
 *   - prefers-reduced-motion: the 250ms scale transition is skipped; the
 *     oval snaps to the new size instantly.
 *   - aria-live="polite" on the guidance text so screen readers announce
 *     phase changes without interrupting the user mid-action.
 *   - The oval itself is decorative; guidance is in text.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

/** The two positional states of the framing oval. */
export type ZoomOvalState = 'framing' | 'enlarged';

/** User-facing substatus emitted by the parent (usually from X-3 controller). */
export type ZoomGuidanceTone = 'neutral' | 'positive' | 'warning';

export interface ZoomPromptProps {
  /** Current oval state. Transitions when the value flips. */
  state: ZoomOvalState;

  /**
   * The guidance string to display above the oval. Example copy:
   *   framing: "Fit your face in the oval"
   *   enlarged: "Move phone closer to fit in the new oval"
   */
  guidance: string;

  /** Tone for the guidance region; affects colour only. */
  tone?: ZoomGuidanceTone;

  /**
   * Optional primary brand colour for the positive state. Defaults to a
   * UseSense-brand green. v3 ships no dependency on this; any hex works.
   */
  primaryColor?: string;

  /**
   * Called once the CSS transition to the enlarged state finishes.
   * The parent uses this to advance the phase machine AFTER the animation
   * completes so there's no visual flicker. Not called in reduced-motion
   * mode because the transition is skipped; parent should still advance
   * on its own timer in that case.
   */
  onEnlargeAnimationComplete?: () => void;

  /**
   * Test hook: override the reduced-motion preference. If undefined, the
   * component reads window.matchMedia. Set to `true` or `false` to force.
   */
  reducedMotionOverride?: boolean;

  /** Optional className for outer container. */
  className?: string;
}

// ─── Oval sizing ────────────────────────────────────────────────────────────
// Framing state matches the existing v3/v4.1 SDK oval (44vmin x 59vmin) so
// face-guide detection behaves identically before the zoom prompt fires.
// Enlarged state is 1.4x each axis, which corresponds to a 30cm -> 18cm
// shift at typical FOV; see LiveSense v4 spec section 4.2.
const FRAMING_W_VMIN = 44;
const FRAMING_H_VMIN = 59;
const ENLARGED_SCALE = 1.4;
const TRANSITION_MS = 250;

function usePrefersReducedMotion(override?: boolean): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof override === 'boolean') return override;
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof override === 'boolean') return;
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    // Safari <14 uses addListener; modern uses addEventListener. Fall back.
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    // @ts-ignore legacy API
    mq.addListener(onChange);
    // @ts-ignore legacy API
    return () => mq.removeListener(onChange);
  }, [override]);

  return reduced;
}

export function ZoomPrompt(props: ZoomPromptProps) {
  const {
    state,
    guidance,
    tone = 'neutral',
    primaryColor = '#7BD89C',
    onEnlargeAnimationComplete,
    reducedMotionOverride,
    className,
  } = props;

  const reducedMotion = usePrefersReducedMotion(reducedMotionOverride);

  // When state flips to enlarged, fire the completion callback either after
  // the CSS transition ends OR immediately in reduced-motion mode. We use a
  // ref for the callback so parent re-renders with a new callback reference
  // don't retrigger the effect.
  const completeRef = useRef(onEnlargeAnimationComplete);
  completeRef.current = onEnlargeAnimationComplete;

  useEffect(() => {
    if (state !== 'enlarged') return;
    if (reducedMotion) {
      // Parent is expected to advance via its own timer; we do not fire the
      // callback in reduced motion to avoid double-advance.
      return;
    }
    const t = window.setTimeout(() => {
      completeRef.current?.();
    }, TRANSITION_MS + 20); // small cushion past the declared transition
    return () => window.clearTimeout(t);
  }, [state, reducedMotion]);

  const ovalStyle = useMemo<React.CSSProperties>(() => {
    const baseW = FRAMING_W_VMIN;
    const baseH = FRAMING_H_VMIN;
    const scale = state === 'enlarged' ? ENLARGED_SCALE : 1;
    return {
      position: 'absolute',
      top: '40%',
      left: '50%',
      transform: `translate(-50%, -50%) scale(${scale})`,
      width: `${baseW}vmin`,
      height: `${baseH}vmin`,
      border: '3px solid rgba(255, 255, 255, 0.95)',
      borderRadius: '50%',
      pointerEvents: 'none',
      boxShadow: '0 0 0 4px rgba(255, 255, 255, 0.08)',
      transition: reducedMotion
        ? 'none'
        : `transform ${TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
      willChange: reducedMotion ? undefined : 'transform',
    };
  }, [state, reducedMotion]);

  const guidanceColour =
    tone === 'positive'
      ? primaryColor
      : tone === 'warning'
        ? '#F6C36B'
        : '#FFFFFF';

  return (
    <div
      className={className ? `usesense-zoom-prompt ${className}` : 'usesense-zoom-prompt'}
      data-state={state}
      data-testid="usesense-zoom-prompt"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      <div
        data-testid="usesense-zoom-prompt-oval"
        aria-hidden="true"
        style={ovalStyle}
      />
      <div
        role="status"
        aria-live="polite"
        data-testid="usesense-zoom-prompt-guidance"
        style={{
          position: 'absolute',
          top: '12%',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '1.05rem',
          fontWeight: 500,
          color: guidanceColour,
          padding: '0 24px',
          textShadow: '0 1px 4px rgba(0, 0, 0, 0.4)',
        }}
      >
        {guidance}
      </div>
    </div>
  );
}

/** Exposed for tests and documentation so callers can compute their own timing. */
export const ZOOM_PROMPT_TRANSITION_MS = TRANSITION_MS;
export const ZOOM_PROMPT_ENLARGED_SCALE = ENLARGED_SCALE;
