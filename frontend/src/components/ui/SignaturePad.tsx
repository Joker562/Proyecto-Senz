import { useRef, useEffect, useState } from 'react';
import SignaturePadLib from 'signature_pad';
import { Trash2, Check } from 'lucide-react';

interface Props {
  onSave: (data: string) => void;
  onCancel: () => void;
}

export default function SignaturePad({ onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    padRef.current = new SignaturePadLib(canvas, {
      backgroundColor: 'rgb(255,255,255)',
      penColor: '#1e3a5f',
    });
    padRef.current.addEventListener('endStroke', () => setIsEmpty(padRef.current!.isEmpty()));
    return () => padRef.current?.off();
  }, []);

  const clear = () => { padRef.current?.clear(); setIsEmpty(true); };

  const save = () => {
    if (!padRef.current || padRef.current.isEmpty()) return;
    onSave(padRef.current.toDataURL('image/png'));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Firme en el recuadro para confirmar conformidad:</p>
      <div className="border-2 border-dashed border-border rounded-xl overflow-hidden bg-white" style={{ height: 180 }}>
        <canvas ref={canvasRef} className="w-full h-full touch-none" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-muted transition-colors">
          Cancelar
        </button>
        <button onClick={clear} className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:bg-muted transition-colors">
          <Trash2 size={14} /> Limpiar
        </button>
        <button
          onClick={save} disabled={isEmpty}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-40 transition-colors font-medium"
        >
          <Check size={14} /> Firmar y cerrar OT
        </button>
      </div>
    </div>
  );
}
