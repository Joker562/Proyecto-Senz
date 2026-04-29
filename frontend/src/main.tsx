import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Car, BarChart3, Truck, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
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
import '@/index.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
}

// ─── Páginas placeholder de Flota ────────────────────────────────────────────

const FleetDashboardPage = () => (
  <PlaceholderPage
    icon={Car}
    title="Dashboard de Flota"
    subtitle="Visibilidad en tiempo real del estado y rendimiento de todos los vehículos de la empresa."
    features={[
      { label: 'Estado de la flota', description: 'Resumen de vehículos operativos, en servicio y fuera de línea.' },
      { label: 'Próximos servicios', description: 'Alertas de vehículos que se acercan a su próximo mantenimiento por km o fecha.' },
      { label: 'KPIs de flota', description: 'Costo por vehículo, historial de servicios y disponibilidad de la flota.' },
    ]}
  />
);

const FleetVehiclesPage = () => (
  <PlaceholderPage
    icon={Truck}
    title="Vehículos"
    subtitle="Gestión completa del catálogo de vehículos: registro, datos técnicos y seguimiento de kilometraje."
    features={[
      { label: 'Registro de vehículos', description: 'Placa, VIN, marca, modelo, año, tipo de combustible y área asignada.' },
      { label: 'Control de kilometraje', description: 'Registro de km actuales para disparar alertas de mantenimiento preventivo.' },
      { label: 'Historial de servicios', description: 'Todo el historial de órdenes de trabajo y costos asociados por vehículo.' },
    ]}
  />
);

const FleetWorkOrdersPage = () => (
  <PlaceholderPage
    icon={Car}
    title="OT de Vehículos"
    subtitle="Órdenes de trabajo específicas para mantenimiento preventivo y correctivo de la flota vehicular."
    features={[
      { label: 'Tipos de servicio', description: 'Cambio de aceite, frenos, llantas, revisión técnica, reparaciones.' },
      { label: 'Costo de servicio', description: 'Registro de costo estimado vs. real por orden de trabajo.' },
      { label: 'Km al servicio', description: 'Registro del kilometraje al momento de cada intervención.' },
    ]}
  />
);

const FleetPlansPage = () => (
  <PlaceholderPage
    icon={Car}
    title="Planes de Servicio"
    subtitle="Configuración de mantenimientos preventivos automáticos por intervalo de tiempo o kilometraje."
    features={[
      { label: 'Trigger por km', description: 'Generar OT automáticamente al alcanzar un umbral de kilometraje (ej. cada 5,000 km).' },
      { label: 'Trigger por tiempo', description: 'Mantenimientos periódicos por fecha: cada 3 meses, semestral, anual.' },
      { label: 'Notificaciones anticipadas', description: 'Alertas al acercarse al próximo servicio para planificar con anticipación.' },
    ]}
  />
);

// ─── Páginas placeholder de OEE ──────────────────────────────────────────────

const OEEDashboardPage = () => (
  <PlaceholderPage
    icon={BarChart3}
    title="Dashboard OEE"
    subtitle="Overall Equipment Effectiveness — visualización de disponibilidad, rendimiento y calidad de cada equipo."
    features={[
      { label: 'OEE en tiempo real', description: 'Gráfica de OEE por equipo y por turno actualizada al ingresar datos.' },
      { label: 'Desglose A × R × C', description: 'Disponibilidad, Rendimiento y Calidad visualizados por separado para identificar pérdidas.' },
      { label: 'Tendencia histórica', description: 'Evolución del OEE semana a semana y comparación entre equipos.' },
    ]}
    accentColor="#2980b9"
  />
);

const OEERecordsPage = () => (
  <PlaceholderPage
    icon={BarChart3}
    title="Registros OEE"
    subtitle="Ingreso diario de datos productivos por equipo y turno para el cálculo de OEE."
    features={[
      { label: 'Formulario de turno', description: 'Tiempo planificado, unidades producidas, piezas defectuosas y tiempo de ciclo ideal.' },
      { label: 'Cálculo automático', description: 'El sistema calcula disponibilidad, rendimiento, calidad y OEE al guardar.' },
      { label: 'Asociación a activos', description: 'Cada registro se vincula a un equipo existente del catálogo de activos.' },
    ]}
    accentColor="#2980b9"
  />
);

const OEEDowntimePage = () => (
  <PlaceholderPage
    icon={AlertTriangle}
    title="Eventos de Paro"
    subtitle="Registro y categorización de los paros de producción para análisis de causas raíz."
    features={[
      { label: 'Tipos de paro', description: 'Mantenimiento planificado, falla imprevista, cambio de formato, falta de material, sin operador.' },
      { label: 'Duración exacta', description: 'Hora de inicio y fin del paro para calcular minutos de downtime con precisión.' },
      { label: 'Análisis de Pareto', description: 'Visualización de las causas más frecuentes para priorizar mejoras.' },
    ]}
    accentColor="#2980b9"
  />
);


// ─── Router ───────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* Mantenimiento (módulo existente) */}
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="work-orders" element={<WorkOrdersPage />} />
          <Route path="work-orders/:id" element={<WorkOrderDetailPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="checklists" element={<ChecklistTemplatesPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="settings" element={<SettingsPage />} />

          {/* Flota */}
          <Route path="fleet" element={<FleetDashboardPage />} />
          <Route path="fleet/vehicles" element={<FleetVehiclesPage />} />
          <Route path="fleet/work-orders" element={<FleetWorkOrdersPage />} />
          <Route path="fleet/plans" element={<FleetPlansPage />} />

          {/* OEE */}
          <Route path="oee" element={<OEEDashboardPage />} />
          <Route path="oee/records" element={<OEERecordsPage />} />
          <Route path="oee/downtime" element={<OEEDowntimePage />} />

          {/* Auditorías */}
          <Route path="audits" element={<AuditsPage />} />
          <Route path="audits/findings" element={<AuditFindingsPage />} />
          <Route path="audits/templates" element={<AuditTemplatesPage />} />
          <Route path="audits/reports/capas" element={<ReporteCapasPage />} />
          <Route path="audits/reports/monthly" element={<ReporteMensualPage />} />
          <Route path="audits/:id" element={<AuditDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
