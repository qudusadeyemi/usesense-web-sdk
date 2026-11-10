import { describe, it, expect } from 'vitest';
import { UploadProgress, UPLOAD_PROGRESS, ariaPercent } from '../capture/upload-progress';

describe('UploadProgress (spec v1.3, as iOS ee69907)', () => {
  it('starts at 0.04 and eases toward 0.60 while sending (~0.47 at 2.3 s)', () => {
    const p = new UploadProgress();
    expect(p.value(0)).toBe(0);
    p.advance('sending', 1000);
    expect(p.value(1000)).toBeCloseTo(0.04, 6);
    expect(p.value(1000 + 2300)).toBeCloseTo(0.479, 2);
    expect(p.value(1000 + 60000)).toBeLessThan(UPLOAD_PROGRESS.sending.cap);
  });

  it('checking continues from the current value toward 0.95 (~0.83 after 6.7 s) and never reaches it', () => {
    const p = new UploadProgress();
    p.advance('sending', 0);
    p.advance('checking', 2300);
    expect(p.value(2300)).toBeCloseTo(0.479, 2); // no jump
    expect(p.value(2300 + 6700)).toBeGreaterThan(0.8);
    expect(p.value(2300 + 6700)).toBeLessThan(0.86);
    expect(p.value(2300 + 600000)).toBeLessThan(UPLOAD_PROGRESS.checking.cap);
    p.advance('done', 9000);
    expect(p.value(9000)).toBe(1);
  });

  it('moves more than 0.005 per second through 7 s of checking, never passes the cap, never goes back', () => {
    const p = new UploadProgress();
    p.advance('sending', 0);
    p.advance('checking', 2300);
    let prev = p.value(2300);
    for (let t = 2300 + 100; t <= 2300 + 7000; t += 100) {
      const v = p.value(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThan(UPLOAD_PROGRESS.checking.cap);
      prev = v;
    }
    for (let s = 0; s < 7; s++) {
      const a = p.value(2300 + s * 1000);
      const b = p.value(2300 + (s + 1) * 1000);
      expect(b - a).toBeGreaterThan(0.005);
    }
  });

  it('only moves forward between stages, and resets', () => {
    const p = new UploadProgress();
    p.advance('checking', 0);
    p.advance('sending', 500); // ignored: backwards
    expect(p.current).toBe('checking');
    const v = p.value(1000);
    p.advance('checking', 1000); // same stage: ignored, no restart
    expect(p.value(1000)).toBeCloseTo(v, 9);
    p.reset();
    expect(p.current).toBe('idle');
    expect(p.value(2000)).toBe(0);
  });

  it('floors aria-valuenow to 10% steps', () => {
    expect(ariaPercent(0.479)).toBe(40);
    expect(ariaPercent(0.95)).toBe(90);
    expect(ariaPercent(1)).toBe(100);
    expect(ariaPercent(0.04)).toBe(0);
  });
});
