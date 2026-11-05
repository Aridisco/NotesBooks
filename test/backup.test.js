import { describe, expect, it } from 'vitest';
import { isValidBackup } from '../src/backup.js';

const ok = { nbs: [{ name: 'N', pages: [{ name: 'P', els: [{ t: 'rect' }] }] }] };

describe('isValidBackup', () => {
  it('accepts a well-formed backup', () => expect(isValidBackup(ok)).toBe(true));
  it('accepts pages without els', () => {
    expect(isValidBackup({ nbs: [{ name: 'N', pages: [{ name: 'P' }] }] })).toBe(true);
  });
  it.each([
    ['null', null],
    ['no nbs', {}],
    ['nbs not an array', { nbs: {} }],
    ['notebook without name', { nbs: [{ pages: [{ name: 'P' }] }] }],
    ['notebook without pages', { nbs: [{ name: 'N', pages: [] }] }],
    ['page name not a string', { nbs: [{ name: 'N', pages: [{ name: 3 }] }] }],
    ['els not an array', { nbs: [{ name: 'N', pages: [{ name: 'P', els: 'x' }] }] }],
    ['element without type', { nbs: [{ name: 'N', pages: [{ name: 'P', els: [{}] }] }] }],
    ['null element', { nbs: [{ name: 'N', pages: [{ name: 'P', els: [null] }] }] }]
  ])('rejects %s', (_, d) => expect(isValidBackup(d)).toBe(false));
});
