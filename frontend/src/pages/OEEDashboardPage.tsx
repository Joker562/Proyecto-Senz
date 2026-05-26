/**
 * OEEDashboardPage — Dashboard principal del módulo OEE
 * Conectado a la API real con filtros de fecha / turno / área.
 */
import { useState, useEffect, useCallback } from 'react';
import { BarChart3, AlertTriangle, Plus, RefreshCw, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { Card, CardHeader } from '@/components/ui/Card';
import { DonutChart } from '@/components/ui/DonutChart';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { oeeApi, OEESummary, OEETrendPoint, DowntimeEvent } from '@/services/api';
import CreateOEEModal    from '@/components/oee/CreateOEEModal';
import CreateDowntimeModal from '@/components/oee/CreateDowntimeModal';

// ─── Helpers de color semáforo ────────────────────────────────────────────────
const oeeColor  = (v: number | null) => !v ? '#aaa' : v >= 85 ? '#27ae60' : v >= 65 ? '#e67e22' : '#c0392b';
const availColor = (v: number | null) => !v ? '#aaa' : v >= 90 ? '#27ae60' : v >= 75 ? '#e67e22' : '#c0392b';
const perfColor  = (v: number | null) => !v ? '#aaa' : v >= 95 ? '#27ae60' : v >= 80 ? '#e67e22' : '#c0392b';
const qualColor  = (v: number | null) => !v ? '#aaa' : v >= 99 ? '#27ae60' : v >= 95 ? '#e67e22' : '#c0392b';

const today = () => new Date().toISOString().split('T')[0];
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().split('T')[0];

// ─── Componente ───────────────────────────────────────────────────────────────

export default function OEEDashboardPage() {
  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate,   setEndDate]   = useState(today());
  const [shift,     setShift]     = useState('');

  const [summary,   setSummary]   = useState<OEESummary | null>(null);
  const [trend,     setTrend]     = useState<OEETrendPoint[]>([]);
  const [downtime,  setDowntime]  = useState<DowntimeEvent[]>([]);
  const [loading,   setLoading]   = useState(true);

  const [createOEE,    setCreateOEE]    = useState(false);
  const [createDT,     setCreateDT]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { startDate, endDate, shift: shift || undefined };
      const [s, t, dt] = await Promise.all([
        oeeApi.getPlantSummary(params),
        oeeApi.getTrend({ ...params, groupBy: 'day' }),
        oeeApi.getDowntimeEvents({ limit: 10 }),
      ]);
      setSummary(s);
      setTrend(t);
      setDowntime(dt.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, shift]);

  useEffect(() => { load(); }, [load]);

  // KPIs con semáforo
  const kpis = [
    {
      label: 'OEE Global', value: summary?.oee ?? null, color: oeeColor(summary?.oee ?? null),
      sub: summary?.oee != null ? (summary.oee >= 85 ? 'Clase mundial ✅' : summary.oee >= 65 ? 'Por mejorar ⚠️' : 'Crítico 🔴') : '—',
      benchmark: 85,
    },
    {
      label: 'Disponibilidad', value: summary?.availability ?? null, color: availColor(summary?.availability ?? null),
      sub: 'Meta: ≥ 90%', benchmark: 90,
    },
    {
      label: 'Rendimiento', value: summary?.performance ?? null, color: perfColor(summary?.performance ?? null),
      sub: 'Meta: ≥ 95%', benchmark: 95,
    },
    {
      label: 'Calidad', value: summary?.quality ?? null, color: qualColor(summary?.quality ?? null),
      sub: 'Meta: ≥ 99%', benchmark: 99,
    },
  ];

  // Preparar datos del bar chart (last 7 days del trend)
  const barData = trend.slice(-7).map(t => ({
    ...t,
    period: t.period.slice(5), // MM-DD
  }));

  // CATEGORY label
  const CATEGORY: Record<string, string> = {
    PLANNED: 'Planificado', UNPLANNED: 'Imprevisto',
    SETUP: 'Setup', MINOR_STOP: 'Microparo',
  };
  const LOSS_COLOR: Record<string, string> = {
    AVAILABILITY: '#2980b9', PERFORMANCE: '#27ae60', QUALITY: '#8b5cf6',
  };

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)', padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)', flex: 1 }}>Dashboard OEE</span>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)}
            style={{ fontSize: 12, border: '1px solid var(--sz-border)', borderRadius: 5, padding: '4px 8px', background: 'var(--sz-card)', color: 'var(--sz-text)' }} />
          <span style={{ color: 'var(--sz-muted)', fontSize: 12 }}>→</span>
          <input type="date" value={endDate} min={startDate} max={today()} onChange={e => setEndDate(e.target.value)}
            style={{ fontSize: 12, border: '1px solid var(--sz-border)', borderRadius: 5, padding: '4px 8px', background: 'var(--sz-card)', color: 'var(--sz-text)' }} />
          <select value={shift} onChange={e => setShift(e.target.value)}
            style={{ fontSize: 12, border: '1px solid var(--sz-border)', borderRadius: 5, padding: '4px 8px', background: 'var(--sz-card)', color: 'var(--sz-text)' }}>
            <option value="">Todos los turnos</option>
            <option value="MORNING">Mañana</option>
            <option value="AFTERNOON">Tarde</option>
            <option value="NIGHT">Noche</option>
          </select>
          <button onClick={load} title="Actualizar" style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid var(--sz-border)', background: 'var(--sz-card)', cursor: 'pointer', color: 'var(--sz-muted)', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setCreateDT(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid #e67e22', background: 'transparent', color: '#e67e22', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <AlertTriangle size={13} /> Registrar paro
          </button>
          <button onClick={() => setCreateOEE(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, border: 'none', background: '#2980b9', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={13} /> Registrar OEE
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <span style={{ color: 'var(--sz-muted)', fontSize: 14 }}>Cargando datos OEE…</span>
        </div>
      ) : (
        <div style={{ padding: '16px 24px' }}>

          {/* ── KPI Cards ──────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {kpis.map(k => (
              <Card key={k.label} topAccent={k.color}>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 34, fontWeight: 900, color: k.color, lineHeight: 1, marginBottom: 4 }}>
                    {k.value !== null ? `${k.value}%` : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--sz-muted)', marginBottom: 8 }}>{k.sub}</div>
                  {/* Barra de progreso vs benchmark */}
                  {k.value !== null && (
                    <>
                      <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(k.value, 100)}%`, height: '100%', background: k.color, borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--sz-muted)', marginTop: 3 }}>
                        Benchmark {k.benchmark}% — {k.value >= k.benchmark ? `+${(k.value - k.benchmark).toFixed(1)}pp` : `${(k.value - k.benchmark).toFixed(1)}pp`}
                      </div>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* ── Charts ─────────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, marginBottom: 16 }}>

            {/* Tendencia OEE — Recharts LineChart */}
            <Card>
              <CardHeader title="Tendencia OEE" subtitle={`${startDate} → ${endDate}`} icon={<TrendingUp size={14} />} />
              <div style={{ padding: '16px 8px 8px' }}>
                {trend.length === 0 ? (
                  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>
                    Sin datos en el período seleccionado
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--sz-border)" />
                      <XAxis dataKey="period" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} unit="%" />
                      <Tooltip formatter={(v: number) => `${v}%`} labelFormatter={v => `Fecha: ${v}`} />
                      <Legend iconType="plainline" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Line type="monotone" dataKey="oee"          stroke="#e67e22" strokeWidth={2.5} dot={false} name="OEE" />
                      <Line type="monotone" dataKey="availability" stroke="#2980b9" strokeWidth={1.5} dot={false} name="Disponibilidad" strokeDasharray="4 2" />
                      <Line type="monotone" dataKey="performance"  stroke="#27ae60" strokeWidth={1.5} dot={false} name="Rendimiento"    strokeDasharray="4 2" />
                      <Line type="monotone" dataKey="quality"      stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="Calidad"        strokeDasharray="4 2" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* Comparativa A/P/Q últimos 7 días — BarChart */}
            <Card>
              <CardHeader title="A / P / Q últimos 7 días" subtitle="Barras apiladas" icon={<BarChart3 size={14} />} />
              <div style={{ padding: '16px 4px 8px' }}>
                {barData.length === 0 ? (
                  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>Sin datos</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--sz-border)" />
                      <XAxis dataKey="period" tick={{ fontSize: 9 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} unit="%" />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Bar dataKey="availability" name="Disponib." fill="#2980b9" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="performance"  name="Rendim."  fill="#27ae60" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="quality"      name="Calidad"  fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          {/* ── Comparativa por Área + Paros ──────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, marginBottom: 0 }}>

            {/* OEE por área */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', padding: '0 2px' }}>OEE por Área</div>
              {(summary?.byArea ?? []).length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--sz-muted)', padding: '12px 0' }}>Sin datos de área</div>
              )}
              {(summary?.byArea ?? []).map(area => (
                <Card key={area.area}>
                  <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <DonutChart value={area.oee} size={54} strokeWidth={6} color={oeeColor(area.oee)} label={`${area.oee}%`} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--sz-text)', marginBottom: 5 }}>{area.area}</div>
                      <ProgressBar value={area.availability} color={availColor(area.availability)} height={4} label={`D ${area.availability}%`} showLabel />
                      <div style={{ marginTop: 3 }}>
                        <ProgressBar value={area.performance} color={perfColor(area.performance)} height={4} label={`R ${area.performance}%`} showLabel />
                      </div>
                      <div style={{ marginTop: 3 }}>
                        <ProgressBar value={area.quality} color={qualColor(area.quality)} height={4} label={`C ${area.quality}%`} showLabel />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Tabla de paros recientes */}
            <Card>
              <CardHeader
                title="Eventos de Paro Recientes"
                subtitle="Últimos 10 registros"
                icon={<AlertTriangle size={14} />}
                action={
                  <button onClick={() => setCreateDT(true)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid #e67e22', background: 'transparent', color: '#e67e22', cursor: 'pointer', fontWeight: 600 }}>
                    + Registrar
                  </button>
                }
              />
              <div style={{ overflowX: 'auto' }}>
                {downtime.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>Sin eventos de paro registrados</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--sz-border)' }}>
                        {['Equipo', 'Categoría', 'Tipo pérdida', 'Causa', 'Duración', 'Estado'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--sz-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {downtime.map((e, i) => (
                        <tr key={e.id} style={{ borderBottom: '1px solid var(--sz-border)', background: i % 2 === 0 ? 'var(--sz-card)' : 'var(--sz-bg)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--sz-text)', whiteSpace: 'nowrap' }}>
                            {e.asset?.code ?? '—'}
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: e.category === 'UNPLANNED' ? '#fef2f2' : '#f0f9ff', color: e.category === 'UNPLANNED' ? '#c0392b' : '#2980b9' }}>
                              {CATEGORY[e.category] ?? e.category}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#f8f8f8', color: LOSS_COLOR[e.lossType] ?? 'var(--sz-muted)' }}>
                              {e.lossType}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--sz-text)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.reason}
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            {e.duration != null ? (
                              <span style={{ fontWeight: 700, color: e.duration >= 60 ? '#c0392b' : e.duration >= 30 ? '#e67e22' : 'var(--sz-text)' }}>
                                {e.duration} min
                              </span>
                            ) : <span style={{ color: 'var(--sz-muted)' }}>—</span>}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {e.endTime
                              ? <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#f0fdf4', color: '#27ae60', fontWeight: 600 }}>Cerrado</span>
                              : <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fef2f2', color: '#c0392b', fontWeight: 600 }}>Abierto</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── Totales al pie ─────────────────────────────────────────────────── */}
      {!loading && summary && (
        <div style={{ display: 'flex', gap: 24, padding: '12px 24px', borderTop: '1px solid var(--sz-border)', marginTop: 8, fontSize: 11, color: 'var(--sz-muted)', flexWrap: 'wrap' }}>
          <span>📋 {summary.recordCount} registros</span>
          <span>⏱ {summary.totalPlannedHours}h planificadas</span>
          <span>✅ {summary.totalGood?.toLocaleString()} piezas buenas</span>
          <span>❌ {summary.totalDefects?.toLocaleString()} defectos</span>
        </div>
      )}

      {/* ── Modales ────────────────────────────────────────────────────────── */}
      <CreateOEEModal    open={createOEE} onClose={() => setCreateOEE(false)} onSuccess={load} />
      <CreateDowntimeModal open={createDT} onClose={() => setCreateDT(false)} onSuccess={load} />
    </div>
  );
}
