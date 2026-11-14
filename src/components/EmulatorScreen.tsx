import { useEffect, useRef } from 'react';

interface EmulatorScreenProps {
  canvas: HTMLCanvasElement | null;
  label: string;
  className?: string;
}

export function EmulatorScreen({ canvas, label, className }: EmulatorScreenProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !canvas) return;
    // Limpa o container e anexa o canvas do emulador
    canvasRef.current.innerHTML = '';
    canvasRef.current.appendChild(canvas);
    return () => {
      if (canvasRef.current) {
        canvasRef.current.innerHTML = '';
      }
    };
  }, [canvas]);

  return (
    <div className={`emulator-screen ${className || ''}`}>
      <div className="screen-label">{label}</div>
      <div className="screen-frame" ref={canvasRef} />
    </div>
  );
}
