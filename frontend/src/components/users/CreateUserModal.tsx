import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import type { MockUser } from '@/data/mockData';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (user: MockUser) => void;
}

const ACCENT  = '#e67e22';
const C_GREEN = '#27ae60';
const C_RED   = '#c0392b';
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
const errorStyle: React.CSSProperties = {
  fontSize: 10, color: C_RED, marginTop: 4,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INITIAL_FORM = {
  name: '', email: '', role: 'TECHNICIAN', status: 'ACTIVE',
  password: '', confirmPassword: '',
};

const ROLE_OPTIONS = [
  { value: 'ADMIN',      label: 'Administrador' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'TECHNICIAN', label: 'Técnico' },
  { value: 'EXECUTIVE',  label: 'Directivo' },
];

export default function CreateUserModal({ open, onClose, onCreated }: Props) {
  const { push } = useToast();
  const [form, setForm]       = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // ── Validaciones ───────────────────────────────────────────────
  const emailInvalid   = form.email.length > 0 && !EMAIL_RE.test(form.email.trim());
  const emailDuplicate = EMAIL_RE.test(form.email.trim()) && userStore.emailExists(form.email);
  const pwTooShort     = form.password.length > 0 && form.password.length < 8;
  const pwMismatch     = form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  const isValid =
    form.name.trim().length > 0 &&
    EMAIL_RE.test(form.email.trim()) &&
    !emailDuplicate &&
    form.password.length >= 8 &&
    form.password === form.confirmPassword;

  const handleClose = () => {
    setForm(INITIAL_FORM);
    setSubmitted(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      const res = await api.post('/users', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
      });
      const created = res.data;
      const newUser: MockUser = {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role as MockUser['role'],
        status: 'ACTIVE',
        lastLogin: '—',
      };
      setSubmitted(true);

      // Envío de correo de bienvenida
      try {
        const mailRes = await api.post('/email/send', {
          to: newUser.email,
          name: newUser.name,
          subject: 'Bienvenido a Senz — Tu cuenta ha sido creada',
          html: `
            <p style="font-size:14px;line-height:1.6">
              Tu cuenta en el Sistema de Gestión Industrial <strong>Senz</strong> ha sido creada exitosamente.
            </p>
            <table style="font-size:13px;border-collapse:collapse;margin:16px 0">
              <tr><td style="color:#888;padding:4px 12px 4px 0">Usuario:</td><td style="font-weight:600">${newUser.email}</td></tr>
              <tr><td style="color:#888;padding:4px 12px 4px 0">Rol:</td><td>${newUser.role}</td></tr>
            </table>
            <p style="font-size:13px;color:#555">Tu contraseña temporal fue proporcionada por el administrador.</p>
          `,
        });
        const previewUrl = mailRes.data?.previewUrl;
        if (previewUrl) push(`Correo enviado (Ethereal): ${previewUrl}`, 'success');
        else push(`Correo de bienvenida enviado a ${newUser.email}`, 'success');
      } catch {
        // email failure is non-critical
      }

      setTimeout(() => {
        onCreated(newUser);
        handleClose();
      }, 1400);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Error al crear el usuario';
      push(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo Usuario" size="md">
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
            Usuario creado exitosamente
          </div>
          <div style={{ fontSize: 12, color: MUTED, fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Correo de bienvenida enviado a <strong>{form.email}</strong>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Nombre */}
            <div>
              <label style={labelStyle}>Nombre completo *</label>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="ej. María García"
                style={inputStyle}
              />
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>Correo electrónico *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="usuario@empresa.com"
                style={{ ...inputStyle, borderColor: (emailInvalid || emailDuplicate) ? C_RED : BORDER }}
              />
              {emailInvalid   && <div style={errorStyle}>Ingresa un correo válido (ej. nombre@dominio.com)</div>}
              {emailDuplicate && <div style={errorStyle}>Este correo ya está registrado</div>}
            </div>

            {/* Contraseñas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Contraseña *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="Mín. 8 caracteres"
                  style={{ ...inputStyle, borderColor: pwTooShort ? C_RED : BORDER }}
                />
                {pwTooShort && <div style={errorStyle}>Mínimo 8 caracteres</div>}
              </div>
              <div>
                <label style={labelStyle}>Confirmar contraseña *</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => set('confirmPassword', e.target.value)}
                  placeholder="Repetir contraseña"
                  style={{ ...inputStyle, borderColor: pwMismatch ? C_RED : BORDER }}
                />
                {pwMismatch && <div style={errorStyle}>Las contraseñas no coinciden</div>}
              </div>
            </div>

            {/* Rol / Estado */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Rol *</label>
                <select value={form.role} onChange={(e) => set('role', e.target.value)} style={inputStyle}>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Estado *</label>
                <select value={form.status} onChange={(e) => set('status', e.target.value)} style={inputStyle}>
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </select>
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
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
              {loading ? 'Creando...' : 'Crear Usuario'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
