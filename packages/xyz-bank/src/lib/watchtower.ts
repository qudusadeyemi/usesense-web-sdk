/* Calls to the Watchtower API (the same Supabase project the reps sign in
   to). Signed-in calls carry the rep's token; public calls (prospect links)
   carry only the publishable key, which is public by design. */
import { accessToken, AUTH_DISABLED, PUBLISHABLE_KEY, WATCHTOWER_API } from './auth';

export class WatchtowerError extends Error {
  constructor(message: string, readonly status = 0, readonly code = '') { super(message); }
}

export async function wtCall<T>(path: string, init: RequestInit = {}, opts: { signedIn?: boolean; base?: string } = {}): Promise<T> {
  const signedIn = opts.signedIn ?? true;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    apikey: PUBLISHABLE_KEY,
    authorization: `Bearer ${PUBLISHABLE_KEY}`,
    'x-environment': 'production',
  };
  if (signedIn) {
    const token = await accessToken();
    if (!token) {
      throw new WatchtowerError(AUTH_DISABLED
        ? 'This needs a Watchtower sign-in, which is off in this local build.'
        : 'Your sign-in has expired. Sign in again.', 401, 'signed_out');
    }
    headers['x-user-token'] = token;
  }
  let res: Response;
  try {
    res = await fetch(`${opts.base ?? WATCHTOWER_API}${path}`, { ...init, headers });
  } catch {
    throw new WatchtowerError('Couldn’t reach Sense. Check the connection and try again.');
  }
  const body = await res.json().catch(() => ({})) as { error?: string; code?: string } & T;
  if (!res.ok) throw new WatchtowerError(body.error || 'Something went wrong. Try again.', res.status, body.code ?? '');
  return body;
}
