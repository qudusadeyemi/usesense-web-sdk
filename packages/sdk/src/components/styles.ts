/**
 * Full-screen dark theme styles for the VerificationCaptureEngine.
 *
 * The SDK renders as a full-screen (or container-filling) dark overlay
 * with the camera feed as the primary visual element.
 */

export function getEngineStyles(primaryColor: string): string {
  return `
    .usesense-engine {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 100vh;
      background: #0a0a0a;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }

    .usesense-engine * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* ── Video ────────────────────────────────────────────────── */

    .usesense-camera-container {
      position: relative;
      width: 100%;
      max-width: 480px;
      aspect-ratio: 3 / 4;
      border-radius: 24px;
      overflow: hidden;
      background: #111;
    }

    .usesense-camera-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1);
      display: block;
    }

    /* ── Face Oval ────────────────────────────────────────────── */

    .usesense-face-oval {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 60%;
      aspect-ratio: 3 / 4;
      border: 3px solid ${primaryColor};
      border-radius: 50%;
      pointer-events: none;
      animation: usesense-pulse-oval 2s ease-in-out infinite;
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.08);
    }

    .usesense-face-oval--ready {
      border-color: #10b981;
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
      animation: none;
    }

    .usesense-face-oval--baseline {
      border-color: rgba(255, 255, 255, 0.25);
      animation: none;
    }

    /* ── Vignette (darkens edges around oval) ─────────────────── */

    .usesense-vignette {
      position: absolute;
      inset: 0;
      background: radial-gradient(
        ellipse 55% 42% at 50% 50%,
        transparent 98%,
        rgba(0, 0, 0, 0.6) 100%
      );
      pointer-events: none;
    }

    /* ── Status Bar (below camera) ───────────────────────────── */

    .usesense-status-area {
      width: 100%;
      max-width: 480px;
      padding: 16px 24px;
      text-align: center;
    }

    .usesense-phase-badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-bottom: 8px;
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.7);
    }

    .usesense-status-text {
      font-size: 16px;
      font-weight: 500;
      color: #ffffff;
      margin-bottom: 4px;
    }

    .usesense-status-hint {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.5);
    }

    /* ── Progress Bar ────────────────────────────────────────── */

    .usesense-progress {
      width: 100%;
      max-width: 480px;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
      margin: 12px auto 0;
    }

    .usesense-progress-fill {
      height: 100%;
      background: ${primaryColor};
      border-radius: 2px;
      transition: width 0.3s ease-out;
      box-shadow: 0 0 8px ${primaryColor};
    }

    /* ── Buttons ─────────────────────────────────────────────── */

    .usesense-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 32px;
      border-radius: 14px;
      border: none;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
      min-height: 48px;
      min-width: 160px;
    }

    .usesense-btn:hover { opacity: 0.9; }
    .usesense-btn:active { transform: scale(0.98); }
    .usesense-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .usesense-btn--primary {
      background: ${primaryColor};
      color: #ffffff;
      box-shadow: 0 4px 14px ${primaryColor}40;
    }

    .usesense-btn--secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .usesense-btn--danger {
      background: #ef4444;
      color: #ffffff;
    }

    /* ── Countdown ───────────────────────────────────────────── */

    .usesense-countdown-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.5);
      z-index: 20;
    }

    .usesense-countdown-number {
      font-size: 120px;
      font-weight: 900;
      color: #ffffff;
      text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      animation: usesense-countdown-pop 0.9s ease-out;
      line-height: 1;
    }

    .usesense-countdown-label {
      font-size: 16px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.7);
      margin-top: 12px;
    }

    /* ── Challenge: Follow Dot ───────────────────────────────── */

    .usesense-follow-dot {
      position: absolute;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: radial-gradient(circle, #ef4444 0%, #dc2626 100%);
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.8),
                  0 0 40px rgba(239, 68, 68, 0.4);
      transform: translate(-50%, -50%);
      transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                  top 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 15;
      animation: usesense-dot-pulse 1s ease-in-out infinite;
    }

    /* ── Challenge: Direction Arrow ──────────────────────────── */

    .usesense-direction-arrow {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 15;
      box-shadow: 0 0 30px ${primaryColor}80, 0 8px 25px rgba(0, 0, 0, 0.3);
      animation: usesense-direction-enter 0.35s ease-out;
    }

    .usesense-direction-arrow svg {
      width: 48px;
      height: 48px;
      color: #ffffff;
      stroke-width: 3;
    }

    /* ── Speak Phrase ────────────────────────────────────────── */

    .usesense-phrase-display {
      margin-top: 16px;
      padding: 16px 24px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 6px;
      color: #ffffff;
      text-align: center;
    }

    .usesense-recording-indicator {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: rgba(239, 68, 68, 0.15);
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      color: #ef4444;
      margin-bottom: 12px;
    }

    .usesense-recording-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
      animation: usesense-blink 1s ease-in-out infinite;
    }

    /* ── Face Guide Feedback ─────────────────────────────────── */

    .usesense-guide-feedback {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
      color: #ffffff;
      white-space: nowrap;
      z-index: 10;
    }

    .usesense-guide-feedback--ready {
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #10b981;
    }

    /* ── Environment Warning ─────────────────────────────────── */

    .usesense-env-warning {
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      padding: 6px 14px;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      color: #f59e0b;
      z-index: 10;
      white-space: nowrap;
    }

    /* ── Result Screens ──────────────────────────────────────── */

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
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
    }

    .usesense-result-icon--failure {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }

    .usesense-result-icon--review {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
    }

    .usesense-result-icon svg {
      width: 40px;
      height: 40px;
    }

    .usesense-result-title {
      font-size: 24px;
      font-weight: 700;
      color: #ffffff;
    }

    .usesense-result-subtitle {
      font-size: 15px;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.5;
      max-width: 320px;
    }

    /* ── Loading Spinner ─────────────────────────────────────── */

    .usesense-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255, 255, 255, 0.15);
      border-top-color: ${primaryColor};
      border-radius: 50%;
      animation: usesense-spin 0.8s linear infinite;
    }

    /* ── Logo ────────────────────────────────────────────────── */

    .usesense-logo {
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      height: 28px;
      z-index: 30;
      opacity: 0.8;
    }

    /* ── Footer ──────────────────────────────────────────────── */

    .usesense-footer {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 11px;
      color: rgba(255, 255, 255, 0.25);
      white-space: nowrap;
    }

    /* ── Animations ──────────────────────────────────────────── */

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

    /* ── Responsive (mobile) ─────────────────────────────────── */

    @media (max-width: 640px) {
      .usesense-camera-container {
        max-width: 100%;
        border-radius: 0;
        aspect-ratio: auto;
        flex: 1;
      }

      .usesense-engine {
        padding: 0;
      }

      .usesense-btn {
        min-height: 56px;
        font-size: 17px;
      }

      .usesense-countdown-number {
        font-size: 96px;
      }
    }
  `;
}
