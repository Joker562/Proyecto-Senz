import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AlertTriangle, ClipboardCheck, TrendingUp } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SparkLine } from '@/components/ui/SparkLine';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LineChartSVG } from '@/components/ui/LineChartSVG';
import { api } from '@/services/api';
import {
  mockStats, mockWorkOrders, mockAuditTrend,
  STATUS_MAP, PRI_MAP,
} from '@/data/mockData';

const AUDIT_SERIES = [
  { key: 'Corte',    color: '#e67e22' },
  { key: 'Ensamble', color: '#2980b9' },
  { key: 'Pintura',  color: '#27ae60' },
  { key: 'Almacén',  color: '#8b5cf6' },
  { key: 'Calidad',  color: '#c0392b' },
];

// Mock sparkline data per KPI (last 6 periods)
const SPARK = {
  pending:    [6, 9, 7, 10, 8, 8],
  inProgress: [3, 4, 6, 5, 4, 5],
  completed:  [38, 40, 43, 44, 45, 47],
  overdue:    [1, 2, 1, 3, 2, 3],
};

// Orders per area
function getByArea() {
  const m: Record<string, number> = {};
  mockWorkOrders.forEach((o) => { m[o.area] = (m[o.area] ?? 0) + 1; });
  return m;
}

interface AuditDashboard {
  capaStats: { total: number; open: number; inProgress: number; pendingVerification: number; closed: number; overdue: number };
  byArea: { area: string; count: number; avgScore: number | null }[];
}
interface UpcomingAudit { id: string; code: string; title: string; area: string; scheduledAt: string; auditor: { name: string } }
interface RecurrentItem { description: string; area: string; total: number; fails: number; failRate: number }

export default function DashboardPage() {
  const navigate = useNavigate();
  const { pending, inProgress, completed, overdue } = mockStats;
  const byArea = getByArea();
  const maxArea = Math.max(...Object.values(byArea), 1);

  const [auditDash, setAuditDash]       = useState<AuditDashboard | null>(null);
  const [upcomingAudits, setUpcomingAudits] = useState<UpcomingAudit[]>([]);
  const [recurrence, setRecurrence]     = useState<RecurrentItem[]>([]);

  useEffect(() => {
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString();
    const now  = new Date().toISOString();

    Promise.allSettled([
      api.get<AuditDashboard>('/audits/dashboard'),
      api.get<UpcomingAudit[]>(`/audits?status=DRAFT,IN_PROGRESS`),
      api.get<{ recurrent: RecurrentItem[] }>('/audits/reports/recurrence?threshold=0.5'),
    ]).then(([dash, audits, rec]) => {
      if (dash.status === 'fulfilled') setAuditDash(dash.value.data);
      if (audits.status === 'fulfilled') {
        const upcoming = audits.value.data
          .filter(a => a.scheduledAt >= now && a.scheduledAt <= in7)
          .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
          .slice(0, 5);
        setUpcomingAudits(upcoming);
      }
      if (rec.status === 'fulfilled') setRecurrence(rec.value.data.recurrent.slice(0, 5));
    });
  }, []);

  const openCapas    = auditDash?.capaStats.open ?? 0;
  const overdueCapas = auditDash?.capaStats.overdue ?? 0;
  const avgScore = auditDash?.byArea
    ? Math.round((auditDash.byArea.filter(a => a.avgScore !== null).reduce((s, a) => s + (a.avgScore ?? 0), 0) /
        Math.max(auditDash.byArea.filter(a => a.avgScore !== null).length, 1)) * 10) / 10
    : null;

  const kpis = [
    { label: 'Pendientes',   value: pending,    color: '#e67e22', spark: SPARK.pending,    sub: 'requieren atención' },
    { label: 'En Progreso',  value: inProgress, color: '#2980b9', spark: SPARK.inProgress, sub: 'en ejecución' },
    { label: 'Completadas',  value: completed,  color: '#27ae60', spark: SPARK.completed,  sub: 'historial total' },
    { label: 'Vencidas',     value: overdue,    color: '#c0392b', spark: SPARK.overdue,    sub: 'requieren escalación' },
  ];

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', padding: '0 0 32px' }}>

      {/* ── Topbar ── */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>Panel Global</span>
        <button onClick={() => navigate('/work-orders')} style={{
          fontSize: 12, color: 'var(--sz-accent)', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'IBM Plex Sans, sans-serif',
        }}>Ver órdenes →</button>
      </div>

      <div style={{ padding: '20px 24px 0' }}>

        {/* ── KPI cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {kpis.map((k) => (
            <Card key={k.label} topAccent={k.color}>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600, marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 34, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{k.sub}</div>
                </div>
                <SparkLine data={k.spark} color={k.color} width={80} height={32} />
              </div>
            </Card>
          ))}
        </div>

        {/* ── Alerta vencidas ── */}
        {overdue > 0 && (
          <div style={{
            marginBottom: 20, background: '#fde8e6', border: '1px solid #c0392b',
            borderRadius: 'var(--sz-radius)', padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <AlertTriangle size={15} color="#c0392b" style={{ flexShrink: 0 }} />
            <span style={{ color: '#c0392b', fontSize: 13, fontWeight: 600 }}>
              {overdue} orden{overdue > 1 ? 'es' : ''} vencida{overdue > 1 ? 's' : ''} sin completar — requieren atención inmediata.
            </span>
          </div>
        )}

        {/* ── Grid principal: tabla + widgets ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, marginBottom: 20 }}>

          {/* Tabla órdenes recientes */}
          <Card>
            <CardHeader
              title="Órdenes Recientes"
              action={
                <button onClick={() => navigate('/work-orders')} style={{ fontSize: 11, color: 'var(--sz-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Ver todas →
                </button>
              }
            />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    {['ID', 'Título', 'Área', 'Técnico', 'Prioridad', 'Estado'].map((h) => (
                      <th key={h} style={{
                        padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                        color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase',
                        letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)',
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mockWorkOrders.slice(0, 6).map((o, i) => {
                    const sm = STATUS_MAP[o.status];
                    const pm = PRI_MAP[o.priority];
                    return (
                      <tr key={o.id}
                        className="sz-table-row"
                        onClick={() => navigate('/work-orders')}
                        style={{
                          borderBottom: '1px solid var(--sz-border)', cursor: 'pointer',
                          background: i % 2 === 0 ? 'var(--sz-card)' : '#fafafa',
                        }}
                      >
                        <td style={{ padding: '8px 12px', color: 'var(--sz-accent)', fontWeight: 600, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>{o.id}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--sz-text)', maxWidth: 200 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{o.title}</div>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--sz-muted)' }}>{o.area}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--sz-muted)' }}>{o.tech}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ color: pm.color, fontWeight: 700, fontSize: 11 }}>{pm.label}</span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <Badge label={sm.label} color={sm.color} bg={sm.bg} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Side widgets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Órdenes por área */}
            <Card>
              <CardHeader title="Órdenes por Área" />
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(byArea).map(([area, count]) => (
                  <ProgressBar key={area} label={area} value={count} max={maxArea}
                    color="var(--sz-accent)" showLabel height={8} />
                ))}
              </div>
            </Card>

            {/* Próximas auditorías (siguientes 7 días) */}
            <Card>
              <CardHeader
                title="Próximas Auditorías"
                subtitle="Siguientes 7 días"
                action={<button onClick={() => navigate('/audits')} style={{ fontSize: 11, color: 'var(--sz-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Ver todas →</button>}
              />
              <div style={{ padding: '8px 0' }}>
                {upcomingAudits.length === 0 ? (
                  <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--sz-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ClipboardCheck size={13} />
                    Sin auditorías esta semana
                  </div>
                ) : upcomingAudits.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/audits/${a.id}`)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--sz-border)' }}
                    className="sz-table-row"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--sz-accent)', fontWeight: 700 }}>{a.code}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sz-text)' }}>{a.area}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--sz-muted)' }}>
                      {a.auditor.name} · {new Date(a.scheduledAt).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* ── Tendencia histórica ── */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="Tendencia Histórica de Puntajes por Área" subtitle="Últimos 6 meses" />
          <div style={{ padding: '16px 16px 8px' }}>
            <LineChartSVG
              data={mockAuditTrend}
              xKey="month"
              series={AUDIT_SERIES}
              height={180}
              yMin={40}
              yMax={110}
            />
            {/* Legend */}
            <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
              {AUDIT_SERIES.map((s) => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--sz-muted)' }}>
                  <div style={{ width: 16, height: 2, background: s.color, borderRadius: 1 }} />
                  {s.key}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* ── Grid inferior ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Ítems reincidentes */}
          <Card>
            <CardHeader title="Ítems Reincidentes" subtitle="Tasa de fallo ≥50%" />
            <div style={{ padding: '8px 0' }}>
              {recurrence.length === 0 ? (
                <div style={{ padding: '16px', fontSize: 12, color: 'var(--sz-muted)', textAlign: 'center' }}>
                  <TrendingUp size={20} style={{ display: 'block', margin: '0 auto 6px', color: '#27ae60' }} />
                  Sin ítems reincidentes
                </div>
              ) : recurrence.map((r, i) => (
                <div key={i} style={{ padding: '10px 16px', borderBottom: i < recurrence.length - 1 ? '1px solid var(--sz-border)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    minWidth: 32, height: 32, borderRadius: '50%',
                    background: r.failRate >= 80 ? '#fde8e6' : r.failRate >= 60 ? '#fff3ec' : '#e8f4fd',
                    color: r.failRate >= 80 ? '#c0392b' : r.failRate >= 60 ? '#f97316' : '#2980b9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 12, flexShrink: 0,
                  }}>{r.failRate}%</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--sz-text)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>
                    <div style={{ fontSize: 11, color: 'var(--sz-muted)', marginTop: 2 }}>{r.area} · {r.fails}/{r.total} fallos</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* CAPAs y puntaje */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card topAccent="#c0392b">
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <AlertTriangle size={22} color="#c0392b" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginBottom: 4 }}>CAPAs Abiertas</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#c0392b', lineHeight: 1 }}>{openCapas}</div>
                  {overdueCapas > 0 ? (
                    <div style={{ fontSize: 11, color: '#c0392b', marginTop: 2, fontWeight: 600 }}>
                      ⚠ {overdueCapas} vencida{overdueCapas !== 1 ? 's' : ''}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>pendientes de cierre</div>
                  )}
                </div>
                {overdueCapas > 0 && (
                  <button onClick={() => navigate('/audits/findings')} style={{ fontSize: 11, color: '#c0392b', background: '#fde8e6', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontWeight: 600 }}>
                    Ver →
                  </button>
                )}
              </div>
            </Card>
            <Card topAccent="#27ae60">
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginBottom: 4 }}>Puntaje Promedio</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: avgScore !== null ? (avgScore >= 70 ? '#27ae60' : '#c0392b') : '#aaa', lineHeight: 1 }}>
                  {avgScore !== null ? `${avgScore}%` : '—'}
                </div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>promedio por área</div>
                {avgScore !== null && <div style={{ marginTop: 10 }}><ProgressBar value={avgScore} color={avgScore >= 70 ? '#27ae60' : '#c0392b'} height={6} /></div>}
              </div>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}
