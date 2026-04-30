import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, AlertTriangle, Clock, RefreshCw, History, X } from 'lucide-react';
import { api } from '@/services/api';
import { AuditCalendarEvent, AuditRescheduleLog } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  DRAFT:       { bg: '#f0f4ff', text: '#3b5bdb', border: '#3b5bdb' },
  IN_PROGRESS: { bg: '#fff9e6', text: '#d48806', border: '#d48806' },
  COMPLETED:   { bg: '#f0fff4', text: '#276749', border: '#38a169' },
  CLOSED:      { bg: '#f5f5f5', text: '#718096', border: '#a0aec0' },
  CANCELLED:   { bg: '#fff5f5', text: '#c53030', border: '#fc8181' },
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', IN_PROGRESS: 'En Curso', COMPLETED: 'Completada',
  CLOSED: 'Cerrada', CANCELLED: 'Cancelada',
};

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function fmt(d: Date) {
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── RescheduleModal ─────────────────────────────────────────────────────────

interface RescheduleModalProps {
  audit: AuditCalendarEvent;
  targetDate: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}

function RescheduleModal({ audit, targetDate, onClose, onConfirm, loading }: RescheduleModalProps) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-base font-semibold text-gray-900">Reprogramar auditoría</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-blue-900">{audit.title}</p>
            <p className="text-blue-700 mt-1">
              {fmt(new Date(audit.scheduledAt))} → {fmt(new Date(targetDate))}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo de reprogramación <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Indique el motivo (mínimo 5 caracteres)..."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 p-5 pt-0 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={reason.trim().length < 5 || loading}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
            style={{ background: '#3b5bdb' }}
          >
            {loading ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── HistoryModal ────────────────────────────────────────────────────────────

interface HistoryModalProps {
  audit: AuditCalendarEvent;
  logs: AuditRescheduleLog[];
  onClose: () => void;
}

function HistoryModal({ audit, logs, onClose }: HistoryModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Historial de reprogramaciones</h2>
            <p className="text-xs text-gray-500 mt-0.5">{audit.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 max-h-80 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Sin reprogramaciones registradas</p>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <span className="line-through">{fmt(new Date(log.oldDate))}</span>
                    <span>→</span>
                    <span className="font-medium text-gray-900">{fmt(new Date(log.newDate))}</span>
                  </div>
                  <p className="text-gray-700 italic">"{log.reason}"</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {log.changedBy.name} · {new Date(log.createdAt).toLocaleDateString('es-MX')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-5 pt-0 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EventCard (draggable) ────────────────────────────────────────────────────

interface EventCardProps {
  event: AuditCalendarEvent;
  onDragStart: (event: AuditCalendarEvent) => void;
  onHistoryClick: (event: AuditCalendarEvent) => void;
}

function EventCard({ event, onDragStart, onHistoryClick }: EventCardProps) {
  const navigate = useNavigate();
  const color = STATUS_COLORS[event.status] ?? STATUS_COLORS.DRAFT;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(event)}
      onClick={() => navigate(`/audits/${event.id}`)}
      className="group rounded text-xs px-1.5 py-1 cursor-grab active:cursor-grabbing select-none mb-0.5 relative"
      style={{
        background: color.bg,
        color: color.text,
        borderLeft: `3px solid ${color.border}`,
        border: event.hasConflict ? `1px solid #e53e3e` : undefined,
        borderLeftWidth: 3,
      }}
      title={`${event.title} — ${STATUS_LABELS[event.status]}`}
    >
      <div className="flex items-center gap-1 min-w-0">
        {event.hasConflict && <AlertTriangle size={10} className="shrink-0 text-red-500" />}
        <span className="truncate font-medium">{event.title}</span>
      </div>
      <div className="flex items-center gap-1 opacity-70 mt-0.5">
        <Clock size={9} />
        <span>{new Date(event.scheduledAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="ml-auto">{event.auditor.name.split(' ')[0]}</span>
      </div>
      <button
        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => { e.stopPropagation(); onHistoryClick(event); }}
        title="Ver historial"
      >
        <History size={10} />
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AuditCalendarPage() {
  const [currentDate, setCurrentDate]                   = useState(new Date());
  const [events, setEvents]                             = useState<AuditCalendarEvent[]>([]);
  const [loading, setLoading]                           = useState(true);
  const [dragging, setDragging]                         = useState<AuditCalendarEvent | null>(null);
  const [dropTarget, setDropTarget]                     = useState<string | null>(null);
  const [rescheduleModal, setRescheduleModal]           = useState<{ audit: AuditCalendarEvent; date: string } | null>(null);
  const [rescheduleLoading, setRescheduleLoading]       = useState(false);
  const [historyModal, setHistoryModal]                 = useState<AuditCalendarEvent | null>(null);
  const [historyLogs, setHistoryLogs]                   = useState<AuditRescheduleLog[]>([]);
  const [filterStatus, setFilterStatus]                 = useState<string>('');
  const [filterAuditor, setFilterAuditor]               = useState<string>('');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      // Expand range by one week to show events at edges
      start.setDate(start.getDate() - 7);
      end.setDate(end.getDate() + 7);
      const { data } = await api.get<AuditCalendarEvent[]>('/audits/calendar', {
        params: { from: start.toISOString(), to: end.toISOString() },
      });
      setEvents(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // ── Calendar grid ──────────────────────────────────────────────────────────

  const firstDay = startOfMonth(currentDate);
  const lastDay = endOfMonth(currentDate);
  const startPad = firstDay.getDay(); // day of week (0=Sun)

  const cells: Date[] = [];
  for (let i = 0; i < startPad; i++) {
    const d = new Date(firstDay);
    d.setDate(d.getDate() - (startPad - i));
    cells.push(d);
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    cells.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const d = new Date(last);
    d.setDate(d.getDate() + 1);
    cells.push(d);
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  const auditors = [...new Map(events.map(e => [e.auditor.id, e.auditor])).values()];

  const filteredEvents = events.filter(e => {
    if (filterStatus && e.status !== filterStatus) return false;
    if (filterAuditor && e.auditor.id !== filterAuditor) return false;
    return true;
  });

  const eventsForDay = (day: Date) =>
    filteredEvents.filter(e => isSameDay(new Date(e.scheduledAt), day));

  // ── Conflict count ─────────────────────────────────────────────────────────

  const conflictsCount = filteredEvents.filter(e => e.hasConflict).length;

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  function onDragStart(ev: AuditCalendarEvent) {
    setDragging(ev);
  }

  function onDragOver(e: React.DragEvent, dateStr: string) {
    e.preventDefault();
    setDropTarget(dateStr);
  }

  function onDragLeave() {
    setDropTarget(null);
  }

  function onDrop(e: React.DragEvent, day: Date) {
    e.preventDefault();
    setDropTarget(null);
    if (!dragging) return;
    const orig = new Date(dragging.scheduledAt);
    if (isSameDay(orig, day)) { setDragging(null); return; }

    // Build target ISO preserving original time
    const target = new Date(day);
    target.setHours(orig.getHours(), orig.getMinutes(), orig.getSeconds());

    setRescheduleModal({ audit: dragging, date: target.toISOString() });
    setDragging(null);
  }

  async function confirmReschedule(reason: string) {
    if (!rescheduleModal) return;
    setRescheduleLoading(true);
    try {
      await api.patch(`/audits/${rescheduleModal.audit.id}/reschedule`, {
        scheduledAt: rescheduleModal.date,
        reason,
      });
      setRescheduleModal(null);
      fetchEvents();
    } catch {
      /* silent */
    } finally {
      setRescheduleLoading(false);
    }
  }

  async function openHistory(ev: AuditCalendarEvent) {
    setHistoryModal(ev);
    try {
      const { data } = await api.get<AuditRescheduleLog[]>(`/audits/${ev.id}/reschedule-history`);
      setHistoryLogs(data);
    } catch {
      setHistoryLogs([]);
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function prevMonth() {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  const today = new Date();

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={20} style={{ color: '#3b5bdb' }} />
          <span className="text-lg font-bold text-gray-900">Calendario de Auditorías</span>
        </div>

        {/* Nav */}
        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-gray-800 min-w-[130px] text-center">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={goToday}
            className="ml-1 px-3 py-1.5 text-xs font-medium border rounded-lg hover:bg-gray-50 text-gray-600"
          >
            Hoy
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none"
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filterAuditor}
            onChange={e => setFilterAuditor(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none"
          >
            <option value="">Todos los auditores</option>
            {auditors.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button
            onClick={fetchEvents}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            title="Actualizar"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Conflict banner */}
      {conflictsCount > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-500" />
          <span className="text-xs text-red-700 font-medium">
            {conflictsCount} auditoría{conflictsCount > 1 ? 's' : ''} con conflicto de auditor (mismo auditor, misma fecha)
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white border-b px-6 py-2 flex items-center gap-4 flex-wrap">
        {Object.entries(STATUS_LABELS).map(([k, v]) => {
          const c = STATUS_COLORS[k];
          return (
            <div key={k} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: c.bg, borderLeft: `3px solid ${c.border}` }}
              />
              <span className="text-xs text-gray-600">{v}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 ml-auto">
          <AlertTriangle size={10} className="text-red-500" />
          <span className="text-xs text-gray-500">Conflicto</span>
          <span className="text-xs text-gray-400 ml-2">· Arrastra para reprogramar</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7 gap-1" style={{ minHeight: 'calc(100% - 28px)' }}>
          {cells.map((day, idx) => {
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = isSameDay(day, today);
            const dateStr = day.toISOString().slice(0, 10);
            const dayEvents = eventsForDay(day);
            const isDropTarget = dropTarget === dateStr && dragging !== null;

            return (
              <div
                key={idx}
                onDragOver={e => onDragOver(e, dateStr)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, day)}
                className="rounded-lg border min-h-[90px] p-1 transition-colors"
                style={{
                  background: isDropTarget ? '#eef2ff' : isToday ? '#f0f7ff' : isCurrentMonth ? '#fff' : '#fafafa',
                  borderColor: isDropTarget ? '#3b5bdb' : isToday ? '#93c5fd' : '#e5e7eb',
                  opacity: isCurrentMonth ? 1 : 0.5,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-xs font-medium leading-none"
                    style={{
                      color: isToday ? '#fff' : isCurrentMonth ? '#374151' : '#9ca3af',
                      background: isToday ? '#3b5bdb' : undefined,
                      borderRadius: isToday ? '50%' : undefined,
                      width: isToday ? 20 : undefined,
                      height: isToday ? 20 : undefined,
                      display: isToday ? 'flex' : undefined,
                      alignItems: isToday ? 'center' : undefined,
                      justifyContent: isToday ? 'center' : undefined,
                    }}
                  >
                    {day.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] text-gray-400">{dayEvents.length}</span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.map(ev => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      onDragStart={onDragStart}
                      onHistoryClick={openHistory}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {rescheduleModal && (
        <RescheduleModal
          audit={rescheduleModal.audit}
          targetDate={rescheduleModal.date}
          onClose={() => setRescheduleModal(null)}
          onConfirm={confirmReschedule}
          loading={rescheduleLoading}
        />
      )}
      {historyModal && (
        <HistoryModal
          audit={historyModal}
          logs={historyLogs}
          onClose={() => { setHistoryModal(null); setHistoryLogs([]); }}
        />
      )}
    </div>
  );
}
