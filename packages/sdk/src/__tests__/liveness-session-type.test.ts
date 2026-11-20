import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertValidSessionParams, createSession } from '../api-client';
import type { SessionType } from '../types';

function stubFetch() {
  const calls: { url: string; init: any }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: any) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ session_id: 's' }) } as any;
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('liveness session type', () => {
  it('sends session_type liveness and no identity_id', async () => {
    const calls = stubFetch();
    const sessionType: SessionType = 'liveness';
    await createSession({
      apiKey: 'k',
      environment: 'sandbox',
      sessionType,
      externalUserId: 'user-1',
      apiBaseUrl: 'https://x/v1',
    });
    const body = JSON.parse(calls[0].init.body);
    expect(body.session_type).toBe('liveness');
    expect(body.external_user_id).toBe('user-1');
    expect(body).not.toHaveProperty('identity_id');
  });

  it('rejects an identityId before any network call, like the server', async () => {
    const calls = stubFetch();
    await expect(
      createSession({ apiKey: 'k', environment: 'sandbox', sessionType: 'liveness', identityId: 'idn_1' }),
    ).rejects.toThrow(/liveness/);
    expect(calls).toHaveLength(0);
  });

  it('treats a blank identityId as absent', () => {
    expect(() => assertValidSessionParams({ sessionType: 'liveness', identityId: '  ' })).not.toThrow();
  });

  it('leaves enrollment and authentication unchanged', async () => {
    expect(() => assertValidSessionParams({ sessionType: 'enrollment' })).not.toThrow();
    expect(() => assertValidSessionParams({ sessionType: 'authentication', identityId: 'idn_1' })).not.toThrow();
    const calls = stubFetch();
    await createSession({ apiKey: 'k', environment: 'sandbox', sessionType: 'authentication', identityId: 'idn_1' });
    expect(JSON.parse(calls[0].init.body).identity_id).toBe('idn_1');
  });
});
