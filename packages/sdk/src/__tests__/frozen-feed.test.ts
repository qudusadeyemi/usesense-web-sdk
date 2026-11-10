import { describe, expect, it } from 'vitest';
import { isFrozenFeed } from '../capture/frame-capture';

// A frozen camera feed sends the same picture every frame. The server rejects
// that as a possible replay; the SDK catches it first and shows "The camera
// stopped" instead of an error.

describe('isFrozenFeed', () => {
  it('flags a round whose frames are all the same picture', () => {
    expect(isFrozenFeed(['a', 'a', 'a', 'a'])).toBe(true);
  });

  it('flags identical face meshes even when the bytes differ', () => {
    const mesh = [0.1, 0.2, 0.3];
    expect(isFrozenFeed(['a', 'b', 'c'], [mesh, [...mesh], [...mesh]])).toBe(true);
  });

  it('passes a live feed (frames and meshes that change)', () => {
    expect(isFrozenFeed(['a', 'b', 'a', 'c'], [[0.1, 0.2], [0.1, 0.21], [0.1, 0.2]])).toBe(false);
    // One repeated frame among live ones is not a freeze.
    expect(isFrozenFeed(['a', 'a', 'b'])).toBe(false);
  });

  it('needs at least 3 frames to judge', () => {
    expect(isFrozenFeed(['a', 'a'])).toBe(false);
    expect(isFrozenFeed([], [[1], [1]])).toBe(false);
    expect(isFrozenFeed([])).toBe(false);
  });

  it('ignores missing meshes', () => {
    expect(isFrozenFeed(['a', 'b', 'c'], [null, undefined, [1, 2]])).toBe(false);
  });
});
