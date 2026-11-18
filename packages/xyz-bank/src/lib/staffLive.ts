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

export async function startCheck(t: LiveTarget, input: { type: 'enrollment' | 'authentication'; identityId?: string; label: string; prospect: string; name: string }): Promise<CaptureSessionData> {
  if (t.via === 'demo') {
    const r = await wtCall<{ session: CaptureSessionData }>('/demo-shares/checks', {
      method: 'POST',
      body: JSON.stringify({ type: input.type, identityId: input.identityId, label: input.label, prospect: input.prospect }),
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
   returning customer instead of being stopped as a duplicate of themselves. */
const ME = (via: string, env: string) => `xyz-rep-face:${via}:${env}`;

export function myFace(t: LiveTarget): { identityId: string; name: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(ME(t.via, t.env)) || 'null');
    return v?.identityId ? v : null;
  } catch {
    return null;
  }
}

export function rememberMyFace(t: LiveTarget, identityId: string, name: string): void {
  try { localStorage.setItem(ME(t.via, t.env), JSON.stringify({ identityId, name })); } catch { /* ignore */ }
}

export function forgetMyFace(t: LiveTarget): void {
  try { localStorage.removeItem(ME(t.via, t.env)); } catch { /* ignore */ }
}
