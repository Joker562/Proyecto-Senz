import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, FileText, Fuel, CheckCircle, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface FleetAlert {
  id:          string;
  type:        'DOC' | 'MAINT' | 'FUEL';
  severity:    'CRITICAL' | 'WARNING' | 'INFO';
  vehicleId:   string;
  vehicleCode: string;
  vehiclePlate:string;
  title:       string;
  message:     string;
  triggeredAt: string | null;
  field?:      string;
  planId?:     string;
  planName?:   string;
}

interface AlertsResponse {
  total:    number;
  critical: number;
  warning:  number;
  alerts:   FleetAlert[];
}

// ── Constantes ───────────────────────────────────────────────────────────────

const SEVERITY_MAP = {
  CRITICAL: { label: 'Crítico', color: '#c0392b', bg: '#fdecea', border: '#f1948a' },
  WARNING:  { label: 'Advertencia', color: '#e67e22', bg: '#fef3e7', border: '#f0b27a' },
  INFO:     { label: 'Info',     color: '#2980b9', bg: '#e8f2fb', border: '#7fb3d3' },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  DOC:   <FileText size={16} />,
  MAINT: <AlertTriangle size={16} />,
  FUEL:  <Fuel size={16} />,
};

const TYPE_LABELS: Record<string, string> = {
  DOC: 'Documento', MAINT: 'Mantenimiento', FUEL: 'Combustible',
};

// ── Componente ───────────────────────────────────────────────────────────────

export default function FleetAlertsPage() {
  const toast                      = useToast();
  const { user }                   = useAuth();
  const isAdmin                    = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  const [data, setData]             = useState<AlertsResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [acking, setAcking]         = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [sevFilter, setSevFilter]   = useState<string>('ALL');

  const load = useCallback(() => {
    setLoading(true);
    api.get<AlertsResponse>('/fleet/alerts')
      .then(r => setData(r.data))
      .catch(() => toast.push('Error al cargar alertas', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  async function acknowledge(alertId: string) {
    setAcking(alertId);
    try {
      await api.patch(`/fleet/alerts/${encodeURIComponent(alertId)}/acknowledge`);
      toast.push('Alerta reconocida', 'success');
      load();
    } catch {
      toast.push('Error al reconocer la alerta', 'error');
    } finally {
      setAcking(null);
    }
  }

  const alerts = data?.alerts ?? [];
  const filtered = alerts.filter(a => {
    if (typeFilter !== 'ALL' && a.type !== typeFilter) return false;
    if (sevFilter  !== 'ALL' && a.severity !== sevFilter)   return false;
    return true;
  });

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* Topbar */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>Alertas de Flota</span>
        <button onClick={load} title="Recargar" style={{ background: 'var(--sz-card)', border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)', cursor: 'pointer', padding: '6px 10px', color: 'var(--sz-muted)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
          <span style={{ color: 'var(--sz-muted)', fontSize: 13 }}>Cargando alertas...</span>
        </div>
      ) : (
        <div style={{ padding: '16px 24px' }}>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Total',      value: data?.total    ?? 0, color: '#2980b9' },
              { label: 'Críticas',   value: data?.critical ?? 0, color: '#c0392b' },
              { label: 'Advertencias', value: data?.warning ?? 0, color: '#e67e22' },
            ].map(({ label, value, color }) => (
              <Card key={label} topAccent={color}>
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'IBM Plex Mono, monospace', marginTop: 4 }}>{value}</div>
                </div>
              </Card>
            ))}
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {[{ key: 'ALL', label: 'Todos los tipos' }, { key: 'DOC', label: 'Documentos' }, { key: 'MAINT', label: 'Mantenimiento' }, { key: 'FUEL', label: 'Combustible' }].map(f => (
              <button key={f.key} onClick={() => setTypeFilter(f.key)} style={{
                padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
                border: `1px solid ${typeFilter === f.key ? 'var(--sz-accent)' : 'var(--sz-border)'}`,
                background: typeFilter === f.key ? 'var(--sz-accent)' : 'var(--sz-card)',
                color: typeFilter === f.key ? '#fff' : 'var(--sz-muted)', transition: 'all .15s',
              }}>{f.label}</button>
            ))}
            <div style={{ width: 1, background: 'var(--sz-border)', margin: '0 4px' }} />
            {[{ key: 'ALL', label: 'Toda severidad' }, { key: 'CRITICAL', label: 'Crítico' }, { key: 'WARNING', label: 'Advertencia' }].map(f => (
              <button key={f.key} onClick={() => setSevFilter(f.key)} style={{
                padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
                border: `1px solid ${sevFilter === f.key ? 'var(--sz-accent)' : 'var(--sz-border)'}`,
                background: sevFilter === f.key ? 'var(--sz-accent)' : 'var(--sz-card)',
                color: sevFilter === f.key ? '#fff' : 'var(--sz-muted)', transition: 'all .15s',
              }}>{f.label}</button>
            ))}
          </div>

          {/* Alertas */}
          {filtered.length === 0 ? (
            <Card>
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <CheckCircle size={40} style={{ color: '#27ae60', margin: '0 auto 12px' }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)', marginBottom: 4 }}>Sin alertas activas</div>
                <div style={{ fontSize: 13, color: 'var(--sz-muted)' }}>La flota está en orden para los filtros seleccionados.</div>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(alert => {
                const sev = SEVERITY_MAP[alert.severity];
                return (
                  <div key={alert.id} style={{
                    background: sev.bg, border: `1px solid ${sev.border}`,
                    borderLeft: `4px solid ${sev.color}`,
                    borderRadius: 8, padding: '12px 16px',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                  }}>
                    <div style={{ color: sev.color, flexShrink: 0, marginTop: 1 }}>{TYPE_ICONS[alert.type]}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: sev.color }}>{alert.title}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: sev.color, color: '#fff', textTransform: 'uppercase', letterSpacing: '.4px' }}>{sev.label}</span>
                        <span style={{ fontSize: 10, color: 'var(--sz-muted)', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--sz-border)', background: 'rgba(255,255,255,.7)' }}>{TYPE_LABELS[alert.type]}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#444', marginBottom: 4, lineHeight: 1.5 }}>{alert.message}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--sz-muted)' }}>{alert.vehicleCode} — {alert.vehiclePlate}</span>
                        {alert.triggeredAt && (
                          <span style={{ fontSize: 11, color: 'var(--sz-muted)' }}>{new Date(alert.triggeredAt).toLocaleDateString('es-MX')}</span>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => acknowledge(alert.id)}
                        disabled={acking === alert.id}
                        title="Marcar como vista"
                        style={{
                          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                          padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          background: 'rgba(255,255,255,.8)', border: `1px solid ${sev.border}`,
                          borderRadius: 6, color: sev.color, whiteSpace: 'nowrap',
                          opacity: acking === alert.id ? .6 : 1,
                          fontFamily: 'IBM Plex Sans, sans-serif',
                        }}
                      >
                        <CheckCircle size={12} />
                        {acking === alert.id ? 'Procesando...' : 'Reconocer'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
