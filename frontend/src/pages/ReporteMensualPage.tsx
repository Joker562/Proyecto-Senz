import { useState, useEffect, useMemo } from 'react';
import { Download, RefreshCw, BarChart2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { LineChartSVG } from '@/components/ui/LineChartSVG';
import { SparkLine } from '@/components/ui/SparkLine';
import { api } from '@/services/api';
import { exportMonthlyExcel } from '@/lib/excelExport';

const AREA_COLORS = ['#e67e22', '#2980b9', '#27ae60', '#8b5cf6', '#c0392b', '#16a085', '#d35400', '#2c3e50'];

function scoreColor(v: number): { color: string; bg: string } {
  if (v >= 90) return { color: '#27ae60', bg: '#e9f7ef' };
  if (v >= 70) return { color: '#e67e22', bg: '#fef3e7' };
  return { color: '#c0392b', bg: '#fde8e6' };
}

function fmtMonth(key: string): string {
  const [y, m] = key.split('-');
  return new Date(+y, +m - 1).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
}

interface MonthlyRow   { month: string; [area: string]: number | null | string }
interface AreaSummary  { area: string; count: number; avg: number | null }
interface ApiResponse  { rows: MonthlyRow[]; areas: string[]; areaSummary: AreaSummary[]; months: number }

export default function ReporteMensualPage() {
  const [data, setData]     = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get<ApiResponse>('/audits/reports/monthly?months=6');
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Transformar rows → { area, months: [v...] } para la tabla
  const tableRows = useMemo(() => {
    if (!data) return [];
    return data.areas.map((area) => ({
      area,
      months: data.rows.map((r) => {
        const v = r[area];
        return typeof v === 'number' ? v : null;
      }),
    }));
  }, [data]);

  const monthLabels = useMemo(() => data?.rows.map((r) => fmtMonth(r.month)) ?? [], [data]);

  const auditSeries = useMemo(() =>
    (data?.areas ?? []).map((area, i) => ({ key: area, color: AREA_COLORS[i % AREA_COLORS.length] })),
    [data]);

  // Formato de rows para el LineChart: reemplazar claves de mes ISO por etiqueta legible
  const trendData = useMemo(() =>
    (data?.rows ?? []).map((r, i) => ({ ...r, month: monthLabels[i] ?? r.month })),
    [data, monthLabels]);

  const handleExport = () => {
    if (!data) return;
    exportMonthlyExcel(data.rows, data.areas);
  };

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* Topbar */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={16} style={{ color: 'var(--sz-accent)' }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>Cumplimiento Mensual</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={load}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--sz-border)', borderRadius: 8, background: 'var(--sz-card)', cursor: 'pointer', fontSize: 12, color: 'var(--sz-text)' }}
          >
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Actualizar
          </button>
          <button
            onClick={handleExport}
            disabled={loading || !data}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--sz-border)', borderRadius: 8, background: 'var(--sz-card)', cursor: 'pointer', fontSize: 12, color: 'var(--sz-text)' }}
          >
            <Download size={12} />
            Exportar Excel
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 24px' }}>

        {/* Compliance table */}
        <Card style={{ marginBottom: 16 }}>
          <CardHeader title="Puntajes de Cumplimiento por Área" subtitle="Últimos 6 meses" />
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>Cargando datos…</div>
          ) : tableRows.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>
              No hay auditorías completadas en los últimos 6 meses.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap' }}>
                      Área
                    </th>
                    {monthLabels.map((m) => (
                      <th key={m} style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap' }}>
                        {m}
                      </th>
                    ))}
                    <th style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap' }}>
                      Tendencia
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => {
                    const defined = row.months.filter((v) => v !== null) as number[];
                    return (
                      <tr key={row.area}
                        className="sz-table-row"
                        style={{ borderBottom: '1px solid var(--sz-border)', background: i % 2 === 0 ? 'var(--sz-card)' : '#fafafa' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--sz-text)', whiteSpace: 'nowrap' }}>{row.area}</td>
                        {row.months.map((v, mi) => {
                          if (v === null) return <td key={mi} style={{ padding: '10px 10px', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 11 }}>—</td>;
                          const { color, bg } = scoreColor(v);
                          return (
                            <td key={mi} style={{ padding: '10px 10px', textAlign: 'center' }}>
                              <span style={{ display: 'inline-block', minWidth: 40, padding: '3px 8px', borderRadius: 12, background: bg, color, fontWeight: 700, fontSize: 12 }}>
                                {v}%
                              </span>
                            </td>
                          );
                        })}
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {defined.length >= 2
                            ? <SparkLine data={defined} color={scoreColor(defined[defined.length - 1]).color} width={70} height={24} />
                            : <span style={{ color: 'var(--sz-muted)', fontSize: 11 }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Trend chart */}
        {!loading && trendData.length > 0 && (
          <Card>
            <CardHeader title="Tendencia de Cumplimiento" subtitle="Evolución histórica por área" />
            <div style={{ padding: '16px 16px 8px' }}>
              <LineChartSVG
                data={trendData}
                xKey="month"
                series={auditSeries}
                height={180}
                yMin={40}
                yMax={110}
              />
              <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                {auditSeries.map((s) => (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--sz-muted)' }}>
                    <div style={{ width: 14, height: 2, background: s.color, borderRadius: 1 }} />
                    {s.key}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Resumen por área */}
        {!loading && data && data.areaSummary.length > 0 && (
          <Card style={{ marginTop: 16 }}>
            <CardHeader title="Resumen por Área" subtitle={`Promedio general — últimos ${data.months} meses`} />
            <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              {data.areaSummary.map((s, i) => {
                const sc = s.avg !== null ? scoreColor(s.avg) : { color: '#95a5a6', bg: '#f5f5f5' };
                return (
                  <div key={s.area} style={{ background: sc.bg, borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${AREA_COLORS[i % AREA_COLORS.length]}` }}>
                    <div style={{ fontSize: 11, color: 'var(--sz-muted)', marginBottom: 4 }}>{s.area}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: sc.color }}>
                      {s.avg !== null ? `${s.avg}%` : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--sz-muted)', marginTop: 2 }}>{s.count} auditoría{s.count !== 1 ? 's' : ''}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}
