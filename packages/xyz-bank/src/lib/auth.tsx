/* Staff sign-in with the rep's own Watchtower account (same Supabase project
   as watchtower.usesense.ai). Only staff email domains get in. The publishable
   key is public by design (it ships in the Watchtower bundle too). */
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://tzfsrqsjgxcpsxypxjof.supabase.co';
const KEY_ = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? 'sb_publishable_Xwk17lK5VBTPFLcIHmsNIw_gzbA794R';
/** Set VITE_DEMO_AUTH=off for local development without an account. */
const AUTH_OFF = (import.meta.env.VITE_DEMO_AUTH as string | undefined) === 'off';
export const STAFF_DOMAINS = ((import.meta.env.VITE_STAFF_DOMAINS as string | undefined) ?? 'usesense.ai')
  .split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);

let client: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!client) client = createClient(URL_, KEY_, { auth: { persistSession: true, storageKey: 'xyz-demo-auth', autoRefreshToken: true } });
  return client;
}

/** The Watchtower API on the same project, for calls made as the signed-in rep. */
export const WATCHTOWER_API = `${URL_.replace(/\/+$/, '')}/functions/v1/watchtower-api`;
export const PUBLISHABLE_KEY = KEY_;
export const AUTH_DISABLED = AUTH_OFF;

/** The signed-in rep's access token, or null (signed out, or sign-in turned off). */
export async function accessToken(): Promise<string | null> {
  if (AUTH_OFF) return null;
  try {
    const { data } = await sb().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export function isStaffEmail(email: string | null | undefined): boolean {
  const domain = String(email ?? '').toLowerCase().split('@')[1] ?? '';
  return STAFF_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export interface AuthValue {
  ready: boolean;
  disabled: boolean;
  email: string | null;
  name: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

function nameOf(s: Session | null): string | null {
  const m = s?.user?.user_metadata as Record<string, unknown> | undefined;
  const n = (m?.full_name ?? m?.name ?? m?.first_name) as string | undefined;
  return n ?? s?.user?.email?.split('@')[0] ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(AUTH_OFF);

  useEffect(() => {
    if (AUTH_OFF) return;
    let alive = true;
    sb().auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session && isStaffEmail(data.session.user.email) ? data.session : null);
      setReady(true);
    }).catch(() => alive && setReady(true));
    const { data: sub } = sb().auth.onAuthStateChange((_e, s) => setSession(s && isStaffEmail(s.user.email) ? s : null));
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const value = useMemo<AuthValue>(() => ({
    ready,
    disabled: AUTH_OFF,
    email: AUTH_OFF ? 'local@usesense.ai' : session?.user?.email ?? null,
    name: AUTH_OFF ? 'Local preview' : nameOf(session),
    async signIn(email, password) {
      if (!isStaffEmail(email)) return `Use your Sense staff email (${STAFF_DOMAINS.map((d) => '@' + d).join(', ')}).`;
      const { data, error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
      if (error) return error.message.includes('Invalid') ? 'That email and password don’t match your Watchtower account.' : error.message;
      if (!isStaffEmail(data.user?.email)) { await sb().auth.signOut(); return 'This demo is for Sense staff accounts.'; }
      return null;
    },
    async signOut() {
      if (!AUTH_OFF) await sb().auth.signOut();
      setSession(null);
    },
  }), [ready, session]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be inside AuthProvider');
  return v;
}

export function isSignedIn(a: AuthValue): boolean {
  return a.disabled || !!a.email;
}
