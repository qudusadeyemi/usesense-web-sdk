import type { Environment } from '../types';

/**
 * Infers the target environment from an API key's prefix.
 *
 * Convention:
 *   - Keys containing `_live_` or `_prod_` -> `'production'`
 *   - Everything else                      -> `'sandbox'`
 *
 * @param apiKey - The UseSense API key.
 * @returns The detected `Environment`.
 */
export function detectEnvironmentFromKey(apiKey: string): Environment {
  if (/_(live|prod)_/.test(apiKey)) {
    return 'production';
  }
  return 'sandbox';
}
