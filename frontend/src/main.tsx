import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions, type PermKey } from '@/hooks/usePermissions';
import { ThemeProvider } from '@/theme/ThemeContext';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import WorkOrdersPage from '@/pages/WorkOrdersPage';
import AssetsPage from '@/pages/AssetsPage';
import MaintenancePage from '@/pages/MaintenancePage';
import CalendarPage from '@/pages/CalendarPage';
import ChecklistTemplatesPage from '@/pages/ChecklistTemplatesPage';
import UsersPage from '@/pages/UsersPage';
import SettingsPage from '@/pages/SettingsPage';
import WorkOrderDetailPage from '@/pages/WorkOrderDetailPage';
import AuditsPage from '@/pages/AuditsPage';
import AuditDetailPage from '@/pages/AuditDetailPage';
import AuditFindingsPage from '@/pages/AuditFindingsPage';
import AuditTemplatesPage from '@/pages/AuditTemplatesPage';
import ReporteCapasPage from '@/pages/ReporteCapasPage';
import ReporteMensualPage from '@/pages/ReporteMensualPage';
import AuditsCalendarPage from '@/pages/AuditsCalendarPage';
import OEEDashboardPage   from '@/pages/OEEDashboardPage';
import OEERecordsPage     from '@/pages/oee/OEERecordsPage';
import OEEDowntimePage    from '@/pages/oee/OEEDowntimePage';
import OEEReportsPage     from '@/pages/oee/OEEReportsPage';
import FleetDashboardPage    from '@/pages/fleet/FleetDashboardPage';
import FleetVehiclesPage     from '@/pages/fleet/FleetVehiclesPage';
import FleetFuelPage         from '@/pages/fleet/FleetFuelPage';
import FleetMaintenancePage  from '@/pages/fleet/FleetMaintenancePage';
import FleetAlertsPage       from '@/pages/fleet/FleetAlertsPage';
import FleetReportsPage      from '@/pages/fleet/FleetReportsPage';
import VehicleDetailPage     from '@/pages/fleet/VehicleDetailPage';
import '@/index.css';

// ─── Guardia de autenticación ─────────────────────────────────────────────────

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
}

// ─── Guardia de permisos (bloquea acceso directo por URL) ─────────────────────

function PermissionGuard({ moduleKey, children }: { moduleKey: PermKey; children: React.ReactNode }) {
  const { user }            = useAuth();
  const { hasPermission }   = usePermissions();

  // Usa DEFAULT_PERMISSIONS inmediatamente (sin pantalla en blanco al cargar)
  if (!hasPermission(user?.role, moduleKey)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

// OEERecordsPage y OEEDowntimePage ahora son páginas reales (importadas arriba)


// ─── Router ───────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* ── Mantenimiento ─────────────────────────────────────────── */}
            <Route path="dashboard"   element={<DashboardPage />} />
            <Route path="work-orders" element={<WorkOrdersPage />} />
            <Route path="work-orders/:id" element={<WorkOrderDetailPage />} />
            <Route path="assets"      element={
              <PermissionGuard moduleKey="assets"><AssetsPage /></PermissionGuard>
            } />
            <Route path="maintenance" element={
              <PermissionGuard moduleKey="maintenance"><MaintenancePage /></PermissionGuard>
            } />
            <Route path="calendar"    element={
              <PermissionGuard moduleKey="calendar"><CalendarPage /></PermissionGuard>
            } />
            <Route path="checklists"  element={
              <PermissionGuard moduleKey="checklists"><ChecklistTemplatesPage /></PermissionGuard>
            } />

            {/* ── Admin ─────────────────────────────────────────────────── */}
            <Route path="users"    element={
              <PermissionGuard moduleKey="users"><UsersPage /></PermissionGuard>
            } />
            <Route path="settings" element={
              <PermissionGuard moduleKey="settings"><SettingsPage /></PermissionGuard>
            } />

            {/* ── Flota ─────────────────────────────────────────────────── */}
            <Route path="fleet" element={
              <PermissionGuard moduleKey="fleet"><FleetDashboardPage /></PermissionGuard>
            } />
            <Route path="fleet/vehicles" element={
              <PermissionGuard moduleKey="fleet"><FleetVehiclesPage /></PermissionGuard>
            } />
            <Route path="fleet/vehicles/:id" element={
              <PermissionGuard moduleKey="fleet"><VehicleDetailPage /></PermissionGuard>
            } />
            <Route path="fleet/fuel" element={
              <PermissionGuard moduleKey="fleet"><FleetFuelPage /></PermissionGuard>
            } />
            <Route path="fleet/maintenance" element={
              <PermissionGuard moduleKey="fleet"><FleetMaintenancePage /></PermissionGuard>
            } />
            <Route path="fleet/alerts" element={
              <PermissionGuard moduleKey="fleet"><FleetAlertsPage /></PermissionGuard>
            } />
            <Route path="fleet/reports" element={
              <PermissionGuard moduleKey="fleet"><FleetReportsPage /></PermissionGuard>
            } />

            {/* ── OEE ───────────────────────────────────────────────────── */}
            <Route path="oee" element={
              <PermissionGuard moduleKey="oee"><OEEDashboardPage /></PermissionGuard>
            } />
            <Route path="oee/records"  element={
              <PermissionGuard moduleKey="oee"><OEERecordsPage /></PermissionGuard>
            } />
            <Route path="oee/downtime" element={
              <PermissionGuard moduleKey="oee"><OEEDowntimePage /></PermissionGuard>
            } />
            <Route path="oee/reports" element={
              <PermissionGuard moduleKey="oee"><OEEReportsPage /></PermissionGuard>
            } />

            {/* ── Auditorías ────────────────────────────────────────────── */}
            <Route path="audits" element={
              <PermissionGuard moduleKey="audits"><AuditsPage /></PermissionGuard>
            } />
            <Route path="audits/calendar"  element={
              <PermissionGuard moduleKey="audits"><AuditsCalendarPage /></PermissionGuard>
            } />
            <Route path="audits/findings"  element={
              <PermissionGuard moduleKey="audits"><AuditFindingsPage /></PermissionGuard>
            } />
            <Route path="audits/templates" element={
              <PermissionGuard moduleKey="audits"><AuditTemplatesPage /></PermissionGuard>
            } />
            <Route path="audits/reports/capas"   element={
              <PermissionGuard moduleKey="audits"><ReporteCapasPage /></PermissionGuard>
            } />
            <Route path="audits/reports/monthly" element={
              <PermissionGuard moduleKey="audits"><ReporteMensualPage /></PermissionGuard>
            } />
            <Route path="audits/:id" element={
              <PermissionGuard moduleKey="audits"><AuditDetailPage /></PermissionGuard>
            } />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
