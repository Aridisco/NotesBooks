import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ST, page, cv } = vi.hoisted(() => ({ ST: {}, page: {}, cv: { addEventListener: vi.fn() } }));
vi.mock('../src/state.js', () => ({ ST, P: () => page }));
vi.mock('../src/util.js', () => ({ $: vi.fn(), cv, esc: vi.fn(), uid: vi.fn() }));
vi.mock('../src/cloud.js', () => ({ save: vi.fn() }));
vi.mock('../src/env.js', () => ({ G: 14, FF: {}, col: vi.fn(), needX: vi.fn(), rot: vi.fn() }));
vi.mock('../src/render.js', () => ({ bb: e => e, cl: q => q }));
vi.mock('../src/edit.js', () => ({}));
vi.mock('../src/circuit.js', () => ({}));
vi.mock('../src/objects.js', () => ({}));
vi.mock('../src/math.js', () => ({}));
vi.mock('../src/toolbar.js', () => ({}));
vi.mock('../src/code.js', () => ({}));
vi.mock('../src/notebooks.js', () => ({}));
vi.stubGlobal('addEventListener', vi.fn());
const { snp } = await import('../src/input.js');

beforeEach(() => {
  Object.assign(ST, { snap: true, guide: null });
  Object.assign(page, { v: { z: 1 }, els: [] });
});

describe('input snapping on the infinite canvas', () => {
  it('keeps coordinates and clears old guides when snapping is disabled', () => {
    ST.snap = false;
    ST.guide = { x: 10, y: 20 };
    expect(snp(11, -9)).toEqual([11, -9]);
    expect(ST.guide).toBeNull();
  });
  it('rounds to the grid when there is no nearby object', () => {
    expect(snp(22, -9)).toEqual([28, -14]);
    expect(ST.guide).toEqual({ x: null, y: null });
  });
  it('snaps independently to the closest edge or center on each axis', () => {
    page.els = [{ x: 100, y: 200, w: 40, h: 40 }];
    expect(snp(117, 236)).toEqual([120, 240]);
    expect(ST.guide).toEqual({ x: 120, y: 240 });
  });
  it('keeps the tolerance constant in screen pixels at different zoom levels', () => {
    page.els = [{ x: 100, y: 200, w: 40, h: 40 }];
    expect(snp(95, 195)).toEqual([100, 200]);
    page.v.z = 2;
    expect(snp(95, 195)).toEqual([98, 196]);
    expect(ST.guide).toEqual({ x: null, y: null });
  });
  it('excludes either one moved object or a whole selection from snap targets', () => {
    const e = { x: 100, y: 200, w: 40, h: 40 };
    page.els = [e];
    expect(snp(101, 201, e)).toEqual([98, 196]);
    expect(snp(101, 201, new Set([e]))).toEqual([98, 196]);
  });
});
