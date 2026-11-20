// @vitest-environment jsdom
/**
 * Which environment reaches the capture engine. The engine puts it on every
 * upload (`?env=`), so a production session sent as sandbox hangs on
 * "Almost done". The key decides when an API key is used in the browser;
 * otherwise the session's own environment must win.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let rendered: { props: Record<string, unknown> } | null = null;

vi.mock('react-dom/client', () => ({
  createRoot: () => ({
    render: (el: { props: Record<string, unknown> }) => {
      rendered = el;
    },
    unmount: () => {},
  }),
}));

vi.mock('../api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api-client')>();
  return {
    ...actual,
    exchangeToken: vi.fn(async () => ({
      session_id: 'sess_live',
      session_token: 'tok',
      nonce: 'n',
      environment: 'production',
    })),
  };
});

import { UseSenseSDK } from '../sdk';
import { detectEnvironmentFromKey } from '../utils/env';

// Fake keys: only the prefix matters here.
const LIVE_KEY = 'pk_example_not_a_real_key';
const TEST_KEY = 'sk_example_not_a_real_key';

const session = (environment: 'production' | 'sandbox') =>
  ({ session_id: 'sess_1', session_token: 'tok', nonce: 'n', environment }) as never;

beforeEach(() => {
  rendered = null;
  document.body.innerHTML = '<div id="mount"></div>';
});

describe('detectEnvironmentFromKey', () => {
  it('treats pk_ keys as production and sk_ keys as sandbox, like the server', () => {
    expect(detectEnvironmentFromKey(LIVE_KEY)).toBe('production');
    expect(detectEnvironmentFromKey(TEST_KEY)).toBe('sandbox');
    expect(detectEnvironmentFromKey(`  ${LIVE_KEY}  `)).toBe('production');
  });

  it('still treats the older _live_ / _prod_ names as production', () => {
    expect(detectEnvironmentFromKey('sk_live_example')).toBe('production');
    expect(detectEnvironmentFromKey('key_prod_example')).toBe('production');
  });
});

describe('UseSenseSDK environment', () => {
  it('does not force sandbox onto a production session started without a key', () => {
    const sdk = new UseSenseSDK({});
    sdk.startWithSession(session('production'), '#mount');
    expect(rendered?.props.environment).toBeUndefined();
    expect((rendered?.props.sessionData as { environment: string }).environment).toBe('production');
  });

  it('lets a live client token run in production', async () => {
    const sdk = new UseSenseSDK({});
    await sdk.startWithToken('cli_tok_example', '#mount');
    expect(rendered?.props.environment).toBeUndefined();
    expect((rendered?.props.sessionData as { environment: string }).environment).toBe('production');
  });

  it("uses the key's environment when an API key is used in the browser", () => {
    const live = new UseSenseSDK({ apiKey: LIVE_KEY });
    live.startWithSession(session('production'), '#mount');
    expect(rendered?.props.environment).toBe('production');

    const test = new UseSenseSDK({ apiKey: TEST_KEY });
    test.startWithSession(session('sandbox'), '#mount');
    expect(rendered?.props.environment).toBe('sandbox');
  });

  it('keeps an explicit environment as an override', () => {
    const sdk = new UseSenseSDK({ environment: 'sandbox' });
    sdk.startWithSession(session('sandbox'), '#mount');
    expect(rendered?.props.environment).toBe('sandbox');
  });
});
