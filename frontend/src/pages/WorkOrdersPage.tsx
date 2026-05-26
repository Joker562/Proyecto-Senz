import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { STATUS_MAP, PRI_MAP } from '@/data/mockData';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import CreateWorkOrderModal from '@/components/work-orders/CreateWorkOrderModal';
import type { WorkOrder, PaginatedResponse } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterStatus = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
type FilterPriority = 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const FILTERS: Array<{ key: FilterStatus; label: string }> = [
  { key: 'ALL',         label: 'Todos' },
  { key: 'PENDING',     label: 'Pendiente' },
  { key: 'IN_PROGRESS', label: 'En Progreso' },
  { key: 'ON_HOLD',     label: 'En Espera' },
  { key: 'COMPLETED',   label: 'Completada' },
  { key: 'CANCELLED',   label: 'Cancelada' },
];

const TYPE_LABEL: Record<string, string> = {
  PREVENTIVE: 'Prev', CORRECTIVE: 'Corr', PREDICTIVE: 'Pred', INSPECTION: 'Insp',
};

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkRow() {
  return (
    <tr>
      {[120, 200, 150, 100, 110, 70, 80, 90].map((w, i) => (
        <td key={i} style={{ padding: '10px 14px' }}>
          <div className="sz-skeleton" style={{ height: 14, width: w, borderRadius: 3 }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function WorkOrdersPage() {
  const navigate         = useNavigate();
  const { user }         = useAuth();
  const canCreate        = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  const [orders,      setOrders]      = useState<WorkOrder[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [search,      setSearch]      = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatus]     = useState<FilterStatus>('ALL');
  const [prioFilter,   setPrio]       = useState<FilterPriority>('ALL');

  const LIMIT = 20;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (prioFilter   !== 'ALL') params.set('priority', prioFilter);
      // search by title not supported natively — fetch and filter client-side if needed
      const { data } = await api.get<PaginatedResponse<WorkOrder>>(`/work-orders?${params}`);
      const rows = data.data ?? [];
      const filtered = search.trim()
        ? rows.filter(o =>
            o.title.toLowerCase().includes(search.toLowerCase()) ||
            o.code.toLowerCase().includes(search.toLowerCase()) ||
            o.asset?.name?.toLowerCase().includes(search.toLowerCase())
          )
        : rows;
      setOrders(filtered);
      setTotal(data.total ?? 0);
    } catch {
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, prioFilter, search]);

  useEffect(() => { load(); }, [load]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [statusFilter, prioFilter, search]);

  const handleSearch = () => setSearch(searchInput.trim());

  const fmtDate = (d?: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const isOverdue = (o: WorkOrder) =>
    o.scheduledAt &&
    new Date(o.scheduledAt) < new Date() &&
    o.status !== 'COMPLETED' &&
    o.status !== 'CANCELLED';

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)', whiteSpace: 'nowrap' }}>
            Órdenes de Trabajo
          </span>
          {!loading && (
            <span style={{ fontSize: 12, color: 'var(--sz-muted)', background: 'var(--sz-bg)', padding: '2px 8px', borderRadius: 12, border: '1px solid var(--sz-border)' }}>
              {total} total
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--sz-border)', borderRadius: 6, overflow: 'hidden', background: 'var(--sz-card)' }}>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar OT, equipo…"
              style={{
                border: 'none', outline: 'none', padding: '6px 10px',
                fontSize: 12, background: 'transparent', color: 'var(--sz-text)',
                fontFamily: 'IBM Plex Sans, sans-serif', width: 180,
              }}
            />
            <button
              onClick={handleSearch}
              style={{ padding: '6px 10px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--sz-muted)' }}
            >
              <Search size={13} />
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', padding: '6px 10px',
              background: 'var(--sz-card)', border: '1px solid var(--sz-border)',
              borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', color: 'var(--sz-muted)',
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>

          {/* Nueva OT — solo ADMIN/SUPERVISOR */}
          {canCreate && (
            <button
              onClick={() => setModalOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--sz-accent)', color: '#fff',
                border: 'none', borderRadius: 6,
                padding: '7px 14px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
              }}
            >
              <Plus size={14} />
              Nueva OT
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 24px' }}>

        {/* ── Filter bar ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--sz-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginRight: 4 }}>Estado:</span>
          {FILTERS.map((f) => {
            const sm = STATUS_MAP[f.key];
            const isActive = statusFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setStatus(f.key)}
                style={{
                  padding: '4px 12px', fontSize: 12, fontWeight: 600,
                  borderRadius: 20, cursor: 'pointer',
                  border: `1px solid ${isActive && sm ? sm.color : 'var(--sz-border)'}`,
                  background: isActive && sm ? sm.bg : 'var(--sz-card)',
                  color: isActive && sm ? sm.color : 'var(--sz-muted)',
                  transition: 'all .15s', fontFamily: 'IBM Plex Sans, sans-serif',
                }}
              >
                {f.label}
              </button>
            );
          })}

          <span style={{ fontSize: 11, color: 'var(--sz-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginLeft: 8, marginRight: 4 }}>Prioridad:</span>
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as FilterPriority[]).map(p => {
            const pm = PRI_MAP[p];
            const isActive = prioFilter === p;
            return (
              <button
                key={p}
                onClick={() => setPrio(p)}
                style={{
                  padding: '4px 12px', fontSize: 12, fontWeight: 600,
                  borderRadius: 20, cursor: 'pointer',
                  border: `1px solid ${isActive && pm ? pm.color : 'var(--sz-border)'}`,
                  background: isActive && pm ? pm.color + '20' : 'var(--sz-card)',
                  color: isActive && pm ? pm.color : 'var(--sz-muted)',
                  transition: 'all .15s', fontFamily: 'IBM Plex Sans, sans-serif',
                }}
              >
                {p === 'ALL' ? 'Todas' : pm?.label ?? p}
              </button>
            );
          })}
        </div>

        {/* ── Table ─────────────────────────────────────────────────────── */}
        <div style={{ background: 'var(--sz-card)', border: '1px solid var(--sz-border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['Código', 'Título', 'Activo', 'Área', 'Técnico', 'Tipo', 'Prioridad', 'Estado', 'Programada'].map((h) => (
                    <th key={h} style={{
                      padding: '9px 14px', textAlign: 'left', fontWeight: 600,
                      color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase',
                      letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkRow key={i} />)
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '40px 0', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>
                      {search ? `Sin resultados para "${search}"` : 'Sin órdenes de trabajo para este filtro.'}
                    </td>
                  </tr>
                ) : orders.map((o, i) => {
                  const sm  = STATUS_MAP[o.status];
                  const pm  = PRI_MAP[o.priority];
                  const ovr = isOverdue(o);
                  return (
                    <tr
                      key={o.id}
                      className="sz-table-row"
                      onClick={() => navigate(`/work-orders/${o.id}`)}
                      style={{
                        borderBottom: '1px solid var(--sz-border)', cursor: 'pointer',
                        background: ovr ? '#fff9f9' : i % 2 === 0 ? 'var(--sz-card)' : '#fafafa',
                        transition: 'background .1s',
                      }}
                    >
                      <td style={{ padding: '9px 14px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {o.code.slice(-8).toUpperCase()}
                      </td>
                      <td style={{ padding: '9px 14px', color: 'var(--sz-text)', maxWidth: 240 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</div>
                      </td>
                      <td style={{ padding: '9px 14px', color: 'var(--sz-muted)', maxWidth: 160 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.asset?.name ?? '—'}</div>
                      </td>
                      <td style={{ padding: '9px 14px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{o.asset?.area ?? '—'}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{o.assignedTo?.name ?? <span style={{ color: '#ccc' }}>Sin asignar</span>}</td>
                      <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--sz-muted)', background: 'var(--sz-bg)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--sz-border)' }}>
                          {TYPE_LABEL[o.type] ?? o.type}
                        </span>
                      </td>
                      <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: pm?.color ?? '#888', fontWeight: 700, fontSize: 11 }}>{pm?.label ?? o.priority}</span>
                      </td>
                      <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                        {sm ? <Badge label={sm.label} color={sm.color} bg={sm.bg} /> : o.status}
                      </td>
                      <td style={{ padding: '9px 14px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: ovr ? '#c0392b' : 'var(--sz-muted)', whiteSpace: 'nowrap' }}>
                        {fmtDate(o.scheduledAt)}
                        {ovr && <span style={{ marginLeft: 4, fontSize: 10, color: '#c0392b', fontWeight: 700 }}>⚠</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ──────────────────────────────────────────────── */}
          {!loading && totalPages > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderTop: '1px solid var(--sz-border)',
              background: '#fafafa',
            }}>
              <span style={{ fontSize: 12, color: 'var(--sz-muted)' }}>
                Página {page} de {totalPages} · {total} órdenes
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '4px 10px',
                    border: '1px solid var(--sz-border)', borderRadius: 5, cursor: page === 1 ? 'default' : 'pointer',
                    background: 'var(--sz-card)', color: page === 1 ? '#ccc' : 'var(--sz-text)', fontSize: 12,
                  }}
                >
                  <ChevronLeft size={13} /> Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '4px 10px',
                    border: '1px solid var(--sz-border)', borderRadius: 5, cursor: page === totalPages ? 'default' : 'pointer',
                    background: 'var(--sz-card)', color: page === totalPages ? '#ccc' : 'var(--sz-text)', fontSize: 12,
                  }}
                >
                  Siguiente <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateWorkOrderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => { setModalOpen(false); load(); }}
      />

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
