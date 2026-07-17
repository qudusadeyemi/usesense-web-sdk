/**
 * Unit tests for the framework-free FlowController action loop, driven by a
 * stubbed FlowsClient. Mirrors main's React runner semantics: auto-start,
 * inline invalid_input, terminal resolution, cancel, and document upload.
 */

import { describe, expect, it, vi } from 'vitest';
import { FlowController } from '../flow-controller';
import { FlowError, type FlowRunView, type PendingAction } from '../../types';
import type { FlowsClient } from '../../client';

function view(
  state: FlowRunView['flowRun']['state'],
  pendingAction: PendingAction | null,
  outcome: FlowRunView['flowRun']['outcome'] = null
): FlowRunView {
  return {
    flowRun: {
      id: 'fr_1',
      state,
      outcome,
      cursorStepId: null,
      environment: 'sandbox',
      pendingAction,
    },
    definitionSteps: [],
    stepRuns: [],
    branding: null,
  };
}

const formAction: PendingAction = {
  kind: 'capture',
  capture: 'form',
  fields: [{ key: 'name', type: 'text', required: true }],
};

function stub(overrides: Partial<FlowsClient>): FlowsClient {
  return {
    get: vi.fn(),
    advance: vi.fn(),
    cancel: vi.fn(),
    initSession: vi.fn(),
    uploadDocument: vi.fn(),
    ...overrides,
  } as FlowsClient;
}

describe('FlowController', () => {
  it('parks on the pending action after start', async () => {
    const controller = new FlowController(
      stub({ get: vi.fn().mockResolvedValue(view('in_progress', formAction)) })
    );
    await controller.start();
    const s = controller.getState();
    expect(s.phase).toBe('action');
    if (s.phase === 'action') expect(s.action).toEqual(formAction);
  });

  it('auto-advances a freshly created pending run with no action', async () => {
    const advance = vi.fn().mockResolvedValue(view('in_progress', formAction));
    const controller = new FlowController(
      stub({ get: vi.fn().mockResolvedValue(view('pending', null)), advance })
    );
    await controller.start();
    expect(advance).toHaveBeenCalledWith({});
    expect(controller.getState().phase).toBe('action');
  });

  it('resolves done on a terminal view', async () => {
    const controller = new FlowController(
      stub({ get: vi.fn().mockResolvedValue(view('completed', null, 'APPROVE')) })
    );
    await controller.start();
    const s = controller.getState();
    expect(s.phase).toBe('done');
    if (s.phase === 'done') {
      expect(s.result).toEqual({
        flowRunId: 'fr_1',
        state: 'completed',
        outcome: 'APPROVE',
      });
    }
  });

  it('surfaces invalid_input as inline field errors without terminating', async () => {
    const advance = vi
      .fn()
      .mockRejectedValue(
        new FlowError('invalid_input', 'bad', 'invalid_input', {
          errors: [{ field_key: 'name', message: 'Required' }],
        })
      );
    const controller = new FlowController(
      stub({ get: vi.fn().mockResolvedValue(view('in_progress', formAction)), advance })
    );
    await controller.start();
    await controller.advance({ name: '' });
    const s = controller.getState();
    expect(s.phase).toBe('action');
    if (s.phase === 'action') expect(s.fieldErrors).toEqual({ name: 'Required' });
  });

  it('clears field errors on a subsequent successful advance', async () => {
    const advance = vi
      .fn()
      .mockRejectedValueOnce(
        new FlowError('invalid_input', 'bad', 'invalid_input', {
          errors: [{ field_key: 'name', message: 'Required' }],
        })
      )
      .mockResolvedValueOnce(view('completed', null, 'APPROVE'));
    const controller = new FlowController(
      stub({ get: vi.fn().mockResolvedValue(view('in_progress', formAction)), advance })
    );
    await controller.start();
    await controller.advance({ name: '' });
    await controller.advance({ name: 'Ada' });
    expect(controller.getState().phase).toBe('done');
  });

  it('fails on a non-validation advance error', async () => {
    const controller = new FlowController(
      stub({
        get: vi.fn().mockResolvedValue(view('in_progress', formAction)),
        advance: vi.fn().mockRejectedValue(new FlowError('provider_unavailable', 'down')),
      })
    );
    await controller.start();
    await controller.advance({ name: 'x' });
    const s = controller.getState();
    expect(s.phase).toBe('error');
    if (s.phase === 'error') expect(s.error.code).toBe('provider_unavailable');
  });

  it('uploadDocument advances with document_id on success', async () => {
    const advance = vi.fn().mockResolvedValue(view('completed', null, 'APPROVE'));
    const uploadDocument = vi
      .fn()
      .mockResolvedValue({ document_id: 'doc_1', status: 'completed' });
    const controller = new FlowController(
      stub({
        get: vi.fn().mockResolvedValue(view('in_progress', null)),
        advance,
        uploadDocument,
      })
    );
    await controller.uploadDocument({ data: 'b64', mimeType: 'image/jpeg', documentType: 'identity' });
    expect(uploadDocument).toHaveBeenCalledWith({
      data: 'b64',
      mimeType: 'image/jpeg',
      side: 'single',
      documentType: 'identity',
    });
    expect(advance).toHaveBeenCalledWith({ document_id: 'doc_1' });
  });

  it('uploadDocument fails with provider_unavailable on failed+provider', async () => {
    const uploadDocument = vi
      .fn()
      .mockResolvedValue({ document_id: 'd', status: 'failed', reason: 'provider' });
    const controller = new FlowController(stub({ uploadDocument }));
    await controller.uploadDocument({ data: 'b64', mimeType: 'image/jpeg' });
    const s = controller.getState();
    expect(s.phase).toBe('error');
    if (s.phase === 'error') expect(s.error.code).toBe('provider_unavailable');
  });

  it('cancel resolves done on the terminal view', async () => {
    const controller = new FlowController(
      stub({
        get: vi.fn().mockResolvedValue(view('in_progress', formAction)),
        cancel: vi.fn().mockResolvedValue(view('cancelled', null)),
      })
    );
    await controller.start();
    await controller.cancel();
    const s = controller.getState();
    expect(s.phase).toBe('done');
    if (s.phase === 'done') expect(s.result.state).toBe('cancelled');
  });

  it('ignores advance after the run has settled', async () => {
    const advance = vi.fn().mockResolvedValue(view('in_progress', formAction));
    const controller = new FlowController(
      stub({ get: vi.fn().mockResolvedValue(view('completed', null, 'APPROVE')), advance })
    );
    await controller.start();
    await controller.advance({ x: 1 });
    expect(advance).not.toHaveBeenCalled();
  });
});
