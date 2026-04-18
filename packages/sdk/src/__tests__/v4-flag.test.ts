/**
 * Unit tests for X-1: v4 opt-in header plumbing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSession, exchangeToken, withSdkVersionHeader } from '../api-client';

const originalFetch = globalThis.fetch;

function captureFetch() {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = vi.fn(async (url: any, init: any) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        session_id: 'sess_test',
        session_token: 'tok',
        expires_at: '2030-01-01T00:00:00Z',
        upload_config: {},
        policy: {},
      }),
    } as any;
  });
  return calls;
}

describe('X-1: v4 opt-in header plumbing', () => {
  beforeEach(() => {});
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('withSdkVersionHeader: appends x-usesense-sdk-version when v4', () => {
    const h = withSdkVersionHeader({ 'Content-Type': 'application/json' }, 'v4');
    expect(h['x-usesense-sdk-version']).toBe('v4');
  });

  it('withSdkVersionHeader: does not append for v3', () => {
    const h = withSdkVersionHeader({ 'Content-Type': 'application/json' }, 'v3');
    expect(h['x-usesense-sdk-version']).toBeUndefined();
  });

  it('withSdkVersionHeader: does not append when omitted', () => {
    const h = withSdkVersionHeader({ 'Content-Type': 'application/json' }, undefined);
    expect(h['x-usesense-sdk-version']).toBeUndefined();
  });

  it('createSession: sends v4 header when sdkVersion=v4', async () => {
    const calls = captureFetch();
    await createSession({
      apiKey: 'pk_test',
      environment: 'staging',
      sessionType: 'enrollment',
      sdkVersion: 'v4',
    });
    expect(calls).toHaveLength(1);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['x-usesense-sdk-version']).toBe('v4');
    expect(headers['x-api-key']).toBe('pk_test');
  });

  it('createSession: omits v4 header by default', async () => {
    const calls = captureFetch();
    await createSession({
      apiKey: 'pk_test',
      environment: 'staging',
      sessionType: 'enrollment',
    });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['x-usesense-sdk-version']).toBeUndefined();
  });

  it('exchangeToken: sends v4 header when opted in', async () => {
    const calls = captureFetch();
    await exchangeToken({ clientToken: 'ct_x', sdkVersion: 'v4' });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['x-usesense-sdk-version']).toBe('v4');
  });

  it('exchangeToken: omits v4 header when not opted in', async () => {
    const calls = captureFetch();
    await exchangeToken({ clientToken: 'ct_x' });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['x-usesense-sdk-version']).toBeUndefined();
  });
});
