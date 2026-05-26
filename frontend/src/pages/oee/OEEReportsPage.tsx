/**
 * OEEReportsPage — Exportación de reportes OEE
 * Filtros avanzados + preview de registros + botones CSV / PDF
 */

import { useState, useEffect, useCallback } from 'react';
import { FileDown, FileText, RefreshCw, Calendar, Filter, AlertTriangle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { oeeApi, api, OEERecord, OEESummary, OEETrendPoint } from '@/services/api';
import { exportOEEtoCSV, exportOEEtoPDF } from '@/utils/oeeExport';

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const PRESETS: Array<{ label: string; getRange: () => [string, string] }> = [
  {
    label: 'Este mes',
    getRange: () => {
      const now = new Date();
      return [isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), isoDate(new Date())];
    },
  },
  {
    label: 'Mes anterior',
    getRange: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last  = new Date(now.getFullYear(), now.getMonth(), 0);
      return [isoDate(first), isoDate(last)];
    },
  },
  {
    label: 'Últimos 3 meses',
    getRange: () => {
      const now = new Date();
      return [isoDate(new Date(now.getFullYear(), now.getMonth() - 2, 1)), isoDate(now)];
    },
  },
  {
    label: 'Este año',
    getRange: () => {
      const now = new Date();
      return [isoDate(new Date(now.getFullYear(), 0, 1)), isoDate(now)];
    },
  },
];

const today = isoDate(new Date());
const monthAgo = isoDate(new Date(Date.now() - 30 * 86400000));

// ─── Color semáforo ───────────────────────────────────────────────────────────

const oeeColor = (v: number | null) =>
  !v ? '#aaa' : v >= 85 ? '#27ae60' : v >= 65 ? '#e67e22' : '#c0392b';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssetOption { id: string; code: string; name: string; area: string }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OEEReportsPage() {
  // ── Filtros ──
  const [startDate, setStartDate] = useState(monthAgo);
  const [endDate,   setEndDate]   = useState(today);
  const [shift,     setShift]     = useState('');
  const [area,      setArea]      = useState('');
  const [assetId,   setAssetId]   = useState('');
  const [activePreset, setActivePreset] = useState('');

  // ── Datos ──
  const [summary,   setSummary]   = useState<OEESummary | null>(null);
  const [trend,     setTrend]     = useState<OEETrendPoint[]>([]);
  const [records,   setRecords]   = useState<OEERecord[]>([]);
  const [assets,    setAssets]    = useState<AssetOption[]>([]);
  const [areas,     setAreas]     = useState<string[]>([]);
  const [total,     setTotal]     = useState(0);

  // ── Estado ──
  const [loading,      setLoading]      = useState(false);
  const [exporting,    setExporting]    = useState<'csv' | 'pdf' | null>(null);
  const [hasLoaded,    setHasLoaded]    = useState(false);
  const [truncated,    setTruncated]    = useState(false);

  const EXPORT_LIMIT = 1000;

  // Carga inicial de activos y áreas
  useEffect(() => {
    api.get<{ data: AssetOption[] } | AssetOption[]>('/assets?limit=200&status=OPERATIONAL')
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : (r.data as { data: AssetOption[] }).data ?? [];
        setAssets(list);
        const uniqueAreas = [...new Set(list.map(a => a.area).filter(Boolean))].sort();
        setAreas(uniqueAreas);
      })
      .catch(() => {});
  }, []);

  // ── Fetch de datos ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setHasLoaded(false);
    try {
      const params = {
        startDate,
        endDate,
        shift:   shift   || undefined,
        area:    area    || undefined,
        assetId: assetId || undefined,
      };

      const [sumRes, trendRes, recRes] = await Promise.all([
        oeeApi.getPlantSummary(params),
        oeeApi.getTrend({ ...params, groupBy: 'day' }),
        oeeApi.getRecords({ ...params, limit: EXPORT_LIMIT, page: 1 }),
      ]);

      setSummary(sumRes);
      setTrend(trendRes);
      setRecords(recRes.data);
      setTotal(recRes.total);
      setTruncated(recRes.total > EXPORT_LIMIT);
      setHasLoaded(true);
    } catch (e) {
      console.error('[OEEReports] Error cargando datos:', e);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, shift, area, assetId]);

  // ── Preset handler ──
  const applyPreset = (label: string) => {
    const preset = PRESETS.find(p => p.label === label);
    if (!preset) return;
    const [s, e] = preset.getRange();
    setStartDate(s);
    setEndDate(e);
    setActivePreset(label);
  };

  // ── Exportar CSV ──
  const handleCSV = async () => {
    if (!hasLoaded) await loadData();
    setExporting('csv');
    try {
      exportOEEtoCSV(records, {
        startDate, endDate, shift: shift || undefined,
        area: area || undefined,
        assetName: assets.find(a => a.id === assetId)?.name,
      });
    } finally {
      setExporting(null);
    }
  };

  // ── Exportar PDF ──
  const handlePDF = async () => {
    if (!hasLoaded) await loadData();
    if (!summary) return;
    setExporting('pdf');
    try {
      exportOEEtoPDF(summary, trend, records, {
        startDate, endDate,
        shift: shift || undefined,
        area:  area  || undefined,
        assetName: assets.find(a => a.id === assetId)?.name,
      });
    } finally {
      setExporting(null);
    }
  };

  const selectedAsset = assets.find(a => a.id === assetId);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* ── Topbar ── */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <FileText size={15} color="var(--sz-accent)" />
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)', flex: 1 }}>
          Reportes OEE
        </span>
        <button
          onClick={handleCSV}
          disabled={loading || exporting !== null}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 6,
            border: '1px solid #27ae60', background: 'transparent',
            color: '#27ae60', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            opacity: loading || exporting ? 0.6 : 1,
          }}
        >
          <FileDown size={13} />
          {exporting === 'csv' ? 'Exportando…' : 'Exportar CSV'}
        </button>
        <button
          onClick={handlePDF}
          disabled={loading || exporting !== null}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 6,
            border: 'none', background: '#2980b9',
            color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            opacity: loading || exporting ? 0.6 : 1,
          }}
        >
          <FileText size={13} />
          {exporting === 'pdf' ? 'Generando…' : 'Descargar PDF'}
        </button>
      </div>

      <div style={{ padding: '20px 24px 0' }}>

        {/* ── Panel de Filtros ── */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader
            title="Filtros del Reporte"
            icon={<Filter size={13} />}
            action={
              <button
                onClick={loadData}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 5,
                  border: 'none', background: 'var(--sz-accent)',
                  color: '#fff', fontSize: 12, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                <RefreshCw size={12} style={{ animation: loading ? 'sz-pulse 1s infinite' : 'none' }} />
                {loading ? 'Cargando…' : 'Generar reporte'}
              </button>
            }
          />
          <div style={{ padding: '16px' }}>

            {/* Presets rápidos */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--sz-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
                <Calendar size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Presets rápidos
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p.label)}
                    style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                      cursor: 'pointer',
                      background: activePreset === p.label ? 'var(--sz-accent)' : 'var(--sz-bg)',
                      color: activePreset === p.label ? '#fff' : 'var(--sz-text)',
                      border: `1px solid ${activePreset === p.label ? 'var(--sz-accent)' : 'var(--sz-border)'}`,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Controles de filtro */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              {/* Fecha inicio */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--sz-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Fecha inicio
                </label>
                <input
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={e => { setStartDate(e.target.value); setActivePreset(''); }}
                  style={{ width: '100%', fontSize: 12, border: '1px solid var(--sz-border)', borderRadius: 5, padding: '6px 8px', background: 'var(--sz-card)', color: 'var(--sz-text)', boxSizing: 'border-box' }}
                />
              </div>

              {/* Fecha fin */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--sz-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Fecha fin
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={today}
                  onChange={e => { setEndDate(e.target.value); setActivePreset(''); }}
                  style={{ width: '100%', fontSize: 12, border: '1px solid var(--sz-border)', borderRadius: 5, padding: '6px 8px', background: 'var(--sz-card)', color: 'var(--sz-text)', boxSizing: 'border-box' }}
                />
              </div>

              {/* Turno */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--sz-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Turno
                </label>
                <select
                  value={shift}
                  onChange={e => setShift(e.target.value)}
                  style={{ width: '100%', fontSize: 12, border: '1px solid var(--sz-border)', borderRadius: 5, padding: '6px 8px', background: 'var(--sz-card)', color: 'var(--sz-text)', boxSizing: 'border-box' }}
                >
                  <option value="">Todos los turnos</option>
                  <option value="MORNING">Mañana</option>
                  <option value="AFTERNOON">Tarde</option>
                  <option value="NIGHT">Noche</option>
                </select>
              </div>

              {/* Área */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--sz-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Área
                </label>
                <select
                  value={area}
                  onChange={e => { setArea(e.target.value); setAssetId(''); }}
                  style={{ width: '100%', fontSize: 12, border: '1px solid var(--sz-border)', borderRadius: 5, padding: '6px 8px', background: 'var(--sz-card)', color: 'var(--sz-text)', boxSizing: 'border-box' }}
                >
                  <option value="">Todas las áreas</option>
                  {areas.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {/* Activo */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--sz-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Activo
                </label>
                <select
                  value={assetId}
                  onChange={e => setAssetId(e.target.value)}
                  style={{ width: '100%', fontSize: 12, border: '1px solid var(--sz-border)', borderRadius: 5, padding: '6px 8px', background: 'var(--sz-card)', color: 'var(--sz-text)', boxSizing: 'border-box' }}
                >
                  <option value="">Todos los activos</option>
                  {assets
                    .filter(a => !area || a.area === area)
                    .map(a => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))
                  }
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Resumen del reporte ── */}
        {hasLoaded && summary && (
          <>
            {/* Alerta de truncamiento */}
            {truncated && (
              <div style={{
                marginBottom: 16, background: '#fff3ec', border: '1px solid #e67e22',
                borderRadius: 'var(--sz-radius)', padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <AlertTriangle size={14} color="#e67e22" />
                <span style={{ fontSize: 12, color: '#e67e22', fontWeight: 600 }}>
                  Se encontraron {total.toLocaleString()} registros. El reporte muestra los primeros {EXPORT_LIMIT.toLocaleString()}.
                  Para rangos mayores considera filtrar por activo o área.
                </span>
              </div>
            )}

            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Disponibilidad', value: summary.availability, bench: 90 },
                { label: 'Rendimiento',    value: summary.performance,  bench: 95 },
                { label: 'Calidad',        value: summary.quality,      bench: 99 },
                { label: 'OEE Global',     value: summary.oee,          bench: 85 },
              ].map(k => {
                const c = oeeColor(k.value);
                return (
                  <Card key={k.label} topAccent={c}>
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 11, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginBottom: 6 }}>
                        {k.label}
                      </div>
                      <div style={{ fontSize: 34, fontWeight: 900, color: c, lineHeight: 1, marginBottom: 4 }}>
                        {k.value !== null ? `${k.value.toFixed(1)}%` : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--sz-muted)', marginBottom: 8 }}>
                        Meta ≥ {k.bench}%&nbsp;
                        {k.value !== null && (
                          <span style={{ color: k.value >= k.bench ? '#27ae60' : '#c0392b', fontWeight: 700 }}>
                            {k.value >= k.bench ? '+' : ''}{(k.value - k.bench).toFixed(1)} pp
                          </span>
                        )}
                      </div>
                      {k.value !== null && <ProgressBar value={k.value} color={c} height={4} />}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Pie totales + parámetros */}
            <Card style={{ marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2 }}>Período</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sz-text)' }}>
                    {startDate} → {endDate}
                  </div>
                </div>
                {selectedAsset && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2 }}>Activo</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sz-text)' }}>
                      {selectedAsset.code} — {selectedAsset.name}
                    </div>
                  </div>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 24 }}>
                  {[
                    { label: 'Registros', value: summary.recordCount },
                    { label: 'Horas planif.', value: `${summary.totalPlannedHours ?? 0}h` },
                    { label: 'Piezas buenas', value: (summary.totalGood ?? 0).toLocaleString() },
                    { label: 'Defectos', value: (summary.totalDefects ?? 0).toLocaleString() },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--sz-text)' }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.3px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Preview tabla */}
            <Card>
              <CardHeader
                title={`Vista previa — ${records.length} de ${total.toLocaleString()} registros`}
                subtitle="Primeras 20 filas"
              />
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      {['Fecha', 'Activo', 'Área', 'Turno', 'T.Plan.', 'Buenas', 'Defectos', 'D.%', 'R.%', 'C.%', 'OEE%'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--sz-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 20).map((r, i) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--sz-border)', background: i % 2 === 0 ? 'var(--sz-card)' : '#fafafa' }}>
                        <td style={{ padding: '7px 10px', color: 'var(--sz-text)', whiteSpace: 'nowrap' }}>
                          {new Date(r.date).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </td>
                        <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--sz-accent)', whiteSpace: 'nowrap', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>
                          {r.asset?.code ?? '—'}
                        </td>
                        <td style={{ padding: '7px 10px', color: 'var(--sz-muted)' }}>{r.asset?.area ?? '—'}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--sz-muted)' }}>
                          {{ MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }[r.shift] ?? r.shift}
                        </td>
                        <td style={{ padding: '7px 10px', color: 'var(--sz-muted)' }}>{r.plannedTime}m</td>
                        <td style={{ padding: '7px 10px', color: 'var(--sz-text)' }}>{r.goodCount}</td>
                        <td style={{ padding: '7px 10px', color: r.totalCount - r.goodCount > 0 ? '#c0392b' : 'var(--sz-muted)' }}>
                          {r.totalCount - r.goodCount}
                        </td>
                        <td style={{ padding: '7px 10px', color: oeeColor(r.availability), fontWeight: 600 }}>
                          {r.availability !== null ? `${r.availability.toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ padding: '7px 10px', color: oeeColor(r.performance), fontWeight: 600 }}>
                          {r.performance !== null ? `${r.performance.toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ padding: '7px 10px', color: oeeColor(r.quality), fontWeight: 600 }}>
                          {r.quality !== null ? `${r.quality.toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ padding: '7px 10px', fontWeight: 800, color: oeeColor(r.oee) }}>
                          {r.oee !== null ? `${r.oee.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {records.length > 20 && (
                  <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--sz-muted)', textAlign: 'center', borderTop: '1px solid var(--sz-border)' }}>
                    …{(records.length - 20).toLocaleString()} filas adicionales incluidas en la exportación
                  </div>
                )}
              </div>
            </Card>
          </>
        )}

        {/* ── Estado inicial: instrucción ── */}
        {!hasLoaded && !loading && (
          <Card>
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <FileText size={40} color="var(--sz-border)" style={{ margin: '0 auto 14px', display: 'block' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sz-muted)', marginBottom: 6 }}>
                Configura los filtros y presiona "Generar reporte"
              </div>
              <div style={{ fontSize: 12, color: 'var(--sz-muted)' }}>
                Podrás exportar los datos filtrados a CSV o PDF desde el botón en la barra superior.
              </div>
            </div>
          </Card>
        )}

        {/* ── Loading state ── */}
        {loading && (
          <Card>
            <div style={{ padding: '48px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              <RefreshCw size={24} color="var(--sz-accent)" style={{ animation: 'sz-pulse 1s ease-in-out infinite' }} />
              <div style={{ fontSize: 13, color: 'var(--sz-muted)' }}>Cargando registros OEE…</div>
              <div style={{ width: 200 }}>
                <div className="sz-skeleton" style={{ height: 6, borderRadius: 3 }} />
              </div>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}
