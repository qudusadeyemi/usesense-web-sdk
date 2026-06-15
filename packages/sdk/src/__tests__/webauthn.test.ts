/**
 * Unit tests for attestChannel.
 *
 * Vitest in this repo runs in `environment: 'node'` for speed and to
 * avoid adding jsdom/happy-dom as a dependency. The full ceremony
 * round-trip needs a real authenticator anyway and lives in Phase 5
 * browser CI. Here we cover what's testable in node:
 *   - public API surface and option contract
 *   - graceful no_window fallback when document/window are absent
 *
 * The iframe + postMessage protocol is exercised in browser CI against
 * a virtual authenticator; covering it here would require pulling in
 * a DOM emulator that the SDK doesn't otherwise need.
 */

import { describe, expect, it } from 'vitest';
import { attestChannel } from '../webauthn';
import type { AttestChannelOptions, AttestChannelResult } from '../webauthn';

describe('attestChannel', () => {
  it('exports a function', () => {
    expect(typeof attestChannel).toBe('function');
  });

  it('returns no_window when running outside a browser', async () => {
    // In the node test environment, `window` and `document` are
    // undefined. The function should fail soft with reason='no_window'
    // rather than throwing.
    const result = await attestChannel({
      type: 'register',
      sessionId: 'sess_node_smoke',
      apiBaseUrl: 'https://api.example.com/watchtower-api',
      iframeOrigin: 'https://id.usesense.ai',
    });
    expect(result.verified).toBe(false);
    expect(result.reason).toBe('no_window');
  });

  it('AttestChannelOptions accepts the documented shape', () => {
    const opts: AttestChannelOptions = {
      type: 'authenticate',
      sessionId: 'sess_xyz',
      apiBaseUrl: 'https://api.example.com',
      iframeOrigin: 'https://id.usesense.ai',
      displayName: 'Jane',
      timeoutMs: 30_000,
    };
    expect(opts.type).toBe('authenticate');
  });

  it('AttestChannelResult shape is well-defined', () => {
    const ok: AttestChannelResult = { verified: true, credentialId: 'abc' };
    const fail: AttestChannelResult = { verified: false, reason: 'timeout' };
    expect(ok.verified).toBe(true);
    expect(fail.reason).toBe('timeout');
  });
});
