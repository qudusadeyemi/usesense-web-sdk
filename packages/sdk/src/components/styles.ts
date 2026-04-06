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

/** Google Fonts URL for the UseSense brand font stack. */
export const USESENSE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap';

export function getEngineStyles(primaryColor: string): string {
  return `
    .usesense-engine {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 100vh;
      min-height: 100dvh;
      background: #1C1A17;
      color: #FFFFFF;
      font-family: 'DM Sans', sans-serif;
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
      background: #FDFCFA;
      color: #1C1A17;
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
      font-family: 'DM Sans', sans-serif;
      color: #6B6760;
      padding: 6px 4px;
      z-index: 30;
      transition: color 150ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    .usesense-back-btn:hover {
      color: #1C1A17;
    }

    /* -- Environment badge (intro, top-right) */

    .usesense-env-badge {
      position: absolute;
      top: 16px;
      right: 20px;
      font-size: 0.72rem;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
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
      font-family: 'DM Sans', sans-serif;
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
      font-family: 'DM Sans', sans-serif;
      color: #FFFFFF;
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
      font-family: 'DM Sans', sans-serif;
      color: #FFFFFF;
    }

    /* -- Intro screen */

    .usesense-intro {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 24px 24px 48px;
      max-width: 560px;
      width: 100%;
      gap: 20px;
    }

    .usesense-intro-title {
      font-size: 1.6rem;
      font-weight: 700;
      font-family: 'Outfit', sans-serif;
      letter-spacing: -0.03em;
      line-height: 1.15;
      color: #1C1A17;
      margin-top: 8px;
    }

    .usesense-intro-desc {
      font-size: 0.88rem;
      font-family: 'DM Sans', sans-serif;
      color: #6B6760;
      line-height: 1.65;
      max-width: 420px;
    }

    .usesense-intro-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(79, 124, 255, 0.08);
      color: ${primaryColor};
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 4px 0;
    }

    .usesense-intro-icon svg {
      width: 36px;
      height: 36px;
    }

    .usesense-intro-card {
      width: 100%;
      background: #FFFFFF;
      border: 1px solid #E8E5DE;
      border-radius: 14px;
      padding: 20px 24px;
      text-align: left;
    }

    .usesense-intro-card-title {
      font-size: 1rem;
      font-weight: 700;
      font-family: 'Outfit', sans-serif;
      letter-spacing: -0.02em;
      color: #1C1A17;
      margin-bottom: 12px;
    }

    .usesense-intro-steps {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
      counter-reset: step;
    }

    .usesense-intro-steps li {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.88rem;
      font-family: 'DM Sans', sans-serif;
      color: #6B6760;
      counter-increment: step;
    }

    .usesense-intro-steps li::before {
      content: counter(step) ".";
      font-size: 0.82rem;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
      color: ${primaryColor};
      min-width: 18px;
      line-height: 1.5;
    }

    .usesense-intro-trust {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-family: 'DM Sans', sans-serif;
      color: #9E9A92;
    }

    /* -- Challenge brief screen */

    .usesense-challenge-brief-title {
      font-size: 1.6rem;
      font-weight: 700;
      font-family: 'Outfit', sans-serif;
      letter-spacing: -0.03em;
      color: #FFFFFF;
      text-align: center;
      margin-bottom: 4px;
    }

    .usesense-challenge-brief-desc {
      font-size: 0.88rem;
      font-family: 'DM Sans', sans-serif;
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
      font-family: 'DM Sans', sans-serif;
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
      border-color: #FFFFFF;
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
      animation: none;
    }

    .usesense-face-oval--baseline {
      border-color: rgba(255, 255, 255, 0.5);
      animation: none;
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
      font-family: 'DM Sans', sans-serif;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-bottom: 8px;
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.5);
    }

    .usesense-status-text {
      font-size: 1rem;
      font-weight: 700;
      font-family: 'Outfit', sans-serif;
      letter-spacing: -0.02em;
      color: #FFFFFF;
      margin-bottom: 4px;
    }

    .usesense-status-hint {
      font-size: 0.75rem;
      font-family: 'DM Sans', sans-serif;
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
      font-family: 'DM Sans', sans-serif;
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
      color: #FFFFFF;
      box-shadow: 0 4px 14px ${primaryColor}40;
    }

    .usesense-btn--primary:hover {
      background: ${primaryColor};
      opacity: 0.9;
    }

    .usesense-btn--secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #FFFFFF;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .usesense-engine--light .usesense-btn--secondary {
      background: #FFFFFF;
      color: #1C1A17;
      border: 1px solid #E8E5DE;
    }

    .usesense-engine--light .usesense-btn--secondary:hover {
      background: #F5F3EF;
      border-color: #D0CCBF;
    }

    .usesense-btn--danger {
      background: #FF6B4A;
      color: #FFFFFF;
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
      font-family: 'Outfit', sans-serif;
      color: #FFFFFF;
      text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      animation: usesense-countdown-pop 0.9s cubic-bezier(0.16, 1, 0.3, 1);
      line-height: 1;
    }

    .usesense-countdown-label {
      font-size: 0.88rem;
      font-weight: 500;
      font-family: 'DM Sans', sans-serif;
      color: rgba(255, 255, 255, 0.5);
      margin-top: 12px;
    }

    /* -- Challenge: Follow Dot */

    .usesense-follow-dot {
      position: absolute;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: radial-gradient(circle, #FF6B4A 0%, #DB4E33 100%);
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
      color: #FFFFFF;
      stroke-width: 2.5;
    }

    .usesense-direction-label {
      font-size: 0.58rem;
      font-weight: 700;
      font-family: 'DM Sans', sans-serif;
      color: #FFFFFF;
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
      color: #FFFFFF;
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
      font-family: 'DM Sans', sans-serif;
      color: #FF6B4A;
      margin-bottom: 12px;
    }

    .usesense-recording-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #FF6B4A;
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
      font-family: 'DM Sans', sans-serif;
      color: #FFFFFF;
      white-space: nowrap;
      z-index: 10;
    }

    .usesense-guide-feedback--ready {
      background: rgba(0, 212, 170, 0.15);
      border: 1px solid rgba(0, 212, 170, 0.3);
      color: #00D4AA;
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
      font-family: 'DM Sans', sans-serif;
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
      color: #00D4AA;
    }

    .usesense-result-icon--failure {
      background: rgba(255, 107, 74, 0.08);
      color: #FF6B4A;
    }

    .usesense-result-icon--review {
      background: rgba(255, 184, 77, 0.08);
      color: #FFB84D;
    }

    .usesense-result-icon svg {
      width: 40px;
      height: 40px;
    }

    .usesense-result-title {
      font-size: 1.6rem;
      font-weight: 700;
      font-family: 'Outfit', sans-serif;
      letter-spacing: -0.03em;
      color: #FFFFFF;
    }

    .usesense-engine--light .usesense-result-title {
      color: #1C1A17;
    }

    .usesense-result-subtitle {
      font-size: 0.88rem;
      font-family: 'DM Sans', sans-serif;
      color: rgba(255, 255, 255, 0.5);
      line-height: 1.65;
      max-width: 320px;
    }

    .usesense-engine--light .usesense-result-subtitle {
      color: #6B6760;
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

      .usesense-intro {
        padding: 20px 16px 32px;
        gap: 16px;
      }

      .usesense-intro-title {
        font-size: 1.35rem;
      }

      .usesense-intro-desc {
        font-size: 0.82rem;
      }

      .usesense-intro-card {
        padding: 16px;
        border-radius: 10px;
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
      font-family: 'Outfit', sans-serif;
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
      font-family: 'Outfit', sans-serif;
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
