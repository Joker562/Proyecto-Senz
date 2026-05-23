import React, { useState } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface TripToClose {
  id:          string;
  startKm:     number;
  startTime:   string;
  origin:      string;
  destination: string;
}

export interface CloseTripModalProps {
  trip:    TripToClose;
  onSaved: () => void;
  onClose: () => void;
}

// ── Helper ────────────────────────────────────────────────────────────────────

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

export default function CloseTripModal({ trip, onSaved, onClose }: CloseTripModalProps) {
  const toast = useToast();

  const [endKm,    setEndKm]    = useState('');
  const [endTime,  setEndTime]  = useState(nowLocal());
  const [notes,    setNotes]    = useState('');
  const [saving,   setSaving]   = useState(false);

  // ── Validación en tiempo real ─────────────────────────────────────────────

  const endKmN     = Number(endKm) || 0;
  const kmError    = endKm !== '' && endKmN > 0 && endKmN <= trip.startKm;
  const distance   = endKm !== '' && endKmN > trip.startKm ? endKmN - trip.startKm : null;

  // ── Guardar ───────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!endKm)      return toast.push('Ingresa el km de llegada', 'warning');
    if (kmError)     return toast.push(`El km de llegada debe ser mayor a ${trip.startKm.toLocaleString('es-MX')}`, 'warning');
    if (!endTime)    return toast.push('Ingresa la hora de regreso', 'warning');

    setSaving(true);
    try {
      await api.put(`/fleet/trip-logs/${trip.id}`, {
        endKm:   Number(endKm),
        endTime: new Date(endTime).toISOString(),
        status:  'COMPLETED',
        notes:   notes.trim() || null,
      });
      toast.push('Viaje cerrado correctamente', 'success');
      onSaved();
    } catch (err: any) {
      toast.push(err.response?.data?.error ?? 'Error al cerrar viaje', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--sz-card)', borderRadius: 12, width: '100%', maxWidth: 460, boxShadow: '0 8px 32px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--sz-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#2980b920', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={16} style={{ color: '#2980b9' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--sz-text)' }}>Cerrar Viaje</div>
            <div style={{ fontSize: 11, color: 'var(--sz-muted)', marginTop: 1 }}>
              {trip.origin} → {trip.destination}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--sz-muted)', lineHeight: 1, padding: 2 }}>✕</button>
        </div>

        {/* Resumen del viaje */}
        <div style={{ padding: '12px 20px', background: 'var(--sz-bg)', borderBottom: '1px solid var(--sz-border)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--sz-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Km de salida</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--sz-text)', fontFamily: 'IBM Plex Mono, monospace' }}>
              {trip.startKm.toLocaleString('es-MX')} km
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--sz-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Hora de salida</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sz-text)' }}>
              {new Date(trip.startTime).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          </div>
          {distance !== null && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--sz-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Distancia recorrida</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#27ae60', fontFamily: 'IBM Plex Mono, monospace' }}>
                {distance.toLocaleString('es-MX')} km
              </div>
            </div>
          )}
        </div>

        {/* Formulario */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Km de llegada */}
          <div>
            <label style={lbl}>Km de llegada (odómetro) *</label>
            <input
              type="number" step="1" min={trip.startKm + 1}
              value={endKm}
              onChange={e => setEndKm(e.target.value)}
              placeholder={`Mayor a ${trip.startKm.toLocaleString('es-MX')}`}
              style={{ ...inp, borderColor: kmError ? '#c0392b' : undefined }}
              autoFocus
            />
            {kmError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, fontSize: 11, color: '#c0392b' }}>
                <AlertTriangle size={11} />
                Debe ser mayor al km de salida ({trip.startKm.toLocaleString('es-MX')})
              </div>
            )}
          </div>

          {/* Hora de regreso */}
          <div>
            <label style={lbl}>Hora de regreso *</label>
            <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} style={inp} />
          </div>

          {/* Notas */}
          <div>
            <label style={lbl}>Notas del viaje</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ ...inp, minHeight: 68, resize: 'vertical' }}
              placeholder="Incidencias, observaciones, consumo de combustible..."
            />
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sz-border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '7px 16px', background: 'var(--sz-bg)', border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)', cursor: 'pointer', fontSize: 13, color: 'var(--sz-muted)', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || kmError || !endKm} style={{ padding: '7px 16px', background: '#2980b9', color: '#fff', border: 'none', borderRadius: 'var(--sz-radius)', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: (saving || kmError || !endKm) ? .6 : 1, fontFamily: 'IBM Plex Sans, sans-serif' }}>
            {saving ? 'Guardando...' : 'Cerrar Viaje'}
          </button>
        </div>

      </div>
    </div>
  );
}
