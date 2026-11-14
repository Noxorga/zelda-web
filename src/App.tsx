import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EmulatorAdapter, EmulatorStatus, PerformanceMetrics, InputState, LoadGameResult } from './emulator/types';
import { createEmulatorAdapter } from './emulator/factory';
import { EmulatorScreen } from './components/EmulatorScreen';
import { ControlPanel } from './components/ControlPanel';
import { StatusBar } from './components/StatusBar';
import { RomLoader } from './components/RomLoader';
import { ModeBanner } from './components/ModeBanner';
import { LegalNotice } from './components/LegalNotice';

type AppMode = 'demo' | 'real';

export default function App() {
  const [adapter, setAdapter] = useState<EmulatorAdapter | null>(null);
  const [status, setStatus] = useState<EmulatorStatus>({
    state: 'idle',
    error: null,
    coreVersion: null,
    wasmReady: false,
    crossOriginIsolated: typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false,
  });
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    speed: 0,
    busy: 0,
    frameMs: 0,
    frameCount: 0,
    prof: { 0: 0, 1: 0, 2: 0, 3: 0 },
    memoryMB: 0,
  });
  const [loadResult, setLoadResult] = useState<LoadGameResult | null>(null);
  const [mode, setMode] = useState<AppMode>('demo');
  const [emulatorReady, setEmulatorReady] = useState(false);

  const adapterRef = useRef<EmulatorAdapter | null>(null);
  const rafRef = useRef<number | null>(null);

  // Caminhos de save game do VFS do 3ds-web (salvamentos do jogo no VFS)
  const SAVE_GAME_VFS_PATHS = [
    '/azahar/save/save.dat',
    '/azahar/save/save.bin',
  ];

  // Inicializa o adaptador (stub ou WASM) — agora assíncrono
  useEffect(() => {
    const init = async () => {
      try {
        const ad = await createEmulatorAdapter();
        setAdapter(ad);
        adapterRef.current = ad;

        await ad.initialize();
        setEmulatorReady(true);

        // Restaura save games do IndexedDB para o VFS após inicialização
        try {
          for (const vfsPath of SAVE_GAME_VFS_PATHS) {
            const restored = await ad.restoreSaveGameFile(vfsPath);
            if (restored) {
              console.log(`Save game restaurado: ${vfsPath}`);
            }
          }
        } catch (err: any) {
          console.warn('Falha ao restaurar save games:', err.message);
        }
      } catch (err: any) {
        setStatus((s) => ({ ...s, state: 'error', error: err.message || String(err) }));
        setEmulatorReady(false);
      }

      // Loop de métricas + sincronização periódica de save games
      let lastSync = 0;
      const tick = () => {
        if (!adapterRef.current) return;
        const st = adapterRef.current.getStatus();
        const mt = adapterRef.current.getMetrics();
        setStatus(st);
        setMetrics(mt);

        // Sincroniza save games do VFS para o IndexedDB a cada ~5 segundos
        const now = Date.now();
        if (now - lastSync > 5000 && st.state === 'running') {
          lastSync = now;
          (async () => {
            for (const vfsPath of SAVE_GAME_VFS_PATHS) {
              try {
                await adapterRef.current!.syncSaveGameFile(vfsPath);
              } catch {
                // Silencioso — save pode não existir ainda
              }
            }
          })();
        }

        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };
    init();

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      adapterRef.current?.dispose();
    };
  }, []);

  // Mapeamento de teclado para controles do 3DS (conforme 3ds-web web/index.html)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<Element>) => {
      if (!adapterRef.current) return;
      const input = buildInputFromKey(e.key, true);
      adapterRef.current.setInput(input);
    },
    [],
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<Element>) => {
      if (!adapterRef.current) return;
      const input = buildInputFromKey(e.key, false);
      adapterRef.current.setInput(input);
    },
    [],
  );

  // Gamepad API
  useEffect(() => {
    if (!adapterRef.current) return;
    const gamepadTick = () => {
      const gamepads = (navigator as any).getGamepads ? (navigator as any).getGamepads() : [];
      const gp = gamepads[0];
      if (gp && adapterRef.current) {
        const input: InputState = {
          buttons: 0,
          circlePadX: gp.axes[0] ?? 0,
          circlePadY: gp.axes[1] ?? 0,
          cStickX: gp.axes[2] ?? 0,
          cStickY: gp.axes[3] ?? 0,
          touchX: 0,
          touchY: 0,
          touchPressed: false,
        };
        // Mapeamento de gamepad padrão para 3DS (conforme 3ds-web)
        // Posição: B=0, A=1, Y=2, X=3, L=4, R=5, ZL=6, ZR=7, SELECT=8, START=9, HOME=10
        if (gp.buttons[1]?.pressed) input.buttons |= 1 << 8;  // A (botão 1 do gamepad)
        if (gp.buttons[0]?.pressed) input.buttons |= 1 << 0;  // B (botão 0)
        if (gp.buttons[3]?.pressed) input.buttons |= 1 << 9;  // X (botão 3)
        if (gp.buttons[2]?.pressed) input.buttons |= 1 << 1; // Y (botão 2)
        if (gp.buttons[4]?.pressed) input.buttons |= 1 << 10; // L (botão 4)
        if (gp.buttons[5]?.pressed) input.buttons |= 1 << 11; // R (botão 5)
        if (gp.buttons[6]?.pressed) input.buttons |= 1 << 12; // ZL (botão 6)
        if (gp.buttons[7]?.pressed) input.buttons |= 1 << 13; // ZR (botão 7)
        if (gp.buttons[9]?.pressed) input.buttons |= 1 << 3;  // START (botão 9)
        if (gp.buttons[8]?.pressed) input.buttons |= 1 << 2;  // SELECT (botão 8)
        if (gp.buttons[10]?.pressed) input.buttons |= 1 << 14; // HOME (botão 10)
        adapterRef.current.setInput(input);
      }
      rafRef.current = requestAnimationFrame(gamepadTick);
    };
    rafRef.current = requestAnimationFrame(gamepadTick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Touch events para tela inferior (único canvas 400×480)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!adapterRef.current) return;
      const touch = e.touches[0];
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const x = ((touch.clientX - rect.left) / rect.width) * 65534 - 32767;
      const y = ((touch.clientY - rect.top) / rect.height) * 65534 - 32767;
      adapterRef.current.setInput({
        buttons: 0,
        circlePadX: 0,
        circlePadY: 0,
        cStickX: 0,
        cStickY: 0,
        touchX: x,
        touchY: y,
        touchPressed: true,
      });
    },
    [],
  );

  const handleTouchEnd = useCallback(() => {
    if (!adapterRef.current) return;
    adapterRef.current.setInput({
      buttons: 0,
      circlePadX: 0,
      circlePadY: 0,
      cStickX: 0,
      cStickY: 0,
      touchX: 0,
      touchY: 0,
      touchPressed: false,
    });
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!adapterRef.current) return;
      const touch = e.touches[0];
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const x = ((touch.clientX - rect.left) / rect.width) * 65534 - 32767;
      const y = ((touch.clientY - rect.top) / rect.height) * 65534 - 32767;
      adapterRef.current.setInput({
        buttons: 0,
        circlePadX: 0,
        circlePadY: 0,
        cStickX: 0,
        cStickY: 0,
        touchX: x,
        touchY: y,
        touchPressed: true,
      });
    },
    [],
  );

  // Carrega um jogo a partir de um caminho no VFS do emulador (não File)
  const handleRomLoad = useCallback(
    async (romPath: string) => {
      if (!adapterRef.current) return;
      const result = await adapterRef.current.loadGame(romPath);
      setLoadResult(result);
      if (result.success) {
        // Restaura save games do IndexedDB para o VFS após carregar o ROM
        for (const vfsPath of SAVE_GAME_VFS_PATHS) {
          try {
            const restored = await adapterRef.current.restoreSaveGameFile(vfsPath);
            if (restored) {
              console.log(`Save game restaurado após carregar ROM: ${vfsPath}`);
            }
          } catch {
            // Silencioso — save pode não existir ainda
          }
        }
        await adapterRef.current.start();
      }
    },
    [],
  );

  // Ação "Jogar Agora" — inicializa o emulador no modo DEMO (sem ROM)
  const handlePlayNow = useCallback(async () => {
    setMode('demo');
    // Em modo DEMO, o emulador já está inicializado; apenas indica que está pronto
    // sem carregar nenhum jogo (sem distribuição de ROM não autorizada).
  }, []);

  const buildInputFromKey = (key: string, pressed: boolean): InputState => {
    const base: InputState = {
      buttons: 0,
      circlePadX: 0,
      circlePadY: 0,
      cStickX: 0,
      cStickY: 0,
      touchX: 0,
      touchY: 0,
      touchPressed: false,
    };
    // Mapeamento de teclado conforme 3ds-web web/index.html:
    // A=X  B=Z  X=S  Y=A  L=Q  R=W  ZL=1  ZR=2  START=Enter  SELECT=Backspace  HOME=Esc
    const keyMap: Record<string, number> = {
      x: 1 << 8,  // A (bit 8)
      z: 1 << 0,  // B (bit 0)
      s: 1 << 9,  // X (bit 9)
      a: 1 << 1,  // Y (bit 1)
      q: 1 << 10, // L (bit 10)
      w: 1 << 11, // R (bit 11)
      '1': 1 << 12, // ZL (bit 12)
      '2': 1 << 13, // ZR (bit 13)
      enter: 1 << 3,  // START (bit 3)
      backspace: 1 << 2, // SELECT (bit 2)
      escape: 1 << 14, // HOME (bit 14)
    };
    const bit = keyMap[key.toLowerCase()];
    if (bit !== undefined) {
      if (pressed) base.buttons |= bit;
    }
    // D-pad: T=up  G=down  F=left  H=right (conforme 3ds-web)
    // Circle Pad (Slide Pad): setas direcionais
    if (key.toLowerCase() === 't' || key.toLowerCase() === 'arrowup') {
      base.circlePadY = pressed ? -1 : 0;
    }
    if (key.toLowerCase() === 'g' || key.toLowerCase() === 'arrowdown') {
      base.circlePadY = pressed ? 1 : 0;
    }
    if (key.toLowerCase() === 'f' || key.toLowerCase() === 'arrowleft') {
      base.circlePadX = pressed ? -1 : 0;
    }
    if (key.toLowerCase() === 'h' || key.toLowerCase() === 'arrowright') {
      base.circlePadX = pressed ? 1 : 0;
    }
    return base;
  };

  if (!adapter) {
    return (
      <div className="app-loading">
        Inicializando adaptador do emulador…
      </div>
    );
  }

  const isRunning = status.state === 'running';
  const isDemoMode = mode === 'demo';

  return (
    <div className="app">
      <header className="app-header">
        <h1>Zelda Web</h1>
        <span className="mode-badge">
          {isDemoMode ? 'MODO DEMO' : 'MODO REAL'}
        </span>
      </header>

      <ModeBanner
        mode={mode}
        emulatorReady={emulatorReady}
        onPlayNow={handlePlayNow}
        wasmReady={status.wasmReady}
        crossOriginIsolated={status.crossOriginIsolated}
      />

      <StatusBar status={status} metrics={metrics} />

      <main className="app-main">
        {isDemoMode && (
          <div className="demo-panel">
            <h2>Ocarina of Time 3D — Emulação no Navegador</h2>
            <p>
              O emulador WASM foi carregado e está executando localmente no
              seu navegador. Nenhum arquivo de jogo (ROM) está distribuído por
              esta plataforma sem autorização expressa dos titulares de direitos.
            </p>
            <button className="btn btn-primary" onClick={handlePlayNow} disabled={!emulatorReady || isRunning}>
              {isRunning ? 'Emulador em execução' : 'Jogar Agora'}
            </button>
            <LegalNotice />
          </div>
        )}

        {!isDemoMode && (
          <>
            <RomLoader
              onLoad={handleRomLoad}
              disabled={status.state === 'error' || !emulatorReady}
              status={status}
            />

            <div
              className="screens"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <EmulatorScreen
                canvas={adapter.getCanvas()}
                label="Tela (3DS)"
                className="screen-single"
              />
            </div>

            <ControlPanel
              status={status}
              adapter={adapter}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
            />
          </>
        )}

        {loadResult && (
          <div className="load-result">
            {loadResult.success
              ? `Jogo carregado: ${loadResult.title || 'desconhecido'} (${loadResult.region || '??'})`
              : `Erro ao carregar: ${loadResult.error}`}
          </div>
        )}
      </main>
    </div>
  );
}
