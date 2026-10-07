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
