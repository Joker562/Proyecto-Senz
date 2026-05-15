import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';

interface Props { open: boolean; onClose: () => void; onCreated: () => void }

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

const INITIAL_FORM = {
  title: '',
  area: '',
  type: '5S',
  auditor: '',
  auditorEmail: '',
  scheduledDate: '',
  notes: '',
};

const TYPE_LABELS: Record<string, string> = {
  '5S': 'Auditoría 5S',
  PROCESS: 'Auditoría de Proceso',
  SAFETY: 'Auditoría de Seguridad',
};

const AREAS = ['Producción', 'Ensamble', 'Corte', 'Pintura', 'Almacén', 'Calidad', 'Logística', 'Mantenimiento'];

export default function CreateAuditModal({ open, onClose, onCreated }: Props) {
  const { push } = useToast();
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const isValid = form.title.trim() && form.area && form.auditor.trim() && form.scheduledDate;

  const handleClose = () => {
    setForm(INITIAL_FORM);
    setSubmitted(false);
    onClose();
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      await api.post('/audits', {
        title: form.title,
        area: form.area,
        type: form.type,
        auditor: form.auditor,
        scheduledDate: form.scheduledDate,
        notes: form.notes || undefined,
      });

      // Enviar notificación por correo al auditor si se proporcionó email
      if (form.auditorEmail && EMAIL_RE.test(form.auditorEmail.trim())) {
        try {
          const res = await api.post('/email/send', {
            to: form.auditorEmail.trim(),
            name: form.auditor.trim(),
            subject: `Auditoría asignada: ${form.title}`,
            html: `
              <p style="font-size:14px;line-height:1.6">
                Se te ha asignado una nueva auditoría en el sistema <strong>Senz</strong>.
              </p>
              <table style="font-size:13px;border-collapse:collapse;margin:16px 0">
                <tr><td style="color:#888;padding:4px 12px 4px 0">Título:</td><td style="font-weight:600">${form.title}</td></tr>
                <tr><td style="color:#888;padding:4px 12px 4px 0">Área:</td><td>${form.area}</td></tr>
                <tr><td style="color:#888;padding:4px 12px 4px 0">Tipo:</td><td>${TYPE_LABELS[form.type] ?? form.type}</td></tr>
                <tr><td style="color:#888;padding:4px 12px 4px 0">Fecha programada:</td><td>${form.scheduledDate}</td></tr>
              </table>
              ${form.notes ? `<p style="font-size:13px;color:#555"><strong>Notas:</strong> ${form.notes}</p>` : ''}
              <p style="font-size:13px;color:#555">Accede al sistema para revisar los detalles y confirmar tu asistencia.</p>
            `,
          });
          const previewUrl = res.data?.previewUrl;
          if (previewUrl) {
            push(`Notificación enviada (Ethereal): ${previewUrl}`, 'success');
          } else {
            push(`Notificación enviada a ${form.auditorEmail}`, 'success');
          }
        } catch {
          push('Auditoría creada. No se pudo enviar la notificación por correo.', 'error');
        }
      }

      setSubmitted(true);
      push('Auditoría creada y programada', 'success');
      setTimeout(() => {
        onCreated();
        handleClose();
      }, 1500);
    } catch {
      push('Error al crear la auditoría', 'error');
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
          <div style={{ fontSize: 13, color: MUTED, fontFamily: 'IBM Plex Sans, sans-serif' }}>Cerrando…</div>
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
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Auditor responsable *</label>
                <input
                  value={form.auditor}
                  onChange={(e) => set('auditor', e.target.value)}
                  placeholder="Nombre del auditor"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Fecha programada *</label>
                <input
                  type="date"
                  value={form.scheduledDate}
                  onChange={(e) => set('scheduledDate', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Correo del auditor <span style={{ color: '#aaa', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(para notificación)</span></label>
              <input
                type="email"
                value={form.auditorEmail}
                onChange={(e) => set('auditorEmail', e.target.value)}
                placeholder="auditor@empresa.com"
                style={inputStyle}
              />
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
