/**
 * API Client for UseSense v4.1
 *
 * All requests go through the Cloudflare Worker proxy at api.usesense.ai.
 * The SDK sends ONLY UseSense credentials (x-api-key, x-session-token, x-nonce).
 * The Cloudflare Worker injects Supabase gateway headers server-side.
 *
 * Endpoints:
 *   POST /v1/sessions              (create session)
 *   POST /v1/sessions/exchange-token (server-init token exchange)
 *   POST /v1/sessions/:id/signals  (upload frames + metadata)
 *   POST /v1/sessions/:id/complete (get decision)
 */

import type {
  Environment,
  SessionType,
  CreateSessionResponse,
  UploadSignalsResponse,
  CompleteSessionResponse,
  ExchangeTokenResponse,
  SignalMetadata,
} from './types';
import { MediaPipeModelInfo } from './mediapipe-model-info';

const DEFAULT_API_BASE = 'https://api.usesense.ai/v1';

/**
 * LiveSense SDK protocol version. v4 opts the session into the perspective
 * distortion validator + multi-trait classifier pipeline on the server.
 * Must also be enabled per-organization on watchtower.
 */
export type SdkVersion = 'v3' | 'v4';

/**
 * Shared helper: append the v4 opt-in header when sdkVersion==='v4'.
 * For v3 (or unset), no header is emitted and the server treats the session
 * as v3 by default.
 */
export function withSdkVersionHeader(
  headers: Record<string, string>,
  sdkVersion: SdkVersion | undefined,
): Record<string, string> {
  if (sdkVersion === 'v4') {
    return { ...headers, 'x-usesense-sdk-version': 'v4' };
  }
  return headers;
}

// ============================================================================
// Create Session (Pattern B -- API key in browser)
// ============================================================================

export interface CreateSessionParams {
  apiKey: string;
  apiBaseUrl?: string;
  environment: Environment;
  sessionType: SessionType;
  identityId?: string;
  externalUserId?: string;
  metadata?: Record<string, any>;
  /**
   * W-3/X-1: opt this session into the LiveSense v4 server pipeline.
   * Requires the organization to have features.livesense_v4_enabled=true.
   */
  sdkVersion?: SdkVersion;
}

/**
 * Create a new verification session.
 * Only used when the host app does NOT have its own backend-for-frontend.
 * For production, prefer server-side init (create-token / exchange-token).
 */
export async function createSession(
  params: CreateSessionParams
): Promise<CreateSessionResponse> {
  const base = params.apiBaseUrl || DEFAULT_API_BASE;
  const url = `${base}/sessions`;

  const body: Record<string, any> = {
    session_type: params.sessionType,
    platform: 'web',
    metadata: params.metadata || {},
  };

  if (params.sessionType === 'authentication' && params.identityId) {
    body.identity_id = params.identityId;
  }
  if (params.externalUserId) {
    body.external_user_id = params.externalUserId;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: withSdkVersionHeader(
      {
        'Content-Type': 'application/json',
        'x-api-key': params.apiKey,
        'x-environment': params.environment,
      },
      params.sdkVersion,
    ),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      data.error?.message || data.message || `Session creation failed (${res.status})`
    );
  }

  return res.json();
}

// ============================================================================
// Exchange Token (Server-Side Init)
// ============================================================================

export interface ExchangeTokenParams {
  apiBaseUrl?: string;
  clientToken: string;
  /**
   * X-1: opt into LiveSense v4 for this session. The server must honour the
   * header at exchange-token time because the session record is persisted
   * here, not at create-token time.
   */
  sdkVersion?: SdkVersion;
}

/**
 * Exchange a client_token for full session credentials.
 * Used with server-side init (create-token / exchange-token flow).
 * No API key needed -- the client_token itself authenticates.
 */
export async function exchangeToken(
  params: ExchangeTokenParams
): Promise<ExchangeTokenResponse> {
  const base = params.apiBaseUrl || DEFAULT_API_BASE;
  const url = `${base}/sessions/exchange-token`;

  const res = await fetch(url, {
    method: 'POST',
    headers: withSdkVersionHeader(
      { 'Content-Type': 'application/json' },
      params.sdkVersion,
    ),
    body: JSON.stringify({ client_token: params.clientToken }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      data.error?.message || data.message || `Token exchange failed (${res.status})`
    );
  }

  return res.json();
}

// ============================================================================
// Upload Signals
// ============================================================================

export interface UploadSignalsParams {
  apiBaseUrl?: string;
  environment: Environment;
  sessionId: string;
  sessionToken: string;
  nonce: string;
  frames: Uint8Array[];
  metadata: SignalMetadata;
  audioBlob?: Blob | null;
  /**
   * Fires as the request body goes out, so the host can show real progress
   * instead of an unbounded spinner. `total` is 0 while the length is unknown.
   * Called on every attempt, so a retry restarts at 0.
   */
  onProgress?: (progress: { loaded: number; total: number; percent: number }) => void;
}

/**
 * gzip the metadata JSON.
 *
 * metadata.json measured 345-461 KB uncompressed in production, 13-24% of the
 * whole upload, and gzip takes ~55% off it. Browsers do not compress request
 * bodies on their own, so this is otherwise dead weight on the subject's uplink.
 *
 * Falls back to plain JSON wherever CompressionStream is missing (Safari < 16.4)
 * or throws. The server sniffs the gzip magic bytes rather than trusting the
 * filename or header, so both shapes are accepted and this can never hard-fail
 * a capture.
 */
export async function encodeMetadata(
  metadata: SignalMetadata
): Promise<{ blob: Blob; filename: string; gzipped: boolean }> {
  const json = JSON.stringify(metadata);
  const plain = {
    blob: new Blob([json], { type: 'application/json' }),
    filename: 'metadata.json',
    gzipped: false,
  };

  if (typeof CompressionStream === 'undefined') return plain;

  try {
    const compressed = new Blob([json])
      .stream()
      .pipeThrough(new CompressionStream('gzip'));
    const bytes = await new Response(compressed).arrayBuffer();
    return {
      blob: new Blob([bytes], { type: 'application/gzip' }),
      filename: 'metadata.json.gz',
      gzipped: true,
    };
  } catch {
    return plain;
  }
}

/**
 * POST a body with upload-progress events.
 *
 * fetch() cannot report request progress, so this is XHR. Returns the same
 * three things the caller needs from a Response: status, a header lookup, and
 * the body text.
 */
function postWithProgress(
  url: string,
  headers: Record<string, string>,
  body: FormData,
  onProgress?: UploadSignalsParams['onProgress']
): Promise<{ status: number; getHeader: (name: string) => string | null; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        const total = e.lengthComputable ? e.total : 0;
        onProgress({
          loaded: e.loaded,
          total,
          percent: total > 0 ? Math.min(100, Math.round((e.loaded / total) * 100)) : 0,
        });
      };
    }

    xhr.onload = () =>
      resolve({
        status: xhr.status,
        getHeader: (name) => xhr.getResponseHeader(name),
        text: xhr.responseText,
      });
    // Tagged so the retry loop can tell a dead uplink from an HTTP error, the
    // job fetch()'s TypeError used to do.
    const netError = (message: string) =>
      Object.assign(new Error(message), { name: 'NetworkError' });
    xhr.onerror = () => reject(netError('Network request failed'));
    xhr.ontimeout = () => reject(netError('Network request timed out'));
    xhr.onabort = () => reject(netError('Upload aborted'));

    xhr.send(body);
  });
}

/**
 * Upload captured frames + metadata to the server.
 * Nonce is sent via dual delivery (header + query param) per v4.1 spec.
 * Retries up to 3 times with exponential backoff on network errors.
 */
export async function uploadSignals(
  params: UploadSignalsParams
): Promise<UploadSignalsResponse> {
  const base = params.apiBaseUrl || DEFAULT_API_BASE;
  // Dual delivery: nonce in both query param and header
  const url = `${base}/sessions/${params.sessionId}/signals?env=${params.environment}&nonce=${encodeURIComponent(params.nonce)}`;
  const idempotencyKey = crypto.randomUUID();

  const formData = new FormData();

  // Append each frame
  for (const frameBuffer of params.frames) {
    const blob = new Blob([frameBuffer as unknown as BlobPart], { type: 'image/jpeg' });
    formData.append('frames[]', blob, 'frame.jpg');
  }

  // Metadata as a JSON blob (multipart file field), gzipped where supported
  const meta = await encodeMetadata(params.metadata);
  formData.append('metadata', meta.blob, meta.filename);

  // Audio (speak_phrase only)
  if (params.audioBlob) {
    formData.append('audio', params.audioBlob, 'audio.webm');
  }

  const headers: Record<string, string> = {
    'x-session-token': params.sessionToken,
    'x-nonce': params.nonce,
    'x-environment': params.environment,
    'x-idempotency-key': idempotencyKey,
    // Stable identifier for the bundled MediaPipe FaceLandmarker model.
    // Sourced from MediaPipeModelInfo.versionLabel which is regenerated on
    // every model bump by the mediapipe-sdk-sync workflow in
    // qudusadeyemi/usesense-watchtower. The backend stamps this on the
    // session record so the mesh integrity card can compare model versions
    // across iOS, Android, and web SDK uploads.
    'x-usesense-mediapipe-model-version': MediaPipeModelInfo.versionLabel,
    // Advisory only. The server detects gzip from the payload's magic bytes;
    // this is here so the encoding is visible in request logs.
    'x-usesense-metadata-encoding': meta.gzipped ? 'gzip' : 'identity',
    // NOTE: Do NOT set Content-Type -- browser sets multipart boundary automatically
    // NOTE: Do NOT send apikey or Authorization -- Cloudflare Worker injects these
  };

  // Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
  const backoffs = [1000, 2000, 4000];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    try {
      const res = await postWithProgress(url, headers, formData, params.onProgress);

      if (res.status < 200 || res.status >= 300) {
        const raw = res.text || '';
        let data: any = {};
        try { data = JSON.parse(raw); } catch { /* not JSON */ }
        console.error('[UseSense] Upload error body:', raw);

        // Do NOT retry 4xx errors (except 429)
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error(
            data.error?.message || data.message || `Upload failed (${res.status})`
          );
        }

        // 429: respect Retry-After if present
        if (res.status === 429) {
          const retryAfter = parseInt(res.getHeader('Retry-After') || '2', 10);
          if (attempt < backoffs.length) {
            await new Promise(r => setTimeout(r, retryAfter * 1000));
            continue;
          }
        }

        // 5xx: retry up to 2 times with 2s delay
        if (res.status >= 500 && attempt < 2) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        throw new Error(
          data.error?.message || data.message || `Upload failed (${res.status})`
        );
      }

      return JSON.parse(res.text);
    } catch (err: any) {
      lastError = err;
      // Only retry on network errors (not HTTP errors already handled above)
      if (err.name === 'NetworkError' || err.name === 'TypeError' || err.message?.includes('fetch')) {
        console.warn(`[UseSense] Upload attempt ${attempt + 1} failed (network):`, err.message);
        if (attempt < backoffs.length) {
          await new Promise(r => setTimeout(r, backoffs[attempt]));
          continue;
        }
      }
      throw err;
    }
  }

  throw lastError || new Error('Upload failed after retries');
}

// ============================================================================
// Complete Session
// ============================================================================

export interface CompleteSessionParams {
  apiBaseUrl?: string;
  environment: Environment;
  sessionId: string;
  sessionToken: string;
  nonce: string;
}

/**
 * Complete the session and retrieve the server decision.
 * Nonce is sent via dual delivery (header + query param) per v4.1 spec.
 * Retries up to 3 times with exponential backoff on network errors.
 */
export async function completeSession(
  params: CompleteSessionParams
): Promise<CompleteSessionResponse> {
  const base = params.apiBaseUrl || DEFAULT_API_BASE;
  // Dual delivery: nonce in both query param and header
  const url = `${base}/sessions/${params.sessionId}/complete?env=${params.environment}&nonce=${encodeURIComponent(params.nonce)}`;
  const idempotencyKey = crypto.randomUUID();

  const headers: Record<string, string> = {
    'x-session-token': params.sessionToken,
    'x-nonce': params.nonce,
    'x-environment': params.environment,
    'x-idempotency-key': idempotencyKey,
    // NOTE: Do NOT send apikey or Authorization -- Cloudflare Worker injects these
  };

  const backoffs = [1000, 2000, 4000];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));

        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error(
            data.error?.message || data.message || `Complete failed (${res.status})`
          );
        }

        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
          if (attempt < backoffs.length) {
            await new Promise(r => setTimeout(r, retryAfter * 1000));
            continue;
          }
        }

        if (res.status >= 500 && attempt < 2) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        throw new Error(
          data.error?.message || data.message || `Complete failed (${res.status})`
        );
      }

      return res.json();
    } catch (err: any) {
      lastError = err;
      if (err.name === 'TypeError' || err.message?.includes('fetch')) {
        console.warn(`[UseSense] Complete attempt ${attempt + 1} failed (network):`, err.message);
        if (attempt < backoffs.length) {
          await new Promise(r => setTimeout(r, backoffs[attempt]));
          continue;
        }
      }
      throw err;
    }
  }

  throw lastError || new Error('Complete failed after retries');
}
