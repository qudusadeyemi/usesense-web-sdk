/**
 * Public types for the Flows runner.
 *
 * Sessions and Flows coexist: the existing single-step verifyFace /
 * captureDocument / SDK config types stay where they are. This file defines a
 * separate namespace so a host app reading the code knows which engine is in
 * play at the call site.
 */

/** Mirrors the server's runtime states; SDK consumers usually only see these. */
export type FlowRunState =
  | 'pending'
  | 'in_progress'
  | 'stalled'
  | 'awaiting_review'
  | 'completed'
  | 'errored'
  | 'abandoned'
  | 'cancelled';

export type FlowOutcome = 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';

/**
 * The action the server parked at. The SDK reads it and renders the matching
 * native surface; unknown kinds MUST surface as `FlowError.unsupportedAction`.
 * See guides/flows/action-contract.mdx.
 */
export type PendingAction =
  | { kind: 'capture'; capture: 'face'; toolId?: string }
  | {
      kind: 'capture';
      capture: 'document';
      documentCategory: string;
      documentTypes?: string[];
      issuingCountries?: string[];
    }
  | { kind: 'capture'; capture: 'form'; fields: string[] }
  | { kind: 'redirect_to_consent'; consentUrl: string };

export interface FlowRunView {
  flowRun: {
    id: string;
    state: FlowRunState;
    outcome: FlowOutcome | null;
    cursorStepId: string | null;
    environment: 'sandbox' | 'production';
    pendingAction: PendingAction | null;
  };
  definitionSteps: Array<{ id: string; type: string; label: string; toolId?: string }>;
  stepRuns: Array<Record<string, unknown>>;
  branding: {
    display_name: string;
    logo_url: string | null;
    primary_color: string;
    redirect_url: string | null;
  } | null;
}

/** Final state the host app receives when run() resolves. */
export interface FlowRunResult {
  flowRunId: string;
  state: FlowRunState;
  outcome: FlowOutcome | null;
}

/** Uniform error taxonomy across every SDK. See guides/flows/errors.mdx. */
export type FlowErrorCode =
  | 'token_expired'
  | 'token_invalid'
  | 'network_unavailable'
  | 'permission_denied'
  | 'provider_unavailable'
  | 'cancelled'
  | 'unsupported_action'
  | 'unknown';

export class FlowError extends Error {
  readonly code: FlowErrorCode;
  /** Optional server-side error code passed through verbatim. */
  readonly serverCode?: string;
  constructor(code: FlowErrorCode, message: string, serverCode?: string) {
    super(message);
    this.name = 'FlowError';
    this.code = code;
    this.serverCode = serverCode;
  }
}

export interface RunFlowOptions {
  /** From `POST /v1/flow-runs`. */
  flowRunId: string;
  /** Per-run bearer minted alongside flowRunId. */
  sdkToken: string;
  /** Override the API base URL (testing / on-prem). Default: https://api.usesense.ai */
  apiBaseUrl?: string;
  /** Mount target. Default: a fresh full-screen overlay appended to document.body. */
  container?: HTMLElement;
  /** Fired when the subject (or the SDK) cancels mid-run. */
  onCancel?: () => void;
}
