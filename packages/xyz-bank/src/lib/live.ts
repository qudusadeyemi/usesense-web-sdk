/* Live checks against the Sense public API, with the key the rep pasted.
   Same public path as the SDK demo apps: the key never leaves this browser
   except to call the Sense API. */
import type { CaptureResult, CaptureSessionData, FlowAppearance } from '@usesense/web-sdk';
import type { LiveMode } from './settings';

export type Env = 'sandbox' | 'production';

export const WATCHTOWER = 'https://watchtower.usesense.ai';

export function envFor(mode: LiveMode): Env {
  return mode === 'live' ? 'production' : 'sandbox';
}

function v1(base: string): string {
  return base.replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1';
}

export class LiveError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message);
  }
}

async function call<T>(url: string, key: string, env: Env, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'x-environment': env, ...(init.headers ?? {}) },
    });
  } catch {
    throw new LiveError('Couldn’t reach Sense. Check your connection and try again.');
  }
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!res.ok) {
    const msg = body?.error?.message ?? body?.message ?? (typeof body?.error === 'string' ? body.error : '') ?? '';
    throw new LiveError(plainError(res.status, msg), res.status, body?.error?.code);
  }
  return body as T;
}

export function plainError(status: number, serverMessage = ''): string {
  if (status === 401) return 'Sense didn’t accept this key. Copy it again from Watchtower, Developers, API keys.';
  if (status === 402) return 'This org is out of credits. Top up in Watchtower, or switch to a sandbox key.';
  if (status === 403) return serverMessage || 'This key doesn’t have permission for that. Edit the key in Watchtower and turn on the permission.';
  if (status === 429) return 'Too many requests. Wait a minute and try again.';
  if (status >= 500) return 'Sense had a problem. Try again in a moment.';
  return serverMessage || `Sense returned an error (${status}).`;
}

export interface KeyCheck {
  ok: boolean;
  message: string;
  flows: boolean | null;
  envGuess: Env;
}

/** Checks a key without creating anything: unknown ids return 404 for a valid key and 401 for a bad one. */
export async function checkKey(key: string, base: string, env: Env): Promise<KeyCheck> {
  const envGuess: Env = /_(live|prod)_/.test(key) ? 'production' : 'sandbox';
  try {
    await call(`${v1(base)}/sessions/ses_xyz_keycheck`, key, env);
  } catch (e) {
    const err = e as LiveError;
    if (err.status !== 404 && err.status !== 400) return { ok: false, message: err.message, flows: null, envGuess };
  }
  let flows: boolean | null = null;
  try {
    await call(`${v1(base)}/flow-runs/fr_xyz_keycheck`, key, env);
    flows = true;
  } catch (e) {
    const err = e as LiveError;
    flows = err.status === 404 || err.status === 400 ? true : err.status === 403 ? false : null;
  }
  return { ok: true, message: 'Connected', flows, envGuess };
}

export interface CreateSessionInput {
  type: 'enrollment' | 'authentication';
  externalUserId: string;
  identityId?: string;
  metadata?: Record<string, unknown>;
}

export async function createSession(key: string, base: string, env: Env, input: CreateSessionInput): Promise<CaptureSessionData> {
  const body: Record<string, unknown> = {
    session_type: input.type,
    platform: 'web',
    external_user_id: input.externalUserId,
    metadata: { source: 'xyz-demo-bank', ...(input.metadata ?? {}) },
  };
  if (input.identityId) body.identity_id = input.identityId;
  return call<CaptureSessionData>(`${v1(base)}/sessions`, key, env, { method: 'POST', body: JSON.stringify(body) });
}

export interface SessionDetails {
  session_id: string;
  status: string;
  session_type?: string;
  identity_id?: string | null;
  external_user_id?: string | null;
  environment?: string;
  verdict?: {
    decision: string | null;
    channel_trust_score?: number | null;
    liveness_score?: number | null;
    dedupe_risk_score?: number | null;
    pillar_verdicts?: Record<string, unknown> | null;
    reasons?: string[];
  };
}

export async function getSession(key: string, base: string, env: Env, id: string): Promise<SessionDetails> {
  return call<SessionDetails>(`${v1(base)}/sessions/${encodeURIComponent(id)}`, key, env);
}

/** Status needs no key: the hand-off page and the stage both poll it. */
export async function getSessionStatus(base: string, id: string): Promise<string | null> {
  try {
    const res = await fetch(`${v1(base)}/sessions/${encodeURIComponent(id)}/status`);
    if (!res.ok) return null;
    const body = await res.json();
    return (body?.status as string) ?? null;
  } catch {
    return null;
  }
}

export function watchtowerSessionUrl(id: string): string {
  return `${WATCHTOWER}/sessions/${encodeURIComponent(id)}`;
}

/* ---------- Normalising what comes back ---------- */

export type LiveOutcome = 'let' | 'stop' | 'review' | 'pending';

export function normaliseDecision(d: string | null | undefined): LiveOutcome {
  const s = String(d ?? '').toUpperCase();
  if (s.startsWith('APPROVE') || s === 'PASS' || s === 'APPROVED') return 'let';
  if (s.startsWith('REJECT') || s === 'FAIL' || s === 'DENY') return 'stop';
  if (s.includes('REVIEW')) return 'review';
  return 'pending';
}

export type PillarState = 'pass' | 'fail' | 'flag' | 'skip';

export function pillarState(v: unknown): PillarState {
  const raw = typeof v === 'string' ? v : (v as { verdict?: string } | null)?.verdict;
  if (!raw) return 'skip';
  const s = raw.toLowerCase();
  if (/(pass|approve|ok|low|clear|accept|genuine|unique)/.test(s)) return 'pass';
  if (/(fail|reject|high|block|spoof|duplicate|deny)/.test(s)) return 'fail';
  return 'flag';
}

export interface LiveResult {
  sessionId: string;
  identityId: string | null;
  outcome: LiveOutcome;
  liveness: PillarState;
  device: PillarState;
  dedupe: PillarState;
  scores: { liveness?: number | null; channel?: number | null; dedupe?: number | null };
  reasons: string[];
  type: 'enrollment' | 'authentication';
  tookMs?: number;
  env: Env;
}

export function fromCapture(r: CaptureResult, type: LiveResult['type'], env: Env, tookMs?: number): LiveResult {
  const pv = r.pillar_verdicts ?? {};
  return {
    sessionId: r.session_id,
    identityId: r.identity_id ?? null,
    outcome: normaliseDecision(r.decision),
    liveness: pillarState(pv.liveness),
    device: pillarState(pv.channel_trust),
    dedupe: pillarState(pv.dedupe),
    scores: { liveness: r.liveness_score, channel: r.channel_trust_score, dedupe: r.dedupe_risk_score },
    reasons: Array.isArray(r.reasons) ? r.reasons : [],
    type, env, tookMs,
  };
}

export function fromDetails(d: SessionDetails, env: Env): LiveResult {
  const pv = (d.verdict?.pillar_verdicts ?? {}) as Record<string, unknown>;
  return {
    sessionId: d.session_id,
    identityId: d.identity_id ?? null,
    outcome: normaliseDecision(d.verdict?.decision),
    liveness: pillarState(pv.liveness),
    device: pillarState(pv.channel_trust),
    dedupe: pillarState(pv.dedupe),
    scores: { liveness: d.verdict?.liveness_score, channel: d.verdict?.channel_trust_score, dedupe: d.verdict?.dedupe_risk_score },
    reasons: d.verdict?.reasons ?? [],
    type: d.session_type === 'authentication' ? 'authentication' : 'enrollment',
    env,
  };
}

/** Reason codes in plain words where we know them; unknown codes are shown as they are. */
export function plainReason(code: string): string {
  const c = code.toLowerCase();
  if (c.includes('dedupe') || c.includes('duplicate')) return 'Same face as an existing customer';
  if (c.includes('spoof') || c.includes('screen') || c.includes('replay')) return 'Looks like a photo, screen or replay';
  if (c.includes('virtual') || c.includes('inject')) return 'Camera stream was injected';
  if (c.includes('emulator') || c.includes('root') || c.includes('automation')) return 'Device is not a real, untampered phone';
  if (c.includes('blocklist')) return 'On your blocklist';
  if (c.includes('face_mismatch') || c.includes('mismatch')) return 'Face does not match the account owner';
  if (c.includes('liveness')) return 'Liveness was not convincing';
  return code.replace(/_/g, ' ');
}

/* ---------- The rep's identity in this org, for returning-customer checks ---------- */

const ID_KEY = 'xyz-live-identity-v1';

export interface RepIdentity { identityId: string; env: Env; at: string; name: string }

export function loadIdentity(env: Env): RepIdentity | null {
  try {
    const all = JSON.parse(localStorage.getItem(ID_KEY) || '{}') as Record<string, RepIdentity>;
    return all[env] ?? null;
  } catch {
    return null;
  }
}

export function saveIdentity(id: RepIdentity): void {
  try {
    const all = JSON.parse(localStorage.getItem(ID_KEY) || '{}') as Record<string, RepIdentity>;
    all[id.env] = id;
    localStorage.setItem(ID_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function forgetIdentity(env: Env): void {
  try {
    const all = JSON.parse(localStorage.getItem(ID_KEY) || '{}') as Record<string, RepIdentity>;
    delete all[env];
    localStorage.setItem(ID_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/* ---------- Hand-off payload (QR) ---------- */

async function streamBytes(input: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([input as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

function toB64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export interface Handoff { s: CaptureSessionData; b: string; n: string; c: string; a?: FlowAppearance }

/** Packs a session for the prospect's phone, deflated so the QR stays scannable.
    It holds the per-session token only, never the API key. */
export async function packHandoff(s: CaptureSessionData, base: string, brand: { name: string; color: string; appearance?: FlowAppearance }): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify({ s, b: base, n: brand.name, c: brand.color, ...(brand.appearance ? { a: brand.appearance } : {}) }));
  if (typeof CompressionStream === 'undefined') return 'j' + toB64Url(json);
  return 'z' + toB64Url(await streamBytes(json, new CompressionStream('deflate-raw')));
}

export async function unpackHandoff(packed: string): Promise<Handoff | null> {
  try {
    const kind = packed[0];
    const bytes = fromB64Url(packed.slice(1));
    const raw = kind === 'z' ? await streamBytes(bytes, new DecompressionStream('deflate-raw')) : bytes;
    const v = JSON.parse(new TextDecoder().decode(raw)) as Handoff;
    if (!v?.s?.session_id || !v?.s?.session_token) return null;
    return v;
  } catch {
    return null;
  }
}
