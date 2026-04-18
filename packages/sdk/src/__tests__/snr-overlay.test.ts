/**
 * EmissionOverlay helper unit tests.
 *
 * Component render tests require a DOM environment (jsdom/happy-dom)
 * which this project does not currently configure; see package.json
 * `vitest.config.ts` (node env). Snapshot/render coverage is deferred to
 * the VerificationCaptureEngine integration tests.
 *
 * Run: npx vitest run src/__tests__/snr-overlay.test.ts
 */

import { describe, expect, it } from 'vitest';
import {
  hasSeenSnrPreScreen,
  markSnrPreScreenSeen,
} from '../snr/EmissionOverlay';

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
}

describe('SNR pre-screen storage helpers', () => {
  it('reports unseen by default', () => {
    expect(hasSeenSnrPreScreen(makeStorage())).toBe(false);
  });

  it('reports seen after mark', () => {
    const s = makeStorage();
    markSnrPreScreenSeen(s);
    expect(hasSeenSnrPreScreen(s)).toBe(true);
  });

  it('hasSeen returns false when storage throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('storage disabled');
      },
    } as unknown as Storage;
    expect(hasSeenSnrPreScreen(throwing)).toBe(false);
  });

  it('markSeen swallows storage errors', () => {
    const throwing = {
      setItem: () => {
        throw new Error('storage disabled');
      },
    } as unknown as Storage;
    expect(() => markSnrPreScreenSeen(throwing)).not.toThrow();
  });

  it('uses the canonical storage key', () => {
    const s = makeStorage();
    markSnrPreScreenSeen(s);
    expect(s.getItem('usesense.snr.preScreenSeen')).toBe('1');
  });
});
