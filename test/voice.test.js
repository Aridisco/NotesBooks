import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { nodes, report, idbp, ST } = vi.hoisted(() => ({ nodes: {}, report: vi.fn(), idbp: vi.fn(), ST: { S: { cur: 'page' } } }));
vi.mock('../src/state.js', () => ({ ST, P: vi.fn() }));
vi.mock('../src/util.js', () => ({ $: s => nodes[s], cv: {}, esc: s => s, uid: () => 'recording' }));
vi.mock('../src/render.js', () => ({}));
vi.mock('../src/edit.js', () => ({}));
vi.mock('../src/platform.js', () => ({ idbp }));
vi.mock('../src/toolbar.js', () => ({ props: vi.fn() }));
vi.mock('../src/report.js', () => ({ report }));

let recognition, recorder, track, getUserMedia, startError;
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  recognition = recorder = startError = undefined;
  idbp.mockResolvedValue([]);
  for (const s of ['#vlang', '#vbox', '#vtxt', '#vgo', '#vadd', '#vlist']) {
    nodes[s] = { value: 'it-IT', textContent: '', hidden: true, classList: { add: vi.fn(), remove: vi.fn() } };
  }
  track = { stop: vi.fn() };
  getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [track] });
  class Recorder {
    constructor() { recorder = this; this.state = 'inactive'; this.mimeType = 'audio/webm'; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.onstop?.(); }
  }
  class Recognition {
    constructor() {
      recognition = this;
      this.start = vi.fn(() => { if (startError) throw startError; });
      this.stop = vi.fn();
    }
  }
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('window', { SpeechRecognition: Recognition, MediaRecorder: Recorder });
  vi.stubGlobal('MediaRecorder', Recorder);
  await import('../src/voice.js');
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
async function start() {
  nodes['#vgo'].onclick();
  await vi.waitFor(() => expect(recorder?.state).toBe('recording'));
}

describe('voice error reporting', () => {
  it('reports a failed recognition start while audio recording remains available', async () => {
    startError = new Error('Recognition unavailable');
    await start();
    expect(report).toHaveBeenCalledWith(startError, 'Speech recognition could not start', { quiet: true });
    expect(recorder.state).toBe('recording');
  });
  it('reports a failed recognition restart without stopping audio recording', async () => {
    await start();
    const error = new Error('Recognition busy');
    recognition.start.mockImplementation(() => { throw error; });
    recognition.onend();
    expect(report).toHaveBeenCalledWith(error, 'Speech recognition could not restart', { quiet: true });
    expect(recorder.state).toBe('recording');
  });
  it('reports recognition and recorder event errors', async () => {
    await start();
    recognition.onerror({ error: 'network' });
    const error = new Error('Audio device disconnected');
    recorder.onerror({ error });
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ message: 'network' }), 'Speech recognition failed', { quiet: true });
    expect(report).toHaveBeenCalledWith(error, 'Audio recording failed', { quiet: true });
  });
  it('reports both stop failures and restores the record button', async () => {
    await start();
    const error = new Error('Stop failed');
    recognition.stop.mockImplementation(() => { throw error; });
    recorder.stop = () => { throw error; };
    nodes['#vgo'].onclick();
    expect(report).toHaveBeenCalledWith(error, 'Speech recognition could not stop', { quiet: true });
    expect(report).toHaveBeenCalledWith(error, 'Audio recording could not stop', { quiet: true });
    expect(nodes['#vgo'].textContent).toBe('● Record');
  });
  it('keeps the microphone denial message while reporting its cause', async () => {
    const error = new Error('Microphone denied');
    getUserMedia.mockRejectedValueOnce(error);
    nodes['#vgo'].onclick();
    await vi.waitFor(() => expect(report).toHaveBeenCalledWith(error, 'Voice recording could not start', { quiet: true }));
    expect(nodes['#vtxt'].textContent).toBe('Microphone access was denied.');
  });
  it('reports audio persistence failures, keeps the user message, and releases the microphone', async () => {
    await start();
    vi.useFakeTimers();
    const error = new Error('Storage full');
    idbp.mockRejectedValueOnce(error);
    nodes['#vgo'].onclick();
    await vi.advanceTimersByTimeAsync(700);
    expect(track.stop).toHaveBeenCalled();
    expect(report).toHaveBeenCalledWith(error, 'Recording could not be saved', { quiet: true });
    expect(nodes['#vtxt'].textContent).toContain('Could not save the audio on this device');
  });
  it('handles rejected recording deletions', async () => {
    const error = new Error('Storage unavailable');
    idbp.mockRejectedValueOnce(error);
    nodes['#vlist'].onclick({ target: { closest: () => ({ dataset: { rd: 'recording' } }) } });
    await vi.waitFor(() => expect(report).toHaveBeenCalledWith(error, 'Recording could not be deleted', { quiet: true }));
  });
});
