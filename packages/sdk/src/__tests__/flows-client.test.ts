/**
 * Tests for the Flows SDK client.
 *
 * The client is the boundary between the SDK runner and the public API. Two
 * things are load-bearing:
 *   1. Auth — every request carries `Authorization: Bearer <sdkToken>` and the
 *      token is never put in the URL (so it never lands in server logs).
 *   2. Error translation — the server's HTTP/JSON envelope maps to the SDK's
 *      FlowError taxonomy so a host app's catch block is one path per code.
 */

import { describe, expect, it, vi } from 'vitest';
import { createFlowsClient } from '../flows/client';
import { FlowError } from '../flows/types';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('flows client', () => {
  it('GETs the run state with a Bearer header and never puts the token in the URL', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, { flowRun: { id: 'fr_1', state: 'pending', outcome: null, cursorStepId: null, environment: 'production', pendingAction: null }, definitionSteps: [], stepRuns: [], branding: null }));
    const client = createFlowsClient({ flowRunId: 'fr_1', sdkToken: 'tok_abc', fetcher: fetcher as unknown as typeof fetch });

    await client.get();

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.usesense.ai/v1/sdk/flow-runs/fr_1');
    expect(url).not.toContain('tok_abc');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok_abc');
  });

  it('translates 401 into FlowError.token_expired', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'SDK token has expired', code: 'token_expired' }));
    const client = createFlowsClient({ flowRunId: 'fr_x', sdkToken: 't', fetcher: fetcher as unknown as typeof fetch });

    await expect(client.get()).rejects.toMatchObject({ code: 'token_expired' });
  });

  it('translates 403 into FlowError.token_invalid', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(403, { error: 'Invalid token', code: 'forbidden' }));
    const client = createFlowsClient({ flowRunId: 'fr_x', sdkToken: 't', fetcher: fetcher as unknown as typeof fetch });

    await expect(client.get()).rejects.toMatchObject({ code: 'token_invalid' });
  });

  it('translates 5xx into FlowError.provider_unavailable', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(503, { error: 'unavailable' }));
    const client = createFlowsClient({ flowRunId: 'fr_x', sdkToken: 't', fetcher: fetcher as unknown as typeof fetch });

    await expect(client.advance({})).rejects.toMatchObject({ code: 'provider_unavailable' });
  });

  it('translates a thrown network error into FlowError.network_unavailable', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const client = createFlowsClient({ flowRunId: 'fr_x', sdkToken: 't', fetcher: fetcher as unknown as typeof fetch });

    const err = await client.cancel().catch((e) => e);
    expect(err).toBeInstanceOf(FlowError);
    expect((err as FlowError).code).toBe('network_unavailable');
  });

  it('advance posts {inputs} as the JSON body', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, { flowRun: { id: 'fr_1', state: 'in_progress', outcome: null, cursorStepId: 's2', environment: 'production', pendingAction: null }, definitionSteps: [], stepRuns: [], branding: null }));
    const client = createFlowsClient({ flowRunId: 'fr_1', sdkToken: 't', fetcher: fetcher as unknown as typeof fetch });

    await client.advance({ document_id: 'doc_1' });

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ inputs: { document_id: 'doc_1' } });
  });
});
