import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronDown, ChevronUp, CheckCircle2, XCircle, MinusCircle,
  AlertTriangle, Play, CheckCheck, User, X, Plus, Clock, FileDown,
} from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { exportAuditPDF } from '@/lib/pdfExport';
import type { Audit, AuditSection, AuditItem, AuditResult, CapaSeverity, CapaType } from '@/types';

const FONT = 'IBM Plex Sans, sans-serif';
const ACCENT = '#27ae60';

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
}

function CapaModal({ auditId, auditItemId, itemDescription, onClose, onCreated }: CapaModalProps) {
  const { push } = useToast();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    type: 'CORRECTIVE' as CapaType,
    severity: 'MINOR' as CapaSeverity,
    description: '',
    rootCause: '',
    assignedToId: '',
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  });

  useEffect(() => {
    api.get<{ id: string; name: string }[]>('/users').then(r => setUsers(r.data)).catch(() => {});
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.assignedToId || !form.description) { push('Completa todos los campos obligatorios', 'error'); return; }
    setLoading(true);
    try {
      await api.post(`/audits/${auditId}/capa`, {
        ...form,
        auditItemId,
        dueDate: new Date(form.dueDate).toISOString(),
      });
      push('Acción CAPA creada', 'success');
      onCreated();
      onClose();
    } catch {
      push('Error al crear CAPA', 'error');
    } finally {
      setLoading(false);
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

          <div>
            <label style={labelStyle}>Causa raíz (opcional)</label>
            <input style={inputStyle} value={form.rootCause} onChange={e => set('rootCause', e.target.value)} placeholder="¿Por qué ocurrió este incumplimiento?" />
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

          <button type="submit" disabled={loading} style={{ padding: '12px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600, marginTop: 4, opacity: loading ? .7 : 1 }}>
            {loading ? 'Guardando…' : 'Registrar Acción CAPA'}
          </button>
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
}

function AuditItemCard({ item, auditId, auditStatus, onUpdate, onCapaCreated }: AuditItemCardProps) {
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [notesOpen, setNotesOpen] = useState(!!item.notes);
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
}

function AuditSectionBlock({ section, auditId, auditStatus, defaultOpen, onUpdate, onCapaCreated }: AuditSectionBlockProps) {
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

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await api.get<Audit>(`/audits/${id}`);
      setAudit(data);
    } catch {
      push('Error al cargar auditoría', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, push]);

  useEffect(() => { load(); }, [load]);

  const handleStart = async () => {
    if (!id) return;
    try {
      await api.patch(`/audits/${id}/start`);
      setAudit(a => a ? { ...a, status: 'IN_PROGRESS', startedAt: new Date().toISOString() } : a);
      push('Auditoría iniciada', 'success');
    } catch { push('Error al iniciar', 'error'); }
  };

  const handleComplete = async () => {
    if (!id) return;
    setCompleting(true);
    try {
      const { data } = await api.patch<Audit>(`/audits/${id}/complete`);
      setAudit(a => a ? { ...a, status: 'COMPLETED', score: data.score, completedAt: data.completedAt } : a);
      push(`Auditoría completada — Puntaje: ${data.score ?? 'N/D'}%`, 'success');
    } catch { push('Error al completar', 'error'); } finally { setCompleting(false); }
  };

  const handleUpdateItem = useCallback(async (itemId: string, result: AuditResult, notes?: string) => {
    if (!id) return;
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
