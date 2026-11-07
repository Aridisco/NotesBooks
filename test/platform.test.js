import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ST, resize, report } = vi.hoisted(() => ({ ST: {}, resize: vi.fn(), report: vi.fn() }));
vi.mock('../src/state.js', () => ({ ST }));
vi.mock('../src/env.js', () => ({ resize }));
vi.mock('../src/report.js', () => ({ report }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('document', { documentElement: {}, addEventListener: vi.fn() });
  vi.stubGlobal('navigator', {});
  vi.stubGlobal('indexedDB', { open: () => ({}) });
});

describe('platform error reporting', () => {
  it.each(['sync', 'async'])('reports %s fullscreen failures quietly', async kind => {
    const error = new Error('Fullscreen denied');
    document.documentElement.requestFullscreen = () => {
      if (kind === 'sync') throw error;
      return Promise.reject(error);
    };
    const { toggleFS } = await import('../src/platform.js');
    toggleFS();
    await vi.waitFor(() => expect(report).toHaveBeenCalledWith(error, 'Fullscreen could not change', { quiet: true }));
  });
  it('supports legacy fullscreen APIs that return no promise', async () => {
    document.documentElement.webkitRequestFullscreen = vi.fn();
    const { toggleFS } = await import('../src/platform.js');
    toggleFS();
    expect(document.documentElement.webkitRequestFullscreen).toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });
  it('reports an asynchronously rejected battery request', async () => {
    const error = new Error('Battery access denied');
    navigator.getBattery = () => Promise.reject(error);
    await import('../src/platform.js');
    await vi.waitFor(() => expect(report).toHaveBeenCalledWith(error, 'Battery status unavailable', { quiet: true }));
  });
});
