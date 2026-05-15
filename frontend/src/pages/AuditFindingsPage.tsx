import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SparkLine } from '@/components/ui/SparkLine';
import { mockCapas, STATUS_MAP, SEV_MAP } from '@/data/mockData';

type FilterStatus = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'PENDING_VERIFICATION' | 'CLOSED';

const FILTERS: Array<{ key: FilterStatus; label: string }> = [
  { key: 'ALL',                 label: 'Todos' },
  { key: 'OPEN',                label: 'Abierta' },
  { key: 'IN_PROGRESS',         label: 'En Progreso' },
  { key: 'PENDING_VERIFICATION',label: 'Pend. Verif.' },
  { key: 'CLOSED',              label: 'Cerrada' },
];

export default function AuditFindingsPage() {
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const today = '2026-05-14';

  const open    = mockCapas.filter((c) => c.status === 'OPEN').length;
  const inProg  = mockCapas.filter((c) => c.status === 'IN_PROGRESS').length;
  const pendV   = mockCapas.filter((c) => c.status === 'PENDING_VERIFICATION').length;
  const closed  = mockCapas.filter((c) => c.status === 'CLOSED').length;

  const kpis = [
    { label: 'Abiertas',          value: open,   color: '#e67e22', spark: [4, 6, 5, 7, 5, open] },
    { label: 'En Progreso',       value: inProg, color: '#2980b9', spark: [0, 1, 2, 1, 2, inProg] },
    { label: 'Pend. Verificación',value: pendV,  color: '#8b5cf6', spark: [0, 0, 1, 0, 1, pendV] },
    { label: 'Cerradas',          value: closed, color: '#27ae60', spark: [0, 1, 1, 2, 3, closed] },
  ];

  const filtered = filter === 'ALL' ? mockCapas : mockCapas.filter((c) => c.status === filter);

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* Topbar */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>Hallazgos / CAPAs</span>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--sz-accent)', color: '#fff',
          border: 'none', borderRadius: 'var(--sz-radius)',
          padding: '7px 14px', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
        }}>
          <Plus size={14} />
          Nuevo Hallazgo
        </button>
      </div>

      <div style={{ padding: '16px 24px' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {kpis.map((k) => (
            <Card key={k.label} topAccent={k.color}>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
                </div>
                <SparkLine data={k.spark} color={k.color} width={70} height={28} />
              </div>
            </Card>
          ))}
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => {
            const sm = STATUS_MAP[f.key];
            const isActive = filter === f.key;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20,
                border: `1px solid ${isActive && sm ? sm.color : 'var(--sz-border)'}`,
                background: isActive && sm ? sm.bg : 'var(--sz-card)',
                color: isActive && sm ? sm.color : 'var(--sz-muted)',
                cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
              }}>
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <Card>
          <CardHeader title="Acciones Correctivas / Preventivas" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['Código', 'Descripción', 'Área', 'Severidad', 'Tipo', 'Asignado', 'Estado', 'Vence'].map((h) => (
                    <th key={h} style={{
                      padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                      color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase',
                      letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const sm = STATUS_MAP[c.status];
                  const sv = SEV_MAP[c.severity];
                  const overdue = c.due < today && c.status !== 'CLOSED';
                  return (
                    <tr key={c.code} className="sz-table-row"
                      style={{
                        borderBottom: '1px solid var(--sz-border)', cursor: 'pointer',
                        background: overdue ? '#fff9f9' : i % 2 === 0 ? 'var(--sz-card)' : '#fafafa',
                      }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-accent)', fontWeight: 700 }}>{c.code}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--sz-text)', maxWidth: 240 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.desc}</div>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{c.area}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <Badge label={sv.label} color={sv.color} bg={sv.bg} />
                      </td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px',
                          color: c.type === 'CORRECTIVE' ? '#c0392b' : '#2980b9' }}>
                          {c.type === 'CORRECTIVE' ? 'Correctiva' : 'Preventiva'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{c.assigned}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <Badge label={sm.label} color={sm.color} bg={sm.bg} />
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: overdue ? '#c0392b' : 'var(--sz-muted)', fontWeight: overdue ? 700 : 400, whiteSpace: 'nowrap' }}>
                        {c.due}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
