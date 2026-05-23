import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/theme/ThemeContext';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import CreateUserModal from '@/components/users/CreateUserModal';
import EditUserModal, { type ApiUser } from '@/components/users/EditUserModal';

// ─── Maps ─────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', SUPERVISOR: 'Supervisor',
  TECHNICIAN: 'Técnico', EXECUTIVE: 'Directivo',
};

const STATUS_MAP = {
  active:   { label: 'Activo',   color: '#27ae60', bg: '#eafaf1' },
  inactive: { label: 'Inactivo', color: '#95a5a6', bg: '#f2f3f4' },
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { theme }   = useTheme();
  const { push }    = useToast();

  const [users,       setUsers]       = useState<ApiUser[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [createOpen,  setCreateOpen]  = useState(false);
  const [editUser,    setEditUser]    = useState<ApiUser | null>(null);
  const [togglingId,  setTogglingId]  = useState<string | null>(null);

  // ─── Carga de usuarios desde API ──────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ApiUser[]>('/users');
      setUsers(data);
    } catch {
      push('Error al cargar usuarios', 'error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ─── Toggle activo / inactivo ─────────────────────────────────────────────

  const handleToggle = async (user: ApiUser) => {
    setTogglingId(user.id);
    try {
      const { data } = await api.patch<{ id: string; active: boolean }>(`/users/${user.id}/toggle`);
      setUsers((prev) => prev.map((u) => u.id === data.id ? { ...u, active: data.active } : u));
      push(`${user.name} ${data.active ? 'activado' : 'desactivado'}`, 'success');
    } catch {
      push('Error al cambiar estado', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  // ─── Callbacks de modales ─────────────────────────────────────────────────

  const handleCreated = () => fetchUsers();

  const handleSaved = (updated: ApiUser) => {
    setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
  };

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* Topbar */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>
          Usuarios
          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--sz-muted)' }}>
            {loading ? '…' : `${users.length} registrado${users.length !== 1 ? 's' : ''}`}
          </span>
        </span>
        <button
          onClick={() => setCreateOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--sz-accent)', color: '#fff',
            border: 'none', borderRadius: 'var(--sz-radius)',
            padding: '7px 14px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
          }}
        >
          <Plus size={14} /> Nuevo Usuario
        </button>
      </div>

      <div style={{ padding: '16px 24px' }}>
        <Card>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>Cargando usuarios…</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    {['Usuario', 'Email / Username', 'Rol', 'Estado', 'Acciones'].map((h) => (
                      <th key={h} style={{
                        padding: '8px 14px', textAlign: 'left', fontWeight: 600,
                        color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase',
                        letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)',
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => {
                    const initials = u.name.split(' ').slice(0,2).map((w) => w[0]).join('').toUpperCase();
                    const sm = u.active ? STATUS_MAP.active : STATUS_MAP.inactive;
                    const toggling = togglingId === u.id;
                    return (
                      <tr key={u.id} className="sz-table-row"
                        style={{
                          borderBottom: '1px solid var(--sz-border)',
                          background: i % 2 === 0 ? 'var(--sz-card)' : '#fafafa',
                        }}>

                        {/* Avatar + nombre */}
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: u.active ? theme.accent : '#bdc3c7',
                              color: '#fff', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0,
                            }}>{initials}</div>
                            <span style={{ fontWeight: 600, color: 'var(--sz-text)' }}>{u.name}</span>
                          </div>
                        </td>

                        {/* Email */}
                        <td style={{ padding: '10px 14px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-muted)' }}>
                          {u.email}
                        </td>

                        {/* Rol */}
                        <td style={{ padding: '10px 14px', color: 'var(--sz-text)' }}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </td>

                        {/* Estado */}
                        <td style={{ padding: '10px 14px' }}>
                          <Badge label={sm.label} color={sm.color} bg={sm.bg} />
                        </td>

                        {/* Acciones */}
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => setEditUser(u)}
                              title="Editar usuario"
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                                background: 'transparent', border: '1px solid var(--sz-border)',
                                borderRadius: 'var(--sz-radius)', cursor: 'pointer',
                                color: 'var(--sz-text)', fontFamily: 'IBM Plex Sans, sans-serif',
                              }}
                            >
                              <Pencil size={11} /> Editar
                            </button>
                            <button
                              onClick={() => handleToggle(u)}
                              disabled={toggling}
                              title={u.active ? 'Desactivar' : 'Activar'}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                                background: 'transparent',
                                border: `1px solid ${u.active ? '#e74c3c' : '#27ae60'}`,
                                borderRadius: 'var(--sz-radius)',
                                cursor: toggling ? 'not-allowed' : 'pointer',
                                color: u.active ? '#e74c3c' : '#27ae60',
                                opacity: toggling ? .5 : 1,
                                fontFamily: 'IBM Plex Sans, sans-serif',
                              }}
                            >
                              {u.active
                                ? <><ToggleRight size={11} /> Desactivar</>
                                : <><ToggleLeft size={11} /> Activar</>}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      {/* Modales */}
      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { handleCreated(); setCreateOpen(false); }}
      />
      <EditUserModal
        open={!!editUser}
        user={editUser}
        onClose={() => setEditUser(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}
