import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { WorkOrder, WorkOrderStatus } from '@/types';

/* ── palette ── */
const ACCENT  = '#e67e22';
const C_BLUE  = '#2980b9';
const C_GREEN = '#27ae60';
const C_RED   = '#c0392b';
const BORDER  = '#e4e4e4';
const TEXT    = '#1c1c1c';
const MUTED   = '#888';
const TOPBAR  = '#ffffff';
const CARD    = '#ffffff';
const CONTENT = '#f5f5f5';

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En Progreso', ON_HOLD: 'En Espera',
  COMPLETED: 'Completada', CANCELLED: 'Cancelada',
};
const STATUS_META: Record<WorkOrderStatus, { color: string; bg: string }> = {
  PENDING:     { color: ACCENT,   bg: '#fef3e7' },
  IN_PROGRESS: { color: C_BLUE,   bg: '#e8f4fd' },
  ON_HOLD:     { color: '#8b5cf6', bg: '#f3eeff' },
  COMPLETED:   { color: C_GREEN,  bg: '#e9f7ef' },
  CANCELLED:   { color: '#6b7280', bg: '#f3f4f6' },
};
const PRIORITY_META: Record<string, { color: string }> = {
  LOW: { color: C_GREEN }, MEDIUM: { color: ACCENT }, HIGH: { color: '#f97316' }, CRITICAL: { color: C_RED },
};
const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica',
};
const TYPE_LABELS: Record<string, string> = {
  PREVENTIVE: 'Preventivo', CORRECTIVE: 'Correctivo', PREDICTIVE: 'Predictivo', INSPECTION: 'Inspección',
};

interface Comment { id: string; content: string; createdAt: string; author: { id: string; name: string } }
interface DetailedOrder extends WorkOrder { comments: Comment[] }
interface Technician { id: string; name: string; role?: string; active?: boolean }

const selStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 12,
  border: `1px solid ${BORDER}`, background: CONTENT, color: TEXT,
  fontFamily: 'IBM Plex Sans, sans-serif', borderRadius: 2, outline: 'none',
};

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { push } = useToast();

  const [order, setOrder]       = useState<DetailedOrder | null>(null);
  const [loading, setLoading]   = useState(true);
  const [note, setNote]         = useState('');
  const [saving, setSaving]     = useState(false);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [assignedId, setAssignedId]   = useState('');

  // ── Solicitud de partes ───────────────────────────────────────────
  const [showParts, setShowParts]     = useState(false);
  const [partsItems, setPartsItems]   = useState([{ name: '', quantity: 1, notes: '' }]);
  const [partsNotes, setPartsNotes]   = useState('');
  const [partsEmail, setPartsEmail]   = useState('');
  const [partsSaving, setPartsSaving] = useState(false);
  const [partsError, setPartsError]   = useState('');

  const canEdit = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  const fetchOrder = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await api.get<DetailedOrder>(`/work-orders/${id}`);
      setOrder(data);
      setAssignedId(data.assignedTo?.id ?? '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrder(); }, [id]);

  useEffect(() => {
    if (!canEdit) return;
    api.get<Technician[]>('/users')
      .then(({ data }) => setTechnicians(data.filter((u: Technician) => (u.role === 'TECHNICIAN' || u.role === 'SUPERVISOR') && u.active !== false)))
      .catch(() => {});
  }, [canEdit]);

  const changeStatus = async (status: WorkOrderStatus) => {
    if (!id || !order) return;
    try {
      await api.patch(`/work-orders/${id}/status`, { status });
      setOrder({ ...order, status });
      push(`Estado actualizado a ${STATUS_LABELS[status]}`, 'success');
    } catch {
      push('Error al cambiar estado', 'error');
    }
  };

  const addNote = async () => {
    if (!note.trim() || !id) return;
    setSaving(true);
    try {
      await api.post(`/work-orders/${id}/comments`, { content: note.trim() });
      setNote('');
      await fetchOrder();
    } catch {
      push('Error al agregar nota', 'error');
    } finally {
      setSaving(false);
    }
  };

  const reassign = async (techId: string) => {
    if (!id) return;
    setAssignedId(techId);
    try {
      await api.patch(`/work-orders/${id}/assign`, { assignedToId: techId || null });
      push('Técnico reasignado', 'success');
      await fetchOrder();
    } catch {
      push('Error al reasignar', 'error');
    }
  };

  const addPartItem = () =>
    setPartsItems((p) => [...p, { name: '', quantity: 1, notes: '' }]);
  const removePartItem = (i: number) =>
    setPartsItems((p) => p.filter((_, idx) => idx !== i));
  const setPartField = (i: number, field: string, value: string | number) =>
    setPartsItems((p) => p.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));

  const openPartsModal = () => {
    setPartsItems([{ name: '', quantity: 1, notes: '' }]);
    setPartsNotes('');
    setPartsEmail('');
    setPartsError('');
    setShowParts(true);
  };

  const handlePartsRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!partsEmail.trim()) { setPartsError('Ingresa el email del destinatario'); return; }
    if (partsItems.some((p) => !p.name.trim())) { setPartsError('Todos los ítems deben tener nombre'); return; }
    setPartsSaving(true);
    setPartsError('');
    try {
      await api.post('/part-requests', {
        workOrderId: id,
        parts: partsItems.map((p) => ({ name: p.name.trim(), quantity: Number(p.quantity), notes: p.notes || undefined })),
        additionalNotes: partsNotes.trim() || undefined,
        recipientEmail: partsEmail.trim(),
      });
      push('Solicitud enviada por correo', 'success');
      setShowParts(false);
      await fetchOrder();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setPartsError(typeof msg === 'string' ? msg : 'Error al enviar el correo');
    } finally {
      setPartsSaving(false);
    }
  };

  if (loading) return (
    <div style={{ flex: 1, background: CONTENT, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Sans, sans-serif', color: MUTED }}>
      Cargando...
    </div>
  );

  if (!order) return (
    <div style={{ flex: 1, background: CONTENT, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Sans, sans-serif', color: MUTED }}>
      Orden no encontrada
    </div>
  );

  const est = STATUS_META[order.status];
  const pri = PRIORITY_META[order.priority];

  return (
    <div style={{ flex: 1, background: CONTENT, minHeight: '100vh', fontFamily: 'IBM Plex Sans, sans-serif' }}>
      {/* Topbar */}
      <div style={{ background: TOPBAR, borderBottom: `1px solid ${BORDER}`, padding: '0 24px', height: 48, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M8 1L3 6l5 5" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
          Volver
        </button>
        <span style={{ color: BORDER }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {order.code.slice(-8).toUpperCase()} — {order.title}
        </span>
        <span style={{ background: est.bg, color: est.color, padding: '3px 10px', borderRadius: 2, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        {/* ── Left col ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Info card */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, fontWeight: 600, fontSize: 13, color: TEXT }}>
              Información de la Orden
            </div>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {([
                ['Máquina / Activo', order.asset.name],
                ['Área', order.asset.area],
                ['Técnico asignado', order.assignedTo?.name ?? '—'],
                ['Prioridad', <span key="pri" style={{ color: pri?.color ?? MUTED, fontWeight: 700 }}>{PRIORITY_LABELS[order.priority] ?? order.priority}</span>],
                ['Tipo de mantenimiento', TYPE_LABELS[order.type] ?? order.type],
                ['Fecha programada', order.scheduledAt ? new Date(order.scheduledAt).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'],
                ['Fecha de creación', new Date(order.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })],
                ['Creado por', order.createdBy.name],
              ] as [string, React.ReactNode][]).map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{val}</div>
                </div>
              ))}
              {order.description && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>Descripción</div>
                  <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.6 }}>{order.description}</div>
                </div>
              )}
            </div>
          </div>

          {/* Activity timeline */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, fontWeight: 600, fontSize: 13, color: TEXT }}>
              Historial de Actividad
            </div>
            <div style={{ padding: 16 }}>
              {order.comments.length === 0 && (
                <p style={{ fontSize: 12, color: MUTED, textAlign: 'center', margin: '12px 0' }}>Sin actividad registrada aún.</p>
              )}
              {order.comments.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', gap: 12, marginBottom: 14, position: 'relative' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, marginTop: 4, flexShrink: 0 }} />
                  {i < order.comments.length - 1 && (
                    <div style={{ position: 'absolute', left: 3, top: 12, width: 2, height: 'calc(100% + 6px)', background: BORDER }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{c.author.name}</span>
                      <span style={{ fontSize: 11, color: MUTED, marginLeft: 'auto' }}>
                        {new Date(c.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short' })} {new Date(c.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>{c.content}</div>
                  </div>
                </div>
              ))}

              {/* Add note */}
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addNote()}
                  placeholder="Agregar nota al historial..."
                  style={{ flex: 1, padding: '7px 10px', fontSize: 12, border: `1px solid ${BORDER}`, background: CONTENT, color: TEXT, fontFamily: 'IBM Plex Sans, sans-serif', outline: 'none', borderRadius: 2 }}
                />
                <button
                  onClick={addNote}
                  disabled={saving || !note.trim()}
                  style={{ padding: '7px 14px', background: saving || !note.trim() ? '#ccc' : ACCENT, color: '#fff', border: 'none', cursor: saving || !note.trim() ? 'default' : 'pointer', fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif', borderRadius: 2 }}
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right col ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Status change */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, fontWeight: 600, fontSize: 13, color: TEXT }}>
              Cambiar Estado
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(Object.keys(STATUS_LABELS) as WorkOrderStatus[]).map((s) => {
                const m = STATUS_META[s];
                const active = order.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => canEdit && changeStatus(s)}
                    disabled={!canEdit}
                    style={{
                      padding: '8px 12px', textAlign: 'left', fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif',
                      background: active ? m.bg : 'transparent',
                      color: active ? m.color : MUTED,
                      border: `1px solid ${active ? m.color : BORDER}`,
                      fontWeight: active ? 700 : 400,
                      cursor: canEdit ? 'pointer' : 'default',
                      borderRadius: 2,
                      opacity: !canEdit && !active ? 0.5 : 1,
                    }}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reassign technician */}
          {canEdit && (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, padding: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: TEXT, marginBottom: 10 }}>Reasignar Técnico</div>
              <select
                value={assignedId}
                onChange={(e) => reassign(e.target.value)}
                style={selStyle}
              >
                <option value="">Sin asignar</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Metadata */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, padding: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: TEXT, marginBottom: 10 }}>Detalles Técnicos</div>
            {[
              ['Código', order.code.slice(-8).toUpperCase()],
              ['Horas estimadas', order.estimatedHours ? `${order.estimatedHours}h` : '—'],
              ['Horas reales', order.actualHours ? `${order.actualHours}h` : '—'],
              ['Fecha inicio', order.startedAt ? new Date(order.startedAt).toLocaleDateString('es') : '—'],
              ['Fecha cierre', order.completedAt ? new Date(order.completedAt).toLocaleDateString('es') : '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: MUTED }}>{label}</span>
                <span style={{ color: TEXT, fontWeight: 500 }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Solicitar Partes */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, padding: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: TEXT, marginBottom: 6 }}>Solicitud de Partes</div>
            <p style={{ fontSize: 11, color: MUTED, marginBottom: 10, lineHeight: 1.5 }}>
              Envía un correo con la lista de refacciones necesarias para esta orden.
            </p>
            <button
              onClick={openPartsModal}
              style={{
                width: '100%', padding: '8px 12px', fontSize: 12, fontWeight: 600,
                background: '#7c3aed', color: '#fff', border: 'none',
                cursor: 'pointer', borderRadius: 2, fontFamily: 'IBM Plex Sans, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"/>
              </svg>
              Solicitar Partes por Correo
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal: Solicitud de Partes ── */}
      {showParts && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowParts(false); }}
        >
          <div style={{ background: '#fff', borderRadius: 4, width: '100%', maxWidth: 580, maxHeight: '90vh', overflow: 'auto', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            {/* Modal header */}
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>📦 Solicitar Partes / Refacciones</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>OT {order.code.slice(-8).toUpperCase()} — {order.asset.name}</div>
              </div>
              <button onClick={() => setShowParts(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 18, lineHeight: 1 }}>×</button>
            </div>

            <form onSubmit={handlePartsRequest} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Parts list */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 500 }}>
                    Partes requeridas *
                  </label>
                  <button
                    type="button"
                    onClick={addPartItem}
                    style={{ fontSize: 11, color: '#7c3aed', background: 'none', border: '1px solid #7c3aed', cursor: 'pointer', padding: '3px 10px', borderRadius: 2 }}
                  >
                    + Agregar
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {partsItems.map((item, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 72px 1fr auto', gap: 8, alignItems: 'center' }}>
                      <input
                        value={item.name}
                        onChange={(e) => setPartField(i, 'name', e.target.value)}
                        placeholder="Nombre de la parte"
                        required
                        style={{ padding: '7px 9px', fontSize: 12, border: `1px solid ${BORDER}`, background: '#f9f9f9', borderRadius: 2, outline: 'none', color: TEXT }}
                      />
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => setPartField(i, 'quantity', Number(e.target.value))}
                        style={{ padding: '7px 9px', fontSize: 12, border: `1px solid ${BORDER}`, background: '#f9f9f9', borderRadius: 2, outline: 'none', color: TEXT, textAlign: 'center' }}
                      />
                      <input
                        value={item.notes}
                        onChange={(e) => setPartField(i, 'notes', e.target.value)}
                        placeholder="Notas (opcional)"
                        style={{ padding: '7px 9px', fontSize: 12, border: `1px solid ${BORDER}`, background: '#f9f9f9', borderRadius: 2, outline: 'none', color: TEXT }}
                      />
                      {partsItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePartItem(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C_RED, fontSize: 16, lineHeight: 1, padding: '0 4px' }}
                          title="Eliminar"
                        >×</button>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>Columnas: Nombre · Cantidad · Notas</div>
              </div>

              {/* Additional notes */}
              <div>
                <label style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 500, display: 'block', marginBottom: 5 }}>
                  Notas adicionales
                </label>
                <textarea
                  value={partsNotes}
                  onChange={(e) => setPartsNotes(e.target.value)}
                  placeholder="Urgencia, contexto de la falla, alternativas aceptadas..."
                  rows={3}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: `1px solid ${BORDER}`, background: '#f9f9f9', borderRadius: 2, outline: 'none', resize: 'vertical', fontFamily: 'IBM Plex Sans, sans-serif', color: TEXT, boxSizing: 'border-box' }}
                />
              </div>

              {/* Recipient email */}
              <div>
                <label style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 500, display: 'block', marginBottom: 5 }}>
                  Email destinatario *
                </label>
                <input
                  type="email"
                  value={partsEmail}
                  onChange={(e) => setPartsEmail(e.target.value)}
                  placeholder="almacen@empresa.com"
                  required
                  style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: `1px solid ${BORDER}`, background: '#f9f9f9', borderRadius: 2, outline: 'none', color: TEXT, boxSizing: 'border-box' }}
                />
              </div>

              {/* Error */}
              {partsError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 2, padding: '8px 12px', fontSize: 12, color: C_RED }}>
                  {partsError}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowParts(false)}
                  style={{ padding: '8px 18px', fontSize: 12, background: 'transparent', color: TEXT, border: `1px solid ${BORDER}`, cursor: 'pointer', borderRadius: 2 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={partsSaving}
                  style={{ padding: '8px 18px', fontSize: 12, fontWeight: 600, background: partsSaving ? '#ccc' : '#7c3aed', color: '#fff', border: 'none', cursor: partsSaving ? 'default' : 'pointer', borderRadius: 2 }}
                >
                  {partsSaving ? 'Enviando...' : 'Enviar Correo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
