import { Card, CardHeader } from '@/components/ui/Card';
import { DonutChart } from '@/components/ui/DonutChart';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SparkLine } from '@/components/ui/SparkLine';
import { LineChartSVG } from '@/components/ui/LineChartSVG';
import { mockOeeAssets, mockOeeTrend, mockDowntimeEvents } from '@/data/mockData';

const OEE_SERIES = [
  { key: 'oee',          color: '#e67e22', label: 'OEE' },
  { key: 'availability', color: '#2980b9', label: 'Disponibilidad' },
  { key: 'performance',  color: '#27ae60', label: 'Rendimiento' },
  { key: 'quality',      color: '#8b5cf6', label: 'Calidad' },
];

const avgOee = Math.round(mockOeeAssets.reduce((s, a) => s + a.oee, 0) / mockOeeAssets.length);
const avgAvail = Math.round(mockOeeAssets.reduce((s, a) => s + a.availability, 0) / mockOeeAssets.length);
const avgPerf = Math.round(mockOeeAssets.reduce((s, a) => s + a.performance, 0) / mockOeeAssets.length);
const avgQual = Math.round(mockOeeAssets.reduce((s, a) => s + a.quality, 0) / mockOeeAssets.length);

const maxDuration = Math.max(...mockDowntimeEvents.map((e) => e.duration));

function oeeColor(v: number) {
  if (v >= 85) return '#27ae60';
  if (v >= 65) return '#e67e22';
  return '#c0392b';
}

export default function OEEDashboardPage() {
  const kpis = [
    { label: 'OEE Promedio',    value: avgOee,  suffix: '%', color: oeeColor(avgOee),  spark: mockOeeTrend.map((r) => r.oee) },
    { label: 'Disponibilidad',  value: avgAvail, suffix: '%', color: '#2980b9',         spark: mockOeeTrend.map((r) => r.availability) },
    { label: 'Rendimiento',     value: avgPerf,  suffix: '%', color: '#27ae60',         spark: mockOeeTrend.map((r) => r.performance) },
    { label: 'Calidad',         value: avgQual,  suffix: '%', color: '#8b5cf6',         spark: mockOeeTrend.map((r) => r.quality) },
  ];

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* Topbar */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center',
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>Dashboard OEE</span>
      </div>

      <div style={{ padding: '16px 24px' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {kpis.map((k) => (
            <Card key={k.label} topAccent={k.color}>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}{k.suffix}</div>
                </div>
                <SparkLine data={k.spark} color={k.color} width={70} height={28} />
              </div>
            </Card>
          ))}
        </div>

        {/* Chart + asset cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, marginBottom: 16 }}>

          {/* OEE Trend */}
          <Card>
            <CardHeader title="Tendencia OEE" subtitle="Últimas 8 semanas" />
            <div style={{ padding: '16px 16px 8px' }}>
              <LineChartSVG
                data={mockOeeTrend}
                xKey="week"
                series={OEE_SERIES}
                height={180}
                yMin={60}
                yMax={105}
              />
              <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                {OEE_SERIES.map((s) => (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--sz-muted)' }}>
                    <div style={{ width: 14, height: 2, background: s.color, borderRadius: 1 }} />
                    {s.label}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Asset OEE cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
            {mockOeeAssets.map((a) => (
              <Card key={a.name}>
                <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <DonutChart value={a.oee} size={56} strokeWidth={7} color={oeeColor(a.oee)} label={`${a.oee}%`} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--sz-text)', marginBottom: 6 }}>{a.name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <ProgressBar value={a.availability} color="#2980b9" height={5} label={`D ${a.availability}%`} showLabel />
                      <ProgressBar value={a.performance}  color="#27ae60" height={5} label={`R ${a.performance}%`}  showLabel />
                      <ProgressBar value={a.quality}      color="#8b5cf6" height={5} label={`C ${a.quality}%`}      showLabel />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Downtime events */}
        <Card>
          <CardHeader title="Eventos de Paro Recientes" subtitle="Últimos 7 días" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['Equipo', 'Tipo', 'Causa', 'Fecha', 'Duración'].map((h) => (
                    <th key={h} style={{
                      padding: '8px 14px', textAlign: 'left', fontWeight: 600,
                      color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase',
                      letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockDowntimeEvents.map((e, i) => (
                  <tr key={e.id} className="sz-table-row"
                    style={{ borderBottom: '1px solid var(--sz-border)', background: i % 2 === 0 ? 'var(--sz-card)' : '#fafafa' }}>
                    <td style={{ padding: '9px 14px', fontWeight: 600, color: 'var(--sz-text)', whiteSpace: 'nowrap' }}>{e.asset}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{e.type}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--sz-text)' }}>{e.cause}</td>
                    <td style={{ padding: '9px 14px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{e.date}</td>
                    <td style={{ padding: '9px 14px', minWidth: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.round((e.duration / maxDuration) * 100)}%`,
                            height: '100%',
                            background: e.duration >= 90 ? '#c0392b' : e.duration >= 60 ? '#e67e22' : '#2980b9',
                            borderRadius: 2,
                          }} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--sz-text)', whiteSpace: 'nowrap' }}>{e.duration} min</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

      </div>
    </div>
  );
}
