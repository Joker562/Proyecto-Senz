import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, ChevronRight, Filter, X, Camera, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import type { CapaAction, CapaStatus, CapaSeverity, CapaType, CapaPhoto } from '@/types';

const FONT = 'IBM Plex Sans, sans-serif';
const API_BASE = ((import.meta as unknown as Record<string, Record<string, string>>).env?.VITE_API_URL ?? 'http://localhost:4000') + '/uploads/';

const SEVERITY_LABEL: Record<CapaSeverity, string> = {
  CRITICAL: 'Crítica', MAJOR: 'Mayor', MINOR: 'Menor', OBSERVATION: 'Observación',
};
const SEVERITY_COLOR: Record<CapaSeverity, string> = {
  CRITICAL: '#e74c3c', MAJOR: '#e67e22', MINOR: '#f39c12', OBSERVATION: '#95a5a6',
};
const STATUS_LABEL: Record<CapaStatus, string> = {
  OPEN: 'Abierta', IN_PROGRESS: 'En Proceso', PENDING_VERIFICATION: 'Pend. Verificación', CLOSED: 'Cerrada',
};
const STATUS_COLOR: Record<CapaStatus, string> = {
  OPEN: '#e74c3c', IN_PROGRESS: '#e67e22', PENDING_VERIFICATION: '#2980b9', CLOSED: '#27ae60',
};
const TYPE_LABEL: Record<CapaType, string> = { CORRECTIVE: 'Correctiva', PREVENTIVE: 'Preventiva' };
const TYPE_COLOR: Record<CapaType, string>  = { CORRECTIVE: '#e74c3c',    PREVENTIVE: '#2980b9' };

const M6_LABELS: { key: string; label: string }[] = [
  { key: 'ishikawaMachine',     label: 'Máquina' },
  { key: 'ishikawaMethod',      label: 'Método' },
  { key: 'ishikawaMaterial',    label: 'Material' },
  { key: 'ishikawaManpower',    label: 'Mano de Obra' },
  { key: 'ishikawaEnvironment', label: 'Medio Ambiente' },
  { key: 'ishikawaMeasurement', label: 'Medición' },
];

// ─── Modal de análisis de causa raíz ─────────────────────────────────────────
interface RootCauseModalProps {
  capa: CapaAction;
  onClose: () => void;
  onUpdated: () => void;
}

function RootCauseModal({ capa, onClose, onUpdated }: RootCauseModalProps) {
  const { push } = useToast();
  const [tab, setTab] = useState<'5why' | 'ishikawa' | 'photos'>('5why');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<CapaPhoto[]>(capa.photos ?? []);

  const [whys, setWhys] = useState({
    why1: capa.why1 ?? '', why2: capa.why2 ?? '',
    why3: capa.why3 ?? '', why4: capa.why4 ?? '', why5: capa.why5 ?? '',
  });
  const [ishikawa, setIshikawa] = useState({
    ishikawaMachine:     capa.ishikawaMachine     ?? '',
    ishikawaMethod:      capa.ishikawaMethod      ?? '',
    ishikawaMaterial:    capa.ishikawaMaterial    ?? '',
    ishikawaManpower:    capa.ishikawaManpower     ?? '',
    ishikawaEnvironment: capa.ishikawaEnvironment ?? '',
    ishikawaMeasurement: capa.ishikawaMeasurement ?? '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/audits/capa/${capa.id}`, { ...whys, ...ishikawa });
      push('Análisis guardado', 'success');
      onUpdated();
      onClose();
    } catch { push('Error al guardar', 'error'); } finally { setSaving(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('files', f));
    setUploading(true);
    try {
      const { data } = await api.post<CapaPhoto[]>(`/audits/capa/${capa.id}/photos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPhotos(p => [...p, ...data]);
      push('Foto(s) subidas', 'success');
    } catch { push('Error al subir foto', 'error'); } finally { setUploading(false); }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await api.delete(`/audits/capa/photos/${photoId}`);
      setPhotos(p => p.filter(x => x.id !== photoId));
    } catch { push('Error al eliminar foto', 'error'); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 7,
    fontSize: 13, fontFamily: FONT, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, fontFamily: FONT }}>Análisis de Causa Raíz</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888', fontFamily: FONT }}>{capa.code}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #eee', flexShrink: 0 }}>
          {[
            { id: '5why', label: '5 Por Qués' },
            { id: 'ishikawa', label: 'Diagrama Ishikawa' },
            { id: 'photos', label: `Fotos (${photos.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)} style={{
              flex: 1, padding: '10px 8px', fontFamily: FONT, fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t.id ? '#e67e22' : '#888',
              borderBottom: `2px solid ${tab === t.id ? '#e67e22' : 'transparent'}`,
            }}>{t.label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>

          {/* 5 Por Qués */}
          {tab === '5why' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: '#555', fontFamily: FONT }}>
                Partiendo del problema, pregunta "¿Por qué?" 5 veces consecutivas para llegar a la causa raíz.
              </p>
              {([1, 2, 3, 4, 5] as const).map(n => (
                <div key={n}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4, fontFamily: FONT }}>
                    Por qué #{n}
                  </label>
                  <textarea
                    rows={2}
                    value={whys[`why${n}` as keyof typeof whys]}
                    onChange={e => setWhys(w => ({ ...w, [`why${n}`]: e.target.value }))}
                    placeholder={n === 1 ? '¿Por qué ocurrió el problema?' : `¿Por qué ${n === 2 ? 'el motivo anterior' : 'eso'}?`}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Ishikawa 6M */}
          {tab === 'ishikawa' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: '#555', fontFamily: FONT }}>
                Identifica posibles causas en cada categoría de las 6M que contribuyen al problema.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {M6_LABELS.map(({ key, label }) => (
                  <div key={key} style={{ background: '#f9f9f9', borderRadius: 8, padding: '10px 12px', border: '1px solid #eee' }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#e67e22', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6, fontFamily: FONT }}>
                      {label}
                    </label>
                    <textarea
                      rows={3}
                      value={ishikawa[key as keyof typeof ishikawa]}
                      onChange={e => setIshikawa(i => ({ ...i, [key]: e.target.value }))}
                      placeholder={`Causas relacionadas a ${label.toLowerCase()}…`}
                      style={{ ...inputStyle, background: '#fff', minHeight: 60 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fotos */}
          {tab === 'photos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                border: '2px dashed #ddd', borderRadius: 10, padding: '20px', cursor: 'pointer',
                background: '#fafafa', color: '#888', fontFamily: FONT, fontSize: 13,
              }}>
                <Camera size={18} />
                {uploading ? 'Subiendo…' : 'Seleccionar imágenes o videos'}
                <input type="file" multiple accept="image/*,video/*" style={{ display: 'none' }} onChange={handlePhotoUpload} disabled={uploading} />
              </label>

              {photos.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#bbb', fontSize: 13, fontFamily: FONT, padding: '20px 0' }}>Sin archivos adjuntos</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {photos.map(photo => (
                    <div key={photo.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '1', background: '#f0f0f0', border: '1px solid #eee' }}>
                      {photo.mimeType.startsWith('image/') ? (
                        <img
                          src={`${API_BASE}${photo.filename}`}
                          alt={photo.originalName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 11, color: '#888', fontFamily: FONT, padding: 8, textAlign: 'center' }}>
                          📹 {photo.originalName}
                        </div>
                      )}
                      <button
                        onClick={() => handleDeletePhoto(photo.id)}
                        style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.6)', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <X size={12} color="#fff" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {tab !== 'photos' && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '10px', background: '#e67e22', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600, opacity: saving ? .7 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar Análisis'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal de actualización de estado ────────────────────────────────────────
interface CloseModalProps { capa: CapaAction; onClose: () => void; onUpdated: () => void; }

function CloseCapaModal({ capa, onClose, onUpdated }: CloseModalProps) {
  const { push } = useToast();
  const [status, setStatus]   = useState<CapaStatus>(capa.status === 'OPEN' ? 'IN_PROGRESS' : capa.status === 'IN_PROGRESS' ? 'PENDING_VERIFICATION' : 'CLOSED');
  const [notes, setNotes]     = useState(capa.closingNotes ?? '');
  const [loading, setLoading] = useState(false);

  const nextStatuses: CapaStatus[] = capa.status === 'OPEN'
    ? ['IN_PROGRESS']
    : capa.status === 'IN_PROGRESS'
    ? ['PENDING_VERIFICATION']
    : ['CLOSED'];

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.patch(`/audits/capa/${capa.id}`, { status, closingNotes: notes });
      push('CAPA actualizada', 'success');
      onUpdated();
      onClose();
    } catch { push('Error al actualizar CAPA', 'error'); } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 460, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, fontFamily: FONT }}>Actualizar CAPA</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888', fontFamily: FONT }}>{capa.code}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#f9f9f9', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#444', fontFamily: FONT }}>
            {capa.description}
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', fontFamily: FONT }}>Nuevo estado</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {([...nextStatuses, capa.status === 'PENDING_VERIFICATION' ? 'CLOSED' : null].filter(Boolean) as CapaStatus[]).map(s => (
                <button key={s} type="button" onClick={() => setStatus(s)} style={{
                  padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 500, textAlign: 'left',
                  border: `2px solid ${status === s ? STATUS_COLOR[s] : '#eee'}`,
                  background: status === s ? `${STATUS_COLOR[s]}10` : '#fafafa',
                  color: status === s ? STATUS_COLOR[s] : '#444',
                }}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ margin: '0 0 5px', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', fontFamily: FONT }}>
              {status === 'CLOSED' ? 'Notas de cierre *' : 'Notas de avance'}
            </p>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={status === 'CLOSED' ? 'Describe cómo se resolvió el hallazgo…' : 'Describe el avance realizado…'}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, fontFamily: FONT, resize: 'vertical', minHeight: 80, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>Cancelar</button>
            <button onClick={handleSave} disabled={loading || (status === 'CLOSED' && !notes)} style={{ flex: 2, padding: '10px', background: STATUS_COLOR[status], color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600, opacity: loading ? .7 : 1 }}>
              {loading ? 'Guardando…' : `Marcar como ${STATUS_LABEL[status]}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tarjeta CAPA ─────────────────────────────────────────────────────────────
function CapaCard({ capa, onUpdate }: { capa: CapaAction; onUpdate: () => void }) {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen]           = useState(false);
  const [rootCauseOpen, setRootCauseOpen]   = useState(false);
  const [showAnalysis, setShowAnalysis]     = useState(false);
  const isOverdue = capa.status !== 'CLOSED' && new Date(capa.dueDate) < new Date();
  const sevColor  = SEVERITY_COLOR[capa.severity];
  const typColor  = TYPE_COLOR[capa.type];
  const statColor = STATUS_COLOR[capa.status];

  const hasRootCause = !!(capa.why1 || capa.ishikawaMachine || capa.ishikawaMethod ||
    capa.ishikawaMaterial || capa.ishikawaManpower || capa.ishikawaEnvironment || capa.ishikawaMeasurement);

  return (
    <div style={{ background: '#fff', border: `1.5px solid ${capa.status === 'CLOSED' ? '#e8e8e8' : isOverdue ? '#e74c3c40' : '#eee'}`, borderRadius: 10, padding: '14px 16px', position: 'relative' }}>
      {isOverdue && (
        <div style={{ position: 'absolute', top: 0, right: 0, background: '#e74c3c', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: '0 10px 0 8px', fontFamily: FONT }}>
          VENCIDA
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#aaa', fontFamily: FONT }}>{capa.code}</span>
        <span style={{ background: `${typColor}18`, color: typColor, fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 10, fontFamily: FONT }}>{TYPE_LABEL[capa.type]}</span>
        <span style={{ background: `${sevColor}18`, color: sevColor, fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 10, fontFamily: FONT }}>{SEVERITY_LABEL[capa.severity]}</span>
        <span style={{ background: `${statColor}15`, color: statColor, fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 10, fontFamily: FONT }}>{STATUS_LABEL[capa.status]}</span>
        {hasRootCause && (
          <span style={{ background: '#f0f9f4', color: '#27ae60', fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 10, fontFamily: FONT }}>✓ Análisis registrado</span>
        )}
        {(capa.photos?.length ?? 0) > 0 && (
          <span style={{ background: '#e8f4fd', color: '#2980b9', fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 10, fontFamily: FONT }}>📷 {capa.photos!.length} foto{capa.photos!.length > 1 ? 's' : ''}</span>
        )}
      </div>

      <p style={{ margin: '0 0 10px', fontSize: 14, color: '#1a1a1a', lineHeight: 1.5, fontFamily: FONT }}>{capa.description}</p>

      {capa.rootCause && (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#888', fontFamily: FONT }}>
          <strong>Causa raíz:</strong> {capa.rootCause}
        </p>
      )}

      {/* Análisis 5 Whys expandible */}
      {hasRootCause && (
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => setShowAnalysis(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 12, fontFamily: FONT, padding: 0 }}>
            {showAnalysis ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Ver análisis de causa raíz
          </button>
          {showAnalysis && (
            <div style={{ marginTop: 8, background: '#fafafa', border: '1px solid #eee', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {([1, 2, 3, 4, 5] as const).map(n => {
                const val = capa[`why${n}` as keyof CapaAction] as string | null;
                if (!val) return null;
                return (
                  <div key={n} style={{ fontSize: 12, color: '#444', fontFamily: FONT }}>
                    <strong style={{ color: '#e67e22' }}>¿Por qué #{n}?</strong> {val}
                  </div>
                );
              })}
              {M6_LABELS.some(({ key }) => capa[key as keyof CapaAction]) && (
                <div style={{ borderTop: '1px solid #eee', paddingTop: 8, marginTop: 4 }}>
                  <strong style={{ fontSize: 11, color: '#888', fontFamily: FONT }}>Ishikawa (6M):</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
                    {M6_LABELS.map(({ key, label }) => {
                      const val = capa[key as keyof CapaAction] as string | null;
                      if (!val) return null;
                      return (
                        <div key={key} style={{ fontSize: 11, color: '#555', fontFamily: FONT }}>
                          <strong>{label}:</strong> {val}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#888', fontFamily: FONT, flexWrap: 'wrap', marginBottom: 10 }}>
        <span>
          📋 <button onClick={() => capa.audit && navigate(`/audits/${capa.audit.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2980b9', fontFamily: FONT, fontSize: 12, padding: 0 }}>
            {capa.audit?.code} — {capa.audit?.area}
          </button>
        </span>
        <span>👤 <strong>{capa.assignedTo.name}</strong></span>
        <span style={{ color: isOverdue ? '#e74c3c' : '#888' }}>
          📅 {new Date(capa.dueDate).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {capa.auditItem && (
        <div style={{ background: '#f9f9f9', borderRadius: 7, padding: '6px 10px', marginBottom: 10, fontSize: 12, color: '#666', fontFamily: FONT, borderLeft: '3px solid #eee' }}>
          Ítem: {capa.auditItem.description}
        </div>
      )}

      {capa.closingNotes && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '6px 10px', marginBottom: 10, fontSize: 12, color: '#166534', fontFamily: FONT }}>
          ✓ {capa.closingNotes}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setRootCauseOpen(true)} style={{
          flex: 1, minWidth: 120, padding: '8px', background: '#fff8f0', border: '1.5px solid #e67e22',
          borderRadius: 8, cursor: 'pointer', color: '#e67e22', fontFamily: FONT, fontSize: 12, fontWeight: 600,
        }}>
          🔍 Análisis Causa Raíz
        </button>
        {capa.status !== 'CLOSED' && (
          <button onClick={() => setModalOpen(true)} style={{
            flex: 1, minWidth: 120, padding: '8px', background: '#f0f9f4', border: '1.5px solid #27ae60',
            borderRadius: 8, cursor: 'pointer', color: '#27ae60', fontFamily: FONT, fontSize: 13, fontWeight: 600,
          }}>
            Avanzar estado
          </button>
        )}
        {capa.status === 'CLOSED' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#27ae60', fontSize: 12, fontFamily: FONT }}>
            <CheckCircle2 size={14} /> Cerrada el {capa.closedAt ? new Date(capa.closedAt).toLocaleDateString('es-MX') : '—'}
          </div>
        )}
      </div>

      {modalOpen && <CloseCapaModal capa={capa} onClose={() => setModalOpen(false)} onUpdated={onUpdate} />}
      {rootCauseOpen && <RootCauseModal capa={capa} onClose={() => setRootCauseOpen(false)} onUpdated={onUpdate} />}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AuditFindingsPage() {
  const { push } = useToast();
  const [capas, setCapas]               = useState<CapaAction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterType, setFilterType]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus)   params.set('status', filterStatus);
      if (filterSeverity) params.set('severity', filterSeverity);
      if (filterType)     params.set('type', filterType);
      const { data } = await api.get<CapaAction[]>(`/audits/capa?${params}`);
      setCapas(data);
    } catch { push('Error al cargar hallazgos', 'error'); } finally { setLoading(false); }
  }, [filterStatus, filterSeverity, filterType, push]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const stats = {
    total:    capas.length,
    open:     capas.filter(c => c.status === 'OPEN').length,
    overdue:  capas.filter(c => c.status !== 'CLOSED' && new Date(c.dueDate) < now).length,
    closed:   capas.filter(c => c.status === 'CLOSED').length,
    critical: capas.filter(c => c.severity === 'CRITICAL' && c.status !== 'CLOSED').length,
  };

  const ORDER: CapaStatus[] = ['OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'CLOSED'];
  const sorted = [...capas].sort((a, b) => ORDER.indexOf(a.status as CapaStatus) - ORDER.indexOf(b.status as CapaStatus));

  return (
    <div style={{ padding: '24px', fontFamily: FONT, maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e74c3c18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={18} style={{ color: '#e74c3c' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Hallazgos & CAPA</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Acciones Correctivas y Preventivas de todas las auditorías</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total', value: stats.total, color: '#2980b9', icon: ChevronRight },
          { label: 'Abiertas', value: stats.open, color: '#e74c3c', icon: AlertTriangle },
          { label: 'Vencidas', value: stats.overdue, color: '#c0392b', icon: Clock },
          { label: 'Cerradas', value: stats.closed, color: '#27ae60', icon: CheckCircle2 },
          { label: 'Críticas', value: stats.critical, color: '#e74c3c', icon: AlertTriangle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={15} style={{ color }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Filter size={13} style={{ color: '#bbb' }} />
        {[
          { val: filterStatus, set: setFilterStatus, opts: [['', 'Todos estados'], ['OPEN', 'Abiertas'], ['IN_PROGRESS', 'En Proceso'], ['PENDING_VERIFICATION', 'Pend. Verificación'], ['CLOSED', 'Cerradas']] },
          { val: filterSeverity, set: setFilterSeverity, opts: [['', 'Toda severidad'], ['CRITICAL', 'Crítica'], ['MAJOR', 'Mayor'], ['MINOR', 'Menor'], ['OBSERVATION', 'Observación']] },
          { val: filterType, set: setFilterType, opts: [['', 'Todos tipos'], ['CORRECTIVE', 'Correctiva'], ['PREVENTIVE', 'Preventiva']] },
        ].map(({ val, set, opts }) => (
          <select key={opts[0][1]} value={val} onChange={e => set(e.target.value)} style={{ padding: '7px 10px', border: '1px solid #eee', borderRadius: 7, fontSize: 12, fontFamily: FONT, outline: 'none', background: '#fff' }}>
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        {(filterStatus || filterSeverity || filterType) && (
          <button onClick={() => { setFilterStatus(''); setFilterSeverity(''); setFilterType(''); }} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#e74c3c', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT }}>
            <X size={12} /> Limpiar
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#bbb' }}>Cargando…</div>
      ) : sorted.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', background: '#fff', border: '1px solid #eee', borderRadius: 10 }}>
          <CheckCircle2 size={36} style={{ color: '#27ae60', marginBottom: 12 }} />
          <p style={{ margin: 0, color: '#888', fontFamily: FONT, fontSize: 14 }}>
            {filterStatus || filterSeverity || filterType ? 'Sin hallazgos con estos filtros' : '¡Sin hallazgos abiertos! Todo en orden.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(c => <CapaCard key={c.id} capa={c} onUpdate={load} />)}
        </div>
      )}
    </div>
  );
}
