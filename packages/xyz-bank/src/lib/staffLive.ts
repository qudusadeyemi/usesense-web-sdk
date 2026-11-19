/* Live checks while presenting. By default they run in the Sense Demo org
   through Watchtower (modules/demo-shares), so a rep never pastes a key and
   every result opens in Watchtower. A sales engineer can switch a demo to the
   prospect's own key; then the browser calls the Sense API directly. */
import type { CaptureSessionData } from '@usesense/web-sdk';
import { createSession, envFor, fromDetails, getSession, type LiveResult, type SessionDetails } from './live';
import type { DemoSettings } from './settings';
import { wtCall } from './watchtower';

export const DEMO_API_BASE = 'https://api.usesense.ai';

export interface LiveTarget {
  via: 'demo' | 'key';
  base: string;
  key: string;
  env: 'sandbox' | 'production';
}

export function liveTarget(s: DemoSettings): LiveTarget {
  if (s.liveVia === 'key' && s.liveMode !== 'off') {
    return { via: 'key', base: s.apiBaseUrl, key: s.liveMode === 'live' ? s.liveKey.trim() : s.sandboxKey.trim(), env: envFor(s.liveMode) };
  }
  return { via: 'demo', base: DEMO_API_BASE, key: '', env: 'sandbox' };
}

/* On the Sense Demo key, `scope` (the demo id) keeps duplicate checks inside
   this demo: Watchtower tags the session with a per-demo brand and the org
   dedupes by brand, so a face enrolled in another demo never stops step one. */
/* `dials` (attack lab, lib/lab.ts) only work on the Sense Demo key: Watchtower
   keeps them on its own record of the check and scores the run with them. */
export async function startCheck(t: LiveTarget, input: { type: 'enrollment' | 'authentication'; identityId?: string; label: string; prospect: string; name: string; scope?: string; dials?: Record<string, string>; logo?: string | null }): Promise<CaptureSessionData> {
  if (t.via === 'demo') {
    const r = await wtCall<{ session: CaptureSessionData }>('/demo-shares/checks', {
      method: 'POST',
      // The logo is kept by Watchtower for the QR phone (GET /public/demo/logo/:sessionId).
      body: JSON.stringify({ type: input.type, identityId: input.identityId, label: input.label, prospect: input.prospect, scope: input.scope, ...(input.dials ? { dials: input.dials } : {}), ...(input.logo ? { logo: input.logo } : {}) }),
    });
    return r.session;
  }
  return createSession(t.key, t.base, t.env, {
    type: input.type,
    externalUserId: `xyz-demo-${input.name.toLowerCase().replace(/[^a-z]+/g, '-')}-${Date.now().toString(36)}`,
    identityId: input.identityId,
    metadata: { scenario: input.label, prospect: input.prospect || null },
  });
}

export async function readCheck(t: LiveTarget, sessionId: string): Promise<LiveResult> {
  if (t.via === 'demo') {
    const r = await wtCall<{ result: SessionDetails }>(`/demo-shares/checks/${encodeURIComponent(sessionId)}`);
    return fromDetails(r.result, 'sandbox');
  }
  return fromDetails(await getSession(t.key, t.base, t.env, sessionId), t.env);
}

/* The rep's own face, once enrolled, so a later "use my camera" runs as a
   returning customer instead of being stopped as a duplicate of themselves.
   On the demo key it is remembered per demo, matching the per-demo dedupe
   scope: the "same face, new name" step must find the face in this demo. */
const ME = (t: LiveTarget, scope?: string) => `xyz-rep-face:${t.via}:${t.env}${t.via === 'demo' && scope ? `:${scope}` : ''}`;

export function myFace(t: LiveTarget, scope?: string): { identityId: string; name: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(ME(t, scope)) || 'null');
    return v?.identityId ? v : null;
  } catch {
    return null;
  }
}

export function rememberMyFace(t: LiveTarget, identityId: string, name: string, scope?: string): void {
  try { localStorage.setItem(ME(t, scope), JSON.stringify({ identityId, name })); } catch { /* ignore */ }
}

export function forgetMyFace(t: LiveTarget, scope?: string): void {
  try { localStorage.removeItem(ME(t, scope)); } catch { /* ignore */ }
}

/* ---------- Attack lab ---------- */

export type LabStart =
  | { kind: 'session'; session: CaptureSessionData }
  | { kind: 'flow'; flowRun: { flowRunId: string; sdkToken: string; expiresAt: string } };

/** Start an attack lab run on the Sense Demo key. An ID dial makes it a lab Flow run. */
export async function startLabCheck(input: { label: string; prospect: string; scope?: string; dials: Record<string, string>; identityId?: string }): Promise<LabStart> {
  const r = await wtCall<{ session?: CaptureSessionData; flowRun?: { flowRunId: string; sdkToken: string; expiresAt: string } }>('/demo-shares/checks', {
    method: 'POST',
    body: JSON.stringify({ type: input.identityId ? 'authentication' : 'enrollment', identityId: input.identityId, label: input.label, prospect: input.prospect, scope: input.scope, dials: input.dials }),
  });
  if (r.flowRun) return { kind: 'flow', flowRun: r.flowRun };
  if (r.session) return { kind: 'session', session: r.session };
  throw new Error('Couldn’t start the check. Try again.');
}

/** A lab run's result: the face check's decision and, for an ID run, the lab Flow's steps. */
export async function readLabCheck(id: string): Promise<{ result: LiveResult | null; flow: import('./lab').LabFlow | null }> {
  const r = await wtCall<{ result: SessionDetails | null; flow?: import('./lab').LabFlow | null }>(`/demo-shares/checks/${encodeURIComponent(id)}`);
  return { result: r.result ? fromDetails(r.result, 'sandbox') : null, flow: r.flow ?? null };
}
