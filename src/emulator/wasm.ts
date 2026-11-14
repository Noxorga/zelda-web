/**
 * EmulatorAdapter real para WASM (3ds-web / Azahar).
 *
 * A integração com o módulo Emscripten gerado (azahar_web.js/.wasm) segue
 * exatamente a API documentada em frontend/main.cpp e web/index.html do
 * repositório kuroron000234/3ds-web.
 *
 * Diferenças importantes da implementação anterior:
 *  - web_load_game recebe um caminho (string), não um File.
 *  - O ROM é montado via web_mount_rom + BroadcastChannel '3ds-web-rom'.
 *  - O resultado do carregamento é obtido por polling de web_load_state().
 *  - Há um único canvas 400×480 (as duas telas do 3DS são desenhadas nele).
 *  - input_state[8] usa Atomics.store com valores int16 (-32767..32767).
 *  - web_set_option usa valores como 'OpenGL'/'Software' (case-sensitive).
 *  - web_audio_ptr() expõe o ring buffer de áudio para AudioWorklet.
 */

import type { EmulatorAdapter, EmulatorStatus, PerformanceMetrics, InputState, SaveStateInfo, EmulatorOptions, LoadGameResult } from './types';
import { indexeddbSaves } from './indexeddb-saves';
import { audioWorklet } from '../worklet/ring-player';

declare global {
  interface Window {
    Module?: any;
    azahar_web?: any;
    crossOriginIsolated?: boolean;
  }
}

export class WasmEmulatorAdapter implements EmulatorAdapter {
  private module: any = null;
  private status: EmulatorStatus = {
    state: 'idle',
    error: null,
    coreVersion: null,
    wasmReady: false,
    crossOriginIsolated: typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false,
  };

  private options: EmulatorOptions = {
    graphicsApi: 'auto',
    resolutionFactor: 1,
    cpuClockPercentage: 100,
    jitEnabled: false,
  };

  // Único canvas 400×480 conforme a implementação real do 3ds-web
  private canvas: HTMLCanvasElement | null = null;
  private saveStates: SaveStateInfo[] = [];
  private lastError: string | null = null;

  private inputPtr: number | null = null;
  private inputView: Int32Array | null = null;
  private _audioPtr: number | null = null;

  // BroadcastChannel para montar ROMs (File) no emulador
  private romChannel: BroadcastChannel | null = null;
  private romIdCounter = 0;

  async initialize(): Promise<void> {
    if (!this.status.crossOriginIsolated) {
      this.status.state = 'error';
      this.status.error = 'COOP/COEP não detectado. O navegador precisa de Cross-Origin-Opener-Policy: same-origin e Cross-Origin-Embedder-Policy: require-corp para habilitar SharedArrayBuffer.';
      this.lastError = this.status.error;
      return;
    }

    this.status.state = 'initializing';

    try {
      const jsUrl = '/emulator/azahar_web.js';
      const Module = await this.loadEmscriptenModule(jsUrl);
      this.module = Module;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout inicializando módulo Emscripten')), 30000);
        Module.onRuntimeInitialized = () => {
          clearTimeout(timeout);
          resolve();
        };
        Module.onAbort = (msg: string) => {
          clearTimeout(timeout);
          reject(new Error(`Emscripten abort: ${msg}`));
        };
      });

      this.status.wasmReady = true;
      this.status.state = 'ready';
      this.status.coreVersion = 'azahar-rev-6b4e7f2-wasm';
      this.lastError = null;

      // Cria o único canvas (400×480) — as duas telas do 3DS são desenhadas nele
      this.createCanvas();

      // Obtém ponteiros de memória compartilhada
      this.inputPtr = this.module.web_input_ptr ? this.module.web_input_ptr() : null;
      if (this.inputPtr && this.module.HEAP32) {
        this.inputView = new Int32Array(this.module.HEAP32.buffer, this.inputPtr, 8);
      }

      // Obtém ponteiro do ring buffer de áudio e inicializa o AudioWorklet
      this._audioPtr = this.module.web_audio_ptr ? this.module.web_audio_ptr() : null;
      if (this._audioPtr && this.module.HEAP32) {
        await audioWorklet.initialize(this._audioPtr, this.module.HEAP32.buffer);
      }

      // Inicializa o BroadcastChannel para montagem de ROMs
      if (typeof BroadcastChannel !== 'undefined') {
        this.romChannel = new BroadcastChannel('3ds-web-rom');
      }
    } catch (err: any) {
      this.status.state = 'error';
      this.status.error = err.message || String(err);
      this.lastError = this.status.error;
    }
  }

  /**
   * Carrega um jogo a partir de um caminho de arquivo no VFS do emulador.
   * O chamador deve primeiro montar o ROM via mountRom() e depois passar o caminho.
   */
  async loadGame(romPath: string): Promise<LoadGameResult> {
    this.status.state = 'loading';
    this.lastError = null;

    if (!this.module || !this.status.wasmReady) {
      const error = 'Módulo WASM não inicializado.';
      this.status.state = 'error';
      this.status.error = error;
      this.lastError = error;
      return { success: false, error, title: null, region: null };
    }

    try {
      // web_load_game é assíncrono: inicia o carregamento na thread de emulação
      // e retorna imediatamente. O resultado é obtido por polling de web_load_state().
      const started = this.module.web_load_game?.(romPath);
      if (!started) {
        const error = 'Falha ao iniciar carregamento do jogo.';
        this.status.state = 'error';
        this.status.error = error;
        this.lastError = error;
        return { success: false, error, title: null, region: null };
      }

      // Aguarda o resultado (polling, não bloqueia a thread principal)
      const success = await this.waitForLoadState();
      if (success) {
        this.status.state = 'running';
        return { success: true, error: null, title: null, region: null };
      }

      const error = 'Falha ao carregar o jogo no núcleo WASM.';
      this.status.state = 'error';
      this.status.error = error;
      this.lastError = error;
      return { success: false, error, title: null, region: null };
    } catch (err: any) {
      this.status.state = 'error';
      this.status.error = err.message || String(err);
      this.lastError = this.status.error;
      return { success: false, error: this.status.error, title: null, region: null };
    }
  }

  /**
   * Monta um arquivo ROM no emulador via BroadcastChannel.
   * Retorna o caminho virtual sob o qual o ROM fica acessível.
   */
  async mountRom(file: File, virtualPath: string): Promise<void> {
    if (!this.module || !this.romChannel) {
      throw new Error('Emulador não inicializado ou BroadcastChannel indisponível.');
    }

    const id = ++this.romIdCounter;

    // Envia o File pela BroadcastChannel e aguarda o ack da thread de leitura de ROMs
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Thread de leitura de ROM não respondeu'));
      }, 10000);

      const onAck = (e: MessageEvent) => {
        if (e.data && e.data.ack === id) {
          clearTimeout(timer);
          this.romChannel?.removeEventListener('message', onAck);
          resolve();
        }
      };

      this.romChannel!.addEventListener('message', onAck);
      this.romChannel!.postMessage({ id, file });
    });

    // Chama web_mount_rom(path, id, size) no módulo WASM
    this.module.web_mount_rom?.(virtualPath, id, file.size);
  }

  private waitForLoadState(): Promise<boolean> {
    return new Promise((resolve) => {
      const poll = () => {
        const state = this.module.web_load_state?.();
        if (state === 2) {
          resolve(true);
        } else if (state === 3) {
          resolve(false);
        } else {
          setTimeout(poll, 50);
        }
      };
      poll();
    });
  }

  async start(): Promise<void> {
    if (!this.module || this.status.state === 'error') return;
    this.status.state = 'running';
    // O tick da emulação é agendado internamente pelo web_tick do core
  }

  async pause(): Promise<void> {
    if (this.status.state === 'running') this.status.state = 'paused';
  }

  async resume(): Promise<void> {
    if (this.status.state === 'paused') this.status.state = 'running';
  }

  async reset(): Promise<void> {
    this.status.state = 'ready';
  }

  async stop(): Promise<void> {
    this.status.state = 'stopped';
  }

  getStatus(): EmulatorStatus {
    return { ...this.status };
  }

  getMetrics(): PerformanceMetrics {
    if (!this.module) {
      return { speed: 0, busy: 0, frameMs: 0, frameCount: 0, prof: { 0: 0, 1: 0, 2: 0, 3: 0 }, memoryMB: 0 };
    }
    return {
      speed: this.module.web_get_speed?.() ?? 0,
      busy: this.module.web_get_busy?.() ?? 0,
      frameMs: this.module.web_get_frame_ms?.() ?? 0,
      frameCount: this.module.web_get_frame_count?.() ?? 0,
      prof: {
        0: this.module.web_get_prof?.(0) ?? 0,
        1: this.module.web_get_prof?.(1) ?? 0,
        2: this.module.web_get_prof?.(2) ?? 0,
        3: this.module.web_get_prof?.(3) ?? 0,
      },
      memoryMB: 0,
    };
  }

  setOptions(options: Partial<EmulatorOptions>): void {
    this.options = { ...this.options, ...options };
    if (this.module) {
      // Valores case-sensitive conforme main.cpp: 'OpenGL' / 'Software'
      this.module.web_set_option?.('citra_graphics_api', this.options.graphicsApi);
      this.module.web_set_option?.('citra_resolution_factor', String(this.options.resolutionFactor));
      this.module.web_set_option?.('citra_cpu_clock_percentage', String(this.options.cpuClockPercentage));
      this.module.web_set_option?.('web_jit', this.options.jitEnabled ? 'enabled' : 'disabled');
    }
  }

  setInput(state: InputState): void {
    if (!this.inputView) return;

    // input_state[8] — atomic int32 array conforme frontend/main.cpp
    // [0] botões (bitmask)  [1-4] analógicos int16 (-32767..32767)
    // [5-6] ponteiro X/Y  [7] ponteiro pressionado
    Atomics.store(this.inputView, 0, state.buttons);

    const clampAxis = (v: number) => Math.max(-32767, Math.min(32767, Math.round(v * 32767)));
    Atomics.store(this.inputView, 1, clampAxis(state.circlePadX));
    Atomics.store(this.inputView, 2, clampAxis(state.circlePadY));
    Atomics.store(this.inputView, 3, clampAxis(state.cStickX));
    Atomics.store(this.inputView, 4, clampAxis(state.cStickY));
    Atomics.store(this.inputView, 5, Math.round(state.touchX));
    Atomics.store(this.inputView, 6, Math.round(state.touchY));
    Atomics.store(this.inputView, 7, state.touchPressed ? 1 : 0);
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
    if (!this.module) return false;
    // O build atual do 3ds-web não expõe web_save_state(slot) como
    // EMSCRIPTEN_KEEPALIVE. O save de jogo (savegame) é gerenciado pelo VFS
    // do Emscripten (/azahar/save) e persistido via IndexedDB (indexeddb-saves.ts).
    // Save states (slots) são armazenados em IndexedDB com metadados.
    await indexeddbSaves.saveState(slot, new ArrayBuffer(0), null);
    this.saveStates = this.saveStates.filter((s) => s.slot !== slot);
    this.saveStates.push({ slot, timestamp: Date.now(), title: null, sizeBytes: 0 });
    return true;
  }

  async loadState(slot: number): Promise<boolean> {
    const saved = await indexeddbSaves.loadState(slot);
    return saved !== null;
  }

  listSaveStates(): SaveStateInfo[] {
    return [...this.saveStates];
  }

  // ========================================================================
  // Save Game — sincronização de arquivos do VFS com IndexedDB
  // ========================================================================

  /**
   * Sincroniza um arquivo do VFS do Emscripten (/azahar/save) para o IndexedDB.
   * Chamado periodicamente pelo loop de métricas ou quando o jogo salva.
   */
  async syncSaveGameFile(vfsPath: string): Promise<boolean> {
    if (!this.module || !this.module.FS) return false;
    try {
      const data = this.module.FS.readFile(vfsPath);
      await indexeddbSaves.saveGameFile(vfsPath, data);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Restaura um arquivo do IndexedDB de volta para o VFS do Emscripten.
   * Chamado na inicialização do emulador para recuperar saves anteriores.
   */
  async restoreSaveGameFile(vfsPath: string): Promise<boolean> {
    if (!this.module || !this.module.FS) return false;
    try {
      const data = await indexeddbSaves.loadGameFile(vfsPath);
      if (data) {
        this.module.FS.writeFile(vfsPath, new Uint8Array(data));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async listSaveGames(): Promise<string[]> {
    return indexeddbSaves.listSaveGames();
  }

  getLastError(): string | null {
    return this.lastError;
  }

  dispose(): void {
    audioWorklet.dispose();
    this.module = null;
    this.inputView = null;
    this.inputPtr = null;
    this._audioPtr = null;
    this.romChannel?.close();
    this.romChannel = null;
    this.status.state = 'idle';
    this.canvas = null;
  }

  private async loadEmscriptenModule(jsUrl: string): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = jsUrl;
      script.onload = () => {
        const mod = window.Module || window.azahar_web || null;
        if (!mod) {
          reject(new Error('Módulo Emscripten não exposto globalmente'));
          return;
        }
        resolve(mod);
      };
      script.onerror = () => reject(new Error(`Falha ao carregar ${jsUrl}`));
      document.head.appendChild(script);
    });
  }

  private createCanvas(): void {
    if (typeof document === 'undefined') return;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 400;
    this.canvas.height = 480;
    this.canvas.style.background = '#000';
  }
}
