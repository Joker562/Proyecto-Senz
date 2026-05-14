import { useEffect, useState, FormEvent, useCallback } from 'react';
import { api } from '@/services/api';
import { User, Role } from '@/types';
import { UserCheck, UserX, Plus, Pencil, Eye, EyeOff, Edit3, Minus, Shield, Settings2, Save, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';

/* ── Senz palette ── */
const ACCENT = '#e67e22';
const BORDER = '#e4e4e4';
const TEXT   = '#1c1c1c';
const MUTED  = '#888';
const TOPBAR = '#ffffff';
const CARD   = '#ffffff';
const TH_BG  = '#fafafa';
const C_GREEN = '#27ae60';
const C_RED   = '#c0392b';

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador', SUPERVISOR: 'Supervisor', TECHNICIAN: 'Técnico', EXECUTIVE: 'Directivo',
};
const ROLE_COLORS: Record<Role, { bg: string; color: string }> = {
  ADMIN:      { bg: '#fde8e6', color: C_RED },
  SUPERVISOR: { bg: '#f3eeff', color: '#6d28d9' },
  TECHNICIAN: { bg: '#e8f4fd', color: '#2980b9' },
  EXECUTIVE:  { bg: '#e9f7ef', color: C_GREEN },
};

/* ── Módulos del sistema ── */
type ModuleKey = 'dashboard' | 'workOrders' | 'assets' | 'maintenance' | 'calendar' | 'checklists' | 'users' | 'settings';
type RolePerms = Record<ModuleKey, boolean>;
type AllRolePerms = Record<string, RolePerms>;

const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'Dashboard',   workOrders: 'Órdenes de Trabajo', assets: 'Equipos',
  maintenance: 'Mantenimiento', calendar: 'Calendario',      checklists: 'Checklists',
  users: 'Usuarios',        settings: 'Configuración',
};
const MODULES = Object.keys(MODULE_LABELS) as ModuleKey[];

/* ── Permisos visuales (ver/editar) por rol — solo para previsualización ── */
type PermLevel = '✓' | '—' | 'Solo propias';
interface SectionPerm { view: PermLevel; edit: PermLevel }
const ROLE_PERMISSIONS: Record<Role, Record<string, SectionPerm>> = {
  ADMIN: {
    'Dashboard':          { view: '✓', edit: '✓' }, 'Órdenes de Trabajo': { view: '✓', edit: '✓' },
    'Activos':            { view: '✓', edit: '✓' }, 'Mantenimiento':      { view: '✓', edit: '✓' },
    'Checklists':         { view: '✓', edit: '✓' }, 'Usuarios':           { view: '✓', edit: '✓' },
    'Configuración':      { view: '✓', edit: '✓' },
  },
  SUPERVISOR: {
    'Dashboard':          { view: '✓', edit: '—' }, 'Órdenes de Trabajo': { view: '✓', edit: '✓' },
    'Activos':            { view: '✓', edit: '✓' }, 'Mantenimiento':      { view: '✓', edit: '✓' },
    'Checklists':         { view: '✓', edit: '✓' }, 'Usuarios':           { view: '✓', edit: '—' },
    'Configuración':      { view: '—', edit: '—' },
  },
  TECHNICIAN: {
    'Dashboard':          { view: '✓', edit: '—' }, 'Órdenes de Trabajo': { view: 'Solo propias', edit: 'Solo propias' },
    'Activos':            { view: '—', edit: '—' }, 'Mantenimiento':      { view: '—', edit: '—' },
    'Checklists':         { view: '—', edit: '—' }, 'Usuarios':           { view: '—', edit: '—' },
    'Configuración':      { view: '—', edit: '—' },
  },
  EXECUTIVE: {
    'Dashboard':          { view: '✓', edit: '—' }, 'Órdenes de Trabajo': { view: '✓', edit: '—' },
    'Activos':            { view: '—', edit: '—' }, 'Mantenimiento':      { view: '—', edit: '—' },
    'Checklists':         { view: '—', edit: '—' }, 'Usuarios':           { view: '—', edit: '—' },
    'Configuración':      { view: '—', edit: '—' },
  },
};

const emptyForm = { name: '', email: '', password: '', role: 'TECHNICIAN' as Role };
const selStyle: React.CSSProperties = {
  padding: '7px 10px', fontSize: 13, border: `1px solid ${BORDER}`,
  background: '#f9f9f9', color: TEXT, fontFamily: 'IBM Plex Sans, sans-serif',
  borderRadius: 2, outline: 'none', width: '100%', boxSizing: 'border-box',
};

type ExtUser = User & { active: boolean };
type TabKey = 'users' | 'permissions';

export default function UsersPage() {
  const { push } = useToast();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [tab, setTab]             = useState<TabKey>('users');
  const [users, setUsers]         = useState<ExtUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser]   = useState<ExtUser | null>(null);
  const [permUser, setPermUser]   = useState<ExtUser | null>(null);
  const [form, setForm]           = useState(emptyForm);
  const [editForm, setEditForm]   = useState({ name: '', role: 'TECHNICIAN' as Role });
  const [resetUser, setResetUser]     = useState<ExtUser | null>(null);
  const [resetPwd, setResetPwd]       = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError]   = useState('');
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [creating, setCreating]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');

  /* ── Permisos dinámicos ── */
  const [rolePerms, setRolePerms]   = useState<AllRolePerms>({});
  const [editingPerms, setEditingPerms] = useState<AllRolePerms>({});
  const [savingPerms, setSavingPerms]   = useState(false);
  const [permsLoaded, setPermsLoaded]   = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    api.get<ExtUser[]>('/users')
      .then(({ data }) => setUsers(data))
      .finally(() => setLoading(false));
  };
  useEffect(fetchUsers, []);

  const fetchPerms = useCallback(() => {
    api.get<AllRolePerms>('/settings/role-permissions')
      .then(({ data }) => {
        setRolePerms(data);
        setEditingPerms(JSON.parse(JSON.stringify(data)));
        setPermsLoaded(true);
      })
      .catch(() => setPermsLoaded(true));
  }, []);
  useEffect(() => { if (tab === 'permissions') fetchPerms(); }, [tab, fetchPerms]);

  const toggleUser = async (u: ExtUser) => {
    await api.patch(`/users/${u.id}/toggle`);
    push(`${u.name} ${u.active ? 'desactivado' : 'activado'}`, u.active ? 'warning' : 'success');
    fetchUsers();
  };

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setCreating(true);
    try {
      await api.post('/users', form);
      push('Usuario creado correctamente', 'success');
      setShowCreate(false);
      setForm(emptyForm);
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(typeof msg === 'string' ? msg : 'Error al crear el usuario');
    } finally {
      setCreating(false);
    }
  };

  const handleEditOpen = (u: ExtUser) => { setEditUser(u); setEditForm({ name: u.name, role: u.role }); };

  const openReset = (u: ExtUser) => { setResetUser(u); setResetPwd(''); setResetConfirm(''); setResetError(''); setShowResetPwd(false); };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (resetPwd.length < 8) { setResetError('Mínimo 8 caracteres'); return; }
    if (resetPwd !== resetConfirm) { setResetError('Las contraseñas no coinciden'); return; }
    if (!resetUser) return;
    setResetSaving(true);
    setResetError('');
    try {
      await api.patch(`/users/${resetUser.id}/password`, { password: resetPwd });
      push(`Contraseña de ${resetUser.name} actualizada`, 'success');
      setResetUser(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setResetError(msg ?? 'Error al cambiar la contraseña');
    } finally {
      setResetSaving(false);
    }
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    try {
      await api.patch(`/users/${editUser.id}`, editForm);
      push('Usuario actualizado', 'success');
      setEditUser(null);
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      push(msg ?? 'Error al actualizar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleModulePerm = (role: string, module: ModuleKey) => {
    setEditingPerms((prev) => ({
      ...prev,
      [role]: { ...prev[role], [module]: !prev[role][module] },
    }));
  };

  const handleSavePerms = async () => {
    setSavingPerms(true);
    try {
      await api.put('/settings/role-permissions', editingPerms);
      setRolePerms(JSON.parse(JSON.stringify(editingPerms)));
      push('Permisos de roles actualizados. Los cambios se aplican en el próximo inicio de sesión.', 'success');
    } catch {
      push('Error al guardar permisos', 'error');
    } finally {
      setSavingPerms(false);
    }
  };

  const hasChanges = JSON.stringify(rolePerms) !== JSON.stringify(editingPerms);

  const card: React.CSSProperties = { background: CARD, border: `1px solid ${BORDER}`, fontFamily: 'IBM Plex Sans, sans-serif' };

  const PermCell = ({ val }: { val: PermLevel }) => {
    const isYes = val === '✓'; const isSome = val === 'Solo propias';
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: isYes ? C_GREEN : isSome ? ACCENT : '#bbb', fontWeight: isYes || isSome ? 600 : 400, fontSize: 12 }}>
        {isYes ? <Eye size={11} /> : isSome ? <Edit3 size={11} /> : <Minus size={11} />}
        {val}
      </span>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'IBM Plex Sans, sans-serif' }}>

      {/* Topbar */}
      <div style={{ background: TOPBAR, borderBottom: `1px solid ${BORDER}`, padding: '0 24px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {(['users', 'permissions'] as TabKey[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '0 16px', height: 48, fontSize: 13, fontWeight: tab === t ? 600 : 400,
                color: tab === t ? ACCENT : MUTED, background: 'transparent', border: 'none',
                borderBottom: tab === t ? `2px solid ${ACCENT}` : '2px solid transparent',
                cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {t === 'users' ? <><Shield size={13} /> Usuarios</> : <><Settings2 size={13} /> Permisos de Roles</>}
            </button>
          ))}
        </div>
        {tab === 'users' && (
          <button
            onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', fontSize: 12, fontWeight: 600, background: ACCENT, color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}
          >
            <Plus size={13} /> Nuevo Usuario
          </button>
        )}
        {tab === 'permissions' && isAdmin && hasChanges && (
          <button
            onClick={handleSavePerms}
            disabled={savingPerms}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', fontSize: 12, fontWeight: 600, background: C_GREEN, color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif', opacity: savingPerms ? .6 : 1 }}
          >
            <Save size={13} /> {savingPerms ? 'Guardando…' : 'Guardar cambios'}
          </button>
        )}
      </div>

      <div style={{ padding: 24 }}>

        {/* ── Tab: Usuarios ── */}
        {tab === 'users' && (
          <div style={card}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: TH_BG }}>
                  {['Nombre', 'Email', 'Rol', 'Estado', 'Permisos', 'Acciones'].map((h) => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: `2px solid ${BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: MUTED }}>Cargando…</td></tr>
                ) : users.map((u, i) => {
                  const rc = ROLE_COLORS[u.role];
                  return (
                    <tr key={u.id} style={{ background: i % 2 === 0 ? CARD : TH_BG, borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '9px 14px', fontWeight: 600, color: TEXT }}>{u.name}</td>
                      <td style={{ padding: '9px 14px', color: MUTED }}>{u.email}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ background: rc.bg, color: rc.color, padding: '2px 8px', borderRadius: 2, fontWeight: 600, fontSize: 11 }}>
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: u.active ? C_GREEN : '#aaa', fontSize: 12, fontWeight: 600 }}>
                          {u.active ? <UserCheck size={13} /> : <UserX size={13} />}
                          {u.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        <button
                          onClick={() => setPermUser(u)}
                          style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, padding: '3px 8px', borderRadius: 2, cursor: 'pointer', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'IBM Plex Sans, sans-serif' }}
                        >
                          <Shield size={11} /> Ver permisos
                        </button>
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleEditOpen(u)}
                            style={{ background: 'transparent', border: `1px solid ${ACCENT}`, color: ACCENT, padding: '3px 8px', borderRadius: 2, cursor: 'pointer', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'IBM Plex Sans, sans-serif' }}
                          >
                            <Pencil size={11} /> Editar
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => openReset(u)}
                              style={{ background: 'transparent', border: `1px solid #6d28d9`, color: '#6d28d9', padding: '3px 8px', borderRadius: 2, cursor: 'pointer', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'IBM Plex Sans, sans-serif' }}
                            >
                              <KeyRound size={11} /> Contraseña
                            </button>
                          )}
                          <button
                            onClick={() => toggleUser(u)}
                            style={{ background: 'transparent', border: `1px solid ${u.active ? C_RED : C_GREEN}`, color: u.active ? C_RED : C_GREEN, padding: '3px 8px', borderRadius: 2, cursor: 'pointer', fontSize: 11, fontFamily: 'IBM Plex Sans, sans-serif' }}
                          >
                            {u.active ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Tab: Permisos de roles ── */}
        {tab === 'permissions' && (
          <div>
            <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fff4ec', border: `1px solid ${ACCENT}`, borderRadius: 2, fontSize: 12, color: TEXT }}>
              <strong>Nota:</strong> Estos permisos controlan qué módulos son visibles en el menú lateral para cada rol.
              El control de acceso a datos del backend se rige por el rol asignado al usuario.
              Los cambios toman efecto en el siguiente inicio de sesión.
            </div>

            {!permsLoaded ? (
              <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>Cargando permisos…</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: CARD, border: `1px solid ${BORDER}` }}>
                  <thead>
                    <tr style={{ background: TH_BG }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: `2px solid ${BORDER}`, minWidth: 140 }}>Módulo</th>
                      {(['ADMIN', 'SUPERVISOR', 'TECHNICIAN', 'EXECUTIVE'] as Role[]).map((role) => {
                        const rc = ROLE_COLORS[role];
                        return (
                          <th key={role} style={{ padding: '10px 16px', textAlign: 'center', borderBottom: `2px solid ${BORDER}`, minWidth: 120 }}>
                            <span style={{ background: rc.bg, color: rc.color, padding: '3px 10px', borderRadius: 2, fontWeight: 600, fontSize: 11 }}>
                              {ROLE_LABELS[role]}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((module, i) => (
                      <tr key={module} style={{ background: i % 2 === 0 ? CARD : TH_BG, borderBottom: `1px solid ${BORDER}` }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: TEXT }}>{MODULE_LABELS[module]}</td>
                        {(['ADMIN', 'SUPERVISOR', 'TECHNICIAN', 'EXECUTIVE'] as Role[]).map((role) => {
                          const granted = editingPerms[role]?.[module] ?? false;
                          const isAdminModule = role === 'ADMIN';
                          return (
                            <td key={role} style={{ padding: '10px 16px', textAlign: 'center' }}>
                              {isAdmin && !isAdminModule ? (
                                <button
                                  onClick={() => toggleModulePerm(role, module)}
                                  title={granted ? 'Click para revocar acceso' : 'Click para conceder acceso'}
                                  style={{
                                    width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                                    background: granted ? C_GREEN : '#ddd', transition: 'background .2s',
                                    position: 'relative', display: 'inline-block',
                                  }}
                                >
                                  <span style={{
                                    position: 'absolute', top: 2, left: granted ? 18 : 2,
                                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                                    transition: 'left .2s', display: 'block',
                                  }} />
                                </button>
                              ) : (
                                <span style={{ color: granted ? C_GREEN : '#ccc', fontWeight: 600 }}>
                                  {granted ? '✓' : '—'}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!isAdmin && (
              <p style={{ marginTop: 12, fontSize: 12, color: MUTED }}>Solo el Administrador puede modificar los permisos de roles.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Modal: Crear Usuario ── */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, width: '100%', maxWidth: 440, fontFamily: 'IBM Plex Sans, sans-serif' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, fontWeight: 600, fontSize: 14, color: TEXT }}>Nuevo Usuario</div>
            <form onSubmit={handleCreate} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Nombre completo', field: 'name', type: 'text', placeholder: 'Ej: Carlos López' },
                { label: 'Email', field: 'email', type: 'email', placeholder: 'usuario@empresa.com' },
                { label: 'Contraseña', field: 'password', type: 'password', placeholder: 'Mínimo 8 caracteres' },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field}>
                  <label style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>{label} *</label>
                  <input type={type} value={(form as Record<string, string>)[field]} onChange={set(field)} placeholder={placeholder}
                    style={selStyle} required minLength={field === 'password' ? 8 : 2} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>Rol *</label>
                <select value={form.role} onChange={set('role')} style={selStyle}>
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              {formError && <p style={{ color: C_RED, fontSize: 12, background: '#fde8e6', padding: '8px 10px', borderRadius: 2 }}>{formError}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '7px 16px', fontSize: 12, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 2, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}>Cancelar</button>
                <button type="submit" disabled={creating} style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, background: ACCENT, color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif', opacity: creating ? .6 : 1 }}>{creating ? 'Creando…' : 'Crear Usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Editar Usuario ── */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, width: '100%', maxWidth: 480, fontFamily: 'IBM Plex Sans, sans-serif' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, fontWeight: 600, fontSize: 14, color: TEXT }}>
              Editar Usuario — {editUser.name}
            </div>
            <form onSubmit={handleSaveEdit} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>Nombre completo</label>
                <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} style={selStyle} required minLength={2} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>Rol / Nivel de acceso</label>
                <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as Role }))} style={selStyle}>
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              <div style={{ background: '#f9f9f9', border: `1px solid ${BORDER}`, padding: 12, borderRadius: 2 }}>
                <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10, fontWeight: 600 }}>
                  Permisos del rol: {ROLE_LABELS[editForm.role]}
                </div>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', color: MUTED, padding: '3px 6px', fontWeight: 500 }}>Sección</th>
                      <th style={{ textAlign: 'left', color: MUTED, padding: '3px 6px', fontWeight: 500 }}>Ver</th>
                      <th style={{ textAlign: 'left', color: MUTED, padding: '3px 6px', fontWeight: 500 }}>Editar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(ROLE_PERMISSIONS[editForm.role]).map(([section, perms]) => (
                      <tr key={section} style={{ borderTop: `1px solid ${BORDER}` }}>
                        <td style={{ padding: '4px 6px', color: TEXT, fontWeight: 500 }}>{section}</td>
                        <td style={{ padding: '4px 6px' }}><PermCell val={perms.view} /></td>
                        <td style={{ padding: '4px 6px' }}><PermCell val={perms.edit} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                <button type="button" onClick={() => setEditUser(null)} style={{ padding: '7px 16px', fontSize: 12, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 2, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, background: ACCENT, color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif', opacity: saving ? .6 : 1 }}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Resetear contraseña ── */}
      {resetUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, width: '100%', maxWidth: 400, fontFamily: 'IBM Plex Sans, sans-serif' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <KeyRound size={15} color="#6d28d9" />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>Resetear contraseña</div>
                <div style={{ fontSize: 11, color: MUTED }}>{resetUser.name} — {resetUser.email}</div>
              </div>
              <button onClick={() => setResetUser(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={handleResetPassword} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Nueva contraseña', value: resetPwd, onChange: setResetPwd },
                { label: 'Confirmar contraseña', value: resetConfirm, onChange: setResetConfirm },
              ].map(({ label, value, onChange }) => (
                <div key={label}>
                  <label style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>{label} *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showResetPwd ? 'text' : 'password'}
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      style={{ ...selStyle, paddingRight: 36 }}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPwd((v) => !v)}
                      tabIndex={-1}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 0, display: 'flex', alignItems: 'center' }}
                    >
                      {showResetPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              ))}
              {resetError && <p style={{ color: C_RED, fontSize: 12, background: '#fde8e6', padding: '8px 10px', borderRadius: 2, margin: 0 }}>{resetError}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                <button type="button" onClick={() => setResetUser(null)} style={{ padding: '7px 16px', fontSize: 12, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 2, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}>Cancelar</button>
                <button type="submit" disabled={resetSaving} style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, background: '#6d28d9', color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif', opacity: resetSaving ? .6 : 1 }}>
                  {resetSaving ? 'Guardando…' : 'Cambiar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Ver permisos detallados ── */}
      {permUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setPermUser(null)}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, width: '100%', maxWidth: 500, fontFamily: 'IBM Plex Sans, sans-serif' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Shield size={15} color={ROLE_COLORS[permUser.role].color} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>{permUser.name}</div>
                <div style={{ fontSize: 11, color: MUTED }}>Rol: {ROLE_LABELS[permUser.role]}</div>
              </div>
              <button onClick={() => setPermUser(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: 18 }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: TH_BG }}>
                    {['Sección', 'Ver', 'Editar'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', color: MUTED, padding: '7px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(ROLE_PERMISSIONS[permUser.role]).map(([section, perms], i) => (
                    <tr key={section} style={{ background: i % 2 === 0 ? CARD : TH_BG, borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: TEXT }}>{section}</td>
                      <td style={{ padding: '8px 12px' }}><PermCell val={perms.view} /></td>
                      <td style={{ padding: '8px 12px' }}><PermCell val={perms.edit} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 11, color: MUTED, marginTop: 12 }}>
                Para modificar acceso a módulos, usa la pestaña <strong>Permisos de Roles</strong>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
