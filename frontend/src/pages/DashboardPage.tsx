import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  AlertTriangle, ClipboardCheck, TrendingUp, TrendingDown,
  Activity, CheckCircle2, Gauge,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SparkLine } from '@/components/ui/SparkLine';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LineChartSVG } from '@/components/ui/LineChartSVG';
import { api, oeeApi, OEESummary, OEETrendPoint, DowntimeEvent, AssetOEESummary } from '@/services/api';
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

// ─── OEE helpers ─────────────────────────────────────────────────────────────

function oeeColor(v: number): string {
  return v >= 85 ? '#27ae60' : v >= 65 ? '#e67e22' : '#c0392b';
}

const DT_CATEGORY: Record<string, { label: string; color: string; bg: string }> = {
  PLANNED:    { label: 'Planificada',    color: '#2980b9', bg: '#e8f4fd' },
  UNPLANNED:  { label: 'No planificada', color: '#c0392b', bg: '#fde8e6' },
  SETUP:      { label: 'Preparación',   color: '#e67e22', bg: '#fff3ec' },
  MINOR_STOP: { label: 'Micro-paro',    color: '#8b5cf6', bg: '#f3f0ff' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Contador de tiempo transcurrido desde startTime, actualiza cada 60 s */
function ElapsedTimer({ startTime }: { startTime: string }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    function tick() {
      const mins = Math.floor((Date.now() - new Date(startTime).getTime()) / 60000);
      if (mins < 1)   setLabel('<1 min');
      else if (mins < 60) setLabel(`${mins} min`);
      else {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        setLabel(m > 0 ? `${h}h ${m}m` : `${h}h`);
      }
    }
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [startTime]);
  return <span>{label}</span>;
}

/** Anillo SVG tipo donut para el valor OEE */
function DonutOEE({ value, size = 80 }: { value: number; size?: number }) {
  const color = oeeColor(value);
  const r     = (size - 10) / 2;
  const circ  = 2 * Math.PI * r;
  const dash  = Math.max(0, Math.min(1, value / 100)) * circ;
  const cx    = size / 2;
  const cy    = size / 2;
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e8e8e8" strokeWidth={9} />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={9}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </svg>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const { pending, inProgress, completed, overdue } = mockStats;
  const byArea = getByArea();
  const maxArea = Math.max(...Object.values(byArea), 1);

  // ── Audit state ──
  const [auditDash, setAuditDash]         = useState<AuditDashboard | null>(null);
  const [upcomingAudits, setUpcomingAudits] = useState<UpcomingAudit[]>([]);
  const [recurrence, setRecurrence]       = useState<RecurrentItem[]>([]);

  // ── OEE state ──
  const [oeeToday,   setOeeToday]   = useState<OEESummary | null>(null);
  const [oeeAssets,  setOeeAssets]  = useState<AssetOEESummary[] | null>(null);
  const [oeeDowntime,setOeeDowntime]= useState<DowntimeEvent[]>([]);
  const [oeeTrend14, setOeeTrend14] = useState<OEETrendPoint[]>([]);
  const [oeeLoading, setOeeLoading] = useState(true);

  // ── Audit fetch ──
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

  // ── OEE fetch (4 en paralelo con allSettled para resistencia a fallos) ──
  useEffect(() => {
    const todayStr  = new Date().toISOString().slice(0, 10);
    const d2ago     = new Date(Date.now() - 2  * 86400000).toISOString().slice(0, 10);
    const d14ago    = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const todayEnd  = new Date().toISOString();

    Promise.allSettled([
      oeeApi.getPlantSummary({ startDate: todayStr, endDate: todayStr }),
      oeeApi.getAssetsRanking({ startDate: d2ago, endDate: todayStr, limit: 3, order: 'asc' }),
      oeeApi.getDowntimeEvents({ open: 'true', limit: 5 }),
      oeeApi.getTrend({ startDate: d14ago, endDate: todayEnd, groupBy: 'day' }),
    ]).then(([today, assets, downtime, trend]) => {
      if (today.status    === 'fulfilled') setOeeToday(today.value);
      if (assets.status   === 'fulfilled') setOeeAssets(assets.value);
      if (downtime.status === 'fulfilled') setOeeDowntime(downtime.value.data);
      if (trend.status    === 'fulfilled') setOeeTrend14(trend.value);
      setOeeLoading(false);
    });
  }, []);

  // ── Derived ──
  const openCapas    = auditDash?.capaStats.open ?? 0;
  const overdueCapas = auditDash?.capaStats.overdue ?? 0;
  const avgScore = auditDash?.byArea
    ? Math.round((auditDash.byArea.filter(a => a.avgScore !== null).reduce((s, a) => s + (a.avgScore ?? 0), 0) /
        Math.max(auditDash.byArea.filter(a => a.avgScore !== null).length, 1)) * 10) / 10
    : null;

  // OEE sparkline & delta
  const last7      = oeeTrend14.slice(-7);
  const prev7      = oeeTrend14.slice(0, Math.max(0, oeeTrend14.length - 7));
  const avgArr     = (arr: OEETrendPoint[]) => arr.length ? arr.reduce((s, p) => s + (p.oee ?? 0), 0) / arr.length : 0;
  const trendLast  = avgArr(last7);
  const trendPrev  = avgArr(prev7);
  const trendDelta = trendLast - trendPrev;
  const sparkOEE   = last7.map(p => p.oee ?? 0);

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

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ── Sección OEE ──────────────────────────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 20 }}>

          {/* Cabecera de sección */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Gauge size={15} color="var(--sz-accent)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sz-text)', letterSpacing: '.3px' }}>
              OEE — Indicadores del Día
            </span>
            <span style={{ fontSize: 11, color: 'var(--sz-muted)', marginLeft: 2 }}>
              {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <button
              onClick={() => navigate('/oee')}
              style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--sz-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Módulo OEE →
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>

            {/* ── Columna izquierda: Widget 1 + Widget 4 ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Widget 1 — OEE Global del Día */}
              <Card>
                <CardHeader title="OEE Global del Día" subtitle="Planta completa · hoy" />
                {oeeLoading ? (
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                      <div className="sz-skeleton" style={{ width: 80, height: 80, borderRadius: '50%', flexShrink: 0 }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
                        <div className="sz-skeleton" style={{ height: 14 }} />
                        <div className="sz-skeleton" style={{ height: 12, width: '70%' }} />
                      </div>
                    </div>
                    <div className="sz-skeleton" style={{ height: 10 }} />
                    <div className="sz-skeleton" style={{ height: 10 }} />
                    <div className="sz-skeleton" style={{ height: 10 }} />
                  </div>
                ) : oeeToday && oeeToday.recordCount > 0 ? (
                  <div style={{ padding: '16px' }}>
                    {/* Donut + big number centrado */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                      <div style={{ position: 'relative', flexShrink: 0, width: 80, height: 80 }}>
                        <DonutOEE value={oeeToday.oee} size={80} />
                        <div style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: oeeColor(oeeToday.oee), lineHeight: 1 }}>
                            {oeeToday.oee.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--sz-muted)', marginBottom: 3 }}>
                          Benchmark ≥ 85%
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: oeeColor(oeeToday.oee), lineHeight: 1.3 }}>
                          {oeeToday.oee >= 85
                            ? '✓ Por encima del objetivo'
                            : oeeToday.oee >= 65
                            ? '⚠ Por debajo del objetivo'
                            : '✗ Nivel crítico'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--sz-muted)', marginTop: 4 }}>
                          {oeeToday.recordCount} registro{oeeToday.recordCount !== 1 ? 's' : ''} hoy
                        </div>
                      </div>
                    </div>

                    {/* Barras A / P / Q */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {[
                        { k: 'A', label: 'Disponib.',   v: oeeToday.availability },
                        { k: 'P', label: 'Rendimien.', v: oeeToday.performance },
                        { k: 'Q', label: 'Calidad',    v: oeeToday.quality },
                      ].map(({ k, label, v }) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 10, fontSize: 9, fontWeight: 800, color: 'var(--sz-muted)' }}>{k}</span>
                          <span style={{ width: 54, fontSize: 10, color: 'var(--sz-muted)' }}>{label}</span>
                          <div style={{ flex: 1 }}>
                            <ProgressBar value={v} color={oeeColor(v)} height={5} />
                          </div>
                          <span style={{ width: 38, fontSize: 11, fontWeight: 700, textAlign: 'right', color: oeeColor(v) }}>
                            {v.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                    <Gauge size={24} color="#ccc" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <div style={{ fontSize: 12, color: 'var(--sz-muted)' }}>Sin registros OEE hoy</div>
                    <button onClick={() => navigate('/oee')} style={{ marginTop: 8, fontSize: 11, color: 'var(--sz-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Registrar →
                    </button>
                  </div>
                )}
              </Card>

              {/* Widget 4 — Sparkline de tendencia 7 días */}
              <Card>
                <CardHeader title="Tendencia OEE" subtitle="Últimos 7 días" />
                {oeeLoading ? (
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="sz-skeleton" style={{ height: 44 }} />
                    <div className="sz-skeleton" style={{ height: 12, width: '60%' }} />
                  </div>
                ) : sparkOEE.length > 0 ? (
                  <div style={{ padding: '12px 16px' }}>
                    <SparkLine data={sparkOEE} color={oeeColor(trendLast)} width={220} height={44} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--sz-muted)' }}>
                        Media:{' '}
                        <strong style={{ color: oeeColor(trendLast) }}>
                          {trendLast.toFixed(1)}%
                        </strong>
                      </span>
                      {prev7.length > 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: trendDelta >= 0 ? '#27ae60' : '#c0392b',
                          display: 'flex', alignItems: 'center', gap: 2,
                        }}>
                          {trendDelta >= 0
                            ? <TrendingUp size={11} />
                            : <TrendingDown size={11} />}
                          {trendDelta >= 0 ? '+' : ''}{trendDelta.toFixed(1)} pp
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--sz-muted)', marginTop: 2 }}>
                      vs. semana anterior
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: 'var(--sz-muted)' }}>
                    Sin datos de tendencia
                  </div>
                )}
              </Card>
            </div>

            {/* ── Columna central: Widget 2 — Top 3 Activos con Menor OEE ── */}
            <Card>
              <CardHeader title="Activos con Menor OEE" subtitle="Últimas 48 h · peores 3" />
              {oeeLoading ? (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div className="sz-skeleton" style={{ height: 14, width: '80%' }} />
                      <div className="sz-skeleton" style={{ height: 8 }} />
                    </div>
                  ))}
                </div>
              ) : oeeAssets && oeeAssets.length > 0 ? (
                <div style={{ padding: '8px 0' }}>
                  {oeeAssets.map((asset, idx) => {
                    const c = oeeColor(asset.oee);
                    const rankColors = ['#c0392b', '#e67e22', '#e67e22'];
                    return (
                      <div
                        key={asset.assetId}
                        style={{
                          padding: '12px 16px',
                          borderBottom: idx < oeeAssets.length - 1 ? '1px solid var(--sz-border)' : 'none',
                        }}
                      >
                        {/* Fila superior: rango + nombre + badge OEE */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%',
                            background: rankColors[idx] ?? '#aaa',
                            color: '#fff', fontSize: 10, fontWeight: 800,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}>{idx + 1}</div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sz-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {asset.name}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--sz-muted)' }}>
                              <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--sz-accent)' }}>
                                {asset.code}
                              </span>
                              {' · '}{asset.area}
                            </div>
                          </div>

                          <div style={{
                            background: `${c}1a`, border: `1px solid ${c}44`,
                            borderRadius: 4, padding: '2px 7px',
                            fontSize: 12, fontWeight: 800, color: c, flexShrink: 0,
                          }}>
                            {asset.oee.toFixed(1)}%
                          </div>
                        </div>

                        {/* Barra de progreso OEE */}
                        <ProgressBar value={asset.oee} color={c} height={5} />

                        {/* Mini A/P/Q inline */}
                        <div style={{ display: 'flex', gap: 12, marginTop: 5 }}>
                          {[
                            { k: 'A', v: asset.availability },
                            { k: 'P', v: asset.performance },
                            { k: 'Q', v: asset.quality },
                          ].map(({ k, v }) => (
                            <span key={k} style={{ fontSize: 10, color: 'var(--sz-muted)' }}>
                              <strong style={{ color: oeeColor(v) }}>{k}</strong> {v.toFixed(0)}%
                            </span>
                          ))}
                          <span style={{ fontSize: 10, color: 'var(--sz-muted)', marginLeft: 'auto' }}>
                            {asset.recordCount} reg.
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                  <CheckCircle2 size={24} color="#27ae60" style={{ margin: '0 auto 8px', display: 'block' }} />
                  <div style={{ fontSize: 12, color: 'var(--sz-muted)' }}>Sin datos de activos en las últimas 48 h</div>
                </div>
              )}
            </Card>

            {/* ── Columna derecha: Widget 3 — Paradas Activas ── */}
            <Card>
              <CardHeader
                title="Paradas Activas"
                subtitle="Sin cierre · tiempo real"
                action={
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: oeeDowntime.length > 0 ? '#c0392b' : '#27ae60',
                    boxShadow: oeeDowntime.length > 0 ? '0 0 0 2px #fde8e6' : '0 0 0 2px #e6f9ee',
                  }} />
                }
              />
              {oeeLoading ? (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1, 2].map(i => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div className="sz-skeleton" style={{ height: 14, width: '75%' }} />
                      <div className="sz-skeleton" style={{ height: 10, width: '50%' }} />
                    </div>
                  ))}
                </div>
              ) : oeeDowntime.length > 0 ? (
                <div style={{ padding: '8px 0' }}>
                  {oeeDowntime.map((ev, idx) => {
                    const cat = DT_CATEGORY[ev.category] ?? { label: ev.category, color: '#888', bg: '#f0f0f0' };
                    return (
                      <div
                        key={ev.id}
                        style={{
                          padding: '10px 16px',
                          borderBottom: idx < oeeDowntime.length - 1 ? '1px solid var(--sz-border)' : 'none',
                        }}
                      >
                        {/* Categoría + tiempo transcurrido */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{
                            background: cat.bg, color: cat.color,
                            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                            textTransform: 'uppercase', letterSpacing: '.3px', flexShrink: 0,
                          }}>
                            {cat.label}
                          </span>
                          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#c0392b', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Activity size={10} />
                            <ElapsedTimer startTime={ev.startTime} />
                          </span>
                        </div>

                        {/* Motivo */}
                        <div style={{
                          fontSize: 12, fontWeight: 500, color: 'var(--sz-text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          marginBottom: 2,
                        }}>
                          {ev.reason.length > 52 ? ev.reason.slice(0, 50) + '…' : ev.reason}
                        </div>

                        {/* Activo + inicio */}
                        <div style={{ fontSize: 10, color: 'var(--sz-muted)' }}>
                          <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--sz-accent)' }}>
                            {ev.asset?.code ?? ev.assetId.slice(0, 8)}
                          </span>
                          {ev.asset?.name ? ` · ${ev.asset.name}` : ''}
                          {' · '}
                          {new Date(ev.startTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <CheckCircle2 size={28} color="#27ae60" style={{ margin: '0 auto 10px', display: 'block' }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#27ae60', marginBottom: 4 }}>
                    Sin paradas activas
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--sz-muted)' }}>
                    Todos los activos operando normalmente
                  </div>
                </div>
              )}
            </Card>

          </div>
        </div>
        {/* ── Fin sección OEE ── */}

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
