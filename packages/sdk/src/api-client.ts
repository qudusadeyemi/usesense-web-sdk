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

const DEFAULT_API_BASE = 'https://api.usesense.ai/v1';

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
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': params.apiKey,
      'x-environment': params.environment,
    },
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
    headers: {
      'Content-Type': 'application/json',
    },
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

  // Metadata as a JSON blob (multipart file field)
  const metadataBlob = new Blob(
    [JSON.stringify(params.metadata)],
    { type: 'application/json' }
  );
  formData.append('metadata', metadataBlob, 'metadata.json');

  // Audio (speak_phrase only)
  if (params.audioBlob) {
    formData.append('audio', params.audioBlob, 'audio.webm');
  }

  const headers: Record<string, string> = {
    'x-session-token': params.sessionToken,
    'x-nonce': params.nonce,
    'x-environment': params.environment,
    'x-idempotency-key': idempotencyKey,
    // NOTE: Do NOT set Content-Type -- browser sets multipart boundary automatically
    // NOTE: Do NOT send apikey or Authorization -- Cloudflare Worker injects these
  };

  // Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
  const backoffs = [1000, 2000, 4000];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => '');
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
          const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
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

      return res.json();
    } catch (err: any) {
      lastError = err;
      // Only retry on network errors (not HTTP errors already handled above)
      if (err.name === 'TypeError' || err.message?.includes('fetch')) {
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
