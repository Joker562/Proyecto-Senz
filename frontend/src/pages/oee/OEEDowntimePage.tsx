/**
 * OEEDowntimePage — Gestión de eventos de paro de producción.
 * Permite filtrar, registrar, cerrar y eliminar paros.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { oeeApi, DowntimeEvent } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import CreateDowntimeModal from '@/components/oee/CreateDowntimeModal';

const CATEGORY_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  UNPLANNED:  { label: 'Falla imprevista', color: '#c0392b', bg: '#fef2f2' },
  PLANNED:    { label: 'Planificado',       color: '#2980b9', bg: '#f0f9ff' },
  SETUP:      { label: 'Setup',             color: '#e67e22', bg: '#fff7ed' },
  MINOR_STOP: { label: 'Microparo',         color: '#8b5cf6', bg: '#f5f3ff' },
};

const LOSS_LABEL: Record<string, { label: string; color: string }> = {
  AVAILABILITY: { label: 'Disponibilidad', color: '#2980b9' },
  PERFORMANCE:  { label: 'Rendimiento',    color: '#27ae60' },
  QUALITY:      { label: 'Calidad',        color: '#8b5cf6' },
};

export default function OEEDowntimePage() {
  const { push } = useToast();
  const [events,  setEvents]  = useState<DowntimeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const LIMIT = 20;

  const [category, setCategory] = useState('');
  const [lossType, setLossType] = useState('');
  const [open,     setOpen]     = useState('');   // '' | 'true' | 'false'

  const [createDT,   setCreateDT]   = useState(false);
  const [closingId,  setClosingId]  = useState<string | null>(null);
  const [closeTime,  setCloseTime]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await oeeApi.getDowntimeEvents({
        category:  category || undefined,
        lossType:  lossType || undefined,
        open:      open     || undefined,
        page, limit: LIMIT,
      });
      setEvents(res.data);
      setTotal(res.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [category, lossType, open, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [category, lossType, open]);

  async function handleClose(id: string) {
    if (!closeTime) { push('Ingresa la hora de cierre', 'warning'); return; }
    try {
      await oeeApi.updateDowntimeEvent(id, { endTime: new Date(closeTime).toISOString() });
      push('Paro cerrado y OEE recalculado', 'success');
      setClosingId(null);
      setCloseTime('');
      load();
    } catch {
      push('Error al cerrar el paro', 'error');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este evento? El OEE del registro padre se recalculará.')) return;
    try {
      await oeeApi.deleteDowntimeEvent(id);
      push('Evento eliminado', 'success');
      load();
    } catch {
      push('No se pudo eliminar', 'error');
    }
  }

  const totalPages = Math.ceil(total / LIMIT);
  const inputStyle: React.CSSProperties = { fontSize: 12, border: '1px solid var(--sz-border)', borderRadius: 5, padding: '5px 8px', background: 'var(--sz-card)', color: 'var(--sz-text)' };

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* Topbar */}
      <div style={{ background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)', padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)', flex: 1 }}>Eventos de Paro</span>

        {/* Filtros */}
        <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">Todas las categorías</option>
          <option value="UNPLANNED">Falla imprevista</option>
          <option value="PLANNED">Planificado</option>
          <option value="SETUP">Setup</option>
          <option value="MINOR_STOP">Microparo</option>
        </select>
        <select style={inputStyle} value={lossType} onChange={e => setLossType(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="AVAILABILITY">Disponibilidad</option>
          <option value="PERFORMANCE">Rendimiento</option>
          <option value="QUALITY">Calidad</option>
        </select>
        <select style={inputStyle} value={open} onChange={e => setOpen(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="true">Abiertos</option>
          <option value="false">Cerrados</option>
        </select>
        <button onClick={load} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid var(--sz-border)', background: 'var(--sz-card)', cursor: 'pointer', color: 'var(--sz-muted)', display: 'flex' }}>
          <RefreshCw size={13} />
        </button>
        <button onClick={() => setCreateDT(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: 'none', background: '#e67e22', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={13} /> Registrar paro
        </button>
      </div>

      <div style={{ padding: '16px 24px' }}>
        <Card>
          <CardHeader title={`${total} eventos encontrados`} subtitle={`Página ${page} de ${totalPages || 1}`} />

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>Cargando…</div>
          ) : events.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>
              Sin eventos registrados con los filtros actuales.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--sz-border)', background: 'var(--sz-bg)' }}>
                    {['Activo', 'Categoría', 'Tipo pérdida', 'Causa', 'Inicio', 'Fin', 'Duración', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map((e, i) => {
                    const cat  = CATEGORY_LABEL[e.category] ?? { label: e.category, color: '#aaa', bg: '#f8f8f8' };
                    const loss = LOSS_LABEL[e.lossType]     ?? { label: e.lossType,  color: '#aaa' };
                    const isOpen = !e.endTime;
                    return (
                      <tr key={e.id} style={{ borderBottom: '1px solid var(--sz-border)', background: i % 2 === 0 ? 'var(--sz-card)' : 'var(--sz-bg)' }}>
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--sz-text)', whiteSpace: 'nowrap' }}>
                          {e.asset?.code ?? '—'}
                          <div style={{ fontSize: 10, color: 'var(--sz-muted)', fontWeight: 400 }}>{e.asset?.name}</div>
                        </td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: cat.bg, color: cat.color }}>
                            {cat.label}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: loss.color }}>{loss.label}</span>
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--sz-text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.reason}
                        </td>
                        <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(e.startTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                          <div style={{ fontSize: 10 }}>{new Date(e.startTime).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })}</div>
                        </td>
                        <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>
                          {e.endTime
                            ? <>{new Date(e.endTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}<div style={{ fontSize: 10 }}>{new Date(e.endTime).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })}</div></>
                            : <span style={{ color: '#e67e22', fontStyle: 'italic' }}>Abierto</span>}
                        </td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                          {e.duration != null ? (
                            <span style={{ fontWeight: 700, color: e.duration >= 60 ? '#c0392b' : e.duration >= 30 ? '#e67e22' : '#27ae60' }}>
                              {e.duration} min
                            </span>
                          ) : <span style={{ color: 'var(--sz-muted)' }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          {isOpen
                            ? <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: '#fef2f2', color: '#c0392b', fontWeight: 600 }}>🔴 Abierto</span>
                            : <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: '#f0fdf4', color: '#27ae60', fontWeight: 600 }}>✅ Cerrado</span>}
                        </td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                          {isOpen && closingId !== e.id && (
                            <button onClick={() => { setClosingId(e.id); setCloseTime(''); }}
                              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #27ae60', background: 'transparent', color: '#27ae60', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                              <CheckCircle size={11} /> Cerrar
                            </button>
                          )}
                          {isOpen && closingId === e.id && (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <input type="datetime-local" value={closeTime} onChange={ev => setCloseTime(ev.target.value)} min={e.startTime.slice(0, 16)}
                                style={{ fontSize: 11, padding: '3px 6px', borderRadius: 4, border: '1px solid var(--sz-border)', background: 'var(--sz-card)', color: 'var(--sz-text)', width: 148 }} />
                              <button onClick={() => handleClose(e.id)} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: '#27ae60', color: '#fff', cursor: 'pointer', fontSize: 11 }}>OK</button>
                              <button onClick={() => setClosingId(null)} style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid var(--sz-border)', background: 'transparent', color: 'var(--sz-muted)', cursor: 'pointer', fontSize: 11 }}>✕</button>
                            </div>
                          )}
                          {!isOpen && (
                            <button onClick={() => handleDelete(e.id)} style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #fca5a5', background: 'transparent', color: '#c0392b', cursor: 'pointer', fontSize: 11 }}>✕</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--sz-border)' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid var(--sz-border)', background: 'var(--sz-card)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? .5 : 1, display: 'flex', color: 'var(--sz-text)' }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 12, color: 'var(--sz-muted)' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid var(--sz-border)', background: 'var(--sz-card)', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? .5 : 1, display: 'flex', color: 'var(--sz-text)' }}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </Card>
      </div>

      <CreateDowntimeModal open={createDT} onClose={() => setCreateDT(false)} onSuccess={load} />
    </div>
  );
}
