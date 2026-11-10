/**
 * The `client_context` this SDK declares when a session starts.
 *
 * Watchtower recognises the web SDK and its version only from this block (a
 * browser sends no SDK user agent), and starts sessions from new enough SDKs
 * with a passive scan instead of an up-front challenge. Sent on
 * POST /v1/sessions, POST /v1/sessions/exchange-token and Flow init-session.
 */

import { SDK_VERSION } from './version';

/** Schema v1 of the client context (same shape on every platform). */
export interface ClientContext {
  schema_version: 1;
  sdk: { name: string; version?: string; build?: string };
  app?: { identifier?: string; version?: string; build?: string };
}

/** This SDK's client context: `{ schema_version: 1, sdk: { name: 'web', version } }`. */
export function webClientContext(): ClientContext {
  return { schema_version: 1, sdk: { name: 'web', version: SDK_VERSION } };
}

/**
 * The context to send: the caller's when given (the hosted runner sends its
 * own app identity), else this SDK's. A web context without a version gets
 * this SDK's version, since that is the code actually running the capture.
 */
export function resolveClientContext(given?: ClientContext | null): ClientContext {
  if (!given) return webClientContext();
  if (given.sdk?.name === 'web' && !given.sdk.version) {
    return { ...given, sdk: { ...given.sdk, version: SDK_VERSION } };
  }
  return given;
}
