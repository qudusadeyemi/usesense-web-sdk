/**
 * An action kind this SDK version cannot render must be visible and
 * diagnosable, not a blank screen.
 *
 * Regression cover for a production incident: `capture/id_number` landed in
 * 4.5.0, and an integrator pinned below that got the step delivered, rendered
 * nothing, and left the run parked. Server side that is indistinguishable from
 * an applicant walking away, so it read as drop-off for days. Across 346 runs
 * the step produced 7 results and zero rejections.
 */

import { describe, expect, it } from 'vitest';
import { describeAction } from '../FlowRunner';
import { SDK_NAME, SDK_VERSION, CLIENT_ID } from '../version';
import type { PendingAction } from '../types';

describe('unsupported action reporting', () => {
  it('names a capture action by kind and capture, which is what the operator needs', () => {
    const action = { kind: 'capture', capture: 'id_number', toolId: 'id_number_verification', idTypes: [] } as unknown as PendingAction;
    // "capture" alone was the old message and does not identify the step: every
    // document, face and form step is also kind "capture".
    expect(describeAction(action)).toBe('capture/id_number');
  });

  it('falls back to the bare kind when there is no capture discriminator', () => {
    expect(describeAction({ kind: 'redirect_to_consent', consentUrl: 'https://x' } as unknown as PendingAction))
      .toBe('redirect_to_consent');
  });

  it('exposes an SDK identity the server can record', () => {
    expect(SDK_NAME).toBe('web');
    expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    expect(CLIENT_ID).toBe(`${SDK_NAME}/${SDK_VERSION}`);
  });
});
