import { Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { mockAssets, STATUS_MAP } from '@/data/mockData';

export default function AssetsPage() {
  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* Topbar */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>Equipos</span>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--sz-accent)', color: '#fff',
          border: 'none', borderRadius: 'var(--sz-radius)',
          padding: '7px 14px', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
        }}>
          <Plus size={14} />
          Nuevo Equipo
        </button>
      </div>

      <div style={{ padding: '16px 24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 14,
        }}>
          {mockAssets.map((a) => {
            const sm = STATUS_MAP[a.status];
            const topColor = a.status === 'OPERATIONAL' ? '#27ae60'
              : a.status === 'UNDER_MAINTENANCE' ? '#8b5cf6' : '#c0392b';
            return (
              <Card key={a.code} topAccent={topColor}>
                {/* Card header */}
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--sz-border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--sz-text)', lineHeight: 1.3, marginBottom: 2 }}>{a.name}</div>
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'var(--sz-muted)' }}>{a.code}</div>
                  </div>
                  <Badge label={sm.label} color={sm.color} bg={sm.bg} />
                </div>

                {/* 2x2 grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                  {[
                    { label: 'Área',         value: a.area },
                    { label: 'Ubicación',    value: a.location },
                    { label: 'Fabricante',   value: a.manufacturer },
                    { label: 'Modelo',       value: a.model },
                  ].map((f, i) => (
                    <div key={i} style={{ padding: '10px 14px', borderRight: i % 2 === 0 ? '1px solid var(--sz-border)' : 'none', borderBottom: i < 2 ? '1px solid var(--sz-border)' : 'none' }}>
                      <div style={{ fontSize: 10, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginBottom: 2 }}>{f.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--sz-text)', fontWeight: 500 }}>{f.value}</div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{ padding: '8px 14px', borderTop: '1px solid var(--sz-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--sz-muted)' }}>Último mantenimiento</span>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-text)', fontWeight: 600 }}>{a.lastMaint}</span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
