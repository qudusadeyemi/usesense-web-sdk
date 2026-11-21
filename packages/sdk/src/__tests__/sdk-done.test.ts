// @vitest-environment jsdom
/**
 * 'complete' fires once per verification. Done on the result screen used to
 * call onComplete a second time, so hosts saw 'complete' twice (native
 * delivers once). Done now emits 'done' and closes the capture.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let rendered: { props: Record<string, any> } | null = null;
const unmount = vi.fn();

vi.mock('react-dom/client', () => ({
  createRoot: () => ({
    render: (el: { props: Record<string, any> }) => { rendered = el; },
    unmount,
  }),
}));

import { UseSenseSDK } from '../sdk';

const session = { session_id: 'sess_1', session_token: 'tok', nonce: 'n', environment: 'sandbox' } as never;
const result = { sessionId: 'sess_1', decision: 'APPROVE' } as never;

beforeEach(() => {
  rendered = null;
  unmount.mockClear();
  document.body.innerHTML = '<div id="mount"></div>';
});

describe('UseSenseSDK complete and done', () => {
  it("fires 'complete' once, then 'done' on Done, and closes", async () => {
    const sdk = new UseSenseSDK({});
    const complete = vi.fn();
    const done = vi.fn();
    sdk.on('complete', complete);
    sdk.on('done', done);
    await sdk.startWithSession(session, '#mount');

    rendered!.props.onComplete(result); // the decision arrives
    rendered!.props.onDone(result);     // the person taps Done

    expect(complete).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith(result);
    expect(unmount).toHaveBeenCalledTimes(1);
  });
});
