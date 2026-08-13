/**
 * version.ts -- the SDK's own version, reported to the server on every runner
 * call so a run records which SDK rendered it.
 *
 * Without this the server cannot tell which SDK (or which version of it) is
 * driving a run. A run parked on an action the integrator's SDK is too old to
 * render is indistinguishable, server side, from an applicant who walked away:
 * both just sit until the abandonment sweep. See UnsupportedSurface.
 *
 * tsup replaces __USESENSE_SDK_VERSION__ at build time from package.json. The
 * fallback keeps unbundled consumers (tests, ts-node) working.
 */

declare const __USESENSE_SDK_VERSION__: string | undefined;

export const SDK_NAME = 'web';

export const SDK_VERSION: string =
  typeof __USESENSE_SDK_VERSION__ === 'string' ? __USESENSE_SDK_VERSION__ : '0.0.0-dev';

/** Compact identity for the `client` field / query param: "web/4.8.0". */
export const CLIENT_ID = `${SDK_NAME}/${SDK_VERSION}`;
