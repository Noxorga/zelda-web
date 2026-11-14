import React from 'react';

interface RomLoaderProps {
  onLoad: (romPath: string) => void;
  disabled: boolean;
  status: { state: string; error: string | null };
}

export function RomLoader({ onLoad, disabled, status }: RomLoaderProps) {
  const [fileInfo, setFileInfo] = React.useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileInfo(file.name);
    onLoad(`/roms/${file.name}`);
  };

  const acceptedExtensions = '.3ds,.cia,.cxi,.3dsx';
  const hint =
    'Forneça apenas ROMs .3ds (ou .cia/.cxi/.3dsx) descriptografadas obtidas legalmente a partir de sua própria cópia. ROMs de terceiros não são permitidas.';

  return (
    <div className="rom-loader">
      <div className="rom-loader-header">
        <h2>Carregar Jogo (ROM)</h2>
        <p className="rom-hint">{hint}</p>
      </div>

      <div className="rom-loader-input">
        <input
          type="file"
          accept={acceptedExtensions}
          onChange={handleChange}
          disabled={disabled}
        />
        {fileInfo && <span className="rom-selected">{fileInfo}</span>}
      </div>

      {disabled && status.state === 'error' && (
        <div className="rom-error">
          ⚠️ O emulador não pôde ser inicializado: {status.error}
        </div>
      )}

      {disabled && status.state !== 'error' && status.state !== 'idle' && (
        <div className="rom-info">Aguardando inicialização do emulador...</div>
      )}
    </div>
  );
}
