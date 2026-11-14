/**
 * Stub do EmulatorAdapter — implementação offline que implementa a interface
 * sem depender do núcleo WASM. Usado quando o build do 3ds-web não está
 * disponível (ambiente sem Emscripten/CMake/Ninja ou sem ROM legal).
 *
 * O stub permite que a interface (Etapa 3) seja desenvolvida e testada
 * independentemente do emulador real. Quando o WASM estiver disponível,
 * basta substituir esta implementação por uma real (wasm.ts).
 */

import type { EmulatorAdapter, EmulatorStatus, PerformanceMetrics, InputState, SaveStateInfo, EmulatorOptions, LoadGameResult } from './types';

const DEFAULT_OPTIONS: EmulatorOptions = {
  graphicsApi: 'auto',
  resolutionFactor: 1,
  cpuClockPercentage: 100,
  jitEnabled: false,
};

export class StubEmulatorAdapter implements EmulatorAdapter {
  private state: EmulatorStatus = {
    state: 'idle',
    error: null,
    coreVersion: null,
    wasmReady: false,
    crossOriginIsolated: typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false,
  };

  private options = { ...DEFAULT_OPTIONS };
  private frameCount = 0;
  private rafId: number | null = null;
  private saveStates: SaveStateInfo[] = [];
  private lastError: string | null = null;

  private canvas: HTMLCanvasElement | null = null;

  async initialize(): Promise<void> {
    this.state.state = 'initializing';
    // Simula inicialização assíncrona do núcleo (sem WASM real)
    await new Promise((resolve) => setTimeout(resolve, 300));
    this.state.wasmReady = false;
    this.state.state = 'ready';
    this.state.error = null;
    this.lastError = null;
    this.createPlaceholderCanvases();
  }

  async loadGame(_romPath: string): Promise<LoadGameResult> {
    this.state.state = 'loading';
    this.lastError = null;

    // Stub: não há emulador real, então não podemos carregar ROM
    const error = 'Emulador WASM não disponível neste ambiente. É necessário buildar o 3ds-web com Emscripten SDK 7.0.0, CMake e Ninja, e fornecer um .3ds descriptografado legalmente.';
    this.state.state = 'error';
    this.state.error = error;
    this.lastError = error;

    return {
      success: false,
      error,
      title: null,
      region: null,
    };
  }

  async start(): Promise<void> {
    if (this.state.state === 'error') return;
    this.state.state = 'running';
    this.frameCount = 0;
    this.runLoop();
  }

  async pause(): Promise<void> {
    if (this.state.state === 'running') {
      this.state.state = 'paused';
      this.cancelLoop();
    }
  }

  async resume(): Promise<void> {
    if (this.state.state === 'paused') {
      this.state.state = 'running';
      this.runLoop();
    }
  }

  async reset(): Promise<void> {
    this.cancelLoop();
    this.frameCount = 0;
    this.state.state = 'ready';
  }

  async stop(): Promise<void> {
    this.cancelLoop();
    this.state.state = 'stopped';
    this.frameCount = 0;
  }

  getStatus(): EmulatorStatus {
    return { ...this.state };
  }

  getMetrics(): PerformanceMetrics {
    const speed = this.state.state === 'running' ? 0 : 0; // sem emulação real
    return {
      speed,
      busy: 0,
      frameMs: 0,
      frameCount: this.frameCount,
      prof: { 0: 0, 1: 0, 2: 0, 3: 0 },
      memoryMB: 0,
    };
  }

  setOptions(options: Partial<EmulatorOptions>): void {
    this.options = { ...this.options, ...options };
  }

  setInput(_state: InputState): void {
    // Stub: não há emulador para receber input
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  getTopScreenCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  getBottomScreenCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  async saveState(slot: number): Promise<boolean> {
    // Stub: sem persistência real
    this.saveStates = this.saveStates.filter((s) => s.slot !== slot);
    this.saveStates.push({
      slot,
      timestamp: Date.now(),
      title: null,
      sizeBytes: 0,
    });
    return true;
  }

  async loadState(slot: number): Promise<boolean> {
    return this.saveStates.some((s) => s.slot === slot);
  }

  listSaveStates(): SaveStateInfo[] {
    return [...this.saveStates];
  }

  async syncSaveGameFile(_vfsPath: string): Promise<boolean> {
    // Stub: sem persistência real de save game
    return false;
  }

  async restoreSaveGameFile(_vfsPath: string): Promise<boolean> {
    // Stub: sem persistência real de save game
    return false;
  }

  async listSaveGames(): Promise<string[]> {
    // Stub: sem persistência real de save game
    return [];
  }

  getLastError(): string | null {
    return this.lastError;
  }

  dispose(): void {
    this.cancelLoop();
    this.canvas = null;
    this.state.state = 'idle';
  }

  private runLoop(): void {
    const tick = () => {
      if (this.state.state !== 'running') return;
      this.frameCount++;
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private cancelLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private createPlaceholderCanvases(): void {
    if (typeof document === 'undefined') return;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 400;
    this.canvas.height = 480;
    this.canvas.style.background = '#000';
  }
}
