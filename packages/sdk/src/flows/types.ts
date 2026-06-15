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
 * One typed input on a form-capture step. A plain string `key` is the legacy
 * shorthand (the SDK humanises it into a label and renders a plain text input);
 * a FormField object carries the full per-field metadata so the SDK can render
 * the right input primitive, run the validators, and surface inline errors.
 * Mirrors modules/flows/types.ts in usesense-watchtower — keep both in sync.
 */
export type FormFieldType = 'text' | 'email' | 'tel' | 'number' | 'date' | 'select' | 'checkbox' | 'country';
export interface FormField {
  key: string;
  type: FormFieldType;
  label?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  initial?: string | number | boolean;
  validators?: {
    /** RE2-compatible regex; ignored by clients if it fails to parse. */
    pattern?: string;
    min_length?: number;
    max_length?: number;
    min?: number | string;
    max?: number | string;
    /** Overrides the default copy on any validation failure. */
    error_message?: string;
  };
  /** Required when type === 'select'. */
  options?: { value: string; label: string }[];
  /** ISO 3166-1 alpha-2 codes; required when type === 'country'. */
  allowed_countries?: string[];
}

export type InfoBulletIcon = 'check' | 'shield' | 'camera' | 'warning' | 'info';
export interface InfoBullet { icon?: InfoBulletIcon; text: string }
export interface InfoCta {
  label: string;
  /** When set, the SDK opens this URL in an in-app browser (or new tab on web)
   *  before advancing the run. Used for off-page consent / external steps. */
  open_url?: string;
}
export interface InfoSecondaryCta {
  label: string;
  /** "advance" continues the run; "cancel" calls cancel() on the run. */
  action: 'cancel' | 'advance';
}
/**
 * Server-driven info screen. Subsumes `redirect_to_consent` (still emitted
 * verbatim by the server for legacy SDKs and downgrade-safe info actions —
 * see action-contract.mdx for the rules). Unknown bullet icons SHOULD render
 * as the platform's default info glyph; never block on them.
 */
export interface InfoAction {
  kind: 'info';
  title: string;
  body?: string;
  image_url?: string;
  bullets?: InfoBullet[];
  primary_cta: InfoCta;
  secondary_cta?: InfoSecondaryCta;
}

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
  | { kind: 'capture'; capture: 'form'; fields: (string | FormField)[] }
  | InfoAction
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
  /** Server form validation failed; `details.errors` carries the per-field
   *  messages. The runner surfaces these inline rather than terminating. */
  | 'invalid_input'
  | 'unknown';

/** One per-field error returned by the server on a 422 invalid_input response. */
export interface FormFieldError { field_key: string; message: string }

export class FlowError extends Error {
  readonly code: FlowErrorCode;
  /** Optional server-side error code passed through verbatim. */
  readonly serverCode?: string;
  /** Populated when code === 'invalid_input'. Mirrors the server's
   *  `details.errors` array so the SDK can highlight each offending field. */
  readonly details?: { errors?: FormFieldError[] };
  constructor(code: FlowErrorCode, message: string, serverCode?: string, details?: { errors?: FormFieldError[] }) {
    super(message);
    this.name = 'FlowError';
    this.code = code;
    this.serverCode = serverCode;
    this.details = details;
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
