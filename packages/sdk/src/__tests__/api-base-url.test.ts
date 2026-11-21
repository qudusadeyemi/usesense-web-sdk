/**
 * apiBaseUrl is accepted with or without the /v1 segment, everywhere.
 *
 * The entry points used to disagree: UseSenseSDK / documents wanted
 * `https://api.usesense.ai/v1`, while flows and deviceCheck wanted
 * `https://api.usesense.ai`. The wrong form 404s without CORS headers, which a
 * browser reports only as "Failed to fetch" (hit on a device test, 2026-11-21).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiOrigin, apiV1Base } from '../utils/api-base';
import { exchangeToken } from '../api-client';
import { createFlowsClient } from '../flows/client';

const FORMS = [
  'https://api.usesense.ai',
  'https://api.usesense.ai/',
  'https://api.usesense.ai/v1',
  'https://api.usesense.ai/v1/',
  '  https://api.usesense.ai/V1  ',
];

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiOrigin / apiV1Base', () => {
  it.each(FORMS)('normalises %j', (input) => {
    expect(apiOrigin(input)).toBe('https://api.usesense.ai');
    expect(apiV1Base(input)).toBe('https://api.usesense.ai/v1');
  });

  it('defaults to production when unset or blank', () => {
    expect(apiV1Base(undefined)).toBe('https://api.usesense.ai/v1');
    expect(apiV1Base('')).toBe('https://api.usesense.ai/v1');
    expect(apiV1Base('   ')).toBe('https://api.usesense.ai/v1');
  });

  it('keeps a custom host or proxy path', () => {
    expect(apiV1Base('https://staging.api.usesense.ai')).toBe('https://staging.api.usesense.ai/v1');
    expect(apiV1Base('https://proxy.example.com/usesense/v1')).toBe('https://proxy.example.com/usesense/v1');
    expect(apiOrigin('https://proxy.example.com/usesense')).toBe('https://proxy.example.com/usesense');
  });
});

describe('every entry point reaches the same URL with either form', () => {
  it.each(FORMS)('exchangeToken with %j', async (input) => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ session_id: 's', session_token: 't', nonce: 'n' }));
    vi.stubGlobal('fetch', fetchMock);
    await exchangeToken({ apiBaseUrl: input, clientToken: 'cli_tok_x' } as never);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.usesense.ai/v1/sessions/exchange-token');
  });

  it.each(FORMS)('flows client with %j', async (input) => {
    const fetcher = vi.fn().mockResolvedValue(
      ok({ flowRun: { id: 'fr_1', state: 'pending', outcome: null, cursorStepId: null, environment: 'production', pendingAction: null }, definitionSteps: [], stepRuns: [], branding: null }),
    );
    const client = createFlowsClient({ flowRunId: 'fr_1', sdkToken: 't', apiBaseUrl: input, fetcher: fetcher as unknown as typeof fetch });
    await client.get();
    expect(String(fetcher.mock.calls[0][0]).split('?')[0]).toBe('https://api.usesense.ai/v1/sdk/flow-runs/fr_1');
  });
});
