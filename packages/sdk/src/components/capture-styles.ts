/**
 * Styles for the guided capture screens (BRAND-v1).
 *
 * Every colour here is a resolved capture-theme token (`var(--us-*)`, set on
 * the engine root from {@link captureThemeVars}) or an entry of the fixed list
 * {@link CAPTURE_FIXED_COLORS}. No literal colours: a test fails on any new
 * one (see __tests__/brand-guard.test.ts).
 *
 * Page tokens: --us-page-bg, --us-page-bg-image, --us-page-surface,
 * --us-page-fg, --us-page-muted, --us-page-muted-tint, --us-page-border,
 * --us-primary, --us-primary-fg, --us-primary-tint, --us-success(-tint),
 * --us-error(-tint), --us-warning(-tint).
 * Camera accents: --us-cam-ring, --us-cam-challenge(-tint), --us-cam-warning,
 * --us-cam-success.
 * Type and shape: --us-font-display, --us-font-body, --us-btn-radius,
 * --us-dialog-radius, --us-sheet-radius, --us-tile-radius, --us-logo-height.
 */

import { CAPTURE_FIXED_COLORS as F } from '../capture/capture-theme';

/** The guided capture stylesheet. */
export function getGuidedCaptureStyles(): string {
  return `
    .usesense-engine--guided {
      background: var(--us-page-bg);
      color: var(--us-page-fg);
      font-family: var(--us-font-body);
    }

    /* -- Camera surface (always dark; brand only as accents) */

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
      border: 4px solid ${F.shutterRing};
      background: transparent;
      cursor: pointer;
      padding: 0;
    }

    .usesense-shutter:focus-visible {
      outline: 3px solid var(--us-cam-ring);
      outline-offset: 3px;
    }

    .usesense-shutter-inner {
      display: block;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: ${F.shutter};
      transition: transform 120ms ease;
    }

    .usesense-shutter:active .usesense-shutter-inner {
      transform: scale(0.9);
    }

    /* EVIDENCE-v1 colour sequence: a flat tint over the preview, the
       guide and the fill-light veil, under the guidance text. Opacity and
       colour are set per segment by the colour player (fixed, never brand);
       no transition, so the colour changes on the frame it is recorded. */
    .usesense-colour-tint {
      position: absolute;
      inset: 0;
      z-index: 4;
      opacity: 0;
      background: transparent;
      pointer-events: none;
    }

    /* Fill light: the canvas paints warm white around the oval (browsers
       cannot raise screen brightness). The light is fixed warm white whatever
       the theme, so the shutter's ink on it is fixed too. */
    .usesense-engine--fill .usesense-shutter {
      border-color: ${F.shutterOnFill};
    }

    .usesense-engine--fill .usesense-shutter-inner {
      background: ${F.shutterOnFill};
    }

    /* Full-bleed mirrored preview; guide, lines and ring are on the canvas. */
    .usesense-camera-container--guided {
      background: ${F.cameraBackground};
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
      background: ${F.scanDim};
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
      background: ${F.cameraButton};
      color: ${F.cameraButtonInk};
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
      outline: 2px solid var(--us-cam-ring);
      outline-offset: 2px;
    }

    /* Guidance (spec v1.1): plain centred text, top edge 28 px below the
       oval (oval bottom = 40% + 23.5% of the height). No box, no icon. */
    .usesense-guidance {
      position: absolute;
      left: 24px;
      right: 24px;
      top: var(--us-guidance-top, calc(63.5% + 28px));
      z-index: 5;
      text-align: center;
      color: ${F.guidance};
      font-family: var(--us-font-body);
      text-shadow: ${F.guidanceShadow};
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
      color: ${F.guidanceSub};
    }

    @keyframes usesense-guidance-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .usesense-shutter--guided {
      position: absolute;
      left: 50%;
      top: var(--us-shutter-y, 85%);
      transform: translate(-50%, -50%);
      margin: 0;
      z-index: 5;
    }

    .usesense-powered {
      font-family: var(--us-font-body);
      font-size: 11px;
      text-align: center;
      color: var(--us-page-muted);
      white-space: nowrap;
    }

    .usesense-powered--camera {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 12px;
      z-index: 5;
      color: ${F.poweredOnCamera};
      pointer-events: none;
    }

    /* Extra check on the camera */
    .usesense-xc-overlay {
      position: absolute;
      inset: 0;
      z-index: 4;
      pointer-events: none;
    }

    .usesense-xc-arrow {
      fill: none;
      stroke: ${F.arrow};
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

    .usesense-xc-tick-disc { fill: var(--us-cam-success); fill-opacity: 0.9; }
    .usesense-xc-tick-mark { stroke: ${F.arrow}; }
    .usesense-xc-dot { fill: var(--us-cam-warning); }
    .usesense-xc-dot-ring,
    .usesense-xc-dot-trail { stroke: var(--us-cam-warning); }

    .usesense-xc-digits {
      position: absolute;
      left: 50%;
      top: 96px;
      transform: translateX(-50%);
      z-index: 5;
      background: ${F.digitsPill};
      border-radius: 16px;
      padding: 10px 22px;
      color: ${F.guidance};
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
      background: var(--us-cam-success);
    }

    /* -- Page surface (follows the full palette and mode) */

    .usesense-xc-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
      border-radius: var(--us-tile-radius);
    }

    .usesense-xc-badge--success { background: var(--us-success-tint); color: var(--us-success); }
    .usesense-xc-badge--warning { background: var(--us-warning-tint); color: var(--us-warning); }
    .usesense-xc-badge--danger { background: var(--us-error-tint); color: var(--us-error); }
    .usesense-xc-badge--info { background: var(--us-primary-tint); color: var(--us-primary); }
    .usesense-xc-badge--extra { background: var(--us-cam-challenge-tint); color: var(--us-cam-challenge); }

    .usesense-xc-illustration {
      display: block;
      max-width: 160px;
      max-height: 160px;
      object-fit: contain;
    }

    .usesense-upload-sheet,
    .usesense-xc-sheet {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 8px;
      z-index: 7;
      border-radius: var(--us-sheet-radius);
      background: var(--us-page-surface);
      color: var(--us-page-fg);
      font-family: var(--us-font-body);
    }

    .usesense-upload-sheet {
      display: grid;
      gap: 10px;
      justify-items: center;
      padding: 22px;
      text-align: center;
    }

    .usesense-upload-sheet-title {
      font-family: var(--us-font-display);
      font-size: 18px;
      font-weight: 600;
    }

    .usesense-upload-sheet-sub {
      font-size: 13px;
      color: var(--us-page-muted);
    }

    .usesense-upload-sheet-bar {
      width: 100%;
      height: 4px;
      border-radius: 4px;
      background: var(--us-page-border);
      overflow: hidden;
    }

    .usesense-upload-sheet-bar i {
      display: block;
      height: 100%;
      background: var(--us-cam-ring);
      /* Redrawn every frame by the engine; a transition would lag it. */
    }

    .usesense-xc-sheet {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 26px 24px 24px;
      text-align: left;
      animation: usesense-xc-rise 240ms ease;
    }

    @keyframes usesense-xc-rise {
      from { transform: translateY(24px); opacity: 0; }
      to { transform: none; opacity: 1; }
    }

    .usesense-xc-sheet-title {
      font-family: var(--us-font-display);
      font-size: 20px;
      font-weight: 600;
    }

    .usesense-xc-sheet-body {
      font-size: 15px;
      line-height: 1.5;
      color: var(--us-page-fg);
    }

    .usesense-xc-primary {
      height: 56px;
      border: 1.5px solid var(--us-primary);
      border-radius: var(--us-btn-radius);
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
      border-radius: var(--us-btn-radius);
      background: none;
      color: var(--us-page-muted);
      font-family: var(--us-font-body);
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
    }

    .usesense-xc-primary:focus-visible,
    .usesense-xc-secondary:focus-visible,
    .usesense-xc-cancel:focus-visible,
    .usesense-xc-dialog button:focus-visible {
      outline: 2px solid var(--us-primary);
      outline-offset: 2px;
    }

    .usesense-xc-page {
      position: absolute;
      inset: 0;
      z-index: 40;
      background-color: var(--us-page-bg);
      background-image: var(--us-page-bg-image);
      background-size: cover;
      background-position: center;
      color: var(--us-page-fg);
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 16px;
      padding: 120px 28px 16px;
      box-sizing: border-box;
      font-family: var(--us-font-body);
      text-align: left;
      overflow-y: auto;
    }

    .usesense-xc-page--header {
      padding-top: 24px;
    }

    .usesense-xc-header {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      min-height: var(--us-logo-height);
      margin-bottom: 56px;
    }

    .usesense-xc-header--center {
      justify-content: center;
    }

    .usesense-xc-header img {
      height: var(--us-logo-height);
      max-width: 180px;
      object-fit: contain;
    }

    .usesense-xc-header-name {
      font-family: var(--us-font-display);
      font-weight: 600;
      font-size: 17px;
      color: var(--us-page-fg);
    }

    .usesense-xc-page-title {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.01em;
      font-family: var(--us-font-display);
    }

    .usesense-xc-page-body {
      margin: 0;
      font-size: 16px;
      line-height: 1.55;
      color: var(--us-page-fg);
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
      color: var(--us-page-fg);
    }

    .usesense-xc-tips li span {
      width: 8px;
      height: 8px;
      border-radius: 4px;
      background: var(--us-primary);
      flex: none;
    }

    .usesense-xc-spacer {
      flex: 1;
    }

    .usesense-xc-page .usesense-powered {
      margin-top: 4px;
    }

    /* Loading and camera-request pages */
    .usesense-xc-loading {
      position: absolute;
      inset: 0;
      z-index: 20;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      padding: 24px 28px;
      background-color: var(--us-page-bg);
      background-image: var(--us-page-bg-image);
      background-size: cover;
      background-position: center;
      color: var(--us-page-fg);
      text-align: center;
      font-family: var(--us-font-body);
    }

    .usesense-xc-loading .usesense-xc-header {
      position: absolute;
      top: 24px;
      left: 28px;
      right: 28px;
      margin: 0;
    }

    .usesense-xc-loading .usesense-powered {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 16px;
    }

    .usesense-xc-loading-title {
      font-family: var(--us-font-display);
      font-size: 20px;
      font-weight: 600;
    }

    .usesense-xc-loading-body {
      font-size: 15px;
      line-height: 1.5;
      color: var(--us-page-muted);
      max-width: 320px;
    }

    .usesense-xc-cancel {
      position: absolute;
      top: 20px;
      right: 20px;
      z-index: 45;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.88rem;
      font-weight: 500;
      font-family: var(--us-font-body);
      color: var(--us-page-muted);
      padding: 6px 4px;
    }

    .usesense-loader-spinner {
      width: 48px;
      height: 48px;
      border: 3.5px solid var(--us-page-border);
      border-top-color: var(--us-primary);
      border-radius: 50%;
      animation: usesense-spin 0.9s linear infinite;
    }

    .usesense-loader-dots {
      display: flex;
      gap: 8px;
    }

    .usesense-loader-dots span {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--us-primary);
      animation: usesense-dot-blink 1.2s ease-in-out infinite;
    }

    .usesense-loader-dots span:nth-child(2) { animation-delay: 0.15s; }
    .usesense-loader-dots span:nth-child(3) { animation-delay: 0.3s; }

    @keyframes usesense-dot-blink {
      0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
      40% { opacity: 1; transform: scale(1); }
    }

    .usesense-loader-bar {
      width: 160px;
      height: 4px;
      border-radius: 4px;
      background: var(--us-page-border);
      overflow: hidden;
      position: relative;
    }

    .usesense-loader-bar i {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 40%;
      border-radius: 4px;
      background: var(--us-primary);
      animation: usesense-bar-slide 1.2s ease-in-out infinite;
    }

    @keyframes usesense-bar-slide {
      from { left: -40%; }
      to { left: 100%; }
    }

    .usesense-loader-image {
      display: block;
      max-width: 96px;
      max-height: 96px;
      object-fit: contain;
    }

    @keyframes usesense-spin {
      to { transform: rotate(360deg); }
    }

    @media (min-width: 600px) {
      .usesense-xc-page {
        padding-left: max(28px, calc(50% - 220px));
        padding-right: max(28px, calc(50% - 220px));
        padding-top: 96px;
      }
      .usesense-xc-page--header {
        padding-top: 24px;
      }
      .usesense-upload-sheet,
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
      background: ${F.scrim};
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
    }

    .usesense-xc-dialog {
      width: 290px;
      max-width: 100%;
      background: var(--us-page-surface);
      color: var(--us-page-fg);
      border-radius: var(--us-dialog-radius);
      padding: 20px 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-family: var(--us-font-body);
    }

    .usesense-xc-dialog-title {
      font-family: var(--us-font-display);
      font-size: 17px;
      font-weight: 600;
      text-align: center;
    }

    .usesense-xc-dialog-body {
      font-size: 14px;
      line-height: 1.45;
      text-align: center;
      color: var(--us-page-muted);
    }

    .usesense-xc-dialog-buttons {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 6px;
    }

    .usesense-xc-dialog-buttons button {
      height: 44px;
      border: 1.5px solid transparent;
      border-radius: var(--us-btn-radius);
      font-family: var(--us-font-body);
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    }

    .usesense-xc-dialog-no {
      background: var(--us-page-muted-tint);
      color: var(--us-page-fg);
    }

    .usesense-xc-dialog-yes {
      background: var(--us-primary);
      border-color: var(--us-primary);
      color: var(--us-primary-fg);
    }

    /* shape.buttonStyle: outline primary buttons */
    .usesense-engine--btn-outline .usesense-xc-primary,
    .usesense-engine--btn-outline .usesense-xc-dialog-yes {
      background: transparent;
      color: var(--us-primary);
      border-color: var(--us-primary);
    }

    @media (prefers-reduced-motion: reduce) {
      .usesense-guidance,
      .usesense-xc-arrow,
      .usesense-xc-tick,
      .usesense-xc-sheet,
      .usesense-loader-spinner,
      .usesense-loader-dots span,
      .usesense-loader-bar i {
        animation: none !important;
      }
      .usesense-shutter-inner {
        transition: none !important;
      }
    }
  `;
}
