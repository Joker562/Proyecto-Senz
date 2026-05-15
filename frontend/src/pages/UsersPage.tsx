import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { STATUS_MAP, ROLE_LABELS, type MockUser } from '@/data/mockData';
import { userStore } from '@/data/userStore';
import { useTheme } from '@/theme/ThemeContext';
import CreateUserModal from '@/components/users/CreateUserModal';

export default function UsersPage() {
  const { theme } = useTheme();
  const [users, setUsers] = useState<MockUser[]>(userStore.getAll());
  const [modalOpen, setModalOpen] = useState(false);

  // Sync with store on every mount and when store changes
  useEffect(() => {
    setUsers(userStore.getAll());
    return userStore.subscribe(() => setUsers(userStore.getAll()));
  }, []);

  const handleCreated = (user: MockUser) => {
    userStore.add(user);
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
            {users.length} registrados
          </span>
        </span>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--sz-accent)', color: '#fff',
            border: 'none', borderRadius: 'var(--sz-radius)',
            padding: '7px 14px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
          }}
        >
          <Plus size={14} />
          Nuevo Usuario
        </button>
      </div>

      <div style={{ padding: '16px 24px' }}>
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['Usuario', 'Email', 'Rol', 'Estado', 'Último Acceso'].map((h) => (
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
                  const initials = u.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
                  const sm = STATUS_MAP[u.status];
                  return (
                    <tr key={u.id} className="sz-table-row"
                      style={{
                        borderBottom: '1px solid var(--sz-border)', cursor: 'pointer',
                        background: i % 2 === 0 ? 'var(--sz-card)' : '#fafafa',
                      }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: theme.accent, color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: 12, flexShrink: 0,
                          }}>{initials}</div>
                          <span style={{ fontWeight: 600, color: 'var(--sz-text)' }}>{u.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-muted)' }}>{u.email}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--sz-text)' }}>{ROLE_LABELS[u.role] ?? u.role}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <Badge label={sm.label} color={sm.color} bg={sm.bg} />
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-muted)' }}>{u.lastLogin}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <CreateUserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
