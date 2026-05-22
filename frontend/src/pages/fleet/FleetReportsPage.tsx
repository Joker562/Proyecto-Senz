import { useState, useEffect } from 'react';
import { Download, Award, DollarSign } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface EfficiencyRow {
  vehicleId:      string;
  vehicleCode:    string;
  vehiclePlate:   string;
  vehicleBrand:   string;
  vehicleModel:   string;
  vehicleType:    string;
  area:           string | null;
  avgKmPerLiter:  number | null;
  totalLiters:    number;
  totalCost:      number;
  totalKm:        number;
  fuelLogs:       number;
  tripLogs:       number;
  bestEfficiency: boolean;
  highestSpender: boolean;
}

interface EfficiencyResponse {
  period:   string;
  vehicles: EfficiencyRow[];
}

// ── Constantes ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  TRUCK: 'Camión', VAN: 'Camioneta', CAR: 'Auto', FORKLIFT: 'Montacargas', OTHER: 'Otro',
};

// ── Componente ───────────────────────────────────────────────────────────────

export default function FleetReportsPage() {
  const toast = useToast();
  const [data, setData]           = useState<EfficiencyResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);
  const [sortBy, setSortBy]       = useState<'efficiency' | 'cost' | 'km'>('efficiency');

  useEffect(() => {
    api.get<EfficiencyResponse>('/fleet/reports/efficiency')
      .then(r => setData(r.data))
      .catch(() => toast.push('Error al cargar reportes', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  async function exportFile(type: 'csv' | 'json') {
    setExporting(type);
    try {
      const res = await api.get(`/fleet/reports/export/${type}`, { responseType: 'blob' });
      const url  = URL.createObjectURL(res.data as Blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `flota-reporte.${type}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.push(`Reporte ${type.toUpperCase()} descargado`, 'success');
    } catch {
      toast.push('Error al exportar', 'error');
    } finally {
      setExporting(null);
    }
  }

  const rows = [...(data?.vehicles ?? [])].sort((a, b) => {
    if (sortBy === 'efficiency') return (b.avgKmPerLiter ?? -1) - (a.avgKmPerLiter ?? -1);
    if (sortBy === 'cost')       return b.totalCost - a.totalCost;
    return b.totalKm - a.totalKm;
  });

  const best    = rows.find(r => r.bestEfficiency);
  const spender = rows.find(r => r.highestSpender);

  const totalKm   = rows.reduce((s, r) => s + r.totalKm, 0);
  const totalCost = rows.reduce((s, r) => s + r.totalCost, 0);
  const totalL    = rows.reduce((s, r) => s + r.totalLiters, 0);

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* Topbar */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>Reportes de Flota</span>
          {data?.period && <span style={{ fontSize: 11, color: 'var(--sz-muted)', marginLeft: 10 }}>{data.period}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => exportFile('csv')} disabled={exporting !== null} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)',
            background: 'var(--sz-card)', color: '#27ae60',
            fontFamily: 'IBM Plex Sans, sans-serif', opacity: exporting ? .6 : 1,
          }}>
            <Download size={13} /> {exporting === 'csv' ? 'Exportando...' : 'CSV'}
          </button>
          <button onClick={() => exportFile('json')} disabled={exporting !== null} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)',
            background: 'var(--sz-card)', color: '#2980b9',
            fontFamily: 'IBM Plex Sans, sans-serif', opacity: exporting ? .6 : 1,
          }}>
            <Download size={13} /> {exporting === 'json' ? 'Exportando...' : 'JSON'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
          <span style={{ color: 'var(--sz-muted)', fontSize: 13 }}>Calculando reportes...</span>
        </div>
      ) : (
        <div style={{ padding: '16px 24px' }}>

          {/* KPIs globales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Vehículos',      value: rows.length,                                                           color: '#2980b9' },
              { label: 'Km totales',     value: `${totalKm.toLocaleString('es-MX', { maximumFractionDigits: 0 })} km`, color: '#27ae60' },
              { label: 'Litros totales', value: `${totalL.toLocaleString('es-MX', { maximumFractionDigits: 0 })} L`,   color: '#8b5cf6' },
              { label: 'Costo total',    value: `$${totalCost.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`, color: '#e67e22' },
            ].map(({ label, value, color }) => (
              <Card key={label} topAccent={color}>
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'IBM Plex Mono, monospace' }}>{value}</div>
                </div>
              </Card>
            ))}
          </div>

          {/* Destacados */}
          {(best || spender) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {best && (
                <div style={{ background: '#e8f8f0', border: '1px solid #a9dfbf', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#27ae6020', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Award size={18} style={{ color: '#27ae60' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#27ae60', textTransform: 'uppercase', letterSpacing: '.4px' }}>Mejor Eficiencia</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a5276' }}>{best.vehicleCode} — {best.vehiclePlate}</div>
                    <div style={{ fontSize: 13, color: '#27ae60', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700 }}>{best.avgKmPerLiter?.toFixed(2)} km/L</div>
                  </div>
                </div>
              )}
              {spender && (
                <div style={{ background: '#fef3e7', border: '1px solid #f0b27a', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e67e2220', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <DollarSign size={18} style={{ color: '#e67e22' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#e67e22', textTransform: 'uppercase', letterSpacing: '.4px' }}>Mayor Gasto</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#784212' }}>{spender.vehicleCode} — {spender.vehiclePlate}</div>
                    <div style={{ fontSize: 13, color: '#e67e22', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700 }}>${spender.totalCost.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tabla */}
          <Card>
            <CardHeader
              title="Ranking de Eficiencia"
              subtitle="Por consumo de combustible y kilómetros recorridos"
              action={
                <div style={{ display: 'flex', gap: 4 }}>
                  {[{ key: 'efficiency', label: 'Eficiencia' }, { key: 'cost', label: 'Costo' }, { key: 'km', label: 'Km' }].map(s => (
                    <button key={s.key} onClick={() => setSortBy(s.key as typeof sortBy)} style={{
                      padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      borderRadius: 6, border: `1px solid ${sortBy === s.key ? 'var(--sz-accent)' : 'var(--sz-border)'}`,
                      background: sortBy === s.key ? 'var(--sz-accent)' : 'var(--sz-card)',
                      color: sortBy === s.key ? '#fff' : 'var(--sz-muted)',
                    }}>{s.label}</button>
                  ))}
                </div>
              }
            />
            {rows.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>Sin datos de eficiencia. Registra cargas de combustible para ver el ranking.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--sz-bg)' }}>
                      {['#', 'Vehículo', 'Tipo', 'Área', 'Km/L Prom.', 'Litros', 'Costo Total', 'Km Recorridos', 'Cargas', 'Viajes', ''].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.vehicleId} style={{ borderBottom: '1px solid var(--sz-border)', background: i % 2 === 0 ? 'var(--sz-card)' : 'var(--sz-bg)' }}>
                        <td style={{ padding: '9px 12px', fontWeight: 800, color: i === 0 ? '#e67e22' : 'var(--sz-muted)', fontFamily: 'IBM Plex Mono, monospace' }}>#{i + 1}</td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700, color: 'var(--sz-accent)' }}>{r.vehiclePlate}</div>
                          <div style={{ fontSize: 11, color: 'var(--sz-muted)' }}>{r.vehicleBrand} {r.vehicleModel}</div>
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{TYPE_LABELS[r.vehicleType] ?? r.vehicleType}</td>
                        <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{r.area ?? '—'}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: r.avgKmPerLiter != null ? '#27ae60' : 'var(--sz-muted)' }}>
                          {r.avgKmPerLiter != null ? `${r.avgKmPerLiter.toFixed(2)} km/L` : 'N/D'}
                        </td>
                        <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, whiteSpace: 'nowrap' }}>{r.totalLiters.toLocaleString('es-MX', { maximumFractionDigits: 1 })} L</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, whiteSpace: 'nowrap', color: '#e67e22', fontWeight: 700 }}>${r.totalCost.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, whiteSpace: 'nowrap' }}>{r.totalKm.toLocaleString('es-MX', { maximumFractionDigits: 0 })} km</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, textAlign: 'center' }}>{r.fuelLogs}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, textAlign: 'center' }}>{r.tripLogs}</td>
                        <td style={{ padding: '9px 12px' }}>
                          {r.bestEfficiency && <Badge label="★ Mejor" color="#27ae60" bg="#e8f8f0" />}
                          {r.highestSpender && <Badge label="$ Mayor" color="#e67e22" bg="#fef3e7" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
