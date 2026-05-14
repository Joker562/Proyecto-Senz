import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Camera, Upload, X, Eye, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_FILES = 10;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];

interface Photo { id: string; filename: string; originalName: string; mimeType?: string; phase: string; createdAt: string }

interface Props {
  workOrderId: string;
  phase: 'BEFORE' | 'AFTER';
  photos: Photo[];
  onUploaded: () => void;
  onDeleted: (id: string) => void;
  readOnly?: boolean;
}

export default function PhotoUpload({ workOrderId, phase, photos, onUploaded, onDeleted, readOnly }: Props) {
  const { push } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const validateAndFilter = (files: File[]): File[] => {
    const valid: File[] = [];
    for (const file of files) {
      const isImage = file.type.startsWith('image/') || ACCEPTED_IMAGE_TYPES.includes(file.type);
      const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type);
      if (!isImage && !isVideo) {
        push(`"${file.name}" no es un archivo válido (imagen o video MP4/MOV/WebM)`, 'error');
        continue;
      }
      const sizeLimit = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
      const sizeLimitLabel = isVideo ? '100 MB' : '10 MB';
      if (file.size > sizeLimit) {
        push(`"${file.name}" supera el límite de ${sizeLimitLabel}`, 'error');
        continue;
      }
      valid.push(file);
    }
    if (valid.length > MAX_FILES) {
      push(`Máximo ${MAX_FILES} fotos por subida`, 'error');
      return valid.slice(0, MAX_FILES);
    }
    return valid;
  };

  const uploadFiles = async (rawFiles: FileList | File[]) => {
    const arr = validateAndFilter(Array.from(rawFiles));
    if (!arr.length) return;

    setUploading(true);
    try {
      const formData = new FormData();
      arr.forEach((f) => formData.append('photos', f));
      formData.append('phase', phase);
      await api.post(`/photos/${workOrderId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      push(`${arr.length} foto(s) subida(s)`, 'success');
      onUploaded();
    } catch {
      push('Error al subir fotos. Intenta de nuevo.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    uploadFiles(e.dataTransfer.files);
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      uploadFiles(e.target.files);
    }
    // Reset input so the same file can be re-selected after an error
    e.target.value = '';
  };

  const phaseLabel = phase === 'BEFORE' ? 'Antes' : 'Después';
  const phaseColor = phase === 'BEFORE' ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50';

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Camera size={14} />
        Fotos / Video — {phaseLabel}
        <span className="text-muted-foreground font-normal">({photos.length})</span>
      </h4>

      {/* Grid de fotos */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
              {photo.mimeType?.startsWith('video/') ? (
                <video
                  src={`/uploads/${photo.filename}`}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLVideoElement).pause(); (e.currentTarget as HTMLVideoElement).currentTime = 0; }}
                />
              ) : (
                <img
                  src={`/uploads/${photo.filename}`}
                  alt={photo.originalName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {/* Touch-friendly: min 44px target */}
                <button
                  onClick={() => setPreview(`/uploads/${photo.filename}`)}
                  className="w-11 h-11 bg-white/90 rounded-full text-gray-800 hover:bg-white flex items-center justify-center"
                  aria-label="Ver foto"
                >
                  <Eye size={16} />
                </button>
                {!readOnly && (
                  <button
                    onClick={() => onDeleted(photo.id)}
                    className="w-11 h-11 bg-red-500/90 rounded-full text-white hover:bg-red-500 flex items-center justify-center"
                    aria-label="Eliminar foto"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      {!readOnly && (
        <div className="space-y-2">
          {/* Drag-and-drop / file picker */}
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors',
              dragging ? phaseColor : 'border-border hover:border-blue-400 hover:bg-blue-50/30',
              uploading && 'opacity-60 pointer-events-none',
            )}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            {/* Hidden file input — gallery / filesystem */}
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/mp4,video/quicktime,video/webm"
              multiple
              className="hidden"
              onChange={onInput}
            />
            <Upload size={20} className="mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {uploading ? 'Subiendo...' : 'Arrastra o haz clic para subir fotos/video'}
            </p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5 flex items-center justify-center gap-1">
              <AlertCircle size={10} />
              Img: máx. 10 MB · Video MP4/MOV/WebM: máx. 100 MB
            </p>
          </div>

          {/* Camera capture button — separate input with capture attribute for mobile */}
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="flex items-center justify-center gap-2 w-full py-3 min-h-[44px] border rounded-xl text-sm text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
          >
            <Camera size={16} />
            Tomar foto con cámara
          </button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onInput}
          />
        </div>
      )}

      {/* Lightbox */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          {preview.match(/\.(mp4|mov|webm|avi)(\?|$)/i) ? (
            <video
              src={preview}
              controls
              autoPlay
              className="max-w-full max-h-full rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img src={preview} alt="preview" className="max-w-full max-h-full rounded-xl shadow-2xl" />
          )}
          <button
            className="absolute top-4 right-4 w-11 h-11 bg-white/20 rounded-full text-white hover:bg-white/40 flex items-center justify-center"
            onClick={() => setPreview(null)}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
