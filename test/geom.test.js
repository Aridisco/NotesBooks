import { describe, expect, it } from 'vitest';
import { segInRect } from '../src/geom.js';

const R = [10, 10, 20, 20];

describe('segInRect', () => {
  it('is true when the segment crosses the rectangle', () => expect(segInRect(0, 15, 30, 15, ...R)).toBe(true));
  it('is true when a segment ends inside, or lies entirely inside', () => {
    expect(segInRect(0, 0, 15, 15, ...R)).toBe(true);
    expect(segInRect(12, 12, 18, 18, ...R)).toBe(true);
  });
  it('is true when it only grazes a corner', () => expect(segInRect(0, 20, 20, 0, ...R)).toBe(true));
  it('is false when it passes by without touching', () => {
    expect(segInRect(0, 0, 30, 0, ...R)).toBe(false);
    // the corner of a long diagonal's bounding box is empty: the line itself misses the rectangle
    expect(segInRect(0, 0, 100, 100, 70, 10, 90, 20)).toBe(false);
  });
  it('handles vertical, horizontal and zero-length segments', () => {
    expect(segInRect(15, 0, 15, 30, ...R)).toBe(true);
    expect(segInRect(25, 0, 25, 30, ...R)).toBe(false);
    expect(segInRect(15, 15, 15, 15, ...R)).toBe(true);
    expect(segInRect(5, 5, 5, 5, ...R)).toBe(false);
  });
});
