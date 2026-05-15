import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';

interface CreatedAudit {
  id: string; code: string; title: string; area: string;
  type: string; auditorName: string; scheduledAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (audit: CreatedAudit) => void;
}

const ACCENT  = '#e67e22';
const C_GREEN = '#27ae60';
const BORDER  = '#e4e4e4';
const TEXT    = '#1c1c1c';
const MUTED   = '#888';
const CONTENT = '#f5f5f5';

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

const INITIAL_FORM = { title: '', area: '', type: 'FIVE_S', auditorId: '', scheduledAt: '', notes: '' };

const TYPE_OPTIONS = [
  { value: 'FIVE_S',   label: 'Auditoría 5S' },
  { value: 'PROCESS',  label: 'Auditoría de Proceso' },
  { value: 'SAFETY',   label: 'Auditoría de Seguridad' },
];

const AREAS = ['Producción', 'Ensamble', 'Corte', 'Pintura', 'Almacén', 'Calidad', 'Logística', 'Mantenimiento'];

interface UserOption { id: string; name: string }

export default function CreateAuditModal({ open, onClose, onCreated }: Props) {
  const { push } = useToast();
  const [form, setForm]       = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [users, setUsers]     = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setUsersLoading(true);
    api.get<UserOption[]>('/users')
      .then((r) => setUsers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false));
  }, [open]);

  const isValid = !!(form.title.trim() && form.area && form.auditorId && form.scheduledAt);

  const handleClose = () => {
    setForm(INITIAL_FORM);
    setSubmitted(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      const res = await api.post('/audits', {
        title:       form.title.trim(),
        area:        form.area,
        type:        form.type,
        auditorId:   form.auditorId,
        scheduledAt: form.scheduledAt,
        notes:       form.notes || undefined,
      });
      const audit = res.data;
      setSubmitted(true);
      push('Auditoría programada — notificación enviada al auditor', 'success');
      setTimeout(() => {
        onCreated({
          id:           audit.id,
          code:         audit.code,
          title:        audit.title,
          area:         audit.area,
          type:         audit.type,
          auditorName:  audit.auditor?.name ?? '',
          scheduledAt:  audit.scheduledAt,
        });
        handleClose();
      }, 1500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Error al crear la auditoría';
      push(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Nueva Auditoría" size="md">
      {submitted ? (
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: '#e9f7ef', border: `2px solid ${C_GREEN}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C_GREEN} strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 6, fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Auditoría programada exitosamente
          </div>
          <div style={{ fontSize: 13, color: MUTED, fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Notificación enviada al auditor asignado
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div>
              <label style={labelStyle}>Título *</label>
              <input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="ej. Auditoría 5S — Producción"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Área *</label>
                <select value={form.area} onChange={(e) => set('area', e.target.value)} style={inputStyle}>
                  <option value="">Seleccionar área…</option>
                  {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tipo *</label>
                <select value={form.type} onChange={(e) => set('type', e.target.value)} style={inputStyle}>
                  {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Auditor responsable *</label>
                <select
                  value={form.auditorId}
                  onChange={(e) => set('auditorId', e.target.value)}
                  style={inputStyle}
                  disabled={usersLoading}
                >
                  <option value="">{usersLoading ? 'Cargando…' : 'Seleccionar auditor…'}</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Fecha programada *</label>
                <input
                  type="date"
                  value={form.scheduledAt}
                  onChange={(e) => set('scheduledAt', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Notas / Alcance</label>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Describe el alcance de la auditoría, áreas específicas a revisar..."
                style={{ ...inputStyle, height: 80, resize: 'vertical' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <button
              onClick={handleClose}
              style={{
                padding: '8px 20px', fontSize: 12, background: 'transparent',
                color: TEXT, border: `1px solid ${BORDER}`, cursor: 'pointer',
                fontFamily: 'IBM Plex Sans, sans-serif', borderRadius: 2,
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || loading}
              style={{
                padding: '8px 20px', fontSize: 12, fontWeight: 600,
                background: !isValid || loading ? '#ccc' : ACCENT,
                color: '#fff', border: 'none',
                cursor: !isValid || loading ? 'default' : 'pointer',
                fontFamily: 'IBM Plex Sans, sans-serif', borderRadius: 2,
              }}
            >
              {loading ? 'Creando...' : 'Programar Auditoría'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
