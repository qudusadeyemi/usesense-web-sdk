/**
 * WebAuthn channel attestation for the UseSense Web SDK.
 *
 * Exposes `attestChannel`, a single function that runs a silent
 * WebAuthn ceremony (registration on enrolment, assertion on
 * verification) via the iframe served from id.staging.usesense.ai or
 * id.usesense.ai. The ceremony promotes the bound session's
 * assurance_level to web_attested before the v4 decision pipeline
 * scores it, which has a meaningful impact on the policy threshold
 * used to gate the verdict.
 *
 * Architecture decisions (locked with operator):
 *   - Shared RP scope. Credentials registered during enrolment in
 *     customer A's flow can be used to verify on customer B's flow,
 *     because the iframe origin is the same usesense.ai subdomain.
 *   - Graceful fallback. Any failure path resolves with
 *     { verified: false, reason }. Callers should NOT block the
 *     session on this; let v4 fusion handle the lower attestation
 *     tier via threshold modifier.
 *   - Discoverable on register, allow-list on authenticate. The
 *     server side picks the right ceremony shape based on the
 *     session and the user's existing credentials.
 *   - Silent attempt. No skip button; the platform-auth dialog
 *     appears once and the user either approves or dismisses.
 *
 * Origin contract:
 *   The iframe is served from a UseSense-controlled subdomain
 *   (id.staging.usesense.ai or id.usesense.ai). Customers integrate
 *   by passing this origin to the SDK; UseSense controls the page
 *   served there. Credentials never bind to customer domains.
 *
 * @public
 */

/** Which ceremony to run. */
export type WebAuthnCeremonyType = 'register' | 'authenticate';

/** Arguments to {@link attestChannel}. */
export interface AttestChannelOptions {
  /**
   * Ceremony to run. Use `'register'` during enrolment (after the
   * LiveSense capture has succeeded) and `'authenticate'` during
   * verification (before the LiveSense capture, or right after).
   */
  type: WebAuthnCeremonyType;

  /**
   * Active UseSense session id. The ceremony binds to this session;
   * the server stamps the session's assurance_level on success.
   */
  sessionId: string;

  /**
   * Base URL for the UseSense API, e.g.
   * `https://api.usesense.ai/functions/v1/watchtower-api`.
   */
  apiBaseUrl: string;

  /**
   * Origin of the iframe ceremony page. Must be on a UseSense-
   * controlled subdomain whose RP ID matches the deployed
   * watchtower-api WEBAUTHN_RP_ID env. Defaults supplied at the
   * SDK level, e.g. `https://id.usesense.ai`.
   */
  iframeOrigin: string;

  /**
   * Optional human-readable name shown on the platform-auth dialog
   * during registration (e.g. "Jane Doe"). Ignored on authenticate.
   */
  displayName?: string;

  /**
   * Wall-clock cap. The user has this much time from iframe spawn
   * to ceremony completion. Default 60s — covers slow user
   * passkey-picker interaction without surfacing a permanent
   * blocking iframe on truly stuck flows.
   */
  timeoutMs?: number;
}

/** Outcome of {@link attestChannel}. */
export interface AttestChannelResult {
  /** True iff the server verified the assertion or attestation. */
  verified: boolean;
  /**
   * Base64url credential id when verified is true. May still be
   * present on a verified=false outcome (e.g. server rejected the
   * sign_count); inspect `reason` to decide whether to retry.
   */
  credentialId?: string | null;
  /**
   * Short string indicating why the ceremony did not verify.
   * Possible values include:
   *   - `'webauthn_unsupported'` browser has no navigator.credentials
   *   - `'register_unsupported'` server returned supported=false on
   *     register/begin (e.g. session has no external_user_id)
   *   - `'no_credentials'` authenticate/begin found no registered
   *     credentials for the user; expected on first contact
   *   - `'create_returned_null'` authenticator declined to create
   *   - `'get_returned_null'` user dismissed the picker
   *   - `'timeout'` ceremony exceeded `timeoutMs`
   *   - `'no_window'` running in non-browser environment
   *   - any DOMException name (e.g. `'NotAllowedError'`,
   *     `'NotSupportedError'`, `'AbortError'`) propagated from
   *     navigator.credentials.*
   *   - `'ceremony_error'` unexpected throw inside the iframe
   */
  reason?: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const CEREMONY_PATH = '/webauthn-ceremony';

/**
 * Run a silent WebAuthn ceremony in a transient iframe. Resolves with
 * the verdict from the server. Never rejects: any failure path
 * resolves with verified=false and a reason code.
 *
 * @public
 */
export function attestChannel(
  opts: AttestChannelOptions,
): Promise<AttestChannelResult> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve({ verified: false, reason: 'no_window' });
      return;
    }

    const iframeOrigin = opts.iframeOrigin.replace(/\/+$/, '');
    const expectedOrigin = new URL(iframeOrigin).origin;
    const iframeUrl = `${iframeOrigin}${CEREMONY_PATH}`;

    const iframe = document.createElement('iframe');
    iframe.src = iframeUrl;
    iframe.style.position = 'fixed';
    iframe.style.inset = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.style.zIndex = '2147483647';
    iframe.style.background = 'rgba(0, 0, 0, 0.85)';
    iframe.style.display = 'block';
    iframe.allow = 'publickey-credentials-create *; publickey-credentials-get *';
    iframe.setAttribute('title', 'UseSense channel attestation');

    let settled = false;
    const settle = (result: AttestChannelResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timeoutId);
      try { iframe.remove(); } catch { /* ignore */ }
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      // Strict origin + source check. Only accept messages from the
      // iframe's expected origin AND the iframe's own contentWindow.
      // Anything else is either a different cross-origin message
      // bubbling through this listener or an attempted spoof.
      if (event.origin !== expectedOrigin) return;
      if (event.source !== iframe.contentWindow) return;
      const data = event.data as any;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'webauthn-ceremony-ready') {
        iframe.contentWindow?.postMessage(
          {
            type: opts.type,
            sessionId: opts.sessionId,
            apiBaseUrl: opts.apiBaseUrl,
            displayName: opts.displayName,
          },
          expectedOrigin,
        );
        return;
      }
      if (data.type === 'result') {
        settle({
          verified: !!data.verified,
          credentialId: data.credentialId ?? null,
          reason: typeof data.reason === 'string' ? data.reason : undefined,
        });
      }
    };

    window.addEventListener('message', onMessage);
    document.body.appendChild(iframe);

    const timeoutId = window.setTimeout(() => {
      settle({ verified: false, reason: 'timeout' });
    }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  });
}
