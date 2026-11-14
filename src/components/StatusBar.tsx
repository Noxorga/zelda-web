import { EmulatorStatus, PerformanceMetrics } from '../emulator/types';

interface StatusBarProps {
  status: EmulatorStatus;
  metrics: PerformanceMetrics;
}

export function StatusBar({ status, metrics }: StatusBarProps) {
  const stateLabels: Record<string, string> = {
    idle: 'Ocioso',
    initializing: 'Inicializando...',
    ready: 'Pronto',
    loading: 'Carregando...',
    running: 'Executando',
    paused: 'Pausado',
    stopped: 'Parado',
    error: 'Erro',
  };

  return (
    <div className="status-bar">
      <div className="status-item">
        <span className="status-label">Estado:</span>
        <span className={`status-value state-${status.state}`}>{stateLabels[status.state] || status.state}</span>
      </div>

      <div className="status-divider" />

      <div className="status-item">
        <span className="status-label">WASM:</span>
        <span className={`status-value ${status.wasmReady ? 'ok' : 'off'}`}>
          {status.wasmReady ? 'Pronto' : 'Não carregado'}
        </span>
      </div>

      <div className="status-divider" />

      <div className="status-item">
        <span className="status-label">COOP/COEP:</span>
        <span className={`status-value ${status.crossOriginIsolated ? 'ok' : 'off'}`}>
          {status.crossOriginIsolated ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      <div className="status-divider" />

      <div className="status-item">
        <span className="status-label">Velocidade:</span>
        <span className="status-value">{metrics.speed.toFixed(0)}%</span>
      </div>

      <div className="status-divider" />

      <div className="status-item">
        <span className="status-label">Frame:</span>
        <span className="status-value">{metrics.frameMs.toFixed(1)} ms</span>
      </div>

      <div className="status-divider" />

      <div className="status-item">
        <span className="status-label">Frames:</span>
        <span className="status-value">{metrics.frameCount}</span>
      </div>

      <div className="status-divider" />

      <div className="status-item">
        <span className="status-label">Ocupação:</span>
        <span className="status-value">{metrics.busy.toFixed(0)}%</span>
      </div>
    </div>
  );
}
