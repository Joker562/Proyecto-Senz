import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Plus, AlertTriangle,
  ClipboardCheck, X, ExternalLink, CalendarDays,
} from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import CreateAuditModal from '@/components/audits/CreateAuditModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditEvent {
  id: string;
  code: string;
  title: string;
  area: string;
  type: string;
  status: string;
  scheduledAt: string;
  date: Date;
  auditorId: string;
  auditorName: string;
  notes?: string | null;
}

type ViewMode = 'month' | 'week' | 'list';

// ── Config ────────────────────────────────────────────────────────────────────

const DAYS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const STATUS_CFG: Record<string, { label: string; chip: string; dot: string }> = {
  DRAFT:       { label: 'Programada',  chip: 'bg-blue-100 text-blue-800',      dot: 'bg-blue-500' },
  IN_PROGRESS: { label: 'En Curso',    chip: 'bg-amber-100 text-amber-800',    dot: 'bg-amber-500' },
  COMPLETED:   { label: 'Completada',  chip: 'bg-emerald-100 text-emerald-800',dot: 'bg-emerald-500' },
  CLOSED:      { label: 'Cerrada',     chip: 'bg-teal-100 text-teal-800',      dot: 'bg-teal-600' },
  CANCELLED:   { label: 'Cancelada',   chip: 'bg-red-100 text-red-800',        dot: 'bg-red-500' },
};

const TYPE_LABELS: Record<string, string> = {
  FIVE_S: '5S', PROCESS: 'Proceso', SAFETY: 'Seguridad',
};

function scfg(status: string) {
  return STATUS_CFG[status] ?? { label: status, chip: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' };
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({ audit, onClose, onReschedule }: {
  audit: AuditEvent;
  onClose: () => void;
  onReschedule: (a: AuditEvent) => void;
}) {
  const navigate = useNavigate();
  const cfg = scfg(audit.status);
  const canReschedule = ['DRAFT', 'IN_PROGRESS'].includes(audit.status);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--sz-card,#fff)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,.2)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardCheck size={20} color="#7c3aed" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--sz-muted,#888)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>{audit.code}</p>
              <h3 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--sz-text,#1c1c1c)', lineHeight: 1.3 }}>{audit.title}</h3>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color="var(--sz-muted,#888)" />
          </button>
        </div>

        {/* Estado badge */}
        <div style={{ marginBottom: 18 }}>
          <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold', cfg.chip)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
            {cfg.label}
          </span>
        </div>

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px', marginBottom: 20 }}>
          {([
            ['Área',             audit.area],
            ['Tipo',             TYPE_LABELS[audit.type] ?? audit.type],
            ['Auditor',          audit.auditorName],
            ['Fecha programada', audit.date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label}>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--sz-muted,#888)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</p>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--sz-text,#1c1c1c)', fontWeight: 500, textTransform: label === 'Fecha programada' ? 'capitalize' : undefined }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Notas */}
        {audit.notes && (
          <div style={{ padding: '10px 14px', background: 'var(--sz-bg,#f9f9f9)', borderRadius: 8, marginBottom: 20, border: '1px solid var(--sz-border,#e4e4e4)' }}>
            <p style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--sz-muted,#888)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px' }}>Notas</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--sz-text)', lineHeight: 1.5 }}>{audit.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          {canReschedule && (
            <button
              onClick={() => { onClose(); onReschedule(audit); }}
              style={{ flex: 1, padding: '9px 16px', fontSize: 12, background: 'var(--sz-bg,#f5f5f5)', border: '1px solid var(--sz-border,#ddd)', borderRadius: 8, cursor: 'pointer', fontWeight: 500, color: 'var(--sz-text,#1c1c1c)' }}
            >
              Reprogramar
            </button>
          )}
          <button
            onClick={() => navigate(`/audits/${audit.id}`)}
            style={{ flex: 2, padding: '9px 16px', fontSize: 12, background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <ExternalLink size={13} />
            Ir al detalle
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reschedule Modal ──────────────────────────────────────────────────────────

function RescheduleModal({ audit, onClose, onSaved }: {
  audit: AuditEvent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [newDate, setNewDate] = useState(toIsoDate(audit.date));
  const [reason, setReason]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!newDate) return;
    setLoading(true);
    try {
      await api.patch(`/audits/${audit.id}/reschedule`, {
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
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--sz-card,#fff)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Reprogramar Auditoría</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>{audit.code} — {audit.area}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>Fecha actual</label>
          <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 8, fontSize: 13, color: '#555', textTransform: 'capitalize' }}>
            {audit.date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>Nueva Fecha *</label>
          <input
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' as const }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>Motivo (opcional)</label>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Ej: Auditor no disponible, área en producción…"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' as const }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button
            onClick={handleSave}
            disabled={loading || !newDate}
            style={{ flex: 1, padding: 10, background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: loading ? .7 : 1 }}
          >
            {loading ? 'Guardando…' : 'Reprogramar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AuditsCalendarPage() {
  const today = useMemo(() => new Date(), []);

  const [current,         setCurrent]         = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [viewMode,        setViewMode]         = useState<ViewMode>('month');
  const [audits,          setAudits]           = useState<AuditEvent[]>([]);
  const [loading,         setLoading]          = useState(true);
  const [createOpen,      setCreateOpen]       = useState(false);
  const [createDate,      setCreateDate]       = useState('');
  const [detailAudit,     setDetailAudit]      = useState<AuditEvent | null>(null);
  const [rescheduleAudit, setRescheduleAudit]  = useState<AuditEvent | null>(null);

  // ── Load audits for visible month ─────────────────────────────────────────────
  const loadAudits = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(current.getFullYear(), current.getMonth(), 1);
      const to   = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);
      const { data } = await api.get<any[]>(
        `/audits?startDate=${from.toISOString()}&endDate=${to.toISOString()}`
      );
      setAudits(
        (Array.isArray(data) ? data : [])
          .filter((a: any) => a.scheduledAt)
          .map((a: any): AuditEvent => ({
            id:          a.id,
            code:        a.code,
            title:       a.title,
            area:        a.area,
            type:        a.type,
            status:      a.status,
            scheduledAt: a.scheduledAt,
            date:        new Date(a.scheduledAt),
            auditorId:   a.auditor?.id   ?? '',
            auditorName: a.auditor?.name ?? '—',
            notes:       a.notes ?? null,
          }))
      );
    } catch (e) {
      console.error('[AuditsCalendar] Error al cargar:', e);
    } finally {
      setLoading(false);
    }
  }, [current]);

  useEffect(() => { loadAudits(); }, [loadAudits]);

  // ── Conflict detection (same auditor, same day, active status) ───────────────
  const conflictIds = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const ev of audits) {
      if (!['DRAFT', 'IN_PROGRESS'].includes(ev.status) || !ev.auditorId) continue;
      const key = `${toIsoDate(ev.date)}:${ev.auditorId}`;
      (map[key] ??= []).push(ev.id);
    }
    const ids = new Set<string>();
    for (const arr of Object.values(map)) {
      if (arr.length > 1) arr.forEach(id => ids.add(id));
    }
    return ids;
  }, [audits]);

  const conflictPairs = Math.floor(conflictIds.size / 2);

  // ── Calendar helpers ──────────────────────────────────────────────────────────
  const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
  const firstDay    = new Date(current.getFullYear(), current.getMonth(), 1).getDay();
  const cells       = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : new Date(current.getFullYear(), current.getMonth(), i - firstDay + 1)
  );

  const weekDays = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(d); x.setDate(d.getDate() + i); return x;
    });
  }, [today]);

  const eventsForDay  = (date: Date) => audits.filter(a => sameDay(a.date, date));
  const isToday       = (date: Date) => sameDay(date, today);
  const dayConflict   = (date: Date) => eventsForDay(date).some(e => conflictIds.has(e.id));

  const handleDayClick = (date: Date) => {
    setCreateDate(toIsoDate(date));
    setCreateOpen(true);
  };

  // ── Sorted list ───────────────────────────────────────────────────────────────
  const sortedAudits = useMemo(
    () => [...audits].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [audits]
  );

  // ── Event chip (shared between month/week) ────────────────────────────────────
  const EventChip = ({ ev, compact = false }: { ev: AuditEvent; compact?: boolean }) => {
    const cfg        = scfg(ev.status);
    const isConflict = conflictIds.has(ev.id);
    return (
      <button
        onClick={e => { e.stopPropagation(); setDetailAudit(ev); }}
        className={cn(
          'w-full text-left rounded truncate flex items-center gap-1 cursor-pointer hover:opacity-75 transition-opacity border-0',
          isConflict ? 'bg-red-100 text-red-800' : cfg.chip,
          compact ? 'text-[10px] px-1 py-0.5' : 'text-xs px-2 py-1'
        )}
      >
        <span className={cn('shrink-0 rounded-full', compact ? 'w-1 h-1' : 'w-1.5 h-1.5', isConflict ? 'bg-red-500' : cfg.dot)} />
        <span className="truncate font-medium">{compact ? ev.code : `${ev.code} — ${ev.area}`}</span>
        {!compact && isConflict && <AlertTriangle size={10} className="shrink-0 ml-auto text-red-500" />}
        {!compact && !isConflict && <span className="shrink-0 ml-auto text-[10px] opacity-60">{ev.auditorName.split(' ')[0]}</span>}
      </button>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Calendario de Auditorías</h1>
          <p className="text-muted-foreground text-sm">
            Planificación y seguimiento del programa de auditorías
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">

          {/* Alerta conflictos */}
          {conflictPairs > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
              <AlertTriangle size={12} />
              {conflictPairs} conflicto{conflictPairs !== 1 ? 's' : ''} de auditor detectado{conflictPairs !== 1 ? 's' : ''}
            </div>
          )}

          {/* Toggle de vista */}
          <div className="flex items-center gap-px border rounded-lg overflow-hidden">
            {(['month', 'week', 'list'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  viewMode === v ? 'bg-violet-600 text-white' : 'hover:bg-muted text-muted-foreground'
                )}
              >
                {{ month: 'Mes', week: 'Semana', list: 'Lista' }[v]}
              </button>
            ))}
          </div>

          {/* Navegación de mes */}
          {viewMode === 'month' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                className="p-1.5 border rounded-lg hover:bg-muted transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrent(new Date(today.getFullYear(), today.getMonth(), 1))}
                className="px-3 py-1.5 text-xs font-medium border rounded-lg hover:bg-muted transition-colors"
              >
                Hoy
              </button>
              <span className="px-2 text-sm font-semibold min-w-44 text-center">
                {MONTHS[current.getMonth()]} {current.getFullYear()}
              </span>
              <button
                onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                className="p-1.5 border rounded-lg hover:bg-muted transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Botón crear */}
          <button
            onClick={() => { setCreateDate(''); setCreateOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 transition-colors"
          >
            <Plus size={15} />
            Programar Auditoría
          </button>
        </div>
      </div>

      {/* Leyenda de estados */}
      <div className="flex items-center gap-5 flex-wrap">
        {Object.values(STATUS_CFG).map(cfg => (
          <span key={cfg.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
            {cfg.label}
          </span>
        ))}
        {loading && (
          <span className="text-xs text-muted-foreground animate-pulse">Cargando auditorías…</span>
        )}
      </div>

      {/* ── Vista Mes ── */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border">
          {DAYS.map(d => (
            <div key={d} className="bg-muted/50 text-center text-xs font-semibold text-muted-foreground py-2">
              {d}
            </div>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={i} className="bg-background min-h-28" />;
            const dayEvs = eventsForDay(date);
            return (
              <div
                key={i}
                onClick={() => handleDayClick(date)}
                className={cn(
                  'bg-background min-h-28 p-1.5 cursor-pointer hover:bg-violet-50/50 transition-colors group',
                  isToday(date) && 'ring-2 ring-inset ring-violet-400'
                )}
              >
                <div className={cn(
                  'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 mx-auto',
                  isToday(date) ? 'bg-violet-600 text-white' : 'text-foreground group-hover:text-violet-700'
                )}>
                  {date.getDate()}
                </div>

                {dayConflict(date) && (
                  <p className="text-[9px] text-red-500 font-bold text-center mb-0.5">⚠ conflicto</p>
                )}

                <div className="space-y-0.5">
                  {dayEvs.slice(0, 3).map(ev => (
                    <EventChip key={ev.id} ev={ev} compact />
                  ))}
                  {dayEvs.length > 3 && (
                    <p className="text-[10px] text-muted-foreground text-center">
                      +{dayEvs.length - 3} más
                    </p>
                  )}
                </div>

                {dayEvs.length === 0 && (
                  <div className="hidden group-hover:flex items-center justify-center mt-2">
                    <span className="text-[10px] text-violet-400 flex items-center gap-0.5">
                      <Plus size={9} /> nueva
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Vista Semana ── */}
      {viewMode === 'week' && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-medium">
              Semana del {weekDays[0].toLocaleDateString('es', { day: 'numeric', month: 'short' })} al {weekDays[6].toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <span className="text-xs text-muted-foreground">
              {audits.filter(a => weekDays.some(d => sameDay(d, a.date))).length} auditorías esta semana
            </span>
          </div>
          <div className="grid grid-cols-7 divide-x">
            {weekDays.map(day => {
              const dayEvs = eventsForDay(day);
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    'p-2 min-h-36 cursor-pointer hover:bg-violet-50/40 transition-colors group',
                    isToday(day) && 'bg-violet-50/30'
                  )}
                >
                  <div className={cn(
                    'text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full mb-0.5 mx-auto',
                    isToday(day) ? 'bg-violet-600 text-white' : 'text-foreground'
                  )}>
                    {day.getDate()}
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center mb-1.5">{DAYS[day.getDay()]}</p>

                  {dayConflict(day) && (
                    <p className="text-[10px] text-red-500 text-center font-bold mb-1">⚠ conflicto</p>
                  )}

                  <div className="space-y-0.5">
                    {dayEvs.slice(0, 4).map(ev => (
                      <EventChip key={ev.id} ev={ev} compact />
                    ))}
                    {dayEvs.length > 4 && (
                      <p className="text-[10px] text-muted-foreground pl-1">+{dayEvs.length - 4} más</p>
                    )}
                  </div>

                  {dayEvs.length === 0 && (
                    <div className="hidden group-hover:flex items-center justify-center mt-2">
                      <span className="text-[10px] text-violet-400 flex items-center gap-0.5">
                        <Plus size={9} /> nueva
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Vista Lista ── */}
      {viewMode === 'list' && (
        <div className="bg-card border rounded-xl overflow-hidden">
          {sortedAudits.length === 0 ? (
            <div className="p-14 text-center space-y-3">
              <CalendarDays size={36} className="mx-auto text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm">Sin auditorías programadas este mes.</p>
              <button
                onClick={() => { setCreateDate(''); setCreateOpen(true); }}
                className="text-xs text-violet-600 hover:underline"
              >
                Programar la primera
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Fecha', 'Código', 'Título / Área', 'Tipo', 'Auditor', 'Estado'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedAudits.map((ev, i) => {
                  const cfg        = scfg(ev.status);
                  const isConflict = conflictIds.has(ev.id);
                  return (
                    <tr
                      key={ev.id}
                      onClick={() => setDetailAudit(ev)}
                      className={cn(
                        'border-t cursor-pointer hover:bg-muted/30 transition-colors',
                        i % 2 === 0 ? 'bg-background' : 'bg-muted/10',
                        isConflict && 'bg-red-50 hover:bg-red-100/60'
                      )}
                    >
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap capitalize">
                        {ev.date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        {ev.code}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium leading-tight">
                          {ev.title}
                          {isConflict && (
                            <span className="ml-2 text-xs text-red-600 font-bold">⚠ Conflicto</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{ev.area}</p>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {TYPE_LABELS[ev.type] ?? ev.type}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                        {ev.auditorName}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap', cfg.chip)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Footer stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span>
          {audits.length} auditoría{audits.length !== 1 ? 's' : ''} en {MONTHS[current.getMonth()]} {current.getFullYear()}
        </span>
        {Object.entries(STATUS_CFG).map(([key, cfg]) => {
          const count = audits.filter(a => a.status === key).length;
          return count > 0 ? (
            <span key={key} className="flex items-center gap-1">
              <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
              {count} {cfg.label.toLowerCase()}
            </span>
          ) : null;
        })}
      </div>

      {/* ── Modals ── */}
      <CreateAuditModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setCreateDate(''); }}
        onCreated={() => { setCreateOpen(false); setCreateDate(''); loadAudits(); }}
        defaultDate={createDate}
      />

      {detailAudit && (
        <DetailModal
          audit={detailAudit}
          onClose={() => setDetailAudit(null)}
          onReschedule={a => { setDetailAudit(null); setRescheduleAudit(a); }}
        />
      )}

      {rescheduleAudit && (
        <RescheduleModal
          audit={rescheduleAudit}
          onClose={() => setRescheduleAudit(null)}
          onSaved={loadAudits}
        />
      )}
    </div>
  );
}
