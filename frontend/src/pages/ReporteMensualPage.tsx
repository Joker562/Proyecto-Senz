import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { BarChart3, FileDown, RefreshCw, TrendingUp } from 'lucide-react';
import { api } from '@/services/api';
import { exportMonthlyExcel } from '@/lib/excelExport';

const FONT = 'IBM Plex Sans, sans-serif';

const AREA_COLORS = [
  '#27ae60', '#2980b9', '#8e44ad', '#e67e22',
  '#e74c3c', '#16a085', '#d35400', '#2c3e50',
];

interface MonthlyResponse {
  rows: Record<string, unknown>[];
  areas: string[];
  areaSummary: { area: string; count: number; avg: number | null }[];
  months: number;
}

function scoreColor(score: number | null): string {
  if (score === null) return '#ccc';
  if (score >= 90) return '#27ae60';
  if (score >= 70) return '#e67e22';
  return '#e74c3c';
}

function scoreLabel(score: number | null): string {
  if (score === null) return '—';
  if (score >= 90) return 'Excelente';
  if (score >= 70) return 'Aceptable';
  return 'Crítico';
}

// Formatear "2026-04" → "Abr 2026"
function fmtMonth(key: string): string {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
}

export default function ReporteMensualPage() {
  const [data, setData]       = useState<MonthlyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths]   = useState(6);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: r } = await api.get<MonthlyResponse>(`/audits/reports/monthly?months=${months}`);
      setData(r);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [months]);

  useEffect(() => { load(); }, [load]);

  const chartRows = (data?.rows ?? []).map(r => ({
    ...r,
    month: fmtMonth(r.month as string),
  }));

  const selectStyle: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid #e0e0e0', borderRadius: 8,
    fontSize: 12, fontFamily: FONT, background: '#fff', color: '#444', outline: 'none',
  };

  return (
    <div style={{ fontFamily: FONT, paddingBottom: 60 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#2980b918', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={18} style={{ color: '#2980b9' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Cumplimiento Mensual</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Promedio de puntaje por área · Comparativo histórico</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select style={selectStyle} value={months} onChange={e => setMonths(Number(e.target.value))}>
            {[3, 6, 12, 24].map(m => <option key={m} value={m}>Últimos {m} meses</option>)}
          </select>
          <button
            onClick={() => data && exportMonthlyExcel(data.rows, data.areas)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#555' }}
          >
            <FileDown size={14} /> Excel
          </button>
          <button
            onClick={load}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 12px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', color: '#888' }}
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#bbb', padding: 60, fontSize: 14 }}>Cargando datos…</div>
      ) : !data || data.rows.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 60, textAlign: 'center' }}>
          <BarChart3 size={40} style={{ color: '#ddd', marginBottom: 12 }} />
          <div style={{ color: '#aaa', fontSize: 14 }}>No hay auditorías completadas en los últimos {months} meses</div>
          <div style={{ color: '#ccc', fontSize: 12, marginTop: 4 }}>Completa auditorías para ver el historial de cumplimiento</div>
        </div>
      ) : (
        <>
          {/* ── Tarjetas resumen por área ─────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            {(data.areaSummary ?? []).map((s, i) => (
              <div key={s.area} style={{
                background: '#fff', border: `1px solid ${AREA_COLORS[i % AREA_COLORS.length]}30`,
                borderRadius: 12, padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: AREA_COLORS[i % AREA_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{s.area}</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: scoreColor(s.avg), lineHeight: 1 }}>
                  {s.avg !== null ? `${s.avg}%` : '—'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: '#aaa' }}>{s.count} auditoría{s.count !== 1 ? 's' : ''}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: scoreColor(s.avg) }}>{scoreLabel(s.avg)}</span>
                </div>
                {/* Mini barra */}
                {s.avg !== null && (
                  <div style={{ marginTop: 8, height: 4, background: '#f0f0f0', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${s.avg}%`, borderRadius: 2, background: scoreColor(s.avg), transition: 'width .4s' }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Gráfico de barras agrupadas ─────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '20px 16px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <TrendingUp size={16} style={{ color: '#2980b9' }} />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>Evolución por Área</h3>
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={chartRows} margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: FONT }} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: unknown) => val !== null ? [`${val}%`, ''] : ['—', '']}
                  contentStyle={{ fontFamily: FONT, fontSize: 12, borderRadius: 8 }}
                />
                <Legend
                  wrapperStyle={{ fontFamily: FONT, fontSize: 12, paddingTop: 8 }}
                />
                <ReferenceLine y={90} stroke="#27ae60" strokeDasharray="4 2" label={{ value: '90%', fontSize: 10, fill: '#27ae60' }} />
                <ReferenceLine y={70} stroke="#e67e22" strokeDasharray="4 2" label={{ value: '70%', fontSize: 10, fill: '#e67e22' }} />
                {(data.areas ?? []).map((area, i) => (
                  <Bar
                    key={area}
                    dataKey={area}
                    fill={AREA_COLORS[i % AREA_COLORS.length]}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={40}
                    name={area}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 8, fontSize: 10, color: '#bbb', textAlign: 'right' }}>
              Línea verde = 90% (excelente) · Línea naranja = 70% (mínimo aceptable)
            </div>
          </div>

          {/* ── Tabla de datos ─────────────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee' }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>Tabla de Datos</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9f9f9', borderBottom: '2px solid #eee' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#666', fontSize: 11, fontFamily: FONT }}>Mes</th>
                    {(data.areas ?? []).map((area, i) => (
                      <th key={area} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: AREA_COLORS[i % AREA_COLORS.length], fontSize: 11, fontFamily: FONT, whiteSpace: 'nowrap' }}>
                        {area}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.rows ?? []).map((row, ri) => (
                    <tr key={ri} style={{ borderBottom: '1px solid #f5f5f5', background: ri % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: '#444', fontFamily: FONT }}>
                        {fmtMonth(row.month as string)}
                      </td>
                      {(data.areas ?? []).map(area => {
                        const val = row[area] as number | null;
                        return (
                          <td key={area} style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {val !== null && val !== undefined ? (
                              <span style={{
                                background: `${scoreColor(val)}15`,
                                color: scoreColor(val),
                                fontWeight: 700, fontSize: 12,
                                padding: '3px 8px', borderRadius: 10,
                                fontFamily: FONT,
                              }}>
                                {val}%
                              </span>
                            ) : (
                              <span style={{ color: '#ddd', fontSize: 12 }}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
