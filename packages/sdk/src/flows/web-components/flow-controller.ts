/**
 * flow-controller.ts — framework-free action loop for the Web Components flows
 * surface.
 *
 * main's FlowRunner keeps the state machine inside a React component, so the
 * vanilla `<usesense-flows>` element cannot reuse it. This controller re-drives
 * the same loop over the shared, framework-free `FlowsClient` (client.ts):
 * load the view, auto-advance a freshly created run, park on each action, and
 * surface a single authoritative outcome. It matches the React runner's
 * semantics: inline `invalid_input` field errors, terminal resolution, and
 * cancel.
 *
 * The element (usesense-flows-element.ts) subscribes to state changes and
 * renders; all HTTP and control flow live here so they can be unit-tested
 * without a DOM.
 */

import { FlowError, type FlowRunResult, type FlowRunView, type PendingAction } from '../types';
import type { FlowsClient, UploadDocumentResponse } from '../client';

const TERMINAL_STATES = new Set([
  'completed',
  'errored',
  'cancelled',
  'abandoned',
]);

/** What the element should render right now. */
export type ControllerState =
  | { phase: 'loading' }
  | {
      phase: 'action';
      view: FlowRunView;
      action: PendingAction;
      fieldErrors: Record<string, string>;
    }
  | { phase: 'done'; result: FlowRunResult }
  | { phase: 'error'; error: FlowError };

export type ControllerListener = (state: ControllerState) => void;

function toFlowError(err: unknown): FlowError {
  if (err instanceof FlowError) return err;
  return new FlowError(
    'unknown',
    err instanceof Error ? err.message : 'Flow failed'
  );
}

export class FlowController {
  private readonly client: FlowsClient;
  private state: ControllerState = { phase: 'loading' };
  private fieldErrors: Record<string, string> = {};
  /** The last view carrying a parked action, retained across a busy advance so
   *  an inline invalid_input can re-render the same surface with errors. */
  private actionView?: FlowRunView;
  private readonly listeners = new Set<ControllerListener>();
  private settled = false;

  constructor(client: FlowsClient) {
    this.client = client;
  }

  getState(): ControllerState {
    return this.state;
  }

  subscribe(listener: ControllerListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private emit(next: ControllerState): void {
    this.state = next;
    for (const l of this.listeners) l(next);
  }

  /** Load the current view and auto-advance a freshly created (pending) run. */
  async start(): Promise<void> {
    try {
      const view = await this.client.get();
      await this.applyView(view);
      if (view.flowRun.state === 'pending' && !view.flowRun.pendingAction) {
        await this.advance();
      }
    } catch (e) {
      this.fail(toFlowError(e));
    }
  }

  /** Submit inputs for the parked step. Inline per-field errors on 422. */
  async advance(inputs: Record<string, unknown> = {}): Promise<void> {
    if (this.settled) return;
    this.emit({ phase: 'loading' });
    try {
      const view = await this.client.advance(inputs);
      this.fieldErrors = {};
      await this.applyView(view);
    } catch (e) {
      const err = toFlowError(e);
      if (err.code === 'invalid_input' && err.details?.errors) {
        const next: Record<string, string> = {};
        for (const item of err.details.errors) next[item.field_key] = item.message;
        this.fieldErrors = next;
        // Re-park on the same action with the inline errors.
        if (this.actionView?.flowRun.pendingAction) {
          this.emit({
            phase: 'action',
            view: this.actionView,
            action: this.actionView.flowRun.pendingAction,
            fieldErrors: this.fieldErrors,
          });
        }
        return;
      }
      this.fail(err);
    }
  }

  /** Cancel the run; resolves on the resulting terminal view. */
  async cancel(): Promise<void> {
    if (this.settled) return;
    this.emit({ phase: 'loading' });
    try {
      const view = await this.client.cancel();
      await this.applyView(view);
    } catch (e) {
      this.fail(toFlowError(e));
    }
  }

  /** Create a face-capture session for the parked step. */
  initSession(toolId?: string): ReturnType<FlowsClient['initSession']> {
    return this.client.initSession(toolId);
  }

  /** Upload a captured/selected document image, then advance or fail. */
  async uploadDocument(payload: {
    data: string;
    mimeType: string;
    documentType?: string;
  }): Promise<void> {
    if (this.settled) return;
    this.emit({ phase: 'loading' });
    try {
      const r: UploadDocumentResponse = await this.client.uploadDocument({
        data: payload.data,
        mimeType: payload.mimeType,
        side: 'single',
        documentType: payload.documentType,
      });
      if (r.status === 'failed') {
        this.fail(
          new FlowError(
            r.reason === 'provider' ? 'provider_unavailable' : 'unknown',
            r.reason === 'provider'
              ? 'Verification is temporarily unavailable.'
              : "We couldn't read that document. Please retake it."
          )
        );
        return;
      }
      await this.advance({ document_id: r.document_id });
    } catch (e) {
      this.fail(toFlowError(e));
    }
  }

  /** Terminate the run with a fatal error (permission/decode/transport). */
  fail(error: FlowError): void {
    if (this.settled) return;
    this.settled = true;
    this.emit({ phase: 'error', error });
  }

  /** Route a freshly loaded view: resolve on terminal, else park the action. */
  private async applyView(view: FlowRunView): Promise<void> {
    if (TERMINAL_STATES.has(view.flowRun.state)) {
      this.settled = true;
      this.emit({
        phase: 'done',
        result: {
          flowRunId: view.flowRun.id,
          state: view.flowRun.state,
          outcome: view.flowRun.outcome,
        },
      });
      return;
    }
    const action = view.flowRun.pendingAction;
    if (action) {
      this.actionView = view;
      this.emit({ phase: 'action', view, action, fieldErrors: this.fieldErrors });
    } else {
      // Pending with no action: caller (start) will advance to progress it.
      this.emit({ phase: 'loading' });
    }
  }
}
