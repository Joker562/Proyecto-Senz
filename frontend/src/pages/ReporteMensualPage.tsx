import { Card, CardHeader } from '@/components/ui/Card';
import { LineChartSVG } from '@/components/ui/LineChartSVG';
import { SparkLine } from '@/components/ui/SparkLine';
import { mockMonthlyCompliance, COMPLIANCE_MONTHS, mockAuditTrend } from '@/data/mockData';

const AUDIT_SERIES = [
  { key: 'Corte',    color: '#e67e22' },
  { key: 'Ensamble', color: '#2980b9' },
  { key: 'Pintura',  color: '#27ae60' },
  { key: 'Almacén',  color: '#8b5cf6' },
  { key: 'Calidad',  color: '#c0392b' },
];

function scoreColor(v: number): { color: string; bg: string } {
  if (v >= 90) return { color: '#27ae60', bg: '#e9f7ef' };
  if (v >= 70) return { color: '#e67e22', bg: '#fef3e7' };
  return { color: '#c0392b', bg: '#fde8e6' };
}

export default function ReporteMensualPage() {
  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* Topbar */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center',
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>Cumplimiento Mensual</span>
      </div>

      <div style={{ padding: '16px 24px' }}>

        {/* Compliance table */}
        <Card style={{ marginBottom: 16 }}>
          <CardHeader title="Puntajes de Cumplimiento por Área" subtitle="Últimos 6 meses" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap' }}>
                    Área
                  </th>
                  {COMPLIANCE_MONTHS.map((m) => (
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
                {mockMonthlyCompliance.map((row, i) => {
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
        </Card>

        {/* Trend chart */}
        <Card>
          <CardHeader title="Tendencia de Cumplimiento" subtitle="Evolución histórica por área" />
          <div style={{ padding: '16px 16px 8px' }}>
            <LineChartSVG
              data={mockAuditTrend}
              xKey="month"
              series={AUDIT_SERIES}
              height={180}
              yMin={40}
              yMax={110}
            />
            <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              {AUDIT_SERIES.map((s) => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--sz-muted)' }}>
                  <div style={{ width: 14, height: 2, background: s.color, borderRadius: 1 }} />
                  {s.key}
                </div>
              ))}
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}
