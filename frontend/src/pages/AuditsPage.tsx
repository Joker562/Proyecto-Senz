import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LineChartSVG } from '@/components/ui/LineChartSVG';
import { SparkLine } from '@/components/ui/SparkLine';
import { mockAudits, mockCapas, mockAuditTrend, STATUS_MAP } from '@/data/mockData';
import CreateAuditModal from '@/components/audits/CreateAuditModal';

const AUDIT_SERIES = [
  { key: 'Corte',    color: '#e67e22' },
  { key: 'Ensamble', color: '#2980b9' },
  { key: 'Pintura',  color: '#27ae60' },
  { key: 'Almacén',  color: '#8b5cf6' },
  { key: 'Calidad',  color: '#c0392b' },
];

function scoreColor(s: number): string {
  if (s >= 90) return '#27ae60';
  if (s >= 70) return '#e67e22';
  return '#c0392b';
}

// Area scores from closed audits
const areaScores: Record<string, number> = {};
mockAudits.filter((a) => a.score !== null).forEach((a) => {
  areaScores[a.area] = a.score!;
});

export default function AuditsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'ALL' | 'CLOSED' | 'SCHEDULED' | 'IN_PROGRESS'>('ALL');
  const [modalOpen, setModalOpen] = useState(false);

  const total     = mockAudits.length;
  const closed    = mockAudits.filter((a) => a.status === 'CLOSED').length;
  const scheduled = mockAudits.filter((a) => a.status === 'SCHEDULED').length;
  const openCapas = mockCapas.filter((c) => c.status !== 'CLOSED').length;

  const avgScore  = mockAudits.filter((a) => a.score !== null).reduce((sum, a, _, arr) => sum + a.score! / arr.length, 0);

  const filtered = filter === 'ALL' ? mockAudits : mockAudits.filter((a) => a.status === filter);

  const kpis = [
    { label: 'Total',        value: total,     color: '#2980b9', spark: [5, 6, 5, 6, 7, total] },
    { label: 'Cerradas',     value: closed,    color: '#27ae60', spark: [3, 4, 4, 5, 4, closed] },
    { label: 'Programadas',  value: scheduled, color: '#e67e22', spark: [1, 2, 1, 1, 2, scheduled] },
    { label: 'CAPAs Abiertas', value: openCapas, color: '#c0392b', spark: [10, 8, 9, 8, 7, openCapas] },
  ];

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* Topbar */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>Auditorías</span>
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
          Nueva Auditoría
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

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16, marginBottom: 16 }}>

          {/* Table */}
          <Card>
            {/* Filter pills */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--sz-border)', display: 'flex', gap: 6 }}>
              {(['ALL', 'CLOSED', 'SCHEDULED', 'IN_PROGRESS'] as const).map((f) => {
                const sm = STATUS_MAP[f];
                const isActive = filter === f;
                return (
                  <button key={f} onClick={() => setFilter(f)} style={{
                    padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 20,
                    border: `1px solid ${isActive && sm ? sm.color : 'var(--sz-border)'}`,
                    background: isActive && sm ? sm.bg : 'transparent',
                    color: isActive && sm ? sm.color : 'var(--sz-muted)',
                    cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
                  }}>
                    {f === 'ALL' ? 'Todas' : STATUS_MAP[f]?.label ?? f}
                  </button>
                );
              })}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    {['Código', 'Título', 'Área', 'Tipo', 'Auditor', 'Estado', 'Puntaje', 'Fecha'].map((h) => (
                      <th key={h} style={{
                        padding: '7px 12px', textAlign: 'left', fontWeight: 600,
                        color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase',
                        letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => {
                    const sm = STATUS_MAP[a.status];
                    return (
                      <tr key={a.id} className="sz-table-row"
                        onClick={() => navigate(`/audits/${a.id}`)}
                        style={{
                          borderBottom: '1px solid var(--sz-border)', cursor: 'pointer',
                          background: i % 2 === 0 ? 'var(--sz-card)' : '#fafafa',
                        }}>
                        <td style={{ padding: '8px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-accent)', fontWeight: 700 }}>{a.code}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--sz-text)', maxWidth: 220 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{a.area}</td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.3px' }}>{a.type}</span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{a.auditor}</td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <Badge label={sm.label} color={sm.color} bg={sm.bg} />
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          {a.score !== null
                            ? <span style={{ fontWeight: 700, fontSize: 13, color: scoreColor(a.score) }}>{a.score}%</span>
                            : <span style={{ color: 'var(--sz-muted)', fontSize: 11 }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{a.date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Side: Puntaje por área */}
          <Card>
            <CardHeader title="Puntaje por Área" />
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(areaScores).map(([area, score]) => (
                <div key={area}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--sz-text)' }}>{area}</span>
                    <span style={{ fontWeight: 700, color: scoreColor(score) }}>{score}%</span>
                  </div>
                  <ProgressBar value={score} color={scoreColor(score)} height={7} />
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--sz-border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--sz-muted)' }}>Promedio</span>
                <span style={{ fontWeight: 800, color: scoreColor(avgScore) }}>{Math.round(avgScore)}%</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Trend chart */}
        <Card>
          <CardHeader title="Tendencia de Puntajes" subtitle="Últimos 6 meses por área" />
          <div style={{ padding: '16px 16px 8px' }}>
            <LineChartSVG
              data={mockAuditTrend}
              xKey="month"
              series={AUDIT_SERIES}
              height={160}
              yMin={40}
              yMax={110}
            />
            <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              {AUDIT_SERIES.map((s) => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--sz-muted)' }}>
                  <div style={{ width: 14, height: 2, background: s.color, borderRadius: 1 }} />
                  {s.key}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <CreateAuditModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => setModalOpen(false)}
      />
    </div>
  );
}
