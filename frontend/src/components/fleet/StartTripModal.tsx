import React, { useState, useEffect } from 'react';
import { Car, User, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface TripVehicleOption {
  id: string;
  code: string;
  plate: string;
  brand: string;
  model: string;
  currentKm: number;
  status: string;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

export interface StartTripModalProps {
  vehicles: TripVehicleOption[];
  /** Si se indica, el selector de vehículo queda bloqueado. */
  preselectedVehicleId?: string;
  onSaved: () => void;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowLocal(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-') + 'T' + [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
  ].join(':');
}

// ── Estilos ───────────────────────────────────────────────────────────────────

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

// ── Componente ────────────────────────────────────────────────────────────────

export default function StartTripModal({
  vehicles,
  preselectedVehicleId,
  onSaved,
  onClose,
}: StartTripModalProps) {
  const toast    = useToast();
  const { user } = useAuth();

  // Solo mostrar vehículos AVAILABLE
  const availableVehicles = vehicles.filter(v => v.status === 'AVAILABLE');

  const [users, setUsers]           = useState<UserOption[]>([]);
  const [canSelectUsers, setCanSelectUsers] = useState(false);

  const [form, setForm] = useState({
    vehicleId:      preselectedVehicleId ?? (availableVehicles[0]?.id ?? ''),
    driverId:       user?.id ?? '',
    origin:         '',
    destination:    '',
    purpose:        '',
    startKm:        '',
    startTime:      nowLocal(),
    notes:          '',
    needsAuth:      false,
    authorizedById: '',
  });
  const [saving, setSaving] = useState(false);

  // Intentar cargar lista de usuarios (requiere ADMIN/SUPERVISOR)
  useEffect(() => {
    api.get<UserOption[]>('/users')
      .then(r => {
        setUsers(r.data ?? []);
        setCanSelectUsers(true);
      })
      .catch(() => {
        // 403 u otro error: solo el usuario actual como conductor
        setCanSelectUsers(false);
      });
  }, []); // eslint-disable-line

  // Sincronizar startKm cuando cambia el vehículo seleccionado
  useEffect(() => {
    const v = vehicles.find(v => v.id === form.vehicleId);
    if (v) setForm(p => ({ ...p, startKm: String(v.currentKm) }));
  }, [form.vehicleId, vehicles]);

  const selectedVehicle = vehicles.find(v => v.id === form.vehicleId);

  const supervisors = users.filter(u => u.role === 'ADMIN' || u.role === 'SUPERVISOR');

  const sf = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  // ── Validaciones ──────────────────────────────────────────────────────────

  const errors: Record<string, string> = {};
  if (!form.vehicleId)   errors.vehicleId   = 'Selecciona un vehículo disponible';
  if (!form.driverId)    errors.driverId    = 'Selecciona un conductor';
  if (!form.origin.trim())      errors.origin      = 'Ingresa el origen';
  if (!form.destination.trim()) errors.destination = 'Ingresa el destino';
  if (form.needsAuth && !form.authorizedById) errors.authorizedById = 'Selecciona un autorizador';

  // ── Guardar ───────────────────────────────────────────────────────────────

  async function handleSave() {
    if (Object.keys(errors).length) {
      const first = Object.values(errors)[0];
      return toast.push(first, 'warning');
    }

    setSaving(true);
    try {
      await api.post('/fleet/trip-logs', {
        vehicleId:      form.vehicleId,
        driverId:       form.driverId,
        origin:         form.origin.trim(),
        destination:    form.destination.trim(),
        purpose:        form.purpose.trim() || null,
        startKm:        Number(form.startKm),
        startTime:      new Date(form.startTime).toISOString(),
        notes:          form.notes.trim() || null,
        authorizedById: form.needsAuth && form.authorizedById ? form.authorizedById : null,
      });
      toast.push('Viaje iniciado correctamente', 'success');
      onSaved();
    } catch (err: any) {
      toast.push(err.response?.data?.error ?? 'Error al iniciar viaje', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--sz-card)', borderRadius: 12, width: '100%', maxWidth: 560, boxShadow: '0 8px 32px rgba(0,0,0,.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--sz-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#27ae6020', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Car size={16} style={{ color: '#27ae60' }} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--sz-text)', flex: 1 }}>Iniciar Viaje</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--sz-muted)', lineHeight: 1, padding: 2 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {availableVehicles.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fdecea', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#c0392b' }}>
              <AlertTriangle size={15} /> No hay vehículos disponibles en este momento.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            {/* Vehículo (solo AVAILABLE) */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Vehículo (solo disponibles) *</label>
              <select
                value={form.vehicleId}
                onChange={e => sf('vehicleId', e.target.value)}
                disabled={!!preselectedVehicleId || availableVehicles.length === 0}
                style={{ ...inp, opacity: preselectedVehicleId ? .65 : 1 }}
              >
                <option value="">— Seleccionar vehículo —</option>
                {availableVehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.code} — {v.plate} ({v.brand} {v.model})
                  </option>
                ))}
              </select>
            </div>

            {/* Conductor */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>
                <User size={11} style={{ display: 'inline', marginRight: 4 }} />
                Conductor *
              </label>
              {canSelectUsers ? (
                <select value={form.driverId} onChange={e => sf('driverId', e.target.value)} style={inp}>
                  <option value="">— Seleccionar conductor —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.id === user?.id ? '(yo)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={user?.name ?? ''}
                  disabled
                  style={{ ...inp, opacity: .65 }}
                />
              )}
            </div>

            {/* Km de salida (bloqueado) */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Km de salida (odómetro actual)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <input
                  type="number"
                  value={form.startKm}
                  readOnly
                  style={{ ...inp, flex: 1, opacity: .65, cursor: 'not-allowed' }}
                />
                {selectedVehicle && (
                  <div style={{ padding: '7px 12px', background: '#e8f8f0', borderRadius: 'var(--sz-radius)', fontSize: 12, color: '#27ae60', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'IBM Plex Mono, monospace', flexShrink: 0 }}>
                    <CheckCircle size={12} style={{ display: 'inline', marginRight: 4 }} />
                    Sincronizado
                  </div>
                )}
              </div>
            </div>

            {/* Origen */}
            <div>
              <label style={lbl}>Origen *</label>
              <input value={form.origin} onChange={e => sf('origin', e.target.value)} style={inp} placeholder="Punto de partida" />
            </div>

            {/* Destino */}
            <div>
              <label style={lbl}>Destino *</label>
              <input value={form.destination} onChange={e => sf('destination', e.target.value)} style={inp} placeholder="Punto de llegada" />
            </div>

            {/* Motivo */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Motivo del viaje</label>
              <input value={form.purpose} onChange={e => sf('purpose', e.target.value)} style={inp} placeholder="Descripción del propósito" />
            </div>

            {/* Hora de salida */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Hora de salida *</label>
              <input type="datetime-local" value={form.startTime} onChange={e => sf('startTime', e.target.value)} style={inp} />
            </div>

            {/* Requiere autorización */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--sz-text)', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                <input
                  type="checkbox"
                  checked={form.needsAuth}
                  onChange={e => sf('needsAuth', e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: 'var(--sz-accent)' }}
                />
                ¿Requiere autorización de un supervisor?
              </label>
            </div>

            {/* Selector de autorizador (solo si needsAuth) */}
            {form.needsAuth && (
              <div style={{ gridColumn: '1 / -1', paddingLeft: 24, borderLeft: '3px solid var(--sz-accent)' }}>
                <label style={lbl}>Autorizado por *</label>
                {supervisors.length > 0 ? (
                  <select value={form.authorizedById} onChange={e => sf('authorizedById', e.target.value)} style={inp}>
                    <option value="">— Seleccionar supervisor/admin —</option>
                    {supervisors.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--sz-muted)', padding: '8px 0' }}>
                    No se pudo cargar la lista de supervisores.
                  </div>
                )}
              </div>
            )}

            {/* Notas */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Notas adicionales</label>
              <textarea value={form.notes} onChange={e => sf('notes', e.target.value)} style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
            </div>

          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sz-border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '7px 16px', background: 'var(--sz-bg)', border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)', cursor: 'pointer', fontSize: 13, color: 'var(--sz-muted)', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || availableVehicles.length === 0} style={{ padding: '7px 16px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: 'var(--sz-radius)', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: (saving || availableVehicles.length === 0) ? .6 : 1, fontFamily: 'IBM Plex Sans, sans-serif' }}>
            {saving ? 'Iniciando...' : 'Iniciar Viaje'}
          </button>
        </div>

      </div>
    </div>
  );
}
