/**
 * Mixed verification flow — types
 *
 * A flow is an ordered sequence of steps. Each step is either a biometric
 * capture or a single-side document capture. Flows are strictly forward
 * (no backtracking) for v1; the machine is shaped so that a future
 * `goBack` transition is additive.
 *
 * Multi-document flows are supported: each document step carries its own
 * `documentType`, so a single flow can mix passport + utility bill, or
 * front+back of an identity document.
 */

import type { CaptureResult } from '../types';
import type { DocumentResult, DocumentSide, DocumentType } from '../documents';

// ── Input ─────────────────────────────────────────────────────────────

export type FlowStep =
  | { kind: 'biometric' }
  | { kind: 'document'; documentType: DocumentType; side: DocumentSide };

// ── Output ────────────────────────────────────────────────────────────

export type FlowStepResult =
  | { kind: 'biometric'; result: CaptureResult }
  | {
      kind: 'document';
      documentType: DocumentType;
      side: DocumentSide;
      result: DocumentResult;
    };

export interface MixedFlowResult {
  steps: FlowStepResult[];
}

// ── Machine state ─────────────────────────────────────────────────────

export type FlowStatus = 'idle' | 'in-progress' | 'complete' | 'cancelled';

export interface FlowState {
  steps: FlowStep[];
  cursor: number; // index of the current step; equals steps.length when complete
  results: FlowStepResult[];
  status: FlowStatus;
}
