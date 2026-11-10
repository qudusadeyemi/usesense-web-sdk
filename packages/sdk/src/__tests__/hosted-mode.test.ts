/**
 * Hosted-link mode for the Flows client, and the theme helpers hosted pages
 * use. Hosted mode must hit exactly the endpoints Watchtower's hosted runner
 * page calls today (/flow-runs/:id/hosted*?t=<token>), so the page can render
 * the SDK FlowRunner without any server change.
 */

import { describe, expect, it, vi } from 'vitest';
import { createFlowsClient } from '../flows/client';
import { flowThemeToEngineTheme, resolveTheme } from '../flows/theme';
import { getEngineStyles } from '../components/styles';
import * as SDK from '../index';
import { SDK_VERSION } from '../version';

const VIEW = { flowRun: { id: 'fr_1', state: 'pending', outcome: null, cursorStepId: null, environment: 'production', pendingAction: null }, definitionSteps: [], stepRuns: [], branding: null };

function client(mode: 'sdk' | 'hosted', extra: Record<string, unknown> = {}) {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(VIEW), { status: 200 })));
  const c = createFlowsClient({
    flowRunId: 'fr 1', sdkToken: 'tok/+=', apiBaseUrl: 'https://wt.example/functions/v1/watchtower-api/', mode,
    fetcher: fetcher as unknown as typeof fetch, ...extra,
  });
  const call = (i: number) => {
    const [url, init] = fetcher.mock.calls[i] as [string, RequestInit];
    return { url, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(init.body as string) : undefined, method: init.method };
  };
  return { c, call };
}

describe('flows client, hosted mode', () => {
  it('calls the hosted endpoints with ?t= and no Bearer header', async () => {
    const { c, call } = client('hosted');
    await c.get();
    await c.advance({ a: 1 });
    await c.submitDeviceSignals('n1', { x: 1 });
    await c.initSession('tool_1');
    await c.uploadDocument({ data: 'b64', mimeType: 'image/jpeg', side: 'single', documentType: 'passport', captureMethod: 'camera', captureSource: { schema: 1 } });
    await c.cancel();
    const B = 'https://wt.example/functions/v1/watchtower-api/flow-runs/fr%201/hosted';
    const T = 't=tok%2F%2B%3D';
    expect([0, 1, 2, 3, 4, 5].map((i) => `${call(i).method} ${call(i).url}`)).toEqual([
      `GET ${B}?${T}&caps=device_signals_v1`,
      `POST ${B}/advance?${T}`,
      `POST ${B}/device-signals?${T}`,
      `POST ${B}/init-session?${T}`,
      `POST ${B}/documents?${T}`,
      `POST ${B}/cancel?${T}`,
    ]);
    for (let i = 0; i < 6; i++) expect(call(i).headers).not.toHaveProperty('authorization');
    // Bodies match the hosted page's.
    expect(call(1).body).toEqual({ inputs: { a: 1 }, client: { capabilities: ['device_signals_v1'] } });
    expect(call(2).body).toEqual({ nonce: 'n1', channel_integrity: { x: 1 }, client: { capabilities: ['device_signals_v1'] } });
    expect(call(4).body).toEqual({ data: 'b64', mimeType: 'image/jpeg', side: 'single', documentType: 'passport', captureMethod: 'camera', captureSource: { schema: 1 } });
  });

  it('sends client_context on init-session when given', async () => {
    const ctx = { schema_version: 1 as const, sdk: { name: 'web' }, app: { identifier: 'usesense-hosted-capture' } };
    const { c, call } = client('hosted', { clientContext: ctx });
    await c.initSession('tool_1', { components: { platform: 'iPhone' } });
    // A web context without a version gets the running SDK's version.
    expect(call(0).body.client_context).toEqual({ ...ctx, sdk: { name: 'web', version: SDK_VERSION } });
    expect(call(0).body.device_binding).toEqual({ components: { platform: 'iPhone' } });
    expect(call(0).body.toolId).toBe('tool_1');
  });

  it('leaves SDK mode unchanged (Bearer, /v1/sdk paths, no token in URLs)', async () => {
    const { c, call } = client('sdk');
    await c.get();
    await c.initSession('tool_1');
    expect(call(0).url).toBe('https://wt.example/functions/v1/watchtower-api/v1/sdk/flow-runs/fr%201?caps=device_signals_v1');
    expect(call(0).headers.authorization).toBe('Bearer tok/+=');
    expect(call(0).url).not.toContain('tok');
    // The server recognises the web SDK only from this block (passive-first policy).
    expect(call(1).body.client_context).toEqual({ schema_version: 1, sdk: { name: 'web', version: SDK_VERSION } });
  });
});

describe('flowThemeToEngineTheme', () => {
  it('maps a resolved FlowTheme onto the engine tokens, including capture colours', () => {
    const t = resolveTheme({ colors: { primary: '#123456', warning: '#FFAA00' }, capture: { ring: '#00D4AA' } }, false);
    const e = flowThemeToEngineTheme(t);
    expect(e).toMatchObject({ bg: t.bg, fg: t.fg, warning: '#FFAA00', fontBody: t.fontBody, capture: { ring: '#00D4AA' } });
    // Light mode keeps the engine's own light surfaces.
    expect(e.lightBg).toBeUndefined();
    const dark = flowThemeToEngineTheme(resolveTheme(undefined, true));
    expect(dark.lightBg).toBe(dark.bg);
  });

  it('never writes "undefined" into the engine CSS', () => {
    const css = getEngineStyles('#4F7CFF', flowThemeToEngineTheme(resolveTheme(undefined, false)));
    expect(css).not.toContain('undefined');
  });
});

describe('hosted-page exports', () => {
  it('exports the helpers hosted pages need', () => {
    for (const name of [
      'collectCameraInventory', 'collectCaptureSourceEvidence', 'matchVirtualCameraLabel',
      'collectDeviceBinding', 'waitForForeground', 'deviceSignalsNeedsReload',
      'resolveTheme', 'injectBrandFonts', 'mergeAppearance', 'flowThemeToEngineTheme',
      'FlowRunner', 'createFlowsClient', 'VerificationCaptureEngine',
    ]) {
      expect(typeof (SDK as Record<string, unknown>)[name], name).toBe('function');
    }
    expect(Array.isArray(SDK.VIRTUAL_CAMERA_DRIVERS)).toBe(true);
  });
});
