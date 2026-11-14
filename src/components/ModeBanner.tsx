interface ModeBannerProps {
  mode: 'demo' | 'real';
  emulatorReady: boolean;
  onPlayNow: () => void;
  wasmReady: boolean;
  crossOriginIsolated: boolean;
}

export function ModeBanner({
  mode,
  emulatorReady,
  onPlayNow,
  wasmReady,
  crossOriginIsolated,
}: ModeBannerProps) {
  const isDemo = mode === 'demo';

  return (
    <div className="mode-banner">
      <div className="mode-banner-content">
        <span className={`mode-indicator ${isDemo ? 'demo' : 'real'}`}>
          {isDemo ? '● MODO DEMO' : '● MODO REAL'}
        </span>

        <div className="mode-status">
          <span className={`status-dot ${wasmReady ? 'ok' : 'off'}`}></span>
          <span>WASM: {wasmReady ? 'carregado' : 'não carregado'}</span>
          <span className={`status-dot ${crossOriginIsolated ? 'ok' : 'off'}`}></span>
          <span>COOP/COEP: {crossOriginIsolated ? 'ativo' : 'inativo'}</span>
        </div>

        {!emulatorReady && (
          <span className="mode-loading">Inicializando emulador…</span>
        )}

        {isDemo && emulatorReady && (
          <button className="btn-play" onClick={onPlayNow}>
            Jogar Agora
          </button>
        )}
      </div>

      {isDemo && emulatorReady && (
        <div className="demo-notice">
          ⚠️ Nenhum arquivo de jogo (ROM) está distribuído por esta plataforma
          sem autorização expressa dos titulares de direitos autorais.
        </div>
      )}
    </div>
  );
}
