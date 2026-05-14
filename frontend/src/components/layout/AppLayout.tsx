import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Factory, Calendar, Users, LogOut, Menu, X,
  CalendarDays, CheckSquare, Settings, Wrench, Car, BarChart3, ClipboardCheck,
  Truck, AlertTriangle, ClipboardX, FileText, TrendingUp,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import Toaster from '@/components/ui/Toaster';
import NotificationBell from '@/components/NotificationBell';
import { cn } from '@/lib/utils';
import { connectSocket } from '@/services/socket';
import { api } from '@/services/api';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ModuleId = 'maintenance' | 'fleet' | 'oee' | 'audits';
type ModuleKey = 'dashboard' | 'workOrders' | 'assets' | 'maintenance' | 'calendar' | 'checklists' | 'users' | 'settings';

interface NavItemDef {
  to: string;
  icon: React.ElementType;
  label: string;
  fullLabel: string;
  badge?: boolean;
  module?: ModuleKey;
  exact?: boolean;
}

// ─── Módulos y su navegación ─────────────────────────────────────────────────

const MODULE_TABS: Array<{ id: ModuleId; label: string; icon: React.ElementType; defaultPath: string }> = [
  { id: 'maintenance', label: 'Mtto',      icon: Wrench,         defaultPath: '/dashboard' },
  { id: 'fleet',       label: 'Flota',     icon: Car,            defaultPath: '/fleet' },
  { id: 'oee',         label: 'OEE',       icon: BarChart3,      defaultPath: '/oee' },
  { id: 'audits',      label: 'Auditoría', icon: ClipboardCheck, defaultPath: '/audits' },
];

const NAV_BY_MODULE: Record<ModuleId, NavItemDef[]> = {
  maintenance: [
    { to: '/dashboard',   icon: LayoutDashboard, label: 'Inicio',     fullLabel: 'Inicio',             module: 'dashboard' },
    { to: '/work-orders', icon: ClipboardList,   label: 'Órdenes',    fullLabel: 'Órdenes de Trabajo', module: 'workOrders', badge: true },
    { to: '/assets',      icon: Factory,         label: 'Equipos',    fullLabel: 'Equipos',            module: 'assets' },
    { to: '/maintenance', icon: Calendar,        label: 'Mtto',       fullLabel: 'Mantenimiento',      module: 'maintenance' },
    { to: '/calendar',    icon: CalendarDays,    label: 'Calendario', fullLabel: 'Calendario',         module: 'calendar' },
    { to: '/checklists',  icon: CheckSquare,     label: 'Checklists', fullLabel: 'Checklists',         module: 'checklists' },
    { to: '/users',       icon: Users,           label: 'Usuarios',   fullLabel: 'Usuarios',           module: 'users' },
    { to: '/settings',    icon: Settings,        label: 'Config',     fullLabel: 'Configuración',      module: 'settings' },
  ],
  fleet: [
    { to: '/fleet',             icon: Car,           label: 'Dashboard', fullLabel: 'Dashboard Flota',    exact: true },
    { to: '/fleet/vehicles',    icon: Truck,         label: 'Vehículos', fullLabel: 'Vehículos' },
    { to: '/fleet/work-orders', icon: ClipboardList, label: 'OT',        fullLabel: 'OT de Vehículos' },
    { to: '/fleet/plans',       icon: CalendarDays,  label: 'Planes',    fullLabel: 'Planes de Servicio' },
  ],
  oee: [
    { to: '/oee',          icon: BarChart3,     label: 'Dashboard', fullLabel: 'Dashboard OEE',  exact: true },
    { to: '/oee/records',  icon: ClipboardList, label: 'Registros', fullLabel: 'Registros OEE' },
    { to: '/oee/downtime', icon: AlertTriangle, label: 'Paros',     fullLabel: 'Eventos de Paro' },
  ],
  audits: [
    { to: '/audits',                    icon: ClipboardCheck, label: 'Auditorías', fullLabel: 'Auditorías',  exact: true },
    { to: '/audits/findings',           icon: ClipboardX,     label: 'Hallazgos',  fullLabel: 'Hallazgos' },
    { to: '/audits/templates',          icon: FileText,       label: 'Plantillas', fullLabel: 'Plantillas' },
    { to: '/audits/reports/capas',      icon: AlertTriangle,  label: 'Rep. CAPAs', fullLabel: 'Reporte CAPAs' },
    { to: '/audits/reports/monthly',    icon: TrendingUp,     label: 'Mensual',    fullLabel: 'Cumplimiento Mensual' },
  ],
};

function getActiveModule(pathname: string): ModuleId {
  if (pathname.startsWith('/fleet')) return 'fleet';
  if (pathname.startsWith('/oee')) return 'oee';
  if (pathname.startsWith('/audits')) return 'audits';
  return 'maintenance';
}

// ─── Permisos ─────────────────────────────────────────────────────────────────

type RolePerms = Record<ModuleKey, boolean>;
const DEFAULT_PERMISSIONS: Record<string, RolePerms> = {
  ADMIN:      { dashboard: true,  workOrders: true,  assets: true,  maintenance: true,  calendar: true,  checklists: true,  users: true,  settings: true  },
  SUPERVISOR: { dashboard: true,  workOrders: true,  assets: true,  maintenance: true,  calendar: true,  checklists: true,  users: false, settings: false },
  TECHNICIAN: { dashboard: true,  workOrders: true,  assets: false, maintenance: false, calendar: true,  checklists: false, users: false, settings: false },
  EXECUTIVE:  { dashboard: true,  workOrders: true,  assets: false, maintenance: false, calendar: false, checklists: false, users: false, settings: false },
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', SUPERVISOR: 'Supervisor', TECHNICIAN: 'Técnico', EXECUTIVE: 'Directivo',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

const SZ = {
  sidebar:       '#1c1c1c',
  sidebarBorder: 'rgba(255,255,255,.1)',
  sidebarText:   'rgba(255,255,255,.6)',
  sidebarActive: 'rgba(255,255,255,.08)',
  accent:        '#e67e22',
};

// ─── Componente principal ────────────────────────────────────────────────────

export default function AppLayout() {
  const { user, token, logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen]             = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifCount, setNotifCount]             = useState(0);
  const [rolePermissions, setRolePermissions]   = useState<Record<string, RolePerms>>(DEFAULT_PERMISSIONS);

  const activeModule = getActiveModule(location.pathname);

  useEffect(() => {
    api.get<Record<string, RolePerms>>('/settings/role-permissions')
      .then(({ data }) => setRolePermissions(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);
    const handleCreated = () => { push('Nueva orden de trabajo creada', 'info'); setNotifCount((n) => n + 1); };
    socket.on('workOrder:created', handleCreated);
    socket.on('workOrder:updated', () => setNotifCount((n) => n + 1));
    return () => { socket.off('workOrder:created', handleCreated); };
  }, [token, push]);

  useEffect(() => {
    api.get('/work-orders/stats')
      .then(({ data }) => { if (data.overdue > 0) setNotifCount(data.overdue); })
      .catch(() => {});
  }, []);

  // Filtrar nav del módulo activo según permisos (solo aplica a mantenimiento)
  const userRole = user?.role ?? '';
  const perms: RolePerms = rolePermissions[userRole] ?? DEFAULT_PERMISSIONS[userRole] ?? DEFAULT_PERMISSIONS.TECHNICIAN;
  const allNavItems = NAV_BY_MODULE[activeModule];
  const visibleNav = activeModule === 'maintenance'
    ? allNavItems.filter((item) => !item.module || perms[item.module])
    : allNavItems;
  const bottomNav = visibleNav.slice(0, 5);

  const initials = user?.name?.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() ?? '?';

  // ─── Subcomponentes ──────────────────────────────────────────────────────

  const NavItem = ({ to, icon: Icon, fullLabel, badge, collapsed, exact }: {
    to: string; icon: React.ElementType; fullLabel: string;
    badge?: boolean; collapsed: boolean; exact?: boolean;
  }) => (
    <NavLink
      to={to}
      end={exact}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: collapsed ? '10px 0' : '10px 14px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: isActive ? SZ.sidebarActive : 'transparent',
        border: 'none', cursor: 'pointer',
        color: isActive ? '#fff' : SZ.sidebarText,
        fontSize: 13, fontWeight: isActive ? 600 : 400,
        borderLeft: isActive ? `3px solid ${SZ.accent}` : '3px solid transparent',
        textDecoration: 'none', transition: 'background .15s',
        position: 'relative',
      })}
      onClick={() => setDrawerOpen(false)}
    >
      {({ isActive }) => (
        <>
          <Icon size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span style={{ flex: 1, fontFamily: 'IBM Plex Sans, sans-serif' }}>{fullLabel}</span>}
          {badge && notifCount > 0 && (
            <span style={{
              background: '#c0392b', color: '#fff', fontSize: 10, fontWeight: 700,
              borderRadius: '50%', width: 18, height: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: collapsed ? 'absolute' : 'relative',
              top: collapsed ? 4 : undefined, right: collapsed ? 4 : undefined,
            }}>
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
          {isActive && <></>}
        </>
      )}
    </NavLink>
  );

  const ModuleTabs = ({ collapsed }: { collapsed: boolean }) => (
    <div style={{
      padding: collapsed ? '8px 6px' : '8px 10px',
      borderBottom: `1px solid ${SZ.sidebarBorder}`,
      display: 'grid',
      gridTemplateColumns: collapsed ? '1fr' : '1fr 1fr',
      gap: 4,
    }}>
      {MODULE_TABS.map((mod) => {
        const Icon = mod.icon;
        const isActive = activeModule === mod.id;
        return (
          <button
            key={mod.id}
            onClick={() => { navigate(mod.defaultPath); setDrawerOpen(false); }}
            title={mod.label}
            style={{
              display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 5,
              justifyContent: 'center',
              padding: collapsed ? '7px 0' : '5px 6px',
              background: isActive ? SZ.accent : 'rgba(255,255,255,.06)',
              border: `1px solid ${isActive ? SZ.accent : 'rgba(255,255,255,.12)'}`,
              borderRadius: 6, cursor: 'pointer',
              color: isActive ? '#fff' : SZ.sidebarText,
              fontSize: 10, fontWeight: isActive ? 700 : 400,
              fontFamily: 'IBM Plex Sans, sans-serif',
              transition: 'all .15s',
              whiteSpace: 'nowrap', overflow: 'hidden',
            }}
          >
            <Icon size={12} style={{ flexShrink: 0 }} />
            {!collapsed && (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{mod.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );

  // ─── Sidebar desktop ─────────────────────────────────────────────────────

  const DesktopSidebar = (
    <aside
      className="hidden md:flex flex-col shrink-0 transition-all duration-200"
      style={{ width: sidebarCollapsed ? 52 : 195, background: SZ.sidebar, minHeight: '100vh' }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: sidebarCollapsed ? '14px 0' : '14px 14px',
        borderBottom: `1px solid ${SZ.sidebarBorder}`,
        minHeight: 52, justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
      }}>
        <img src="/logo-s.png" alt="S" style={{ width: 26, height: 26, objectFit: 'contain', flexShrink: 0 }} />
        {!sidebarCollapsed && (
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 17, letterSpacing: '.5px', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            senz
          </span>
        )}
      </div>

      <ModuleTabs collapsed={sidebarCollapsed} />

      <nav style={{ flex: 1, paddingTop: 8 }}>
        {visibleNav.map(({ to, icon, fullLabel, badge, exact }) => (
          <NavItem key={to} to={to} icon={icon} fullLabel={fullLabel} badge={badge} collapsed={sidebarCollapsed} exact={exact} />
        ))}
      </nav>

      <div style={{ borderTop: `1px solid ${SZ.sidebarBorder}`, padding: sidebarCollapsed ? '10px 0' : '10px 14px' }}>
        {!sidebarCollapsed && user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: SZ.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 11, flexShrink: 0,
            }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, lineHeight: 1.2, fontFamily: 'IBM Plex Sans, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ color: SZ.sidebarText, fontSize: 10, fontFamily: 'IBM Plex Sans, sans-serif' }}>{ROLE_LABELS[user.role]}</div>
            </div>
            <NotificationBell iconColor="rgba(255,255,255,.5)" btnBg="transparent" />
          </div>
        )}
        {sidebarCollapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            <NotificationBell iconColor="rgba(255,255,255,.5)" btnBg="transparent" />
          </div>
        )}
        <button
          onClick={() => setSidebarCollapsed((v) => !v)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: SZ.sidebarText, fontSize: 11, fontFamily: 'IBM Plex Sans, sans-serif',
            display: 'flex', alignItems: 'center', gap: 6,
            width: sidebarCollapsed ? '100%' : 'auto',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            padding: '4px 0',
          }}
        >
          {sidebarCollapsed
            ? <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 7l4-4v3h4v2H7v3z"/></svg>
            : <><svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M11 7L7 11V8H3V6h4V3z"/></svg><span>Contraer</span></>}
        </button>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: SZ.sidebarText, fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif',
            padding: '6px 0', marginTop: 4,
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          }}
        >
          <LogOut size={14} style={{ flexShrink: 0 }} />
          {!sidebarCollapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );

  // ─── Drawer mobile ───────────────────────────────────────────────────────

  const MobileDrawer = drawerOpen ? (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setDrawerOpen(false)} />
      <aside className="fixed inset-y-0 left-0 w-64 z-50 flex flex-col md:hidden" style={{ background: SZ.sidebar }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 14px', borderBottom: `1px solid ${SZ.sidebarBorder}`, minHeight: 52 }}>
          <img src="/logo-s.png" alt="S" style={{ width: 26, height: 26, objectFit: 'contain' }} />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 17, letterSpacing: '.5px', fontFamily: 'IBM Plex Sans, sans-serif' }}>senz</span>
          <button onClick={() => setDrawerOpen(false)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: SZ.sidebarText }}>
            <X size={18} />
          </button>
        </div>
        <ModuleTabs collapsed={false} />
        <nav style={{ flex: 1, paddingTop: 8 }}>
          {visibleNav.map(({ to, icon, fullLabel, badge, exact }) => (
            <NavItem key={to} to={to} icon={icon} fullLabel={fullLabel} badge={badge} collapsed={false} exact={exact} />
          ))}
        </nav>
        <div style={{ borderTop: `1px solid ${SZ.sidebarBorder}`, padding: '10px 14px' }}>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: SZ.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11 }}>{initials}</div>
              <div>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{user.name}</div>
                <div style={{ color: SZ.sidebarText, fontSize: 10 }}>{ROLE_LABELS[user.role]}</div>
              </div>
            </div>
          )}
          <button onClick={() => { logout(); navigate('/login'); }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: SZ.sidebarText, fontSize: 12 }}>
            <LogOut size={14} /> <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  ) : null;

  // ─── Header y nav mobile ─────────────────────────────────────────────────

  const MobileHeader = (
    <header className="flex md:hidden items-center gap-3 px-4 shrink-0 h-[52px]" style={{ background: SZ.sidebar }}>
      <button onClick={() => setDrawerOpen(true)} className="p-1 -ml-1" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: SZ.sidebarText }}>
        <Menu size={22} />
      </button>
      <img src="/logo-s.png" alt="S" style={{ width: 22, height: 22, objectFit: 'contain' }} />
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '.5px', fontFamily: 'IBM Plex Sans, sans-serif', flex: 1 }}>senz</span>
      {notifCount > 0 && (
        <span style={{ background: '#c0392b', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {notifCount > 9 ? '9+' : notifCount}
        </span>
      )}
    </header>
  );

  const MobileBottomNav = (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden flex z-30 border-t" style={{ background: SZ.sidebar, borderColor: SZ.sidebarBorder }}>
      {bottomNav.map(({ to, icon: Icon, label, badge }) => (
        <NavLink key={to} to={to}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[11px] transition-colors min-h-[56px]"
          style={({ isActive }) => ({ color: isActive ? SZ.accent : SZ.sidebarText, textDecoration: 'none' })}
        >
          <div className="relative">
            <Icon size={22} />
            {badge && notifCount > 0 && (
              <span className="absolute -top-1 -right-2 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full text-white" style={{ background: '#c0392b' }}>
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </div>
          <span className="font-medium" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f5f5f5' }}>
      {DesktopSidebar}
      {MobileDrawer}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {MobileHeader}
        <main className={cn('flex-1 overflow-auto', isMobile && 'pb-16')}>
          <Outlet />
        </main>
        {MobileBottomNav}
      </div>
      <Toaster />
    </div>
  );
}
