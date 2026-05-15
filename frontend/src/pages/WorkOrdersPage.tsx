import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { mockWorkOrders, STATUS_MAP, PRI_MAP } from '@/data/mockData';
import type { MockWorkOrder } from '@/data/mockData';
import CreateWorkOrderModal from '@/components/work-orders/CreateWorkOrderModal';

type FilterStatus = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

const FILTERS: Array<{ key: FilterStatus; label: string }> = [
  { key: 'ALL',         label: 'Todos' },
  { key: 'PENDING',     label: 'Pendiente' },
  { key: 'IN_PROGRESS', label: 'En Progreso' },
  { key: 'COMPLETED',   label: 'Completada' },
  { key: 'CANCELLED',   label: 'Cancelada' },
];

export default function WorkOrdersPage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('ALL');
  const [modalOpen, setModalOpen] = useState(false);

  const filtered: MockWorkOrder[] = activeFilter === 'ALL'
    ? mockWorkOrders
    : mockWorkOrders.filter((o) => o.status === activeFilter);

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* Topbar */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>Órdenes de Trabajo</span>
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
          Nueva OT
        </button>
      </div>

      <div style={{ padding: '16px 24px' }}>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => {
            const sm = STATUS_MAP[f.key];
            const isActive = activeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                style={{
                  padding: '5px 14px', fontSize: 12, fontWeight: 600,
                  borderRadius: 20, cursor: 'pointer',
                  border: `1px solid ${isActive && sm ? sm.color : 'var(--sz-border)'}`,
                  background: isActive && sm ? sm.bg : 'var(--sz-card)',
                  color: isActive && sm ? sm.color : 'var(--sz-muted)',
                  transition: 'all .15s', fontFamily: 'IBM Plex Sans, sans-serif',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['Código', 'Título', 'Activo', 'Área', 'Técnico', 'Prioridad', 'Estado', 'Fecha'].map((h) => (
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
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '32px 0', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>
                      Sin órdenes para este filtro.
                    </td>
                  </tr>
                ) : filtered.map((o, i) => {
                  const sm = STATUS_MAP[o.status];
                  const pm = PRI_MAP[o.priority];
                  return (
                    <tr
                      key={o.id}
                      className="sz-table-row"
                      onClick={() => navigate('/work-orders')}
                      style={{
                        borderBottom: '1px solid var(--sz-border)', cursor: 'pointer',
                        background: o.overdue ? '#fff9f9' : i % 2 === 0 ? 'var(--sz-card)' : '#fafafa',
                      }}
                    >
                      <td style={{ padding: '9px 14px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-accent)', fontWeight: 700 }}>{o.id}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--sz-text)', maxWidth: 220 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</div>
                      </td>
                      <td style={{ padding: '9px 14px', color: 'var(--sz-muted)', maxWidth: 160 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.asset}</div>
                      </td>
                      <td style={{ padding: '9px 14px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{o.area}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{o.tech}</td>
                      <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: pm.color, fontWeight: 700, fontSize: 11 }}>{pm.label}</span>
                      </td>
                      <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                        <Badge label={sm.label} color={sm.color} bg={sm.bg} />
                      </td>
                      <td style={{ padding: '9px 14px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: o.overdue ? '#c0392b' : 'var(--sz-muted)', whiteSpace: 'nowrap' }}>
                        {o.date}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <CreateWorkOrderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => setModalOpen(false)}
      />
    </div>
  );
}
