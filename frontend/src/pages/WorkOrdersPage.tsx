import { useEffect, useState, useCallback } from 'react';
import { api } from '@/services/api';
import { WorkOrder, PaginatedResponse, WorkOrderStatus, WorkOrderPriority, Periodicidad } from '@/types';
import { Plus, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { getSocket } from '@/services/socket';
import { useAuth } from '@/hooks/useAuth';
import CreateWorkOrderModal from '@/components/work-orders/CreateWorkOrderModal';
import WorkOrderDetailModal from '@/components/work-orders/WorkOrderDetailModal';
import { useToast } from '@/hooks/useToast';

/* ── Senz palette ── */
const ACCENT  = '#e67e22';
const C_BLUE  = '#2980b9';
const C_GREEN = '#27ae60';
const C_RED   = '#c0392b';
const BORDER  = '#e4e4e4';
const TEXT    = '#1c1c1c';
const MUTED   = '#888';
const TOPBAR  = '#ffffff';
const CARD    = '#ffffff';
const TH_BG   = '#fafafa';
const ROW_ALT = '#fafafa';
const ROW_HOV = '#fff4ec';

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En Progreso', ON_HOLD: 'En Espera',
  COMPLETED: 'Completada', CANCELLED: 'Cancelada',
};
const STATUS_META: Record<WorkOrderStatus, { color: string; bg: string }> = {
  PENDING:     { color: ACCENT,   bg: '#fef3e7' },
  IN_PROGRESS: { color: C_BLUE,   bg: '#e8f4fd' },
  ON_HOLD:     { color: '#8b5cf6', bg: '#f3eeff' },
  COMPLETED:   { color: C_GREEN,  bg: '#e9f7ef' },
  CANCELLED:   { color: '#6b7280', bg: '#f3f4f6' },
};
const PRIORITY_META: Record<string, { color: string }> = {
  LOW: { color: C_GREEN }, MEDIUM: { color: ACCENT }, HIGH: { color: '#f97316' }, CRITICAL: { color: C_RED },
};
const PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica',
};
const PERIODICIDAD_LABELS: Record<Periodicidad, string> = {
  DAILY: 'Diario', WEEKLY: 'Semanal', MONTHLY: 'Mensual', QUARTERLY: 'Trimestral', ANNUAL: 'Anual',
};

const selStyle: React.CSSProperties = {
  padding: '5px 10px', fontSize: 12, border: `1px solid ${BORDER}`,
  background: CARD, color: TEXT, fontFamily: 'IBM Plex Sans, sans-serif',
  borderRadius: 2, outline: 'none',
};

export default function WorkOrdersPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const [orders, setOrders]               = useState<WorkOrder[]>([]);
  const [total, setTotal]                 = useState(0);
  const [totalPages, setTotalPages]       = useState(1);
  const [page, setPage]                   = useState(1);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]       = useState('');
  const [priorityFilter, setPriorityFilter]   = useState('');
  const [areaFilter, setAreaFilter]           = useState('');
  const [periodicidadFilter, setPeriodicidadFilter] = useState('');
  const [areas, setAreas]                     = useState<string[]>([]);
  const [showCreate, setShowCreate]       = useState(false);
  const [detailId, setDetailId]           = useState<string | null>(null);

  const canCreate  = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const isTechnician = user?.role === 'TECHNICIAN';

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter)       params.status       = statusFilter;
      if (priorityFilter)     params.priority     = priorityFilter;
      if (periodicidadFilter) params.periodicidad = periodicidadFilter;
      const { data } = await api.get<PaginatedResponse<WorkOrder>>('/work-orders', { params });
      setOrders(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      // Build unique areas list from returned data
      setAreas((prev) => {
        const combined = new Set([...prev, ...data.data.map((o) => o.asset.area)]);
        return Array.from(combined).sort();
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, periodicidadFilter, page]);

  useEffect(() => {
    fetchOrders();
    const socket = getSocket();
    const handler = () => { push('Orden actualizada', 'info'); fetchOrders(); };
    socket?.on('workOrder:created', handler);
    socket?.on('workOrder:updated', handler);
    return () => { socket?.off('workOrder:created', handler); socket?.off('workOrder:updated', handler); };
  }, [fetchOrders, push]);

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || o.title.toLowerCase().includes(q)
      || o.asset.name.toLowerCase().includes(q)
      || (o.assignedTo?.name ?? '').toLowerCase().includes(q);
    return matchSearch && (!areaFilter || o.asset.area === areaFilter);
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'IBM Plex Sans, sans-serif' }}>

      {/* ── Topbar ── */}
      <div style={{ background: TOPBAR, borderBottom: `1px solid ${BORDER}`, padding: '0 24px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>
          {isTechnician ? 'Mis Tareas' : 'Órdenes de Trabajo'}
        </div>
        <span style={{ fontSize: 12, color: MUTED }}>{total} registro{total !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ background: TOPBAR, borderBottom: `1px solid ${BORDER}`, padding: '10px 24px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, activo o técnico..."
            style={{ ...selStyle, width: 260 }}
          />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={selStyle}>
            <option value="">Todos los estados</option>
            {(Object.keys(STATUS_LABELS) as WorkOrderStatus[]).map((v) => (
              <option key={v} value={v}>{STATUS_LABELS[v]}</option>
            ))}
          </select>
          <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }} style={selStyle}>
            <option value="">Toda prioridad</option>
            {(Object.keys(PRIORITY_LABELS) as WorkOrderPriority[]).map((v) => (
              <option key={v} value={v}>{PRIORITY_LABELS[v]}</option>
            ))}
          </select>
          <select value={areaFilter} onChange={(e) => { setAreaFilter(e.target.value); }} style={selStyle}>
            <option value="">Toda área</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={periodicidadFilter} onChange={(e) => { setPeriodicidadFilter(e.target.value); setPage(1); }} style={selStyle}>
            <option value="">Toda periodicidad</option>
            {(Object.keys(PERIODICIDAD_LABELS) as Periodicidad[]).map((v) => (
              <option key={v} value={v}>{PERIODICIDAD_LABELS[v]}</option>
            ))}
          </select>
          <button onClick={fetchOrders} title="Refrescar" style={{ ...selStyle, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <RefreshCw size={13} />
          </button>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', fontSize: 12, fontWeight: 600,
              background: ACCENT, color: '#fff', border: 'none',
              borderRadius: 2, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
              minHeight: 44,
            }}
          >
            <Plus size={14} /> Nueva OT
          </button>
        )}
      </div>

      {/* ── Table (desktop) ── */}
      <div style={{ padding: '0 24px 24px', display: 'none' }} className="md-table-wrapper">
        {/* rendered below via className trick — using responsive wrapper */}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block" style={{ padding: '16px 24px 24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: CARD, border: `1px solid ${BORDER}` }}>
          <thead>
            <tr style={{ background: TH_BG }}>
              {['ID', 'Título', 'Activo', 'Tipo', 'Periodicidad', 'Prioridad', 'Vencimiento', 'Estado'].map((h) => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: `2px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: MUTED }}>Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: MUTED }}>Sin resultados para los filtros seleccionados.</td></tr>
            ) : filtered.map((order, i) => {
              const est = STATUS_META[order.status];
              const pri = PRIORITY_META[order.priority];
              return (
                <tr
                  key={order.id}
                  onClick={() => setDetailId(order.id)}
                  style={{ borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', background: i % 2 === 0 ? CARD : ROW_ALT }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = ROW_HOV)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? CARD : ROW_ALT)}
                >
                  <td style={{ padding: '9px 12px', color: ACCENT, fontWeight: 700 }}>{order.code.slice(-8).toUpperCase()}</td>
                  <td style={{ padding: '9px 12px', color: TEXT, maxWidth: 220 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>{order.title}</div>
                  </td>
                  <td style={{ padding: '9px 12px', color: MUTED, maxWidth: 160 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{order.asset.name}</div>
                  </td>
                  <td style={{ padding: '9px 12px', color: MUTED }}>{order.type}</td>
                  <td style={{ padding: '9px 12px' }}>
                    {order.periodicidad
                      ? <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 2, fontWeight: 600, fontSize: 11 }}>{PERIODICIDAD_LABELS[order.periodicidad]}</span>
                      : <span style={{ color: MUTED }}>—</span>}
                  </td>
                  <td style={{ padding: '9px 12px', color: pri?.color ?? MUTED, fontWeight: 700 }}>{order.priority}</td>
                  <td style={{ padding: '9px 12px', color: MUTED, whiteSpace: 'nowrap' }}>
                    {order.scheduledAt ? new Date(order.scheduledAt).toLocaleDateString('es', { day: '2-digit', month: 'short' }) : '—'}
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ background: est.bg, color: est.color, padding: '3px 9px', borderRadius: 2, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Cards (mobile) ── */}
      <div className="md:hidden" style={{ padding: '12px 16px 80px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: MUTED, padding: 40 }}>Cargando...</p>
        ) : filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: MUTED, padding: 40 }}>Sin resultados.</p>
        ) : filtered.map((order) => {
          const est = STATUS_META[order.status];
          const pri = PRIORITY_META[order.priority];
          return (
            <div
              key={order.id}
              onClick={() => setDetailId(order.id)}
              style={{ background: CARD, border: `1px solid ${BORDER}`, padding: '12px 14px', cursor: 'pointer', borderLeft: `3px solid ${ACCENT}` }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 13, color: TEXT, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.title}</p>
                  <p style={{ fontSize: 11, color: MUTED, margin: '2px 0 0' }}>{order.asset.name}</p>
                </div>
                <span style={{ background: est.bg, color: est.color, padding: '2px 8px', borderRadius: 2, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ color: pri?.color ?? MUTED, fontWeight: 700, fontSize: 11 }}>{order.priority}</span>
                {order.periodicidad && (
                  <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '1px 6px', borderRadius: 2, fontSize: 11, fontWeight: 600 }}>
                    {PERIODICIDAD_LABELS[order.periodicidad]}
                  </span>
                )}
                {order.scheduledAt && (
                  <span style={{ color: MUTED, fontSize: 11 }}>
                    {new Date(order.scheduledAt).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ padding: '0 24px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: MUTED }}>
          <span>Página {page} de {totalPages}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              style={{ ...selStyle, cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? .4 : 1, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ ...selStyle, cursor: page === totalPages ? 'default' : 'pointer', opacity: page === totalPages ? .4 : 1, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      <CreateWorkOrderModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={fetchOrders} />
      <WorkOrderDetailModal workOrderId={detailId} onClose={() => setDetailId(null)} onUpdated={fetchOrders} />
    </div>
  );
}
