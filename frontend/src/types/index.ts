export type Role = 'ADMIN' | 'SUPERVISOR' | 'TECHNICIAN' | 'EXECUTIVE';
export type WorkOrderStatus = 'PENDING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type WorkOrderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE' | 'PREDICTIVE' | 'INSPECTION';
export type Periodicidad = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
export type AssetStatus = 'OPERATIONAL' | 'UNDER_MAINTENANCE' | 'OUT_OF_SERVICE' | 'DECOMMISSIONED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  description?: string;
  location: string;
  area: string;
  status: AssetStatus;
  manufacturer?: string;
  model?: string;
  _count?: { workOrders: number };
}

export interface WorkOrder {
  id: string;
  code: string;
  title: string;
  description: string;
  type: MaintenanceType;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  estimatedHours?: number;
  actualHours?: number;
  periodicidad?: Periodicidad;
  asset: Asset;
  assignedTo?: Pick<User, 'id' | 'name'>;
  createdBy: Pick<User, 'id' | 'name'>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderStats {
  total: number;
  byStatus: { status: WorkOrderStatus; _count: number }[];
  byPriority: { priority: WorkOrderPriority; _count: number }[];
  overdue: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

// ─── Módulo Auditorías ────────────────────────────────────────────────────────

export type AuditType     = 'FIVE_S' | 'PROCESS';
export type AuditStatus   = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';
export type AuditResult   = 'PASS' | 'FAIL' | 'NA';
export type CapaType      = 'CORRECTIVE' | 'PREVENTIVE';
export type CapaStatus    = 'OPEN' | 'IN_PROGRESS' | 'PENDING_VERIFICATION' | 'CLOSED';
export type CapaSeverity  = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'OBSERVATION';

export interface AuditTemplateItem {
  id: string;
  order: number;
  description: string;
}

export interface AuditTemplateSection {
  id: string;
  order: number;
  name: string;
  isBehavior: boolean;
  items: AuditTemplateItem[];
}

export interface AuditTemplate {
  id: string;
  name: string;
  type: AuditType;
  isDefault: boolean;
  sections: AuditTemplateSection[];
}

export interface AuditItem {
  id: string;
  order: number;
  description: string;
  result: AuditResult | null;
  notes: string | null;
  checkedAt: string | null;
  checkedBy?: Pick<User, 'id' | 'name'> | null;
  capaActions?: CapaAction[];
}

export interface AuditSection {
  id: string;
  order: number;
  name: string;
  isBehavior: boolean;
  items: AuditItem[];
}

export interface CapaAction {
  id: string;
  code: string;
  type: CapaType;
  description: string;
  rootCause: string | null;
  severity: CapaSeverity;
  status: CapaStatus;
  dueDate: string;
  closedAt: string | null;
  closingNotes: string | null;
  auditId: string;
  audit?: { id: string; code: string; title: string; area: string; type: AuditType };
  auditItemId: string | null;
  auditItem?: Pick<AuditItem, 'id' | 'description'> | null;
  assignedTo: Pick<User, 'id' | 'name'>;
  createdBy: Pick<User, 'id' | 'name'>;
  createdAt: string;
  updatedAt: string;
}

export interface Audit {
  id: string;
  code: string;
  title: string;
  type: AuditType;
  status: AuditStatus;
  area: string;
  score: number | null;
  notes: string | null;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  auditor: Pick<User, 'id' | 'name'>;
  template?: Pick<AuditTemplate, 'id' | 'name'> | null;
  sections?: AuditSection[];
  capaActions?: CapaAction[];
  _count?: { capaActions: number };
  createdAt: string;
  updatedAt: string;
}

export interface AuditDashboard {
  totalAudits: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byArea: { area: string; count: number; avgScore: number | null }[];
  capaStats: {
    total: number;
    open: number;
    inProgress: number;
    pendingVerification: number;
    closed: number;
    overdue: number;
  };
  recentAudits: Audit[];
}
