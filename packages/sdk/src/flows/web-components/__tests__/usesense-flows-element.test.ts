/**
 * @vitest-environment happy-dom
 *
 * DOM-level tests for the <usesense-flows> Web Components surface, driven by a
 * stubbed FlowsClient. Covers the built-in surfaces (form, id_number, document,
 * info, consent), branding, value preservation, a11y, and the cancelable
 * capture escape hatch for face capture.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineUseSenseFlowsElement } from '../usesense-flows-element';
import * as clientModule from '../../client';
import { FlowError, type FlowRunView, type PendingAction } from '../../types';
import type { FlowsClient } from '../../client';

defineUseSenseFlowsElement();

function view(
  pendingAction: PendingAction | null,
  opts: {
    state?: FlowRunView['flowRun']['state'];
    primaryColor?: string;
    outcome?: FlowRunView['flowRun']['outcome'];
  } = {}
): FlowRunView {
  return {
    flowRun: {
      id: 'fr_1',
      state: opts.state ?? 'in_progress',
      outcome: opts.outcome ?? null,
      cursorStepId: null,
      environment: 'sandbox',
      pendingAction,
    },
    definitionSteps: [],
    stepRuns: [],
    branding: opts.primaryColor
      ? {
          display_name: 'Acme',
          logo_url: null,
          primary_color: opts.primaryColor,
          redirect_url: null,
        }
      : null,
  };
}

let currentStub: FlowsClient;

function stubClient(overrides: Partial<FlowsClient>): FlowsClient {
  const stub = {
    get: vi.fn(),
    advance: vi.fn(),
    cancel: vi.fn(),
    initSession: vi.fn(),
    uploadDocument: vi.fn(),
    ...overrides,
  } as FlowsClient;
  currentStub = stub;
  return stub;
}

/** Mount an element whose controller uses the given first view. */
async function mount(
  firstView: FlowRunView,
  overrides: Partial<FlowsClient> = {}
): Promise<HTMLElement> {
  const client = stubClient({
    get: vi.fn().mockResolvedValue(firstView),
    ...overrides,
  });
  vi.spyOn(clientModule, 'createFlowsClient').mockReturnValue(client);

  const el = document.createElement('usesense-flows');
  el.setAttribute('flow-run-id', 'fr_1');
  el.setAttribute('sdk-token', 'tok');
  document.body.appendChild(el);
  // Wait past the initial loading spinner until the real surface renders.
  await vi.waitFor(() => {
    const r = el.shadowRoot!;
    if (!r.querySelector('.wrap') || r.querySelector('.pending')) {
      throw new Error('still loading');
    }
  });
  return el;
}

const formAction: PendingAction = {
  kind: 'capture',
  capture: 'form',
  fields: [
    { key: 'full_name', type: 'text', required: true },
    { key: 'email', type: 'email', required: true },
  ],
};

describe('<usesense-flows> Web Components surface', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the custom element', () => {
    expect(customElements.get('usesense-flows')).toBeTruthy();
  });

  it('renders a form surface for a form action', async () => {
    const el = await mount(view(formAction));
    const root = el.shadowRoot!;
    expect(root.querySelector('#full_name')).toBeTruthy();
    expect(root.querySelector('#email')).toBeTruthy();
    expect(root.querySelector('button.primary')?.textContent).toBe('Continue');
  });

  it('shows inline client validation without advancing', async () => {
    const advance = vi.fn().mockResolvedValue(view(null, { state: 'completed', outcome: 'APPROVE' }));
    const el = await mount(view(formAction), { advance });
    const root = el.shadowRoot!;
    (root.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true })
    );
    expect(advance).not.toHaveBeenCalled();
    const err = root.querySelector('.err');
    expect(err?.getAttribute('role')).toBe('alert');
  });

  it('advances with coerced values on a valid submit', async () => {
    const advance = vi.fn().mockResolvedValue(view(null, { state: 'completed', outcome: 'APPROVE' }));
    const el = await mount(view(formAction), { advance });
    const root = el.shadowRoot!;
    (root.querySelector('#full_name') as HTMLInputElement).value = 'Ada';
    (root.querySelector('#full_name') as HTMLInputElement).dispatchEvent(new Event('input'));
    (root.querySelector('#email') as HTMLInputElement).value = 'a@b.co';
    (root.querySelector('#email') as HTMLInputElement).dispatchEvent(new Event('input'));
    (root.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true })
    );
    await vi.waitFor(() =>
      expect(advance).toHaveBeenCalledWith({ full_name: 'Ada', email: 'a@b.co' })
    );
  });

  it('preserves typed values when the server returns invalid_input', async () => {
    const advance = vi.fn().mockRejectedValue(
      new FlowError('invalid_input', 'bad', 'invalid_input', {
        errors: [{ field_key: 'email', message: 'Invalid email' }],
      })
    );
    const el = await mount(view(formAction), { advance });
    const root = el.shadowRoot!;
    (root.querySelector('#full_name') as HTMLInputElement).value = 'Ada';
    (root.querySelector('#full_name') as HTMLInputElement).dispatchEvent(new Event('input'));
    (root.querySelector('#email') as HTMLInputElement).value = 'a@b.co';
    (root.querySelector('#email') as HTMLInputElement).dispatchEvent(new Event('input'));
    (root.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true })
    );
    await vi.waitFor(() => {
      const err = root.querySelector('#email-error');
      if (!err) throw new Error('no server error yet');
    });
    expect((root.querySelector('#full_name') as HTMLInputElement).value).toBe('Ada');
    expect(root.querySelector('#email-error')?.textContent).toBe('Invalid email');
    expect((root.querySelector('#email') as HTMLInputElement).getAttribute('aria-invalid')).toBe('true');
  });

  it('uses branding primary_color for the CTA', async () => {
    const el = await mount(view(formAction, { primaryColor: '#FF0000' }));
    const submit = el.shadowRoot!.querySelector('button.primary') as HTMLButtonElement;
    expect(submit.style.background).toBe('#FF0000');
  });

  it('emits complete on a terminal view', async () => {
    const onComplete = vi.fn();
    const client = stubClient({
      get: vi.fn().mockResolvedValue(view(null, { state: 'completed', outcome: 'APPROVE' })),
    });
    vi.spyOn(clientModule, 'createFlowsClient').mockReturnValue(client);
    const el = document.createElement('usesense-flows');
    el.addEventListener('complete', (e) => onComplete((e as CustomEvent).detail));
    el.setAttribute('flow-run-id', 'fr_1');
    el.setAttribute('sdk-token', 'tok');
    document.body.appendChild(el);
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onComplete).toHaveBeenCalledWith({ flowRunId: 'fr_1', state: 'completed', outcome: 'APPROVE' });
  });

  describe('document capture', () => {
    const docAction: PendingAction = {
      kind: 'capture',
      capture: 'document',
      documentCategory: 'identity',
    };

    it('renders the built-in upload surface by default', async () => {
      const el = await mount(view(docAction));
      const root = el.shadowRoot!;
      expect(root.querySelector('h1')?.textContent).toBe('Upload your document');
      expect(root.querySelector('input[type="file"]')).toBeTruthy();
    });

    it('uploads a chosen image and advances with document_id', async () => {
      const advance = vi.fn().mockResolvedValue(view(null, { state: 'completed', outcome: 'APPROVE' }));
      const uploadDocument = vi.fn().mockResolvedValue({ document_id: 'doc_1', status: 'completed' });
      const el = await mount(view(docAction), { advance, uploadDocument });
      const root = el.shadowRoot!;
      const fileInput = root.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['jpeg'], 'doc.jpg', { type: 'image/jpeg' });
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => expect(uploadDocument).toHaveBeenCalled());
      expect(uploadDocument).toHaveBeenCalledWith(
        expect.objectContaining({ mimeType: 'image/jpeg', side: 'single', documentType: 'identity' })
      );
      await vi.waitFor(() => expect(advance).toHaveBeenCalledWith({ document_id: 'doc_1' }));
    });
  });

  describe('id_number capture', () => {
    const idAction: PendingAction = {
      kind: 'capture',
      capture: 'id_number',
      idTypes: [{ value: 'ssn', label: 'SSN', field: 'id_number', maxLength: 4, numeric: true }],
    };

    it('advances with id_type and the field value', async () => {
      const advance = vi.fn().mockResolvedValue(view(null, { state: 'completed', outcome: 'APPROVE' }));
      const el = await mount(view(idAction), { advance });
      const root = el.shadowRoot!;
      // Single idType auto-selected; input rendered.
      const input = root.querySelector('#id-number-input') as HTMLInputElement;
      expect(input).toBeTruthy();
      input.value = '1234';
      input.dispatchEvent(new Event('input'));
      (root.querySelector('button.primary') as HTMLButtonElement).click();
      await vi.waitFor(() =>
        expect(advance).toHaveBeenCalledWith({ id_type: 'ssn', id_number: '1234' })
      );
    });
  });

  describe('info + consent', () => {
    it('advances on info primary CTA', async () => {
      const infoAction: PendingAction = {
        kind: 'info',
        title: 'Welcome',
        primary_cta: { label: 'Continue' },
      };
      const advance = vi.fn().mockResolvedValue(view(null, { state: 'completed', outcome: 'APPROVE' }));
      const el = await mount(view(infoAction), { advance });
      (el.shadowRoot!.querySelector('button.primary') as HTMLButtonElement).click();
      await vi.waitFor(() => expect(advance).toHaveBeenCalledWith({}));
    });

    it('advances on consent confirmation', async () => {
      const consentAction: PendingAction = { kind: 'redirect_to_consent', consentUrl: 'https://x' };
      const advance = vi.fn().mockResolvedValue(view(null, { state: 'completed', outcome: 'APPROVE' }));
      const el = await mount(view(consentAction), { advance });
      (el.shadowRoot!.querySelector('button.secondary') as HTMLButtonElement).click();
      await vi.waitFor(() => expect(advance).toHaveBeenCalledWith({}));
    });
  });

  describe('face capture', () => {
    const faceAction: PendingAction = { kind: 'capture', capture: 'face', toolId: 'tool_1' };

    it('emits a cancelable capture event and can be host-driven via resolveCapture', async () => {
      const advance = vi.fn().mockResolvedValue(view(null, { state: 'completed', outcome: 'APPROVE' }));
      const el = await mount(view(faceAction), { advance });
      let detail: unknown;
      el.addEventListener('capture', (e) => {
        detail = (e as CustomEvent).detail;
        e.preventDefault();
      });
      (el.shadowRoot!.querySelector('button.primary') as HTMLButtonElement).click();
      expect(detail).toEqual({ kind: 'face', toolId: 'tool_1' });
      (el as unknown as { resolveCapture: (i?: Record<string, unknown>) => void }).resolveCapture({
        sessionId: 's1',
      });
      await vi.waitFor(() => expect(advance).toHaveBeenCalledWith({ sessionId: 's1' }));
    });

    it('fails with unsupported_action when the capture event is not intercepted', async () => {
      const el = await mount(view(faceAction));
      const onError = vi.fn();
      el.addEventListener('error', (e) => onError((e as unknown as CustomEvent).detail));
      (el.shadowRoot!.querySelector('button.primary') as HTMLButtonElement).click();
      await vi.waitFor(() => expect(onError).toHaveBeenCalled());
      expect(onError.mock.calls[0][0].code).toBe('unsupported_action');
    });
  });

  it('cancel button cancels the run', async () => {
    const docAction: PendingAction = { kind: 'capture', capture: 'document', documentCategory: 'identity' };
    const cancel = vi.fn().mockResolvedValue(view(null, { state: 'cancelled' }));
    const el = await mount(view(docAction), { cancel });
    (el.shadowRoot!.querySelector('button.secondary') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(cancel).toHaveBeenCalled());
    // silence unused-var lint on currentStub
    expect(currentStub).toBeTruthy();
  });
});
