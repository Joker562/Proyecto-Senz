import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Wrench, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface UpcomingItem {
  planId:       string;
  planName:     string;
  serviceType:  string | null;
  vehicleId:    string;
  vehicleCode:  string;
  vehiclePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  currentKm:    number;
  urgency:      'OVERDUE' | 'CRITICAL' | 'WARNING';
  nextDue:      string | null;
  daysUntilDue: number | null;
  kmThreshold:  number | null;
  kmRemaining:  number | null;
  hasOpenOT:    boolean;
}

interface VehicleOption { id: string; code: string; plate: string; brand: string; model: string; currentKm: number }

const SERVICE_TYPE_LABELS: Record<string, string> = {
  OIL_CHANGE: 'Cambio de Aceite', TUNE_UP: 'Afinación', TIRES: 'Llantas',
  BRAKES: 'Frenos', VERIFICATION: 'Verificación', GENERAL_SERVICE: 'Servicio General', OTHER: 'Otro',
};

const URGENCY_MAP = {
  OVERDUE:  { label: 'Vencido',   color: '#c0392b', bg: '#fdecea' },
  CRITICAL: { label: 'Crítico',   color: '#e67e22', bg: '#fef3e7' },
  WARNING:  { label: 'Próximo',   color: '#f39c12', bg: '#fef9e7' },
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)',
  background: 'var(--sz-bg)', color: 'var(--sz-text)',
  fontFamily: 'IBM Plex Sans, sans-serif', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--sz-muted)',
  textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4,
};

// ── Componente ───────────────────────────────────────────────────────────────

export default function FleetMaintenancePage() {
  const toast   = useToast();
  const { user } = useAuth();
  const [upcoming, setUpcoming]   = useState<UpcomingItem[]>([]);
  const [vehicles, setVehicles]   = useState<VehicleOption[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [urgencyFilter, setFilter] = useState<string>('ALL');

  const [form, setForm] = useState({
    vehicleId:       '',
    name:            '',
    serviceType:     'OIL_CHANGE',
    frequencyMonths: '',
    kmThreshold:     '',
    nextDueDate:     '',
    description:     '',
  });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<{ total: number; overdue: number; critical: number; warning: number; items: UpcomingItem[] }>('/fleet/maintenance/upcoming'),
      api.get<VehicleOption[]>('/fleet/vehicles'),
    ])
      .then(([up, v]) => {
        setUpcoming(up.data.items ?? []);
        setVehicles(v.data ?? []);
      })
      .catch(() => toast.push('Error al cargar mantenimientos', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.vehicleId) return toast.push('Selecciona un vehículo', 'warning');
    if (!form.name)      return toast.push('Ingresa un nombre para el plan', 'warning');
    if (!form.frequencyMonths && !form.kmThreshold) return toast.push('Define al menos un trigger (meses o km)', 'warning');
    setSaving(true);
    try {
      const selectedVehicle = vehicles.find(v => v.id === form.vehicleId);
      await api.post('/fleet/maintenance/plan', {
        vehicleId:        form.vehicleId,
        name:             form.name || undefined,
        serviceType:      form.serviceType,
        description:      form.description || null,
        frequencyMonths:  form.frequencyMonths  ? Number(form.frequencyMonths)  : undefined,
        kmThreshold:      form.kmThreshold      ? Number(form.kmThreshold)      : undefined,
        nextDueDate:      form.nextDueDate      ? new Date(form.nextDueDate).toISOString() : undefined,
        currentVehicleKm: selectedVehicle?.currentKm,
        createdById:      user?.id,
      });
      toast.push('Plan de mantenimiento creado', 'success');
      setModalOpen(false);
      setForm({ vehicleId: '', name: '', serviceType: 'OIL_CHANGE', frequencyMonths: '', kmThreshold: '', nextDueDate: '', description: '' });
      load();
    } catch (err: any) {
      toast.push(err.response?.data?.error ?? 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  }

  const filtered = urgencyFilter === 'ALL' ? upcoming : upcoming.filter(u => u.urgency === urgencyFilter);

  const overdue  = upcoming.filter(u => u.urgency === 'OVERDUE').length;
  const critical = upcoming.filter(u => u.urgency === 'CRITICAL').length;
  const warning  = upcoming.filter(u => u.urgency === 'WARNING').length;

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* Topbar */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>Mantenimiento Vehicular</span>
        <button onClick={() => setModalOpen(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--sz-accent)', color: '#fff',
          border: 'none', borderRadius: 'var(--sz-radius)',
          padding: '7px 14px', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
        }}>
          <Plus size={14} /> Nuevo Plan
        </button>
      </div>

      <div style={{ padding: '16px 24px' }}>

        {/* Resumen */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Vencidos',  value: overdue,  color: '#c0392b', Icon: AlertTriangle },
            { label: 'Críticos',  value: critical, color: '#e67e22', Icon: Clock         },
            { label: 'Próximos',  value: warning,  color: '#f39c12', Icon: Wrench        },
          ].map(({ label, value, color, Icon }) => (
            <Card key={label} topAccent={color}>
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {[{ key: 'ALL', label: 'Todos' }, { key: 'OVERDUE', label: 'Vencidos' }, { key: 'CRITICAL', label: 'Críticos' }, { key: 'WARNING', label: 'Próximos' }].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
              border: `1px solid ${urgencyFilter === f.key ? 'var(--sz-accent)' : 'var(--sz-border)'}`,
              background: urgencyFilter === f.key ? 'var(--sz-accent)' : 'var(--sz-card)',
              color: urgencyFilter === f.key ? '#fff' : 'var(--sz-muted)', transition: 'all .15s',
            }}>{f.label}</button>
          ))}
        </div>

        {/* Tabla */}
        <Card>
          <CardHeader title="Planes de Mantenimiento Pendientes" subtitle="Vencidos o próximos a vencer" />
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>Cargando...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>✓ Sin mantenimientos pendientes</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--sz-bg)' }}>
                    {['Vehículo', 'Plan', 'Tipo', 'Próxima fecha', 'Días restantes', 'Km restantes', 'OT abierta', 'Urgencia'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, i) => {
                    const urg = URGENCY_MAP[item.urgency];
                    return (
                      <tr key={item.planId} style={{ borderBottom: '1px solid var(--sz-border)', background: i % 2 === 0 ? 'var(--sz-card)' : 'var(--sz-bg)' }}>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700, color: 'var(--sz-accent)' }}>{item.vehiclePlate}</div>
                          <div style={{ fontSize: 11, color: 'var(--sz-muted)' }}>{item.vehicleCode}</div>
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--sz-text)', whiteSpace: 'nowrap' }}>{item.planName}</td>
                        <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{item.serviceType ? (SERVICE_TYPE_LABELS[item.serviceType] ?? item.serviceType) : '—'}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, whiteSpace: 'nowrap' }}>{item.nextDue ? new Date(item.nextDue).toLocaleDateString('es-MX') : '—'}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, whiteSpace: 'nowrap', color: item.daysUntilDue != null && item.daysUntilDue < 0 ? '#c0392b' : 'var(--sz-text)' }}>
                          {item.daysUntilDue != null ? (item.daysUntilDue < 0 ? `+${Math.abs(item.daysUntilDue)} días` : `${item.daysUntilDue} días`) : '—'}
                        </td>
                        <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, whiteSpace: 'nowrap', color: item.kmRemaining != null && item.kmRemaining < 0 ? '#c0392b' : 'var(--sz-text)' }}>
                          {item.kmRemaining != null ? `${item.kmRemaining.toLocaleString('es-MX')} km` : '—'}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          {item.hasOpenOT
                            ? <Badge label="Sí" color="#27ae60" bg="#e8f8f0" />
                            : <Badge label="No" color="#c0392b" bg="#fdecea" />}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <Badge label={urg.label} color={urg.color} bg={urg.bg} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Modal nuevo plan */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--sz-card)', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.25)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--sz-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--sz-text)' }}>Nuevo Plan de Mantenimiento</span>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--sz-muted)' }}>✕</button>
            </div>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Vehículo</label>
                <select value={form.vehicleId} onChange={e => setForm(p => ({ ...p, vehicleId: e.target.value }))} style={inputStyle}>
                  <option value="">— Selecciona —</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.code} — {v.plate} ({v.brand} {v.model})</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Nombre del Plan</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} placeholder="Ej. Cambio de aceite 5000 km" />
              </div>
              <div>
                <label style={labelStyle}>Tipo de Servicio</label>
                <select value={form.serviceType} onChange={e => setForm(p => ({ ...p, serviceType: e.target.value }))} style={inputStyle}>
                  {Object.entries(SERVICE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Primera Fecha de Vencimiento</label>
                <input type="date" value={form.nextDueDate} onChange={e => setForm(p => ({ ...p, nextDueDate: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Frecuencia (meses)</label>
                <input type="number" min="1" value={form.frequencyMonths} onChange={e => setForm(p => ({ ...p, frequencyMonths: e.target.value }))} style={inputStyle} placeholder="Ej. 3" />
              </div>
              <div>
                <label style={labelStyle}>Umbral de Km</label>
                <input type="number" min="0" value={form.kmThreshold} onChange={e => setForm(p => ({ ...p, kmThreshold: e.target.value }))} style={inputStyle} placeholder="Ej. 5000" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Descripción (opcional)</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} />
              </div>
              <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--sz-muted)', background: 'var(--sz-bg)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--sz-border)' }}>
                ℹ️ Puedes definir trigger por <strong>tiempo</strong> (meses), por <strong>km</strong>, o ambos. Al menos uno es requerido.
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sz-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setModalOpen(false)} style={{ padding: '7px 16px', background: 'var(--sz-bg)', border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)', cursor: 'pointer', fontSize: 13, color: 'var(--sz-muted)' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '7px 16px', background: 'var(--sz-accent)', color: '#fff', border: 'none', borderRadius: 'var(--sz-radius)', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? .6 : 1 }}>
                {saving ? 'Guardando...' : 'Crear Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
