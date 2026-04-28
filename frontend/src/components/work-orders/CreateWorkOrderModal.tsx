import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { Asset, User, Periodicidad } from '@/types';

interface Props { open: boolean; onClose: () => void; onCreated: () => void }

const ACCENT  = '#e67e22';
const C_GREEN = '#27ae60';
const BORDER  = '#e4e4e4';
const TEXT    = '#1c1c1c';
const MUTED   = '#888';
const CONTENT = '#f5f5f5';
const CARD    = '#ffffff';

const TYPE_LABELS: Record<string, string> = {
  PREVENTIVE: 'Preventivo', CORRECTIVE: 'Correctivo', PREDICTIVE: 'Predictivo', INSPECTION: 'Inspección',
};
const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica',
};
const PERIODICIDAD_OPTIONS: { value: Periodicidad; label: string }[] = [
  { value: 'DAILY', label: 'Diario' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'MONTHLY', label: 'Mensual' },
  { value: 'QUARTERLY', label: 'Trimestral' },
  { value: 'ANNUAL', label: 'Anual' },
];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: `1px solid ${BORDER}`, background: CONTENT, color: TEXT,
  fontFamily: 'IBM Plex Sans, sans-serif', borderRadius: 2, outline: 'none',
  boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px',
  display: 'block', marginBottom: 5, fontWeight: 500,
};

const INITIAL_FORM = {
  title: '', description: '', type: 'CORRECTIVE', priority: 'MEDIUM',
  periodicidad: '', assetId: '', assignedToId: '', scheduledAt: '', estimatedHours: '',
};

const STEPS = ['Información General', 'Detalles Técnicos', 'Confirmación'];

export default function CreateWorkOrderModal({ open, onClose, onCreated }: Props) {
  const { push } = useToast();
  const [assets, setAssets]   = useState<Asset[]>([]);
  const [users, setUsers]     = useState<User[]>([]);
  const [step, setStep]       = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm]       = useState(INITIAL_FORM);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSubmitted(false);
    setForm(INITIAL_FORM);
    Promise.all([api.get<Asset[]>('/assets'), api.get<User[]>('/users')]).then(([a, u]) => {
      setAssets(a.data);
      setUsers(u.data.filter((user) => (user.role === 'TECHNICIAN' || user.role === 'SUPERVISOR') && (user as typeof user & { active?: boolean }).active !== false));
    });
  }, [open]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.assetId) return;
    setLoading(true);
    try {
      await api.post('/work-orders', {
        title: form.title,
        description: form.description,
        type: form.type,
        priority: form.priority,
        periodicidad: form.periodicidad || undefined,
        assetId: form.assetId,
        assignedToId: form.assignedToId || undefined,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
        estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : undefined,
      });
      setSubmitted(true);
      push('Orden de trabajo creada', 'success');
      setTimeout(() => {
        onCreated();
        onClose();
      }, 1500);
    } catch {
      push('Error al crear la orden', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedAsset = assets.find((a) => a.id === form.assetId);
  const selectedUser  = users.find((u) => u.id === form.assignedToId);
  const step1Valid    = !!form.title.trim();
  const step2Valid    = !!form.assetId;

  return (
    <Modal open={open} onClose={onClose} title="Nueva Solicitud de Mantenimiento" size="lg">
      {submitted ? (
        /* ── Success screen ── */
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#e9f7ef', border: `2px solid ${C_GREEN}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C_GREEN} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 6, fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Orden creada exitosamente
          </div>
          <div style={{ fontSize: 13, color: MUTED, fontFamily: 'IBM Plex Sans, sans-serif' }}>Cerrando…</div>
        </div>
      ) : (
        <>
          {/* ── Step indicator ── */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
            {STEPS.map((label, i) => {
              const n    = i + 1;
              const done = step > n;
              const active = step === n;
              return (
                <div key={n} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: done ? C_GREEN : active ? ACCENT : BORDER,
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                    }}>
                      {done ? '✓' : n}
                    </div>
                    <span style={{ fontSize: 12, color: active ? TEXT : MUTED, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ flex: 1, height: 1, background: BORDER, margin: '0 12px' }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Step content ── */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, padding: 20, marginBottom: 16 }}>
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Título de la solicitud *</label>
                  <input
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    placeholder="ej. Falla en cortadora CNC #1"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Tipo *</label>
                    <select value={form.type} onChange={(e) => set('type', e.target.value)} style={inputStyle}>
                      {Object.keys(TYPE_LABELS).map((t) => (
                        <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Prioridad *</label>
                    <select value={form.priority} onChange={(e) => set('priority', e.target.value)} style={inputStyle}>
                      {Object.keys(PRIORITY_LABELS).map((p) => (
                        <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Fecha programada</label>
                    <input type="datetime-local" value={form.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} style={inputStyle} />
                  </div>
                  {form.type === 'PREVENTIVE' && (
                    <div>
                      <label style={labelStyle}>Periodicidad</label>
                      <select value={form.periodicidad} onChange={(e) => set('periodicidad', e.target.value)} style={inputStyle}>
                        <option value="">Sin periodicidad</option>
                        {PERIODICIDAD_OPTIONS.map(({ value, label }) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Máquina / Activo *</label>
                  <select value={form.assetId} onChange={(e) => set('assetId', e.target.value)} style={inputStyle}>
                    <option value="">Seleccionar equipo…</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Técnico asignado</label>
                  <select value={form.assignedToId} onChange={(e) => set('assignedToId', e.target.value)} style={inputStyle}>
                    <option value="">Sin asignar</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Horas estimadas</label>
                  <input type="number" min="0.5" step="0.5" value={form.estimatedHours} onChange={(e) => set('estimatedHours', e.target.value)} placeholder="ej. 2.5" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Descripción del problema</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="Describe el problema, síntomas observados, impacto en producción..."
                    style={{ ...inputStyle, height: 90, resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 16, fontFamily: 'IBM Plex Sans, sans-serif' }}>
                  Revisa la información antes de crear la orden.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {([
                    ['Título', form.title || '—'],
                    ['Tipo', TYPE_LABELS[form.type]],
                    ['Prioridad', PRIORITY_LABELS[form.priority]],
                    ['Activo', selectedAsset?.name ?? '—'],
                    ['Técnico', selectedUser?.name ?? 'Sin asignar'],
                    ['Fecha programada', form.scheduledAt ? new Date(form.scheduledAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} style={{ background: '#fafafa', padding: '10px 12px', borderRadius: 2 }}>
                      <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3, fontFamily: 'IBM Plex Sans, sans-serif' }}>{k}</div>
                      <div style={{ fontSize: 13, color: TEXT, fontWeight: 500, fontFamily: 'IBM Plex Sans, sans-serif' }}>{v}</div>
                    </div>
                  ))}
                  {form.description && (
                    <div style={{ gridColumn: '1 / -1', background: '#fafafa', padding: '10px 12px', borderRadius: 2 }}>
                      <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3, fontFamily: 'IBM Plex Sans, sans-serif' }}>Descripción</div>
                      <div style={{ fontSize: 13, color: TEXT, fontFamily: 'IBM Plex Sans, sans-serif' }}>{form.description}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Navigation ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
            <button
              onClick={() => step === 1 ? onClose() : setStep((s) => s - 1)}
              style={{
                padding: '8px 20px', fontSize: 12, background: 'transparent',
                color: TEXT, border: `1px solid ${BORDER}`, cursor: 'pointer',
                fontFamily: 'IBM Plex Sans, sans-serif', borderRadius: 2,
              }}
            >
              {step === 1 ? 'Cancelar' : 'Anterior'}
            </button>
            {step < 3 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 1 ? !step1Valid : !step2Valid}
                style={{
                  padding: '8px 20px', fontSize: 12, fontWeight: 600,
                  background: (step === 1 ? !step1Valid : !step2Valid) ? '#ccc' : ACCENT,
                  color: '#fff', border: 'none',
                  cursor: (step === 1 ? !step1Valid : !step2Valid) ? 'default' : 'pointer',
                  fontFamily: 'IBM Plex Sans, sans-serif', borderRadius: 2,
                }}
              >
                Siguiente →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  padding: '8px 20px', fontSize: 12, fontWeight: 600,
                  background: loading ? '#ccc' : C_GREEN,
                  color: '#fff', border: 'none', cursor: loading ? 'default' : 'pointer',
                  fontFamily: 'IBM Plex Sans, sans-serif', borderRadius: 2,
                }}
              >
                {loading ? 'Creando...' : 'Crear Orden'}
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
