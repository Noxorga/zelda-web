/**
 * AudioWorklet — RingPlayer para reprodução de áudio do emulador 3ds-web.
 *
 * Lê do ring buffer compartilhado (frontend/main.cpp, struct AudioRing):
 *   [0] write position (uint32, monotonic)
 *   [1] read position (uint32)
 *   [2] capacity (uint32, frames)
 *   [3] dropped frames (uint32)
 *   [4] sample rate (uint32, Hz)
 *   [8..] int16 stereo samples (capacity * 2 samples)
 *
 * O áudio é produzido pela thread de emulação (produtor único) e consumido
 * pelo AudioWorklet (consumidor único) via SharedArrayBuffer + Atomics.
 */

const WORKLET_CODE = `
class RingPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.hdr = null;
    this.pcm = null;
    this.cap = 0;
    this.primed = false;

    this.port.onmessage = (e) => {
      const { buffer, base } = e.data;
      this.hdr = new Uint32Array(buffer, base, 8);
      this.cap = this.hdr[2];
      this.pcm = new Int16Array(buffer, base + 32, this.cap * 2);
    };
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const R = out[1] || out[0];

    if (!this.hdr || !this.pcm) return true;

    const w = Atomics.load(this.hdr, 0);
    let r = Atomics.load(this.hdr, 1);
    let avail = (w - r) >>> 0;

    // Se muito cheio, descarta o mais antigo para reduzir latência
    if (avail > 4096) {
      r = (w - 2048) >>> 0;
      avail = 2048;
    }

    // Após underrun, espera encher um pouco para evitar estalos/estouras
    if (!this.primed && avail < 1024) return true;
    this.primed = true;

    const n = Math.min(avail, L.length);
    for (let i = 0; i < n; i++) {
      const p = ((r + i) % this.cap) * 2;
      L[i] = this.pcm[p] / 32768;
      R[i] = this.pcm[p + 1] / 32768;
    }

    if (n < L.length) this.primed = false;
    Atomics.store(this.hdr, 1, (r + n) >>> 0);
    return true;
  }
}

registerProcessor('ring-player', RingPlayer);
`;

export class AudioWorkletManager {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private initialized = false;

  async initialize(audioPtr: number, heapBuffer: ArrayBuffer): Promise<void> {
    if (this.initialized) return;

    const hdr = new Uint32Array(heapBuffer, audioPtr, 8);
    const rate = hdr[4] || 32728;

    this.audioContext = new AudioContext({ sampleRate: rate, latencyHint: 'interactive' });

    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    await this.audioContext.audioWorklet.addModule(url);

    this.workletNode = new AudioWorkletNode(this.audioContext, 'ring-player', {
      outputChannelCount: [2]
    });

    this.workletNode.port.postMessage({ buffer: heapBuffer, base: audioPtr });
    this.workletNode.connect(this.audioContext.destination);

    await this.audioContext.resume();
    this.initialized = true;
  }

  async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  suspend(): void {
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend();
    }
  }

  dispose(): void {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.initialized = false;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }
}

export const audioWorklet = new AudioWorkletManager();
