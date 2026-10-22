import { describe, expect, it } from 'vitest';
import { canJoinPool, itemCategory } from './item';

describe('kategori item', () => {
  it('itemCategory: crafted menang, lalu wondrous, selain itu junk', () => {
    expect(itemCategory({ is_wondrous: false })).toBe('junk');
    expect(itemCategory({ is_wondrous: true })).toBe('wondrous');
    expect(itemCategory({ is_wondrous: false, is_crafted: true })).toBe('crafted');
    expect(itemCategory({ is_wondrous: false, is_crafted: false })).toBe('junk');
  });

  it('pool Junk menerima Junk dan Crafted, bukan Wondrous', () => {
    expect(canJoinPool('junk', false)).toBe(true);
    expect(canJoinPool('crafted', false)).toBe(true);
    expect(canJoinPool('wondrous', false)).toBe(false);
  });

  it('pool Rare menerima Wondrous dan Crafted, bukan Junk', () => {
    expect(canJoinPool('wondrous', true)).toBe(true);
    expect(canJoinPool('crafted', true)).toBe(true);
    expect(canJoinPool('junk', true)).toBe(false);
  });
});
