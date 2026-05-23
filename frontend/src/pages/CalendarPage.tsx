import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Wrench, ClipboardCheck, AlertTriangle, X } from 'lucide-react';
import { mockWorkOrders, mockMaintenancePlans } from '@/data/mockData';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

interface CalEvent {
  id: string; title: string; date: Date; color: string;
  icon: 'ot' | 'plan' | 'audit';
  priority?: string;
  auditorId?: string; auditorName?: string;
  area?: string; status?: string; code?: string;
}

type ViewMode = 'month' | 'week' | 'day' | 'range';

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-emerald-100 text-emerald-800', MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-orange-100 text-orange-700',  CRITICAL: 'bg-red-100 text-red-800',
};
const PLAN_COLOR  = 'bg-blue-100 text-blue-800';
const AUDIT_COLOR = 'bg-purple-100 text-purple-800';
const CONFLICT_COLOR = 'bg-red-100 text-red-700';

const DAYS   = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function isoDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

// Eventos estáticos de OT y planes (mock)
const staticEvents: CalEvent[] = [
  ...mockWorkOrders.filter(o => o.scheduledAt).map(o => ({
    id: o.id, title: o.title, date: new Date(o.scheduledAt!),
    color: PRIORITY_COLORS[o.priority] ?? PRIORITY_COLORS.MEDIUM, icon: 'ot' as const, priority: o.priority,
  })),
  ...mockMaintenancePlans.map(p => ({
    id: p.id, title: `${p.asset.name} — ${p.name}`, date: new Date(p.nextDue),
    color: PLAN_COLOR, icon: 'plan' as const,
  })),
];

// ── Modal de reprogramación ────────────────────────────────────────────────────
function RescheduleModal({ event, onClose, onSaved }: {
  event: CalEvent; onClose: () => void; onSaved: () => void;
}) {
  const { push } = useToast();
  const [newDate, setNewDate] = useState(isoDate(event.date));
  const [reason, setReason]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!newDate) return;
    setLoading(true);
    try {
      await api.patch(`/audits/${event.id}/reschedule`, {
        scheduledAt: new Date(newDate + 'T08:00:00').toISOString(),
        reason: reason || undefined,
      });
      push('Auditoría reprogramada', 'success');
      onSaved();
      onClose();
    } catch {
      push('Error al reprogramar', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Reprogramar Auditoría</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>{event.code} — {event.area}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>
            Fecha actual
          </label>
          <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 8, fontSize: 13, color: '#555' }}>
            {event.date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>
            Nueva Fecha *
          </label>
          <input
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>
            Motivo (opcional)
          </label>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Ej: Auditor no disponible, área en producción…"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={loading || !newDate} style={{ flex: 1, padding: '10px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: loading ? .7 : 1 }}>
            {loading ? 'Guardando…' : 'Reprogramar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [current, setCurrent]         = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected]       = useState<Date | null>(null);
  const [viewMode, setViewMode]       = useState<ViewMode>('month');
  const [rangeFrom, setRangeFrom]     = useState('');
  const [rangeTo, setRangeTo]         = useState('');
  const [auditEvents, setAuditEvents] = useState<CalEvent[]>([]);
  const [reschedule, setReschedule]   = useState<CalEvent | null>(null);
  const [loadingAudits, setLoadingAudits] = useState(true);

  const loadAudits = async () => {
    setLoadingAudits(true);
    try {
      const { data } = await api.get<{ id: string; code: string; title: string; area: string; status: string; scheduledAt: string; auditor: { id: string; name: string } }[]>('/audits');
      const events: CalEvent[] = data
        .filter(a => a.scheduledAt && ['DRAFT', 'IN_PROGRESS'].includes(a.status))
        .map(a => ({
          id: a.id,
          code: a.code,
          title: `${a.code} — ${a.area}`,
          date: new Date(a.scheduledAt),
          color: AUDIT_COLOR,
          icon: 'audit' as const,
          auditorId: a.auditor.id,
          auditorName: a.auditor.name,
          area: a.area,
          status: a.status,
        }));
      setAuditEvents(events);
    } catch (e) {
      console.error('[Calendar] Error al cargar auditorías:', e);
    } finally {
      setLoadingAudits(false);
    }
  };

  useEffect(() => { loadAudits(); }, []);

  const allEvents = useMemo(() => [...staticEvents, ...auditEvents], [auditEvents]);

  // Detectar conflictos: mismo auditor, misma fecha, >1 auditoría
  const conflictDates = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const ev of auditEvents) {
      const key = `${isoDate(ev.date)}:${ev.auditorId}`;
      if (!map[key]) map[key] = [];
      map[key].push(ev.id);
    }
    const conflicting = new Set<string>();
    for (const [, ids] of Object.entries(map)) {
      if (ids.length > 1) ids.forEach(id => conflicting.add(id));
    }
    return conflicting;
  }, [auditEvents]);

  // Rangos según vista
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (viewMode === 'day') {
      const d = startOfDay(today);
      return { rangeStart: d, rangeEnd: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59) };
    }
    if (viewMode === 'week') {
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const start = startOfDay(monday);
      const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59);
      return { rangeStart: start, rangeEnd: end };
    }
    if (viewMode === 'month') {
      const start = new Date(current.getFullYear(), current.getMonth(), 1);
      const end = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);
      return { rangeStart: start, rangeEnd: end };
    }
    if (viewMode === 'range' && rangeFrom && rangeTo) {
      const [fy, fm, fd] = rangeFrom.split('-').map(Number);
      const [ty, tm, td] = rangeTo.split('-').map(Number);
      return { rangeStart: new Date(fy, fm - 1, fd), rangeEnd: new Date(ty, tm - 1, td, 23, 59, 59) };
    }
    return { rangeStart: null, rangeEnd: null };
  }, [viewMode, current, today, rangeFrom, rangeTo]);

  const filteredEvents = useMemo(() => {
    if (!rangeStart || !rangeEnd) return allEvents;
    return allEvents.filter(e => e.date >= rangeStart && e.date <= rangeEnd);
  }, [rangeStart, rangeEnd, allEvents]);

  const eventsForDay = (date: Date) => filteredEvents.filter(e => sameDay(e.date, date));
  const selectedEvents = selected ? eventsForDay(selected) : [];
  const hasConflictOnDay = (date: Date) => eventsForDay(date).some(e => conflictDates.has(e.id));
  const isToday = (date: Date) => sameDay(date, today);
  const inRange  = (date: Date) => !rangeStart || !rangeEnd || (date >= rangeStart && date <= rangeEnd);

  // Celdas del mes
  const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
  const firstDay    = new Date(current.getFullYear(), current.getMonth(), 1).getDay();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : new Date(current.getFullYear(), current.getMonth(), i - firstDay + 1)
  );

  // Días de la semana actual
  const weekDays = useMemo(() => {
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  }, [today]);

  const VIEW_LABELS: Record<ViewMode, string> = { month: 'Mes', week: 'Semana', day: 'Hoy', range: 'Rango' };

  const auditConflictsTotal = useMemo(() => conflictDates.size, [conflictDates]);

  const EventRow = ({ ev }: { ev: CalEvent }) => {
    const isConflict = ev.icon === 'audit' && conflictDates.has(ev.id);
    const color = isConflict ? CONFLICT_COLOR : ev.color;
    return (
      <div
        className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm', color, ev.icon === 'audit' && 'cursor-pointer hover:opacity-80')}
        onClick={() => ev.icon === 'audit' && setReschedule(ev)}
      >
        {ev.icon === 'ot'    && <Wrench size={14} className="shrink-0" />}
        {ev.icon === 'plan'  && <Calendar size={14} className="shrink-0" />}
        {ev.icon === 'audit' && <ClipboardCheck size={14} className="shrink-0" />}
        <span className="font-medium flex-1">{ev.title}</span>
        {isConflict && <span title="Conflicto de auditor"><AlertTriangle size={12} className="shrink-0 text-red-500" /></span>}
        {ev.icon === 'audit' && <span className="text-xs opacity-70">{ev.auditorName}</span>}
        <span className="ml-auto text-xs opacity-60">
          {ev.icon === 'ot' ? 'OT' : ev.icon === 'plan' ? 'Plan' : ev.status === 'IN_PROGRESS' ? 'En Curso' : 'Prog.'}
        </span>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Calendario de Actividades</h1>
          <p className="text-muted-foreground text-sm">OTs, planes de mantenimiento y auditorías programadas</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Alerta de conflictos */}
          {auditConflictsTotal > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
              <AlertTriangle size={12} />
              {auditConflictsTotal / 2} conflicto{auditConflictsTotal / 2 !== 1 ? 's' : ''} de auditor
            </div>
          )}

          {/* Leyenda */}
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="flex items-center gap-1"><Wrench size={12} className="text-amber-500" /> OT</span>
            <span className="flex items-center gap-1"><Calendar size={12} className="text-blue-500" /> Plan Mtto</span>
            <span className="flex items-center gap-1"><ClipboardCheck size={12} className="text-purple-500" /> Auditoría</span>
            {loadingAudits && <span className="text-muted-foreground">Cargando auditorías…</span>}
          </div>

          {/* Botones de vista */}
          <div className="flex items-center gap-1 border rounded-lg overflow-hidden">
            {(['day', 'week', 'month', 'range'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => { setViewMode(v); setSelected(null); }}
                className={cn('px-3 py-1.5 text-xs font-medium transition-colors', viewMode === v ? 'bg-blue-600 text-white' : 'hover:bg-muted text-muted-foreground')}>
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          {/* Navegación mes */}
          {viewMode === 'month' && (
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="p-1.5 border rounded-lg hover:bg-muted transition-colors"><ChevronLeft size={16} /></button>
              <span className="px-3 text-sm font-medium min-w-36 text-center">{MONTHS[current.getMonth()]} {current.getFullYear()}</span>
              <button onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="p-1.5 border rounded-lg hover:bg-muted transition-colors"><ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      </div>

      {/* ── Rango personalizado ── */}
      {viewMode === 'range' && (
        <div className="flex items-center gap-3 p-3 bg-card border rounded-xl flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">Rango:</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Desde</label>
            <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} className="text-sm border rounded-lg px-3 py-1.5 focus:outline-none bg-background" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Hasta</label>
            <input type="date" value={rangeTo} min={rangeFrom} onChange={e => setRangeTo(e.target.value)} className="text-sm border rounded-lg px-3 py-1.5 focus:outline-none bg-background" />
          </div>
          {rangeFrom && rangeTo && <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{filteredEvents.length} evento{filteredEvents.length !== 1 ? 's' : ''}</span>}
        </div>
      )}

      {/* ── Vista: Hoy ── */}
      {viewMode === 'day' && (
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">{today.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
          {filteredEvents.length === 0
            ? <p className="text-muted-foreground text-sm py-6 text-center">Sin actividades hoy.</p>
            : filteredEvents.map(ev => <EventRow key={ev.id} ev={ev} />)}
        </div>
      )}

      {/* ── Vista: Semana ── */}
      {viewMode === 'week' && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-medium">Semana del {weekDays[0].toLocaleDateString('es', { day: 'numeric', month: 'short' })} al {weekDays[6].toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
          <div className="grid grid-cols-7 divide-x">
            {weekDays.map(day => {
              const dayEvents = eventsForDay(day);
              const hasConflict = hasConflictOnDay(day);
              return (
                <div key={day.toISOString()} onClick={() => setSelected(selected && sameDay(selected, day) ? null : day)}
                  className={cn('p-2 min-h-32 cursor-pointer hover:bg-muted/30 transition-colors', isToday(day) && 'bg-blue-50/50', selected && sameDay(selected, day) && 'ring-2 ring-inset ring-blue-500')}>
                  <div className={cn('text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full mb-1.5 mx-auto', isToday(day) ? 'bg-blue-600 text-white' : 'text-foreground')}>{day.getDate()}</div>
                  <p className="text-[10px] text-muted-foreground text-center mb-1">{DAYS[day.getDay()]}</p>
                  {hasConflict && <div className="text-[10px] text-red-500 text-center mb-1 font-semibold">⚠ conflicto</div>}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => (
                      <div key={ev.id} className={cn('text-xs px-1 py-0.5 rounded truncate flex items-center gap-1', conflictDates.has(ev.id) ? CONFLICT_COLOR : ev.color)}>
                        {ev.icon === 'ot' ? <Wrench size={8} className="shrink-0" /> : ev.icon === 'audit' ? <ClipboardCheck size={8} className="shrink-0" /> : <Calendar size={8} className="shrink-0" />}
                        <span className="truncate">{ev.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && <p className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} más</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Vista: Mes ── */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border">
          {DAYS.map(d => <div key={d} className="bg-muted/50 text-center text-xs font-medium text-muted-foreground py-2">{d}</div>)}
          {cells.map((date, i) => {
            if (!date) return <div key={i} className="bg-background min-h-24" />;
            const dayEvents = eventsForDay(date);
            const sel = selected && date.toDateString() === selected.toDateString();
            const hasConflict = hasConflictOnDay(date);
            return (
              <div key={i} onClick={() => setSelected(sel ? null : date)}
                className={cn('bg-background min-h-24 p-1.5 cursor-pointer hover:bg-muted/30 transition-colors', sel && 'ring-2 ring-inset ring-blue-500', !inRange(date) && 'opacity-30')}>
                <div className={cn('text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1', isToday(date) ? 'bg-blue-600 text-white' : 'text-foreground')}>{date.getDate()}</div>
                {hasConflict && <div className="text-[9px] text-red-500 font-bold mb-0.5">⚠</div>}
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 2).map(ev => (
                    <div key={ev.id} className={cn('text-xs px-1 py-0.5 rounded truncate flex items-center gap-1', conflictDates.has(ev.id) ? CONFLICT_COLOR : ev.color)}>
                      {ev.icon === 'ot' ? <Wrench size={9} className="shrink-0" /> : ev.icon === 'audit' ? <ClipboardCheck size={9} className="shrink-0" /> : <Calendar size={9} className="shrink-0" />}
                      <span className="truncate">{ev.title}</span>
                    </div>
                  ))}
                  {dayEvents.length > 2 && <p className="text-xs text-muted-foreground pl-1">+{dayEvents.length - 2} más</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Vista: Rango — tabla ── */}
      {viewMode === 'range' && rangeFrom && rangeTo && (
        <div className="bg-card border rounded-xl overflow-hidden">
          {filteredEvents.length === 0
            ? <p className="text-muted-foreground text-sm p-6 text-center">Sin actividades en este rango de fechas.</p>
            : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>{['Fecha', 'Evento', 'Tipo', 'Auditor'].map(h => <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-2 uppercase tracking-wide">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filteredEvents.sort((a, b) => a.date.getTime() - b.date.getTime()).map((ev, i) => (
                    <tr key={ev.id} className={cn('border-t', i % 2 === 0 ? 'bg-background' : 'bg-muted/20', conflictDates.has(ev.id) && 'bg-red-50')}>
                      <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{ev.date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                      <td className="px-4 py-2 font-medium">{ev.title}{conflictDates.has(ev.id) && <span className="ml-2 text-xs text-red-500 font-bold">⚠ Conflicto</span>}</td>
                      <td className="px-4 py-2">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full flex items-center gap-1 w-fit', conflictDates.has(ev.id) ? CONFLICT_COLOR : ev.color)}>
                          {ev.icon === 'ot' ? <Wrench size={9} /> : ev.icon === 'audit' ? <ClipboardCheck size={9} /> : <Calendar size={9} />}
                          {ev.icon === 'ot' ? 'OT' : ev.icon === 'audit' ? 'Auditoría' : 'Plan'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{ev.auditorName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}

      {/* ── Panel detalle día ── */}
      {selected && (viewMode === 'month' || viewMode === 'week') && (
        <div className="bg-card border rounded-xl p-4 space-y-2">
          <h3 className="font-semibold text-sm">
            {selected.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
            <span className="text-muted-foreground font-normal ml-2">({selectedEvents.length} actividad{selectedEvents.length !== 1 ? 'es' : ''})</span>
          </h3>
          {hasConflictOnDay(selected) && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <AlertTriangle size={13} />
              Conflicto detectado: el mismo auditor tiene más de una auditoría este día. Haz clic en una auditoría para reprogramarla.
            </div>
          )}
          {selectedEvents.length === 0
            ? <p className="text-muted-foreground text-sm">Sin actividades este día.</p>
            : selectedEvents.map(ev => <EventRow key={ev.id} ev={ev} />)}
        </div>
      )}

      {/* Sin fechas en rango */}
      {viewMode === 'range' && (!rangeFrom || !rangeTo) && (
        <div className="bg-muted/30 border border-dashed rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">Selecciona el rango de fechas para ver las actividades.</p>
        </div>
      )}

      {viewMode !== 'range' && (
        <p className="text-xs text-muted-foreground">
          {filteredEvents.length} evento{filteredEvents.length !== 1 ? 's' : ''} · {filteredEvents.filter(e => e.icon === 'audit').length} auditoría{filteredEvents.filter(e => e.icon === 'audit').length !== 1 ? 's' : ''}
          {' '}({isoDate(rangeStart ?? today)}{viewMode !== 'day' ? ` → ${isoDate(rangeEnd ?? today)}` : ''})
        </p>
      )}

      {/* ── Modal de reprogramación ── */}
      {reschedule && (
        <RescheduleModal
          event={reschedule}
          onClose={() => setReschedule(null)}
          onSaved={loadAudits}
        />
      )}
    </div>
  );
}
