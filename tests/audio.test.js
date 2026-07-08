import { describe, it, expect } from 'vitest';
import { createAudio } from '../js/audio.js';

function fakeNode() {
  return { connect(n) { return n; }, start() {}, stop() {},
    frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    type: '', Q: { value: 0 }, buffer: null, loop: false };
}
class FakeAC {
  constructor() { this.created = 0; this.state = 'running'; this.currentTime = 0; this.sampleRate = 8000; this.destination = fakeNode(); }
  createOscillator() { this.created++; return fakeNode(); }
  createGain() { return fakeNode(); }
  createBiquadFilter() { return fakeNode(); }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  createBufferSource() { return fakeNode(); }
  resume() {}
}
function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

describe('audio 模組', () => {
  it('預設開啟；toggle 後關閉並持久化', () => {
    const store = memStorage();
    const a = createAudio({ storage: store, AC: FakeAC });
    expect(a.isEnabled()).toBe(true);
    a.toggle();
    expect(a.isEnabled()).toBe(false);
    expect(store.getItem('hellTourAudio.v1')).toBe('off');
  });
  it('讀到 off 時初始為靜音，且 tick 不建立節點', () => {
    const store = memStorage({ 'hellTourAudio.v1': 'off' });
    let built = 0;
    class CountAC extends FakeAC { constructor() { super(); built++; } }
    const a = createAudio({ storage: store, AC: CountAC });
    expect(a.isEnabled()).toBe(false);
    a.tick();
    expect(built).toBe(0);
  });
  it('無 AudioContext 環境下所有發聲函式安全 no-op', () => {
    const a = createAudio({ storage: memStorage(), AC: undefined });
    expect(() => { a.tick(); a.chime(); a.flip(); a.startAmbient(); a.stopAmbient(); a.toggle(); }).not.toThrow();
  });
  it('startAmbient 具冪等性（重複呼叫不疊加）', () => {
    const a = createAudio({ storage: memStorage(), AC: FakeAC });
    a.startAmbient(); a.startAmbient();
    a.stopAmbient();
    expect(() => a.stopAmbient()).not.toThrow();
  });
});
