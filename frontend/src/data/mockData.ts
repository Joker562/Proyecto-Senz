// ── Senz Mock Data ────────────────────────────────────────────────────────────

export interface MockWorkOrder {
  id: string;
  title: string;
  area: string;
  tech: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD';
  asset: string;
  date: string;
  scheduledAt?: string;
  overdue?: boolean;
}

export interface MockMaintenancePlan {
  id: string;
  name: string;
  description?: string;
  type: 'PREVENTIVE' | 'CORRECTIVE' | 'PREDICTIVE' | 'INSPECTION';
  frequency: number;
  frequencyUnit: 'days' | 'weeks' | 'months';
  nextDue: string;
  active: boolean;
  asset: { id: string; name: string; code: string; area: string };
}

export interface MockChecklistTemplateItem {
  id: string;
  order: number;
  description: string;
  required: boolean;
}

export interface MockChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  items: MockChecklistTemplateItem[];
}

export interface MockAsset {
  code: string;
  name: string;
  area: string;
  location: string;
  status: 'OPERATIONAL' | 'UNDER_MAINTENANCE' | 'OUT_OF_SERVICE';
  manufacturer: string;
  model: string;
  lastMaint: string;
}

export interface MockAudit {
  id: string;
  code: string;
  title: string;
  area: string;
  type: '5S' | 'PROCESS' | 'SAFETY';
  status: 'CLOSED' | 'SCHEDULED' | 'IN_PROGRESS';
  score: number | null;
  auditor: string;
  date: string;
}

export interface MockCapa {
  code: string;
  desc: string;
  area: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'OBSERVATION';
  status: 'OPEN' | 'IN_PROGRESS' | 'PENDING_VERIFICATION' | 'CLOSED';
  type: 'CORRECTIVE' | 'PREVENTIVE';
  due: string;
  assigned: string;
}

export interface MockOeeAsset {
  name: string;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

export interface MockOeeTrend {
  week: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
}

export interface MockDowntimeEvent {
  id: number;
  asset: string;
  type: string;
  duration: number;
  date: string;
  cause: string;
}

export interface MockVehicle {
  plate: string;
  name: string;
  type: string;
  fuel: string;
  km: number;
  nextService: number;
  area: string;
  status: 'ACTIVE' | 'IN_SERVICE' | 'OUT_OF_SERVICE';
}

export interface MockUser {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'TECHNICIAN' | 'EXECUTIVE';
  status: 'ACTIVE' | 'INACTIVE';
  lastLogin: string;
}

export interface MockAuditTrendPoint {
  month: string;
  Corte: number | null;
  Ensamble: number | null;
  Pintura: number | null;
  Almacén: number | null;
  Calidad: number | null;
}

export interface MockUpcomingAudit {
  id: string;
  title: string;
  area: string;
  auditor: string;
  date: string;
}

export interface MockRecurrence {
  desc: string;
  area: string;
  failCount: number;
}

export interface MockMonthlyCompliance {
  area: string;
  months: (number | null)[];
}

// ── Data ──────────────────────────────────────────────────────────────────────

export const mockStats = { pending: 8, inProgress: 5, completed: 47, overdue: 3 };

export const mockWorkOrders: MockWorkOrder[] = [
  { id: 'OT-0031', title: 'Cambio de filtros compresor',         area: 'Producción',  tech: 'J. López',   priority: 'MEDIUM',   status: 'PENDING',     asset: 'Compresor Principal',     date: '2026-05-05', scheduledAt: '2026-05-15' },
  { id: 'OT-0032', title: 'Revisión sellos bomba hidráulica',    area: 'Utilidades',  tech: 'M. García',  priority: 'HIGH',     status: 'IN_PROGRESS', asset: 'Bomba Hidráulica #1',     date: '2026-05-02', scheduledAt: '2026-05-12' },
  { id: 'OT-0033', title: 'Ajuste tensión banda transportadora', area: 'Producción',  tech: '—',          priority: 'CRITICAL', status: 'PENDING',     asset: 'Banda Transportadora L1', date: '2026-05-01', scheduledAt: '2026-05-20' },
  { id: 'OT-0034', title: 'Inspección eléctrica compresor',      area: 'Producción',  tech: 'J. López',   priority: 'LOW',      status: 'COMPLETED',   asset: 'Compresor Principal',     date: '2026-04-30' },
  { id: 'OT-0035', title: 'Lubricación cadena transmisión',      area: 'Ensamble',    tech: 'R. Torres',  priority: 'MEDIUM',   status: 'COMPLETED',   asset: 'Cadena Transmisión L2',   date: '2026-04-28' },
  { id: 'OT-0036', title: 'Cambio rodamiento motor principal',   area: 'Corte',       tech: 'M. García',  priority: 'HIGH',     status: 'IN_PROGRESS', asset: 'Motor Corte CNC',         date: '2026-04-27', scheduledAt: '2026-05-18' },
  { id: 'OT-0037', title: 'Calibración sensores temperatura',    area: 'Calidad',     tech: 'A. Ramírez', priority: 'MEDIUM',   status: 'PENDING',     asset: 'Sistema HVAC',            date: '2026-05-06', scheduledAt: '2026-05-22' },
  { id: 'OT-0038', title: 'Revisión sistema hidráulico prensa',  area: 'Producción',  tech: '—',          priority: 'CRITICAL', status: 'PENDING',     asset: 'Prensa Hidráulica P1',    date: '2026-04-29', overdue: true },
];

export const mockAssets: MockAsset[] = [
  { code: 'COMP-001', name: 'Compresor Principal',    area: 'Producción', location: 'Sala Máquinas A',    status: 'OPERATIONAL',      manufacturer: 'Atlas Copco', model: 'GA 37',       lastMaint: '2026-04-30' },
  { code: 'BOMB-001', name: 'Bomba Hidráulica #1',    area: 'Utilidades', location: 'Sala de Bombas',     status: 'OPERATIONAL',      manufacturer: 'Grundfos',    model: 'CR 10',       lastMaint: '2026-04-15' },
  { code: 'CONV-001', name: 'Banda Transportadora L1',area: 'Producción', location: 'Línea Producción 1', status: 'UNDER_MAINTENANCE', manufacturer: 'Interroll',   model: 'Series 3000', lastMaint: '2026-04-01' },
  { code: 'PREN-001', name: 'Prensa Hidráulica P1',   area: 'Producción', location: 'Nave Central',       status: 'OPERATIONAL',      manufacturer: 'Schuler',     model: 'S400',        lastMaint: '2026-03-20' },
  { code: 'HVAC-001', name: 'Sistema HVAC',           area: 'Calidad',    location: 'Lab. Calidad',       status: 'OPERATIONAL',      manufacturer: 'Carrier',     model: '30RB',        lastMaint: '2026-04-10' },
  { code: 'CNCM-001', name: 'Motor Corte CNC',        area: 'Corte',      location: 'Taller CNC',         status: 'UNDER_MAINTENANCE', manufacturer: 'Siemens',     model: '1PH8',        lastMaint: '2026-04-27' },
];

export const mockAudits: MockAudit[] = [
  { id: 'AUD-0001', code: 'AUD-0001', title: 'Auditoría 5S — Corte',        area: 'Corte',      type: '5S',      status: 'CLOSED',     score: 100, auditor: 'Supervisor Planta', date: '2026-04-12' },
  { id: 'AUD-0002', code: 'AUD-0002', title: 'Auditoría 5S — Ensamble',     area: 'Ensamble',   type: '5S',      status: 'CLOSED',     score: 90,  auditor: 'Supervisor Planta', date: '2026-04-14' },
  { id: 'AUD-0003', code: 'AUD-0003', title: 'Auditoría Proc. — Pintura',   area: 'Pintura',    type: 'PROCESS', status: 'CLOSED',     score: 100, auditor: 'Tecnico Juan',      date: '2026-04-16' },
  { id: 'AUD-0004', code: 'AUD-0004', title: 'Auditoría 5S — Almacén',      area: 'Almacén',    type: '5S',      status: 'CLOSED',     score: 62,  auditor: 'Supervisor Planta', date: '2026-03-12' },
  { id: 'AUD-0005', code: 'AUD-0005', title: 'Auditoría Proc. — Calidad',   area: 'Calidad',    type: 'PROCESS', status: 'CLOSED',     score: 100, auditor: 'Supervisor Planta', date: '2026-04-12' },
  { id: 'AUD-0006', code: 'AUD-0006', title: 'Auditoría 5S — Producción',   area: 'Producción', type: '5S',      status: 'SCHEDULED',  score: null, auditor: 'Supervisor Planta', date: '2026-05-08' },
  { id: 'AUD-0007', code: 'AUD-0007', title: 'Auditoría Proc. — Logística', area: 'Logística',  type: 'PROCESS', status: 'SCHEDULED',  score: null, auditor: 'Tecnico Juan',      date: '2026-05-10' },
];

export const mockCapas: MockCapa[] = [
  { code: 'CAPA-0001', desc: 'Retirar material obsoleto zona ensamble L2',     area: 'Ensamble', severity: 'CRITICAL',    status: 'CLOSED',               type: 'CORRECTIVE', due: '2026-04-10', assigned: 'Tecnico Juan' },
  { code: 'CAPA-0002', desc: 'Reasignar ubicaciones con gestión visual',       area: 'Ensamble', severity: 'MAJOR',       status: 'CLOSED',               type: 'CORRECTIVE', due: '2026-04-15', assigned: 'Tecnico Juan' },
  { code: 'CAPA-0003', desc: 'Limpiar zona recepción — pasillos bloqueados',   area: 'Almacén',  severity: 'CRITICAL',    status: 'IN_PROGRESS',          type: 'CORRECTIVE', due: '2026-05-07', assigned: 'Tecnico Juan' },
  { code: 'CAPA-0004', desc: 'Instalar señalización pasillos almacén',          area: 'Almacén',  severity: 'MAJOR',       status: 'OPEN',                 type: 'CORRECTIVE', due: '2026-04-22', assigned: 'Tecnico Juan' },
  { code: 'CAPA-0005', desc: 'Implementar tarjetas rojas en almacén',           area: 'Almacén',  severity: 'MINOR',       status: 'OPEN',                 type: 'PREVENTIVE', due: '2026-04-12', assigned: 'Supervisor Planta' },
  { code: 'CAPA-0006', desc: 'Actualizar estándar visual turno nocturno',       area: 'Ensamble', severity: 'MINOR',       status: 'PENDING_VERIFICATION', type: 'PREVENTIVE', due: '2026-04-17', assigned: 'Supervisor Planta' },
  { code: 'CAPA-0007', desc: 'Colocar recordatorio EPP entrada ensamble',       area: 'Ensamble', severity: 'OBSERVATION', status: 'OPEN',                 type: 'PREVENTIVE', due: '2026-04-27', assigned: 'Tecnico Juan' },
  { code: 'CAPA-0008', desc: 'Rediseñar zona materiales en proceso — Corte',    area: 'Corte',    severity: 'MAJOR',       status: 'CLOSED',               type: 'CORRECTIVE', due: '2026-02-15', assigned: 'Supervisor Planta' },
];

export const mockOeeAssets: MockOeeAsset[] = [
  { name: 'Prensa P1',  availability: 87, performance: 92, quality: 98,  oee: 78.4 },
  { name: 'CNC Corte',  availability: 91, performance: 85, quality: 97,  oee: 75.1 },
  { name: 'Banda L1',   availability: 72, performance: 88, quality: 99,  oee: 62.8 },
  { name: 'Compresor',  availability: 96, performance: 94, quality: 100, oee: 90.2 },
  { name: 'HVAC',       availability: 99, performance: 97, quality: 100, oee: 96.0 },
];

export const mockOeeTrend: MockOeeTrend[] = [
  { week: 'S1 Mar', oee: 71, availability: 85, performance: 88, quality: 97 },
  { week: 'S2 Mar', oee: 74, availability: 87, performance: 89, quality: 97 },
  { week: 'S3 Mar', oee: 72, availability: 84, performance: 90, quality: 96 },
  { week: 'S4 Mar', oee: 78, availability: 89, performance: 91, quality: 97 },
  { week: 'S1 Abr', oee: 75, availability: 88, performance: 88, quality: 97 },
  { week: 'S2 Abr', oee: 80, availability: 91, performance: 91, quality: 98 },
  { week: 'S3 Abr', oee: 76, availability: 87, performance: 90, quality: 97 },
  { week: 'S4 Abr', oee: 83, availability: 93, performance: 92, quality: 97 },
];

export const mockDowntimeEvents: MockDowntimeEvent[] = [
  { id: 1, asset: 'Banda L1',  type: 'Falla imprevista',  duration: 85,  date: '2026-04-28', cause: 'Rotura de banda' },
  { id: 2, asset: 'CNC Corte', type: 'Mtto planificado',  duration: 120, date: '2026-04-27', cause: 'Cambio rodamiento' },
  { id: 3, asset: 'Prensa P1', type: 'Sin operador',       duration: 45,  date: '2026-04-26', cause: 'Ausentismo turno' },
  { id: 4, asset: 'Banda L1',  type: 'Cambio de formato', duration: 30,  date: '2026-04-25', cause: 'Cambio de producto' },
  { id: 5, asset: 'CNC Corte', type: 'Falla imprevista',  duration: 55,  date: '2026-04-24', cause: 'Error software' },
  { id: 6, asset: 'Prensa P1', type: 'Falta de material', duration: 40,  date: '2026-04-23', cause: 'Retraso proveedor' },
];

export const mockVehicles: MockVehicle[] = [
  { plate: 'MNT-001', name: 'Pick-up Mantenimiento 1', type: 'Pick-up',     fuel: 'Gasolina',  km: 87420,  nextService: 90000,  area: 'Mantenimiento',  status: 'ACTIVE' },
  { plate: 'LOG-002', name: 'Camioneta Logística 2',   type: 'Camioneta',   fuel: 'Diesel',    km: 124300, nextService: 125000, area: 'Logística',      status: 'ACTIVE' },
  { plate: 'ADM-003', name: 'Sedan Administrativo',    type: 'Sedán',       fuel: 'Gasolina',  km: 45200,  nextService: 50000,  area: 'Administración', status: 'ACTIVE' },
  { plate: 'MNT-004', name: 'Montacargas Planta',      type: 'Montacargas', fuel: 'Eléctrico', km: 3120,   nextService: 5000,   area: 'Producción',     status: 'IN_SERVICE' },
  { plate: 'LOG-005', name: 'Camión Reparto',           type: 'Camión',      fuel: 'Diesel',    km: 210500, nextService: 215000, area: 'Logística',      status: 'ACTIVE' },
];

export const mockUsers: MockUser[] = [
  { id: 1, name: 'Administrador',      email: 'admin@planta.com',      role: 'ADMIN',      status: 'ACTIVE',   lastLogin: '2026-05-02' },
  { id: 2, name: 'Supervisor Planta',  email: 'supervisor@planta.com', role: 'SUPERVISOR', status: 'ACTIVE',   lastLogin: '2026-05-02' },
  { id: 3, name: 'Tecnico Juan',       email: 'tecnico@planta.com',    role: 'TECHNICIAN', status: 'ACTIVE',   lastLogin: '2026-05-01' },
  { id: 4, name: 'Director Operaciones',email: 'directivo@planta.com', role: 'EXECUTIVE',  status: 'ACTIVE',   lastLogin: '2026-04-30' },
  { id: 5, name: 'María García',       email: 'mgarcia@planta.com',    role: 'TECHNICIAN', status: 'ACTIVE',   lastLogin: '2026-05-02' },
  { id: 6, name: 'Roberto Torres',     email: 'rtorres@planta.com',    role: 'TECHNICIAN', status: 'INACTIVE', lastLogin: '2026-04-20' },
];

export const mockAuditTrend: MockAuditTrendPoint[] = [
  { month: 'Nov', Corte: 62,  Ensamble: 48, Pintura: null, Almacén: null, Calidad: null },
  { month: 'Dic', Corte: 71,  Ensamble: 55, Pintura: 80,  Almacén: null, Calidad: null },
  { month: 'Ene', Corte: 79,  Ensamble: 63, Pintura: 84,  Almacén: 52,  Calidad: null },
  { month: 'Feb', Corte: 85,  Ensamble: 72, Pintura: 87,  Almacén: 58,  Calidad: 96  },
  { month: 'Mar', Corte: 93,  Ensamble: 83, Pintura: null,Almacén: 62,  Calidad: 98  },
  { month: 'Abr', Corte: 100, Ensamble: 90, Pintura: 100, Almacén: 70,  Calidad: 100 },
];

export const mockUpcomingAudits: MockUpcomingAudit[] = [
  { id: 'AUD-0006', title: 'Auditoría 5S — Producción',   area: 'Producción', auditor: 'Supervisor Planta', date: '2026-05-08' },
  { id: 'AUD-0007', title: 'Auditoría Proc. — Logística', area: 'Logística',  auditor: 'Tecnico Juan',      date: '2026-05-10' },
  { id: 'AUD-0008', title: 'Auditoría 5S — Calidad Q2',   area: 'Calidad',    auditor: 'Supervisor Planta', date: '2026-05-14' },
];

export const mockRecurrence: MockRecurrence[] = [
  { desc: 'Materiales sin clasificar en área de trabajo', area: 'Almacén',  failCount: 5 },
  { desc: 'Pasillos parcialmente obstruidos',             area: 'Almacén',  failCount: 4 },
  { desc: 'Registros de limpieza incompletos',            area: 'Ensamble', failCount: 3 },
];

export const COMPLIANCE_MONTHS = ['Nov', 'Dic', 'Ene', 'Feb', 'Mar', 'Abr'];

export const mockMonthlyCompliance: MockMonthlyCompliance[] = [
  { area: 'Corte',      months: [62, 71, 79, 85, 93,  100] },
  { area: 'Ensamble',   months: [48, 55, 63, 72, 83,  90]  },
  { area: 'Pintura',    months: [null, 80, 84, 87, null, 100] },
  { area: 'Almacén',    months: [null, null, 52, 58, 62, 70] },
  { area: 'Calidad',    months: [null, null, null, 96, 98, 100] },
  { area: 'Logística',  months: [null, null, null, null, 74, 82] },
];

export const mockMaintenancePlans: MockMaintenancePlan[] = [
  { id: 'PM-001', name: 'Cambio de aceite y filtros',  description: 'Mantenimiento trimestral de lubricación', type: 'PREVENTIVE',  frequency: 3,  frequencyUnit: 'months', nextDue: '2026-05-18', active: true, asset: { id: 'a1', name: 'Compresor Principal',     code: 'COMP-001', area: 'Producción' } },
  { id: 'PM-002', name: 'Inspección filtro de aire',   description: 'Revisión y limpieza mensual',             type: 'INSPECTION',  frequency: 1,  frequencyUnit: 'months', nextDue: '2026-05-30', active: true, asset: { id: 'a1', name: 'Compresor Principal',     code: 'COMP-001', area: 'Producción' } },
  { id: 'PM-003', name: 'Revisión de sellos y empaques',                                                       type: 'PREVENTIVE',  frequency: 6,  frequencyUnit: 'months', nextDue: '2026-06-15', active: true, asset: { id: 'a2', name: 'Bomba Hidráulica #1',     code: 'BOMB-001', area: 'Utilidades' } },
  { id: 'PM-004', name: 'Lubricación y tensión de cadena',                                                     type: 'PREVENTIVE',  frequency: 2,  frequencyUnit: 'weeks',  nextDue: '2026-05-10', active: true, asset: { id: 'a3', name: 'Banda Transportadora L1', code: 'CONV-001', area: 'Producción' } },
  { id: 'PM-005', name: 'Calibración de sensores',     description: 'Predictivo trimestral',                  type: 'PREDICTIVE',  frequency: 3,  frequencyUnit: 'months', nextDue: '2026-04-30', active: true, asset: { id: 'a5', name: 'Sistema HVAC',            code: 'HVAC-001', area: 'Calidad' } },
  { id: 'PM-006', name: 'Inspección eléctrica general',                                                        type: 'INSPECTION',  frequency: 1,  frequencyUnit: 'months', nextDue: '2026-05-25', active: true, asset: { id: 'a4', name: 'Prensa Hidráulica P1',   code: 'PREN-001', area: 'Producción' } },
  { id: 'PM-007', name: 'Cambio de rodamientos',       description: 'Mantenimiento anual',                    type: 'PREVENTIVE',  frequency: 12, frequencyUnit: 'months', nextDue: '2026-04-27', active: true, asset: { id: 'a6', name: 'Motor Corte CNC',         code: 'CNCM-001', area: 'Corte' } },
];

export const mockChecklistTemplates: MockChecklistTemplate[] = [
  {
    id: 'CHK-001', name: 'Inspección diaria compresor', description: 'Revisión de rutina al inicio del turno',
    items: [
      { id: 'ci1', order: 1, description: 'Verificar nivel de aceite',               required: true  },
      { id: 'ci2', order: 2, description: 'Revisar presión de trabajo',               required: true  },
      { id: 'ci3', order: 3, description: 'Inspeccionar mangueras y conexiones',      required: true  },
      { id: 'ci4', order: 4, description: 'Limpiar filtro de aire',                   required: false },
      { id: 'ci5', order: 5, description: 'Registrar temperatura de operación',       required: false },
    ],
  },
  {
    id: 'CHK-002', name: 'Mantenimiento mensual banda transportadora', description: 'Checklist de mantenimiento preventivo mensual',
    items: [
      { id: 'bi1', order: 1, description: 'Verificar tensión de banda',               required: true  },
      { id: 'bi2', order: 2, description: 'Lubricar rodillos de guía',                required: true  },
      { id: 'bi3', order: 3, description: 'Inspeccionar raspadores',                  required: true  },
      { id: 'bi4', order: 4, description: 'Revisar estado de banda (desgaste, cortes)', required: true },
      { id: 'bi5', order: 5, description: 'Verificar alineación',                     required: false },
      { id: 'bi6', order: 6, description: 'Probar sensores de velocidad',             required: false },
    ],
  },
  {
    id: 'CHK-003', name: 'Revisión sistema hidráulico',
    items: [
      { id: 'hi1', order: 1, description: 'Nivel de fluido hidráulico',               required: true  },
      { id: 'hi2', order: 2, description: 'Revisar mangueras por fugas',              required: true  },
      { id: 'hi3', order: 3, description: 'Presión del sistema en operación',         required: true  },
      { id: 'hi4', order: 4, description: 'Condición del aceite (color, olor)',       required: false },
    ],
  },
];

// ── Maps ──────────────────────────────────────────────────────────────────────

export const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:              { label: 'Pendiente',     color: '#e67e22', bg: '#fef3e7' },
  IN_PROGRESS:          { label: 'En Progreso',   color: '#2980b9', bg: '#e8f4fd' },
  ON_HOLD:              { label: 'En Espera',     color: '#8b5cf6', bg: '#f3eeff' },
  COMPLETED:            { label: 'Completada',    color: '#27ae60', bg: '#e9f7ef' },
  CANCELLED:            { label: 'Cancelada',     color: '#6b7280', bg: '#f3f4f6' },
  SCHEDULED:            { label: 'Programada',    color: '#2980b9', bg: '#e8f4fd' },
  CLOSED:               { label: 'Cerrada',       color: '#27ae60', bg: '#e9f7ef' },
  OPEN:                 { label: 'Abierta',       color: '#e67e22', bg: '#fef3e7' },
  PENDING_VERIFICATION: { label: 'Pend. Verif.',  color: '#2980b9', bg: '#e8f4fd' },
  ACTIVE:               { label: 'Activo',        color: '#27ae60', bg: '#e9f7ef' },
  OPERATIONAL:          { label: 'Operativo',     color: '#27ae60', bg: '#e9f7ef' },
  UNDER_MAINTENANCE:    { label: 'En Mantto.',    color: '#8b5cf6', bg: '#f3eeff' },
  IN_SERVICE:           { label: 'En Servicio',   color: '#8b5cf6', bg: '#f3eeff' },
  OUT_OF_SERVICE:       { label: 'Fuera de Servicio', color: '#c0392b', bg: '#fde8e6' },
  INACTIVE:             { label: 'Inactivo',      color: '#6b7280', bg: '#f3f4f6' },
};

export const PRI_MAP: Record<string, { color: string; label: string }> = {
  LOW:      { color: '#27ae60', label: 'Baja' },
  MEDIUM:   { color: '#e67e22', label: 'Media' },
  HIGH:     { color: '#f97316', label: 'Alta' },
  CRITICAL: { color: '#c0392b', label: 'Crítica' },
};

export const SEV_MAP: Record<string, { color: string; bg: string; label: string }> = {
  CRITICAL:    { color: '#c0392b', bg: '#fde8e6', label: 'Crítica' },
  MAJOR:       { color: '#f97316', bg: '#fff3ec', label: 'Mayor' },
  MINOR:       { color: '#2980b9', bg: '#e8f4fd', label: 'Menor' },
  OBSERVATION: { color: '#6b7280', bg: '#f3f4f6', label: 'Observación' },
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN:      'Administrador',
  SUPERVISOR: 'Supervisor',
  TECHNICIAN: 'Técnico',
  EXECUTIVE:  'Directivo',
};
