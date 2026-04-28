import { useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Wrench, ClipboardList } from 'lucide-react';
import { api } from '@/services/api';
import { WorkOrder } from '@/types';
import { cn } from '@/lib/utils';

interface Plan { id: string; name: string; nextDue: string; type: string; asset: { name: string } }
interface CalEvent { id: string; title: string; date: Date; color: string; icon: 'ot' | 'plan'; priority?: string }

type ViewMode = 'month' | 'week' | 'day' | 'range';

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-emerald-100 text-emerald-800', MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-orange-100 text-orange-700',  CRITICAL: 'bg-red-100 text-red-800',
};
const PLAN_COLOR = 'bg-blue-100 text-blue-800';
const DAYS  = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [allEvents, setAllEvents] = useState<CalEvent[]>([]);
  const [selected, setSelected]   = useState<Date | null>(null);
  const [viewMode, setViewMode]   = useState<ViewMode>('month');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo]     = useState('');

  const fetchData = useCallback(async () => {
    const [otsRes, plansRes] = await Promise.all([
      api.get<{ data: WorkOrder[] }>('/work-orders', { params: { limit: 500 } }),
      api.get<Plan[]>('/maintenance-plans', { params: { active: 'true' } }),
    ]);

    const otEvents: CalEvent[] = otsRes.data.data
      .filter((o) => o.scheduledAt)
      .map((o) => ({
        id: o.id, title: o.title, date: new Date(o.scheduledAt!),
        color: PRIORITY_COLORS[o.priority] ?? PRIORITY_COLORS.MEDIUM,
        icon: 'ot', priority: o.priority,
      }));

    const planEvents: CalEvent[] = plansRes.data
      .filter((p) => p.nextDue)
      .map((p) => ({
        id: p.id, title: `${p.asset.name} — ${p.name}`,
        date: new Date(p.nextDue), color: PLAN_COLOR, icon: 'plan',
      }));

    setAllEvents([...otEvents, ...planEvents]);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Rangos según modo de vista ─────────────────────────────────
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (viewMode === 'day') {
      const d = startOfDay(today);
      return { rangeStart: d, rangeEnd: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59) };
    }
    if (viewMode === 'week') {
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const start = startOfDay(monday);
      const end   = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59);
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
      return {
        rangeStart: new Date(fy, fm - 1, fd),
        rangeEnd:   new Date(ty, tm - 1, td, 23, 59, 59),
      };
    }
    return { rangeStart: null, rangeEnd: null };
  }, [viewMode, current, today, rangeFrom, rangeTo]);

  // Filtrar eventos al rango activo
  const filteredEvents = useMemo(() => {
    if (!rangeStart || !rangeEnd) return allEvents;
    return allEvents.filter((e) => e.date >= rangeStart && e.date <= rangeEnd);
  }, [allEvents, rangeStart, rangeEnd]);

  const eventsForDay = (date: Date) => filteredEvents.filter((e) => sameDay(e.date, date));
  const selectedEvents = selected ? eventsForDay(selected) : [];
  const isToday = (date: Date) => sameDay(date, today);
  const inRange  = (date: Date) => !rangeStart || !rangeEnd || (date >= rangeStart && date <= rangeEnd);

  // ── Celdas del mes ─────────────────────────────────────────────
  const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
  const firstDay    = new Date(current.getFullYear(), current.getMonth(), 1).getDay();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : new Date(current.getFullYear(), current.getMonth(), i - firstDay + 1)
  );

  // ── Días de la semana actual ────────────────────────────────────
  const weekDays = useMemo(() => {
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i); return d;
    });
  }, [today]);

  const VIEW_LABELS: Record<ViewMode, string> = { month: 'Mes', week: 'Semana', day: 'Hoy', range: 'Rango' };

  return (
    <div className="p-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Calendario de Actividades</h1>
          <p className="text-muted-foreground text-sm">Ordenes de trabajo y vencimientos de planes</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Leyenda */}
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1"><ClipboardList size={12} className="text-amber-500" /> OT programada</span>
            <span className="flex items-center gap-1"><Calendar size={12} className="text-blue-500" /> Plan de Mtto</span>
          </div>

          {/* Botones de vista */}
          <div className="flex items-center gap-1 border rounded-lg overflow-hidden">
            {(['day', 'week', 'month', 'range'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => { setViewMode(v); setSelected(null); }}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  viewMode === v ? 'bg-blue-600 text-white' : 'hover:bg-muted text-muted-foreground'
                )}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          {/* Navegación mes (solo en vista mes) */}
          {viewMode === 'month' && (
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                className="p-1.5 border rounded-lg hover:bg-muted transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 text-sm font-medium min-w-36 text-center">
                {MONTHS[current.getMonth()]} {current.getFullYear()}
              </span>
              <button onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                className="p-1.5 border rounded-lg hover:bg-muted transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Selector de rango personalizado ── */}
      {viewMode === 'range' && (
        <div className="flex items-center gap-3 p-3 bg-card border rounded-xl flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">Rango:</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Desde</label>
            <input
              type="date"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
              className="text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Hasta</label>
            <input
              type="date"
              value={rangeTo}
              min={rangeFrom}
              onChange={(e) => setRangeTo(e.target.value)}
              className="text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
            />
          </div>
          {rangeFrom && rangeTo && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {filteredEvents.length} evento{filteredEvents.length !== 1 ? 's' : ''} en el rango
            </span>
          )}
        </div>
      )}

      {/* ── Vista: Hoy ── */}
      {viewMode === 'day' && (
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">
            {today.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h3>
          {filteredEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">Sin actividades hoy.</p>
          ) : filteredEvents.map((ev) => (
            <div key={ev.id} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm', ev.color)}>
              {ev.icon === 'ot' ? <Wrench size={14} className="shrink-0" /> : <Calendar size={14} className="shrink-0" />}
              <span className="font-medium">{ev.title}</span>
              <span className="ml-auto text-xs opacity-70">{ev.icon === 'ot' ? 'OT' : 'Plan'}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Vista: Semana ── */}
      {viewMode === 'week' && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-medium">
              Semana del {weekDays[0].toLocaleDateString('es', { day: 'numeric', month: 'short' })} al{' '}
              {weekDays[6].toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="grid grid-cols-7 divide-x">
            {weekDays.map((day) => {
              const dayEvents = eventsForDay(day);
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelected(selected && sameDay(selected, day) ? null : day)}
                  className={cn(
                    'p-2 min-h-32 cursor-pointer hover:bg-muted/30 transition-colors',
                    isToday(day) && 'bg-blue-50/50',
                    selected && sameDay(selected, day) && 'ring-2 ring-inset ring-blue-500',
                  )}
                >
                  <div className={cn(
                    'text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full mb-1.5 mx-auto',
                    isToday(day) ? 'bg-blue-600 text-white' : 'text-foreground'
                  )}>
                    {day.getDate()}
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center mb-1">
                    {DAYS[day.getDay()]}
                  </p>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div key={ev.id} className={cn('text-xs px-1 py-0.5 rounded truncate flex items-center gap-1', ev.color)}>
                        {ev.icon === 'ot' ? <Wrench size={8} className="shrink-0" /> : <Calendar size={8} className="shrink-0" />}
                        <span className="truncate">{ev.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} más</p>
                    )}
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
          {DAYS.map((d) => (
            <div key={d} className="bg-muted/50 text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={i} className="bg-background min-h-24" />;
            const dayEvents = eventsForDay(date);
            const sel = selected && date.toDateString() === selected.toDateString();
            const faded = !inRange(date);
            return (
              <div
                key={i}
                onClick={() => setSelected(sel ? null : date)}
                className={cn(
                  'bg-background min-h-24 p-1.5 cursor-pointer hover:bg-muted/30 transition-colors',
                  sel && 'ring-2 ring-inset ring-blue-500',
                  faded && 'opacity-30',
                )}
              >
                <div className={cn(
                  'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1',
                  isToday(date) ? 'bg-blue-600 text-white' : 'text-foreground'
                )}>
                  {date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div key={ev.id} className={cn('text-xs px-1 py-0.5 rounded truncate flex items-center gap-1', ev.color)}>
                      {ev.icon === 'ot' ? <Wrench size={9} className="shrink-0" /> : <Calendar size={9} className="shrink-0" />}
                      <span className="truncate">{ev.title}</span>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <p className="text-xs text-muted-foreground pl-1">+{dayEvents.length - 3} mas</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Vista: Rango — lista de eventos ── */}
      {viewMode === 'range' && rangeFrom && rangeTo && (
        <div className="bg-card border rounded-xl overflow-hidden">
          {filteredEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm p-6 text-center">Sin actividades en este rango de fechas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Fecha', 'Evento', 'Tipo'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-2 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEvents
                  .sort((a, b) => a.date.getTime() - b.date.getTime())
                  .map((ev, i) => (
                    <tr key={ev.id} className={cn('border-t', i % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
                      <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {ev.date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-4 py-2 font-medium">{ev.title}</td>
                      <td className="px-4 py-2">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full flex items-center gap-1 w-fit', ev.color)}>
                          {ev.icon === 'ot' ? <Wrench size={9} /> : <Calendar size={9} />}
                          {ev.icon === 'ot' ? 'OT' : 'Plan'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Panel de detalle de día seleccionado (mes/semana) ── */}
      {selected && (viewMode === 'month' || viewMode === 'week') && (
        <div className="bg-card border rounded-xl p-4 space-y-2">
          <h3 className="font-semibold text-sm">
            {selected.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
            <span className="text-muted-foreground font-normal ml-2">
              ({selectedEvents.length} actividad{selectedEvents.length !== 1 ? 'es' : ''})
            </span>
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin actividades este dia.</p>
          ) : selectedEvents.map((ev) => (
            <div key={ev.id} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm', ev.color)}>
              {ev.icon === 'ot' ? <Wrench size={14} className="shrink-0" /> : <Calendar size={14} className="shrink-0" />}
              <span className="font-medium">{ev.title}</span>
              <span className="ml-auto text-xs opacity-70">
                {ev.date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-xs opacity-70">{ev.icon === 'ot' ? 'OT' : 'Plan'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Indicador de rango sin fechas */}
      {viewMode === 'range' && (!rangeFrom || !rangeTo) && (
        <div className="bg-muted/30 border border-dashed rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">Selecciona el rango de fechas para ver las actividades.</p>
        </div>
      )}

      {/* Contador de eventos del período */}
      {viewMode !== 'range' && (
        <p className="text-xs text-muted-foreground">
          {filteredEvents.length} evento{filteredEvents.length !== 1 ? 's' : ''} en {VIEW_LABELS[viewMode] === 'Hoy' ? 'hoy' : `esta ${VIEW_LABELS[viewMode].toLowerCase()}`}
          {' '}({isoDate(rangeStart ?? today)}{viewMode !== 'day' ? ` → ${isoDate(rangeEnd ?? today)}` : ''})
        </p>
      )}
    </div>
  );
}
