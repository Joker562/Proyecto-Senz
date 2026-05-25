import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { getSocket } from '@/services/socket';
import { WorkOrder } from '@/types';

const ACCENT  = '#e67e22';
const RED     = '#c0392b';
const BLUE    = '#2980b9';
const BORDER  = '#e4e4e4';
const CARD    = '#ffffff';
const TEXT    = '#1c1c1c';
const MUTED   = '#888';
const ROW_HOV = '#fff4ec';

// ── Tipos ────────────────────────────────────────────────────────────────────
interface WONotif  { kind: 'wo';   id: string; order: WorkOrder; type: 'overdue' | 'urgent' }
interface AppNotif { kind: 'app';  id: string; type: string; message: string; link?: string; read: boolean; createdAt: string }

interface Props {
  iconColor?: string;
  btnBg?: string;
}

const NOTIF_ICON: Record<string, { icon: string; color: string; bg: string }> = {
  AUDIT_ASSIGNED:       { icon: '📋', color: BLUE,  bg: '#e8f4fd' },
  CAPA_ASSIGNED:        { icon: '📌', color: ACCENT, bg: '#fef3e7' },
  AUDIT_REMINDER:       { icon: '🔔', color: ACCENT, bg: '#fef3e7' },
  CAPA_WARNING:         { icon: '⚡', color: ACCENT, bg: '#fef3e7' },
  CAPA_OVERDUE:         { icon: '⚠️', color: RED,    bg: '#fde8e6' },
  AUDIT_LOW_SCORE:      { icon: '📉', color: RED,    bg: '#fde8e6' },
  WORK_ORDER_ASSIGNED:  { icon: '🔧', color: BLUE,  bg: '#e8f4fd' },
};

export default function NotificationBell({ iconColor = MUTED, btnBg = CARD }: Props) {
  const navigate = useNavigate();
  const wrapRef  = useRef<HTMLDivElement>(null);
  const btnRef   = useRef<HTMLButtonElement>(null);

  const [open, setOpen]         = useState(false);
  const [woItems, setWoItems]   = useState<WONotif[]>([]);
  const [appItems, setAppItems] = useState<AppNotif[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [dropPos, setDropPos]   = useState({ top: 0, left: 0 });

  // ── Cargar WO notifications (polling REST) ────────────────────────────────
  useEffect(() => {
    async function loadWO() {
      try {
        const [overdueRes, urgentRes] = await Promise.all([
          api.get<{ data: WorkOrder[] }>('/work-orders', { params: { status: 'PENDING', limit: 50 } }),
          api.get<{ data: WorkOrder[] }>('/work-orders', { params: { priority: 'CRITICAL', limit: 50 } }),
        ]);
        const now = new Date();
        const overdue: WONotif[] = overdueRes.data.data
          .filter((o) => o.scheduledAt && new Date(o.scheduledAt) < now)
          .map((o) => ({ kind: 'wo', id: `wo-${o.id}-overdue`, order: o, type: 'overdue' as const }));
        const urgent: WONotif[] = urgentRes.data.data
          .filter((o) => o.status === 'PENDING' || o.status === 'IN_PROGRESS')
          .map((o) => ({ kind: 'wo', id: `wo-${o.id}-urgent`, order: o, type: 'urgent' as const }));
        const seen = new Set<string>();
        const merged: WONotif[] = [];
        for (const item of [...overdue, ...urgent]) {
          if (!seen.has(item.id)) { seen.add(item.id); merged.push(item); }
        }
        setWoItems(merged);
      } catch { /* silent */ }
    }
    loadWO();
  }, []);

  // ── Cargar notificaciones de backend (audit/CAPA) ─────────────────────────
  const loadAppNotifs = useCallback(async () => {
    try {
      const res = await api.get<{ notifications: AppNotif[] }>('/notifications');
      setAppItems(res.data.notifications.map((n) => ({ ...n, kind: 'app' as const })));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadAppNotifs(); }, [loadAppNotifs]);

  // ── Socket.IO — recibir notificaciones en tiempo real ────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (notif: Omit<AppNotif, 'kind'>) => {
      setAppItems((prev) => {
        // Evitar duplicados (ya podría estar en la lista cargada del API)
        if (prev.some((n) => n.id === notif.id)) return prev;
        return [{ ...notif, kind: 'app' }, ...prev];
      });
    };
    socket.on('notification', handler);
    return () => { socket.off('notification', handler); };
  }, []);

  // ── Click fuera cierra el dropdown ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target as Node) &&
        !(e.target as Element).closest('.notif-dropdown')
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Contadores ────────────────────────────────────────────────────────────
  const visibleWO  = woItems.filter((n) => !dismissed.has(n.id));
  const visibleApp = appItems.filter((n) => !dismissed.has(n.id) && !n.read);
  const count      = visibleWO.length + visibleApp.length;

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect  = btnRef.current.getBoundingClientRect();
      const dropH = Math.min(count * 76 + 52, 420);
      setDropPos({ left: rect.right + 12, top: Math.max(8, rect.bottom - dropH + 36) });
    }
    setOpen((v) => !v);
  };

  const dismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDismissed((s) => new Set([...s, id]));
  };

  const markRead = async (e: React.MouseEvent, notif: AppNotif) => {
    e.stopPropagation();
    setDismissed((s) => new Set([...s, notif.id]));
    try { await api.patch(`/notifications/${notif.id}/read`); } catch { /* silent */ }
  };

  const clearAll = async () => {
    setDismissed(new Set([
      ...woItems.map((n) => n.id),
      ...appItems.map((n) => n.id),
    ]));
    try { await api.patch('/notifications/read-all'); } catch { /* silent */ }
  };

  const timeSince = (iso: string) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days === 0) return 'hoy';
    if (days === 1) return 'hace 1 día';
    return `hace ${days} días`;
  };

  const navigate2 = (link?: string) => {
    if (link) { navigate(link); setOpen(false); }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Botón campana */}
      <button
        ref={btnRef}
        onClick={handleToggle}
        title="Notificaciones"
        style={{
          position: 'relative', width: 32, height: 32, borderRadius: '50%',
          background: open ? ACCENT : btnBg,
          border: `1px solid ${open ? ACCENT : 'rgba(255,255,255,.15)'}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background .15s', flexShrink: 0,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke={open ? '#fff' : (count > 0 ? ACCENT : iconColor)}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: RED, color: '#fff', width: 16, height: 16, borderRadius: '50%',
            fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid transparent', animation: 'pulse-bell 2s infinite',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="notif-dropdown"
          style={{
            position: 'fixed', top: dropPos.top, left: dropPos.left,
            width: 360, background: CARD, border: `1px solid ${BORDER}`,
            boxShadow: '0 8px 24px rgba(0,0,0,.18)', borderRadius: 4,
            fontFamily: 'IBM Plex Sans, sans-serif', overflow: 'hidden', zIndex: 2000,
          }}
        >
          {/* Header */}
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>Notificaciones</span>
            {count > 0 && (
              <button onClick={clearAll} style={{ fontSize: 11, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Limpiar todo
              </button>
            )}
          </div>

          {count === 0 ? (
            <div style={{ padding: '28px 0', textAlign: 'center', color: MUTED, fontSize: 13 }}>
              <div style={{ fontSize: 22, marginBottom: 6, opacity: .4 }}>✓</div>
              Sin notificaciones pendientes
            </div>
          ) : (
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {/* Notificaciones de backend (audit/CAPA) */}
              {visibleApp.map((notif) => {
                const meta = NOTIF_ICON[notif.type] ?? { icon: '🔔', color: ACCENT, bg: '#fef3e7' };
                return (
                  <div key={notif.id}
                    onClick={() => navigate2(notif.link)}
                    style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, cursor: notif.link ? 'pointer' : 'default', display: 'flex', gap: 10, alignItems: 'flex-start', background: CARD, transition: 'background .1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = ROW_HOV)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = CARD)}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: meta.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                      {meta.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {notif.message}
                      </div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
                        {timeSince(notif.createdAt)}
                      </div>
                    </div>
                    <button onClick={(e) => markRead(e, notif)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 18, lineHeight: 1, flexShrink: 0, padding: '0 2px' }}>×</button>
                  </div>
                );
              })}

              {/* Notificaciones de work orders */}
              {visibleWO.map(({ id, order, type }) => {
                const isOverdue = type === 'overdue';
                const color   = isOverdue ? RED : ACCENT;
                const bgColor = isOverdue ? '#fde8e6' : '#fef3e7';
                return (
                  <div key={id}
                    onClick={() => { navigate(`/work-orders/${order.id}`); setOpen(false); }}
                    style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start', background: CARD, transition: 'background .1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = ROW_HOV)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = CARD)}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: bgColor, color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                      {isOverdue ? '!' : '↑'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 2 }}>
                        {isOverdue ? 'Orden vencida' : 'Prioridad Crítica — pendiente'}
                      </div>
                      <div style={{ fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ color, fontWeight: 600 }}>{order.code.slice(-8).toUpperCase()}</span> · {order.title}
                      </div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                        {order.asset?.name}
                        {order.scheduledAt && ` · ${timeSince(order.scheduledAt)}`}
                      </div>
                    </div>
                    <button onClick={(e) => dismiss(e, id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 18, lineHeight: 1, flexShrink: 0, padding: '0 2px' }}>×</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse-bell {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
