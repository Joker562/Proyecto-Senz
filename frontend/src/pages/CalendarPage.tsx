import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar, Wrench, ClipboardList, AlertTriangle, X } from 'lucide-react';
import { api } from '@/services/api';
import { WorkOrder } from '@/types';
import type { AuditCalendarEvent } from '@/types';
import { cn } from '@/lib/utils';

interface Plan { id: string; name: string; nextDue: string; type: string; asset: { name: string } }
interface CalEvent {
  id: string; title: string; date: Date; color: string;
  icon: 'ot' | 'plan' | 'audit';
  priority?: string;
  auditStatus?: string;
  hasConflict?: boolean;
  auditorName?: string;
  area?: string;
}

type ViewMode = 'month' | 'week' | 'day' | 'range';

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-emerald-100 text-emerald-800', MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-orange-100 text-orange-700',  CRITICAL: 'bg-red-100 text-red-800',
};
const PLAN_COLOR  = 'bg-blue-100 text-blue-800';
const AUDIT_COLOR = 'bg-purple-100 text-purple-800';
const AUDIT_CONFLICT_COLOR = 'bg-red-100 text-red-700';

const DAYS   = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Modal de reprogramación ──────────────────────────────────────────────────
interface RescheduleModalProps {
  auditId: string;
  auditTitle: string;
  newDate: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

function RescheduleModal({ auditTitle, newDate, onClose, onConfirm }: RescheduleModalProps) {
  const [reason, setReason] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, fontFamily: 'IBM Plex Sans, sans-serif' }}>Reprogramar Auditoría</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#555', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            <strong>{auditTitle}</strong> será reprogramada al <strong>{new Date(newDate + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>.
          </p>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4, fontFamily: 'IBM Plex Sans, sans-serif' }}>
              Motivo del cambio *
            </label>
            <textarea
              autoFocus
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Describe el motivo de la reprogramación…"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, fontFamily: 'IBM Plex Sans, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 13 }}>Cancelar</button>
            <button
              onClick={() => reason.trim().length >= 5 && onConfirm(reason)}
              disabled={reason.trim().length < 5}
              style={{ flex: 2, padding: '10px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 13, fontWeight: 600, opacity: reason.trim().length < 5 ? .5 : 1 }}
            >
              Confirmar reprogramación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const navigate  = useNavigate();
  const today = useMemo(() => new Date(), []);
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [allEvents, setAllEvents] = useState<CalEvent[]>([]);
  const [selected, setSelected]   = useState<Date | null>(null);
  const [viewMode, setViewMode]   = useState<ViewMode>('month');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo]     = useState('');
  const [showAudits, setShowAudits]   = useState(true);
  const [showOT, setShowOT]           = useState(true);
  const [showPlans, setShowPlans]     = useState(true);
  const [dragAudit, setDragAudit]     = useState<CalEvent | null>(null);
  const [rescheduleModal, setRescheduleModal] = useState<{ audit: CalEvent; newDate: string } | null>(null);

  const fetchData = useCallback(async () => {
    const [otsRes, plansRes, auditsRes] = await Promise.all([
      api.get<{ data: WorkOrder[] }>('/work-orders', { params: { limit: 500 } }),
      api.get<Plan[]>('/maintenance-plans', { params: { active: 'true' } }),
      api.get<AuditCalendarEvent[]>('/audits/calendar'),
    ]);

    const otEvents: CalEvent[] = otsRes.data.data
      .filter(o => o.scheduledAt)
      .map(o => ({
        id: o.id, title: o.title, date: new Date(o.scheduledAt!),
        color: PRIORITY_COLORS[o.priority] ?? PRIORITY_COLORS.MEDIUM,
        icon: 'ot' as const, priority: o.priority,
      }));

    const planEvents: CalEvent[] = plansRes.data
      .filter(p => p.nextDue)
      .map(p => ({
        id: p.id, title: `${p.asset.name} — ${p.name}`,
        date: new Date(p.nextDue), color: PLAN_COLOR, icon: 'plan' as const,
      }));

    const auditEvents: CalEvent[] = auditsRes.data.map(a => ({
      id: a.id,
      title: `${a.code} · ${a.title}`,
      date: new Date(a.scheduledAt),
      color: a.hasConflict ? AUDIT_CONFLICT_COLOR : AUDIT_COLOR,
      icon: 'audit' as const,
      auditStatus: a.status,
      hasConflict: a.hasConflict,
      auditorName: a.auditor.name,
      area: a.area,
    }));

    setAllEvents([...otEvents, ...planEvents, ...auditEvents]);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
      const end   = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);
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
    let evs = allEvents;
    if (!showAudits) evs = evs.filter(e => e.icon !== 'audit');
    if (!showOT)     evs = evs.filter(e => e.icon !== 'ot');
    if (!showPlans)  evs = evs.filter(e => e.icon !== 'plan');
    if (!rangeStart || !rangeEnd) return evs;
    return evs.filter(e => e.date >= rangeStart && e.date <= rangeEnd);
  }, [allEvents, rangeStart, rangeEnd, showAudits, showOT, showPlans]);

  const eventsForDay  = (date: Date) => filteredEvents.filter(e => sameDay(e.date, date));
  const selectedEvents = selected ? eventsForDay(selected) : [];
  const isToday = (date: Date) => sameDay(date, today);
  const inRange  = (date: Date) => !rangeStart || !rangeEnd || (date >= rangeStart && date <= rangeEnd);

  const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
  const firstDay    = new Date(current.getFullYear(), current.getMonth(), 1).getDay();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : new Date(current.getFullYear(), current.getMonth(), i - firstDay + 1)
  );

  const weekDays = useMemo(() => {
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i); return d;
    });
  }, [today]);

  const conflictCount = allEvents.filter(e => e.icon === 'audit' && e.hasConflict).length;

  // ── Drag & Drop handlers ──
  const handleDragStart = (ev: React.DragEvent, event: CalEvent) => {
    if (event.icon !== 'audit') return;
    setDragAudit(event);
    ev.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (ev: React.DragEvent, targetDate: Date) => {
    ev.preventDefault();
    if (!dragAudit || sameDay(dragAudit.date, targetDate)) { setDragAudit(null); return; }
    setRescheduleModal({ audit: dragAudit, newDate: isoDate(targetDate) });
    setDragAudit(null);
  };

  const handleConfirmReschedule = async (reason: string) => {
    if (!rescheduleModal) return;
    try {
      await api.patch(`/audits/${rescheduleModal.audit.id}/reschedule`, {
        scheduledAt: new Date(rescheduleModal.newDate + 'T08:00:00').toISOString(),
        reason,
      });
      await fetchData();
      setRescheduleModal(null);
    } catch {
      setRescheduleModal(null);
    }
  };

  const VIEW_LABELS: Record<ViewMode, string> = { month: 'Mes', week: 'Semana', day: 'Hoy', range: 'Rango' };

  const EventChip = ({ ev }: { ev: CalEvent }) => (
    <div
      draggable={ev.icon === 'audit'}
      onDragStart={e => handleDragStart(e, ev)}
      onClick={e => { e.stopPropagation(); if (ev.icon === 'audit') navigate(`/audits/${ev.id}`); }}
      className={cn('text-xs px-1 py-0.5 rounded truncate flex items-center gap-1 cursor-pointer', ev.color)}
      title={ev.hasConflict ? `⚠️ Conflicto de auditor — ${ev.title}` : ev.title}
    >
      {ev.icon === 'ot'    && <Wrench size={9} className="shrink-0" />}
      {ev.icon === 'plan'  && <Calendar size={9} className="shrink-0" />}
      {ev.icon === 'audit' && (ev.hasConflict ? <AlertTriangle size={9} className="shrink-0" /> : <ClipboardList size={9} className="shrink-0" />)}
      <span className="truncate">{ev.title}</span>
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Calendario de Actividades</h1>
          <p className="text-muted-foreground text-sm">OTs, planes de mantenimiento y auditorías programadas</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Leyenda + filtros */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <button onClick={() => setShowOT(v => !v)} className={cn('flex items-center gap-1 px-2 py-1 rounded border transition-opacity', !showOT && 'opacity-40')}>
              <Wrench size={12} className="text-amber-500" /> OT
            </button>
            <button onClick={() => setShowPlans(v => !v)} className={cn('flex items-center gap-1 px-2 py-1 rounded border transition-opacity', !showPlans && 'opacity-40')}>
              <Calendar size={12} className="text-blue-500" /> Plan
            </button>
            <button onClick={() => setShowAudits(v => !v)} className={cn('flex items-center gap-1 px-2 py-1 rounded border transition-opacity', !showAudits && 'opacity-40')}>
              <ClipboardList size={12} className="text-purple-500" /> Auditoría
            </button>
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

          {viewMode === 'month' && (
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="p-1.5 border rounded-lg hover:bg-muted transition-colors"><ChevronLeft size={16} /></button>
              <span className="px-3 text-sm font-medium min-w-36 text-center">{MONTHS[current.getMonth()]} {current.getFullYear()}</span>
              <button onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="p-1.5 border rounded-lg hover:bg-muted transition-colors"><ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      </div>

      {/* Alerta de conflictos */}
      {conflictCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle size={16} className="shrink-0" />
          <span><strong>{conflictCount} auditoría{conflictCount > 1 ? 's' : ''}</strong> con conflicto de auditor (mismo auditor, mismo día). Usa drag & drop para reprogramar.</span>
        </div>
      )}

      {/* Selector de rango */}
      {viewMode === 'range' && (
        <div className="flex items-center gap-3 p-3 bg-card border rounded-xl flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">Rango:</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Desde</label>
            <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} className="text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Hasta</label>
            <input type="date" value={rangeTo} min={rangeFrom} onChange={e => setRangeTo(e.target.value)} className="text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background" />
          </div>
          {rangeFrom && rangeTo && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{filteredEvents.length} evento{filteredEvents.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {/* Vista Hoy */}
      {viewMode === 'day' && (
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">{today.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
          {filteredEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">Sin actividades hoy.</p>
          ) : filteredEvents.map(ev => (
            <div key={ev.id} onClick={() => ev.icon === 'audit' && navigate(`/audits/${ev.id}`)} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer', ev.color)}>
              {ev.icon === 'ot' ? <Wrench size={14} /> : ev.icon === 'plan' ? <Calendar size={14} /> : <ClipboardList size={14} />}
              <span className="font-medium">{ev.title}</span>
              {ev.hasConflict && <AlertTriangle size={12} className="text-red-500 ml-1" />}
              <span className="ml-auto text-xs opacity-70">{ev.icon === 'ot' ? 'OT' : ev.icon === 'plan' ? 'Plan' : 'Auditoría'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Vista Semana */}
      {viewMode === 'week' && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-medium">Semana del {weekDays[0].toLocaleDateString('es', { day: 'numeric', month: 'short' })} al {weekDays[6].toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
          <div className="grid grid-cols-7 divide-x">
            {weekDays.map(day => {
              const dayEvents = eventsForDay(day);
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelected(selected && sameDay(selected, day) ? null : day)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleDrop(e, day)}
                  className={cn('p-2 min-h-32 cursor-pointer hover:bg-muted/30 transition-colors', isToday(day) && 'bg-blue-50/50', selected && sameDay(selected, day) && 'ring-2 ring-inset ring-blue-500')}
                >
                  <div className={cn('text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full mb-1.5 mx-auto', isToday(day) ? 'bg-blue-600 text-white' : 'text-foreground')}>{day.getDate()}</div>
                  <p className="text-[10px] text-muted-foreground text-center mb-1">{DAYS[day.getDay()]}</p>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => <EventChip key={ev.id} ev={ev} />)}
                    {dayEvents.length > 3 && <p className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} más</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vista Mes */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border">
          {DAYS.map(d => <div key={d} className="bg-muted/50 text-center text-xs font-medium text-muted-foreground py-2">{d}</div>)}
          {cells.map((date, i) => {
            if (!date) return <div key={i} className="bg-background min-h-24" />;
            const dayEvents = eventsForDay(date);
            const sel   = selected && date.toDateString() === selected.toDateString();
            const faded = !inRange(date);
            const hasAuditConflict = dayEvents.some(e => e.hasConflict);
            return (
              <div
                key={i}
                onClick={() => setSelected(sel ? null : date)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, date)}
                className={cn('bg-background min-h-24 p-1.5 cursor-pointer hover:bg-muted/30 transition-colors', sel && 'ring-2 ring-inset ring-blue-500', faded && 'opacity-30')}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className={cn('text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full', isToday(date) ? 'bg-blue-600 text-white' : 'text-foreground')}>
                    {date.getDate()}
                  </div>
                  {hasAuditConflict && <AlertTriangle size={10} className="text-red-500" aria-label="Conflicto de auditor" />}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map(ev => <EventChip key={ev.id} ev={ev} />)}
                  {dayEvents.length > 3 && <p className="text-xs text-muted-foreground pl-1">+{dayEvents.length - 3} mas</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vista Rango */}
      {viewMode === 'range' && rangeFrom && rangeTo && (
        <div className="bg-card border rounded-xl overflow-hidden">
          {filteredEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm p-6 text-center">Sin actividades en este rango de fechas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Fecha', 'Evento', 'Tipo', 'Área'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-2 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEvents
                  .sort((a, b) => a.date.getTime() - b.date.getTime())
                  .map((ev, i) => (
                    <tr key={ev.id} onClick={() => ev.icon === 'audit' && navigate(`/audits/${ev.id}`)} className={cn('border-t', i % 2 === 0 ? 'bg-background' : 'bg-muted/20', ev.icon === 'audit' && 'cursor-pointer hover:bg-purple-50')}>
                      <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{ev.date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                      <td className="px-4 py-2 font-medium flex items-center gap-1">
                        {ev.title}
                        {ev.hasConflict && <AlertTriangle size={12} className="text-red-500" />}
                      </td>
                      <td className="px-4 py-2">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full flex items-center gap-1 w-fit', ev.color)}>
                          {ev.icon === 'ot' ? <Wrench size={9} /> : ev.icon === 'plan' ? <Calendar size={9} /> : <ClipboardList size={9} />}
                          {ev.icon === 'ot' ? 'OT' : ev.icon === 'plan' ? 'Plan' : 'Auditoría'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{ev.area ?? '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Panel detalle día seleccionado */}
      {selected && (viewMode === 'month' || viewMode === 'week') && (
        <div className="bg-card border rounded-xl p-4 space-y-2">
          <h3 className="font-semibold text-sm">
            {selected.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
            <span className="text-muted-foreground font-normal ml-2">({selectedEvents.length} actividad{selectedEvents.length !== 1 ? 'es' : ''})</span>
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin actividades este día.</p>
          ) : selectedEvents.map(ev => (
            <div key={ev.id} onClick={() => ev.icon === 'audit' && navigate(`/audits/${ev.id}`)} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm', ev.color, ev.icon === 'audit' && 'cursor-pointer')}>
              {ev.icon === 'ot' ? <Wrench size={14} className="shrink-0" /> : ev.icon === 'plan' ? <Calendar size={14} className="shrink-0" /> : <ClipboardList size={14} className="shrink-0" />}
              <div className="flex-1 min-w-0">
                <span className="font-medium">{ev.title}</span>
                {ev.auditorName && <span className="ml-2 text-xs opacity-70">— {ev.auditorName}</span>}
              </div>
              {ev.hasConflict && <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded">⚠ Conflicto</span>}
              <span className="text-xs opacity-70">{ev.date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'range' && (!rangeFrom || !rangeTo) && (
        <div className="bg-muted/30 border border-dashed rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">Selecciona el rango de fechas para ver las actividades.</p>
        </div>
      )}

      {viewMode !== 'range' && (
        <p className="text-xs text-muted-foreground">
          {filteredEvents.length} evento{filteredEvents.length !== 1 ? 's' : ''} en {VIEW_LABELS[viewMode] === 'Hoy' ? 'hoy' : `esta ${VIEW_LABELS[viewMode].toLowerCase()}`}
          {' '}({isoDate(rangeStart ?? today)}{viewMode !== 'day' ? ` → ${isoDate(rangeEnd ?? today)}` : ''})
        </p>
      )}

      {/* Modal de reprogramación */}
      {rescheduleModal && (
        <RescheduleModal
          auditId={rescheduleModal.audit.id}
          auditTitle={rescheduleModal.audit.title}
          newDate={rescheduleModal.newDate}
          onClose={() => setRescheduleModal(null)}
          onConfirm={handleConfirmReschedule}
        />
      )}
    </div>
  );
}
