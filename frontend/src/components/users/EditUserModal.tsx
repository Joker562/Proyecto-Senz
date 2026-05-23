import { useState, useEffect, FormEvent } from 'react';
import { X, Eye, EyeOff, Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';

// ─── Tipos ────────────────────────────────────────────────────────────────────

const VALID_ROLES = ['ADMIN', 'SUPERVISOR', 'TECHNICIAN', 'EXECUTIVE'] as const;
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', SUPERVISOR: 'Supervisor',
  TECHNICIAN: 'Técnico', EXECUTIVE: 'Directivo',
};

export interface ApiUser {
  id: string; name: string; email: string; role: string; active: boolean;
}

interface Props {
  open:    boolean;
  user:    ApiUser | null;
  onClose: () => void;
  onSaved: (updated: ApiUser) => void;
}

// ─── Estilos reutilizables ────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)',
  background: '#fafafa', color: 'var(--sz-text)',
  fontFamily: 'IBM Plex Sans, sans-serif', outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--sz-muted)',
  textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4, display: 'block',
};

const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };

// ─── Componente ───────────────────────────────────────────────────────────────

export default function EditUserModal({ open, user, onClose, onSaved }: Props) {
  const { push } = useToast();
  const { user: currentUser } = useAuth();

  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [role,        setRole]        = useState('TECHNICIAN');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [savingPass,  setSavingPass]  = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  // Prellenar form cuando cambia el usuario seleccionado
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setPassword('');
      setErrors({});
      setShowPass(false);
    }
  }, [user]);

  if (!open || !user) return null;

  // ─── Validaciones ──────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errs.name = 'Mínimo 2 caracteres';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Email inválido';
    if (errors.email) errs.email = errors.email; // conservar error de duplicado del servidor
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validatePass(): boolean {
    if (!password) { setErrors((e) => ({ ...e, password: 'Ingresa una contraseña' })); return false; }
    if (password.length < 8) { setErrors((e) => ({ ...e, password: 'Mínimo 8 caracteres' })); return false; }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setErrors((e) => ({ ...e, password: 'Debe tener letras y números' }));
      return false;
    }
    setErrors((e) => { const n = { ...e }; delete n.password; return n; });
    return true;
  }

  // ─── Guardar datos generales ───────────────────────────────────────────────

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const { data } = await api.patch<ApiUser>(`/users/${user.id}`, {
        name:  name.trim(),
        email: email.trim(),
        role,
      });
      push('Usuario actualizado', 'success');
      onSaved(data);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (msg?.includes('email') || msg?.includes('Email')) {
        setErrors((e) => ({ ...e, email: msg ?? 'Email ya registrado' }));
      } else {
        push(msg ?? 'Error al guardar', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  // ─── Cambiar contraseña ────────────────────────────────────────────────────

  const handlePasswordChange = async () => {
    if (!validatePass()) return;
    setSavingPass(true);
    try {
      await api.patch(`/users/${user.id}/password`, { password });
      push('Contraseña actualizada', 'success');
      setPassword('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      push(msg ?? 'Error al cambiar contraseña', 'error');
    } finally {
      setSavingPass(false);
    }
  };

  const isSelf = currentUser?.id === user.id;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        zIndex: 1001, width: '100%', maxWidth: 480,
        background: 'var(--sz-card)', borderRadius: 8,
        border: '1px solid var(--sz-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,.18)',
        fontFamily: 'IBM Plex Sans, sans-serif',
        maxHeight: '90vh', overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid var(--sz-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--sz-accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 12,
            }}>
              {user.name.split(' ').slice(0,2).map((w) => w[0]).join('').toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--sz-text)' }}>Editar Usuario</div>
              <div style={{ fontSize: 11, color: 'var(--sz-muted)' }}>{user.email}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--sz-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 18px 0' }}>

          {/* ── Sección: Datos generales ─────────────────────────────────── */}
          <form onSubmit={handleSave}>
            <div style={{ marginBottom: 12, fontSize: 11, fontWeight: 700, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              Datos Generales
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>

              {/* Nombre completo */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Nombre Completo</label>
                <input
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Carlos Mendoza"
                  style={{ ...inputStyle, borderColor: errors.name ? '#c0392b' : 'var(--sz-border)' }}
                />
                {errors.name && <span style={{ fontSize: 11, color: '#c0392b' }}>{errors.name}</span>}
              </div>

              {/* Email / Username */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Correo / Usuario de acceso</label>
                <input
                  type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((er) => { const n={...er}; delete n.email; return n; }); }}
                  placeholder="correo@empresa.com"
                  style={{ ...inputStyle, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, borderColor: errors.email ? '#c0392b' : 'var(--sz-border)' }}
                />
                {errors.email && <span style={{ fontSize: 11, color: '#c0392b' }}>{errors.email}</span>}
              </div>

              {/* Rol */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Rol / Perfil</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={isSelf}
                  style={{ ...inputStyle, cursor: isSelf ? 'not-allowed' : 'pointer', opacity: isSelf ? .6 : 1 }}
                >
                  {VALID_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                {isSelf && <span style={{ fontSize: 11, color: 'var(--sz-muted)' }}>No puedes cambiar tu propio rol</span>}
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingBottom: 18, borderBottom: '1px solid var(--sz-border)' }}>
              <button
                type="button" onClick={onClose}
                style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, background: 'transparent', border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)', cursor: 'pointer', color: 'var(--sz-muted)', fontFamily: 'IBM Plex Sans, sans-serif' }}
              >Cancelar</button>
              <button
                type="submit" disabled={saving}
                style={{
                  padding: '7px 16px', fontSize: 12, fontWeight: 600,
                  background: saving ? '#aaa' : 'var(--sz-accent)', color: '#fff',
                  border: 'none', borderRadius: 'var(--sz-radius)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: 'IBM Plex Sans, sans-serif',
                }}
              >
                {saving && <Loader2 size={12} className="animate-spin" />}
                {saving ? 'Guardando…' : 'Guardar Cambios'}
              </button>
            </div>
          </form>

          {/* ── Sección: Cambiar contraseña ───────────────────────────────── */}
          <div style={{ paddingBottom: 18, paddingTop: 18 }}>
            <div style={{ marginBottom: 12, fontSize: 11, fontWeight: 700, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              Cambiar Contraseña
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Nueva Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((er) => { const n={...er}; delete n.password; return n; }); }}
                    placeholder="Mín. 8 caracteres con letras y números"
                    style={{ ...inputStyle, paddingRight: 36, borderColor: errors.password ? '#c0392b' : 'var(--sz-border)' }}
                  />
                  <button
                    type="button" onClick={() => setShowPass((v) => !v)}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sz-muted)', padding: 2,
                    }}
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.password && <span style={{ fontSize: 11, color: '#c0392b' }}>{errors.password}</span>}
                {!errors.password && <span style={{ fontSize: 11, color: 'var(--sz-muted)' }}>Usa letras y números. Déjalo en blanco para no cambiarla.</span>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button" onClick={handlePasswordChange}
                  disabled={savingPass || !password}
                  style={{
                    padding: '7px 16px', fontSize: 12, fontWeight: 600,
                    background: (!password || savingPass) ? '#ccc' : '#2c3e50',
                    color: '#fff', border: 'none', borderRadius: 'var(--sz-radius)',
                    cursor: (!password || savingPass) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontFamily: 'IBM Plex Sans, sans-serif',
                  }}
                >
                  {savingPass && <Loader2 size={12} className="animate-spin" />}
                  {savingPass ? 'Actualizando…' : 'Actualizar Contraseña'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
