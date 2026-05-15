import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronDown, ChevronUp, CheckCircle2, XCircle, MinusCircle,
  AlertTriangle, Play, CheckCheck, User, X, Plus, Clock, FileDown,
  Camera, Trash2,
} from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { exportAuditPDF } from '@/lib/pdfExport';
import { mockAudits, mockUsers } from '@/data/mockData';
import type { Audit, AuditSection, AuditItem, AuditResult, CapaSeverity, CapaType } from '@/types';

const FONT = 'IBM Plex Sans, sans-serif';
const ACCENT = '#27ae60';

// ─── Mock sections (fallback sin backend) ────────────────────────────────────
function buildMock5SSections(): AuditSection[] {
  const mk = (id: string, order: number, desc: string): AuditItem => ({
    id, order, description: desc, weight: 1, result: null, notes: null, checkedAt: null,
  });
  return [
    { id: 's1', order: 1, name: 'Clasificar (Seiri)', isBehavior: false, weight: 20, items: [
      mk('i1', 1, 'Materiales innecesarios han sido identificados y retirados del área de trabajo'),
      mk('i2', 2, 'Herramientas obsoletas o dañadas están marcadas para eliminación'),
      mk('i3', 3, 'Solo el equipo necesario está presente en el área'),
    ]},
    { id: 's2', order: 2, name: 'Ordenar (Seiton)', isBehavior: false, weight: 20, items: [
      mk('i4', 1, 'Cada artículo tiene un lugar definido y señalizado correctamente'),
      mk('i5', 2, 'Las herramientas están organizadas y de fácil acceso'),
      mk('i6', 3, 'Los pasillos están completamente despejados y señalizados'),
    ]},
    { id: 's3', order: 3, name: 'Limpiar (Seiso)', isBehavior: false, weight: 20, items: [
      mk('i7', 1, 'El área se mantiene limpia al finalizar cada turno'),
      mk('i8', 2, 'Los equipos están limpios y libres de residuos'),
      mk('i9', 3, 'Los registros de limpieza están actualizados y visibles'),
    ]},
    { id: 's4', order: 4, name: 'Estandarizar (Seiketsu)', isBehavior: false, weight: 20, items: [
      mk('i10', 1, 'Existen estándares visuales actualizados en el área'),
      mk('i11', 2, 'Los procedimientos de 5S están documentados y publicados'),
    ]},
    { id: 's5', order: 5, name: 'Disciplina (Shitsuke)', isBehavior: true, weight: 20, items: [
      mk('i12', 1, 'El personal demuestra conocimiento y aplicación de los estándares 5S'),
      mk('i13', 2, 'Se realizan revisiones de seguimiento de forma regular y documentada'),
    ]},
  ];
}

function buildMockProcessSections(): AuditSection[] {
  const mk = (id: string, order: number, desc: string): AuditItem => ({
    id, order, description: desc, weight: 1, result: null, notes: null, checkedAt: null,
  });
  return [
    { id: 's1', order: 1, name: 'Documentación y Procedimientos', isBehavior: false, weight: 25, items: [
      mk('i1', 1, 'Los procedimientos operativos están actualizados y disponibles en el área'),
      mk('i2', 2, 'El personal conoce y sigue los procedimientos establecidos'),
    ]},
    { id: 's2', order: 2, name: 'Calidad del Proceso', isBehavior: false, weight: 25, items: [
      mk('i3', 1, 'Los parámetros de proceso se encuentran dentro de los rangos establecidos'),
      mk('i4', 2, 'Los controles de calidad se realizan en los puntos definidos'),
      mk('i5', 3, 'Los registros de producción están completos y correctamente llenados'),
    ]},
    { id: 's3', order: 3, name: 'Seguridad y EPP', isBehavior: true, weight: 25, items: [
      mk('i6', 1, 'El personal utiliza el equipo de protección personal requerido'),
      mk('i7', 2, 'Las zonas de riesgo están identificadas y señalizadas correctamente'),
    ]},
    { id: 's4', order: 4, name: 'Mantenimiento y Equipo', isBehavior: false, weight: 25, items: [
      mk('i8', 1, 'Los equipos tienen su mantenimiento preventivo al día'),
      mk('i9', 2, 'No existen equipos con fallas reportadas sin atender'),
    ]},
  ];
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', IN_PROGRESS: 'En Curso', COMPLETED: 'Completada', CLOSED: 'Cerrada',
};
const TYPE_LABEL: Record<string, string> = { FIVE_S: '5S', PROCESS: 'Procesos' };

// ─── Modal CAPA ───────────────────────────────────────────────────────────────
interface CapaModalProps {
  auditId: string;
  auditItemId: string;
  itemDescription: string;
  onClose: () => void;
  onCreated: () => void;
  isMock?: boolean;
}

const WHY_PLACEHOLDERS = [
  '¿Por qué ocurrió el incumplimiento?',
  '¿Por qué ocurrió eso?',
  '¿Por qué ocurrió eso?',
  '¿Por qué ocurrió eso?',
  '¿Cuál es la causa raíz profunda?',
];

const ISHIKAWA_CATS = [
  { key: 'ishikawaMachine',     label: 'Máquina / Equipo',   emoji: '⚙️' },
  { key: 'ishikawaMethod',      label: 'Método / Proceso',   emoji: '📋' },
  { key: 'ishikawaMaterial',    label: 'Material / Insumo',  emoji: '📦' },
  { key: 'ishikawaManpower',    label: 'Mano de Obra',       emoji: '👷' },
  { key: 'ishikawaEnvironment', label: 'Medio Ambiente',     emoji: '🌡️' },
] as const;

function CapaModal({ auditId, auditItemId, itemDescription, onClose, onCreated, isMock }: CapaModalProps) {
  const { push } = useToast();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [createdCapaId, setCreatedCapaId] = useState<string | null>(null);
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
  const [form, setForm] = useState({
    type: 'CORRECTIVE' as CapaType,
    severity: 'MINOR' as CapaSeverity,
    description: '',
    rootCause: '',
    assignedToId: '',
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    why1: '', why2: '', why3: '', why4: '', why5: '',
    ishikawaMachine: '', ishikawaMethod: '', ishikawaMaterial: '',
    ishikawaManpower: '', ishikawaEnvironment: '',
  });

  useEffect(() => {
    api.get<{ id: string; name: string }[]>('/users')
      .then(r => setUsers(r.data))
      .catch(() => setUsers(mockUsers.map(u => ({ id: String(u.id), name: u.name }))));
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.assignedToId || !form.description) { push('Completa todos los campos obligatorios', 'error'); return; }
    setLoading(true);
    try {
      if (isMock) {
        // Modo sin backend: simular creación localmente
        const fakeId = `mock-capa-${Date.now()}`;
        setCreatedCapaId(fakeId);
        push('Acción CAPA registrada (modo demo)', 'success');
        onCreated();
        if (!showEvidence) { onClose(); }
      } else {
        const res = await api.post<{ id: string }>(`/audits/${auditId}/capa`, {
          ...form,
          auditItemId,
          dueDate: new Date(form.dueDate).toISOString(),
        });
        setCreatedCapaId(res.data.id);
        push('Acción CAPA creada — se notificó al responsable por correo', 'success');
        onCreated();
        if (!showEvidence) { onClose(); }
      }
    } catch {
      push('Error al crear CAPA', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !createdCapaId) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await api.post<{ photos: string[] }>(`/audits/capa/${createdCapaId}/evidence`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEvidencePhotos(res.data.photos);
      push('Foto subida', 'success');
    } catch {
      push('Error al subir foto', 'error');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handlePhotoDelete = async (url: string) => {
    if (!createdCapaId) return;
    try {
      const res = await api.delete<{ photos: string[] }>(`/audits/capa/${createdCapaId}/evidence`, { data: { url } });
      setEvidencePhotos(res.data.photos);
    } catch {
      push('Error al eliminar foto', 'error');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8,
    fontSize: 13, fontFamily: FONT, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px',
    fontFamily: FONT, display: 'block', marginBottom: 4,
  };
  const SEVER_COLORS: Record<CapaSeverity, string> = {
    CRITICAL: '#e74c3c', MAJOR: '#e67e22', MINOR: '#f39c12', OBSERVATION: '#95a5a6',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 600, maxHeight: '92vh', overflow: 'auto', padding: '0 0 24px' }}>
        <div style={{ position: 'sticky', top: 0, background: '#fff', padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, fontFamily: FONT }}>Nueva Acción CAPA</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888', fontFamily: FONT }}>Hallazgo: {itemDescription.slice(0, 60)}…</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Tipo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(['CORRECTIVE', 'PREVENTIVE'] as CapaType[]).map(t => (
              <button key={t} type="button" onClick={() => set('type', t)} style={{
                padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 600,
                border: `2px solid ${form.type === t ? '#e67e22' : '#eee'}`,
                background: form.type === t ? '#e67e2215' : '#fafafa',
                color: form.type === t ? '#e67e22' : '#888',
              }}>
                {t === 'CORRECTIVE' ? '🔧 Correctiva' : '🛡 Preventiva'}
              </button>
            ))}
          </div>

          {/* Severidad */}
          <div>
            <label style={labelStyle}>Severidad</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['CRITICAL', 'MAJOR', 'MINOR', 'OBSERVATION'] as CapaSeverity[]).map(s => (
                <button key={s} type="button" onClick={() => set('severity', s)} style={{
                  padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: FONT, fontSize: 11, fontWeight: 600,
                  border: `1.5px solid ${form.severity === s ? SEVER_COLORS[s] : '#eee'}`,
                  background: form.severity === s ? `${SEVER_COLORS[s]}18` : 'transparent',
                  color: form.severity === s ? SEVER_COLORS[s] : '#888',
                }}>
                  {s === 'CRITICAL' ? 'Crítica' : s === 'MAJOR' ? 'Mayor' : s === 'MINOR' ? 'Menor' : 'Observación'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Descripción de la acción *</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="¿Qué se debe hacer para corregir o prevenir este hallazgo?" required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Responsable *</label>
              <select style={inputStyle} value={form.assignedToId} onChange={e => set('assignedToId', e.target.value)} required>
                <option value="">Seleccionar…</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Fecha compromiso *</label>
              <input style={inputStyle} type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} required />
            </div>
          </div>

          {/* ── Análisis de Causa Raíz (colapsable) ─────────────────────────── */}
          <div style={{ border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
            <button type="button" onClick={() => setShowAnalysis(!showAnalysis)} style={{
              width: '100%', padding: '10px 14px', background: showAnalysis ? '#fff8f0' : '#fafafa',
              border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontFamily: FONT, fontSize: 12, fontWeight: 600, color: '#e67e22',
            }}>
              <span>Análisis de Causa Raíz (5 Por Qués + Ishikawa)</span>
              {showAnalysis ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showAnalysis && (
              <div style={{ padding: '14px 14px 4px', background: '#fff', borderTop: '1px solid #eee' }}>
                {/* 5 Por Qués */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#e67e22', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.5px' }}>5 Por Qués</div>
                  {(['why1','why2','why3','why4','why5'] as const).map((k, i) => (
                    <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#e67e22', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 8 }}>{i + 1}</div>
                      <input
                        style={{ ...inputStyle, flex: 1, opacity: i > 0 && !form[`why${i}` as 'why1'] ? .4 : 1 }}
                        value={form[k]}
                        onChange={e => set(k, e.target.value)}
                        placeholder={WHY_PLACEHOLDERS[i]}
                        disabled={i > 0 && !form[`why${i}` as 'why1']}
                      />
                    </div>
                  ))}
                </div>

                {/* Ishikawa */}
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#2980b9', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.5px' }}>Diagrama de Ishikawa</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {ISHIKAWA_CATS.map(({ key, label, emoji }) => (
                      <div key={key}>
                        <label style={{ ...labelStyle, color: '#2980b9' }}>{emoji} {label}</label>
                        <textarea
                          style={{ ...inputStyle, minHeight: 56, resize: 'vertical', fontSize: 12 }}
                          value={form[key]}
                          onChange={e => set(key, e.target.value)}
                          placeholder={`Causas relacionadas con ${label.toLowerCase()}…`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Evidencia fotográfica (colapsable — disponible tras crear) ─── */}
          <div style={{ border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
            <button type="button" onClick={() => setShowEvidence(!showEvidence)} style={{
              width: '100%', padding: '10px 14px', background: showEvidence ? '#f0f9ff' : '#fafafa',
              border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontFamily: FONT, fontSize: 12, fontWeight: 600, color: '#2980b9',
            }}>
              <span>Evidencia Fotográfica {evidencePhotos.length > 0 ? `(${evidencePhotos.length})` : ''}</span>
              {showEvidence ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showEvidence && (
              <div style={{ padding: '14px', background: '#fff', borderTop: '1px solid #eee' }}>
                {!createdCapaId ? (
                  <p style={{ margin: 0, fontSize: 12, color: '#888', fontFamily: FONT, textAlign: 'center', padding: '8px 0' }}>
                    Guarda la CAPA primero para agregar fotos de evidencia.
                  </p>
                ) : (
                  <>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                      border: '2px dashed #ddd', borderRadius: 8, cursor: 'pointer',
                      fontSize: 12, color: '#888', fontFamily: FONT, marginBottom: 12,
                    }}>
                      <Camera size={16} />
                      {uploadingPhoto ? 'Subiendo…' : 'Agregar foto (JPG, PNG, WebP)'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                    </label>
                    {evidencePhotos.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {evidencePhotos.map(url => (
                          <div key={url} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '1', background: '#f5f5f5' }}>
                            <img src={url} alt="evidencia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button
                              type="button"
                              onClick={() => handlePhotoDelete(url)}
                              style={{ position: 'absolute', top: 4, right: 4, background: '#e74c3c', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Trash2 size={11} color="#fff" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {!createdCapaId ? (
            <button type="submit" disabled={loading} style={{ padding: '12px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600, marginTop: 4, opacity: loading ? .7 : 1 }}>
              {loading ? 'Guardando…' : 'Registrar Acción CAPA'}
            </button>
          ) : (
            <button type="button" onClick={onClose} style={{ padding: '12px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600, marginTop: 4 }}>
              Listo — Cerrar
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── Botones PASS / FAIL / NA ─────────────────────────────────────────────────
interface ResultButtonsProps {
  result: AuditResult | null;
  loading: boolean;
  onSelect: (r: AuditResult) => void;
}

function ResultButtons({ result, loading, onSelect }: ResultButtonsProps) {
  const btns: { r: AuditResult; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
    { r: 'PASS', label: 'PASA', icon: <CheckCircle2 size={18} />, color: '#27ae60', bg: '#27ae6015' },
    { r: 'FAIL', label: 'FALLA', icon: <XCircle size={18} />, color: '#e74c3c', bg: '#e74c3c15' },
    { r: 'NA',   label: 'N/A',   icon: <MinusCircle size={18} />, color: '#95a5a6', bg: '#95a5a615' },
  ];
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {btns.map(({ r, label, icon, color, bg }) => {
        const active = result === r;
        return (
          <button key={r} onClick={() => !loading && onSelect(r)} disabled={loading} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '10px 6px', minHeight: 56, borderRadius: 10, cursor: loading ? 'wait' : 'pointer',
            border: `2px solid ${active ? color : '#e8e8e8'}`,
            background: active ? bg : '#fafafa',
            color: active ? color : '#bbb',
            fontFamily: FONT, fontSize: 11, fontWeight: active ? 700 : 500,
            transition: 'all .12s',
          }}>
            {icon}
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Ítem de Auditoría ────────────────────────────────────────────────────────
interface AuditItemCardProps {
  item: AuditItem;
  auditId: string;
  auditStatus: string;
  onUpdate: (itemId: string, result: AuditResult, notes?: string) => Promise<void>;
  onCapaCreated: () => void;
  isMock?: boolean;
}

function AuditItemCard({ item, auditId, auditStatus, onUpdate, onCapaCreated, isMock }: AuditItemCardProps) {
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [_notesOpen, setNotesOpen] = useState(!!item.notes);
  const [capaOpen, setCapaOpen] = useState(false);
  const canEdit = auditStatus === 'IN_PROGRESS';

  const handleSelect = async (r: AuditResult) => {
    setUpdating(true);
    try {
      await onUpdate(item.id, r, notes);
      if (r === 'FAIL') setNotesOpen(true);
    } finally {
      setUpdating(false);
    }
  };

  const handleNotesBlur = async () => {
    if (item.result && notes !== item.notes) {
      await onUpdate(item.id, item.result, notes).catch(() => {});
    }
  };

  const borderColor = item.result === 'PASS' ? '#27ae60' : item.result === 'FAIL' ? '#e74c3c' : item.result === 'NA' ? '#e0e0e0' : '#eee';

  return (
    <div style={{ borderRadius: 10, border: `1.5px solid ${borderColor}`, background: '#fff', padding: '14px 16px', transition: 'border-color .2s' }}>
      {/* Descripción */}
      <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.5, color: '#1a1a1a', fontFamily: FONT }}>
        <span style={{ color: '#bbb', marginRight: 6, fontSize: 12 }}>{item.order}.</span>
        {item.description}
      </p>

      {/* Botones resultado */}
      {canEdit ? (
        <ResultButtons result={item.result} loading={updating} onSelect={handleSelect} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {item.result === 'PASS' && <span style={{ color: '#27ae60', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}><CheckCircle2 size={16} /> Pasa</span>}
          {item.result === 'FAIL' && <span style={{ color: '#e74c3c', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}><XCircle size={16} /> Falla</span>}
          {item.result === 'NA'   && <span style={{ color: '#bbb',    display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}><MinusCircle size={16} /> N/A</span>}
          {!item.result          && <span style={{ color: '#ddd', fontSize: 12 }}>Sin respuesta</span>}
        </div>
      )}

      {/* Notas */}
      {(canEdit || notes) && item.result === 'FAIL' && (
        <div style={{ marginTop: 10 }}>
          {canEdit ? (
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Describe el hallazgo observado…"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #f5a623', borderRadius: 7, fontSize: 12, fontFamily: FONT, resize: 'vertical', minHeight: 60, outline: 'none', boxSizing: 'border-box', background: '#fffdf7' }}
            />
          ) : (
            notes && <p style={{ margin: 0, fontSize: 12, color: '#666', background: '#fffdf7', border: '1px solid #f5e6c8', borderRadius: 7, padding: '8px 10px' }}>{notes}</p>
          )}
        </div>
      )}

      {/* CAPAs existentes */}
      {item.capaActions && item.capaActions.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {item.capaActions.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#fef9ef', borderRadius: 7, marginBottom: 4, border: '1px solid #f5e6c8' }}>
              <AlertTriangle size={11} style={{ color: '#e67e22', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#666', fontFamily: FONT, flex: 1 }}>{c.description}</span>
              <span style={{ fontSize: 10, color: '#aaa', fontFamily: FONT }}>{c.assignedTo.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Botón agregar CAPA */}
      {canEdit && item.result === 'FAIL' && (
        <button onClick={() => setCapaOpen(true)} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'transparent', border: '1.5px dashed #e74c3c', borderRadius: 8, cursor: 'pointer', color: '#e74c3c', fontSize: 12, fontFamily: FONT, fontWeight: 600 }}>
          <Plus size={13} /> Agregar acción CAPA
        </button>
      )}

      {capaOpen && (
        <CapaModal
          auditId={auditId}
          auditItemId={item.id}
          itemDescription={item.description}
          onClose={() => setCapaOpen(false)}
          onCreated={onCapaCreated}
          isMock={isMock}
        />
      )}
    </div>
  );
}

// ─── Sección de Auditoría ─────────────────────────────────────────────────────
interface AuditSectionBlockProps {
  section: AuditSection;
  auditId: string;
  auditStatus: string;
  defaultOpen: boolean;
  onUpdate: (itemId: string, result: AuditResult, notes?: string) => Promise<void>;
  onCapaCreated: () => void;
  isMock?: boolean;
}

function AuditSectionBlock({ section, auditId, auditStatus, defaultOpen, onUpdate, onCapaCreated, isMock }: AuditSectionBlockProps) {
  const [open, setOpen] = useState(defaultOpen);

  const answered = section.items.filter(i => i.result !== null).length;
  const passed   = section.items.filter(i => i.result === 'PASS').length;
  const failed   = section.items.filter(i => i.result === 'FAIL').length;
  const pct      = answered > 0 ? Math.round(passed / answered * 100) : 0;
  const sectionColor = section.isBehavior ? '#8e44ad' : ACCENT;

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fff', border: '1.5px solid #e8e8e8', borderRadius: open ? '10px 10px 0 0' : 10, cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ width: 6, height: 28, borderRadius: 3, background: sectionColor, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', fontFamily: FONT }}>{section.name}</div>
          <div style={{ fontSize: 11, color: '#888', fontFamily: FONT, marginTop: 1 }}>
            {answered}/{section.items.length} respondidos
            {failed > 0 && <span style={{ color: '#e74c3c', marginLeft: 8 }}>· {failed} falla{failed > 1 ? 's' : ''}</span>}
          </div>
        </div>
        {answered > 0 && (
          <div style={{ textAlign: 'right', marginRight: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: pct >= 80 ? '#27ae60' : pct >= 60 ? '#e67e22' : '#e74c3c', fontFamily: FONT }}>{pct}%</div>
          </div>
        )}
        {open ? <ChevronUp size={16} style={{ color: '#bbb', flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: '#bbb', flexShrink: 0 }} />}
      </button>

      {/* Progress bar */}
      {answered > 0 && (
        <div style={{ height: 3, background: '#f0f0f0', borderRadius: open ? 0 : '0 0 3px 3px' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#27ae60' : pct >= 60 ? '#e67e22' : '#e74c3c', transition: 'width .3s' }} />
        </div>
      )}

      {open && (
        <div style={{ border: '1.5px solid #e8e8e8', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {section.items.map(item => (
            <AuditItemCard
              key={item.id}
              item={item}
              auditId={auditId}
              auditStatus={auditStatus}
              onUpdate={onUpdate}
              onCapaCreated={onCapaCreated}
              isMock={isMock}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AuditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { push } = useToast();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const isMock = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await api.get<Audit>(`/audits/${id}`);
      setAudit(data);
    } catch {
      const m = mockAudits.find(a => a.id === id);
      if (m) {
        isMock.current = true;
        const statusMap: Record<string, Audit['status']> = {
          CLOSED: 'CLOSED', SCHEDULED: 'DRAFT', IN_PROGRESS: 'IN_PROGRESS',
        };
        const auditType: Audit['type'] = m.type === '5S' ? 'FIVE_S' : 'PROCESS';
        const status = statusMap[m.status] ?? 'DRAFT';
        const sections = m.type === '5S' ? buildMock5SSections() : buildMockProcessSections();
        if (status === 'CLOSED' || status === 'COMPLETED') {
          sections.forEach(s => s.items.forEach((item, idx) => {
            item.result = ((m.score ?? 80) >= 90 || idx % 4 !== 0) ? 'PASS' : 'FAIL';
            item.checkedAt = m.date + 'T10:00:00Z';
          }));
        }
        setAudit({
          id: m.id, code: m.code, title: m.title, type: auditType, status, area: m.area,
          score: m.score, notes: null,
          scheduledAt: m.date + 'T09:00:00Z',
          startedAt: status !== 'DRAFT' ? m.date + 'T09:00:00Z' : null,
          completedAt: (status === 'COMPLETED' || status === 'CLOSED') ? m.date + 'T11:00:00Z' : null,
          auditor: { id: '2', name: m.auditor },
          sections,
          createdAt: m.date + 'T00:00:00Z',
          updatedAt: m.date + 'T00:00:00Z',
        });
      } else {
        push('Error al cargar auditoría', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [id, push]);

  useEffect(() => { load(); }, [load]);

  const handleStart = async () => {
    if (!id) return;
    if (isMock.current) {
      setAudit(a => a ? { ...a, status: 'IN_PROGRESS', startedAt: new Date().toISOString() } : a);
      push('Auditoría iniciada', 'success');
      return;
    }
    try {
      await api.patch(`/audits/${id}/start`);
      setAudit(a => a ? { ...a, status: 'IN_PROGRESS', startedAt: new Date().toISOString() } : a);
      push('Auditoría iniciada', 'success');
    } catch { push('Error al iniciar', 'error'); }
  };

  const handleComplete = async () => {
    if (!id) return;
    setCompleting(true);
    if (isMock.current) {
      const allItems = audit?.sections?.flatMap(s => s.items) ?? [];
      const passed = allItems.filter(i => i.result === 'PASS').length;
      const answered = allItems.filter(i => i.result !== null).length;
      const score = answered > 0 ? Math.round(passed / answered * 100) : 0;
      setAudit(a => a ? { ...a, status: 'COMPLETED', score, completedAt: new Date().toISOString() } : a);
      push(`Auditoría completada — Puntaje: ${score}%`, 'success');
      setCompleting(false);
      return;
    }
    try {
      const { data } = await api.patch<Audit>(`/audits/${id}/complete`);
      setAudit(a => a ? { ...a, status: 'COMPLETED', score: data.score, completedAt: data.completedAt } : a);
      push(`Auditoría completada — Puntaje: ${data.score ?? 'N/D'}%`, 'success');
    } catch { push('Error al completar', 'error'); } finally { setCompleting(false); }
  };

  const handleUpdateItem = useCallback(async (itemId: string, result: AuditResult, notes?: string) => {
    if (!id) return;
    if (isMock.current) {
      setAudit(prev => {
        if (!prev || !prev.sections) return prev;
        return {
          ...prev,
          sections: prev.sections.map(s => ({
            ...s,
            items: s.items.map(i => i.id === itemId ? { ...i, result, notes: notes ?? null } : i),
          })),
        };
      });
      return;
    }
    try {
      const { data: updatedItem } = await api.patch<AuditItem>(`/audits/${id}/items/${itemId}`, { result, notes });
      setAudit(prev => {
        if (!prev || !prev.sections) return prev;
        return {
          ...prev,
          sections: prev.sections.map(s => ({
            ...s,
            items: s.items.map(i => i.id === itemId ? { ...i, ...updatedItem } : i),
          })),
        };
      });
    } catch { push('Error al guardar respuesta', 'error'); throw new Error('update failed'); }
  }, [id, push]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#bbb', fontFamily: FONT }}>Cargando auditoría…</div>;
  if (!audit)  return <div style={{ padding: 40, textAlign: 'center', color: '#e74c3c', fontFamily: FONT }}>Auditoría no encontrada</div>;

  // Calcular progreso total
  const allItems  = audit.sections?.flatMap(s => s.items) ?? [];
  const answered  = allItems.filter(i => i.result !== null).length;
  const passed    = allItems.filter(i => i.result === 'PASS').length;
  const failed    = allItems.filter(i => i.result === 'FAIL').length;
  const totalItems = allItems.length;
  const pct       = answered > 0 ? Math.round(passed / answered * 100) : 0;
  const allAnswered = answered === totalItems;

  const canEdit = audit.status === 'IN_PROGRESS';
  const canStart = audit.status === 'DRAFT' && (user?.role === 'ADMIN' || user?.role === 'SUPERVISOR' || audit.auditor.id === user?.id);
  const typeColor = audit.type === 'FIVE_S' ? '#8e44ad' : '#2980b9';

  return (
    <div style={{ fontFamily: FONT, paddingBottom: 80 }}>

      {/* ── Header sticky ────────────────────────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #eee', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <button onClick={() => navigate('/audits')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, padding: 0 }}>
            <ChevronLeft size={16} /> Auditorías
          </button>
          <span style={{ color: '#ddd' }}>·</span>
          <span style={{ fontSize: 12, color: '#888' }}>{audit.code}</span>
          <span style={{ background: `${typeColor}18`, color: typeColor, fontWeight: 600, fontSize: 11, padding: '2px 8px', borderRadius: 12 }}>{TYPE_LABEL[audit.type]}</span>
          <span style={{
            background: audit.status === 'COMPLETED' ? '#27ae6018' : audit.status === 'IN_PROGRESS' ? '#e67e2218' : '#ddd3',
            color: audit.status === 'COMPLETED' ? '#27ae60' : audit.status === 'IN_PROGRESS' ? '#e67e22' : '#999',
            fontWeight: 600, fontSize: 11, padding: '2px 8px', borderRadius: 12,
          }}>{STATUS_LABEL[audit.status]}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>{audit.title}</h1>
            <div style={{ display: 'flex', gap: 12, marginTop: 3, fontSize: 12, color: '#888', flexWrap: 'wrap' }}>
              <span>📍 {audit.area}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={11} /> {audit.auditor.name}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> {new Date(audit.scheduledAt).toLocaleDateString('es-MX')}</span>
            </div>
          </div>

          {/* Puntaje o botones de acción */}
          {audit.status === 'COMPLETED' || audit.status === 'CLOSED' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: pct >= 80 ? '#27ae60' : pct >= 60 ? '#e67e22' : '#e74c3c' }}>{audit.score ?? pct}%</div>
                <div style={{ fontSize: 10, color: '#aaa' }}>cumplimiento</div>
              </div>
              <button
                onClick={() => exportAuditPDF(audit)}
                title="Exportar PDF"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 600, color: '#555', flexShrink: 0 }}
              >
                <FileDown size={14} /> PDF
              </button>
            </div>
          ) : canStart ? (
            <button onClick={handleStart} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
              <Play size={14} /> Iniciar
            </button>
          ) : null}
        </div>

        {/* Barra de progreso global */}
        {totalItems > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: '#888' }}>
              <span>{answered}/{totalItems} respondidos {failed > 0 && <span style={{ color: '#e74c3c' }}>· {failed} falla{failed > 1 ? 's' : ''}</span>}</span>
              {answered > 0 && <span style={{ fontWeight: 600, color: pct >= 80 ? '#27ae60' : pct >= 60 ? '#e67e22' : '#e74c3c' }}>{pct}%</span>}
            </div>
            <div style={{ height: 5, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(answered / totalItems) * 100}%`, background: pct >= 80 ? '#27ae60' : pct >= 60 ? '#e67e22' : '#e74c3c', transition: 'width .3s' }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Contenido ──────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 16px 0' }}>
        {audit.notes && (
          <div style={{ background: '#fffdf2', border: '1px solid #f5e6c8', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#666' }}>
            📝 {audit.notes}
          </div>
        )}

        {audit.sections?.map((section, i) => (
          <AuditSectionBlock
            key={section.id}
            section={section}
            auditId={audit.id}
            auditStatus={audit.status}
            defaultOpen={i === 0}
            onUpdate={handleUpdateItem}
            onCapaCreated={load}
            isMock={isMock.current}
          />
        ))}
      </div>

      {/* ── FAB Completar ──────────────────────────────────────────────── */}
      {canEdit && allAnswered && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 40 }}>
          <button onClick={handleComplete} disabled={completing} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 28px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 50, cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 700, boxShadow: '0 4px 20px rgba(39,174,96,.4)', opacity: completing ? .8 : 1 }}>
            <CheckCheck size={18} /> {completing ? 'Calculando…' : 'Completar Auditoría'}
          </button>
        </div>
      )}

      {/* Guía cuando hay ítems sin responder */}
      {canEdit && !allAnswered && answered > 0 && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#fff', border: '1px solid #eee', borderRadius: 50, padding: '10px 20px', fontSize: 12, color: '#888', fontFamily: FONT, boxShadow: '0 2px 12px rgba(0,0,0,.08)', whiteSpace: 'nowrap' }}>
          Faltan {totalItems - answered} ítem{totalItems - answered > 1 ? 's' : ''} por responder
        </div>
      )}
    </div>
  );
}
