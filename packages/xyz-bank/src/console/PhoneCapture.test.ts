import { describe, expect, it } from 'vitest';
import { PHONE_POINTS, phoneWindow } from './PhoneCapture';

describe('the capture window', () => {
  it('lays out at a phone’s width and scales to the frame, keeping its shape', () => {
    // The lab's frame: 269 x 556 on screen.
    const w = phoneWindow(269, 556);
    expect(w.width).toBe(PHONE_POINTS);
    expect(w.scale).toBeCloseTo(269 / 390, 5);
    expect(w.height).toBe(Math.round(556 / (269 / 390)));
    // Drawn size equals the frame, so nothing is cut off or left empty.
    expect(Math.round(w.width * w.scale)).toBe(269);
    expect(Math.round(w.height * w.scale)).toBe(556);
  });
  it('is never shorter than an iPhone SE screen in the lab frame', () => {
    expect(phoneWindow(269, 556).height).toBeGreaterThanOrEqual(667);
  });
});
