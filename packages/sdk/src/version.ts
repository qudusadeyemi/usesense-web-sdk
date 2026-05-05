/**
 * Single source of truth for the SDK version, sourced from package.json
 * at build time. Do not hand-edit this constant; bump package.json instead.
 */
import pkg from '../package.json' with { type: 'json' };

export const SDK_VERSION: string = pkg.version;
