import React, { useState } from 'react';
import { EmulatorAdapter, EmulatorStatus, SaveStateInfo } from '../emulator/types';

interface ControlPanelProps {
  status: EmulatorStatus;
  adapter: EmulatorAdapter;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onKeyUp: (e: React.KeyboardEvent) => void;
}

export function ControlPanel({ status, adapter, onKeyDown, onKeyUp }: ControlPanelProps) {
  const isRunning = status.state === 'running';
  const isPaused = status.state === 'paused';
  const isError = status.state === 'error';
  const [saveSlot, setSaveSlot] = useState(0);
  const [saveFeedback, setSaveFeedback] = useState<{ slot: number; message: string; type: 'ok' | 'error' } | null>(null);

  const handleStart = async () => {
    if (isPaused) {
      await adapter.resume();
    } else {
      await adapter.start();
    }
  };

  const handlePause = async () => {
    await adapter.pause();
  };

  const handleReset = async () => {
    await adapter.reset();
  };

  const handleStop = async () => {
    await adapter.stop();
  };

  const handleSaveState = async () => {
    try {
      const ok = await adapter.saveState(saveSlot);
      setSaveFeedback({ slot: saveSlot, message: ok ? 'Salvo com sucesso' : 'Falha ao salvar', type: ok ? 'ok' : 'error' });
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (err: any) {
      setSaveFeedback({ slot: saveSlot, message: err.message || 'Erro ao salvar', type: 'error' });
      setTimeout(() => setSaveFeedback(null), 3000);
    }
  };

  const handleLoadState = async () => {
    try {
      const ok = await adapter.loadState(saveSlot);
      setSaveFeedback({ slot: saveSlot, message: ok ? 'Carregado com sucesso' : 'Nenhum save neste slot', type: ok ? 'ok' : 'error' });
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (err: any) {
      setSaveFeedback({ slot: saveSlot, message: err.message || 'Erro ao carregar', type: 'error' });
      setTimeout(() => setSaveFeedback(null), 3000);
    }
  };

  const saveStates: SaveStateInfo[] = adapter.listSaveStates();

  return (
    <div className="control-panel" onKeyDown={onKeyDown} onKeyUp={onKeyUp} tabIndex={-1}>
      <div className="control-group">
        <button className="btn" onClick={handleStart} disabled={isError || isRunning}>
          {isPaused ? 'Retomar' : 'Iniciar'}
        </button>
        <button className="btn" onClick={handlePause} disabled={isError || !isRunning || isPaused}>
          Pausar
        </button>
        <button className="btn" onClick={handleReset} disabled={isError || status.state === 'idle'}>
          Reiniciar
        </button>
        <button className="btn btn-stop" onClick={handleStop} disabled={isError || status.state === 'stopped'}>
          Parar
        </button>
      </div>

      <div className="control-group save-state-group">
        <label className="save-slot-label">Save State:</label>
        <select
          className="btn save-slot-select"
          value={saveSlot}
          onChange={(e) => setSaveSlot(parseInt(e.target.value, 10))}
          disabled={isError}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => (
            <option key={s} value={s}>
              Slot {s}{saveStates.some((ss) => ss.slot === s) ? ' •' : ''}
            </option>
          ))}
        </select>
        <button className="btn" onClick={handleSaveState} disabled={isError}>
          Salvar
        </button>
        <button className="btn" onClick={handleLoadState} disabled={isError}>
          Carregar
        </button>
      </div>

      {saveFeedback && (
        <div className={`save-feedback ${saveFeedback.type}`}>
          {saveFeedback.type === 'ok' ? '✓' : '⚠️'} Slot {saveFeedback.slot}: {saveFeedback.message}
        </div>
      )}

      <div className="control-group control-hints">
        <span className="hint">Teclado:</span>
        <span className="hint">A=X B=Z X=S Y=A</span>
        <span className="hint">L=Q R=W ZL=1 ZR=2</span>
        <span className="hint">START=Enter SELECT=Backspace HOME=Esc</span>
        <span className="hint">D-pad/Circle Pad: setas</span>
        <span className="hint">Gamepad API: detectado automaticamente</span>
        <span className="hint">Touch: tela inferior</span>
      </div>

      {isError && (
        <div className="control-error">
          ⚠️ {status.error || 'Erro desconhecido do emulador'}
        </div>
      )}
    </div>
  );
}
