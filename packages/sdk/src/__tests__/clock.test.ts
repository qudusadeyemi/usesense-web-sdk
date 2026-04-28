import { describe, it, expect } from 'vitest';
import { createFakeClock } from '../session/clock';

describe('FakeClock', () => {
  it('does not resolve sleep before time advances past the deadline', async () => {
    const clock = createFakeClock();
    let resolved = false;
    void clock.sleep(100).then(() => { resolved = true; });
    await Promise.resolve();
    expect(resolved).toBe(false);
  });

  it('resolves sleep after advance passes the deadline', async () => {
    const clock = createFakeClock();
    let resolved = false;
    const p = clock.sleep(100).then(() => { resolved = true; });
    await clock.advance(100);
    await p;
    expect(resolved).toBe(true);
    expect(clock.now()).toBe(100);
  });

  it('advances now() monotonically', async () => {
    const clock = createFakeClock(50);
    expect(clock.now()).toBe(50);
    await clock.advance(25);
    expect(clock.now()).toBe(75);
  });

  it('releases multiple sleepers whose deadlines have passed', async () => {
    const clock = createFakeClock();
    const a = clock.sleep(50);
    const b = clock.sleep(100);
    await clock.advance(120);
    await Promise.all([a, b]);
    expect(clock.now()).toBe(120);
  });
});
