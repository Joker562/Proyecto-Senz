import React, { useState, useEffect } from 'react';
import { Droplets, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface FuelVehicleOption {
  id: string;
  code: string;
  plate: string;
  brand: string;
  model: string;
  currentKm: number;
}

export interface FuelLogModalProps {
  /** Lista de vehículos para el select. Si no se pasa, se carga desde la API. */
  vehicles?: FuelVehicleOption[];
  /** Si se pasa, el selector queda bloqueado en este vehículo. */
  preselectedVehicleId?: string;
  onSaved: (vehicleId: string) => void;
  onClose: () => void;
}

// ── Estilos compartidos ───────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)',
  background: 'var(--sz-bg)', color: 'var(--sz-text)',
  fontFamily: 'IBM Plex Sans, sans-serif', boxSizing: 'border-box',
};

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--sz-muted)',
  textTransform: 'uppercase' as const, letterSpacing: '.4px', marginBottom: 4,
};

const emptyForm = {
  vehicleId:     '',
  date:          new Date().toISOString().slice(0, 10),
  kmAtFuel:      '',
  liters:        '',
  pricePerLiter: '',
  station:       '',
  invoiceNumber: '',
  notes:         '',
};

// ── Componente ────────────────────────────────────────────────────────────────

export default function FuelLogModal({
  vehicles: vehiclesProp,
  preselectedVehicleId,
  onSaved,
  onClose,
}: FuelLogModalProps) {
  const toast     = useToast();
  const { user }  = useAuth();

  const [vehicles, setVehicles] = useState<FuelVehicleOption[]>(vehiclesProp ?? []);
  const [form, setForm]         = useState({ ...emptyForm, vehicleId: preselectedVehicleId ?? '' });
  const [saving, setSaving]     = useState(false);

  // Si no se pasan vehículos, se cargan de la API
  useEffect(() => {
    if (!vehiclesProp) {
      api.get<FuelVehicleOption[]>('/fleet/vehicles')
        .then(r => setVehicles(r.data ?? []))
        .catch(() => {});
    }
  }, []); // eslint-disable-line

  // ── Cálculos en tiempo real ───────────────────────────────────────────────

  const selectedVehicle = vehicles.find(v => v.id === form.vehicleId);
  const kmNow       = selectedVehicle?.currentKm ?? 0;
  const litersN     = Number(form.liters)        || 0;
  const kmAtFuelN   = Number(form.kmAtFuel)      || 0;
  const ppLiterN    = Number(form.pricePerLiter)  || 0;

  const totalCost  = litersN > 0 && ppLiterN > 0 ? litersN * ppLiterN : null;
  const estimatedKmL =
    litersN > 0 && kmAtFuelN > kmNow
      ? Number(((kmAtFuelN - kmNow) / litersN).toFixed(2))
      : null;

  const kmError = form.kmAtFuel !== '' && kmAtFuelN > 0 && kmAtFuelN <= kmNow;

  const sf = (k: keyof typeof emptyForm, v: string) =>
    setForm(p => ({ ...p, [k]: v }));

  // ── Guardar ───────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.vehicleId)      return toast.push('Selecciona un vehículo', 'warning');
    if (!form.liters)         return toast.push('Ingresa los litros', 'warning');
    if (!form.pricePerLiter)  return toast.push('Ingresa el precio por litro', 'warning');
    if (!form.kmAtFuel)       return toast.push('Ingresa el km al cargar', 'warning');
    if (!user?.id)            return toast.push('Usuario no autenticado', 'error');

    setSaving(true);
    try {
      await api.post('/fleet/fuel', {
        vehicleId:     form.vehicleId,
        date:          new Date(form.date).toISOString(),
        liters:        Number(form.liters),
        pricePerLiter: Number(form.pricePerLiter),
        kmAtFuel:      Number(form.kmAtFuel),
        station:       form.station       || null,
        invoiceNumber: form.invoiceNumber || null,
        notes:         form.notes         || null,
        loggedById:    user.id,
      });
      toast.push('Carga de combustible registrada', 'success');
      onSaved(form.vehicleId);
    } catch (err: any) {
      toast.push(err.response?.data?.error ?? 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--sz-card)', borderRadius: 12, width: '100%', maxWidth: 520, boxShadow: '0 8px 32px rgba(0,0,0,.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--sz-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#2980b920', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Droplets size={16} style={{ color: '#2980b9' }} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--sz-text)', flex: 1 }}>Registrar Carga de Combustible</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--sz-muted)', lineHeight: 1, padding: 2 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            {/* Vehículo */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Vehículo *</label>
              <select
                value={form.vehicleId}
                onChange={e => sf('vehicleId', e.target.value)}
                disabled={!!preselectedVehicleId}
                style={{ ...inp, opacity: preselectedVehicleId ? .65 : 1 }}
              >
                <option value="">— Seleccionar vehículo —</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.code} — {v.plate} ({v.brand} {v.model})
                  </option>
                ))}
              </select>
              {selectedVehicle && (
                <div style={{ marginTop: 5, fontSize: 11, color: 'var(--sz-muted)' }}>
                  Km actuales registrados:&nbsp;
                  <strong style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--sz-text)' }}>
                    {selectedVehicle.currentKm.toLocaleString('es-MX')} km
                  </strong>
                </div>
              )}
            </div>

            {/* Fecha */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Fecha de carga *</label>
              <input type="date" value={form.date} onChange={e => sf('date', e.target.value)} style={inp} />
            </div>

            {/* Km al cargar */}
            <div>
              <label style={lbl}>Km al cargar *</label>
              <input
                type="number" step="1" min="0"
                value={form.kmAtFuel}
                onChange={e => sf('kmAtFuel', e.target.value)}
                style={{ ...inp, borderColor: kmError ? '#c0392b' : undefined }}
              />
              {kmError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, fontSize: 11, color: '#c0392b' }}>
                  <AlertTriangle size={11} /> Debe ser mayor al km actual ({kmNow.toLocaleString('es-MX')})
                </div>
              )}
            </div>

            {/* Litros */}
            <div>
              <label style={lbl}>Litros *</label>
              <input type="number" step="0.01" min="0.01" value={form.liters} onChange={e => sf('liters', e.target.value)} style={inp} />
            </div>

            {/* Precio por litro */}
            <div>
              <label style={lbl}>Precio por litro *</label>
              <input type="number" step="0.01" min="0.01" value={form.pricePerLiter} onChange={e => sf('pricePerLiter', e.target.value)} style={inp} />
            </div>

            {/* Estación */}
            <div>
              <label style={lbl}>Estación / Gasolinera</label>
              <input value={form.station} onChange={e => sf('station', e.target.value)} style={inp} placeholder="Nombre de la estación" />
            </div>

            {/* No. factura */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>No. Factura / Folio</label>
              <input value={form.invoiceNumber} onChange={e => sf('invoiceNumber', e.target.value)} style={inp} placeholder="Folio fiscal" />
            </div>

            {/* Notas */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Notas</label>
              <textarea value={form.notes} onChange={e => sf('notes', e.target.value)} style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
            </div>

            {/* Panel de cálculos en tiempo real */}
            {(totalCost !== null || estimatedKmL !== null) && (
              <div style={{ gridColumn: '1 / -1', background: 'var(--sz-bg)', border: '1px solid var(--sz-border)', borderRadius: 8, padding: '12px 14px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {totalCost !== null && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--sz-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Total estimado</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#e67e22', fontFamily: 'IBM Plex Mono, monospace' }}>
                      ${totalCost.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
                {estimatedKmL !== null && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--sz-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Rendimiento estimado</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: estimatedKmL < 5 ? '#c0392b' : '#27ae60', fontFamily: 'IBM Plex Mono, monospace' }}>
                      {estimatedKmL} km/L
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sz-border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '7px 16px', background: 'var(--sz-bg)', border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)', cursor: 'pointer', fontSize: 13, color: 'var(--sz-muted)', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || kmError} style={{ padding: '7px 16px', background: 'var(--sz-accent)', color: '#fff', border: 'none', borderRadius: 'var(--sz-radius)', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: (saving || kmError) ? .6 : 1, fontFamily: 'IBM Plex Sans, sans-serif' }}>
            {saving ? 'Guardando...' : 'Guardar Carga'}
          </button>
        </div>

      </div>
    </div>
  );
}
