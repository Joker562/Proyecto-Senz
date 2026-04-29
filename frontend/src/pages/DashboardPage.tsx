import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { WorkOrder, WorkOrderStats } from '@/types';
import type { UpcomingAnalytics, RecurrenceItem } from '@/types';
import { AlertTriangle, CheckCircle2, Factory, ClipboardList, TrendingUp, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getSocket } from '@/services/socket';
import { useAuth } from '@/hooks/useAuth';

/* ── Design tokens ── */
const ACCENT  = '#e67e22';
const C_BLUE  = '#2980b9';
const C_GREEN = '#27ae60';
const C_RED   = '#c0392b';
const BORDER  = '#e4e4e4';
const TEXT    = '#1c1c1c';
const MUTED   = '#888';
const TOPBAR  = '#ffffff';
const CARD    = '#ffffff';
const TH_BG   = '#fafafa';
const ROW_ALT = '#fafafa';
const ROW_HOV = '#fff4ec';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En Progreso', ON_HOLD: 'En Espera',
  COMPLETED: 'Completada', CANCELLED: 'Cancelada',
};
const STATUS_META: Record<string, { color: string; bg: string }> = {
  PENDING:     { color: ACCENT,    bg: '#fef3e7' },
  IN_PROGRESS: { color: C_BLUE,   bg: '#e8f4fd' },
  ON_HOLD:     { color: '#8b5cf6', bg: '#f3eeff' },
  COMPLETED:   { color: C_GREEN,  bg: '#e9f7ef' },
  CANCELLED:   { color: '#6b7280', bg: '#f3f4f6' },
};
const PRIORITY_META: Record<string, { color: string }> = {
  LOW: { color: C_GREEN }, MEDIUM: { color: ACCENT }, HIGH: { color: '#f97316' }, CRITICAL: { color: C_RED },
};

type Period = 'Todos' | 'Hoy' | 'Semana' | 'Mes' | 'Rango';
const PERIOD_PARAM: Record<Exclude<Period, 'Rango'>, string> = {
  Todos: 'all', Hoy: 'today', Semana: 'week', Mes: 'month',
};

interface CompletedAsset {
  assetId: string; assetName: string; assetCode: string; area: string;
  totalCompleted: number; lastCompletedAt: string | null;
  lastTitle: string; lastTechnician: string | null;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return isMobile;
}

/* ── Sub-components ── */
function StatCard({ label, value, color, sub }: { label: string; value: number; color: string; sub: string }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderTop: `3px solid ${color}`, padding: '16px 20px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#444', marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color }}>{value}</span>
      </div>
      <div style={{ height: 8, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width .4s' }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const isMobile  = useIsMobile();

  const [stats, setStats]                     = useState<WorkOrderStats | null>(null);
  const [recentOrders, setRecentOrders]       = useState<WorkOrder[]>([]);
  const [completedAssets, setCompletedAssets] = useState<CompletedAsset[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [loadingHistory, setLoadingHistory]   = useState(true);
  const [period, setPeriod]                   = useState<Period>('Todos');
  const [rangeFrom, setRangeFrom]             = useState('');
  const [rangeTo, setRangeTo]                 = useState('');

  // Auditorías
  const [upcoming, setUpcoming]     = useState<UpcomingAnalytics | null>(null);
  const [trendData, setTrendData]   = useState<{ rows: Record<string, unknown>[]; areas: string[] } | null>(null);
  const [recurrence, setRecurrence] = useState<RecurrenceItem[]>([]);

  /* Construye params de fecha para las llamadas API */
  const dateParams = useCallback((): Record<string, string> => {
    if (period === 'Rango' && rangeFrom && rangeTo) {
      return { from: new Date(rangeFrom).toISOString(), to: new Date(rangeTo + 'T23:59:59').toISOString() };
    }
    if (period !== 'Rango') return { period: PERIOD_PARAM[period] };
    return {};
  }, [period, rangeFrom, rangeTo]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = dateParams();
      const [statsRes, ordersRes] = await Promise.all([
        api.get<WorkOrderStats>('/work-orders/stats', { params }),
        api.get<{ data: WorkOrder[] }>('/work-orders', { params: { limit: 5, page: 1 } }),
      ]);
      setStats(statsRes.data);
      setRecentOrders(ordersRes.data.data);
    } finally {
      setLoading(false);
    }
  }, [dateParams]);

  const fetchAuditWidgets = useCallback(async () => {
    try {
      const [upRes, trendRes, recRes] = await Promise.all([
        api.get<UpcomingAnalytics>('/audits/analytics/upcoming'),
        api.get<{ rows: Record<string, unknown>[]; areas: string[] }>('/audits/analytics/trend', { params: { months: 6 } }),
        api.get<RecurrenceItem[]>('/audits/analytics/recurrence'),
      ]);
      setUpcoming(upRes.data);
      setTrendData(trendRes.data);
      setRecurrence(recRes.data.slice(0, 5));
    } catch { /* widgets opcionales, no bloquean */ }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const params = dateParams();
      const { data } = await api.get<CompletedAsset[]>('/work-orders/completed-by-asset', { params });
      setCompletedAssets(data);
    } catch { setCompletedAssets([]); }
    finally { setLoadingHistory(false); }
  }, [dateParams]);

  useEffect(() => {
    if (period === 'Rango' && (!rangeFrom || !rangeTo)) return;
    fetchStats();
    fetchHistory();
  }, [period, rangeFrom, rangeTo, fetchStats, fetchHistory]);

  useEffect(() => { fetchAuditWidgets(); }, [fetchAuditWidgets]);

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => { fetchStats(); fetchHistory(); };
    socket?.on('workOrder:created', refresh);
    socket?.on('workOrder:updated', refresh);
    socket?.on('workOrder:deleted', refresh);
    return () => {
      socket?.off('workOrder:created', refresh);
      socket?.off('workOrder:updated', refresh);
      socket?.off('workOrder:deleted', refresh);
    };
  }, [fetchStats, fetchHistory]);

  /* ── Derived values ── */
  const pending    = stats?.byStatus.find((s) => s.status === 'PENDING')?._count    ?? 0;
  const inProgress = stats?.byStatus.find((s) => s.status === 'IN_PROGRESS')?._count ?? 0;
  const completed  = stats?.byStatus.find((s) => s.status === 'COMPLETED')?._count  ?? 0;
  const overdue    = stats?.overdue ?? 0;

  const byArea: Record<string, number> = {};
  recentOrders.forEach((o) => { const a = o.asset?.area ?? 'Sin área'; byArea[a] = (byArea[a] ?? 0) + 1; });
  const maxArea = Math.max(...Object.values(byArea), 1);

  const byTech: Record<string, number> = {};
  recentOrders.forEach((o) => {
    if (o.assignedTo && o.status !== 'COMPLETED' && o.status !== 'CANCELLED') {
      byTech[o.assignedTo.name] = (byTech[o.assignedTo.name] ?? 0) + 1;
    }
  });
  const maxTech = Math.max(...Object.values(byTech), 1);

  const card: React.CSSProperties = { background: CARD, border: `1px solid ${BORDER}`, fontFamily: 'IBM Plex Sans, sans-serif' };

  const periodLabel = period === 'Rango' && rangeFrom && rangeTo
    ? ` — ${rangeFrom} / ${rangeTo}`
    : period !== 'Todos' ? ` — ${period}` : '';

  const subLabel = (base: string) => {
    if (period === 'Todos') return base === 'completadas' ? 'historial total' : 'requieren atención';
    if (period === 'Hoy') return 'hoy';
    if (period === 'Semana') return 'esta semana';
    if (period === 'Mes') return 'este mes';
    return 'en el rango';
  };

  /* ── Topbar period buttons ── */
  const PeriodBtn = ({ p }: { p: Period }) => (
    <button key={p} onClick={() => setPeriod(p)} style={{
      padding: isMobile ? '4px 8px' : '3px 10px',
      fontSize: isMobile ? 11 : 12, cursor: 'pointer',
      background: period === p ? ACCENT : 'transparent',
      color:      period === p ? '#fff' : MUTED,
      border:     `1px solid ${period === p ? ACCENT : BORDER}`,
      borderRadius: 3, fontFamily: 'IBM Plex Sans, sans-serif', transition: 'all .15s',
      whiteSpace: 'nowrap',
    }}>{p}</button>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'IBM Plex Sans, sans-serif' }}>

      {/* ── Topbar ── */}
      <div style={{
        background: TOPBAR, borderBottom: `1px solid ${BORDER}`,
        padding: isMobile ? '0 16px' : '0 24px',
        minHeight: 48, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        paddingTop: isMobile ? 8 : 0, paddingBottom: isMobile ? 8 : 0,
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>
          Panel Global{periodLabel}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(['Todos', 'Hoy', 'Semana', 'Mes', 'Rango'] as Period[]).map((p) => (
            <PeriodBtn key={p} p={p} />
          ))}
        </div>
      </div>

      {/* ── Rango de fechas (solo cuando period === 'Rango') ── */}
      {period === 'Rango' && (
        <div style={{
          background: TOPBAR, borderBottom: `1px solid ${BORDER}`,
          padding: isMobile ? '10px 16px' : '10px 24px',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12, color: MUTED, whiteSpace: 'nowrap' }}>Desde:</span>
          <input
            type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)}
            style={{ padding: '5px 8px', fontSize: 12, border: `1px solid ${BORDER}`, borderRadius: 2, outline: 'none', fontFamily: 'IBM Plex Sans, sans-serif', background: CARD, color: TEXT }}
          />
          <span style={{ fontSize: 12, color: MUTED, whiteSpace: 'nowrap' }}>Hasta:</span>
          <input
            type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)}
            style={{ padding: '5px 8px', fontSize: 12, border: `1px solid ${BORDER}`, borderRadius: 2, outline: 'none', fontFamily: 'IBM Plex Sans, sans-serif', background: CARD, color: TEXT }}
          />
          {rangeFrom && rangeTo && (
            <span style={{ fontSize: 11, color: C_GREEN, fontWeight: 600 }}>✓ Filtro activo</span>
          )}
        </div>
      )}

      <div style={{ padding: isMobile ? 16 : 24 }}>

        {/* ── KPI cards ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: isMobile ? 10 : 12,
          marginBottom: isMobile ? 16 : 24,
        }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ ...card, padding: '16px 20px', borderTop: `3px solid ${BORDER}` }}>
                <div style={{ height: 40, background: '#f5f5f5', borderRadius: 2 }} />
              </div>
            ))
          ) : (
            <>
              <StatCard label={user?.role === 'TECHNICIAN' ? 'Mis Pendientes' : 'Pendientes'} value={pending}    color={ACCENT}  sub={subLabel('pendientes')} />
              <StatCard label="En Progreso"  value={inProgress} color={C_BLUE}  sub="en ejecución" />
              <StatCard label="Completadas"  value={completed}  color={C_GREEN} sub={subLabel('completadas')} />
              <StatCard label="Vencidas"     value={overdue}    color={C_RED}   sub="requieren escalación" />
            </>
          )}
        </div>

        {/* ── Alerta de vencidas ── */}
        {overdue > 0 && (
          <div style={{ marginBottom: isMobile ? 16 : 24, background: '#fde8e6', border: `1px solid ${C_RED}`, borderRadius: 2, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={16} color={C_RED} style={{ flexShrink: 0 }} />
            <p style={{ color: C_RED, fontSize: 13, fontWeight: 600, margin: 0 }}>
              {overdue} orden{overdue > 1 ? 'es' : ''} vencida{overdue > 1 ? 's' : ''} sin completar — requieren atención inmediata.
            </p>
          </div>
        )}

        {/* ── Desktop: grid tabla + widgets ── */}
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start', marginBottom: 24 }}>
            {/* Tabla órdenes recientes */}
            <div style={card}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>Órdenes Recientes</span>
                <button onClick={() => navigate('/work-orders')} style={{ fontSize: 11, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}>Ver todas →</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: TH_BG }}>
                    {['ID', 'Título', 'Área', 'Técnico', 'Prioridad', 'Estado'].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={{ padding: '32px 0', textAlign: 'center', color: MUTED }}>Cargando…</td></tr>
                  ) : recentOrders.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '32px 0', textAlign: 'center', color: MUTED }}>Sin órdenes registradas.</td></tr>
                  ) : recentOrders.map((o, i) => {
                    const est = STATUS_META[o.status] ?? STATUS_META.PENDING;
                    const pri = PRIORITY_META[o.priority];
                    return (
                      <tr key={o.id} onClick={() => navigate(`/work-orders/${o.id}`)}
                        style={{ borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', background: i % 2 === 0 ? CARD : ROW_ALT }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = ROW_HOV)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? CARD : ROW_ALT)}>
                        <td style={{ padding: '8px 12px', color: ACCENT, fontWeight: 600 }}>{o.code.slice(-8).toUpperCase()}</td>
                        <td style={{ padding: '8px 12px', color: TEXT, maxWidth: 200 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{o.title}</div>
                        </td>
                        <td style={{ padding: '8px 12px', color: MUTED }}>{o.asset?.area ?? '—'}</td>
                        <td style={{ padding: '8px 12px', color: MUTED }}>{o.assignedTo?.name?.split(' ')[0] ?? '—'}</td>
                        <td style={{ padding: '8px 12px' }}><span style={{ color: pri?.color ?? MUTED, fontWeight: 600 }}>{o.priority}</span></td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: est.bg, color: est.color, padding: '2px 8px', borderRadius: 2, fontWeight: 600, fontSize: 11 }}>{STATUS_LABELS[o.status] ?? o.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Columna lateral: barras */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ ...card, padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: TEXT, marginBottom: 14 }}>Órdenes por Área</div>
                {Object.keys(byArea).length === 0
                  ? <p style={{ fontSize: 12, color: MUTED }}>Sin datos</p>
                  : Object.entries(byArea).map(([area, count]) => <BarRow key={area} label={area} value={count} max={maxArea} color={ACCENT} />)}
              </div>
              <div style={{ ...card, padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: TEXT, marginBottom: 14 }}>Carga por Técnico</div>
                {Object.keys(byTech).length === 0
                  ? <p style={{ fontSize: 12, color: MUTED }}>Sin asignaciones activas</p>
                  : Object.entries(byTech).map(([tec, cnt]) => {
                    const parts = tec.split(' ');
                    const label = parts.length >= 2 ? `${parts[0]} ${parts[1][0]}.` : tec;
                    return <BarRow key={tec} label={label} value={cnt} max={maxTech} color={C_BLUE} />;
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ── Mobile: cards de órdenes recientes ── */}
        {isMobile && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>Órdenes Recientes</span>
              <button onClick={() => navigate('/work-orders')} style={{ fontSize: 11, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}>Ver todas →</button>
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: MUTED, fontSize: 13 }}>Cargando…</div>
            ) : recentOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: MUTED, fontSize: 13 }}>Sin órdenes registradas.</div>
            ) : recentOrders.map((o) => {
              const est = STATUS_META[o.status] ?? STATUS_META.PENDING;
              const pri = PRIORITY_META[o.priority];
              return (
                <div key={o.id} onClick={() => navigate(`/work-orders/${o.id}`)}
                  style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${ACCENT}`, padding: '12px 14px', marginBottom: 8, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{o.asset?.area ?? '—'} · {o.assignedTo?.name?.split(' ')[0] ?? 'Sin asignar'}</div>
                    </div>
                    <span style={{ background: est.bg, color: est.color, padding: '2px 8px', borderRadius: 2, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>{STATUS_LABELS[o.status]}</span>
                  </div>
                  <span style={{ fontSize: 11, color: pri?.color ?? MUTED, fontWeight: 700 }}>{o.priority}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Widgets de Auditorías ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: isMobile ? 16 : 24 }}>

          {/* Próximas auditorías 7 días */}
          <div style={card}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={15} color="#8b5cf6" />
              <span style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>Próximas Auditorías</span>
              <span style={{ fontSize: 11, color: MUTED, marginLeft: 'auto' }}>7 días</span>
            </div>
            {!upcoming ? (
              <div style={{ padding: '20px 16px', color: MUTED, fontSize: 13 }}>Cargando…</div>
            ) : upcoming.upcoming.length === 0 ? (
              <div style={{ padding: '20px 16px', color: MUTED, fontSize: 13, textAlign: 'center' }}>Sin auditorías en los próximos 7 días</div>
            ) : (
              <div>
                {upcoming.upcoming.slice(0, 4).map(a => (
                  <div key={a.id} onClick={() => navigate(`/audits/${a.id}`)} style={{ padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onMouseEnter={e => (e.currentTarget.style.background = ROW_HOV)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{a.area} · {a.auditor?.name}</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#8b5cf6', whiteSpace: 'nowrap', marginLeft: 8 }}>
                      {new Date(a.scheduledAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CAPAs vencidas + puntaje semana */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ ...card, padding: '16px', display: 'flex', alignItems: 'center', gap: 14, borderTop: `3px solid ${C_RED}` }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fde8e6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={20} color={C_RED} />
              </div>
              <div>
                <div style={{ fontSize: 30, fontWeight: 700, color: C_RED, lineHeight: 1 }}>{upcoming?.overdueCapas ?? '—'}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>CAPAs Vencidas</div>
              </div>
              {(upcoming?.overdueCapas ?? 0) > 0 && (
                <span style={{ marginLeft: 'auto', background: C_RED, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                  ALERTA
                </span>
              )}
            </div>

            <div style={{ ...card, padding: '16px', display: 'flex', alignItems: 'center', gap: 14, borderTop: `3px solid ${C_GREEN}` }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: '#e9f7ef', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <TrendingUp size={20} color={C_GREEN} />
              </div>
              <div>
                <div style={{ fontSize: 30, fontWeight: 700, color: C_GREEN, lineHeight: 1 }}>
                  {upcoming?.avgScoreWeek != null ? `${upcoming.avgScoreWeek}%` : '—'}
                </div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Puntaje Promedio (7 días)</div>
              </div>
            </div>
          </div>

          {/* Reincidencias */}
          <div style={card}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <RefreshCw size={15} color={ACCENT} />
              <span style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>Ítems Reincidentes</span>
              <span style={{ fontSize: 11, color: MUTED, marginLeft: 'auto' }}>≥3 fallos</span>
            </div>
            {recurrence.length === 0 ? (
              <div style={{ padding: '20px 16px', color: MUTED, fontSize: 13, textAlign: 'center' }}>Sin reincidencias detectadas</div>
            ) : (
              <div>
                {recurrence.map((r, i) => (
                  <div key={i} style={{ padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{r.area}</div>
                    </div>
                    <span style={{ background: '#fde8e6', color: C_RED, fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {r.failCount}x
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Gráfica de tendencia histórica de puntajes ── */}
        {trendData && trendData.rows.length > 0 && (
          <div style={{ ...card, marginBottom: isMobile ? 16 : 24 }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={15} color={C_BLUE} />
              <span style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>Tendencia Histórica de Puntajes por Área</span>
              <span style={{ fontSize: 11, color: MUTED, marginLeft: 'auto' }}>últimos 6 meses</span>
            </div>
            <div style={{ padding: '16px 8px' }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData.rows} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: MUTED }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: MUTED }} unit="%" />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {trendData.areas.map((area, idx) => {
                    const COLORS = [C_BLUE, ACCENT, C_GREEN, '#8b5cf6', C_RED, '#14b8a6'];
                    return (
                      <Line
                        key={area}
                        type="monotone"
                        dataKey={area}
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Historial de mantenimientos completados ── */}
        <div style={card}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <CheckCircle2 size={15} color={C_GREEN} />
            <span style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>Historial de Mantenimientos Completados</span>
            <span style={{ fontWeight: 400, fontSize: 11, color: MUTED }}>
              {period === 'Todos' ? '— todos' : period === 'Rango' && rangeFrom && rangeTo ? `— ${rangeFrom} al ${rangeTo}` : `— ${period.toLowerCase()}`}
            </span>
          </div>
          {loadingHistory ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: MUTED, fontSize: 13 }}>Cargando historial…</div>
          ) : completedAssets.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: MUTED, fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Factory size={32} color={BORDER} />
              <span>Sin mantenimientos completados en este período</span>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: isMobile ? 560 : 'auto' }}>
                <thead>
                  <tr style={{ background: TH_BG }}>
                    {['Equipo', 'Área', 'Último mantenimiento', 'Técnico', 'Total'].map((h) => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: `2px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {completedAssets.map((row, i) => (
                    <tr key={row.assetId} style={{ background: i % 2 === 0 ? CARD : ROW_ALT, borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ fontWeight: 600, color: TEXT }}>{row.assetName}</div>
                        <div style={{ fontSize: 10, color: MUTED, fontFamily: 'monospace' }}>{row.assetCode}</div>
                      </td>
                      <td style={{ padding: '9px 14px', color: MUTED }}>{row.area}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ color: TEXT }}>{row.lastTitle}</div>
                        {row.lastCompletedAt && (
                          <div style={{ fontSize: 10, color: MUTED }}>
                            {new Date(row.lastCompletedAt).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '9px 14px', color: MUTED }}>{row.lastTechnician ?? '—'}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ background: '#e9f7ef', color: C_GREEN, padding: '2px 10px', borderRadius: 2, fontWeight: 700, fontSize: 12 }}>{row.totalCompleted}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
