/**
 * client.ts: fetch wrapper for the Flow runner endpoints.
 *
 * Two modes, same server handlers:
 *  - 'sdk' (default): /v1/sdk/flow-runs/:id/*, Bearer auth with the sdkToken
 *    minted by POST /v1/flow-runs. Bearer keeps the token out of URLs (which
 *    end up in server logs and browser history).
 *  - 'hosted': /flow-runs/:id/hosted*?t=<token>, the token-gated endpoints
 *    behind a hosted runner link. The link already carries the token in its
 *    URL, so nothing new is exposed. Used by Watchtower's hosted runner page.
 */

import { SDK_CAPABILITIES } from '../capture/step-up-round';
import { DEVICE_SIGNALS_CAPABILITY, FLOW_RUNNER_CAPABILITIES, type DeviceBinding } from './device-signals';
import { FlowError, type FlowRunView } from './types';

const DEFAULT_BASE = 'https://api.usesense.ai';

/** Response shape from POST /flow-runs/init-session (face capture seed). */
export interface InitSessionResponse {
  session_id: string;
  session_token: string;
  nonce: string;
  policy: unknown;
  upload: unknown;
  geometric_coherence: unknown;
}

export interface UploadDocumentResponse {
  document_id: string;
  status: 'completed' | 'failed';
  reason?: 'unreadable' | 'provider' | 'too_large' | 'incomplete';
  /** The server's instruction for the reasons where our built-in copy would be
   *  wrong ('too_large', 'incomplete'): only the server knows the limit that
   *  was exceeded, or that the bytes arrived cut short. */
  message?: string;
}

export interface FlowsClient {
  get(): Promise<FlowRunView>;
  advance(inputs: Record<string, unknown>): Promise<FlowRunView>;
  cancel(): Promise<FlowRunView>;
  /** Settle a parked Device Trust step with the device's signals (no camera). */
  submitDeviceSignals(nonce: string, channelIntegrity: Record<string, unknown>): Promise<FlowRunView>;
  /**
   * Start a face capture. `deviceBinding` (the device fingerprint inputs) lets
   * the server reuse a Device Trust check from earlier in the run only when it
   * came from this device.
   */
  initSession(toolId?: string, deviceBinding?: DeviceBinding | null): Promise<InitSessionResponse>;
  uploadDocument(payload: {
    data: string;
    mimeType: string;
    side: string;
    documentType?: string;
    /**
     * How the subject supplied the document: 'camera' for a live capture,
     * 'upload' for a file they chose. The server tailors failure guidance to
     * it -- "hold the document still and wait for the camera to focus" is right
     * for a capture and meaningless for someone who picked an existing file.
     * Optional; omitting it makes the server fall back to the step's configured
     * capture methods.
     */
    captureMethod?: 'camera' | 'upload';
    /**
     * Client-reported capture-source evidence for the document camera (G03),
     * from collectCaptureSourceEvidence. The server reads it only when
     * captureMethod is 'camera' and treats it as evidence, never proof.
     */
    captureSource?: unknown;
  }): Promise<UploadDocumentResponse>;
}

/** Client context the hosted runner declares on init-session (schema v1). */
export interface FlowClientContext {
  schema_version: 1;
  sdk: { name: string; version?: string; build?: string };
  app?: { identifier?: string; version?: string; build?: string };
}

export interface FlowsClientOptions {
  flowRunId: string;
  /** The run's token: the sdkToken (mode 'sdk') or the hosted link's `t` (mode 'hosted'). */
  sdkToken: string;
  /**
   * API base. Mode 'sdk' appends /v1/sdk/flow-runs (default
   * https://api.usesense.ai). Mode 'hosted' appends /flow-runs/:id/hosted, so
   * pass the base the hosted endpoints live under.
   */
  apiBaseUrl?: string;
  /** Which endpoints to call. Default 'sdk'. */
  mode?: 'sdk' | 'hosted';
  /** Sent as `client_context` on init-session (the hosted runner sends one). */
  clientContext?: FlowClientContext;
  fetcher?: typeof fetch; // injectable for tests
}

/**
 * Translates the server's HTTP/JSON error envelope into the SDK's FlowError
 * taxonomy. Anything we cannot recognise becomes FlowError('unknown', …).
 */
async function readError(res: Response): Promise<FlowError> {
  let body: { error?: string; code?: string; details?: { errors?: { field_key: string; message: string }[] } } = {};
  try { body = await res.json(); } catch { /* non-JSON body */ }
  const code = body.code ?? '';
  const message = body.error ?? `Request failed with status ${res.status}`;
  if (res.status === 401 || code === 'token_expired') return new FlowError('token_expired', message, code);
  if (res.status === 403 || code === 'forbidden') return new FlowError('token_invalid', message, code);
  // 422 invalid_input — preserve details.errors so the runner can highlight
  // each offending field inline instead of failing the whole run.
  if (code === 'invalid_input') return new FlowError('invalid_input', message, code, body.details);
  if (res.status >= 500 || code === 'provider_unavailable' || code === 'internal') return new FlowError('provider_unavailable', message, code);
  return new FlowError('unknown', message, code);
}

export function createFlowsClient(opts: FlowsClientOptions): FlowsClient {
  const { flowRunId, sdkToken, apiBaseUrl, fetcher, clientContext } = opts;
  const hosted = opts.mode === 'hosted';
  const f = fetcher ?? fetch.bind(globalThis);
  const base = (apiBaseUrl ?? DEFAULT_BASE).replace(/\/+$/, '');
  const run = encodeURIComponent(flowRunId);
  // `suffix` is the route ('' | '/advance' | ...) plus an optional '?query'.
  const url = (suffix: string) => {
    if (!hosted) return `${base}/v1/sdk/flow-runs/${run}${suffix}`;
    const [path, query] = suffix.split('?');
    const t = `t=${encodeURIComponent(sdkToken)}`;
    return `${base}/flow-runs/${run}/hosted${path}?${t}${query ? `&${query}` : ''}`;
  };
  const headers = (): Record<string, string> => (hosted
    ? { 'content-type': 'application/json' }
    : { authorization: `Bearer ${sdkToken}`, 'content-type': 'application/json' });

  async function send<T>(input: { method: string; suffix: string; body?: unknown }): Promise<T> {
    let res: Response;
    try {
      res = await f(url(input.suffix), {
        method: input.method,
        headers: headers(),
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
      });
    } catch (e) {
      throw new FlowError('network_unavailable', e instanceof Error ? e.message : 'Network unavailable');
    }
    if (!res.ok) throw await readError(res);
    return (await res.json()) as T;
  }

  return {
    // Both declare device_signals_v1 so a Device Trust step is served as a
    // device capture rather than settled from the network alone.
    get: () => send<FlowRunView>({ method: 'GET', suffix: `?caps=${DEVICE_SIGNALS_CAPABILITY}` }),
    advance: (inputs) => send<FlowRunView>({ method: 'POST', suffix: '/advance', body: { inputs, client: { capabilities: FLOW_RUNNER_CAPABILITIES } } }),
    submitDeviceSignals: (nonce, channelIntegrity) => send<FlowRunView>({
      method: 'POST', suffix: '/device-signals',
      body: { nonce, channel_integrity: channelIntegrity, client: { capabilities: FLOW_RUNNER_CAPABILITIES } },
    }),
    cancel: () => send<FlowRunView>({ method: 'POST', suffix: '/cancel' }),
    initSession: (toolId, deviceBinding) => send<InitSessionResponse>({
      method: 'POST', suffix: '/init-session',
      body: {
        ...(toolId ? { toolId } : {}),
        ...(clientContext ? { client_context: clientContext } : {}),
        capabilities: SDK_CAPABILITIES,
        ...(deviceBinding ? { device_binding: deviceBinding } : {}),
      },
    }),
    uploadDocument: (payload) => send<UploadDocumentResponse>({ method: 'POST', suffix: '/documents', body: payload }),
  };
}
