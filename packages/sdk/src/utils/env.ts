import type { Environment } from '../types';

/**
 * Infers the target environment from an API key's prefix, the way the server
 * does: `pk_` keys are production (live) keys and `sk_` keys are sandbox keys.
 * Keys containing `_live_` or `_prod_` (an older naming) also count as
 * production. Anything else is treated as sandbox.
 *
 * This used to treat only `_live_` / `_prod_` keys as production, so a real
 * live `pk_...` key was sent as sandbox: every upload carried `?env=sandbox`
 * for a production session and the run hung on "Almost done".
 *
 * @param apiKey - The UseSense API key.
 * @returns The detected `Environment`.
 */
export function detectEnvironmentFromKey(apiKey: string): Environment {
  const key = apiKey.trim();
  if (key.startsWith('pk_') || /_(live|prod)_/.test(key)) {
    return 'production';
  }
  return 'sandbox';
}
