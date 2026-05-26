import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, Factory, AlertTriangle, CheckCircle2, Clock,
  Calendar, TrendingUp, RefreshCw, ChevronRight, Wrench, Zap,
} from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WOStats {
  total: number;
  byStatus: Array<{ status: string; _count: number }>;
  byPriority: Array<{ priority: string; _count: number }>;
  overdue: number;
}

interface Asset {
  id: string;
  name: string;
  code: string;
  area: string;
  status: 'OPERATIONAL' | 'UNDER_MAINTENANCE' | 'OUT_OF_SERVICE' | 'DECOMMISSIONED';
  _count?: { workOrders: number };
}

interface MaintenancePlan {
  id: string;
  name: string;
  type: string;
  nextDue: string | null;
  frequencyUnit?: string | null;
  asset: { id: string; name: string; code: string; area: string };
}

interface WorkOrder {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  createdAt: string;
  scheduledAt: string | null;
  asset: { name: string; code: string; area: string } | null;
  assignedTo: { name: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En proceso', ON_HOLD: 'En espera',
  COMPLETED: 'Completada', CANCELLED: 'Cancelada',
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: '#f59e0b', IN_PROGRESS: '#3b82f6', ON_HOLD: '#8b5cf6',
  COMPLETED: '#10b981', CANCELLED: '#6b7280',
};
const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica',
};
const PRIORITY_COLOR: Record<string, string> = {
  LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#f97316', CRITICAL: '#ef4444',
};
const ASSET_STATUS_LABEL: Record<string, string> = {
  OPERATIONAL: 'Operativo', UNDER_MAINTENANCE: 'En Mantenimiento',
  OUT_OF_SERVICE: 'Fuera de Servicio', DECOMMISSIONED: 'Dado de Baja',
};
const ASSET_STATUS_COLOR: Record<string, string> = {
  OPERATIONAL: '#10b981', UNDER_MAINTENANCE: '#f59e0b',
  OUT_OF_SERVICE: '#ef4444', DECOMMISSIONED: '#6b7280',
};
const TYPE_LABEL: Record<string, string> = {
  PREVENTIVE: 'Preventivo', CORRECTIVE: 'Correctivo',
  PREDICTIVE: 'Predictivo', INSPECTION: 'Inspección',
};

function getCount(arr: Array<{ status?: string; _count: number }>, key: string): number {
  return arr.find((x) => x.status === key)?._count ?? 0;
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtRelative(dateStr: string): string {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (d < 60) return `hace ${d} min`;
  if (d < 1440) return `hace ${Math.floor(d / 60)} h`;
  return `hace ${Math.floor(d / 1440)} días`;
}

// ─── Mini progress bar ────────────────────────────────────────────────────────

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ background: '#e5e7eb', borderRadius: 4, height: 5, overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${Math.min(100, value)}%`, background: color, height: '100%', borderRadius: 4, transition: 'width .6s ease' }} />
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Sk({ w = '100%', h = 18 }: { w?: string | number; h?: number }) {
  return <div className="sz-skeleton" style={{ width: w, height: h, borderRadius: 4 }} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MaintenanceDashboardPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [stats,      setStats]      = useState<WOStats | null>(null);
  const [assets,     setAssets]     = useState<Asset[]>([]);
  const [plans,      setPlans]      = useState<MaintenancePlan[]>([]);
  const [recentWOs,  setRecentWOs]  = useState<WorkOrder[]>([]);
  const [openWOs,    setOpenWOs]    = useState<WorkOrder[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    const [statsRes, assetsRes, plansRes, recentRes, openRes] = await Promise.allSettled([
      api.get<WOStats>('/work-orders/stats'),
      api.get<Asset[]>('/assets'),
      api.get<MaintenancePlan[]>('/maintenance-plans?active=true'),
      api.get<{ data: WorkOrder[] }>('/work-orders?limit=8&page=1'),
      api.get<{ data: WorkOrder[] }>('/work-orders?status=IN_PROGRESS&limit=20'),
    ]);

    if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
    if (assetsRes.status === 'fulfilled') setAssets(assetsRes.value.data);
    if (plansRes.status === 'fulfilled')  setPlans(plansRes.value.data);
    if (recentRes.status === 'fulfilled') setRecentWOs(recentRes.value.data.data);
    if (openRes.status === 'fulfilled')   setOpenWOs(openRes.value.data.data);

    setLoading(false);
    setLastUpdate(new Date());
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const pending    = stats ? getCount(stats.byStatus as Array<{ status: string; _count: number }>, 'PENDING')     : 0;
  const inProgress = stats ? getCount(stats.byStatus as Array<{ status: string; _count: number }>, 'IN_PROGRESS') : 0;
  const completed  = stats ? getCount(stats.byStatus as Array<{ status: string; _count: number }>, 'COMPLETED')   : 0;
  const onHold     = stats ? getCount(stats.byStatus as Array<{ status: string; _count: number }>, 'ON_HOLD')     : 0;

  // Asset breakdown
  const opCount   = assets.filter(a => a.status === 'OPERATIONAL').length;
  const mttoCount = assets.filter(a => a.status === 'UNDER_MAINTENANCE').length;
  const outCount  = assets.filter(a => a.status === 'OUT_OF_SERVICE').length;

  // Upcoming plans next 14 days
  const upcomingPlans = plans
    .filter(p => p.nextDue && daysUntil(p.nextDue) >= 0 && daysUntil(p.nextDue) <= 14)
    .slice(0, 5);

  // Overdue plans
  const overduePlans = plans
    .filter(p => p.nextDue && daysUntil(p.nextDue) < 0)
    .slice(0, 5);

  // High/critical open work orders
  const criticalWOs = openWOs.filter(o => o.priority === 'CRITICAL' || o.priority === 'HIGH').slice(0, 5);

  const now = lastUpdate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const greeting = user?.name ? `Hola, ${user.name.split(' ')[0]}` : 'Hola';

  const completionRate = stats && stats.total > 0 ? Math.round((completed / stats.total) * 100) : 0;

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1300, margin: '0 auto', fontFamily: 'IBM Plex Sans, sans-serif' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
            {greeting} — Dashboard de Mantenimiento
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            Vista general del estado actual · Actualizado {now}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={load}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              background: '#f3f4f6', border: '1px solid #e5e7eb',
              fontSize: 13, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
              color: '#374151',
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Actualizar
          </button>
          <button
            onClick={() => navigate('/work-orders')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              background: '#1d4ed8', border: 'none',
              fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#fff',
            }}
          >
            <ClipboardList size={14} />
            Ver Órdenes
          </button>
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total OTs',         value: stats?.total ?? 0,  icon: ClipboardList, color: '#3b82f6', bg: '#eff6ff', sub: 'En el periodo' },
          { label: 'En Proceso',        value: inProgress,          icon: Zap,           color: '#f59e0b', bg: '#fffbeb', sub: `+${pending} pendientes` },
          { label: 'Vencidas',          value: stats?.overdue ?? 0, icon: AlertTriangle, color: '#ef4444', bg: '#fef2f2', sub: 'Requieren atención', alert: (stats?.overdue ?? 0) > 0 },
          { label: '% Completadas',     value: `${completionRate}%`,icon: TrendingUp,    color: '#10b981', bg: '#f0fdf4', sub: `${completed} completadas` },
        ].map(({ label, value, icon: Icon, color, bg, sub, alert }) => (
          <div key={label} style={{
            background: alert ? '#fef2f2' : '#fff',
            border: `1px solid ${alert ? '#fecaca' : '#e5e7eb'}`,
            borderRadius: 12, padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</p>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} color={color} />
              </div>
            </div>
            {loading
              ? <Sk h={32} w="60%" />
              : <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: alert ? '#dc2626' : '#111827', lineHeight: 1 }}>{value}</p>
            }
            <p style={{ margin: '6px 0 0', fontSize: 12, color: alert ? '#dc2626' : '#9ca3af' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Mid row: Assets + Status distribution ──────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Asset health */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Factory size={16} color="#6b7280" />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Estado de Equipos</h3>
            </div>
            <button onClick={() => navigate('/assets')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 3 }}>
              Ver todos <ChevronRight size={13} />
            </button>
          </div>

          {loading
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[1,2,3].map(i => <Sk key={i} h={36} />)}</div>
            : assets.length === 0
              ? <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>No hay equipos registrados</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { key: 'OPERATIONAL',      count: opCount,   total: assets.length },
                    { key: 'UNDER_MAINTENANCE', count: mttoCount, total: assets.length },
                    { key: 'OUT_OF_SERVICE',   count: outCount,  total: assets.length },
                  ].map(({ key, count, total }) => (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: ASSET_STATUS_COLOR[key] }} />
                          <span style={{ fontSize: 13, color: '#374151' }}>{ASSET_STATUS_LABEL[key]}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{count} <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>/ {total}</span></span>
                      </div>
                      <ProgressBar value={total > 0 ? (count / total) * 100 : 0} color={ASSET_STATUS_COLOR[key]} />
                    </div>
                  ))}
                  <div style={{ marginTop: 8, padding: '8px 10px', background: '#f9fafb', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Total equipos registrados</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{assets.length}</span>
                  </div>
                </div>
              )
          }
        </div>

        {/* Work order distribution */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={16} color="#6b7280" />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Distribución de Órdenes</h3>
            </div>
            <button onClick={() => navigate('/work-orders')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 3 }}>
              Ver todas <ChevronRight size={13} />
            </button>
          </div>

          {loading
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[1,2,3,4].map(i => <Sk key={i} h={28} />)}</div>
            : !stats
              ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin datos</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { key: 'IN_PROGRESS', count: inProgress },
                    { key: 'PENDING',     count: pending },
                    { key: 'ON_HOLD',     count: onHold },
                    { key: 'COMPLETED',   count: completed },
                  ].map(({ key, count }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: '#374151', width: 110, flexShrink: 0 }}>{STATUS_LABEL[key]}</span>
                      <ProgressBar value={stats.total > 0 ? (count / stats.total) * 100 : 0} color={STATUS_COLOR[key]} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', width: 28, textAlign: 'right' }}>{count}</span>
                    </div>
                  ))}

                  {/* Priority distribution */}
                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 10, marginTop: 4 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.5px' }}>Por Prioridad</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {stats.byPriority.map(({ priority, _count }) => (
                        <span key={priority} style={{
                          padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                          background: PRIORITY_COLOR[priority] + '20', color: PRIORITY_COLOR[priority],
                        }}>
                          {PRIORITY_LABEL[priority] ?? priority}: {_count}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )
          }
        </div>
      </div>

      {/* ── Bottom row: Plans + Open Criticals + Recent ─────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

        {/* Upcoming maintenance plans */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={15} color="#6b7280" />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Próximos 14 días</h3>
            </div>
            <button onClick={() => navigate('/maintenance')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 3 }}>
              Planes <ChevronRight size={13} />
            </button>
          </div>

          {loading
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[1,2,3].map(i => <Sk key={i} h={52} />)}</div>
            : upcomingPlans.length === 0 && overduePlans.length === 0
              ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: 8 }}>
                  <CheckCircle2 size={28} color="#10b981" />
                  <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Sin mantenimientos próximos</p>
                </div>
              )
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {overduePlans.map(plan => {
                    const d = plan.nextDue ? daysUntil(plan.nextDue) : null;
                    return (
                      <div key={plan.id} style={{ padding: '8px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#dc2626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plan.name}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>{plan.asset.name} · {plan.asset.area}</p>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', flexShrink: 0, marginLeft: 6 }}>{Math.abs(d ?? 0)}d vencido</span>
                        </div>
                      </div>
                    );
                  })}
                  {upcomingPlans.map(plan => {
                    const d = plan.nextDue ? daysUntil(plan.nextDue) : null;
                    const urgent = (d ?? 99) <= 3;
                    return (
                      <div key={plan.id} style={{ padding: '8px 10px', background: urgent ? '#fffbeb' : '#f9fafb', border: `1px solid ${urgent ? '#fcd34d' : '#e5e7eb'}`, borderRadius: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plan.name}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>{plan.asset.name} · {TYPE_LABEL[plan.type] ?? plan.type}</p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: urgent ? '#d97706' : '#374151' }}>
                              {d === 0 ? 'Hoy' : `en ${d}d`}
                            </span>
                            <p style={{ margin: '2px 0 0', fontSize: 10, color: '#9ca3af' }}>{plan.nextDue ? fmtDate(plan.nextDue) : ''}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
          }
        </div>

        {/* Critical open work orders */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wrench size={15} color="#6b7280" />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>En Proceso — Críticas</h3>
            </div>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{criticalWOs.length} activas</span>
          </div>

          {loading
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map(i => <Sk key={i} h={58} />)}</div>
            : criticalWOs.length === 0
              ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: 8 }}>
                  <CheckCircle2 size={28} color="#10b981" />
                  <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Sin órdenes críticas abiertas</p>
                </div>
              )
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {criticalWOs.map(wo => (
                    <button
                      key={wo.id}
                      onClick={() => navigate(`/work-orders/${wo.id}`)}
                      style={{
                        display: 'block', textAlign: 'left', width: '100%',
                        padding: '8px 10px', background: '#f9fafb',
                        border: '1px solid #e5e7eb', borderRadius: 8,
                        cursor: 'pointer', transition: 'background .15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#f9fafb')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{wo.code.slice(-8).toUpperCase()}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: PRIORITY_COLOR[wo.priority], background: PRIORITY_COLOR[wo.priority] + '20', padding: '1px 6px', borderRadius: 99 }}>
                          {PRIORITY_LABEL[wo.priority]}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wo.title}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>{wo.asset?.name ?? '—'}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{wo.assignedTo?.name ?? 'Sin asignar'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )
          }
        </div>

        {/* Recent work orders */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={15} color="#6b7280" />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Actividad Reciente</h3>
            </div>
            <button onClick={() => navigate('/work-orders')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 3 }}>
              Ver todas <ChevronRight size={13} />
            </button>
          </div>

          {loading
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3,4].map(i => <Sk key={i} h={48} />)}</div>
            : recentWOs.length === 0
              ? <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Sin órdenes de trabajo</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recentWOs.map(wo => (
                    <button
                      key={wo.id}
                      onClick={() => navigate(`/work-orders/${wo.id}`)}
                      style={{
                        display: 'block', textAlign: 'left', width: '100%',
                        padding: '7px 10px', background: '#f9fafb',
                        border: '1px solid #e5e7eb', borderRadius: 8,
                        cursor: 'pointer', transition: 'background .15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#f9fafb')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 6 }}>{wo.title}</p>
                        <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[wo.status], background: STATUS_COLOR[wo.status] + '20', padding: '1px 6px', borderRadius: 99, flexShrink: 0 }}>
                          {STATUS_LABEL[wo.status] ?? wo.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>{wo.asset?.name ?? '—'}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{fmtRelative(wo.createdAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )
          }
        </div>
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
