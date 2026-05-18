import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Car, BarChart3, Truck, AlertTriangle } from 'lucide-react';
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
import PlaceholderPage from '@/pages/PlaceholderPage';
import AuditsPage from '@/pages/AuditsPage';
import AuditDetailPage from '@/pages/AuditDetailPage';
import AuditFindingsPage from '@/pages/AuditFindingsPage';
import AuditTemplatesPage from '@/pages/AuditTemplatesPage';
import ReporteCapasPage from '@/pages/ReporteCapasPage';
import ReporteMensualPage from '@/pages/ReporteMensualPage';
import AuditsCalendarPage from '@/pages/AuditsCalendarPage';
import OEEDashboardPage from '@/pages/OEEDashboardPage';
import FleetDashboardPage from '@/pages/FleetDashboardPage';
import '@/index.css';

// ─── Guardia de autenticación ─────────────────────────────────────────────────

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
}

// ─── Guardia de permisos (bloquea acceso directo por URL) ─────────────────────

function PermissionGuard({ moduleKey, children }: { moduleKey: PermKey; children: React.ReactNode }) {
  const { user }                    = useAuth();
  const { hasPermission, loaded }   = usePermissions();

  // Mientras los permisos no carguen no redirigir (evitar parpadeo)
  if (!loaded) return null;

  if (!hasPermission(user?.role, moduleKey)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

// ─── Páginas placeholder ──────────────────────────────────────────────────────

const FleetVehiclesPage = () => (
  <PlaceholderPage icon={Truck} title="Vehículos"
    subtitle="Gestión completa del catálogo de vehículos: registro, datos técnicos y seguimiento de kilometraje."
    features={[
      { label: 'Registro de vehículos', description: 'Placa, VIN, marca, modelo, año, tipo de combustible y área asignada.' },
      { label: 'Control de kilometraje', description: 'Registro de km actuales para disparar alertas de mantenimiento preventivo.' },
      { label: 'Historial de servicios', description: 'Todo el historial de órdenes de trabajo y costos asociados por vehículo.' },
    ]} />
);

const FleetWorkOrdersPage = () => (
  <PlaceholderPage icon={Car} title="OT de Vehículos"
    subtitle="Órdenes de trabajo específicas para mantenimiento preventivo y correctivo de la flota vehicular."
    features={[
      { label: 'Tipos de servicio', description: 'Cambio de aceite, frenos, llantas, revisión técnica, reparaciones.' },
      { label: 'Costo de servicio', description: 'Registro de costo estimado vs. real por orden de trabajo.' },
      { label: 'Km al servicio', description: 'Registro del kilometraje al momento de cada intervención.' },
    ]} />
);

const FleetPlansPage = () => (
  <PlaceholderPage icon={Car} title="Planes de Servicio"
    subtitle="Configuración de mantenimientos preventivos automáticos por intervalo de tiempo o kilometraje."
    features={[
      { label: 'Trigger por km', description: 'Generar OT automáticamente al alcanzar un umbral de kilometraje.' },
      { label: 'Trigger por tiempo', description: 'Mantenimientos periódicos por fecha: cada 3 meses, semestral, anual.' },
      { label: 'Notificaciones anticipadas', description: 'Alertas al acercarse al próximo servicio para planificar con anticipación.' },
    ]} />
);

const OEERecordsPage = () => (
  <PlaceholderPage icon={BarChart3} title="Registros OEE"
    subtitle="Ingreso diario de datos productivos por equipo y turno para el cálculo de OEE."
    features={[
      { label: 'Formulario de turno', description: 'Tiempo planificado, unidades producidas, piezas defectuosas y tiempo de ciclo ideal.' },
      { label: 'Cálculo automático', description: 'El sistema calcula disponibilidad, rendimiento, calidad y OEE al guardar.' },
      { label: 'Asociación a activos', description: 'Cada registro se vincula a un equipo existente del catálogo de activos.' },
    ]} accentColor="#2980b9" />
);

const OEEDowntimePage = () => (
  <PlaceholderPage icon={AlertTriangle} title="Eventos de Paro"
    subtitle="Registro y categorización de los paros de producción para análisis de causas raíz."
    features={[
      { label: 'Tipos de paro', description: 'Mantenimiento planificado, falla imprevista, cambio de formato, falta de material, sin operador.' },
      { label: 'Duración exacta', description: 'Hora de inicio y fin del paro para calcular minutos de downtime con precisión.' },
      { label: 'Análisis de Pareto', description: 'Visualización de las causas más frecuentes para priorizar mejoras.' },
    ]} accentColor="#2980b9" />
);


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
            <Route path="fleet/vehicles"    element={
              <PermissionGuard moduleKey="fleet"><FleetVehiclesPage /></PermissionGuard>
            } />
            <Route path="fleet/work-orders" element={
              <PermissionGuard moduleKey="fleet"><FleetWorkOrdersPage /></PermissionGuard>
            } />
            <Route path="fleet/plans"       element={
              <PermissionGuard moduleKey="fleet"><FleetPlansPage /></PermissionGuard>
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
