import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSession, exchangeToken, requestChallengeFallback, ChallengeFallbackError } from '../api-client';
import { webClientContext, resolveClientContext } from '../client-context';
import { SDK_VERSION } from '../version';

// Watchtower recognises the web SDK only from client_context (passive-first
// policy from Web 4.12.0), so every session start must send it.

const WEB = { schema_version: 1, sdk: { name: 'web', version: SDK_VERSION } };

function stubFetch(status = 200, json: unknown = {}) {
  const calls: { url: string; init: any }[] = [];
  const f = vi.fn(async (url: string, init: any) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => json } as any;
  });
  vi.stubGlobal('fetch', f);
  return { calls, f };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('client_context', () => {
  it('is the web SDK and its version', () => {
    expect(webClientContext()).toEqual(WEB);
  });

  it('is sent on POST /v1/sessions', async () => {
    const { calls } = stubFetch(200, { session_id: 's' });
    await createSession({ apiKey: 'k', environment: 'sandbox', sessionType: 'enrollment', apiBaseUrl: 'https://x/v1' });
    expect(calls[0].url).toBe('https://x/v1/sessions');
    expect(JSON.parse(calls[0].init.body).client_context).toEqual(WEB);
  });

  it('is sent on exchange-token', async () => {
    const { calls } = stubFetch(200, { session_id: 's' });
    await exchangeToken({ clientToken: 'ct', apiBaseUrl: 'https://x/v1' });
    expect(calls[0].url).toBe('https://x/v1/sessions/exchange-token');
    expect(JSON.parse(calls[0].init.body)).toMatchObject({ client_token: 'ct', client_context: WEB });
  });

  it("keeps a caller's context, filling in a missing web version", () => {
    const hosted = { schema_version: 1 as const, sdk: { name: 'web' }, app: { identifier: 'usesense-hosted-capture' } };
    expect(resolveClientContext(hosted)).toEqual({ ...hosted, sdk: { name: 'web', version: SDK_VERSION } });
    const other = { schema_version: 1 as const, sdk: { name: 'flutter', version: '1.0.0' } };
    expect(resolveClientContext(other)).toBe(other);
    expect(resolveClientContext(undefined)).toEqual(WEB);
  });
});

describe('requestChallengeFallback', () => {
  const params = { apiBaseUrl: 'https://x/v1', environment: 'sandbox' as const, sessionId: 'ses 1', sessionToken: 'tok' };

  it('posts the reason with session-token auth and returns the new policy', async () => {
    const policy = { challenge_type: 'follow_dot', challenge: { type: 'follow_dot', seed: 's', waypoints: [] } };
    const fetcher = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ session_id: 'ses 1', policy }) }) as any);
    const r = await requestChallengeFallback({ ...params, fetcher });
    expect(r.policy).toEqual(policy);
    const [url, init] = fetcher.mock.calls[0] as any[];
    expect(url).toBe('https://x/v1/sessions/ses%201/challenge-fallback?env=sandbox');
    expect(init.method).toBe('POST');
    expect(init.headers['x-session-token']).toBe('tok');
    expect(init.headers).not.toHaveProperty('x-api-key');
    expect(JSON.parse(init.body)).toEqual({ reason: 'microphone_unavailable' });
  });

  it.each([
    [409, 'capture_already_uploaded', 'capture_already_uploaded'],
    [409, 'fallback_not_allowed', 'fallback_not_allowed'],
    [400, 'invalid_request', 'invalid_request'],
    [401, 'unauthorized', 'unauthorized'],
    [500, 'internal_error', 'server'],
  ])('maps %i %s to %s', async (status, serverCode, code) => {
    const fetcher = vi.fn(async () => ({ ok: false, status, json: async () => ({ error: { code: serverCode, message: 'no' } }) }) as any);
    const err = await requestChallengeFallback({ ...params, fetcher }).catch((e) => e);
    expect(err).toBeInstanceOf(ChallengeFallbackError);
    expect(err.code).toBe(code);
    expect(err.status).toBe(status);
  });

  it('reports a network failure as network', async () => {
    const fetcher = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const err = await requestChallengeFallback({ ...params, fetcher: fetcher as any }).catch((e) => e);
    expect(err.code).toBe('network');
  });
});
