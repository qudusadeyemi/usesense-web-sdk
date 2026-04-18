/**
 * SNR emission overlay.
 *
 * Renders the per-state color as a peripheral ring around the camera
 * preview. The center of the viewport is masked so the camera oval
 * remains visible; the surrounding area (approximately 25% of viewport
 * at the default cutout radius) emits the nonce-derived color.
 *
 * The component is deliberately thin: no timing logic, no capture
 * orchestration. It subscribes to a state via the `state` prop and the
 * SNRChallengeController drives prop updates. Keeping presentation and
 * orchestration separate makes both halves trivially testable.
 */

import React, { useEffect } from 'react';
import type { SNRHslState } from './SNRChallengeController';

/** Props for the emission overlay. */
export interface SNREmissionOverlayProps {
  /**
   * Current state being emitted. `null` to display the neutral-gray
   * baseline (between states or before/after the challenge).
   */
  state: SNRHslState | null;
  /**
   * Radius of the central transparent cutout as a fraction of the shorter
   * viewport dimension. Defaults to 0.30 so the central 30% (by radius,
   * ~28% by area for a square viewport) passes the camera preview through.
   */
  cutoutRadius?: number;
  /**
   * CSS color string for the neutral baseline. Defaults to mid-gray per
   * spec section 5.3.1. Override only for accessibility variants.
   */
  neutralColor?: string;
  /**
   * When true, the overlay fades in/out rather than hard-cutting. Not used
   * by the default SNR challenge (sharp transitions are required for
   * Signal A); the prop exists for the accessibility-alt profile.
   */
  softTransitions?: boolean;
}

/**
 * Full-viewport fixed overlay that paints the emission ring.
 *
 * Rendering model: a single fixed-position element spans the viewport,
 * colored with the emission hue or the neutral baseline. A radial mask
 * punches a transparent circle at the center so the camera preview
 * underneath remains fully visible.
 */
export const SNREmissionOverlay: React.FC<SNREmissionOverlayProps> = ({
  state,
  cutoutRadius = 0.30,
  neutralColor = 'hsl(0, 0%, 50%)',
  softTransitions = false,
}) => {
  // Inject the mask keyframes / support rules once per mount. We keep the
  // <style> inline rather than in styles.ts to keep the module self-
  // contained and let tree-shaking drop SNR if the host never imports it.
  useEffect(() => {
    const id = 'usesense-snr-overlay-style';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = `
.usesense-snr-emission {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}
.usesense-snr-emission--soft {
  transition: background-color 120ms ease;
}
`;
    document.head.appendChild(el);
  }, []);

  const backgroundColor = state
    ? `hsl(${state.h}, ${(state.s * 100).toFixed(1)}%, ${(state.l * 100).toFixed(1)}%)`
    : neutralColor;

  // Mask: transparent circle at center of given radius (as fraction of
  // the shorter viewport dimension via vmin), opaque elsewhere.
  const r = Math.max(0, Math.min(0.5, cutoutRadius));
  const cutoutPct = (r * 100).toFixed(2);
  const maskImage = `radial-gradient(circle at 50% 50%, transparent 0 ${cutoutPct}vmin, black ${cutoutPct}vmin 100%)`;

  return (
    <div
      aria-hidden="true"
      data-testid="snr-emission-overlay"
      className={`usesense-snr-emission${softTransitions ? ' usesense-snr-emission--soft' : ''}`}
      style={{
        backgroundColor,
        maskImage,
        WebkitMaskImage: maskImage,
      }}
    />
  );
};

/**
 * Check whether the user has previously dismissed the SNR pre-screen
 * notice (spec section 8.1). The host app shows a brief notice before
 * the first session that uses SNR; subsequent sessions skip it.
 *
 * @param storage - `localStorage`-compatible object. Defaults to `window.localStorage`.
 * @returns `true` if the notice has already been dismissed.
 */
export function hasSeenSnrPreScreen(
  storage?: Pick<Storage, 'getItem'>,
): boolean {
  try {
    const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    return s?.getItem('usesense.snr.preScreenSeen') === '1';
  } catch {
    return false;
  }
}

/**
 * Mark the SNR pre-screen notice as dismissed by the user.
 *
 * @param storage - `localStorage`-compatible object. Defaults to `window.localStorage`.
 */
export function markSnrPreScreenSeen(
  storage?: Pick<Storage, 'setItem'>,
): void {
  try {
    const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    s?.setItem('usesense.snr.preScreenSeen', '1');
  } catch {
    // Ignore; storage failures are not critical to the challenge flow.
  }
}

/**
 * Return `true` if the user has requested reduced motion. Hosts should
 * refuse the default SNR profile when this is true and request the
 * `reduced-flash` accessibility profile from the server instead.
 */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
