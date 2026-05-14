import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { WorkOrder } from '@/types';

const ACCENT  = '#e67e22';
const RED     = '#c0392b';
const BORDER  = '#e4e4e4';
const CARD    = '#ffffff';
const TEXT    = '#1c1c1c';
const MUTED   = '#888';
const ROW_HOV = '#fff4ec';

interface NotifItem { order: WorkOrder; type: 'overdue' | 'urgent' }

interface Props {
  /** Color del ícono de campana (para adaptarse al fondo del sidebar) */
  iconColor?: string;
  /** Color del fondo del botón en reposo */
  btnBg?: string;
}

export default function NotificationBell({ iconColor = MUTED, btnBg = CARD }: Props) {
  const navigate  = useNavigate();
  const wrapRef   = useRef<HTMLDivElement>(null);
  const btnRef    = useRef<HTMLButtonElement>(null);

  const [open, setOpen]           = useState(false);
  const [items, setItems]         = useState<NotifItem[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [dropPos, setDropPos]     = useState({ top: 0, left: 0 });

  useEffect(() => {
    async function load() {
      try {
        const [overdueRes, urgentRes] = await Promise.all([
          api.get<{ data: WorkOrder[] }>('/work-orders', { params: { status: 'PENDING', limit: 50 } }),
          api.get<{ data: WorkOrder[] }>('/work-orders', { params: { priority: 'CRITICAL', limit: 50 } }),
        ]);
        const now = new Date();
        const overdue: NotifItem[] = overdueRes.data.data
          .filter((o) => o.scheduledAt && new Date(o.scheduledAt) < now)
          .map((o) => ({ order: o, type: 'overdue' as const }));
        const urgent: NotifItem[] = urgentRes.data.data
          .filter((o) => o.status === 'PENDING' || o.status === 'IN_PROGRESS')
          .map((o) => ({ order: o, type: 'urgent' as const }));
        const seen = new Set<string>();
        const merged: NotifItem[] = [];
        for (const item of [...overdue, ...urgent]) {
          if (!seen.has(item.order.id)) { seen.add(item.order.id); merged.push(item); }
        }
        setItems(merged);
      } catch { /* silent */ }
    }
    load();
  }, []);

  /* Cierra con click fuera */
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

  const visible = items.filter((n) => !dismissed.has(n.order.id));
  const count   = visible.length;

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const dropH = Math.min(visible.length * 76 + 52, 420);
      setDropPos({
        left: rect.right + 12,
        top:  Math.max(8, rect.bottom - dropH + 36),
      });
    }
    setOpen((v) => !v);
  };

  const dismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDismissed((s) => new Set([...s, id]));
  };

  const clearAll = () => setDismissed(new Set(items.map((n) => n.order.id)));

  const timeSince = (iso: string) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days === 0) return 'hoy';
    if (days === 1) return 'hace 1 día';
    return `hace ${days} días`;
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
            background: RED, color: '#fff',
            width: 16, height: 16, borderRadius: '50%',
            fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid transparent',
            animation: 'pulse-bell 2s infinite',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown — fixed para no ser recortado por el sidebar */}
      {open && (
        <div
          className="notif-dropdown"
          style={{
            position: 'fixed', top: dropPos.top, left: dropPos.left,
            width: 340, background: CARD,
            border: `1px solid ${BORDER}`,
            boxShadow: '0 8px 24px rgba(0,0,0,.18)',
            borderRadius: 4, fontFamily: 'IBM Plex Sans, sans-serif',
            overflow: 'hidden', zIndex: 2000,
          }}
        >
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>Notificaciones</span>
            {count > 0 && (
              <button onClick={clearAll} style={{ fontSize: 11, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}>
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
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {visible.map(({ order, type }) => {
                const isOverdue = type === 'overdue';
                const color   = isOverdue ? RED : ACCENT;
                const bgColor = isOverdue ? '#fde8e6' : '#fef3e7';
                return (
                  <div key={order.id + type}
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
                        {order.asset.name}
                        {order.scheduledAt && ` · ${timeSince(order.scheduledAt)}`}
                      </div>
                    </div>
                    <button onClick={(e) => dismiss(e, order.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 18, lineHeight: 1, flexShrink: 0, padding: '0 2px' }}>×</button>
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
