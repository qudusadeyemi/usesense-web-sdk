/**
 * Camera-free Device Trust.
 *
 * The runner declares `device_signals_v1` on every load and advance, so a
 * Device Trust step is served as a `device` capture: the SDK collects the
 * browser's integrity signals (no camera, nothing shown but a short "checking"
 * state) and posts them with the step's nonce. Without the capability the
 * server settles the step from the network alone, which is what older SDKs get.
 * Server contract: docs/sdk/device-trust-protocol.md in usesense-watchtower.
 */

export const DEVICE_SIGNALS_CAPABILITY = 'device_signals_v1';

/** Capabilities the flow runner declares to the SDK Runner endpoints. */
export const FLOW_RUNNER_CAPABILITIES: string[] = [DEVICE_SIGNALS_CAPABILITY];

/**
 * Server codes after which the run should be re-read instead of failing: the
 * nonce moved on, or the step was already settled (a retry, another tab).
 */
export function deviceSignalsNeedsReload(serverCode: string | undefined): boolean {
  return serverCode === 'nonce_mismatch' || serverCode === 'device_step_not_pending';
}

/** The bits of `document` and `window` waitForForeground needs (injectable for tests). */
export interface ForegroundEnv {
  doc: Pick<Document, 'visibilityState' | 'hasFocus' | 'addEventListener' | 'removeEventListener'>;
  win: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}

/** How long to wait for focus once the page is visible before collecting anyway. */
export const FOCUS_GRACE_MS = 1500;

/**
 * Resolve once the page is in front of the person: visible, then focused (or
 * FOCUS_GRACE_MS after becoming visible, whichever comes first).
 *
 * The device step needs nothing from the person, so it used to collect the
 * moment the page loaded. A link opened in a background tab then reported
 * `visibility_state: hidden` and `has_focus: false`, which DeepSense reads as a
 * headless or background session: up to 40 points off, enough to fail the
 * default Device Trust threshold for a real person on a real device. Waiting
 * costs nothing when the page is already in front; otherwise the step simply
 * runs when they look at it.
 */
export function waitForForeground(
  env: ForegroundEnv = { doc: document, win: window },
  focusGraceMs: number = FOCUS_GRACE_MS,
): Promise<void> {
  const { doc, win } = env;
  const visible = (): Promise<void> => {
    if (doc.visibilityState === 'visible') return Promise.resolve();
    return new Promise((resolve) => {
      const onChange = () => {
        if (doc.visibilityState !== 'visible') return;
        doc.removeEventListener('visibilitychange', onChange);
        resolve();
      };
      doc.addEventListener('visibilitychange', onChange);
    });
  };
  const focused = (): Promise<void> => {
    if (doc.hasFocus()) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        win.removeEventListener('focus', done);
        resolve();
      };
      const timer = setTimeout(done, focusGraceMs);
      win.addEventListener('focus', done);
    });
  };
  return visible().then(focused);
}
