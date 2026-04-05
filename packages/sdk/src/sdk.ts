/**
 * UseSense Web SDK v2.0.0 -- Vanilla JavaScript API
 *
 * Wraps the React VerificationCaptureEngine component so that
 * non-React applications can use the SDK with a simple imperative API.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { VerificationCaptureEngine } from './components/VerificationCaptureEngine';
import { createSession } from './api-client';
import { detectEnvironmentFromKey } from './utils/env';
import type {
  UseSenseSDKConfig,
  CaptureSessionData,
  CaptureResult,
  CapturePhase,
  Environment,
} from './types';

/**
 * Imperative wrapper around the VerificationCaptureEngine React component.
 *
 * Supports two initialization patterns:
 *   - Pattern A: Call `startWithSession(sessionData)` with server-created session data.
 *   - Pattern B: Call `start()` to create a session client-side using an API key.
 *
 * @example
 * ```ts
 * const sdk = new UseSenseSDK({
 *   apiKey: 'your-api-key',
 *   anonKey: 'your-anon-key',
 *   sessionType: 'enrollment',
 * });
 * sdk.on('complete', (result) => console.log(result));
 * sdk.on('error', (err) => console.error(err));
 * await sdk.start();
 * ```
 */
export class UseSenseSDK {
  private config: UseSenseSDKConfig;
  private root: Root | null = null;
  private container: HTMLElement | null = null;
  private sessionData: CaptureSessionData | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private destroyed = false;

  constructor(config: UseSenseSDKConfig) {
    // Verify that React and ReactDOM are available at runtime
    if (!React || !React.createElement) {
      throw new Error(
        'UseSenseSDK requires React to be available. ' +
          'Install react and react-dom as dependencies in your project.'
      );
    }
    if (!createRoot) {
      throw new Error(
        'UseSenseSDK requires react-dom/client (React 18+). ' +
          'Install react-dom >= 18 as a dependency in your project.'
      );
    }

    const detectedEnv: Environment = config.apiKey
      ? detectEnvironmentFromKey(config.apiKey)
      : 'sandbox';

    this.config = {
      apiBaseUrl: 'https://api.usesense.ai/functions/v1/watchtower-api',
      environment: detectedEnv,
      primaryColor: '#4F7CFF',
      ...config,
    };
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Pattern B: Create a session using the configured API key, then mount the
   * verification capture UI.
   *
   * @param target - Optional CSS selector or HTMLElement to mount into.
   */
  async start(target?: string | HTMLElement): Promise<void> {
    this.throwIfDestroyed();

    if (!this.config.apiKey) {
      throw new Error(
        'An apiKey is required to use start(). ' +
          'Provide it via the config, or use startWithSession() instead (Pattern A).'
      );
    }

    const response = await createSession({
      apiKey: this.config.apiKey,
      apiBaseUrl: this.config.apiBaseUrl,
      environment: this.config.environment || 'production',
      sessionType: this.config.sessionType || 'enrollment',
      identityId: this.config.identityId,
      externalUserId: this.config.externalUserId,
      metadata: this.config.metadata,
    });

    this.sessionData = response;
    this.mount(target);
  }

  /**
   * Pattern A: Use pre-created session data (typically created by your own
   * backend) and mount the verification capture UI.
   *
   * @param sessionData - The session data obtained from your backend.
   * @param target - Optional CSS selector or HTMLElement to mount into.
   */
  async startWithSession(
    sessionData: CaptureSessionData,
    target?: string | HTMLElement
  ): Promise<void> {
    this.throwIfDestroyed();
    this.sessionData = sessionData;
    this.mount(target);
  }

  /**
   * Mount the React VerificationCaptureEngine into the DOM.
   *
   * @param target - CSS selector string, HTMLElement, or undefined (falls back
   *   to `config.mountTo`, then creates a wrapper div appended to `<body>`).
   */
  mount(target?: string | HTMLElement): void {
    this.throwIfDestroyed();

    if (!this.sessionData) {
      throw new Error(
        'No session data available. Call start() or startWithSession() first.'
      );
    }

    // Resolve the mount target
    let mountElement: HTMLElement | null = null;

    if (typeof target === 'string') {
      mountElement = document.querySelector<HTMLElement>(target);
      if (!mountElement) {
        throw new Error(
          `UseSenseSDK: Could not find element matching selector "${target}".`
        );
      }
    } else if (target instanceof HTMLElement) {
      mountElement = target;
    } else if (this.config.mountTo) {
      mountElement = this.config.mountTo;
    }

    // Create a wrapper div if no mount target was resolved
    if (!mountElement) {
      mountElement = document.createElement('div');
      mountElement.setAttribute('id', 'usesense-sdk-root');
      mountElement.style.position = 'fixed';
      mountElement.style.inset = '0';
      mountElement.style.zIndex = '999999';
      document.body.appendChild(mountElement);
    }

    this.container = mountElement;
    this.root = createRoot(this.container);
    this.renderComponent();
  }

  /**
   * Update branding options and re-render the component if it is currently
   * mounted.
   */
  setBranding(branding: {
    primaryColor?: string;
    logoUrl?: string;
    displayName?: string;
  }): void {
    if (branding.primaryColor !== undefined) {
      this.config.primaryColor = branding.primaryColor;
    }
    if (branding.logoUrl !== undefined) {
      this.config.logoUrl = branding.logoUrl;
    }
    if (branding.displayName !== undefined) {
      this.config.displayName = branding.displayName;
    }

    // Re-render if currently mounted
    if (this.root && this.sessionData) {
      this.renderComponent();
    }
  }

  /**
   * Register an event listener.
   *
   * Supported events:
   *   - `'complete'`     -- fired with a `CaptureResult` on success
   *   - `'error'`        -- fired with an error message string
   *   - `'phaseChange'`  -- fired with `(phase: CapturePhase, label: string)`
   */
  on(event: string, handler: Function): void {
    const handlers = this.listeners.get(event) || [];
    handlers.push(handler);
    this.listeners.set(event, handlers);
  }

  /**
   * Remove a previously registered event listener.
   */
  off(event: string, handler: Function): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Retry the verification flow by destroying and re-mounting the component.
   */
  retry(): void {
    if (this.destroyed) return;

    const container = this.container;

    // Tear down without full cleanup so we can re-use the container
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }

    if (container && this.sessionData) {
      this.container = container;
      this.root = createRoot(container);
      this.renderComponent();
    }
  }

  /**
   * Fully tear down the SDK: unmount React, stop media streams, and clean up
   * the DOM.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    // Unmount the React root
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }

    // Stop any active media streams that may still be running
    this.stopMediaStreams();

    // Remove auto-created container from DOM
    if (
      this.container &&
      this.container.id === 'usesense-sdk-root' &&
      this.container.parentNode
    ) {
      this.container.parentNode.removeChild(this.container);
    }

    this.container = null;
    this.sessionData = null;
    this.listeners.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Emit an event to all registered listeners.
   */
  private emit(event: string, ...args: any[]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(...args);
      } catch (err) {
        // Swallow listener errors to prevent SDK from breaking
        console.error(`[UseSenseSDK] Error in "${event}" listener:`, err);
      }
    }
  }

  /**
   * Create and render the VerificationCaptureEngine React element.
   */
  private renderComponent(): void {
    if (!this.root || !this.sessionData) return;

    const element = React.createElement(VerificationCaptureEngine, {
      sessionData: this.sessionData,
      environment: this.config.environment || 'production',
      anonKey: this.config.anonKey || '',
      apiBaseUrl: this.config.apiBaseUrl,
      primaryColor: this.config.primaryColor,
      logoUrl: this.config.logoUrl,
      displayName: this.config.displayName,
      sessionType: this.config.sessionType,
      onComplete: (result: CaptureResult) => {
        this.emit('complete', result);
        if (this.config.onResult) {
          this.config.onResult(result);
        }
      },
      onError: (error: string) => {
        this.emit('error', error);
        if (this.config.onError) {
          this.config.onError(error);
        }
      },
      onPhaseChange: (phase: CapturePhase, label: string) => {
        this.emit('phaseChange', phase, label);
        if (this.config.onPhaseChange) {
          this.config.onPhaseChange(phase, label);
        }
      },
    });

    this.root.render(element);
  }

  /**
   * Attempt to stop any getUserMedia streams that may still be active.
   */
  private stopMediaStreams(): void {
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function'
      ) {
        // Find and stop video elements within our container
        if (this.container) {
          const videos = this.container.querySelectorAll('video');
          videos.forEach((video) => {
            const stream = video.srcObject as MediaStream | null;
            if (stream && typeof stream.getTracks === 'function') {
              stream.getTracks().forEach((track) => track.stop());
            }
            video.srcObject = null;
          });
        }
      }
    } catch {
      // Best-effort cleanup; ignore errors
    }
  }

  /**
   * Throw if the SDK has already been destroyed.
   */
  private throwIfDestroyed(): void {
    if (this.destroyed) {
      throw new Error(
        'This UseSenseSDK instance has been destroyed. Create a new instance to continue.'
      );
    }
  }
}
