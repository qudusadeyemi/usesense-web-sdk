/**
 * Full-screen dark theme styles for the VerificationCaptureEngine.
 *
 * The SDK renders as a full-screen (or container-filling) dark overlay
 * with the camera feed as the primary visual element.
 *
 * Brand: UseSense Brand Manual v3.0
 * Fonts: Outfit (display), DM Sans (body), JetBrains Mono (code)
 * Easing: cubic-bezier(0.16, 1, 0.3, 1)
 */

import type { CaptureColors } from '../capture/quality-gate';

/** Google Fonts URL for the UseSense brand font stack. */
export const USESENSE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap';

/**
 * Design tokens the capture engine honours.
 *
 * Structurally a subset of the Flows `FlowTheme`, declared here rather than
 * imported so this component stays independent of the flows module (Sessions
 * use it too). `FlowRunner` maps its resolved theme onto this shape.
 *
 * Every field is optional and falls back to the built-in dark palette, so
 * `getEngineStyles(primaryColor)` with no theme renders exactly as before.
 */
export interface EngineTheme {
  bg?: string;
  fg?: string;
  muted?: string;
  card?: string;
  border?: string;
  primaryFg?: string;
  success?: string;
  destructive?: string;
  warning?: string;
  fontDisplay?: string;
  fontBody?: string;
  /** Light-mode surfaces used by the intro and result screens. */
  lightBg?: string;
  lightFg?: string;
  /**
   * Capture-screen colours (ring, contour lines, warning). Any colour below
   * 3:1 contrast on the dark camera background falls back to the Sense
   * default. Not a CSS token: the engine resolves it itself.
   */
  capture?: CaptureColors;
}

/** The palette that shipped before theming; also the fallback for every token. */
const ENGINE_DEFAULTS: Required<Omit<EngineTheme, 'capture'>> = {
  bg: '#1C1A17',
  fg: '#FFFFFF',
  muted: '#6B6760',
  card: '#F5F3EF',
  border: '#E8E5DE',
  primaryFg: '#FFFFFF',
  success: '#00D4AA',
  destructive: '#FF6B4A',
  warning: '#FFB84D',
  fontDisplay: "'Outfit', sans-serif",
  fontBody: "'DM Sans', sans-serif",
  lightBg: '#FDFCFA',
  lightFg: '#1C1A17',
};

/**
 * The engine's tokens with defaults filled in. An undefined token (e.g.
 * lightBg in light mode from the Flow mapper) keeps the default rather than
 * writing "undefined" into the CSS.
 */
export function resolveEngineTokens(theme?: EngineTheme): Required<Omit<EngineTheme, 'capture'>> {
  const { capture: _capture, ...tokens } = theme ?? {};
  void _capture;
  const set = Object.fromEntries(Object.entries(tokens).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  return { ...ENGINE_DEFAULTS, ...set } as typeof ENGINE_DEFAULTS;
}

export function getEngineStyles(primaryColor: string, theme?: EngineTheme): string {
  const t = resolveEngineTokens(theme);
  return `
    .usesense-engine {
      --us-bg: ${t.bg};
      --us-fg: ${t.fg};
      --us-muted: ${t.muted};
      --us-card: ${t.card};
      --us-border: ${t.border};
      --us-primary: ${primaryColor};
      --us-primary-fg: ${t.primaryFg};
      --us-success: ${t.success};
      --us-destructive: ${t.destructive};
      --us-warning: ${t.warning};
      --us-font-display: ${t.fontDisplay};
      --us-font-body: ${t.fontBody};
      --us-light-bg: ${t.lightBg};
      --us-light-fg: ${t.lightFg};
    }

    .usesense-engine {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 100vh;
      min-height: 100dvh;
      background: var(--us-bg);
      color: var(--us-fg);
      font-family: var(--us-font-body);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }

    /* Light theme -- intro and done phases */
    .usesense-engine--light {
      background: var(--us-light-bg);
      color: var(--us-light-fg);
    }

    .usesense-engine * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* -- Back button (intro, light theme) */

    .usesense-back-btn {
      position: absolute;
      top: 20px;
      left: 20px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.88rem;
      font-weight: 500;
      font-family: var(--us-font-body);
      color: var(--us-muted);
      padding: 6px 4px;
      z-index: 30;
      transition: color 150ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    .usesense-back-btn:hover {
      color: var(--us-light-fg);
    }

    /* -- Environment badge (intro, top-right) */

    .usesense-env-badge {
      position: absolute;
      top: 16px;
      right: 20px;
      font-size: 0.72rem;
      font-weight: 600;
      font-family: var(--us-font-body);
      color: #00AA88;
      border: 1px solid rgba(0,212,170,0.2);
      background: rgba(0,212,170,0.08);
      border-radius: 6px;
      padding: 4px 10px;
      z-index: 30;
    }

    /* -- Cancel button (dark phases, top-left plain text) */

    .usesense-cancel-btn {
      position: absolute;
      top: 20px;
      left: 20px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.88rem;
      font-weight: 500;
      font-family: var(--us-font-body);
      color: rgba(255, 255, 255, 0.85);
      padding: 6px 4px;
      z-index: 30;
    }

    /* -- Cancel pill (camera overlay, top-left) */

    .usesense-cancel-pill {
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(28, 26, 23, 0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: none;
      border-radius: 9999px;
      cursor: pointer;
      font-size: 0.88rem;
      font-weight: 500;
      font-family: var(--us-font-body);
      color: var(--us-fg);
      padding: 7px 16px;
      transition: background 150ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    /* -- Verifying badge (camera overlay, top-right) */

    .usesense-verifying-badge {
      position: absolute;
      top: 20px;
      right: 20px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: rgba(28, 26, 23, 0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-radius: 9999px;
      padding: 7px 14px;
      font-size: 0.72rem;
      font-weight: 600;
      font-family: var(--us-font-body);
      color: var(--us-fg);
    }

    /* -- Challenge brief screen */

    .usesense-challenge-brief-title {
      font-size: 1.6rem;
      font-weight: 700;
      font-family: var(--us-font-display);
      letter-spacing: -0.03em;
      color: var(--us-fg);
      text-align: center;
      margin-bottom: 4px;
    }

    .usesense-challenge-brief-desc {
      font-size: 0.88rem;
      font-family: var(--us-font-body);
      color: rgba(255, 255, 255, 0.5);
      text-align: center;
      line-height: 1.65;
      max-width: 360px;
    }

    .usesense-challenge-brief-tip {
      background: rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 16px 20px;
      font-size: 0.88rem;
      font-family: var(--us-font-body);
      color: rgba(255, 255, 255, 0.5);
      text-align: center;
      max-width: 420px;
      width: 100%;
    }

    /* -- Video */

    .usesense-camera-container {
      position: absolute;
      inset: 0;
      overflow: hidden;
      background: #0C0B09;
    }

    .usesense-camera-video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    /* Blurred background layer - covers the whole screen */
    .usesense-camera-video--blurred {
      transform: scaleX(-1) scale(1.06);
      filter: blur(20px) brightness(0.45);
      z-index: 1;
    }

    /* Clear layer - shows only the oval area unblurred */
    .usesense-camera-video--clear {
      transform: scaleX(-1);
      clip-path: ellipse(22vmin 29.5vmin at 50% 40%);
      z-index: 2;
    }

    /* -- Face Oval */

    .usesense-face-oval {
      position: absolute;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 44vmin;
      height: 59vmin;
      border: 3px solid rgba(255, 255, 255, 0.9);
      border-radius: 50%;
      pointer-events: none;
      z-index: 3;
      animation: usesense-pulse-oval 2s ease-in-out infinite;
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.08);
    }

    .usesense-face-oval--ready {
      border-color: var(--us-fg);
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
      animation: none;
    }

    .usesense-face-oval--baseline {
      border-color: rgba(255, 255, 255, 0.5);
      animation: none;
    }

    /* -- Guided capture (quality gate, contour scan, fill light) */

    .usesense-contour-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 3;
      pointer-events: none;
    }

    .usesense-sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .usesense-shutter {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 68px;
      height: 68px;
      margin-top: 14px;
      border-radius: 50%;
      border: 4px solid rgba(255, 255, 255, 0.95);
      background: transparent;
      cursor: pointer;
      padding: 0;
    }

    .usesense-shutter:focus-visible {
      outline: 3px solid var(--us-capture-ring);
      outline-offset: 3px;
    }

    .usesense-shutter-inner {
      display: block;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #FFFFFF;
      transition: transform 120ms ease;
    }

    .usesense-shutter:active .usesense-shutter-inner {
      transform: scale(0.9);
    }

    /* Fill light: the canvas paints warm white around the oval (browsers
       cannot raise screen brightness). The light is fixed warm white whatever
       the theme, so the shutter's ink on it is fixed too. */
    .usesense-engine--fill .usesense-shutter {
      border-color: #2A251E;
    }

    .usesense-engine--fill .usesense-shutter-inner {
      background: #2A251E;
    }

    /* Guided capture screen (visual spec v1: capture-test-kit reference).
       Full-bleed mirrored preview; guide, lines and ring are on the canvas. */
    .usesense-camera-container--guided {
      background: #0D0F14;
    }

    .usesense-camera-container--guided .usesense-camera-video--blurred {
      display: none;
    }

    .usesense-camera-container--guided .usesense-camera-video--clear {
      clip-path: none;
    }

    .usesense-capture-blur {
      position: absolute;
      inset: 0;
      z-index: 4;
      background: rgba(13, 15, 20, 0.25);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      pointer-events: none;
    }

    .usesense-capture-top {
      position: absolute;
      left: 16px;
      right: 16px;
      top: 54px;
      z-index: 6;
      display: flex;
      justify-content: space-between;
      pointer-events: none;
    }

    .usesense-capture-circ {
      pointer-events: auto;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      padding: 0;
      background: rgba(13, 15, 20, 0.55);
      color: #F4F5F8;
      display: grid;
      place-items: center;
      font-size: 16px;
      font-family: var(--us-font-body);
      cursor: pointer;
    }

    .usesense-capture-circ svg {
      width: 16px;
      height: 16px;
    }

    .usesense-capture-circ:focus-visible {
      outline: 2px solid var(--us-capture-ring);
      outline-offset: 2px;
    }

    /* Guidance (spec v1.1): plain centred text, top edge 28 px below the
       oval (oval bottom = 40% + 23.5% of the height). No box, no icon. */
    .usesense-guidance {
      position: absolute;
      left: 24px;
      right: 24px;
      top: calc(63.5% + 28px);
      z-index: 5;
      text-align: center;
      color: #FFFFFF;
      font-family: var(--us-font-body);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35), 0 2px 14px rgba(0, 0, 0, 0.45);
      pointer-events: none;
      animation: usesense-guidance-in 200ms ease;
    }

    .usesense-guidance-text {
      display: block;
      font-size: 22px;
      font-weight: 600;
      line-height: 1.25;
      letter-spacing: -0.01em;
    }

    .usesense-guidance-sub {
      display: block;
      margin-top: 6px;
      font-size: 15px;
      font-weight: 500;
      line-height: 1.35;
      color: rgba(255, 255, 255, 0.82);
    }

    @keyframes usesense-guidance-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .usesense-shutter--guided {
      position: absolute;
      left: 50%;
      top: 85%;
      transform: translate(-50%, -50%);
      margin: 0;
      z-index: 5;
    }

    .usesense-upload-sheet {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 8px;
      z-index: 7;
      display: grid;
      gap: 10px;
      justify-items: center;
      padding: 22px;
      border-radius: 28px;
      background: #1D2029;
      color: #F4F5F8;
      text-align: center;
      font-family: var(--us-font-body);
    }

    .usesense-upload-sheet-title {
      font-size: 18px;
      font-weight: 600;
    }

    .usesense-upload-sheet-sub {
      font-size: 13px;
      color: #A3A9B8;
    }

    .usesense-upload-sheet-bar {
      width: 100%;
      height: 4px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.12);
      overflow: hidden;
    }

    .usesense-upload-sheet-bar i {
      display: block;
      height: 100%;
      background: var(--us-capture-ring);
      /* Redrawn every frame by the engine; a transition would lag it. */
    }

    /* Extra check and end screens (end-user storyboard, flows 4 to 6). */
    .usesense-xc-overlay {
      position: absolute;
      inset: 0;
      z-index: 4;
      pointer-events: none;
    }

    .usesense-xc-arrow {
      fill: none;
      stroke: #FFFFFF;
      stroke-width: 5;
      stroke-linecap: round;
      animation: usesense-xc-nudge 1.2s ease-in-out infinite;
    }

    @keyframes usesense-xc-nudge {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.55; }
    }

    .usesense-xc-tick {
      animation: usesense-guidance-in 200ms ease;
    }

    .usesense-xc-digits {
      position: absolute;
      left: 50%;
      top: 96px;
      transform: translateX(-50%);
      z-index: 5;
      background: rgba(13, 15, 20, 0.72);
      border-radius: 16px;
      padding: 10px 22px;
      color: #FFFFFF;
      font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 34px;
      font-weight: 500;
      letter-spacing: 0.32em;
      white-space: nowrap;
    }

    .usesense-xc-meter {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      z-index: 5;
      display: flex;
      gap: 5px;
      align-items: flex-end;
      height: 34px;
      pointer-events: none;
    }

    .usesense-xc-meter span {
      width: 6px;
      border-radius: 3px;
      background: #00D4AA;
    }

    .usesense-xc-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
    }

    .usesense-xc-sheet {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 8px;
      z-index: 7;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 26px 24px 24px;
      border-radius: 28px;
      background: #1D2029;
      color: #FFFFFF;
      font-family: var(--us-font-body);
      text-align: left;
      animation: usesense-xc-rise 240ms ease;
    }

    @keyframes usesense-xc-rise {
      from { transform: translateY(24px); opacity: 0; }
      to { transform: none; opacity: 1; }
    }

    .usesense-xc-sheet-title {
      font-size: 20px;
      font-weight: 600;
    }

    .usesense-xc-sheet-body {
      font-size: 15px;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.78);
    }

    .usesense-xc-primary {
      height: 56px;
      border: none;
      border-radius: 14px;
      background: var(--us-primary);
      color: var(--us-primary-fg);
      font-family: var(--us-font-body);
      font-size: 17px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
    }

    .usesense-xc-primary--sheet {
      height: 54px;
      margin-top: 6px;
    }

    .usesense-xc-secondary {
      height: 48px;
      border: none;
      background: none;
      color: rgba(255, 255, 255, 0.8);
      font-family: var(--us-font-body);
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
    }

    .usesense-xc-primary:focus-visible,
    .usesense-xc-secondary:focus-visible,
    .usesense-xc-dialog button:focus-visible {
      outline: 2px solid #FFFFFF;
      outline-offset: 2px;
    }

    .usesense-xc-page {
      position: absolute;
      inset: 0;
      z-index: 40;
      background: #12141B;
      color: #FFFFFF;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 16px;
      padding: 120px 28px 40px;
      box-sizing: border-box;
      font-family: var(--us-font-body);
      text-align: left;
      overflow-y: auto;
    }

    .usesense-xc-page-title {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.01em;
      font-family: var(--us-font-body);
    }

    .usesense-xc-page-body {
      margin: 0;
      font-size: 16px;
      line-height: 1.55;
      color: rgba(255, 255, 255, 0.75);
    }

    .usesense-xc-tips {
      list-style: none;
      margin: 4px 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .usesense-xc-tips li {
      display: flex;
      gap: 12px;
      align-items: center;
      font-size: 15px;
      color: rgba(255, 255, 255, 0.85);
    }

    .usesense-xc-tips li span {
      width: 8px;
      height: 8px;
      border-radius: 4px;
      background: #7A96FF;
      flex: none;
    }

    .usesense-xc-spacer {
      flex: 1;
    }

    @media (min-width: 600px) {
      .usesense-xc-page {
        padding-left: max(28px, calc(50% - 220px));
        padding-right: max(28px, calc(50% - 220px));
        padding-top: 96px;
      }
      .usesense-xc-sheet {
        left: 50%;
        right: auto;
        width: min(420px, calc(100% - 16px));
        transform: translateX(-50%);
        animation: none;
      }
    }

    .usesense-xc-scrim {
      position: absolute;
      inset: 0;
      z-index: 50;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
    }

    .usesense-xc-dialog {
      width: 290px;
      max-width: 100%;
      background: #1D2029;
      color: #FFFFFF;
      border-radius: 20px;
      padding: 20px 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-family: var(--us-font-body);
    }

    .usesense-xc-dialog-title {
      font-size: 17px;
      font-weight: 600;
      text-align: center;
    }

    .usesense-xc-dialog-body {
      font-size: 14px;
      line-height: 1.45;
      text-align: center;
      opacity: 0.8;
    }

    .usesense-xc-dialog-buttons {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 6px;
    }

    .usesense-xc-dialog-buttons button {
      height: 44px;
      border: none;
      border-radius: 10px;
      font-family: var(--us-font-body);
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    }

    .usesense-xc-dialog-no {
      background: rgba(127, 127, 127, 0.18);
      color: #FFFFFF;
    }

    .usesense-xc-dialog-yes {
      background: var(--us-primary);
      color: var(--us-primary-fg);
    }

    @media (prefers-reduced-motion: reduce) {
      .usesense-face-oval,
      .usesense-guidance,
      .usesense-countdown-number,
      .usesense-direction-arrow,
      .usesense-follow-dot,
      .usesense-recording-dot,
      .usesense-xc-arrow,
      .usesense-xc-tick,
      .usesense-xc-sheet {
        animation: none !important;
      }
      .usesense-progress-fill,
      .usesense-shutter-inner {
        transition: none !important;
      }
    }

    /* -- Status Bar (absolute bottom overlay) */

    .usesense-status-area {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 10;
      padding: 24px 24px 48px;
      text-align: center;
      background: linear-gradient(to top, rgba(12, 11, 9, 0.8) 0%, transparent 100%);
    }

    .usesense-phase-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.58rem;
      font-weight: 700;
      font-family: var(--us-font-body);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-bottom: 8px;
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.5);
    }

    .usesense-status-text {
      font-size: 1rem;
      font-weight: 700;
      font-family: var(--us-font-display);
      letter-spacing: -0.02em;
      color: var(--us-fg);
      margin-bottom: 4px;
    }

    .usesense-status-hint {
      font-size: 0.75rem;
      font-family: var(--us-font-body);
      color: rgba(255, 255, 255, 0.5);
    }

    /* -- Progress Bar */

    .usesense-progress {
      position: absolute;
      bottom: 130px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 48px);
      max-width: 360px;
      height: 4px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 9999px;
      overflow: hidden;
      z-index: 10;
    }

    .usesense-progress-fill {
      height: 100%;
      background: ${primaryColor};
      border-radius: 9999px;
      transition: width 250ms cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 0 8px ${primaryColor};
    }

    /* -- Buttons */

    .usesense-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 44px;
      padding: 0 24px;
      border-radius: 10px;
      border: none;
      font-size: 0.88rem;
      font-weight: 600;
      font-family: var(--us-font-body);
      cursor: pointer;
      transition: all 150ms cubic-bezier(0.16, 1, 0.3, 1);
      min-width: 160px;
    }

    .usesense-btn:hover { transform: scale(1.03); }
    .usesense-btn:active { transform: scale(0.97); }
    .usesense-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }
    .usesense-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(79,124,255,0.15); }

    .usesense-btn--primary {
      background: ${primaryColor};
      color: var(--us-fg);
      box-shadow: 0 4px 14px ${primaryColor}40;
    }

    .usesense-btn--primary:hover {
      background: ${primaryColor};
      opacity: 0.9;
    }

    .usesense-btn--secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--us-fg);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .usesense-engine--light .usesense-btn--secondary {
      background: #FFFFFF;
      color: var(--us-light-fg);
      border: 1px solid var(--us-border);
    }

    .usesense-engine--light .usesense-btn--secondary:hover {
      background: var(--us-card);
      border-color: #D0CCBF;
    }

    .usesense-btn--danger {
      background: var(--us-destructive);
      color: var(--us-fg);
    }

    .usesense-btn--danger:hover {
      background: #DB4E33;
    }

    /* -- Countdown */

    .usesense-countdown-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(12, 11, 9, 0.5);
      z-index: 20;
    }

    .usesense-countdown-number {
      font-size: 120px;
      font-weight: 800;
      font-family: var(--us-font-display);
      color: var(--us-fg);
      text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      animation: usesense-countdown-pop 0.9s cubic-bezier(0.16, 1, 0.3, 1);
      line-height: 1;
    }

    .usesense-countdown-label {
      font-size: 0.88rem;
      font-weight: 500;
      font-family: var(--us-font-body);
      color: rgba(255, 255, 255, 0.5);
      margin-top: 12px;
    }

    /* -- Challenge: Follow Dot */

    .usesense-follow-dot {
      position: absolute;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: radial-gradient(circle, var(--us-destructive) 0%, #DB4E33 100%);
      box-shadow: 0 0 20px rgba(255, 107, 74, 0.8),
                  0 0 40px rgba(255, 107, 74, 0.4);
      transform: translate(-50%, -50%);
      transition: left 250ms cubic-bezier(0.16, 1, 0.3, 1),
                  top 250ms cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 15;
      animation: usesense-dot-pulse 1s ease-in-out infinite;
    }

    /* -- Challenge: Direction Arrow */

    .usesense-direction-arrow {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      min-width: 120px;
      padding: 16px 20px;
      border-radius: 14px;
      background: rgba(28, 26, 23, 0.82);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      z-index: 15;
      animation: usesense-direction-enter 250ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    .usesense-direction-arrow svg {
      width: 40px;
      height: 40px;
      color: var(--us-fg);
      stroke-width: 2.5;
    }

    .usesense-direction-label {
      font-size: 0.58rem;
      font-weight: 700;
      font-family: var(--us-font-body);
      color: var(--us-fg);
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    /* -- Speak Phrase */

    .usesense-phrase-display {
      margin-top: 16px;
      padding: 16px 24px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      font-size: 1.6rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: 6px;
      color: var(--us-fg);
      text-align: center;
    }

    .usesense-recording-indicator {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      background: rgba(255, 107, 74, 0.08);
      border: 1px solid rgba(255, 107, 74, 0.2);
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 600;
      font-family: var(--us-font-body);
      color: var(--us-destructive);
      margin-bottom: 12px;
    }

    .usesense-recording-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--us-destructive);
      animation: usesense-blink 1s ease-in-out infinite;
    }

    /* -- Face Guide Feedback */

    .usesense-guide-feedback {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      background: rgba(12, 11, 9, 0.7);
      backdrop-filter: blur(8px);
      border-radius: 9999px;
      font-size: 0.88rem;
      font-weight: 500;
      font-family: var(--us-font-body);
      color: var(--us-fg);
      white-space: nowrap;
      z-index: 10;
    }

    .usesense-guide-feedback--ready {
      background: rgba(0, 212, 170, 0.15);
      border: 1px solid rgba(0, 212, 170, 0.3);
      color: var(--us-success);
    }

    /* -- Environment Warning */

    .usesense-env-warning {
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      padding: 4px 10px;
      background: rgba(255, 184, 77, 0.08);
      border: 1px solid rgba(255, 184, 77, 0.2);
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 600;
      font-family: var(--us-font-body);
      color: #DB973A;
      z-index: 10;
      white-space: nowrap;
    }

    /* -- Result Screens */

    .usesense-result {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 40px 24px;
      gap: 16px;
    }

    .usesense-result-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }

    .usesense-result-icon--success {
      background: rgba(0, 212, 170, 0.08);
      color: var(--us-success);
    }

    .usesense-result-icon--failure {
      background: rgba(255, 107, 74, 0.08);
      color: var(--us-destructive);
    }

    .usesense-result-icon--review {
      background: rgba(255, 184, 77, 0.08);
      color: var(--us-warning);
    }

    .usesense-result-icon svg {
      width: 40px;
      height: 40px;
    }

    .usesense-result-title {
      font-size: 1.6rem;
      font-weight: 700;
      font-family: var(--us-font-display);
      letter-spacing: -0.03em;
      color: var(--us-fg);
    }

    .usesense-engine--light .usesense-result-title {
      color: var(--us-light-fg);
    }

    .usesense-result-subtitle {
      font-size: 0.88rem;
      font-family: var(--us-font-body);
      color: rgba(255, 255, 255, 0.5);
      line-height: 1.65;
      max-width: 320px;
    }

    .usesense-engine--light .usesense-result-subtitle {
      color: var(--us-muted);
    }

    .usesense-engine--light .usesense-result-icon--success {
      background: rgba(0, 212, 170, 0.08);
    }

    .usesense-engine--light .usesense-result-icon--failure {
      background: rgba(255, 107, 74, 0.06);
    }

    .usesense-engine--light .usesense-result-icon--review {
      background: rgba(255, 184, 77, 0.06);
    }

    .usesense-btn--full {
      width: 100%;
      max-width: 420px;
      border-radius: 14px;
    }

    /* -- Upload Progress */

    .usesense-progress-track {
      width: 100%;
      max-width: 320px;
      height: 4px;
      margin-top: 18px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.1);
      overflow: hidden;
    }

    .usesense-engine--light .usesense-progress-track {
      background: rgba(0, 0, 0, 0.08);
    }

    .usesense-progress-fill {
      height: 100%;
      border-radius: 999px;
      background: ${primaryColor};
      /* Eases the jump between XHR progress events, which arrive in chunks. */
      transition: width 0.25s ease-out;
    }

    /* -- Loading Spinner */

    .usesense-spinner {
      width: 64px;
      height: 64px;
      border: 3.5px solid rgba(255, 255, 255, 0.08);
      border-top-color: ${primaryColor};
      border-radius: 50%;
      animation: usesense-spin 0.9s linear infinite;
    }

    /* -- Logo */

    .usesense-logo {
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      height: 28px;
      z-index: 30;
      opacity: 0.8;
    }

    /* -- Footer */

    .usesense-footer {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.65rem;
      font-family: 'JetBrains Mono', monospace;
      color: rgba(255, 255, 255, 0.3);
      white-space: nowrap;
      z-index: 5;
    }

    .usesense-engine--light .usesense-footer {
      color: #9E9A92;
    }

    /* -- Animations */

    @keyframes usesense-spin {
      to { transform: rotate(360deg); }
    }

    @keyframes usesense-pulse-oval {
      0%, 100% { opacity: 0.7; transform: translate(-50%, -50%) scale(1); }
      50% { opacity: 1; transform: translate(-50%, -50%) scale(1.02); }
    }

    @keyframes usesense-countdown-pop {
      0% { transform: scale(0.3); opacity: 0; }
      40% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }

    @keyframes usesense-direction-enter {
      0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
      60% { transform: translate(-50%, -50%) scale(1.1); }
      100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }

    @keyframes usesense-dot-pulse {
      0%, 100% { transform: translate(-50%, -50%) scale(1); }
      50% { transform: translate(-50%, -50%) scale(1.1); }
    }

    @keyframes usesense-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    /* -- Responsive (mobile) */

    @media (max-width: 640px) {
      .usesense-camera-container {
        max-width: 100%;
        border-radius: 0;
        aspect-ratio: auto;
        flex: 1;
      }

      .usesense-engine {
        padding: 0;
        min-height: 100vh;
        min-height: 100dvh;
      }

      /* Larger face oval for arm's-length use on mobile.
         Switch from vmin to vw so the oval scales with screen width
         (the constraining axis in portrait). */
      .usesense-face-oval {
        width: 60vw;
        height: 80vw;
        top: 38%;
      }

      /* Match the clear clip-path to the larger oval */
      .usesense-camera-video--clear {
        clip-path: ellipse(30vw 40vw at 50% 38%);
      }

      .usesense-btn {
        height: 52px;
        font-size: 1rem;
        border-radius: 14px;
      }

      .usesense-btn--full {
        max-width: 100%;
        border-radius: 10px;
      }

      .usesense-countdown-number {
        font-size: 96px;
      }

      .usesense-challenge-brief-title {
        font-size: 1.35rem;
      }

      .usesense-challenge-brief-desc {
        font-size: 0.82rem;
      }

      .usesense-challenge-brief-tip {
        font-size: 0.82rem;
        padding: 12px 16px;
        border-radius: 10px;
      }

      .usesense-result {
        padding: 32px 16px;
        gap: 12px;
      }

      .usesense-result-title {
        font-size: 1.35rem;
      }

      .usesense-result-subtitle {
        font-size: 0.82rem;
      }

      .usesense-phrase-display {
        font-size: 1.2rem;
        padding: 12px 16px;
        letter-spacing: 4px;
        border-radius: 10px;
      }

      .usesense-direction-arrow {
        min-width: 100px;
        padding: 12px 16px;
        border-radius: 10px;
      }

      .usesense-direction-arrow svg {
        width: 32px;
        height: 32px;
      }

      .usesense-progress {
        bottom: 110px;
        width: calc(100% - 32px);
      }

      .usesense-status-area {
        padding: 16px 16px 28px;
      }

      .usesense-cancel-pill,
      .usesense-verifying-badge {
        top: 12px;
      }

      .usesense-cancel-pill {
        left: 12px;
      }

      .usesense-verifying-badge {
        right: 12px;
      }

      .usesense-follow-dot {
        width: 48px;
        height: 48px;
      }

      .usesense-guide-feedback {
        bottom: 8px;
        font-size: 0.82rem;
        padding: 6px 14px;
      }

      .usesense-env-warning {
        top: 8px;
        font-size: 0.65rem;
      }
    }

    /* ── Step-Up: Flash Reflection Overlay ─────────────────────────────── */

    .usesense-flash-overlay {
      position: absolute;
      inset: 0;
      z-index: 25;
      opacity: 0.6;
      mix-blend-mode: screen;
      pointer-events: none;
      transition: background-color 0.05s ease;
    }

    .usesense-step-up-status {
      position: absolute;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 30;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      padding: 10px 24px;
      border-radius: 20px;
      font-size: 0.85rem;
      color: #fff;
      white-space: nowrap;
    }

    /* ── Step-Up: RMAS Action Prompt ───────────────────────────────────── */

    .usesense-rmas-card {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 30;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 16px;
      padding: 24px 32px;
      text-align: center;
      min-width: 240px;
      animation: usesense-rmas-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes usesense-rmas-in {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    .usesense-rmas-label {
      font-family: var(--us-font-display);
      font-size: 1.3rem;
      font-weight: 600;
      color: #fff;
      margin-bottom: 12px;
    }

    .usesense-rmas-step {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.6);
      margin-bottom: 10px;
    }

    .usesense-rmas-countdown-bar {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 2px;
      overflow: hidden;
    }

    .usesense-rmas-countdown-fill {
      height: 100%;
      background: ${primaryColor};
      border-radius: 2px;
      transition: width 0.1s linear;
    }

    /* ── Step-Up: Intro / Complete Overlays ────────────────────────────── */

    .usesense-step-up-overlay {
      position: absolute;
      inset: 0;
      z-index: 28;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      animation: usesense-stepup-fade-in 0.3s ease;
    }

    @keyframes usesense-stepup-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .usesense-step-up-icon {
      width: 48px;
      height: 48px;
      color: ${primaryColor};
      margin-bottom: 16px;
    }

    .usesense-step-up-title {
      font-family: var(--us-font-display);
      font-size: 1.2rem;
      font-weight: 600;
      color: #fff;
      margin-bottom: 8px;
    }

    .usesense-step-up-message {
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.7);
      text-align: center;
      max-width: 280px;
      line-height: 1.5;
    }
  `;
}
