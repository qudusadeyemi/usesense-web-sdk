/**
 * Shared styles and theme utilities for UseSense components
 */

export interface ThemeColors {
  primary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  success: string;
}

export const defaultTheme: ThemeColors = {
  primary: '#4F63F5',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  error: '#EF4444',
  success: '#10B981'
};

export function getThemeStyles(primaryColor?: string): Record<string, string> {
  return {
    '--usesense-primary': primaryColor || defaultTheme.primary,
    '--usesense-background': defaultTheme.background,
    '--usesense-surface': defaultTheme.surface,
    '--usesense-text': defaultTheme.text,
    '--usesense-text-secondary': defaultTheme.textSecondary,
    '--usesense-border': defaultTheme.border,
    '--usesense-error': defaultTheme.error,
    '--usesense-success': defaultTheme.success
  } as Record<string, string>;
}

export const baseStyles = `
  .usesense-container {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background-color: var(--usesense-background);
    color: var(--usesense-text);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
  }

  .usesense-screen {
    background-color: var(--usesense-surface);
    border-radius: 16px;
    padding: 24px;
    max-width: 480px;
    width: 100%;
    max-height: 95vh;
    overflow-y: auto;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    text-align: center;
    box-sizing: border-box;
  }

  .usesense-title {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--usesense-text);
  }

  .usesense-subtitle {
    font-size: 14px;
    color: var(--usesense-text-secondary);
    margin-bottom: 16px;
    line-height: 1.5;
  }

  .usesense-button {
    background-color: var(--usesense-primary);
    color: white;
    border: none;
    border-radius: 12px;
    padding: 14px 32px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    width: 100%;
    transition: opacity 0.2s;
    min-height: 48px;
  }

  .usesense-button:hover {
    opacity: 0.9;
  }

  .usesense-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .usesense-button-secondary {
    background-color: transparent;
    color: var(--usesense-text);
    border: 1px solid var(--usesense-border);
  }

  .usesense-video-container {
    position: relative;
    width: 100%;
    max-width: 400px;
    margin: 0 auto 24px;
    border-radius: 16px;
    overflow: hidden;
    background-color: #000;
    max-height: 50vh;
  }

  .usesense-video {
    width: 100%;
    height: auto;
    display: block;
    max-height: 50vh;
    object-fit: cover;
  }

  .usesense-video-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 70%;
    height: 70%;
    border: 3px solid rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    pointer-events: none;
  }

  .usesense-guidance {
    margin-top: 16px;
    padding: 12px 16px;
    background-color: rgba(79, 99, 245, 0.1);
    border-radius: 8px;
    color: var(--usesense-primary);
    font-size: 14px;
    font-weight: 500;
  }

  .usesense-progress {
    width: 100%;
    height: 4px;
    background-color: var(--usesense-border);
    border-radius: 2px;
    overflow: hidden;
    margin: 24px 0;
  }

  .usesense-progress-bar {
    height: 100%;
    background-color: var(--usesense-primary);
    transition: width 0.3s ease;
  }

  .usesense-spinner {
    display: inline-block;
    width: 48px;
    height: 48px;
    border: 4px solid var(--usesense-border);
    border-top-color: var(--usesense-primary);
    border-radius: 50%;
    animation: usesense-spin 1s linear infinite;
  }

  @keyframes usesense-spin {
    to { transform: rotate(360deg); }
  }

  @keyframes pulse {
    0%, 100% { 
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    50% { 
      opacity: 0.6;
      transform: translate(-50%, -50%) scale(1.1);
    }
  }

  .usesense-error {
    color: var(--usesense-error);
    margin-top: 16px;
    font-size: 14px;
  }

  .usesense-success-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 24px;
    color: var(--usesense-success);
  }

  .usesense-error-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 24px;
    color: var(--usesense-error);
  }

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

  @keyframes countdown-pop {
    0% { transform: scale(0.3); opacity: 0; }
    40% { transform: scale(1.15); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }

  @keyframes direction-enter {
    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
    60% { transform: translate(-50%, -50%) scale(1.1); }
    100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  }

  @media (max-width: 640px) {
    .usesense-screen {
      padding: 24px;
    }

    .usesense-title {
      font-size: 20px;
    }

    .usesense-subtitle {
      font-size: 14px;
    }
  }
`;