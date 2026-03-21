/**
 * Decision Redaction Utility
 *
 * Strips security-sensitive fields from FinalDecisionObject before
 * exposing it to the host application. Internal scoring, pillar verdicts,
 * reason strings, analysis details, and integrity flags are removed so
 * that attackers cannot inspect or reverse-engineer the verification
 * checks from the client-side decision payload.
 *
 * The full (unredacted) decision is only available server-side via the
 * session webhook or the dashboard API.
 */

import type { FinalDecisionObject, RedactedDecisionObject } from '../types';

/**
 * Fields that are safe to expose to the host application.
 * Everything else is stripped.
 */
const SAFE_FIELDS: ReadonlySet<keyof RedactedDecisionObject> = new Set([
  'session_id',
  'session_type',
  'identity_id',
  'decision',
  'timestamp',
]);

/**
 * Redact a FinalDecisionObject, returning only the fields that are safe
 * for the host application to receive on the client side.
 */
export function redactDecision(full: FinalDecisionObject): RedactedDecisionObject {
  return {
    session_id: full.session_id,
    session_type: full.session_type,
    identity_id: full.identity_id,
    decision: full.decision,
    timestamp: full.timestamp,
  };
}
