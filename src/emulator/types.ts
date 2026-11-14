/**
 * Tipos do EmulatorAdapter — camada de adaptação independente que isola a UI
 * do núcleo do emulador (WASM/nativo/stub).
 *
 * Esta interface é o contrato entre a plataforma Zelda Web e qualquer
 * implementação de emulador (3ds-web WASM, stub offline, futuro build nativo).
 */

export type Screen = 'top' | 'bottom';

export interface EmulatorStatus {
  /** Estado atual do emulador. */
  state: 'idle' | 'initializing' | 'ready' | 'loading' | 'running' | 'paused' | 'stopped' | 'error';
  /** Último erro registrado, se houver. */
  error: string | null;
  /** Versão do núcleo do emulador, quando disponível. */
  coreVersion: string | null;
  /** Se o WASM está carregado e inicializado. */
  wasmReady: boolean;
  /** Se COOP/COEP está ativo (necessário para SharedArrayBuffer). */
  crossOriginIsolated: boolean;
}

export interface PerformanceMetrics {
  /** Velocidade de emulação em % (100 = velocidade real). */
  speed: number;
  /** % do tempo gasto em retro_run (thread de emulação). */
  busy: number;
  /** Tempo médio por frame em ms (últimos 60 frames). */
  frameMs: number;
  /** Total de frames executados. */
  frameCount: number;
  /** Profiling por slot: 0=GPU, 1=saída de tela, 2=áudio, 3=overhead. */
  prof: Record<number, number>;
  /** Uso de memória estimado em MB. */
  memoryMB: number;
}

export interface InputState {
  /** Máscara de botões (bitmask). */
  buttons: number;
  /** Circle Pad X (-1..1). */
  circlePadX: number;
  /** Circle Pad Y (-1..1). */
  circlePadY: number;
  /** C-Stick X (-1..1). */
  cStickX: number;
  /** C-Stick Y (-1..1). */
  cStickY: number;
  /** Posição X do touch (tela inferior, -32767..32767). */
  touchX: number;
  /** Posição Y do touch (tela inferior, -32767..32767). */
  touchY: number;
  /** Se o touch está pressionado. */
  touchPressed: boolean;
}

export interface SaveStateInfo {
  slot: number;
  timestamp: number;
  title: string | null;
  sizeBytes: number;
}

export interface EmulatorOptions {
  /** API gráfica: 'auto' | 'opengl' | 'software'. */
  graphicsApi: 'auto' | 'opengl' | 'software';
  /** Fator de escala de resolução (1-4). */
  resolutionFactor: number;
  /** Porcentagem de clock da CPU (25-100). */
  cpuClockPercentage: number;
  /** JIT experimental (ligado/desligado). */
  jitEnabled: boolean;
}

export interface LoadGameResult {
  success: boolean;
  error: string | null;
  title: string | null;
  region: string | null;
}

export interface EmulatorAdapter {
  /** Inicializa o núcleo do emulador (carrega WASM, cria contexto, etc.). */
  initialize(): Promise<void>;
  /** Carrega um jogo a partir de um caminho de arquivo no VFS do emulador. */
  loadGame(romPath: string): Promise<LoadGameResult>;
  /** Inicia a emulação. */
  start(): Promise<void>;
  /** Pausa a emulação. */
  pause(): Promise<void>;
  /** Retoma a emulação pausada. */
  resume(): Promise<void>;
  /** Reinicia o jogo carregado. */
  reset(): Promise<void>;
  /** Para a emulação e descarrega o jogo. */
  stop(): Promise<void>;
  /** Obtém o status atual do emulador. */
  getStatus(): EmulatorStatus;
  /** Obtém métricas de desempenho em tempo real. */
  getMetrics(): PerformanceMetrics;
  /** Define opções de vídeo/gráficos. */
  setOptions(options: Partial<EmulatorOptions>): void;
  /** Define o estado de entrada (chamado a cada frame pelo loop de input). */
  setInput(state: InputState): void;
  /** Obtém o elemento canvas único (400×480) do emulador. */
  getCanvas(): HTMLCanvasElement | null;
  /** Obtém o elemento canvas da tela superior. */
  getTopScreenCanvas(): HTMLCanvasElement | null;
  /** Obtém o elemento canvas da tela inferior. */
  getBottomScreenCanvas(): HTMLCanvasElement | null;
  /** Salva o estado em um slot. */
  saveState(slot: number): Promise<boolean>;
  /** Carrega o estado de um slot. */
  loadState(slot: number): Promise<boolean>;
  /** Lista slots de save state disponíveis. */
  listSaveStates(): SaveStateInfo[];
  /** Sincroniza arquivo de save game do VFS para o IndexedDB. */
  syncSaveGameFile(vfsPath: string): Promise<boolean>;
  /** Restaura arquivo de save game do IndexedDB para o VFS. */
  restoreSaveGameFile(vfsPath: string): Promise<boolean>;
  /** Lista caminhos de save games disponíveis no IndexedDB. */
  listSaveGames(): Promise<string[]>;
  /** Obtém o último erro registrado pelo núcleo. */
  getLastError(): string | null;
  /** Libera todos os recursos do emulador. */
  dispose(): void;
}
