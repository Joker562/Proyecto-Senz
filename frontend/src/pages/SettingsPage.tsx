import { useEffect, useState, FormEvent } from 'react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { Plus, Trash2, Settings, Shield, Mail, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { type AllPerms, type PermKey, DEFAULT_PERMISSIONS, usePermissions } from '@/hooks/usePermissions';

// ─── Paleta consistente con el resto de la app ────────────────────────────────
const ACCENT = '#e67e22';
const BORDER = 'var(--sz-border)';
const TEXT   = 'var(--sz-text)';
const MUTED  = 'var(--sz-muted)';
const CARD   = 'var(--sz-card)';
const TH_BG  = '#fafafa';
const C_RED  = '#c0392b';

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', fontSize: 13, border: `1px solid ${BORDER}`,
  background: '#fafafa', color: TEXT, fontFamily: 'IBM Plex Sans, sans-serif',
  borderRadius: 3, outline: 'none', width: '100%', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: MUTED,
  textTransform: 'uppercase', letterSpacing: '.4px',
  marginBottom: 4, display: 'block',
};

// ─── Definición de la matriz de permisos ──────────────────────────────────────

type PermGroup = { label: string; keys: { key: PermKey; label: string }[] };

const PERM_GROUPS: PermGroup[] = [
  {
    label: 'Módulo Mantenimiento',
    keys: [
      { key: 'dashboard',   label: 'Dashboard' },
      { key: 'workOrders',  label: 'Órdenes de Trabajo' },
      { key: 'assets',      label: 'Equipos' },
      { key: 'maintenance', label: 'Planes de Mant.' },
      { key: 'calendar',    label: 'Calendario' },
      { key: 'checklists',  label: 'Checklists' },
    ],
  },
  {
    label: 'Módulos principales',
    keys: [
      { key: 'fleet',  label: 'Flota' },
      { key: 'oee',    label: 'OEE' },
      { key: 'audits', label: 'Auditoría' },
    ],
  },
  {
    label: 'Administración',
    keys: [
      { key: 'users',    label: 'Usuarios' },
      { key: 'settings', label: 'Configuración' },
    ],
  },
];

const ROLES = ['ADMIN', 'SUPERVISOR', 'TECHNICIAN', 'EXECUTIVE'];
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', SUPERVISOR: 'Supervisor',
  TECHNICIAN: 'Técnico', EXECUTIVE: 'Directivo',
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Area { id: string; name: string; createdAt: string }

interface SmtpConfig {
  host: string; port: number; user: string; pass: string;
  from: string; fromName: string; secure: boolean;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'areas' | 'permissions' | 'notifications';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'areas',         label: 'Áreas',          icon: Settings },
  { id: 'permissions',   label: 'Permisos',        icon: Shield   },
  { id: 'notifications', label: 'Notificaciones',  icon: Mail     },
];

// ─── Componente principal ─────────────────────────────────────────────────────

export default function SettingsPage() {
  const { push }    = useToast();
  const { fetchPermissions } = usePermissions();
  const [tab, setTab] = useState<Tab>('areas');

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'IBM Plex Sans, sans-serif' }}>

      {/* Topbar */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${BORDER}`, padding: '0 24px', height: 48, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Settings size={16} color={MUTED} />
        <span style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Configuración</span>
      </div>

      {/* Tabs nav */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${BORDER}`, padding: '0 24px', display: 'flex', gap: 0 }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '11px 16px', fontSize: 13, fontWeight: tab === id ? 700 : 400,
              color: tab === id ? ACCENT : MUTED,
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: tab === id ? `2px solid ${ACCENT}` : '2px solid transparent',
              fontFamily: 'IBM Plex Sans, sans-serif',
              transition: 'color .15s',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: 24, maxWidth: 860 }}>
        {tab === 'areas'         && <AreasTab push={push} />}
        {tab === 'permissions'   && <PermissionsTab push={push} onSaved={fetchPermissions} />}
        {tab === 'notifications' && <NotificationsTab push={push} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: Gestión de Áreas
// ═══════════════════════════════════════════════════════════════════════════════

function AreasTab({ push }: { push: (msg: string, type: 'success'|'error') => void }) {
  const [areas,      setAreas]      = useState<Area[]>([]);
  const [newArea,    setNewArea]    = useState('');
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAreas = () => {
    setLoading(true);
    api.get<Area[]>('/areas')
      .then(({ data }) => setAreas(data))
      .finally(() => setLoading(false));
  };

  useEffect(fetchAreas, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!newArea.trim()) return;
    setSaving(true);
    try {
      await api.post('/areas', { name: newArea.trim() });
      push(`Área "${newArea.trim()}" creada`, 'success');
      setNewArea('');
      fetchAreas();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      push(msg ?? 'Error al crear área', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (area: Area) => {
    if (!confirm(`¿Eliminar el área "${area.name}"?`)) return;
    setDeletingId(area.id);
    try {
      await api.delete(`/areas/${area.id}`);
      push(`Área "${area.name}" eliminada`, 'success');
      fetchAreas();
    } catch {
      push('Error al eliminar el área', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <SectionCard title="Gestión de Áreas" subtitle={`${areas.length} área${areas.length !== 1 ? 's' : ''}`}>
      <p style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>
        Las áreas clasifican activos y órdenes de trabajo según la estructura de tu planta.
      </p>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <input
          value={newArea} onChange={(e) => setNewArea(e.target.value)}
          placeholder="Nombre del área (ej: Corte, Costura, Almacén…)"
          style={{ ...inputStyle, flex: 1 }} maxLength={60}
        />
        <button type="submit" disabled={saving || !newArea.trim()} style={btnPrimary(!!newArea.trim() && !saving)}>
          <Plus size={13} /> {saving ? 'Guardando…' : 'Agregar'}
        </button>
      </form>

      {loading ? (
        <p style={{ color: MUTED, fontSize: 13 }}>Cargando…</p>
      ) : areas.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No hay áreas registradas.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: TH_BG }}>
              {['Nombre', 'Creada', ''].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {areas.map((area, i) => (
              <tr key={area.id} style={{ background: i % 2 === 0 ? CARD : TH_BG, borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: TEXT }}>{area.name}</td>
                <td style={{ padding: '8px 12px', color: MUTED }}>
                  {new Date(area.createdAt).toLocaleDateString('es', { day:'2-digit', month:'short', year:'numeric' })}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                  <button
                    onClick={() => handleDelete(area)} disabled={deletingId === area.id}
                    style={{ background:'transparent', border:`1px solid ${C_RED}`, color:C_RED, padding:'3px 8px', borderRadius:2, cursor:'pointer', fontSize:11, display:'inline-flex', alignItems:'center', gap:4, fontFamily:'IBM Plex Sans,sans-serif', opacity: deletingId === area.id ? .5 : 1 }}
                  >
                    <Trash2 size={11} /> Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: Matriz de Permisos
// ═══════════════════════════════════════════════════════════════════════════════

function PermissionsTab({ push, onSaved }: { push: (m:string,t:'success'|'error')=>void; onSaved: ()=>void }) {
  const [perms,   setPerms]   = useState<AllPerms>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    api.get<AllPerms>('/settings/role-permissions')
      .then(({ data }) => {
        const merged: AllPerms = {};
        for (const role of ROLES) {
          merged[role] = { ...DEFAULT_PERMISSIONS[role], ...(data[role] ?? {}) };
        }
        setPerms(merged);
      })
      .catch(() => setPerms(DEFAULT_PERMISSIONS))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (role: string, key: PermKey) => {
    if (role === 'ADMIN') return; // ADMIN siempre tiene todo
    setPerms((prev) => ({
      ...prev,
      [role]: { ...prev[role], [key]: !prev[role][key] },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings/role-permissions', perms);
      push('Permisos guardados correctamente', 'success');
      onSaved();
    } catch {
      push('Error al guardar permisos', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPerms(DEFAULT_PERMISSIONS);
    push('Permisos restablecidos a valores por defecto (sin guardar)', 'success');
  };

  if (loading) return <p style={{ color: MUTED, fontSize: 13 }}>Cargando permisos…</p>;

  return (
    <SectionCard
      title="Matriz de Permisos por Rol"
      subtitle="Define qué pantallas y módulos puede ver cada perfil de usuario"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleReset} style={btnSecondary}>Restablecer</button>
          <button onClick={handleSave} disabled={saving} style={btnPrimary(!saving)}>
            {saving ? <><Loader2 size={12} className="animate-spin" /> Guardando…</> : <><Check size={12} /> Guardar</>}
          </button>
        </div>
      }
    >
      <p style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>
        El rol <strong>Administrador</strong> siempre tiene acceso completo y no puede ser restringido.
        Los cambios aplican inmediatamente al menú de navegación de cada usuario.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: TH_BG }}>
              <th style={{ ...thStyle, textAlign: 'left', minWidth: 160 }}>Pantalla / Módulo</th>
              {ROLES.map((role) => (
                <th key={role} style={{ ...thStyle, textAlign: 'center', minWidth: 100 }}>
                  <div style={{ color: role === 'ADMIN' ? ACCENT : TEXT }}>{ROLE_LABELS[role]}</div>
                  {role === 'ADMIN' && <div style={{ fontSize: 9, color: MUTED, fontWeight: 400, marginTop: 1 }}>Superusuario</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERM_GROUPS.map((group) => (
              <>
                {/* Separador de grupo */}
                <tr key={`group-${group.label}`}>
                  <td colSpan={ROLES.length + 1} style={{ padding: '10px 12px 4px', fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.5px', background: TH_BG, borderTop: `1px solid ${BORDER}` }}>
                    {group.label}
                  </td>
                </tr>
                {group.keys.map(({ key, label }, i) => (
                  <tr key={key} style={{ background: i % 2 === 0 ? CARD : TH_BG, borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '9px 12px', fontWeight: 500, color: TEXT }}>{label}</td>
                    {ROLES.map((role) => {
                      const checked = perms[role]?.[key] ?? false;
                      const isAdmin = role === 'ADMIN';
                      return (
                        <td key={role} style={{ padding: '9px 12px', textAlign: 'center' }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: isAdmin ? 'not-allowed' : 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isAdmin}
                              onChange={() => toggle(role, key)}
                              style={{ width: 15, height: 15, accentColor: ACCENT, cursor: isAdmin ? 'not-allowed' : 'pointer' }}
                            />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: Configuración SMTP / Notificaciones
// ═══════════════════════════════════════════════════════════════════════════════

const SMTP_EMPTY: SmtpConfig = { host:'', port:587, user:'', pass:'', from:'', fromName:'', secure:false };
const PASS_MASK = '••••••••';

function NotificationsTab({ push }: { push: (m:string,t:'success'|'error')=>void }) {
  const [cfg,         setCfg]        = useState<SmtpConfig>(SMTP_EMPTY);
  const [loading,     setLoading]    = useState(true);
  const [saving,      setSaving]     = useState(false);
  const [showPass,    setShowPass]   = useState(false);
  const [passEditing, setPassEditing] = useState(false);
  const [hasSavedPass, setHasSavedPass] = useState(false); // contraseña ya configurada en DB

  useEffect(() => {
    api.get<SmtpConfig>('/settings/smtp-config')
      .then(({ data }) => {
        setHasSavedPass(!!data.pass); // backend devuelve PASS_MASK si hay contraseña guardada
        setCfg({ ...data, pass: '' }); // nunca poner la máscara como valor del input
      })
      .catch(() => { setCfg(SMTP_EMPTY); setHasSavedPass(false); })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field: keyof SmtpConfig, value: string | boolean | number) => {
    setCfg((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!cfg.host.trim() || !cfg.user.trim()) {
      push('El servidor SMTP y el usuario son obligatorios', 'error');
      return;
    }
    setSaving(true);
    try {
      // Si no se editó la contraseña enviar PASS_MASK para que el backend conserve la existente
      const payload = { ...cfg, pass: passEditing ? cfg.pass : PASS_MASK };
      const { data } = await api.put<SmtpConfig>('/settings/smtp-config', payload);
      setHasSavedPass(!!data.pass);
      setCfg({ ...data, pass: '' }); // nunca poner la máscara como valor del input
      setPassEditing(false);
      setShowPass(false);
      push('Configuración SMTP guardada', 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      push(msg ?? 'Error al guardar configuración', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: MUTED, fontSize: 13 }}>Cargando configuración…</p>;

  const field2Col = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } as React.CSSProperties;

  return (
    <SectionCard
      title="Configuración de Correo (SMTP)"
      subtitle="Proveedor de correo para envíos automatizados del sistema"
    >
      <div style={{ background: '#fffbe6', border: '1px solid #f0d060', borderRadius: 4, padding: '10px 14px', fontSize: 12, color: '#856404', marginBottom: 20 }}>
        <strong>Nota:</strong> Si no hay configuración guardada, el sistema usa Ethereal (correo de prueba) o las variables de entorno <code>SMTP_*</code> del servidor.
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Fila 1: Servidor + Puerto */}
        <div style={field2Col}>
          <div>
            <label style={labelStyle}>Servidor SMTP</label>
            <input value={cfg.host} onChange={(e) => handleChange('host', e.target.value)}
              placeholder="smtp.gmail.com" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Puerto</label>
            <input type="number" value={cfg.port} onChange={(e) => handleChange('port', Number(e.target.value))}
              placeholder="587" style={inputStyle} min={1} max={65535} />
          </div>
        </div>

        {/* Fila 2: Usuario + Contraseña */}
        <div style={field2Col}>
          <div>
            <label style={labelStyle}>Correo / Usuario SMTP</label>
            <input type="email" value={cfg.user} onChange={(e) => handleChange('user', e.target.value)}
              placeholder="notificaciones@empresa.com"
              style={{ ...inputStyle, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }} />
          </div>
          <div>
            <label style={labelStyle}>
              Contraseña / Token de App
              {!passEditing && (
                <button type="button"
                  onClick={() => { setCfg((p) => ({ ...p, pass: '' })); setPassEditing(true); setShowPass(false); }}
                  style={{ marginLeft: 8, fontSize: 10, color: ACCENT, background:'none', border:'none', cursor:'pointer', fontFamily:'IBM Plex Sans,sans-serif' }}>
                  {hasSavedPass ? 'Cambiar' : 'Configurar'}
                </button>
              )}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={cfg.pass}
                readOnly={!passEditing}
                onChange={(e) => { if (passEditing) handleChange('pass', e.target.value); }}
                placeholder={
                  passEditing
                    ? 'Pega aquí el token de app (sin espacios)'
                    : hasSavedPass
                      ? '● Contraseña configurada'
                      : 'Sin contraseña — haz clic en Configurar'
                }
                style={{
                  ...inputStyle,
                  paddingRight: passEditing ? 36 : 12,
                  fontFamily: 'IBM Plex Mono, monospace', fontSize: 12,
                  cursor: !passEditing ? 'default' : 'text',
                  color: !passEditing && hasSavedPass ? '#27ae60' : TEXT,
                }}
              />
              {passEditing && (
                <button type="button" onClick={() => setShowPass((v) => !v)}
                  style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:MUTED, padding:2 }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Fila 3: Nombre emisor + Email emisor */}
        <div style={field2Col}>
          <div>
            <label style={labelStyle}>Nombre del Emisor</label>
            <input value={cfg.fromName} onChange={(e) => handleChange('fromName', e.target.value)}
              placeholder="Senz — Gestión Industrial" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Correo Emisor (From)</label>
            <input type="email" value={cfg.from} onChange={(e) => handleChange('from', e.target.value)}
              placeholder="igual que usuario si se omite"
              style={{ ...inputStyle, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }} />
          </div>
        </div>

        {/* Fila 4: SSL/TLS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: TEXT }}>
            <input
              type="checkbox" checked={cfg.secure} onChange={(e) => handleChange('secure', e.target.checked)}
              style={{ width: 15, height: 15, accentColor: ACCENT, cursor: 'pointer' }}
            />
            Usar SSL/TLS (puerto 465 generalmente)
          </label>
          <span style={{ fontSize: 11, color: MUTED }}>— desmarca para STARTTLS (587)</span>
        </div>

        {/* Botón guardar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
          <button type="submit" disabled={saving} style={btnPrimary(!saving)}>
            {saving ? <><Loader2 size={12} className="animate-spin" /> Guardando…</> : <><Check size={12} /> Guardar Configuración</>}
          </button>
        </div>
      </form>

      {/* Proveedores comunes */}
      <div style={{ marginTop: 28, borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>
          Referencia rápida — Proveedores comunes
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          {[
            { name: 'Gmail',     host: 'smtp.gmail.com',         port: 587, note: 'Usar contraseña de app' },
            { name: 'Outlook',   host: 'smtp.office365.com',     port: 587, note: 'TLS requerido' },
            { name: 'SendGrid',  host: 'smtp.sendgrid.net',      port: 587, note: 'API Key como contraseña' },
            { name: 'Mailgun',   host: 'smtp.mailgun.org',       port: 587, note: 'SMTP credentials en panel' },
          ].map((p) => (
            <button
              key={p.name} type="button"
              onClick={() => setCfg((prev) => ({ ...prev, host: p.host, port: p.port, secure: false }))}
              style={{ textAlign: 'left', padding: '8px 10px', background: TH_BG, border: `1px solid ${BORDER}`, borderRadius: 4, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{p.name}</div>
              <div style={{ fontSize: 10, color: MUTED, fontFamily: 'IBM Plex Mono, monospace' }}>{p.host}:{p.port}</div>
              <div style={{ fontSize: 10, color: MUTED }}>{p.note}</div>
            </button>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Componentes de utilidad ──────────────────────────────────────────────────

function SectionCard({ title, subtitle, actions, children }: {
  title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>{title}</span>
          {subtitle && <span style={{ marginLeft: 8, fontSize: 11, color: MUTED }}>{subtitle}</span>}
        </div>
        {actions}
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '7px 12px', fontWeight: 600, color: MUTED, fontSize: 11,
  textTransform: 'uppercase', letterSpacing: '.4px',
  borderBottom: `1px solid ${BORDER}`,
};

function btnPrimary(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 16px', fontSize: 12, fontWeight: 600,
    background: active ? ACCENT : '#ccc', color: '#fff',
    border: 'none', borderRadius: 3, cursor: active ? 'pointer' : 'not-allowed',
    fontFamily: 'IBM Plex Sans, sans-serif', whiteSpace: 'nowrap',
  };
}

const btnSecondary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', fontSize: 12, fontWeight: 600,
  background: 'transparent', border: `1px solid ${BORDER}`,
  borderRadius: 3, cursor: 'pointer',
  color: MUTED, fontFamily: 'IBM Plex Sans, sans-serif',
};
