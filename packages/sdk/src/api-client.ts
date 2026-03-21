/**
 * API Client for UseSense watchtower-api
 *
 * Handles all HTTP communication with the three endpoints:
 *   POST /v1/sessions          (create session)
 *   POST /v1/sessions/:id/signals  (upload frames + metadata)
 *   POST /v1/sessions/:id/complete (get decision)
 */

import type {
  Environment,
  SessionType,
  CreateSessionResponse,
  UploadSignalsResponse,
  CompleteSessionResponse,
  SignalMetadata,
} from './types';

const DEFAULT_API_BASE =
  'https://api.usesense.ai/functions/v1/watchtower-api';

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
 * For production, prefer Pattern A (host backend creates session).
 */
export async function createSession(
  params: CreateSessionParams
): Promise<CreateSessionResponse> {
  const base = params.apiBaseUrl || DEFAULT_API_BASE;
  const url = `${base}/v1/sessions`;

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
// Upload Signals
// ============================================================================

export interface UploadSignalsParams {
  apiBaseUrl?: string;
  anonKey: string;
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
 * Retries up to 3 times with exponential backoff on failure.
 */
export async function uploadSignals(
  params: UploadSignalsParams
): Promise<UploadSignalsResponse> {
  const base = params.apiBaseUrl || DEFAULT_API_BASE;
  const url = `${base}/v1/sessions/${params.sessionId}/signals`;
  const idempotencyKey = crypto.randomUUID();

  const formData = new FormData();

  // Append each frame
  for (const frameBuffer of params.frames) {
    const blob = new Blob([frameBuffer], { type: 'image/jpeg' });
    formData.append('frames[]', blob, 'frame.jpg');
  }

  // Metadata as JSON file
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
  };

  // Also send anonKey for Supabase gateway auth
  if (params.anonKey) {
    headers['Authorization'] = `Bearer ${params.anonKey}`;
    headers['apikey'] = params.anonKey;
  }

  // Retry logic: 3 attempts with exponential backoff
  const backoffs = [2000, 4000, 8000];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error?.message || data.message || `Upload failed (${res.status})`
        );
      }

      return res.json();
    } catch (err: any) {
      lastError = err;
      console.warn(
        `[UseSense] Upload attempt ${attempt + 1} failed:`,
        err.message
      );
      if (attempt < backoffs.length) {
        await new Promise(r => setTimeout(r, backoffs[attempt]));
      }
    }
  }

  throw lastError || new Error('Upload failed after retries');
}

// ============================================================================
// Complete Session
// ============================================================================

export interface CompleteSessionParams {
  apiBaseUrl?: string;
  anonKey: string;
  environment: Environment;
  sessionId: string;
  sessionToken: string;
  nonce: string;
}

/**
 * Complete the session and retrieve the server decision.
 * Retries up to 3 times with exponential backoff.
 */
export async function completeSession(
  params: CompleteSessionParams
): Promise<CompleteSessionResponse> {
  const base = params.apiBaseUrl || DEFAULT_API_BASE;
  const url = `${base}/v1/sessions/${params.sessionId}/complete`;
  const idempotencyKey = crypto.randomUUID();

  const headers: Record<string, string> = {
    'x-session-token': params.sessionToken,
    'x-nonce': params.nonce,
    'x-environment': params.environment,
    'x-idempotency-key': idempotencyKey,
  };

  if (params.anonKey) {
    headers['Authorization'] = `Bearer ${params.anonKey}`;
    headers['apikey'] = params.anonKey;
  }

  const backoffs = [2000, 4000, 8000];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error?.message || data.message || `Complete failed (${res.status})`
        );
      }

      return res.json();
    } catch (err: any) {
      lastError = err;
      console.warn(
        `[UseSense] Complete attempt ${attempt + 1} failed:`,
        err.message
      );
      if (attempt < backoffs.length) {
        await new Promise(r => setTimeout(r, backoffs[attempt]));
      }
    }
  }

  throw lastError || new Error('Complete failed after retries');
}
