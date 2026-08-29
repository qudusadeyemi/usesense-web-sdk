/**
 * location.ts -- the contract-critical half of location capture.
 *
 * Kept out of the React component on purpose. What goes on the wire is a
 * frozen contract five clients implement (see
 * docs/sdk-specs/location-capture-contract.md in the watchtower repo), so the
 * payload construction is a pure function with its own tests rather than
 * something buried in a submit handler.
 *
 * The component owns the browser API and the UI; everything here is decidable
 * without a DOM.
 */

import type { CaptureRung } from './types';

export interface PositionFix {
  lat: number;
  lng: number;
  /** Horizontal accuracy in metres, when the browser reported a finite one. */
  accuracyM?: number;
}

/** What the surface knows about the position, for the status line. */
export type LocationState = 'idle' | 'acquiring' | 'ready' | 'denied' | 'unavailable';

/**
 * A fix is usable only if both coordinates are in range and it is not null
 * island.
 *
 * `0, 0` means the device failed and reported zeroes. Submitting it would mint
 * a Place in the Gulf of Guinea inside a registry shared across every
 * customer, and a poisoned Place propagates to every future subject who
 * resolves onto it. The server rejects it too; catching it here saves a
 * pointless round trip and lets the subject retry.
 */
export function isUsableFix(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

/** Turn a GeolocationPositionError into the state the surface should show. */
export function stateForGeolocationError(code: number, permissionDenied = 1): LocationState {
  return code === permissionDenied ? 'denied' : 'unavailable';
}

/**
 * Build the exact `inputs` payload for an advance call.
 *
 * Two rules from the contract are enforced here rather than trusted to the
 * caller:
 *
 *   No fix means no coordinates at all, and the rung drops to
 *   `spoken_description`. The descriptors are still worth having, and the rung
 *   says precisely what this evidence is: the subject described where they
 *   live. A step must never fail because a permission was denied.
 *
 *   `attested` is always false. The web platform has no attestation
 *   primitive, and saying so plainly is better than omitting it: the server
 *   then records a weaker evidence class rather than inferring one.
 */
export function buildLocationInputs(input: {
  fix: PositionFix | null;
  descriptors: Record<string, string | number | boolean>;
  requestedRung?: CaptureRung;
}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = { ...input.descriptors };

  if (input.fix && isUsableFix(input.fix.lat, input.fix.lng)) {
    out.latitude = input.fix.lat;
    out.longitude = input.fix.lng;
    if (input.fix.accuracyM !== undefined && Number.isFinite(input.fix.accuracyM)) {
      out.accuracy_m = Math.round(input.fix.accuracyM);
    }
    out.attested = false;
    out.rung = input.requestedRung ?? 'at_the_door';
    return out;
  }

  out.rung = 'spoken_description';
  return out;
}

/**
 * Geolocation options for a capture.
 *
 * `locationAccuracyTargetM` is deliberately NOT translated into a hard gate.
 * It is advisory: we take the best fix the browser gives us inside the
 * timeout and report the accuracy actually achieved. Treating it as a
 * requirement would hang in exactly the markets this feature exists for, where
 * positioning error from wireless and cell sources routinely runs 20 to 50 m.
 */
export function geolocationOptions(maxWaitMs?: number): PositionOptions {
  return {
    enableHighAccuracy: true,
    timeout: maxWaitMs ?? 20_000,
    maximumAge: 0,
  };
}

/** Human status text for each state. Kept here so the copy is testable too. */
export function statusFor(state: LocationState, accuracyM?: number): { text: string; tone: 'muted' | 'ok' | 'warn' } {
  switch (state) {
    case 'acquiring':
      return { text: 'Finding your location…', tone: 'muted' };
    case 'ready':
      return accuracyM !== undefined
        ? { text: `Location found, accurate to about ${Math.round(accuracyM)} m`, tone: 'ok' }
        : { text: 'Location found', tone: 'ok' };
    case 'denied':
      return { text: 'Location is off. You can still continue by describing where you live.', tone: 'warn' };
    case 'unavailable':
      return { text: 'We could not get your location. You can still continue below.', tone: 'warn' };
    default:
      return { text: '', tone: 'muted' };
  }
}
