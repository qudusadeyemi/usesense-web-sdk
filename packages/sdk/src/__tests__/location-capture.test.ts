/**
 * Tests for location capture (address ladder rung 0).
 *
 * These guard a frozen wire contract that five clients implement
 * independently, so they assert the exact payload rather than "something
 * reasonable". The rule that matters most is that no failure path terminates
 * the step: a denied permission still submits and still advances.
 */

import { describe, expect, it } from 'vitest';
import {
  buildLocationInputs,
  geolocationOptions,
  isUsableFix,
  stateForGeolocationError,
  statusFor,
} from '../flows/location';

const LAGOS = { lat: 6.4281, lng: 3.4219, accuracyM: 24 };
const DESCRIPTORS = { street_name: 'Adeola Odeku Street', locality: 'Victoria Island' };

describe('usable fix', () => {
  it('accepts a normal coordinate', () => {
    expect(isUsableFix(6.4281, 3.4219)).toBe(true);
  });

  it('rejects null island', () => {
    // The device failed and reported zeroes. Submitting it would mint a Place
    // in the Gulf of Guinea inside a registry shared across every customer.
    expect(isUsableFix(0, 0)).toBe(false);
  });

  it('rejects out-of-range coordinates', () => {
    expect(isUsableFix(91, 3)).toBe(false);
    expect(isUsableFix(6, 181)).toBe(false);
  });

  it('rejects NaN, which is what a broken sensor produces', () => {
    expect(isUsableFix(Number.NaN, 3.4219)).toBe(false);
  });
});

describe('submit payload', () => {
  it('sends the coordinate, its accuracy, and the requested rung', () => {
    const out = buildLocationInputs({ fix: LAGOS, descriptors: DESCRIPTORS, requestedRung: 'at_the_door' });
    expect(out).toEqual({
      street_name: 'Adeola Odeku Street',
      locality: 'Victoria Island',
      latitude: 6.4281,
      longitude: 3.4219,
      accuracy_m: 24,
      attested: false,
      rung: 'at_the_door',
    });
  });

  it('always reports attested false, because the web has no attestation', () => {
    // Saying so plainly beats omitting it: the server records a weaker
    // evidence class rather than having to infer one from the platform.
    const out = buildLocationInputs({ fix: LAGOS, descriptors: {}, requestedRung: 'at_the_door' });
    expect(out.attested).toBe(false);
  });

  it('rounds accuracy to whole metres', () => {
    const out = buildLocationInputs({ fix: { ...LAGOS, accuracyM: 23.7419 }, descriptors: {} });
    expect(out.accuracy_m).toBe(24);
  });

  it('omits accuracy when the browser did not report one', () => {
    const out = buildLocationInputs({ fix: { lat: 6.4281, lng: 3.4219 }, descriptors: {} });
    expect('accuracy_m' in out).toBe(false);
  });

  it('defaults the rung when the step did not name one', () => {
    const out = buildLocationInputs({ fix: LAGOS, descriptors: {} });
    expect(out.rung).toBe('at_the_door');
  });
});

describe('no position is not a failure', () => {
  it('submits the descriptors alone, at a lower rung', () => {
    // A denied permission must never terminate the step. A low-confidence
    // record that can be upgraded is worth more than an abandoned onboarding.
    const out = buildLocationInputs({ fix: null, descriptors: DESCRIPTORS, requestedRung: 'at_the_door' });
    expect(out).toEqual({
      street_name: 'Adeola Odeku Street',
      locality: 'Victoria Island',
      rung: 'spoken_description',
    });
  });

  it('sends no coordinates at all rather than zeroes', () => {
    const out = buildLocationInputs({ fix: null, descriptors: {} });
    expect('latitude' in out).toBe(false);
    expect('longitude' in out).toBe(false);
  });

  it('drops the rung even when a usable-looking fix is actually null island', () => {
    const out = buildLocationInputs({ fix: { lat: 0, lng: 0 }, descriptors: {}, requestedRung: 'at_the_door' });
    expect(out.rung).toBe('spoken_description');
    expect('latitude' in out).toBe(false);
  });

  it('never claims a rung higher than it performed', () => {
    // The server takes the weaker of its own ceiling and what we report, but
    // over-reporting here would be a bug on our side either way.
    const out = buildLocationInputs({ fix: null, descriptors: {}, requestedRung: 'agent_visit' });
    expect(out.rung).toBe('spoken_description');
  });
});

describe('permission and error states', () => {
  it('separates a denied permission from a failed fix', () => {
    expect(stateForGeolocationError(1)).toBe('denied');
    expect(stateForGeolocationError(2)).toBe('unavailable'); // POSITION_UNAVAILABLE
    expect(stateForGeolocationError(3)).toBe('unavailable'); // TIMEOUT
  });

  it('tells the subject they can continue either way', () => {
    expect(statusFor('denied').text).toContain('still continue');
    expect(statusFor('unavailable').text).toContain('still continue');
  });

  it('reports the accuracy it achieved, not the one it wanted', () => {
    expect(statusFor('ready', 137).text).toContain('137 m');
  });
});

describe('geolocation options', () => {
  it('asks for high accuracy and never a cached fix', () => {
    const o = geolocationOptions();
    expect(o.enableHighAccuracy).toBe(true);
    expect(o.maximumAge).toBe(0);
  });

  it('honours the step timeout', () => {
    expect(geolocationOptions(45_000).timeout).toBe(45_000);
  });

  it('does not turn the accuracy target into a hard gate', () => {
    // Advisory by design. Treating it as a requirement hangs in exactly the
    // markets this exists for, where positioning error runs 20 to 50 m.
    const o = geolocationOptions() as PositionOptions & { accuracyTarget?: number };
    expect(o.accuracyTarget).toBeUndefined();
  });
});
