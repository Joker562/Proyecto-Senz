/**
 * CreateOEEModal — Registro de turno OEE con cálculo en vivo
 * Calcula A / P / Q / OEE mientras el operador escribe, antes de guardar.
 */
import { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import { oeeApi, api } from '@/services/api';
import { useToast } from '@/hooks/useToast';

interface Asset { id: string; code: string; name: string; area: string }

interface Props {
  open:      boolean;
  onClose:   () => void;
  onSuccess: () => void;
}

// ─── Cálculo en tiempo real (misma fórmula que el backend) ────────────────────
function calcLive(pt: number, bt: number, tc: number, gc: number, ict: number) {
  const actualTime = pt - bt;
  if (pt <= 0 || actualTime <= 0 || tc <= 0 || ict <= 0 || gc > tc) return null;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const availability = r1((actualTime / pt) * 100);
  const performance  = r1(Math.min((ict * tc / actualTime) * 100, 100));
  const quality      = r1((gc / tc) * 100);
  const oee          = r1((availability / 100) * (performance / 100) * (quality / 100) * 100);
  return { availability, performance, quality, oee };
}

function semColor(v: number, type: 'oee' | 'avail' | 'perf' | 'qual') {
  const thresholds = {
    oee:   [85, 65],
    avail: [90, 75],
    perf:  [95, 80],
    qual:  [99, 95],
  };
  const [good, warn] = thresholds[type];
  if (v >= good) return '#27ae60';
  if (v >= warn) return '#e67e22';
  return '#c0392b';
}

export default function CreateOEEModal({ open, onClose, onSuccess }: Props) {
  const { push } = useToast();
  const [assets,  setAssets]  = useState<Asset[]>([]);
  const [saving,  setSaving]  = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    assetId: '', date: today, shift: 'MORNING',
    plannedTime: '480', breakTime: '30',
    totalCount: '', goodCount: '', idealCycleTime: '',
    notes: '',
  });

  // Cargar activos al abrir
  useEffect(() => {
    if (!open) return;
    api.get<Asset[]>('/assets').then(r => {
      const list = Array.isArray(r.data) ? r.data : [];
      setAssets(list.filter(a => (a as unknown as { status: string }).status !== 'DECOMMISSIONED'));
    }).catch(console.error);
  }, [open]);

  // Cálculo en vivo
  const live = useMemo(() => {
    const pt  = parseFloat(form.plannedTime);
    const bt  = parseFloat(form.breakTime);
    const tc  = parseInt(form.totalCount);
    const gc  = parseInt(form.goodCount);
    const ict = parseFloat(form.idealCycleTime);
    if ([pt, bt, tc, gc, ict].some(isNaN)) return null;
    return calcLive(pt, bt, tc, gc, ict);
  }, [form.plannedTime, form.breakTime, form.totalCount, form.goodCount, form.idealCycleTime]);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => { const c = { ...e }; delete c[field]; return c; });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.assetId) e.assetId = 'Selecciona un activo';
    if (!form.date)    e.date    = 'La fecha es requerida';
    const pt  = parseFloat(form.plannedTime);
    const bt  = parseFloat(form.breakTime);
    const tc  = parseInt(form.totalCount);
    const gc  = parseInt(form.goodCount);
    const ict = parseFloat(form.idealCycleTime);
    if (isNaN(pt) || pt <= 0)              e.plannedTime   = 'Debe ser > 0';
    if (isNaN(bt) || bt < 0)              e.breakTime     = 'No puede ser negativo';
    if (!isNaN(pt) && !isNaN(bt) && bt >= pt) e.breakTime = 'Debe ser < tiempo planificado';
    if (isNaN(tc) || tc < 0)              e.totalCount    = 'Debe ser ≥ 0';
    if (isNaN(gc) || gc < 0)              e.goodCount     = 'Debe ser ≥ 0';
    if (!isNaN(tc) && !isNaN(gc) && gc > tc) e.goodCount  = 'No puede superar el total';
    if (isNaN(ict) || ict <= 0)           e.idealCycleTime = 'Debe ser > 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      await oeeApi.createRecord({
        assetId:       form.assetId,
        date:          new Date(form.date + 'T00:00:00').toISOString(),
        shift:         form.shift,
        plannedTime:   parseFloat(form.plannedTime),
        breakTime:     parseFloat(form.breakTime),
        totalCount:    parseInt(form.totalCount),
        goodCount:     parseInt(form.goodCount),
        idealCycleTime: parseFloat(form.idealCycleTime),
        notes:         form.notes || undefined,
      });
      push('Registro OEE creado correctamente', 'success');
      onSuccess();
      onClose();
      setForm({ assetId: '', date: today, shift: 'MORNING', plannedTime: '480', breakTime: '30', totalCount: '', goodCount: '', idealCycleTime: '', notes: '' });
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
  const fieldBox:   React.CSSProperties = { marginBottom: 12 };

  return (
    <Modal open={open} onClose={onClose} title="Registrar turno OEE" size="lg">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Col izq — Datos básicos */}
        <div>
          <div style={fieldBox}>
            <label style={labelStyle}>Activo *</label>
            <select style={inputStyle} value={form.assetId} onChange={e => set('assetId', e.target.value)}>
              <option value="">-- Selecciona --</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
            {errors.assetId && <span style={errStyle}>{errors.assetId}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Fecha *</label>
              <input type="date" style={inputStyle} value={form.date} max={today} onChange={e => set('date', e.target.value)} />
              {errors.date && <span style={errStyle}>{errors.date}</span>}
            </div>
            <div>
              <label style={labelStyle}>Turno *</label>
              <select style={inputStyle} value={form.shift} onChange={e => set('shift', e.target.value)}>
                <option value="MORNING">🌅 Mañana</option>
                <option value="AFTERNOON">☀️ Tarde</option>
                <option value="NIGHT">🌙 Noche</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Tiempo planificado (min) *</label>
              <input type="number" style={inputStyle} value={form.plannedTime} min="1" onChange={e => set('plannedTime', e.target.value)} placeholder="480" />
              {errors.plannedTime && <span style={errStyle}>{errors.plannedTime}</span>}
            </div>
            <div>
              <label style={labelStyle}>Tiempo de paros (min)</label>
              <input type="number" style={inputStyle} value={form.breakTime} min="0" onChange={e => set('breakTime', e.target.value)} placeholder="30" />
              {errors.breakTime && <span style={errStyle}>{errors.breakTime}</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Total producido *</label>
              <input type="number" style={inputStyle} value={form.totalCount} min="0" onChange={e => set('totalCount', e.target.value)} placeholder="0" />
              {errors.totalCount && <span style={errStyle}>{errors.totalCount}</span>}
            </div>
            <div>
              <label style={labelStyle}>Unidades buenas *</label>
              <input type="number" style={inputStyle} value={form.goodCount} min="0" onChange={e => set('goodCount', e.target.value)} placeholder="0" />
              {errors.goodCount && <span style={errStyle}>{errors.goodCount}</span>}
            </div>
            <div>
              <label style={labelStyle}>Ciclo ideal (min/u) *</label>
              <input type="number" style={inputStyle} value={form.idealCycleTime} min="0.01" step="0.01" onChange={e => set('idealCycleTime', e.target.value)} placeholder="1.5" />
              {errors.idealCycleTime && <span style={errStyle}>{errors.idealCycleTime}</span>}
            </div>
          </div>

          <div style={fieldBox}>
            <label style={labelStyle}>Notas (opcional)</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Observaciones del turno..." />
          </div>
        </div>

        {/* Col der — Preview OEE en vivo */}
        <div style={{ background: 'var(--sz-bg)', borderRadius: 8, padding: 16, border: '1px solid var(--sz-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
            Vista previa OEE en vivo
          </div>

          {live ? (
            <>
              {/* OEE principal */}
              <div style={{ textAlign: 'center', padding: '12px 0', borderBottom: '1px solid var(--sz-border)' }}>
                <div style={{ fontSize: 11, color: 'var(--sz-muted)', marginBottom: 4 }}>OEE ESTIMADO</div>
                <div style={{ fontSize: 48, fontWeight: 900, color: semColor(live.oee, 'oee'), lineHeight: 1 }}>
                  {live.oee}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--sz-muted)', marginTop: 4 }}>
                  {live.oee >= 85 ? '✅ Clase mundial' : live.oee >= 65 ? '⚠️ Por mejorar' : '🔴 Crítico'}
                </div>
              </div>

              {/* A / P / Q */}
              {([
                { label: 'Disponibilidad', value: live.availability, type: 'avail' as const, desc: 'Tiempo real / Tiempo planificado' },
                { label: 'Rendimiento',    value: live.performance,  type: 'perf'  as const, desc: 'Ciclo ideal × producción / tiempo real' },
                { label: 'Calidad',        value: live.quality,      type: 'qual'  as const, desc: 'Piezas buenas / total producido' },
              ] as const).map(({ label, value, type, desc }) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--sz-text)', fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: semColor(value, type) }}>{value}%</span>
                  </div>
                  <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3 }}>
                    <div style={{ width: `${value}%`, height: '100%', background: semColor(value, type), borderRadius: 3, transition: 'width .3s' }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--sz-muted)', marginTop: 2 }}>{desc}</div>
                </div>
              ))}

              {/* Resumen numérico */}
              <div style={{ marginTop: 4, padding: '8px 10px', background: 'var(--sz-card)', borderRadius: 6, border: '1px solid var(--sz-border)', fontSize: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ color: 'var(--sz-muted)' }}>Tiempo efectivo</span>
                  <span style={{ fontWeight: 600, color: 'var(--sz-text)' }}>
                    {parseFloat(form.plannedTime) - parseFloat(form.breakTime || '0')} min
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--sz-muted)' }}>Defectos</span>
                  <span style={{ fontWeight: 600, color: '#c0392b' }}>
                    {parseInt(form.totalCount || '0') - parseInt(form.goodCount || '0')} u
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sz-muted)', fontSize: 13, textAlign: 'center' }}>
              Completa los campos numéricos para ver la proyección de OEE en tiempo real
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--sz-border)' }}>
        <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--sz-border)', background: 'var(--sz-card)', color: 'var(--sz-text)', fontSize: 13, cursor: 'pointer' }}>
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={saving} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#2980b9', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1 }}>
          {saving ? 'Guardando…' : 'Guardar registro'}
        </button>
      </div>
    </Modal>
  );
}
