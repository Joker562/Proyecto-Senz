import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SparkLine } from '@/components/ui/SparkLine';
import { mockVehicles, STATUS_MAP } from '@/data/mockData';

function kmProgress(km: number, next: number) {
  const remaining = next - km;
  const pct = Math.min(100, Math.round((km / next) * 100));
  const color = remaining <= 2000 ? '#c0392b' : remaining <= 5000 ? '#e67e22' : '#27ae60';
  return { pct, remaining, color };
}

const active    = mockVehicles.filter((v) => v.status === 'ACTIVE').length;
const inService = mockVehicles.filter((v) => v.status === 'IN_SERVICE').length;
const nearService = mockVehicles.filter((v) => (v.nextService - v.km) <= 5000).length;

const kpis = [
  { label: 'Total Flota',    value: mockVehicles.length, color: '#2980b9', spark: [4, 4, 5, 5, 5, 5] },
  { label: 'Activos',        value: active,              color: '#27ae60', spark: [3, 3, 4, 3, 4, active] },
  { label: 'En Servicio',    value: inService,           color: '#8b5cf6', spark: [0, 1, 0, 1, 1, inService] },
  { label: 'Próx. Servicio', value: nearService,         color: '#e67e22', spark: [0, 1, 1, 2, 1, nearService] },
];

export default function FleetDashboardPage() {
  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* Topbar */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center',
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>Dashboard de Flota</span>
      </div>

      <div style={{ padding: '16px 24px' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {kpis.map((k) => (
            <Card key={k.label} topAccent={k.color}>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
                </div>
                <SparkLine data={k.spark} color={k.color} width={70} height={28} />
              </div>
            </Card>
          ))}
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>

          {/* Vehicles table */}
          <Card>
            <CardHeader title="Vehículos" subtitle="Estado actual de la flota" />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    {['Placa', 'Nombre', 'Tipo', 'Combustible', 'Área', 'Km Actual', 'Próx. Servicio', 'Estado'].map((h) => (
                      <th key={h} style={{
                        padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                        color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase',
                        letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mockVehicles.map((v, i) => {
                    const sm = STATUS_MAP[v.status];
                    const remaining = v.nextService - v.km;
                    const soon = remaining <= 5000;
                    return (
                      <tr key={v.plate} className="sz-table-row"
                        style={{ borderBottom: '1px solid var(--sz-border)', cursor: 'pointer', background: i % 2 === 0 ? 'var(--sz-card)' : '#fafafa' }}>
                        <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-accent)', fontWeight: 700 }}>{v.plate}</td>
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--sz-text)', whiteSpace: 'nowrap' }}>{v.name}</td>
                        <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{v.type}</td>
                        <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{v.fuel}</td>
                        <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{v.area}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-text)', whiteSpace: 'nowrap' }}>
                          {v.km.toLocaleString('es')} km
                        </td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-muted)' }}>
                              {v.nextService.toLocaleString('es')} km
                            </span>
                            {soon && (
                              <span style={{ fontSize: 10, fontWeight: 700, background: '#fef3e7', color: '#e67e22', padding: '1px 6px', borderRadius: 10 }}>
                                Pronto
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                          <Badge label={sm.label} color={sm.color} bg={sm.bg} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Km progress */}
          <Card>
            <CardHeader title="Progreso al Próximo Servicio" />
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {mockVehicles.map((v) => {
                const { pct, remaining, color } = kmProgress(v.km, v.nextService);
                return (
                  <div key={v.plate}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--sz-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{v.name}</span>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {remaining.toLocaleString('es')} km
                      </span>
                    </div>
                    <div style={{ height: 8, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width .4s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
