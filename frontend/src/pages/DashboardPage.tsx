import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Wrench, BarChart3, Car, ClipboardCheck,
  ChevronRight, CheckCircle2, Activity,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { api, oeeApi, OEESummary } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { mockStats } from '@/data/mockData';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditDash {
  capaStats: { open: number; inProgress: number; overdue: number };
  byArea: { area: string; count: number; avgScore: number | null }[];
}

interface FleetStats { total: number; alerts: number }

interface AttentionItem {
  module: string;
  color: string;
  text: string;
  path: string;
}

interface KPI {
  label: string;
  value: string | number;
  alert: boolean;
}

// ─── Helper: extract total from API response (array or paginated) ─────────────
function extractTotal(data: unknown): number {
  if (!data) return 0;
  if (Array.isArray(data)) return data.length;
  const d = data as Record<string, unknown>;
  if (typeof d.total === 'number') return d.total;
  if (Array.isArray(d.data)) return (d.data as unknown[]).length;
  return 0;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate   = useNavigate();
  const { user }   = useAuth();

  // ── State ──
  const [oeeToday,          setOeeToday]          = useState<OEESummary | null>(null);
  const [oeeActiveDowntime, setOeeActiveDowntime] = useState(0);
  const [auditDash,         setAuditDash]         = useState<AuditDash | null>(null);
  const [fleetStats,        setFleetStats]        = useState<FleetStats | null>(null);
  const [loading,           setLoading]           = useState(true);

  // ── Fetch ──
  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    Promise.allSettled([
      oeeApi.getPlantSummary({ startDate: todayStr, endDate: todayStr }),
      oeeApi.getDowntimeEvents({ open: 'true', limit: 50 }),
      api.get<AuditDash>('/audits/dashboard'),
      api.get('/fleet/vehicles?limit=200'),
      api.get('/fleet/alerts?limit=50'),
    ]).then(([oee, downtime, audit, vehicles, fleetAlerts]) => {
      if (oee.status     === 'fulfilled') setOeeToday(oee.value);
      if (downtime.status === 'fulfilled') setOeeActiveDowntime(downtime.value.data.length);
      if (audit.status   === 'fulfilled') setAuditDash(audit.value.data);

      if (vehicles.status === 'fulfilled' && fleetAlerts.status === 'fulfilled') {
        setFleetStats({
          total:  extractTotal(vehicles.value.data),
          alerts: extractTotal(fleetAlerts.value.data),
        });
      }

      setLoading(false);
    });
  }, []);

  // ── Derived ──
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const dateStr  = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const { pending, inProgress, completed, overdue } = mockStats;

  const avgScore: number | null = (() => {
    if (!auditDash?.byArea) return null;
    const scored = auditDash.byArea.filter(a => a.avgScore !== null);
    if (!scored.length) return null;
    return Math.round((scored.reduce((s, a) => s + (a.avgScore ?? 0), 0) / scored.length) * 10) / 10;
  })();

  // Items de atención unificados de todos los módulos
  const attentionItems: AttentionItem[] = [
    ...(overdue > 0
      ? [{ module: 'Mantenimiento', color: '#e67e22', path: '/work-orders',
          text: `${overdue} orden${overdue > 1 ? 'es' : ''} vencida${overdue > 1 ? 's' : ''} sin cerrar` }]
      : []),
    ...(oeeActiveDowntime > 0
      ? [{ module: 'OEE', color: '#2980b9', path: '/oee/downtime',
          text: `${oeeActiveDowntime} parada${oeeActiveDowntime > 1 ? 's' : ''} activa${oeeActiveDowntime > 1 ? 's' : ''} sin cerrar` }]
      : []),
    ...(oeeToday && oeeToday.oee < 65 && oeeToday.recordCount > 0
      ? [{ module: 'OEE', color: '#c0392b', path: '/oee',
          text: `OEE crítico: ${oeeToday.oee.toFixed(1)}% — por debajo del umbral mínimo (65%)` }]
      : []),
    ...((auditDash?.capaStats.overdue ?? 0) > 0
      ? [{ module: 'Auditorías', color: '#8b5cf6', path: '/audits/findings',
          text: `${auditDash!.capaStats.overdue} CAPA${auditDash!.capaStats.overdue > 1 ? 's' : ''} vencida${auditDash!.capaStats.overdue > 1 ? 's' : ''} sin resolver` }]
      : []),
    ...((fleetStats?.alerts ?? 0) > 0
      ? [{ module: 'Flota', color: '#16a34a', path: '/fleet/alerts',
          text: `${fleetStats!.alerts} alerta${fleetStats!.alerts > 1 ? 's' : ''} de flota activa${fleetStats!.alerts > 1 ? 's' : ''}` }]
      : []),
  ];

  // ── Definición de tarjetas de módulo ──────────────────────────────────────

  const mttoHealth = completed / Math.max(completed + pending + inProgress + overdue, 1) * 100;

  type ModuleCard = {
    id: string;
    title: string;
    icon: React.ElementType;
    color: string;
    path: string;
    kpis: KPI[];
    health: number;
    healthLabel: string;
    loaded: boolean;
  };

  const moduleCards: ModuleCard[] = [
    {
      id: 'maintenance',
      title: 'Mantenimiento',
      icon: Wrench,
      color: '#e67e22',
      path: '/work-orders',
      loaded: true,
      kpis: [
        { label: 'Pendientes',  value: pending,    alert: pending > 10 },
        { label: 'Vencidas',    value: overdue,    alert: overdue > 0  },
        { label: 'En progreso', value: inProgress, alert: false        },
      ],
      health: mttoHealth,
      healthLabel: `${completed} completadas de ${completed + pending + inProgress + overdue}`,
    },
    {
      id: 'oee',
      title: 'OEE del Día',
      icon: BarChart3,
      color: '#2980b9',
      path: '/oee',
      loaded: !loading,
      kpis: oeeToday && oeeToday.recordCount > 0
        ? [
            { label: 'OEE',          value: `${oeeToday.oee.toFixed(1)}%`,          alert: oeeToday.oee < 65          },
            { label: 'Disponib.',    value: `${oeeToday.availability.toFixed(1)}%`, alert: oeeToday.availability < 70 },
            { label: 'Paros activos',value: oeeActiveDowntime,                      alert: oeeActiveDowntime > 0      },
          ]
        : [
            { label: 'OEE',          value: '—',              alert: false                 },
            { label: 'Disponib.',    value: '—',              alert: false                 },
            { label: 'Paros activos',value: oeeActiveDowntime, alert: oeeActiveDowntime > 0 },
          ],
      health: oeeToday?.oee ?? 0,
      healthLabel: oeeToday && oeeToday.recordCount > 0
        ? `${oeeToday.recordCount} registro${oeeToday.recordCount > 1 ? 's' : ''} hoy`
        : 'Sin registros OEE hoy',
    },
    {
      id: 'fleet',
      title: 'Flota',
      icon: Car,
      color: '#16a34a',
      path: '/fleet',
      loaded: !loading,
      kpis: [
        { label: 'Total',      value: fleetStats?.total  ?? '—', alert: false                              },
        { label: 'Alertas',   value: fleetStats?.alerts ?? '—', alert: (fleetStats?.alerts ?? 0) > 0      },
        { label: 'Operativos',
          value: fleetStats ? fleetStats.total - fleetStats.alerts : '—',
          alert: false,
        },
      ],
      health: fleetStats
        ? ((fleetStats.total - fleetStats.alerts) / Math.max(fleetStats.total, 1)) * 100
        : 0,
      healthLabel: fleetStats
        ? `${fleetStats.total - fleetStats.alerts} / ${fleetStats.total} operativos`
        : 'Sin datos de flota',
    },
    {
      id: 'audits',
      title: 'Auditorías',
      icon: ClipboardCheck,
      color: '#8b5cf6',
      path: '/audits',
      loaded: !loading,
      kpis: [
        { label: 'CAPAs abiertas', value: auditDash?.capaStats.open    ?? '—', alert: (auditDash?.capaStats.open    ?? 0) > 0 },
        { label: 'Vencidas',       value: auditDash?.capaStats.overdue ?? '—', alert: (auditDash?.capaStats.overdue ?? 0) > 0 },
        { label: 'Puntaje prom.',  value: avgScore !== null ? `${avgScore}%` : '—', alert: avgScore !== null && avgScore < 70 },
      ],
      health: avgScore ?? 0,
      healthLabel: avgScore !== null ? `${avgScore}% promedio por área` : 'Sin auditorías recientes',
    },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', padding: '0 0 32px' }}>

      {/* ── Topbar saludo ── */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--sz-text)' }}>
            {greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </span>
          <span style={{ fontSize: 12, color: 'var(--sz-muted)' }}>
            {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {loading && (
            <Activity size={13} color="var(--sz-muted)" style={{ animation: 'sz-pulse 1.5s ease-in-out infinite' }} />
          )}
          <span style={{ fontSize: 11, color: 'var(--sz-muted)', fontWeight: 500, letterSpacing: '.3px', textTransform: 'uppercase' }}>
            Centro de Control
          </span>
        </div>
      </div>

      <div style={{ padding: '20px 24px 0' }}>

        {/* ── Tarjetas de módulo ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
          marginBottom: 20,
        }}>
          {moduleCards.map((mod) => {
            const Icon = mod.icon;
            return (
              <Card key={mod.id} topAccent={mod.color}>
                <div style={{ padding: '16px' }}>

                  {/* Cabecera */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 7,
                      background: `${mod.color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={16} color={mod.color} />
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: 'var(--sz-text)',
                      marginLeft: 8, flex: 1,
                    }}>
                      {mod.title}
                    </span>
                    <button
                      onClick={() => navigate(mod.path)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: mod.color, fontSize: 11, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 1,
                        padding: '3px 5px', borderRadius: 4,
                        fontFamily: 'IBM Plex Sans, sans-serif',
                      }}
                    >
                      Ver <ChevronRight size={12} />
                    </button>
                  </div>

                  {/* KPIs */}
                  {!mod.loaded ? (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div className="sz-skeleton" style={{ height: 24, borderRadius: 4 }} />
                          <div className="sz-skeleton" style={{ height: 9, width: '65%' }} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      {mod.kpis.map((kpi, i) => (
                        <div key={i} style={{
                          flex: 1, textAlign: 'center',
                          padding: '7px 4px', borderRadius: 6,
                          background: kpi.alert ? '#fde8e6' : 'var(--sz-bg)',
                          border: `1px solid ${kpi.alert ? '#f5c6c2' : 'var(--sz-border)'}`,
                        }}>
                          <div style={{
                            fontSize: 20, fontWeight: 800, lineHeight: 1,
                            color: kpi.alert ? '#c0392b' : mod.color,
                          }}>
                            {kpi.value}
                          </div>
                          <div style={{
                            fontSize: 9, color: 'var(--sz-muted)', marginTop: 4,
                            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.3px',
                            lineHeight: 1.2,
                          }}>
                            {kpi.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Barra de salud del módulo */}
                  <ProgressBar value={mod.health} color={mod.color} height={4} />
                  <div style={{ fontSize: 10, color: 'var(--sz-muted)', marginTop: 4 }}>
                    {mod.healthLabel}
                  </div>

                </div>
              </Card>
            );
          })}
        </div>

        {/* ── Panel de atención requerida ── */}
        <Card>
          <div style={{
            padding: '12px 16px',
            borderBottom: attentionItems.length > 0 ? '1px solid var(--sz-border)' : 'none',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: attentionItems.length > 0 ? '#c0392b' : '#27ae60',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sz-text)' }}>
              {attentionItems.length > 0
                ? `${attentionItems.length} elemento${attentionItems.length > 1 ? 's' : ''} requieren atención`
                : 'Sin alertas pendientes'}
            </span>
            {attentionItems.length > 0 && (
              <span style={{
                marginLeft: 'auto', fontSize: 10, color: '#c0392b',
                background: '#fde8e6', padding: '2px 8px', borderRadius: 10, fontWeight: 700,
              }}>
                {attentionItems.length} activo{attentionItems.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {attentionItems.length === 0 ? (
            <div style={{ padding: '30px 16px', textAlign: 'center' }}>
              <CheckCircle2
                size={34} color="#27ae60"
                style={{ margin: '0 auto 10px', display: 'block' }}
              />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#27ae60' }}>
                Todo en orden
              </div>
              <div style={{ fontSize: 12, color: 'var(--sz-muted)', marginTop: 4 }}>
                Todos los módulos operando sin alertas críticas
              </div>
            </div>
          ) : (
            <div>
              {attentionItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => navigate(item.path)}
                  className="sz-table-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', padding: '12px 16px',
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                    borderBottom: i < attentionItems.length - 1
                      ? '1px solid var(--sz-border)'
                      : 'none',
                  }}
                >
                  {/* Indicador de módulo */}
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    color: item.color,
                    background: `${item.color}15`,
                    border: `1px solid ${item.color}30`,
                    padding: '2px 7px', borderRadius: 3,
                    textTransform: 'uppercase', letterSpacing: '.4px',
                    flexShrink: 0, minWidth: 80, textAlign: 'center',
                  }}>
                    {item.module}
                  </span>

                  {/* Texto */}
                  <span style={{ fontSize: 13, color: 'var(--sz-text)', flex: 1 }}>
                    {item.text}
                  </span>

                  {/* Ir a módulo */}
                  <span style={{ fontSize: 11, color: 'var(--sz-muted)', display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    Resolver <ChevronRight size={13} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}
