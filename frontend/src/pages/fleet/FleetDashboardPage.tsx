import { useState, useEffect } from 'react';
import { Car, Fuel, AlertTriangle, TrendingUp, Droplets } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { api } from '@/services/api';

interface DashboardData {
  vehicles: { total: number; byStatus: Record<string, number> };
  expiringDocuments: {
    count: number;
    items: Array<{ id: string; code: string; plate: string; brand: string; model: string }>;
  };
  fuel: { avgKmPerLiter: number | null; totalLitersLogged: number };
  currentMonth: { totalKm: number; period: { from: string; to: string } };
}

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  AVAILABLE:      { label: 'Disponible',        color: '#27ae60' },
  IN_USE:         { label: 'En uso',             color: '#2980b9' },
  MAINTENANCE:    { label: 'Mantenimiento',      color: '#e67e22' },
  OUT_OF_SERVICE: { label: 'Fuera de servicio',  color: '#c0392b' },
};

export default function FleetDashboardPage() {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardData>('/fleet/dashboard')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusMap = data?.vehicles.byStatus ?? {};
  const total     = data?.vehicles.total ?? 0;

  const kpis = [
    { label: 'Total Flota',      value: total,                               color: '#2980b9', Icon: Car         },
    { label: 'Disponibles',      value: statusMap.AVAILABLE ?? 0,            color: '#27ae60', Icon: Car         },
    { label: 'En Uso',           value: statusMap.IN_USE ?? 0,               color: '#8b5cf6', Icon: TrendingUp  },
    { label: 'Docs. por Vencer', value: data?.expiringDocuments.count ?? 0,  color: '#e67e22', Icon: AlertTriangle },
  ];

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>
      {/* Topbar */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center',
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>Dashboard de Flota</span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
          <span style={{ color: 'var(--sz-muted)', fontSize: 13 }}>Cargando...</span>
        </div>
      ) : (
        <div style={{ padding: '16px 24px' }}>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
            {kpis.map(({ label, value, color, Icon }) => (
              <Card key={label} topAccent={color}>
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gap: 16 }}>

            {/* Estado de flota */}
            <Card>
              <CardHeader title="Estado de la Flota" />
              <div style={{ padding: 16 }}>
                {Object.entries(STATUS_INFO).map(([status, { label, color }]) => {
                  const count = statusMap[status] ?? 0;
                  const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={status} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sz-text)' }}>{label}</span>
                        <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Métricas del mes */}
            <Card>
              <CardHeader title="Métricas del Mes" />
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Km recorridos', value: `${(data?.currentMonth.totalKm ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })} km`, color: '#2980b9', Icon: TrendingUp },
                  { label: 'Eficiencia promedio', value: data?.fuel.avgKmPerLiter != null ? `${data.fuel.avgKmPerLiter} km/L` : 'Sin datos', color: '#27ae60', Icon: Fuel },
                  { label: 'Litros registrados', value: `${(data?.fuel.totalLitersLogged ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })} L`, color: '#8b5cf6', Icon: Droplets },
                  { label: 'En mantenimiento', value: statusMap.MAINTENANCE ?? 0, color: '#e67e22', Icon: Car },
                ].map(({ label, value, color, Icon }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--sz-bg)', borderRadius: 8, border: '1px solid var(--sz-border)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} style={{ color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--sz-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: 'IBM Plex Mono, monospace' }}>{value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Documentos por vencer */}
            <Card>
              <CardHeader title="Docs. por Vencer" subtitle="Próximos 30 días" />
              <div style={{ padding: '4px 0' }}>
                {(data?.expiringDocuments.items ?? []).length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 12 }}>
                    ✓ Sin documentos por vencer
                  </div>
                ) : (
                  data?.expiringDocuments.items.map(v => (
                    <div key={v.id} style={{ padding: '9px 16px', borderBottom: '1px solid var(--sz-border)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sz-text)', fontFamily: 'IBM Plex Mono, monospace' }}>{v.plate}</div>
                      <div style={{ fontSize: 11, color: 'var(--sz-muted)', marginTop: 1 }}>{v.code} — {v.brand} {v.model}</div>
                    </div>
                  ))
                )}
              </div>
            </Card>

          </div>
        </div>
      )}
    </div>
  );
}
