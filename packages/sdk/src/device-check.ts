/**
 * Silent device check (Your KYC).
 *
 * The customer keeps its own KYC provider's web flow. Next to it, this runs a
 * device check with no UI, no camera and no permission prompt: the browser's
 * integrity signals before the provider opens (phase "start"), and the camera
 * inventory after it closes (phase "finish"), when labels are readable because
 * the provider was granted the camera.
 *
 * Server contract (usesense-watchtower):
 *   POST {apiBaseUrl}/v1/sdk/device-checks/:id/signals
 *   Authorization: Bearer dct_...
 *   { nonce, phase, channel_integrity, client }  ->  202 { received: true }
 * The device is never told the score; the customer's server reads it with
 * GET /v1/device-checks/:id. See modules/device-checks/silent-check.ts and
 * docs/sdk/device-trust-protocol.md in usesense-watchtower.
 *
 * Nothing in here calls getUserMedia. collectWebIntegritySignals reads
 * permission states with navigator.permissions.query and the device list with
 * enumerateDevices, neither of which prompts.
 */

import { collectWebIntegritySignals } from './capture/web-integrity';
import { collectCameraInventory } from './capture/capture-source';
import { deviceBindingFrom, waitForForeground, type DeviceBinding, type ForegroundEnv } from './flows/device-signals';
import { SDK_VERSION } from './version';
import { apiOrigin } from './utils/api-base';


/** Default per-request timeout for the signals POST. */
export const DEVICE_CHECK_TIMEOUT_MS = 10_000;
/** Default wait for the page to come to the front before collecting anyway. */
export const DEVICE_CHECK_FOREGROUND_TIMEOUT_MS = 30_000;
/** Default backoff before the single retry after a 503 or a network failure. */
export const DEVICE_CHECK_RETRY_DELAY_MS = 1_000;

/** Which call of the check a result belongs to. */
export type DeviceCheckPhase = 'start' | 'finish';

/**
 * Why a phase was not received. Server codes are passed through as sent:
 * - `invalid_token`, `token_expired` (401): wrong token, or more than 15
 *   minutes after create. Create a new check on your server.
 * - `nonce_mismatch`, `invalid_phase`, `invalid_input` (400).
 * - `already_started`, `not_started`, `already_finished` (409): start once,
 *   then finish once, in that order.
 * - `not_found` (404): unknown device check id.
 * - `too_large` (413).
 * - `unavailable`, `scoring_failed` (503, after one retry).
 * Client-side codes:
 * - `timeout`: no response within `timeoutMs` (after one retry).
 * - `network_error`: the request did not reach the server (after one retry).
 * - `collection_failed`: the browser's signals could not be read.
 * - `invalid_options`: deviceCheckId, token or nonce missing.
 * - `unknown`: any other response.
 */
export type DeviceCheckErrorCode =
  | 'invalid_token'
  | 'token_expired'
  | 'nonce_mismatch'
  | 'invalid_phase'
  | 'invalid_input'
  | 'already_started'
  | 'not_started'
  | 'already_finished'
  | 'not_found'
  | 'too_large'
  | 'unavailable'
  | 'scoring_failed'
  | 'timeout'
  | 'network_error'
  | 'collection_failed'
  | 'invalid_options'
  | 'unknown';

/** Details of a phase that was not received. */
export interface DeviceCheckError {
  code: DeviceCheckErrorCode;
  /** The server's `error` text, or a client-side description. */
  message: string;
  /** True when sending the same phase again later may succeed (network, timeout, 503). */
  retryable: boolean;
}

/** A phase the server accepted (202). It never carries a score. */
export interface DeviceCheckSuccess {
  ok: true;
  phase: DeviceCheckPhase;
  received: true;
  /** HTTP status of the accepted response (202). */
  status: number;
  /** Requests made for this phase: 1, or 2 after a retry. */
  attempts: number;
  /**
   * start only: the device fingerprint inputs from the same signals, for your
   * logs or a later face step on this device. Never sent by this call.
   */
  deviceBinding?: DeviceBinding | null;
}

/** A phase that was not received. */
export interface DeviceCheckFailure {
  ok: false;
  phase: DeviceCheckPhase;
  received: false;
  /** HTTP status, or null when no response arrived (timeout, network, before sending). */
  status: number | null;
  attempts: number;
  error: DeviceCheckError;
  deviceBinding?: DeviceBinding | null;
}

/** What start() and finish() resolve to. They never reject. */
export type DeviceCheckResult = DeviceCheckSuccess | DeviceCheckFailure;

/** Options for deviceCheck(). */
export interface DeviceCheckOptions {
  /** The dc_ id from POST /v1/device-checks on your server. */
  deviceCheckId: string;
  /** The one-use dct_ token from create. Never your API key. */
  token: string;
  /** The dn_ nonce from create. */
  nonce: string;
  /** API base URL (testing / on-prem). Default https://api.usesense.ai. */
  apiBaseUrl?: string;
  /** Alias of `apiBaseUrl`; `apiBaseUrl` wins when both are set. */
  baseUrl?: string;
  /** Per-request timeout in ms. Default 10000. */
  timeoutMs?: number;
  /**
   * Wait for the page to be visible and focused before collecting (a
   * background tab reads as headless to DeepSense). Default true.
   */
  waitForForeground?: boolean;
  /** Longest wait for the foreground, in ms, before collecting anyway. Default 30000. */
  foregroundTimeoutMs?: number;
  /** Backoff before the single retry, in ms. Default 1000. */
  retryDelayMs?: number;
  /** Injectable for tests and non-browser runtimes. */
  fetcher?: typeof fetch;
  /** Injectable signal collectors and foreground env, for tests. */
  collectSignals?: () => Promise<object>;
  collectInventory?: () => Promise<object | null>;
  foregroundEnv?: ForegroundEnv;
}

/** The handle deviceCheck() returns. */
export interface DeviceCheck {
  /**
   * Collect the browser's integrity signals (no camera, no prompt) and send
   * phase "start". Call it before your KYC provider opens. While a start is in
   * flight or after it was received, calling it again returns the same result
   * without sending twice; after a failure it sends again.
   */
  start(): Promise<DeviceCheckResult>;
  /**
   * Send phase "finish" with the camera inventory, after your provider closes.
   * Optional. Waits for an in-flight start() on this handle first. Like start(), it is never
   * sent again once received, and is sent again after a failure.
   */
  finish(): Promise<DeviceCheckResult>;
}

const RETRYABLE_STATUS = 503;

type Attempt =
  | { kind: 'response'; status: number; code: string; message: string }
  | { kind: 'timeout' }
  | { kind: 'network'; message: string };

const KNOWN_CODES: ReadonlySet<string> = new Set<DeviceCheckErrorCode>([
  'invalid_token', 'token_expired', 'nonce_mismatch', 'invalid_phase', 'invalid_input',
  'already_started', 'not_started', 'already_finished', 'not_found', 'too_large',
  'unavailable', 'scoring_failed',
]);

function codeFor(status: number, serverCode: string): DeviceCheckErrorCode {
  if (KNOWN_CODES.has(serverCode)) return serverCode as DeviceCheckErrorCode;
  if (status === 401) return 'invalid_token';
  if (status === 404) return 'not_found';
  if (status === 413) return 'too_large';
  if (status === 503) return 'unavailable';
  return 'unknown';
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Resolve with the value, or null after ms (never rejects). */
async function within<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([p, new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), ms); })]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Headless silent device check for Your KYC: no UI, no camera, no permission
 * prompt. Create the check on your server (POST /v1/device-checks), hand
 * `deviceCheckId`, `token` and `nonce` to the page, then:
 *
 * @example
 * ```ts
 * import { deviceCheck } from '@usesense/web-sdk';
 *
 * const check = deviceCheck({ deviceCheckId, token, nonce });
 * await check.start();                       // before your provider opens
 * await provider.start({ metadata: { device_check_id: deviceCheckId } });
 * await check.finish();                      // after it closes
 * ```
 *
 * start() and finish() never reject: they resolve to a DeviceCheckResult.
 * A 503 or a network failure is retried once with backoff; nothing else is.
 */
export function deviceCheck(options: DeviceCheckOptions): DeviceCheck {
  const { deviceCheckId, token, nonce } = options;
  const base = apiOrigin(options.apiBaseUrl ?? options.baseUrl);
  const timeoutMs = options.timeoutMs ?? DEVICE_CHECK_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs ?? DEVICE_CHECK_RETRY_DELAY_MS;
  const foregroundTimeoutMs = options.foregroundTimeoutMs ?? DEVICE_CHECK_FOREGROUND_TIMEOUT_MS;
  const collectSignals = options.collectSignals ?? collectWebIntegritySignals;
  const collectInventory = options.collectInventory ?? collectCameraInventory;
  const valid = [deviceCheckId, token, nonce].every((v) => typeof v === 'string' && v.trim().length > 0);
  const url = valid ? `${base}/v1/sdk/device-checks/${encodeURIComponent(deviceCheckId)}/signals` : '';

  const fail = (
    phase: DeviceCheckPhase, code: DeviceCheckErrorCode, message: string,
    status: number | null, attempts: number, retryable: boolean,
  ): DeviceCheckFailure => ({ ok: false, phase, received: false, status, attempts, error: { code, message, retryable } });

  async function post(body: object): Promise<Attempt> {
    const f = options.fetcher ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined);
    if (!f) return { kind: 'network', message: 'fetch is not available' };
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller?.abort(); }, timeoutMs);
    let backstop: ReturnType<typeof setTimeout> | undefined;
    try {
      const res = await Promise.race([
        f(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
          ...(controller ? { signal: controller.signal } : {}),
        }),
        // Without AbortController support the race still ends the wait.
        new Promise<never>((_, reject) => { backstop = setTimeout(() => reject(new Error('timeout')), timeoutMs + 50); }),
      ]);
      let payload: { error?: unknown; code?: unknown } = {};
      try { payload = await res.json(); } catch { /* empty or non-JSON body */ }
      return {
        kind: 'response',
        status: res.status,
        code: typeof payload.code === 'string' ? payload.code : '',
        message: typeof payload.error === 'string' ? payload.error : `Request failed with status ${res.status}`,
      };
    } catch (e) {
      if (timedOut || (e instanceof Error && e.message === 'timeout')) return { kind: 'timeout' };
      return { kind: 'network', message: e instanceof Error ? e.message : 'Network unavailable' };
    } finally {
      clearTimeout(timer);
      if (backstop !== undefined) clearTimeout(backstop);
    }
  }

  async function send(phase: DeviceCheckPhase, channelIntegrity: object): Promise<DeviceCheckResult> {
    const body = {
      nonce,
      phase,
      channel_integrity: channelIntegrity,
      client: { sdk: 'web', version: SDK_VERSION },
    };
    let attempts = 0;
    let firstAmbiguous = false;
    let last: Attempt = { kind: 'network', message: 'Not sent' };
    while (attempts < 2) {
      if (attempts > 0) await sleep(retryDelayMs);
      attempts += 1;
      last = await post(body);
      if (last.kind === 'response') {
        if (last.status >= 200 && last.status < 300) {
          return { ok: true, phase, received: true, status: last.status, attempts };
        }
        // The first attempt may have landed before its response was lost: the
        // server then refuses the resend as already done, which means received.
        if (firstAmbiguous && last.status === 409
          && last.code === (phase === 'start' ? 'already_started' : 'already_finished')) {
          return { ok: true, phase, received: true, status: 202, attempts };
        }
        if (last.status !== RETRYABLE_STATUS) break;
      } else if (attempts === 1) {
        firstAmbiguous = true;
      }
    }
    if (last.kind === 'timeout') {
      return fail(phase, 'timeout', `No response within ${timeoutMs} ms`, null, attempts, true);
    }
    if (last.kind === 'network') {
      return fail(phase, 'network_error', last.message, null, attempts, true);
    }
    const code = codeFor(last.status, last.code);
    return fail(phase, code, last.message, last.status, attempts, last.status === RETRYABLE_STATUS);
  }

  let started: Promise<DeviceCheckResult> | null = null;
  let finished: Promise<DeviceCheckResult> | null = null;

  async function runStart(): Promise<DeviceCheckResult> {
    if (!valid) return fail('start', 'invalid_options', 'deviceCheckId, token and nonce are required', null, 0, false);
    try {
      if (options.waitForForeground !== false) {
        const env = options.foregroundEnv
          ?? (typeof document !== 'undefined' && typeof window !== 'undefined' ? { doc: document, win: window } : null);
        if (env) await within(waitForForeground(env).catch(() => undefined), foregroundTimeoutMs);
      }
      let signals: object | null = null;
      try {
        signals = await within(collectSignals(), timeoutMs);
      } catch {
        signals = null;
      }
      if (!signals || typeof signals !== 'object') {
        return fail('start', 'collection_failed', 'The device signals could not be read', null, 0, true);
      }
      const deviceBinding = deviceBindingFrom(signals);
      const result = await send('start', signals);
      return { ...result, deviceBinding };
    } catch (e) {
      return fail('start', 'unknown', e instanceof Error ? e.message : 'Device check failed', null, 0, false);
    }
  }

  async function runFinish(): Promise<DeviceCheckResult> {
    if (!valid) return fail('finish', 'invalid_options', 'deviceCheckId, token and nonce are required', null, 0, false);
    try {
      if (started) await started;
      let inventory: object | null = null;
      try {
        inventory = await within(collectInventory(), timeoutMs);
      } catch {
        inventory = null;
      }
      return await send('finish', inventory ? { camera_inventory: inventory } : {});
    } catch (e) {
      return fail('finish', 'unknown', e instanceof Error ? e.message : 'Device check failed', null, 0, false);
    }
  }

  // A phase that was received is never sent again; one that failed may be.
  const once = (run: () => Promise<DeviceCheckResult>, clear: () => void) => run().then((r) => {
    if (!r.ok) clear();
    return r;
  });
  return {
    start: () => (started ??= once(runStart, () => { started = null; })),
    finish: () => (finished ??= once(runFinish, () => { finished = null; })),
  };
}
