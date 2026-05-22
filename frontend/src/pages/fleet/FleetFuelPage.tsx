import { useState, useEffect, useCallback } from 'react';
import { Plus, Droplets, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface VehicleOption { id: string; code: string; plate: string; brand: string; model: string }

interface FuelLog {
  id: string; date: string; liters: number; pricePerLiter: number;
  totalCost: number; kmAtFuel: number; station: string | null;
  invoiceNumber: string | null; notes: string | null;
  loggedBy: { name: string };
}

// ── Estilos ──────────────────────────────────────────────────────────────────

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

export default function FleetFuelPage() {
  const toast = useToast();
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [logs, setLogs]           = useState<FuelLog[]>([]);
  const [loading, setLoading]     = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving]       = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    liters: '', pricePerLiter: '', kmAtFuel: '',
    station: '', invoiceNumber: '', notes: '',
  });

  // Cargar lista de vehículos
  useEffect(() => {
    api.get<{ data: VehicleOption[] }>('/fleet/vehicles')
      .then(r => setVehicles(r.data.data))
      .catch(() => toast.push('Error al cargar vehículos', 'error'));
  }, []); // eslint-disable-line

  // Cargar logs del vehículo seleccionado
  const loadLogs = useCallback(() => {
    if (!vehicleId) return;
    setLoading(true);
    api.get<{ data: FuelLog[] }>(`/fleet/fuel/${vehicleId}`)
      .then(r => setLogs(r.data.data))
      .catch(() => toast.push('Error al cargar registros', 'error'))
      .finally(() => setLoading(false));
  }, [vehicleId]); // eslint-disable-line

  useEffect(() => { loadLogs(); }, [loadLogs]);

  async function handleSave() {
    if (!vehicleId) return toast.push('Selecciona un vehículo', 'warning');
    setSaving(true);
    try {
      await api.post('/fleet/fuel', {
        vehicleId,
        date:          new Date(form.date).toISOString(),
        liters:        Number(form.liters),
        pricePerLiter: Number(form.pricePerLiter),
        kmAtFuel:      Number(form.kmAtFuel),
        station:       form.station       || null,
        invoiceNumber: form.invoiceNumber || null,
        notes:         form.notes         || null,
      });
      toast.push('Carga de combustible registrada', 'success');
      setModalOpen(false);
      setForm({ date: new Date().toISOString().slice(0, 10), liters: '', pricePerLiter: '', kmAtFuel: '', station: '', invoiceNumber: '', notes: '' });
      loadLogs();
    } catch (err: any) {
      toast.push(err.response?.data?.error ?? 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  }

  const totalCost   = logs.reduce((s, l) => s + l.totalCost, 0);
  const totalLiters = logs.reduce((s, l) => s + l.liters, 0);

  function noteStyle(notes: string | null) {
    if (!notes) return null;
    if (notes.startsWith('[ALERTA]')) return { color: '#c0392b', icon: <AlertTriangle size={12} style={{ color: '#c0392b', flexShrink: 0 }} /> };
    return null;
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* Topbar */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>Combustible</span>
        {vehicleId && (
          <button onClick={() => setModalOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--sz-accent)', color: '#fff',
            border: 'none', borderRadius: 'var(--sz-radius)',
            padding: '7px 14px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
          }}>
            <Plus size={14} /> Registrar Carga
          </button>
        )}
      </div>

      <div style={{ padding: '16px 24px' }}>

        {/* Selector de vehículo */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Droplets size={18} style={{ color: 'var(--sz-accent)', flexShrink: 0 }} />
            <div style={{ flex: 1, maxWidth: 400 }}>
              <label style={labelStyle}>Seleccionar Vehículo</label>
              <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} style={inputStyle}>
                <option value="">— Elige un vehículo —</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.code} — {v.plate} ({v.brand} {v.model})</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {!vehicleId ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--sz-muted)', fontSize: 13 }}>
            Selecciona un vehículo para ver su historial de combustible
          </div>
        ) : (
          <>
            {/* KPIs rápidos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Registros',      value: logs.length,                                            color: '#2980b9', Icon: Droplets },
                { label: 'Total litros',   value: `${totalLiters.toLocaleString('es-MX', { maximumFractionDigits: 1 })} L`,  color: '#27ae60', Icon: TrendingUp },
                { label: 'Costo total',    value: `$${totalCost.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`,     color: '#e67e22', Icon: TrendingDown },
              ].map(({ label, value, color, Icon }) => (
                <Card key={label} topAccent={color}>
                  <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} style={{ color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: 'IBM Plex Mono, monospace' }}>{value}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Tabla de registros */}
            <Card>
              <CardHeader title="Historial de Cargas" subtitle="Más reciente primero" />
              {loading ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>Cargando...</div>
              ) : logs.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>Sin registros de combustible</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--sz-bg)' }}>
                        {['Fecha', 'Km al Cargar', 'Litros', 'Precio/L', 'Total', 'Estación', 'Folio', 'Notas', 'Registrado por'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((l, i) => {
                        const ns = noteStyle(l.notes);
                        return (
                          <tr key={l.id} style={{ borderBottom: '1px solid var(--sz-border)', background: i % 2 === 0 ? 'var(--sz-card)' : 'var(--sz-bg)' }}>
                            <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: 'var(--sz-text)' }}>{new Date(l.date).toLocaleDateString('es-MX')}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, whiteSpace: 'nowrap' }}>{l.kmAtFuel.toLocaleString('es-MX')} km</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, whiteSpace: 'nowrap', color: '#27ae60', fontWeight: 700 }}>{l.liters.toFixed(2)} L</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, whiteSpace: 'nowrap' }}>${l.pricePerLiter.toFixed(2)}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, whiteSpace: 'nowrap', fontWeight: 700, color: '#e67e22' }}>${l.totalCost.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</td>
                            <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{l.station ?? '—'}</td>
                            <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>{l.invoiceNumber ?? '—'}</td>
                            <td style={{ padding: '9px 12px', maxWidth: 200 }}>
                              {l.notes ? (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, color: ns?.color ?? 'var(--sz-muted)', fontSize: 11 }}>
                                  {ns?.icon}
                                  <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{l.notes.split('\n')[0]}</span>
                                </div>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{l.loggedBy.name}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      {/* Modal nueva carga */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--sz-card)', borderRadius: 12, width: '100%', maxWidth: 500, boxShadow: '0 8px 32px rgba(0,0,0,.25)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--sz-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--sz-text)' }}>Registrar Carga de Combustible</span>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--sz-muted)' }}>✕</button>
            </div>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Fecha</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inputStyle} />
              </div>
              {[
                { key: 'kmAtFuel'      as const, label: 'Km al Cargar',    type: 'number' },
                { key: 'liters'        as const, label: 'Litros',           type: 'number' },
                { key: 'pricePerLiter' as const, label: 'Precio por Litro', type: 'number' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <input type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={inputStyle} step="any" />
                </div>
              ))}
              <div>
                <label style={labelStyle}>Estación (opcional)</label>
                <input value={form.station} onChange={e => setForm(p => ({ ...p, station: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>No. Factura / Folio</label>
                <input value={form.invoiceNumber} onChange={e => setForm(p => ({ ...p, invoiceNumber: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Notas</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} />
              </div>
              {form.liters && form.pricePerLiter && (
                <div style={{ gridColumn: '1 / -1', padding: '10px 12px', background: '#e8f2fb', borderRadius: 8, fontSize: 13, color: '#2980b9', fontWeight: 600 }}>
                  Total estimado: ${(Number(form.liters) * Number(form.pricePerLiter)).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sz-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setModalOpen(false)} style={{ padding: '7px 16px', background: 'var(--sz-bg)', border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)', cursor: 'pointer', fontSize: 13, color: 'var(--sz-muted)' }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '7px 16px', background: 'var(--sz-accent)', color: '#fff', border: 'none', borderRadius: 'var(--sz-radius)', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? .6 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
