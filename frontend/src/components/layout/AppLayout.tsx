import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Factory, Calendar, Users, LogOut, Menu, X,
  CalendarDays, CheckSquare, Settings, Wrench, Car, BarChart3, ClipboardCheck,
  Truck, AlertTriangle, ClipboardX, FileText, TrendingUp, Droplets, Home, FileDown,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions, type PermKey } from '@/hooks/usePermissions';
import Toaster from '@/components/ui/Toaster';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/ThemeContext';
import { THEMES } from '@/theme/themes';

// ─── Types ────────────────────────────────────────────────────────────────────

type ModuleId  = 'home' | 'maintenance' | 'fleet' | 'oee' | 'audits' | 'admin';
type ModuleKey = PermKey;

interface NavItemDef {
  to: string;
  icon: React.ElementType;
  label: string;
  fullLabel: string;
  badge?: boolean;
  module?: ModuleKey;
  exact?: boolean;
}

// ─── Module tabs ──────────────────────────────────────────────────────────────

const MODULE_TABS: Array<{ id: ModuleId; label: string; icon: React.ElementType; defaultPath: string; permKey?: PermKey }> = [
  { id: 'home',        label: 'Panel',     icon: Home,           defaultPath: '/dashboard'    },
  { id: 'maintenance', label: 'Mtto',      icon: Wrench,         defaultPath: '/mtto-dashboard' },
  { id: 'fleet',       label: 'Flota',     icon: Car,            defaultPath: '/fleet',       permKey: 'fleet'  },
  { id: 'oee',         label: 'OEE',       icon: BarChart3,      defaultPath: '/oee',         permKey: 'oee'    },
  { id: 'audits',      label: 'Auditoría', icon: ClipboardCheck, defaultPath: '/audits',      permKey: 'audits' },
  { id: 'admin',       label: 'Admin',     icon: Settings,       defaultPath: '/users',       permKey: 'users'  },
];

const NAV_BY_MODULE: Record<ModuleId, NavItemDef[]> = {
  home: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Panel', fullLabel: 'Centro de Control' },
  ],
  maintenance: [
    { to: '/mtto-dashboard', icon: LayoutDashboard, label: 'Inicio',  fullLabel: 'Dashboard Mtto',     module: 'dashboard' },
    { to: '/work-orders', icon: ClipboardList,   label: 'Órdenes',    fullLabel: 'Órdenes de Trabajo', module: 'workOrders', badge: true },
    { to: '/assets',      icon: Factory,         label: 'Equipos',    fullLabel: 'Equipos',            module: 'assets' },
    { to: '/maintenance', icon: Calendar,        label: 'Mtto',       fullLabel: 'Mantenimiento',      module: 'maintenance' },
    { to: '/calendar',    icon: CalendarDays,    label: 'Calendario', fullLabel: 'Calendario',         module: 'calendar' },
    { to: '/checklists',  icon: CheckSquare,     label: 'Checklists', fullLabel: 'Checklists',         module: 'checklists' },
  ],
  fleet: [
    { to: '/fleet',              icon: Car,           label: 'Dashboard',  fullLabel: 'Dashboard Flota',      exact: true },
    { to: '/fleet/vehicles',     icon: Truck,         label: 'Vehículos',  fullLabel: 'Vehículos'             },
    { to: '/fleet/fuel',         icon: Droplets,      label: 'Combustible',fullLabel: 'Combustible'           },
    { to: '/fleet/maintenance',  icon: CalendarDays,  label: 'Servicio',   fullLabel: 'Mantenimiento'         },
    { to: '/fleet/alerts',       icon: AlertTriangle, label: 'Alertas',    fullLabel: 'Alertas de Flota'      },
    { to: '/fleet/reports',      icon: BarChart3,     label: 'Reportes',   fullLabel: 'Reportes'              },
  ],
  oee: [
    { to: '/oee',          icon: BarChart3,     label: 'Dashboard', fullLabel: 'Dashboard OEE',  exact: true },
    { to: '/oee/records',  icon: ClipboardList, label: 'Registros', fullLabel: 'Registros OEE' },
    { to: '/oee/downtime', icon: AlertTriangle, label: 'Paros',     fullLabel: 'Eventos de Paro' },
    { to: '/oee/reports',  icon: FileDown,      label: 'Reportes',  fullLabel: 'Reportes OEE' },
  ],
  audits: [
    { to: '/audits',                 icon: ClipboardCheck, label: 'Auditorías', fullLabel: 'Auditorías',          exact: true },
    { to: '/audits/calendar',        icon: CalendarDays,   label: 'Calendario', fullLabel: 'Calendario' },
    { to: '/audits/findings',        icon: ClipboardX,     label: 'Hallazgos',  fullLabel: 'Hallazgos' },
    { to: '/audits/templates',       icon: FileText,       label: 'Plantillas', fullLabel: 'Plantillas' },
    { to: '/audits/reports/capas',   icon: AlertTriangle,  label: 'CAPAs',      fullLabel: 'Reporte CAPAs' },
    { to: '/audits/reports/monthly', icon: TrendingUp,     label: 'Mensual',    fullLabel: 'Cumplimiento Mensual' },
  ],
  admin: [
    { to: '/users',    icon: Users,    label: 'Usuarios', fullLabel: 'Usuarios',       module: 'users'    },
    { to: '/settings', icon: Settings, label: 'Config',   fullLabel: 'Configuración',  module: 'settings' },
  ],
};

function getActiveModule(pathname: string): ModuleId {
  if (pathname === '/dashboard')            return 'home';
  if (pathname === '/mtto-dashboard')       return 'maintenance';
  if (pathname.startsWith('/fleet'))        return 'fleet';
  if (pathname.startsWith('/oee'))          return 'oee';
  if (pathname.startsWith('/audits'))       return 'audits';
  if (pathname === '/users' || pathname === '/settings') return 'admin';
  return 'maintenance';
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', SUPERVISOR: 'Supervisor', TECHNICIAN: 'Técnico', EXECUTIVE: 'Directivo',
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AppLayout() {
  const { user, logout }               = useAuth();
  const navigate                       = useNavigate();
  const location                       = useLocation();
  const isMobile                       = useIsMobile();
  const { themeKey, theme, setThemeKey } = useTheme();
  const { fetchPermissions, hasPermission, getRolePerms } = usePermissions();

  const [drawerOpen,       setDrawerOpen]       = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifCount]                            = useState(3);

  // Cargar permisos desde API al montar
  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  const activeModule = getActiveModule(location.pathname);
  const userRole     = user?.role ?? 'ADMIN';
  const perms        = getRolePerms(userRole);

  // Filtrar tabs de módulo según permisos del rol
  const visibleModuleTabs = MODULE_TABS.filter((mod) => {
    if (!mod.permKey) return true;                              // maintenance siempre visible
    if (mod.id === 'admin') return perms.users || perms.settings;
    return hasPermission(userRole, mod.permKey);
  });

  const allNavItems = NAV_BY_MODULE[activeModule];
  const visibleNav  = (activeModule === 'maintenance' || activeModule === 'admin')
    ? allNavItems.filter((item) => !item.module || perms[item.module as ModuleKey])
    : allNavItems;
  const bottomNav = visibleNav.slice(0, 5);

  const initials = user?.name?.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() ?? 'AD';

  // ─── Sidebar nav item ────────────────────────────────────────────────────

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
        background: isActive ? theme.sidebarActive : 'transparent',
        border: 'none', cursor: 'pointer',
        color: isActive ? '#fff' : theme.sidebarMuted,
        fontSize: 13, fontWeight: isActive ? 600 : 400,
        borderLeft: isActive ? `3px solid ${theme.accent}` : '3px solid transparent',
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

  // ─── Module tabs ─────────────────────────────────────────────────────────

  const ModuleTabs = ({ collapsed }: { collapsed: boolean }) => (
    <div style={{
      padding: collapsed ? '8px 6px' : '8px 8px',
      borderBottom: `1px solid ${theme.sidebarBorder}`,
      display: 'grid',
      gridTemplateColumns: collapsed ? '1fr' : '1fr 1fr',
      gap: 3,
    }}>
      {visibleModuleTabs.map((mod) => {
        const Icon     = mod.icon;
        const isActive = activeModule === mod.id;
        return (
          <button
            key={mod.id}
            onClick={() => { navigate(mod.defaultPath); setDrawerOpen(false); }}
            title={mod.label}
            style={{
              display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 4,
              justifyContent: 'center',
              padding: collapsed ? '7px 0' : '5px 4px',
              background: isActive ? theme.accent : 'rgba(255,255,255,.06)',
              border: `1px solid ${isActive ? theme.accent : 'rgba(255,255,255,.12)'}`,
              borderRadius: 5, cursor: 'pointer',
              color: isActive ? '#fff' : theme.sidebarMuted,
              fontSize: 10, fontWeight: isActive ? 700 : 400,
              fontFamily: 'IBM Plex Sans, sans-serif',
              transition: 'all .15s',
              whiteSpace: 'nowrap', overflow: 'hidden',
            }}
          >
            <Icon size={11} style={{ flexShrink: 0 }} />
            {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{mod.label}</span>}
          </button>
        );
      })}
    </div>
  );

  // ─── Theme picker ─────────────────────────────────────────────────────────

  const ThemePicker = ({ collapsed }: { collapsed: boolean }) => {
    if (collapsed) return null;
    return (
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingTop: 6 }}>
        {Object.entries(THEMES).map(([key, t]) => (
          <button
            key={key} title={t.name} onClick={() => setThemeKey(key)}
            style={{
              width: 16, height: 16, borderRadius: '50%',
              background: t.accent, cursor: 'pointer',
              border: themeKey === key ? `2px solid #fff` : '2px solid transparent',
              outline: themeKey === key ? `1px solid ${t.accent}` : 'none',
              padding: 0,
            }}
          />
        ))}
      </div>
    );
  };

  // ─── Desktop sidebar ──────────────────────────────────────────────────────

  const DesktopSidebar = (
    <aside
      className="hidden md:flex flex-col shrink-0 transition-all duration-200"
      style={{ width: sidebarCollapsed ? 52 : 195, background: theme.sidebar, minHeight: '100vh' }}
    >
      {/* Logo — click siempre lleva al Panel Global */}
      <button
        onClick={() => navigate('/dashboard')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: sidebarCollapsed ? '14px 0' : '14px 14px',
          borderBottom: `1px solid ${theme.sidebarBorder}`,
          minHeight: 52, justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          background: 'transparent', border: 'none', cursor: 'pointer', width: '100%',
        }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: 6, background: theme.accent, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 14, fontFamily: 'IBM Plex Sans, sans-serif', lineHeight: 1 }}>S</span>
        </div>
        {!sidebarCollapsed && (
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, letterSpacing: '.5px', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            senz
          </span>
        )}
      </button>

      <ModuleTabs collapsed={sidebarCollapsed} />

      <nav style={{ flex: 1, paddingTop: 8 }}>
        {visibleNav.map(({ to, icon, fullLabel, badge, exact }) => (
          <NavItem key={to} to={to} icon={icon} fullLabel={fullLabel} badge={badge} collapsed={sidebarCollapsed} exact={exact} />
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${theme.sidebarBorder}`, padding: sidebarCollapsed ? '10px 0' : '10px 14px' }}>
        {!sidebarCollapsed && user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: theme.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 11, flexShrink: 0,
            }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ color: theme.sidebarMuted, fontSize: 10 }}>{ROLE_LABELS[user.role] ?? user.role}</div>
            </div>
          </div>
        )}
        {!sidebarCollapsed && <ThemePicker collapsed={sidebarCollapsed} />}
        <div style={{ marginTop: 8, display: 'flex', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', gap: 4 }}>
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: theme.sidebarMuted, fontSize: 11, fontFamily: 'IBM Plex Sans, sans-serif',
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
            }}
          >
            {sidebarCollapsed
              ? <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 7l4-4v3h4v2H7v3z"/></svg>
              : <><svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M11 7L7 11V8H3V6h4V3z"/></svg><span>Contraer</span></>}
          </button>
        </div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: theme.sidebarMuted, fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif',
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

  // ─── Mobile drawer ────────────────────────────────────────────────────────

  const MobileDrawer = drawerOpen ? (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setDrawerOpen(false)} />
      <aside className="fixed inset-y-0 left-0 w-64 z-50 flex flex-col md:hidden" style={{ background: theme.sidebar }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 14px', borderBottom: `1px solid ${theme.sidebarBorder}`, minHeight: 52 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 14, fontFamily: 'IBM Plex Sans, sans-serif' }}>S</span>
          </div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, letterSpacing: '.5px', fontFamily: 'IBM Plex Sans, sans-serif', flex: 1 }}>senz</span>
          <button onClick={() => setDrawerOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: theme.sidebarMuted }}>
            <X size={18} />
          </button>
        </div>
        <ModuleTabs collapsed={false} />
        <nav style={{ flex: 1, paddingTop: 8 }}>
          {visibleNav.map(({ to, icon, fullLabel, badge, exact }) => (
            <NavItem key={to} to={to} icon={icon} fullLabel={fullLabel} badge={badge} collapsed={false} exact={exact} />
          ))}
        </nav>
        <div style={{ borderTop: `1px solid ${theme.sidebarBorder}`, padding: '10px 14px' }}>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11 }}>{initials}</div>
              <div>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{user.name}</div>
                <div style={{ color: theme.sidebarMuted, fontSize: 10 }}>{ROLE_LABELS[user.role] ?? user.role}</div>
              </div>
            </div>
          )}
          <ThemePicker collapsed={false} />
          <button onClick={() => { logout(); navigate('/login'); }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: theme.sidebarMuted, fontSize: 12, marginTop: 8 }}>
            <LogOut size={14} /> <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  ) : null;

  // ─── Mobile header ────────────────────────────────────────────────────────

  const MobileHeader = (
    <header className="flex md:hidden items-center gap-3 px-4 shrink-0 h-[52px]" style={{ background: theme.sidebar }}>
      <button onClick={() => setDrawerOpen(true)} className="p-1 -ml-1" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: theme.sidebarMuted }}>
        <Menu size={22} />
      </button>
      <div style={{ width: 22, height: 22, borderRadius: 4, background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif' }}>S</span>
      </div>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '.5px', fontFamily: 'IBM Plex Sans, sans-serif', flex: 1 }}>senz</span>
      {notifCount > 0 && (
        <span style={{ background: '#c0392b', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {notifCount > 9 ? '9+' : notifCount}
        </span>
      )}
    </header>
  );

  const MobileBottomNav = (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden flex z-30 border-t" style={{ background: theme.sidebar, borderColor: theme.sidebarBorder }}>
      {bottomNav.map(({ to, icon: Icon, label, badge }) => (
        <NavLink key={to} to={to}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[11px] transition-colors min-h-[56px]"
          style={({ isActive }) => ({ color: isActive ? theme.accent : theme.sidebarMuted, textDecoration: 'none' })}
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
    <div className={cn('flex h-screen overflow-hidden')} style={{ background: theme.bg }}>
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
