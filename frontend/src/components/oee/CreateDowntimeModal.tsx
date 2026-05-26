/**
 * CreateDowntimeModal — Registro de evento de paro de producción
 * Calcula duración automáticamente al ingresar hora de fin.
 */
import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { oeeApi, OEERecord } from '@/services/api';
import { useToast } from '@/hooks/useToast';

interface Props {
  open:          boolean;
  onClose:       () => void;
  onSuccess:     () => void;
  /** Si se pasa, pre-selecciona el registro OEE y bloquea el selector */
  oeeRecordId?:  string;
  /** Si se pasa, filtra los registros OEE disponibles */
  assetId?:      string;
}

const CATEGORY_LABELS: Record<string, string> = {
  UNPLANNED:  '🔴 Falla imprevista',
  PLANNED:    '🔵 Paro planificado',
  SETUP:      '🟡 Setup / Cambio de formato',
  MINOR_STOP: '🟠 Microparo',
};

const LOSS_TYPE_LABELS: Record<string, string> = {
  AVAILABILITY: 'Disponibilidad — afecta tiempo de producción',
  PERFORMANCE:  'Rendimiento — reduce velocidad de producción',
  QUALITY:      'Calidad — genera piezas defectuosas',
};

export default function CreateDowntimeModal({ open, onClose, onSuccess, oeeRecordId, assetId }: Props) {
  const { push } = useToast();
  const [records, setRecords] = useState<OEERecord[]>([]);
  const [saving,  setSaving]  = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  const nowLocal = () => {
    const d = new Date();
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  };

  const [form, setForm] = useState({
    oeeRecordId: oeeRecordId ?? '',
    startTime:   nowLocal(),
    endTime:     '',
    category:    'UNPLANNED',
    lossType:    'AVAILABILITY',
    reason:      '',
    notes:       '',
  });

  // Cargar registros OEE recientes para el selector
  useEffect(() => {
    if (!open) return;
    if (oeeRecordId) { setForm(f => ({ ...f, oeeRecordId })); return; }
    oeeApi.getRecords({ assetId, page: 1, limit: 30 })
      .then(r => setRecords(r.data))
      .catch(console.error);
  }, [open, oeeRecordId, assetId]);

  // Calcular duración en tiempo real
  const duration = (() => {
    if (!form.startTime || !form.endTime) return null;
    const diff = (new Date(form.endTime).getTime() - new Date(form.startTime).getTime()) / 60_000;
    return diff > 0 ? Math.round(diff * 10) / 10 : null;
  })();

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => { const c = { ...e }; delete c[field]; return c; });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.oeeRecordId) e.oeeRecordId = 'Selecciona un registro OEE';
    if (!form.startTime)   e.startTime   = 'La hora de inicio es requerida';
    if (!form.reason.trim()) e.reason    = 'Describe la causa del paro';
    if (form.endTime && new Date(form.endTime) <= new Date(form.startTime)) {
      e.endTime = 'La hora de fin debe ser posterior a la de inicio';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    // Determinar assetId desde el registro seleccionado
    const selectedRecord = records.find(r => r.id === form.oeeRecordId);
    const resolvedAssetId = assetId ?? selectedRecord?.assetId;
    if (!resolvedAssetId) { push('No se pudo determinar el activo', 'error'); return; }

    setSaving(true);
    try {
      await oeeApi.createDowntimeEvent({
        oeeRecordId: form.oeeRecordId,
        assetId:     resolvedAssetId,
        startTime:   new Date(form.startTime).toISOString(),
        endTime:     form.endTime ? new Date(form.endTime).toISOString() : undefined,
        category:    form.category,
        lossType:    form.lossType,
        reason:      form.reason.trim(),
        notes:       form.notes.trim() || undefined,
      });
      push('Evento de paro registrado', 'success');
      onSuccess();
      onClose();
      setForm({ oeeRecordId: oeeRecordId ?? '', startTime: nowLocal(), endTime: '', category: 'UNPLANNED', lossType: 'AVAILABILITY', reason: '', notes: '' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al guardar';
      push(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid var(--sz-border)', borderRadius: 6, fontSize: 13, background: 'var(--sz-card)', color: 'var(--sz-text)', outline: 'none' };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--sz-muted)', display: 'block', marginBottom: 4 };
  const errStyle:   React.CSSProperties = { fontSize: 11, color: '#c0392b', marginTop: 3 };

  const shiftLabel = (s: string) => ({ MORNING: '🌅 Mañana', AFTERNOON: '☀️ Tarde', NIGHT: '🌙 Noche' }[s] ?? s);

  return (
    <Modal open={open} onClose={onClose} title="Registrar evento de paro" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Registro OEE */}
        {!oeeRecordId && (
          <div>
            <label style={labelStyle}>Registro OEE del turno *</label>
            <select style={inputStyle} value={form.oeeRecordId} onChange={e => set('oeeRecordId', e.target.value)}>
              <option value="">-- Selecciona el turno --</option>
              {records.map(r => (
                <option key={r.id} value={r.id}>
                  {new Date(r.date).toLocaleDateString('es-MX')} — {shiftLabel(r.shift)} — {r.asset.code} {r.asset.name}
                </option>
              ))}
            </select>
            {errors.oeeRecordId && <span style={errStyle}>{errors.oeeRecordId}</span>}
          </div>
        )}

        {/* Horario */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Hora de inicio *</label>
            <input type="datetime-local" style={inputStyle} value={form.startTime} onChange={e => set('startTime', e.target.value)} />
            {errors.startTime && <span style={errStyle}>{errors.startTime}</span>}
          </div>
          <div>
            <label style={labelStyle}>Hora de fin (opcional)</label>
            <input type="datetime-local" style={inputStyle} value={form.endTime} min={form.startTime} onChange={e => set('endTime', e.target.value)} />
            {errors.endTime && <span style={errStyle}>{errors.endTime}</span>}
          </div>
        </div>

        {/* Duración calculada */}
        {duration !== null && (
          <div style={{ padding: '8px 12px', background: duration > 60 ? '#fef3f2' : '#f0f9ff', border: `1px solid ${duration > 60 ? '#fecaca' : '#bae6fd'}`, borderRadius: 6, fontSize: 12, color: duration > 60 ? '#c0392b' : '#2980b9', fontWeight: 600 }}>
            ⏱ Duración calculada: {duration} minutos {duration > 60 ? '— ¡Paro prolongado!' : ''}
          </div>
        )}

        {/* Clasificación */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Categoría *</label>
            <select style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)}>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Tipo de pérdida *</label>
            <select style={inputStyle} value={form.lossType} onChange={e => set('lossType', e.target.value)}>
              {Object.entries(LOSS_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Hint sobre tipo de pérdida */}
        <div style={{ fontSize: 11, color: 'var(--sz-muted)', background: 'var(--sz-bg)', padding: '6px 10px', borderRadius: 5, borderLeft: '3px solid var(--sz-border)' }}>
          {form.lossType === 'AVAILABILITY' && '💡 Afecta la Disponibilidad: el equipo estuvo parado y se descuenta del tiempo productivo.'}
          {form.lossType === 'PERFORMANCE'  && '💡 Afecta el Rendimiento: el equipo corrió más lento que el ciclo ideal.'}
          {form.lossType === 'QUALITY'      && '💡 Afecta la Calidad: se produjeron piezas defectuosas durante este periodo.'}
        </div>

        {/* Causa */}
        <div>
          <label style={labelStyle}>Causa / motivo *</label>
          <input style={inputStyle} type="text" value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="Ej. Falla en compresor principal, ajuste de molde..." maxLength={200} />
          {errors.reason && <span style={errStyle}>{errors.reason}</span>}
        </div>

        {/* Notas */}
        <div>
          <label style={labelStyle}>Notas adicionales</label>
          <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Acciones tomadas, número de OT, responsable..." />
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--sz-border)' }}>
        <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--sz-border)', background: 'var(--sz-card)', color: 'var(--sz-text)', fontSize: 13, cursor: 'pointer' }}>
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={saving} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#e67e22', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1 }}>
          {saving ? 'Guardando…' : 'Registrar paro'}
        </button>
      </div>
    </Modal>
  );
}
