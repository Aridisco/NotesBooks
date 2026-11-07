import { beforeEach, describe, expect, it, vi } from 'vitest';
import { integrityFor } from '../src/scriptIntegrity.js';

const { ST, appended, report } = vi.hoisted(() => ({ ST: {}, appended: vi.fn(), report: vi.fn() }));
vi.mock('../src/state.js', () => ({ ST, P: vi.fn() }));
vi.mock('../src/util.js', () => ({ $: vi.fn(), cv: {} }));
vi.mock('../src/render.js', () => ({}));
vi.mock('../src/code.js', () => ({}));
vi.mock('../src/report.js', () => ({ report }));
vi.stubGlobal('localStorage', { getItem: () => null });
vi.stubGlobal('matchMedia', () => ({ matches: false }));
vi.stubGlobal('navigator', {});
vi.stubGlobal('addEventListener', vi.fn());
vi.stubGlobal('document', { createElement: () => ({}), head: { appendChild: appended }, addEventListener: vi.fn() });
const { loadScript } = await import('../src/env.js');
const url = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.js';
beforeEach(() => { vi.clearAllMocks(); });

describe('external script integrity', () => {
  it('sets integrity and anonymous CORS before inserting a script', async () => {
    appended.mockImplementation(s => {
      expect(s.integrity).toBe(integrityFor(url));
      expect(s.crossOrigin).toBe('anonymous');
      expect(s.src).toBe(url);
      s.onload();
    });
    await expect(loadScript(url)).resolves.toBeUndefined();
  });
  it('refuses unknown scripts and inherited object properties without requesting them', async () => {
    await expect(loadScript('https://example.com/unpinned.js')).rejects.toThrow('Unpinned external script');
    await expect(loadScript('toString')).rejects.toThrow('Unpinned external script');
    expect(appended).not.toHaveBeenCalled();
  });
  it('rejects a load or integrity failure with a diagnostic error', async () => {
    appended.mockImplementation(s => s.onerror());
    await expect(loadScript(url)).rejects.toThrow('Script could not be loaded or verified');
  });
});
