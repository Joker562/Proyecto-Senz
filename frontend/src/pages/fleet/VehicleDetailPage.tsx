import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Car, Droplets, Wrench, User, Clock, CheckCircle, AlertTriangle, Plus, XCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LineChartSVG } from '@/components/ui/LineChartSVG';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import FuelLogModal from '@/components/fleet/FuelLogModal';
import StartTripModal from '@/components/fleet/StartTripModal';
import CloseTripModal, { type TripToClose } from '@/components/fleet/CloseTripModal';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PersonRef { id: string; name: string }

interface FuelLog {
  id: string; date: string; liters: number; pricePerLiter: number;
  totalCost: number; kmAtFuel: number; station: string | null;
  invoiceNumber: string | null; notes: string | null;
  loggedBy: PersonRef;
}

interface TripLog {
  id: string; startTime: string; endTime: string | null;
  origin: string; destination: string; purpose: string | null;
  startKm: number; endKm: number | null; distance: number | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  driver: PersonRef;
  authorizedBy: PersonRef | null;
  notes: string | null;
}

interface Assignment {
  id: string; startDate: string; endDate: string | null;
  type: string; notes: string | null;
  driver: PersonRef; createdBy: PersonRef;
}

interface VehicleDetail {
  id: string; code: string; plate: string; brand: string; model: string;
  year: number; color: string | null; type: string; status: string;
  fuelType: string; tankCapacity: number | null; currentKm: number;
  area: string | null;
  insuranceExpiry: string | null; verificationExpiry: string | null;
  licenseExpiry: string | null; circulationCard: string | null;
  driver: (PersonRef & { email: string }) | null;
  assignments: Assignment[];
  fuelLogs: FuelLog[];
  tripLogs: TripLog[];
}

interface ActivePlan {
  id: string; name: string; triggerType: string;
  nextDue: string | null; usageThreshold: number | null;
  usageUnit: string | null; frequency: number | null; frequencyUnit: string | null;
}

interface MaintWorkOrder {
  id: string; code: string; title: string;
  status: string; priority: string;
  scheduledAt: string | null; completedAt: string | null;
  assignedTo: PersonRef | null; createdBy: PersonRef;
  maintenancePlan: { id: string; name: string } | null;
  createdAt: string;
}

interface MaintenanceData {
  vehicle: { id: string; code: string; currentKm: number };
  stats: { total: number; pending: number; inProgress: number; completed: number };
  activePlans: ActivePlan[];
  workOrders: MaintWorkOrder[];
}

// ── Constantes de presentación ────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  AVAILABLE:      { label: 'Disponible',       color: '#27ae60', bg: '#e8f8f0' },
  IN_USE:         { label: 'En uso',            color: '#2980b9', bg: '#e8f2fb' },
  MAINTENANCE:    { label: 'Mantenimiento',     color: '#e67e22', bg: '#fef3e7' },
  OUT_OF_SERVICE: { label: 'Fuera de servicio', color: '#c0392b', bg: '#fdecea' },
};

const TYPE_LABELS: Record<string, string> = {
  TRUCK: 'Camión', VAN: 'Camioneta', CAR: 'Automóvil', FORKLIFT: 'Montacargas', OTHER: 'Otro',
};

const FUEL_LABELS: Record<string, string> = {
  DIESEL: 'Diésel', GASOLINE: 'Gasolina', ELECTRIC: 'Eléctrico', HYBRID: 'Híbrido',
};

const WO_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:     { label: 'Pendiente',    color: '#7f8c8d', bg: '#f2f3f3' },
  IN_PROGRESS: { label: 'En proceso',   color: '#2980b9', bg: '#e8f2fb' },
  ON_HOLD:     { label: 'En espera',    color: '#e67e22', bg: '#fef3e7' },
  COMPLETED:   { label: 'Completada',   color: '#27ae60', bg: '#e8f8f0' },
  CANCELLED:   { label: 'Cancelada',    color: '#c0392b', bg: '#fdecea' },
};

const TRIP_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  IN_PROGRESS: { label: 'En curso',  color: '#2980b9', bg: '#e8f2fb' },
  COMPLETED:   { label: 'Completado',color: '#27ae60', bg: '#e8f8f0' },
  CANCELLED:   { label: 'Cancelado', color: '#c0392b', bg: '#fdecea' },
};

const URGENCY_MAP = {
  OVERDUE:  { label: 'VENCIDO',  color: '#c0392b', bg: '#fdecea' },
  CRITICAL: { label: 'CRÍTICO',  color: '#e67e22', bg: '#fef3e7' },
  WARNING:  { label: 'PRÓXIMO',  color: '#f39c12', bg: '#fff8e1' },
  OK:       { label: 'OK',       color: '#27ae60', bg: '#e8f8f0' },
} as const;

// ── Funciones auxiliares ──────────────────────────────────────────────────────

function docInfo(dateStr: string | null) {
  if (!dateStr) return { label: 'N/D', color: 'var(--sz-muted)', bg: 'transparent', dot: '#ccc' };
  const daysLeft = Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0)  return { label: `Venció hace ${Math.abs(daysLeft)}d`, color: '#c0392b', bg: '#fdecea', dot: '#c0392b' };
  if (daysLeft < 7)  return { label: `Vence en ${daysLeft}d ⚠`, color: '#c0392b', bg: '#fdecea', dot: '#c0392b' };
  if (daysLeft < 30) return { label: `${daysLeft} días`, color: '#e67e22', bg: '#fef3e7', dot: '#e67e22' };
  return {
    label: new Date(dateStr).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }),
    color: '#27ae60', bg: '#e8f8f0', dot: '#27ae60',
  };
}

function planUrgency(plan: ActivePlan, currentKm: number): keyof typeof URGENCY_MAP {
  let daysLeft: number | null = null;
  let kmLeft: number | null   = null;

  if (plan.nextDue) {
    daysLeft = Math.floor((new Date(plan.nextDue).getTime() - Date.now()) / 86400000);
  }
  if (plan.usageThreshold != null && plan.usageUnit === 'km') {
    kmLeft = plan.usageThreshold - currentKm;
  }

  const overdue  = (daysLeft !== null && daysLeft < 0)  || (kmLeft !== null && kmLeft <= 0);
  const critical = (daysLeft !== null && daysLeft <= 7)  || (kmLeft !== null && kmLeft <= 500);
  const warning  = (daysLeft !== null && daysLeft <= 30) || (kmLeft !== null && kmLeft <= Math.min((plan.usageThreshold ?? 1) * 0.15, 1500));

  if (overdue)  return 'OVERDUE';
  if (critical) return 'CRITICAL';
  if (warning)  return 'WARNING';
  return 'OK';
}

// ── Tab system ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'ficha',         label: 'Ficha técnica',  Icon: Car },
  { key: 'combustible',   label: 'Combustible',    Icon: Droplets },
  { key: 'viajes',        label: 'Viajes',         Icon: Clock },
  { key: 'mantenimiento', label: 'Mantenimiento',  Icon: Wrench },
  { key: 'conductor',     label: 'Conductor',      Icon: User },
] as const;

type TabKey = typeof TABS[number]['key'];

// ── Componente principal ──────────────────────────────────────────────────────

export default function VehicleDetailPage() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const toast        = useToast();

  const [vehicle,   setVehicle]   = useState<VehicleDetail | null>(null);
  const [maintData, setMaintData] = useState<MaintenanceData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('ficha');

  // Modal states
  const [fuelModal,      setFuelModal]      = useState(false);
  const [startTripModal, setStartTripModal] = useState(false);
  const [closeTrip,      setCloseTrip]      = useState<TripToClose | null>(null);

  // ── Carga de datos ──────────────────────────────────────────────────────

  const loadVehicle = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [vRes, mRes] = await Promise.all([
        api.get<VehicleDetail>(`/fleet/vehicles/${id}`),
        api.get<MaintenanceData>(`/fleet/maintenance/${id}`).catch(() => ({ data: null })),
      ]);
      setVehicle(vRes.data);
      setMaintData(mRes.data);
    } catch {
      toast.push('Error al cargar los datos del vehículo', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { loadVehicle(); }, [loadVehicle]);

  // ── Datos derivados ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100%', background: 'var(--sz-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--sz-muted)', fontSize: 13 }}>Cargando vehículo...</span>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div style={{ minHeight: '100%', background: 'var(--sz-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <AlertTriangle size={32} style={{ color: '#c0392b' }} />
        <span style={{ color: 'var(--sz-text)', fontSize: 14, fontWeight: 600 }}>Vehículo no encontrado</span>
        <button onClick={() => navigate('/fleet/vehicles')} style={{ fontSize: 12, color: 'var(--sz-accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          Volver a la lista
        </button>
      </div>
    );
  }

  const status = STATUS_MAP[vehicle.status] ?? { label: vehicle.status, color: '#888', bg: '#f0f0f0' };

  // Fuel chart data: fuelLogs come DESC, reverse for chart
  const ascFuelLogs = [...vehicle.fuelLogs].reverse();
  const fuelChartData = ascFuelLogs.reduce<{ label: string; kmL: number }[]>((acc, log, i) => {
    if (i === 0) return acc;
    const prev = ascFuelLogs[i - 1];
    const km   = log.kmAtFuel - prev.kmAtFuel;
    if (km > 0 && log.liters > 0) {
      acc.push({
        label: new Date(log.date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
        kmL:   Number((km / log.liters).toFixed(2)),
      });
    }
    return acc;
  }, []);

  const totalFuelLiters = vehicle.fuelLogs.reduce((s, l) => s + l.liters, 0);
  const totalFuelCost   = vehicle.fuelLogs.reduce((s, l) => s + l.totalCost, 0);
  const avgKmL = fuelChartData.length > 0
    ? Number((fuelChartData.reduce((s, d) => s + d.kmL, 0) / fuelChartData.length).toFixed(2))
    : null;

  // Active trip
  const activeTrip = vehicle.tripLogs.find(t => t.status === 'IN_PROGRESS') ?? null;

  // Vehicle option for modals
  const vehicleOpt = {
    id: vehicle.id, code: vehicle.code, plate: vehicle.plate,
    brand: vehicle.brand, model: vehicle.model, currentKm: vehicle.currentKm,
    status: vehicle.status,
  };

  const yMaxChart = fuelChartData.length > 0
    ? Math.ceil(Math.max(...fuelChartData.map(d => d.kmL)) * 1.25)
    : 20;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 52, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/fleet/vehicles')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--sz-muted)', fontFamily: 'IBM Plex Sans, sans-serif', padding: 0 }}
          >
            <ArrowLeft size={14} /> Vehículos
          </button>
          <span style={{ color: 'var(--sz-border)', fontSize: 16 }}>/</span>
          <Car size={15} style={{ color: 'var(--sz-accent)' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sz-text)', fontFamily: 'IBM Plex Mono, monospace' }}>
            {vehicle.code}
          </span>
          <span style={{ fontSize: 12, color: 'var(--sz-muted)' }}>—</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sz-text)', fontFamily: 'IBM Plex Mono, monospace' }}>{vehicle.plate}</span>
          <Badge label={status.label} color={status.color} bg={status.bg} />
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setFuelModal(true)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)',
            background: 'var(--sz-card)', color: '#2980b9', fontFamily: 'IBM Plex Sans, sans-serif',
          }}>
            <Droplets size={12} /> Cargar combustible
          </button>
          {vehicle.status === 'AVAILABLE' && (
            <button onClick={() => setStartTripModal(true)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: 'none', borderRadius: 'var(--sz-radius)',
              background: '#27ae60', color: '#fff', fontFamily: 'IBM Plex Sans, sans-serif',
            }}>
              <Plus size={12} /> Iniciar viaje
            </button>
          )}
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--sz-card)', borderBottom: '1px solid var(--sz-border)', padding: '0 24px', display: 'flex', gap: 0 }}>
        {TABS.map(({ key, label, Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '11px 16px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: 'none', background: 'none',
                borderBottom: active ? `2px solid var(--sz-accent)` : '2px solid transparent',
                color: active ? 'var(--sz-accent)' : 'var(--sz-muted)',
                fontFamily: 'IBM Plex Sans, sans-serif', marginBottom: -1,
                transition: 'color .15s',
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Contenido de tabs ───────────────────────────────────────────── */}
      <div style={{ padding: '16px 24px' }}>

        {/* ╔═══════════════════════════════════╗ */}
        {/* ║  TAB: FICHA TÉCNICA               ║ */}
        {/* ╚═══════════════════════════════════╝ */}
        {activeTab === 'ficha' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Estado actual — banner destacado */}
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 20px', borderRadius: 'var(--sz-radius)',
                background: status.bg, border: `1px solid ${status.color}40`,
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: `${status.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Car size={22} style={{ color: status.color }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: status.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>Estado actual</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: status.color }}>{status.label}</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Km actuales</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--sz-text)' }}>
                    {vehicle.currentKm.toLocaleString('es-MX')} km
                  </div>
                </div>
              </div>
            </div>

            {/* Datos técnicos */}
            <Card>
              <CardHeader title="Datos Técnicos" icon={<Car size={14} />} />
              <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['Marca',          vehicle.brand],
                  ['Modelo',         vehicle.model],
                  ['Año',            String(vehicle.year)],
                  ['Color',          vehicle.color ?? 'N/D'],
                  ['Tipo',           TYPE_LABELS[vehicle.type] ?? vehicle.type],
                  ['Código interno', vehicle.code],
                  ['Placa',          vehicle.plate],
                  ['Combustible',    FUEL_LABELS[vehicle.fuelType] ?? vehicle.fuelType],
                  ['Tanque',         vehicle.tankCapacity ? `${vehicle.tankCapacity} L` : 'N/D'],
                  ['Área',           vehicle.area ?? 'N/D'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, color: 'var(--sz-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sz-text)', fontFamily: ['Código interno', 'Placa'].includes(label) ? 'IBM Plex Mono, monospace' : undefined }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Documentos con semáforo */}
            <Card>
              <CardHeader title="Documentos" subtitle="Estado de vigencia" />
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Seguro vehicular',       date: vehicle.insuranceExpiry },
                  { label: 'Verificación',           date: vehicle.verificationExpiry },
                  { label: 'Licencia de conducir',   date: vehicle.licenseExpiry },
                  { label: 'Tarjeta de circulación', date: vehicle.circulationCard },
                ].map(({ label, date }) => {
                  const info = docInfo(date);
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Dot semáforo */}
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: info.dot, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 12, color: 'var(--sz-text)' }}>{label}</div>
                      <div style={{
                        padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                        background: info.bg, color: info.color,
                      }}>
                        {info.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

          </div>
        )}

        {/* ╔═══════════════════════════════════╗ */}
        {/* ║  TAB: COMBUSTIBLE                 ║ */}
        {/* ╚═══════════════════════════════════╝ */}
        {activeTab === 'combustible' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Total litros',  value: `${totalFuelLiters.toLocaleString('es-MX', { maximumFractionDigits: 1 })} L`, color: '#2980b9' },
                { label: 'Costo total',   value: `$${totalFuelCost.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`,    color: '#e67e22' },
                { label: 'Promedio km/L', value: avgKmL !== null ? `${avgKmL} km/L` : 'N/D',                                   color: '#27ae60' },
              ].map(({ label, value, color }) => (
                <Card key={label} topAccent={color}>
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 10, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'IBM Plex Mono, monospace' }}>{value}</div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Gráfica de tendencia km/L */}
            {fuelChartData.length >= 2 && (
              <Card>
                <CardHeader title="Tendencia de Rendimiento" subtitle="km/L entre cargas sucesivas" />
                <div style={{ padding: '12px 16px 8px' }}>
                  <LineChartSVG
                    data={fuelChartData}
                    xKey="label"
                    series={[{ key: 'kmL', color: '#27ae60', label: 'km/L' }]}
                    yMin={0}
                    yMax={yMaxChart}
                    height={160}
                  />
                  {avgKmL !== null && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--sz-muted)', textAlign: 'right' }}>
                      Promedio: <strong style={{ color: '#27ae60', fontFamily: 'IBM Plex Mono, monospace' }}>{avgKmL} km/L</strong>
                    </div>
                  )}
                </div>
              </Card>
            )}
            {fuelChartData.length < 2 && (
              <div style={{ padding: '16px', background: 'var(--sz-card)', border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 12 }}>
                Se necesitan al menos 2 cargas de combustible para mostrar la gráfica de rendimiento.
              </div>
            )}

            {/* Tabla de cargas */}
            <Card>
              <CardHeader
                title="Historial de Cargas"
                subtitle={`Últimas ${vehicle.fuelLogs.length} cargas registradas`}
                action={
                  <button onClick={() => setFuelModal(true)} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: 'var(--sz-accent)', color: '#fff',
                    border: 'none', borderRadius: 'var(--sz-radius)', fontFamily: 'IBM Plex Sans, sans-serif',
                  }}>
                    <Plus size={11} /> Nueva carga
                  </button>
                }
              />
              {vehicle.fuelLogs.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>Sin registros de combustible</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--sz-bg)' }}>
                        {['Fecha', 'Km al cargar', 'Litros', 'Precio/L', 'Total', 'Rendimiento', 'Estación', 'Registrado por'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--sz-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vehicle.fuelLogs.map((l, i) => {
                        // km/L = (kmAtFuel - prev.kmAtFuel) / liters  (calculado en orden desc, necesitamos el siguiente en arr)
                        const nextLog = vehicle.fuelLogs[i + 1]; // siguiente en orden DESC = el anterior en el tiempo
                        const kmL = nextLog && l.liters > 0
                          ? Number(((l.kmAtFuel - nextLog.kmAtFuel) / l.liters).toFixed(2))
                          : null;
                        return (
                          <tr key={l.id} className="sz-table-row" style={{ borderBottom: '1px solid var(--sz-border)', background: i % 2 === 0 ? 'var(--sz-card)' : 'var(--sz-bg)' }}>
                            <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{new Date(l.date).toLocaleDateString('es-MX')}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', whiteSpace: 'nowrap' }}>{l.kmAtFuel.toLocaleString('es-MX')} km</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', color: '#27ae60', fontWeight: 700, whiteSpace: 'nowrap' }}>{l.liters.toFixed(2)} L</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', whiteSpace: 'nowrap' }}>${l.pricePerLiter.toFixed(2)}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', color: '#e67e22', fontWeight: 700, whiteSpace: 'nowrap' }}>${l.totalCost.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', whiteSpace: 'nowrap', color: kmL !== null ? (kmL < 5 ? '#c0392b' : '#27ae60') : 'var(--sz-muted)', fontWeight: kmL !== null ? 700 : 400 }}>
                              {kmL !== null ? `${kmL} km/L` : '—'}
                            </td>
                            <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{l.station ?? '—'}</td>
                            <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{l.loggedBy.name}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ╔═══════════════════════════════════╗ */}
        {/* ║  TAB: VIAJES                      ║ */}
        {/* ╚═══════════════════════════════════╝ */}
        {activeTab === 'viajes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Viaje activo */}
            {activeTrip && (
              <div style={{ padding: '14px 16px', background: '#e8f2fb', border: '1px solid #2980b940', borderRadius: 'var(--sz-radius)', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#2980b920', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clock size={18} style={{ color: '#2980b9' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#2980b9', textTransform: 'uppercase', letterSpacing: '.4px' }}>Viaje en curso</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a5276', marginTop: 2 }}>
                    {activeTrip.origin} → {activeTrip.destination}
                  </div>
                  <div style={{ fontSize: 11, color: '#2980b9', marginTop: 2 }}>
                    Conductor: {activeTrip.driver.name} · Salida: {new Date(activeTrip.startTime).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })} · Km salida: {activeTrip.startKm.toLocaleString('es-MX')}
                  </div>
                </div>
                <button
                  onClick={() => setCloseTrip({ id: activeTrip.id, startKm: activeTrip.startKm, startTime: activeTrip.startTime, origin: activeTrip.origin, destination: activeTrip.destination })}
                  style={{ padding: '7px 14px', background: '#2980b9', color: '#fff', border: 'none', borderRadius: 'var(--sz-radius)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'IBM Plex Sans, sans-serif', flexShrink: 0 }}
                >
                  <CheckCircle size={13} style={{ display: 'inline', marginRight: 5 }} />
                  Cerrar viaje
                </button>
              </div>
            )}

            {/* Botón iniciar viaje */}
            {vehicle.status === 'AVAILABLE' && !activeTrip && (
              <button
                onClick={() => setStartTripModal(true)}
                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: 'var(--sz-radius)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'IBM Plex Sans, sans-serif' }}
              >
                <Plus size={14} /> Iniciar nuevo viaje
              </button>
            )}

            {/* Tabla de viajes */}
            <Card>
              <CardHeader title="Historial de Viajes" subtitle={`Últimos ${vehicle.tripLogs.length} registros`} />
              {vehicle.tripLogs.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>Sin registros de viajes</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--sz-bg)' }}>
                        {['Estado', 'Fecha', 'Origen', 'Destino', 'Conductor', 'Km inicio', 'Km fin', 'Distancia', 'Motivo'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--sz-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vehicle.tripLogs.map((t, i) => {
                        const ts = TRIP_STATUS[t.status] ?? { label: t.status, color: '#888', bg: '#f0f0f0' };
                        return (
                          <tr key={t.id} className="sz-table-row" style={{ borderBottom: '1px solid var(--sz-border)', background: i % 2 === 0 ? 'var(--sz-card)' : 'var(--sz-bg)' }}>
                            <td style={{ padding: '9px 12px' }}>
                              <Badge label={ts.label} color={ts.color} bg={ts.bg} />
                            </td>
                            <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: 'var(--sz-muted)' }}>
                              {new Date(t.startTime).toLocaleDateString('es-MX')}
                            </td>
                            <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.origin}</td>
                            <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.destination}</td>
                            <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{t.driver.name}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', whiteSpace: 'nowrap' }}>{t.startKm.toLocaleString('es-MX')}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', whiteSpace: 'nowrap' }}>{t.endKm?.toLocaleString('es-MX') ?? '—'}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: t.distance ? '#27ae60' : 'var(--sz-muted)', whiteSpace: 'nowrap' }}>
                              {t.distance != null ? `${t.distance.toLocaleString('es-MX')} km` : '—'}
                            </td>
                            <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.purpose ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ╔═══════════════════════════════════╗ */}
        {/* ║  TAB: MANTENIMIENTO               ║ */}
        {/* ╚═══════════════════════════════════╝ */}
        {activeTab === 'mantenimiento' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Próximos mantenimientos (planes activos) */}
            {maintData && maintData.activePlans.length > 0 && (
              <Card>
                <CardHeader title="Planes Preventivos Activos" subtitle="Estado y próximas fechas / km" icon={<Wrench size={14} />} />
                <div style={{ padding: '0 0 8px' }}>
                  {maintData.activePlans.map(plan => {
                    const urg = planUrgency(plan, vehicle.currentKm);
                    const urgInfo = URGENCY_MAP[urg];
                    const daysLeft = plan.nextDue
                      ? Math.floor((new Date(plan.nextDue).getTime() - Date.now()) / 86400000)
                      : null;
                    const kmLeft = plan.usageThreshold != null && plan.usageUnit === 'km'
                      ? plan.usageThreshold - vehicle.currentKm
                      : null;

                    return (
                      <div key={plan.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--sz-border)', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: urgInfo.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sz-text)' }}>{plan.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--sz-muted)', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            {plan.nextDue && (
                              <span>
                                {daysLeft !== null && daysLeft < 0
                                  ? `⚠ Venció hace ${Math.abs(daysLeft)}d`
                                  : `📅 ${new Date(plan.nextDue).toLocaleDateString('es-MX')} (${daysLeft}d)`
                                }
                              </span>
                            )}
                            {kmLeft !== null && (
                              <span>
                                {kmLeft <= 0
                                  ? `⚠ Km umbral superado por ${Math.abs(kmLeft).toLocaleString('es-MX')} km`
                                  : `🛣 Faltan ${kmLeft.toLocaleString('es-MX')} km`
                                }
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge label={urgInfo.label} color={urgInfo.color} bg={urgInfo.bg} />
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Estadísticas de OTs */}
            {maintData && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { label: 'Total OTs',    value: maintData.stats.total,      color: '#7f8c8d' },
                  { label: 'Pendientes',   value: maintData.stats.pending,    color: '#e67e22' },
                  { label: 'En proceso',   value: maintData.stats.inProgress, color: '#2980b9' },
                  { label: 'Completadas',  value: maintData.stats.completed,  color: '#27ae60' },
                ].map(({ label, value, color }) => (
                  <Card key={label} topAccent={color}>
                    <div style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'IBM Plex Mono, monospace' }}>{value}</div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Historial de órdenes de trabajo */}
            <Card>
              <CardHeader title="Historial de Órdenes de Trabajo" subtitle="Más reciente primero" />
              {!maintData || maintData.workOrders.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>
                  {!maintData ? 'Cargando...' : 'Sin órdenes de trabajo registradas'}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--sz-bg)' }}>
                        {['Código', 'Título', 'Estado', 'Prioridad', 'Programada', 'Completada', 'Asignado a', 'Plan'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--sz-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {maintData.workOrders.map((wo, i) => {
                        const ws = WO_STATUS[wo.status] ?? { label: wo.status, color: '#888', bg: '#f0f0f0' };
                        return (
                          <tr key={wo.id} className="sz-table-row" style={{ borderBottom: '1px solid var(--sz-border)', background: i % 2 === 0 ? 'var(--sz-card)' : 'var(--sz-bg)' }}>
                            <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, whiteSpace: 'nowrap', color: 'var(--sz-accent)', fontWeight: 700 }}>{wo.code}</td>
                            <td style={{ padding: '9px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wo.title}</td>
                            <td style={{ padding: '9px 12px' }}><Badge label={ws.label} color={ws.color} bg={ws.bg} /></td>
                            <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{wo.priority.toLowerCase()}</td>
                            <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{wo.scheduledAt ? new Date(wo.scheduledAt).toLocaleDateString('es-MX') : '—'}</td>
                            <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{wo.completedAt ? new Date(wo.completedAt).toLocaleDateString('es-MX') : '—'}</td>
                            <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{wo.assignedTo?.name ?? '—'}</td>
                            <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap', fontSize: 11 }}>{wo.maintenancePlan?.name ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ╔═══════════════════════════════════╗ */}
        {/* ║  TAB: CONDUCTOR                   ║ */}
        {/* ╚═══════════════════════════════════╝ */}
        {activeTab === 'conductor' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Conductor actual */}
            <Card>
              <CardHeader title="Conductor Asignado Actualmente" icon={<User size={14} />} />
              <div style={{ padding: '16px' }}>
                {vehicle.driver ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--sz-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <User size={20} style={{ color: '#fff' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--sz-text)' }}>{vehicle.driver.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--sz-muted)', marginTop: 2 }}>{vehicle.driver.email}</div>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <Badge label="Activo" color="#27ae60" bg="#e8f8f0" />
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--sz-muted)', fontSize: 13 }}>
                    <XCircle size={24} style={{ display: 'block', margin: '0 auto 8px', opacity: .4 }} />
                    Sin conductor asignado actualmente
                  </div>
                )}
              </div>
            </Card>

            {/* Historial de asignaciones */}
            <Card>
              <CardHeader title="Historial de Asignaciones" subtitle={`${vehicle.assignments.length} registros`} />
              {vehicle.assignments.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>Sin historial de asignaciones</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--sz-bg)' }}>
                        {['Conductor', 'Tipo', 'Desde', 'Hasta', 'Creado por', 'Notas'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--sz-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vehicle.assignments.map((a, i) => (
                        <tr key={a.id} className="sz-table-row" style={{ borderBottom: '1px solid var(--sz-border)', background: i % 2 === 0 ? 'var(--sz-card)' : 'var(--sz-bg)' }}>
                          <td style={{ padding: '9px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{a.driver.name}</td>
                          <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                            <Badge
                              label={a.type === 'PERMANENT' ? 'Permanente' : 'Temporal'}
                              color={a.type === 'PERMANENT' ? '#2980b9' : '#e67e22'}
                              bg={a.type === 'PERMANENT' ? '#e8f2fb' : '#fef3e7'}
                            />
                          </td>
                          <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{new Date(a.startDate).toLocaleDateString('es-MX')}</td>
                          <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{a.endDate ? new Date(a.endDate).toLocaleDateString('es-MX') : '—'}</td>
                          <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{a.createdBy.name}</td>
                          <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

      </div>

      {/* ── Modales ─────────────────────────────────────────────────────── */}

      {fuelModal && (
        <FuelLogModal
          vehicles={[vehicleOpt]}
          preselectedVehicleId={vehicle.id}
          onSaved={() => { setFuelModal(false); loadVehicle(); }}
          onClose={() => setFuelModal(false)}
        />
      )}

      {startTripModal && (
        <StartTripModal
          vehicles={[vehicleOpt]}
          preselectedVehicleId={vehicle.id}
          onSaved={() => { setStartTripModal(false); loadVehicle(); }}
          onClose={() => setStartTripModal(false)}
        />
      )}

      {closeTrip && (
        <CloseTripModal
          trip={closeTrip}
          onSaved={() => { setCloseTrip(null); loadVehicle(); }}
          onClose={() => setCloseTrip(null)}
        />
      )}

    </div>
  );
}
