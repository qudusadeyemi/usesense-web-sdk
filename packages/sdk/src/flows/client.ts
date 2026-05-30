/**
 * client.ts — fetch wrapper for the SDK Runner endpoints.
 *
 * Bearer auth (the sdkToken minted by POST /v1/flow-runs). The server also
 * accepts `?t=<token>` as a fallback; the SDK presents Bearer so the token
 * never lands in URLs (which end up in server logs and browser history).
 */

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
  reason?: 'unreadable' | 'provider';
}

export interface FlowsClient {
  get(): Promise<FlowRunView>;
  advance(inputs: Record<string, unknown>): Promise<FlowRunView>;
  cancel(): Promise<FlowRunView>;
  initSession(toolId?: string): Promise<InitSessionResponse>;
  uploadDocument(payload: {
    data: string;
    mimeType: string;
    side: string;
    documentType?: string;
  }): Promise<UploadDocumentResponse>;
}

export interface FlowsClientOptions {
  flowRunId: string;
  sdkToken: string;
  apiBaseUrl?: string;
  fetcher?: typeof fetch; // injectable for tests
}

/**
 * Translates the server's HTTP/JSON error envelope into the SDK's FlowError
 * taxonomy. Anything we cannot recognise becomes FlowError('unknown', …).
 */
async function readError(res: Response): Promise<FlowError> {
  let body: { error?: string; code?: string } = {};
  try { body = await res.json(); } catch { /* non-JSON body */ }
  const code = body.code ?? '';
  const message = body.error ?? `Request failed with status ${res.status}`;
  if (res.status === 401 || code === 'token_expired') return new FlowError('token_expired', message, code);
  if (res.status === 403 || code === 'forbidden') return new FlowError('token_invalid', message, code);
  if (res.status >= 500 || code === 'provider_unavailable' || code === 'internal') return new FlowError('provider_unavailable', message, code);
  return new FlowError('unknown', message, code);
}

export function createFlowsClient(opts: FlowsClientOptions): FlowsClient {
  const { flowRunId, sdkToken, apiBaseUrl, fetcher } = opts;
  const f = fetcher ?? fetch.bind(globalThis);
  const base = (apiBaseUrl ?? DEFAULT_BASE).replace(/\/+$/, '');
  const url = (suffix: string) => `${base}/v1/sdk/flow-runs/${encodeURIComponent(flowRunId)}${suffix}`;
  const headers = (): Record<string, string> => ({
    authorization: `Bearer ${sdkToken}`,
    'content-type': 'application/json',
  });

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
    get: () => send<FlowRunView>({ method: 'GET', suffix: '' }),
    advance: (inputs) => send<FlowRunView>({ method: 'POST', suffix: '/advance', body: { inputs } }),
    cancel: () => send<FlowRunView>({ method: 'POST', suffix: '/cancel' }),
    initSession: (toolId) => send<InitSessionResponse>({ method: 'POST', suffix: '/init-session', body: toolId ? { toolId } : {} }),
    uploadDocument: (payload) => send<UploadDocumentResponse>({ method: 'POST', suffix: '/documents', body: payload }),
  };
}
