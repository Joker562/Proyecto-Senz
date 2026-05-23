import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  Download, Truck, FileCheck, DollarSign, Wrench, RefreshCw,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Vehicle {
  id: string;
  code: string;
  plate: string;
  brand: string;
  model: string;
  type: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
  currentKm: number;
  area: string | null;
  driver: { id: string; name: string; email: string } | null;
  insuranceExpiry: string | null;
  verificationExpiry: string | null;
  licenseExpiry: string | null;
  circulationCard: string | null;
}

interface FuelSummaryVehicle {
  vehicleId: string;
  code: string;
  plate: string;
  brand: string;
  model: string;
  totalLiters: number;
  totalCost: number;
  totalKm: number;
  costPerKm: number | null;
}

interface FuelSummaryResponse {
  period: { month: number; year: number; label: string; from: string; to: string };
  vehicles: FuelSummaryVehicle[];
  totals: { totalLiters: number; totalCost: number; totalKm: number };
}

interface EfficiencyRow {
  vehicleId: string;
  code: string;
  plate: string;
  brand: string;
  model: string;
  type: string;
  status: string;
  currentKm: number;
  driver: { id: string; name: string } | null;
  totalKm: number;
  totalLiters: number;
  avgKmPerLiter: number | null;
  fuelCost: number;
  maintenanceCost: number;
  totalCost: number;
  bestEfficiency: boolean;
  highestSpender: boolean;
}

interface EfficiencyResponse {
  period: string | { from: string | null; to: string | null };
  totals: {
    totalKm: number;
    totalLiters: number;
    totalCost: number;
    avgKmPerLiter: number | null;
  };
  ranking: EfficiencyRow[];
}

interface UpcomingItem {
  planId: string;
  planName: string;
  serviceType: string | null;
  vehicleId: string;
  vehicleCode: string;
  vehiclePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  currentKm: number;
  urgency: 'OVERDUE' | 'CRITICAL' | 'WARNING';
  nextDue: string | null;
  daysUntilDue: number | null;
  kmThreshold: number | null;
  kmRemaining: number | null;
  hasOpenOT: boolean;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const TYPE_LABELS: Record<string, string> = {
  TRUCK: 'Camión', VAN: 'Camioneta', CAR: 'Auto', FORKLIFT: 'Montacargas', OTHER: 'Otro',
};

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponible', IN_USE: 'En Uso',
  MAINTENANCE: 'En Mantenimiento', OUT_OF_SERVICE: 'Fuera de Servicio',
};

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: '#27ae60', IN_USE: '#2980b9',
  MAINTENANCE: '#e67e22', OUT_OF_SERVICE: '#c0392b',
};

const URGENCY_MAP: Record<'OVERDUE' | 'CRITICAL' | 'WARNING', { label: string; color: string; bg: string }> = {
  OVERDUE:  { label: 'Vencido', color: '#c0392b', bg: '#fdecea' },
  CRITICAL: { label: 'Crítico', color: '#e67e22', bg: '#fef3e7' },
  WARNING:  { label: 'Próximo', color: '#f39c12', bg: '#fef9e7' },
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  OIL_CHANGE: 'Cambio de Aceite', TUNE_UP: 'Afinación', TIRES: 'Llantas',
  BRAKES: 'Frenos', VERIFICATION: 'Verificación',
  GENERAL_SERVICE: 'Servicio General', OTHER: 'Otro',
};

// Rendimiento teórico objetivo por tipo de vehículo (km/L)
const EFFICIENCY_TARGETS: Record<string, number> = {
  CAR: 12, VAN: 8, TRUCK: 6, FORKLIFT: 4, OTHER: 8,
};

// ── Helpers puros (fuera del componente para evitar Fast-Refresh issues) ───────

function sortFuelRows(
  rows: FuelSummaryVehicle[],
  by: 'cost' | 'liters' | 'efficiency',
): FuelSummaryVehicle[] {
  return [...rows].sort((a, b) => {
    if (by === 'cost')   return b.totalCost - a.totalCost;
    if (by === 'liters') return b.totalLiters - a.totalLiters;
    const aEff = a.totalLiters > 0 ? a.totalKm / a.totalLiters : -1;
    const bEff = b.totalLiters > 0 ? b.totalKm / b.totalLiters : -1;
    return bEff - aEff;
  });
}

function isDocValid(expiry: string | null): boolean {
  if (!expiry) return false;
  return new Date(expiry) > new Date();
}

function hasAllDocs(v: Vehicle): boolean {
  return (
    isDocValid(v.insuranceExpiry) &&
    isDocValid(v.verificationExpiry) &&
    isDocValid(v.licenseExpiry) &&
    isDocValid(v.circulationCard)
  );
}

function docBadge(expiry: string | null): { label: string; color: string; bg: string } {
  if (!expiry) return { label: 'N/R', color: 'var(--sz-muted)', bg: 'transparent' };
  const daysLeft = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  if (daysLeft < 0)   return { label: `Vencido (${Math.abs(daysLeft)}d)`, color: '#c0392b', bg: '#fdecea' };
  if (daysLeft <= 30) return { label: `${daysLeft}d restantes`,           color: '#e67e22', bg: '#fef3e7' };
  return {
    label: new Date(expiry).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }),
    color: '#27ae60', bg: '#e8f8f0',
  };
}

function downloadClientCSV(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv  = '﻿' + [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Estilos compartidos ───────────────────────────────────────────────────────

const SEL: React.CSSProperties = {
  padding: '6px 10px', fontSize: 12, border: '1px solid var(--sz-border)',
  borderRadius: 'var(--sz-radius)', background: 'var(--sz-bg)', color: 'var(--sz-text)',
  fontFamily: 'IBM Plex Sans, sans-serif',
};

const BTN_GHOST = (color: string, disabled = false): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)',
  background: 'var(--sz-card)', color,
  fontFamily: 'IBM Plex Sans, sans-serif', opacity: disabled ? 0.6 : 1,
});

const TH: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontWeight: 600,
  color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase',
  letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = { padding: '9px 12px' };
const MONO: React.CSSProperties = { fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 };

// ── Componente principal ──────────────────────────────────────────────────────

export default function FleetReportsPage() {
  const toast = useToast();
  const now   = new Date();

  // ── Período y filtros ──────────────────────────────────────────────────────
  const [month,      setMonth]      = useState(now.getMonth() + 1);
  const [year,       setYear]       = useState(now.getFullYear());
  const [filterType, setFilterType] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [refresh,    setRefresh]    = useState(0);

  // ── Pestaña activa ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'fuel' | 'km' | 'maintenance'>('fuel');

  // ── Datos ──────────────────────────────────────────────────────────────────
  const [vehicles,    setVehicles]    = useState<Vehicle[]>([]);
  const [fuelSummary, setFuelSummary] = useState<FuelSummaryResponse | null>(null);
  const [efficiency,  setEfficiency]  = useState<EfficiencyResponse | null>(null);
  const [upcoming,    setUpcoming]    = useState<UpcomingItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [exporting,   setExporting]   = useState<string | null>(null);

  // ── Ordenamiento tabla combustible ─────────────────────────────────────────
  const [sortFuel, setSortFuel] = useState<'cost' | 'liters' | 'efficiency'>('cost');

  // ── Carga de datos ─────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const start = new Date(year, month - 1, 1).toISOString();
    const end   = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    Promise.all([
      api.get<Vehicle[]>('/fleet/vehicles'),
      api.get<FuelSummaryResponse>(`/fleet/fuel/summary?month=${month}&year=${year}`),
      api.get<EfficiencyResponse>(
        `/fleet/reports/efficiency?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`,
      ),
      api.get<UpcomingItem[]>('/fleet/maintenance/upcoming'),
    ])
      .then(([vRes, fRes, eRes, uRes]) => {
        if (cancelled) return;
        setVehicles(vRes.data   ?? []);
        setFuelSummary(fRes.data ?? null);
        setEfficiency(eRes.data  ?? null);
        setUpcoming(uRes.data    ?? []);
      })
      .catch(() => {
        if (!cancelled) toast.push('Error al cargar datos de reportes', 'error');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [month, year, refresh]); // eslint-disable-line

  // ── Vehículos filtrados ────────────────────────────────────────────────────

  const filteredVehicles = useMemo(
    () => vehicles.filter(v =>
      (!filterType || v.type === filterType) &&
      (!filterArea || v.area  === filterArea),
    ),
    [vehicles, filterType, filterArea],
  );

  // ── Áreas únicas (para el selector de filtro) ──────────────────────────────

  const areas = useMemo(
    () => Array.from(new Set(vehicles.map(v => v.area).filter(Boolean))) as string[],
    [vehicles],
  );

  // ── KPI 1: Disponibilidad de Flota ─────────────────────────────────────────
  const kpiAvailability = useMemo(() => {
    const total = filteredVehicles.length;
    if (!total) return null;
    return Math.round((filteredVehicles.filter(v => v.status === 'AVAILABLE').length / total) * 100);
  }, [filteredVehicles]);

  // ── KPI 2: Cumplimiento de Mantenimiento ────────────────────────────────────
  const kpiMaintCompliance = useMemo(() => {
    const total = filteredVehicles.length;
    if (!total) return null;
    const overdueIds = new Set(
      upcoming.filter(u => u.urgency === 'OVERDUE').map(u => u.vehicleId),
    );
    const overdue = filteredVehicles.filter(v => overdueIds.has(v.id)).length;
    return Math.round(((total - overdue) / total) * 100);
  }, [filteredVehicles, upcoming]);

  // ── KPI 3: Documentos al Día ────────────────────────────────────────────────
  const kpiDocs = useMemo(() => {
    const total = filteredVehicles.length;
    if (!total) return null;
    return Math.round((filteredVehicles.filter(hasAllDocs).length / total) * 100);
  }, [filteredVehicles]);

  // ── KPI 4: Costo Promedio por Km ────────────────────────────────────────────
  const kpiCostPerKm = useMemo(() => {
    if (!fuelSummary?.totals.totalKm || !fuelSummary?.totals.totalCost) return null;
    return Number((fuelSummary.totals.totalCost / fuelSummary.totals.totalKm).toFixed(4));
  }, [fuelSummary]);

  // ── Color condicional para KPI según meta ─────────────────────────────────
  function kpiColor(value: number | null, target: number, strict = false): string {
    if (value === null) return 'var(--sz-muted)';
    const meets = strict ? value >= target : value >= target;
    return meets ? '#27ae60' : '#e74c3c';
  }

  // ── Datos para gráfica: eficiencia real vs meta teórica ───────────────────
  const efficiencyChartData = useMemo(() => {
    if (!efficiency) return [];
    const typeMap = new Map(vehicles.map(v => [v.id, v.type]));
    return efficiency.ranking
      .filter(r => r.avgKmPerLiter !== null)
      .slice(0, 12)
      .map(r => ({
        name:   r.code,
        actual: r.avgKmPerLiter,
        meta:   EFFICIENCY_TARGETS[typeMap.get(r.vehicleId) ?? 'OTHER'] ?? 8,
      }));
  }, [efficiency, vehicles]);

  // ── Datos para tabla de combustible (filtrados y ordenados) ───────────────
  const fuelTableRows = useMemo(() => {
    if (!fuelSummary) return [];
    const vMap = new Map(vehicles.map(v => [v.id, v]));
    const filtered = fuelSummary.vehicles.filter(r => {
      const v = vMap.get(r.vehicleId);
      if (!v) return true;
      if (filterType && v.type !== filterType) return false;
      if (filterArea && v.area !== filterArea) return false;
      return true;
    });
    return sortFuelRows(filtered, sortFuel);
  }, [fuelSummary, vehicles, filterType, filterArea, sortFuel]);

  // ── Datos gráfica km por vehículo ──────────────────────────────────────────
  const kmBarData = useMemo(() => {
    if (!fuelSummary) return [];
    const vMap = new Map(vehicles.map(v => [v.id, v]));
    return [...fuelSummary.vehicles]
      .filter(r => {
        const v = vMap.get(r.vehicleId);
        if (!v) return true;
        if (filterType && v.type !== filterType) return false;
        if (filterArea && v.area !== filterArea) return false;
        return true;
      })
      .filter(r => r.totalKm > 0)
      .sort((a, b) => b.totalKm - a.totalKm)
      .slice(0, 15)
      .map(r => ({ name: r.code, km: Math.round(r.totalKm), costo: Math.round(r.totalCost) }));
  }, [fuelSummary, vehicles, filterType, filterArea]);

  // ── Datos gráfica km por área ──────────────────────────────────────────────
  const areaKmData = useMemo(() => {
    if (!fuelSummary) return [];
    const vMap = new Map(vehicles.map(v => [v.id, v]));
    const agg: Record<string, number> = {};
    fuelSummary.vehicles.forEach(fv => {
      const area = vMap.get(fv.vehicleId)?.area ?? 'Sin área';
      agg[area] = (agg[area] ?? 0) + fv.totalKm;
    });
    return Object.entries(agg)
      .sort((a, b) => b[1] - a[1])
      .map(([name, km]) => ({ name, km: Math.round(km) }));
  }, [fuelSummary, vehicles]);

  // ── Upcoming filtrado por vehicles activos ─────────────────────────────────
  const filteredUpcoming = useMemo(() => {
    const filteredIds = new Set(filteredVehicles.map(v => v.id));
    return upcoming.filter(u => filteredIds.has(u.vehicleId));
  }, [upcoming, filteredVehicles]);

  // ── Gráfica distribución urgencia mantenimiento ─────────────────────────────
  const urgencyChartData = [
    { label: 'Vencido', key: 'OVERDUE',  color: '#e74c3c', count: filteredUpcoming.filter(u => u.urgency === 'OVERDUE').length  },
    { label: 'Crítico', key: 'CRITICAL', color: '#e67e22', count: filteredUpcoming.filter(u => u.urgency === 'CRITICAL').length },
    { label: 'Próximo', key: 'WARNING',  color: '#f39c12', count: filteredUpcoming.filter(u => u.urgency === 'WARNING').length  },
  ];

  // ── Exportaciones ──────────────────────────────────────────────────────────

  async function exportFleetCSV() {
    setExporting('fleet');
    try {
      const res = await api.get('/fleet/reports/export/csv', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a   = document.createElement('a');
      a.href = url; a.download = `flota_${year}-${String(month).padStart(2, '0')}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.push('CSV de flota descargado', 'success');
    } catch {
      toast.push('Error al exportar CSV de flota', 'error');
    } finally {
      setExporting(null);
    }
  }

  function exportFuelCSV() {
    if (!fuelSummary) return;
    setExporting('fuel');
    const headers = [
      'Código', 'Placa', 'Marca', 'Modelo', 'Litros', 'Costo Total',
      'Km Recorridos', 'Costo / Km', 'Rendimiento (km/L)',
    ];
    const rows = fuelSummary.vehicles.map(r => {
      const eff = r.totalLiters > 0 && r.totalKm > 0
        ? (r.totalKm / r.totalLiters).toFixed(3) : 'N/D';
      return [r.code, r.plate, r.brand, r.model, r.totalLiters, r.totalCost,
              r.totalKm, r.costPerKm ?? 'N/D', eff];
    });
    downloadClientCSV(
      `combustible_${year}-${String(month).padStart(2, '0')}.csv`,
      headers, rows,
    );
    toast.push('CSV de combustible descargado', 'success');
    setExporting(null);
  }

  function exportMaintenanceCSV() {
    setExporting('maintenance');
    const headers = [
      'Vehículo', 'Placa', 'Plan', 'Tipo Servicio', 'Urgencia',
      'Próxima Fecha', 'Días Restantes', 'Km Umbral', 'Km Restantes', 'Con OT Abierta',
    ];
    const rows = filteredUpcoming.map(u => [
      u.vehicleCode, u.vehiclePlate, u.planName,
      SERVICE_TYPE_LABELS[u.serviceType ?? ''] ?? u.serviceType ?? '—',
      URGENCY_MAP[u.urgency]?.label ?? u.urgency,
      u.nextDue ? new Date(u.nextDue).toLocaleDateString('es-MX') : '—',
      u.daysUntilDue ?? '—',
      u.kmThreshold  ?? '—',
      u.kmRemaining  ?? '—',
      u.hasOpenOT ? 'Sí' : 'No',
    ]);
    downloadClientCSV(
      `mantenimiento_${year}-${String(month).padStart(2, '0')}.csv`,
      headers, rows,
    );
    toast.push('CSV de mantenimiento descargado', 'success');
    setExporting(null);
  }

  // ── Años disponibles en selector ──────────────────────────────────────────
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>
          Reportes & KPIs de Flota
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>

          {/* Selectores de período */}
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={SEL}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={SEL}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Filtro tipo */}
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={SEL}>
            <option value="">Todos los tipos</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          {/* Filtro área */}
          {areas.length > 0 && (
            <select value={filterArea} onChange={e => setFilterArea(e.target.value)} style={SEL}>
              <option value="">Todas las áreas</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}

          <button
            onClick={() => setRefresh(r => r + 1)}
            style={{ ...SEL, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <RefreshCw size={12} /> Actualizar
          </button>

          <button
            onClick={exportFleetCSV}
            disabled={exporting !== null}
            style={BTN_GHOST('#27ae60', exporting !== null)}
          >
            <Download size={12} /> Flota CSV
          </button>
        </div>
      </div>

      {/* ── Contenido ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 260 }}>
          <span style={{ color: 'var(--sz-muted)', fontSize: 13 }}>Calculando KPIs del periodo…</span>
        </div>
      ) : (
        <div style={{ padding: '16px 24px' }}>

          {/* ── Grid de KPIs ───────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>

            {/* KPI 1 — Disponibilidad */}
            <KpiCard
              label="Disponibilidad de Flota"
              value={kpiAvailability !== null ? `${kpiAvailability}%` : 'N/D'}
              color={kpiColor(kpiAvailability, 85)}
              Icon={Truck}
              metaLabel="Meta: ≥ 85%"
              metaMet={kpiAvailability !== null && kpiAvailability >= 85}
              sub={`${filteredVehicles.filter(v => v.status === 'AVAILABLE').length} / ${filteredVehicles.length} disponibles`}
            />

            {/* KPI 2 — Cumplimiento mantenimiento */}
            <KpiCard
              label="Cumplimiento Mant."
              value={kpiMaintCompliance !== null ? `${kpiMaintCompliance}%` : 'N/D'}
              color={kpiColor(kpiMaintCompliance, 90)}
              Icon={Wrench}
              metaLabel="Meta: ≥ 90%"
              metaMet={kpiMaintCompliance !== null && kpiMaintCompliance >= 90}
              sub={`${filteredUpcoming.filter(u => u.urgency === 'OVERDUE').length} servicios vencidos`}
            />

            {/* KPI 3 — Documentos */}
            <KpiCard
              label="Documentos al Día"
              value={kpiDocs !== null ? `${kpiDocs}%` : 'N/D'}
              color={kpiDocs === 100 ? '#27ae60' : '#e74c3c'}
              Icon={FileCheck}
              metaLabel="Meta: 100%"
              metaMet={kpiDocs === 100}
              sub={`${filteredVehicles.filter(hasAllDocs).length} / ${filteredVehicles.length} con docs vigentes`}
            />

            {/* KPI 4 — Costo por km */}
            <KpiCard
              label="Costo Prom. por Km"
              value={kpiCostPerKm !== null ? `$${kpiCostPerKm}` : 'N/D'}
              color="#8b5cf6"
              Icon={DollarSign}
              metaLabel="Combustible del periodo"
              metaMet={null}
              sub={
                fuelSummary
                  ? `$${fuelSummary.totals.totalCost.toLocaleString('es-MX', { maximumFractionDigits: 0 })} ÷ ${fuelSummary.totals.totalKm.toLocaleString('es-MX', { maximumFractionDigits: 0 })} km`
                  : '—'
              }
            />
          </div>

          {/* ── Tabs ─────────────────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', gap: 0, marginBottom: 16,
            borderBottom: '2px solid var(--sz-border)',
          }}>
            {[
              { key: 'fuel',        label: 'Combustible & Rendimiento' },
              { key: 'km',          label: 'Kilometraje & Utilización'  },
              { key: 'maintenance', label: 'Mantenimiento'               },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as typeof activeTab)}
                style={{
                  padding: '9px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: 'none',
                  borderBottom: `2px solid ${activeTab === t.key ? 'var(--sz-accent)' : 'transparent'}`,
                  background: 'none',
                  color: activeTab === t.key ? 'var(--sz-accent)' : 'var(--sz-muted)',
                  fontFamily: 'IBM Plex Sans, sans-serif', marginBottom: -2,
                  transition: 'color .15s, border-color .15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB 1 — Combustible & Rendimiento                               */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'fuel' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Gráfica: rendimiento real vs meta teórica */}
              {efficiencyChartData.length > 0 && (
                <Card>
                  <CardHeader
                    title="Rendimiento Real vs Meta Teórica"
                    subtitle={`Comparativo km/L por vehículo — ${MONTHS[month - 1]} ${year}`}
                    action={
                      <button
                        onClick={exportFuelCSV}
                        disabled={exporting !== null}
                        style={BTN_GHOST('#27ae60', exporting !== null)}
                      >
                        <Download size={11} /> CSV Combustible
                      </button>
                    }
                  />
                  <div style={{ padding: '8px 16px 16px' }}>
                    {/* Leyenda manual */}
                    <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
                      {[
                        { color: '#27ae60', label: 'Rendimiento Real (km/L)' },
                        { color: '#e67e22', label: 'Meta Teórica por Tipo'    },
                      ].map(s => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 14, height: 14, borderRadius: 3, background: s.color }} />
                          <span style={{ fontSize: 10, color: 'var(--sz-muted)' }}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart
                        data={efficiencyChartData}
                        margin={{ top: 4, right: 16, left: 0, bottom: 28 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--sz-border)" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', fill: 'var(--sz-muted)' }}
                          interval={0} angle={-25} textAnchor="end"
                        />
                        <YAxis
                          tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', fill: 'var(--sz-muted)' }}
                          unit=" km/L" width={62}
                        />
                        <Tooltip
                          contentStyle={{
                            fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12,
                            background: 'var(--sz-card)', border: '1px solid var(--sz-border)',
                          }}
                          formatter={(value: number, name: string) => [
                            `${value.toFixed(2)} km/L`,
                            name === 'actual' ? 'Real' : 'Meta',
                          ]}
                        />
                        <Bar dataKey="actual" fill="#27ae60" name="actual" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="meta"   fill="#e67e2285" name="meta" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}

              {/* Tabla de consumo mensual */}
              <Card>
                <CardHeader
                  title={`Consumo de Combustible — ${MONTHS[month - 1]} ${year}`}
                  subtitle="Litros, costo acumulado y rendimiento real por vehículo"
                  action={
                    <div style={{ display: 'flex', gap: 4 }}>
                      {([
                        { key: 'cost',       label: 'Costo'        },
                        { key: 'liters',     label: 'Litros'       },
                        { key: 'efficiency', label: 'Rendimiento'  },
                      ] as const).map(s => (
                        <button
                          key={s.key}
                          onClick={() => setSortFuel(s.key)}
                          style={{
                            padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            borderRadius: 6,
                            border: `1px solid ${sortFuel === s.key ? 'var(--sz-accent)' : 'var(--sz-border)'}`,
                            background: sortFuel === s.key ? 'var(--sz-accent)' : 'var(--sz-card)',
                            color: sortFuel === s.key ? '#fff' : 'var(--sz-muted)',
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  }
                />
                {fuelTableRows.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>
                    Sin registros de combustible para {MONTHS[month - 1]} {year}.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--sz-bg)' }}>
                          {['Vehículo', 'Placa', 'Litros Consumidos', 'Costo Total', 'Km Recorridos', 'Costo / Km', 'Rendimiento'].map(h => (
                            <th key={h} style={TH}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fuelTableRows.map((r, i) => {
                          const eff = r.totalLiters > 0 && r.totalKm > 0
                            ? r.totalKm / r.totalLiters : null;
                          const rowBg = i % 2 === 0 ? 'var(--sz-card)' : 'var(--sz-bg)';
                          return (
                            <tr key={r.vehicleId} style={{ borderBottom: '1px solid var(--sz-border)', background: rowBg }}>
                              <td style={{ ...TD, fontWeight: 600, color: 'var(--sz-text)' }}>
                                {r.code}
                                <div style={{ fontSize: 10, color: 'var(--sz-muted)' }}>{r.brand} {r.model}</div>
                              </td>
                              <td style={{ ...TD, ...MONO, color: 'var(--sz-accent)' }}>{r.plate}</td>
                              <td style={{ ...TD, ...MONO, color: '#27ae60', fontWeight: 700 }}>
                                {r.totalLiters.toLocaleString('es-MX', { maximumFractionDigits: 1 })} L
                              </td>
                              <td style={{ ...TD, ...MONO, color: '#e67e22', fontWeight: 700 }}>
                                ${r.totalCost.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                              </td>
                              <td style={{ ...TD, ...MONO }}>
                                {r.totalKm > 0
                                  ? `${r.totalKm.toLocaleString('es-MX', { maximumFractionDigits: 0 })} km`
                                  : '—'}
                              </td>
                              <td style={{ ...TD, ...MONO, color: '#8b5cf6' }}>
                                {r.costPerKm != null ? `$${r.costPerKm.toFixed(4)}` : '—'}
                              </td>
                              <td style={{ ...TD, ...MONO, fontWeight: eff != null ? 700 : 400, color: eff != null ? '#27ae60' : 'var(--sz-muted)' }}>
                                {eff != null ? `${eff.toFixed(2)} km/L` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Fila de totales */}
                        {fuelSummary && (
                          <tr style={{ background: 'var(--sz-bg)', borderTop: '2px solid var(--sz-border)', fontWeight: 800 }}>
                            <td colSpan={2} style={{ ...TD, color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                              TOTALES
                            </td>
                            <td style={{ ...TD, ...MONO, fontWeight: 800 }}>
                              {fuelSummary.totals.totalLiters.toLocaleString('es-MX', { maximumFractionDigits: 1 })} L
                            </td>
                            <td style={{ ...TD, ...MONO, fontWeight: 800, color: '#e67e22' }}>
                              ${fuelSummary.totals.totalCost.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                            </td>
                            <td style={{ ...TD, ...MONO, fontWeight: 800 }}>
                              {fuelSummary.totals.totalKm.toLocaleString('es-MX', { maximumFractionDigits: 0 })} km
                            </td>
                            <td style={{ ...TD, ...MONO, fontWeight: 800, color: '#8b5cf6' }}>
                              {kpiCostPerKm != null ? `$${kpiCostPerKm}` : '—'}
                            </td>
                            <td style={{ ...TD, ...MONO, fontWeight: 800, color: '#27ae60' }}>
                              {efficiency?.totals.avgKmPerLiter != null
                                ? `${efficiency.totals.avgKmPerLiter.toFixed(2)} km/L`
                                : '—'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB 2 — Kilometraje & Utilización                               */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'km' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Mini-KPIs del período */}
              {fuelSummary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                  {[
                    {
                      label: 'Km Totales del Periodo',
                      value: `${fuelSummary.totals.totalKm.toLocaleString('es-MX', { maximumFractionDigits: 0 })} km`,
                      color: '#2980b9',
                    },
                    {
                      label: 'Vehículos con Actividad',
                      value: String(fuelSummary.vehicles.filter(v => v.totalKm > 0).length),
                      color: '#27ae60',
                    },
                    {
                      label: 'Promedio Km / Vehículo',
                      value: fuelSummary.vehicles.length > 0
                        ? `${(fuelSummary.totals.totalKm / fuelSummary.vehicles.length).toLocaleString('es-MX', { maximumFractionDigits: 0 })} km`
                        : '—',
                      color: '#8b5cf6',
                    },
                  ].map(({ label, value, color }) => (
                    <Card key={label} topAccent={color}>
                      <div style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 11, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'IBM Plex Mono, monospace' }}>{value}</div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Gráfica barras: km por vehículo */}
              <Card>
                <CardHeader
                  title="Kilómetros Recorridos por Vehículo"
                  subtitle={`${MONTHS[month - 1]} ${year} — Top 15 vehículos con mayor actividad`}
                  action={
                    <button
                      onClick={exportFuelCSV}
                      disabled={exporting !== null}
                      style={BTN_GHOST('#2980b9', exporting !== null)}
                    >
                      <Download size={11} /> CSV
                    </button>
                  }
                />
                {kmBarData.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>
                    Sin datos de kilometraje para el periodo seleccionado.
                  </div>
                ) : (
                  <div style={{ padding: '8px 16px 16px' }}>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={kmBarData} margin={{ top: 8, right: 16, left: 8, bottom: 32 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--sz-border)" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', fill: 'var(--sz-muted)' }}
                          interval={0} angle={-30} textAnchor="end"
                        />
                        <YAxis
                          tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', fill: 'var(--sz-muted)' }}
                          unit=" km" width={64}
                        />
                        <Tooltip
                          contentStyle={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12, background: 'var(--sz-card)', border: '1px solid var(--sz-border)' }}
                          formatter={(value: number) => [`${value.toLocaleString('es-MX')} km`, 'Km Recorridos']}
                        />
                        <Bar dataKey="km" fill="#2980b9" radius={[3, 3, 0, 0]} name="Km Recorridos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>

              {/* Gráfica barras horizontal: km por área */}
              {areaKmData.length > 1 && (
                <Card>
                  <CardHeader
                    title="Kilometraje por Área"
                    subtitle="Distribución del consumo agrupada por área organizacional"
                  />
                  <div style={{ padding: '8px 16px 16px' }}>
                    <ResponsiveContainer width="100%" height={Math.max(160, areaKmData.length * 40)}>
                      <BarChart
                        data={areaKmData}
                        layout="vertical"
                        margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--sz-border)" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', fill: 'var(--sz-muted)' }}
                          unit=" km"
                        />
                        <YAxis
                          type="category" dataKey="name" width={110}
                          tick={{ fontSize: 11, fontFamily: 'IBM Plex Sans, sans-serif', fill: 'var(--sz-text)' }}
                        />
                        <Tooltip
                          contentStyle={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12, background: 'var(--sz-card)', border: '1px solid var(--sz-border)' }}
                          formatter={(value: number) => [`${value.toLocaleString('es-MX')} km`, 'Km']}
                        />
                        <Bar dataKey="km" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}

              {/* Tabla de utilización */}
              <Card>
                <CardHeader
                  title="Utilización de Flota"
                  subtitle="Estado actual y participación km de cada vehículo en el periodo"
                />
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--sz-bg)' }}>
                        {['Vehículo', 'Tipo', 'Área', 'Estado Actual', 'Conductor', 'Km Periodo', '% Utilización'].map(h => (
                          <th key={h} style={TH}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVehicles.map((v, i) => {
                        const fuel     = fuelSummary?.vehicles.find(fv => fv.vehicleId === v.id);
                        const totalKm  = fuelSummary?.totals.totalKm ?? 0;
                        const vKm      = fuel?.totalKm ?? 0;
                        const utilPct  = totalKm > 0 ? Math.round((vKm / totalKm) * 100) : 0;
                        const sc       = STATUS_COLORS[v.status] ?? 'var(--sz-muted)';
                        const rowBg    = i % 2 === 0 ? 'var(--sz-card)' : 'var(--sz-bg)';
                        return (
                          <tr key={v.id} style={{ borderBottom: '1px solid var(--sz-border)', background: rowBg }}>
                            <td style={{ ...TD, fontWeight: 600 }}>
                              {v.code}
                              <div style={{ ...MONO, color: 'var(--sz-muted)' }}>{v.plate}</div>
                            </td>
                            <td style={{ ...TD, color: 'var(--sz-muted)' }}>{TYPE_LABELS[v.type] ?? v.type}</td>
                            <td style={{ ...TD, color: 'var(--sz-muted)' }}>{v.area ?? '—'}</td>
                            <td style={TD}>
                              <Badge
                                label={STATUS_LABELS[v.status] ?? v.status}
                                color={sc} bg={`${sc}18`}
                              />
                            </td>
                            <td style={{ ...TD, color: 'var(--sz-muted)' }}>
                              {v.driver?.name ?? '—'}
                            </td>
                            <td style={{ ...TD, ...MONO, color: vKm > 0 ? 'var(--sz-text)' : 'var(--sz-muted)' }}>
                              {vKm > 0
                                ? `${vKm.toLocaleString('es-MX', { maximumFractionDigits: 0 })} km`
                                : '—'}
                            </td>
                            <td style={TD}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 72, height: 6, background: 'var(--sz-border)', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{
                                    width: `${utilPct}%`, height: '100%', borderRadius: 3,
                                    background: utilPct > 40 ? '#27ae60' : utilPct > 15 ? '#f39c12' : '#e74c3c',
                                  }} />
                                </div>
                                <span style={{ ...MONO, color: 'var(--sz-muted)' }}>{utilPct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB 3 — Mantenimiento                                           */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'maintenance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Mini-KPIs de mantenimiento */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {[
                  { label: 'Servicios Pendientes',       value: filteredUpcoming.length,                                           color: '#2980b9' },
                  { label: 'Servicios Vencidos',         value: filteredUpcoming.filter(u => u.urgency === 'OVERDUE').length,  color: '#c0392b' },
                  { label: 'Servicios Críticos (≤7d)',   value: filteredUpcoming.filter(u => u.urgency === 'CRITICAL').length, color: '#e67e22' },
                ].map(({ label, value, color }) => (
                  <Card key={label} topAccent={color}>
                    <div style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'IBM Plex Mono, monospace' }}>{value}</div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Gráfica distribución por urgencia */}
              {filteredUpcoming.length > 0 && (
                <Card>
                  <CardHeader
                    title="Servicios Preventivos Pendientes por Urgencia"
                    subtitle="Distribución de los mantenimientos según nivel de criticidad"
                    action={
                      <button
                        onClick={exportMaintenanceCSV}
                        disabled={exporting !== null}
                        style={BTN_GHOST('#e67e22', exporting !== null)}
                      >
                        <Download size={11} /> CSV Mantenimiento
                      </button>
                    }
                  />
                  <div style={{ padding: '8px 16px 16px' }}>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart
                        data={urgencyChartData}
                        margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--sz-border)" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif', fill: 'var(--sz-text)' }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', fill: 'var(--sz-muted)' }}
                        />
                        <Tooltip
                          contentStyle={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12, background: 'var(--sz-card)', border: '1px solid var(--sz-border)' }}
                          formatter={(value: number) => [value, 'Servicios']}
                        />
                        <Bar dataKey="count" name="Servicios" radius={[4, 4, 0, 0]}>
                          {urgencyChartData.map(entry => (
                            <Cell key={entry.key} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}

              {/* Tabla de próximos servicios */}
              <Card>
                <CardHeader
                  title="Próximos Servicios Preventivos"
                  subtitle="Ordenados por criticidad: vencidos → críticos → próximos"
                />
                {filteredUpcoming.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>
                    No hay servicios preventivos pendientes. ¡Flota al día!
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--sz-bg)' }}>
                          {['Urgencia', 'Vehículo', 'Placa', 'Plan / Servicio', 'Próxima Fecha', 'Días Rest.', 'Km Rest.', 'Con OT'].map(h => (
                            <th key={h} style={TH}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...filteredUpcoming]
                          .sort((a, b) => {
                            const ord = { OVERDUE: 0, CRITICAL: 1, WARNING: 2 } as const;
                            return (ord[a.urgency] ?? 3) - (ord[b.urgency] ?? 3);
                          })
                          .map((u, i) => {
                            const ug    = URGENCY_MAP[u.urgency];
                            const rowBg = i % 2 === 0 ? 'var(--sz-card)' : 'var(--sz-bg)';
                            const daysStr = u.daysUntilDue != null
                              ? (u.daysUntilDue <= 0
                                  ? `${Math.abs(u.daysUntilDue)}d vencido`
                                  : `${u.daysUntilDue} días`)
                              : '—';
                            return (
                              <tr key={u.planId} style={{ borderBottom: '1px solid var(--sz-border)', background: rowBg }}>
                                <td style={TD}>
                                  <span style={{ padding: '2px 8px', borderRadius: 4, background: ug.bg, color: ug.color, fontSize: 10, fontWeight: 700 }}>
                                    {ug.label}
                                  </span>
                                </td>
                                <td style={{ ...TD, fontWeight: 600 }}>{u.vehicleCode}</td>
                                <td style={{ ...TD, ...MONO, color: 'var(--sz-accent)' }}>{u.vehiclePlate}</td>
                                <td style={TD}>
                                  <div style={{ fontWeight: 600 }}>{u.planName}</div>
                                  {u.serviceType && (
                                    <div style={{ fontSize: 10, color: 'var(--sz-muted)' }}>
                                      {SERVICE_TYPE_LABELS[u.serviceType] ?? u.serviceType}
                                    </div>
                                  )}
                                </td>
                                <td style={{ ...TD, ...MONO, whiteSpace: 'nowrap' }}>
                                  {u.nextDue ? new Date(u.nextDue).toLocaleDateString('es-MX') : '—'}
                                </td>
                                <td style={{ ...TD, ...MONO, color: (u.daysUntilDue ?? 1) <= 0 ? '#c0392b' : 'var(--sz-text)' }}>
                                  {daysStr}
                                </td>
                                <td style={{ ...TD, ...MONO }}>
                                  {u.kmRemaining != null ? `${u.kmRemaining.toLocaleString('es-MX')} km` : '—'}
                                </td>
                                <td style={TD}>
                                  <span style={{
                                    padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                    background: u.hasOpenOT ? '#e8f8f0' : '#fef3e7',
                                    color:      u.hasOpenOT ? '#27ae60' : '#e67e22',
                                  }}>
                                    {u.hasOpenOT ? 'Sí' : 'No'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {/* Tabla de documentos por vehículo */}
              <Card>
                <CardHeader
                  title="Estado de Documentos Vehiculares"
                  subtitle="Vigencia de seguros, verificación y tarjetas de circulación"
                />
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--sz-bg)' }}>
                        {['Vehículo', 'Placa', 'Seguro', 'Verificación', 'Licencia Veh.', 'Tarj. Circulación', 'Estado Global'].map(h => (
                          <th key={h} style={TH}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVehicles.map((v, i) => {
                        const allOk = hasAllDocs(v);
                        const rowBg = i % 2 === 0 ? 'var(--sz-card)' : 'var(--sz-bg)';
                        return (
                          <tr key={v.id} style={{ borderBottom: '1px solid var(--sz-border)', background: rowBg }}>
                            <td style={{ ...TD, fontWeight: 600 }}>
                              {v.code}
                              <div style={{ fontSize: 10, color: 'var(--sz-muted)' }}>{v.brand} {v.model}</div>
                            </td>
                            <td style={{ ...TD, ...MONO, color: 'var(--sz-accent)' }}>{v.plate}</td>
                            {[v.insuranceExpiry, v.verificationExpiry, v.licenseExpiry, v.circulationCard].map((exp, di) => {
                              const st = docBadge(exp);
                              return (
                                <td key={di} style={TD}>
                                  <span style={{ padding: '2px 8px', borderRadius: 4, background: st.bg, color: st.color, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    {st.label}
                                  </span>
                                </td>
                              );
                            })}
                            <td style={TD}>
                              <span style={{
                                padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                background: allOk ? '#e8f8f0' : '#fdecea',
                                color:      allOk ? '#27ae60' : '#c0392b',
                              }}>
                                {allOk ? '✓ Al día' : '✗ Atención'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ── Componente interno: tarjeta KPI ──────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  color: string;
  Icon: React.ElementType;
  metaLabel: string;
  metaMet: boolean | null;
  sub: string;
}

function KpiCard({ label, value, color, Icon, metaLabel, metaMet, sub }: KpiCardProps) {
  return (
    <Card topAccent={color}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: `${color}1a`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon size={14} style={{ color }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            {label}
          </span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1, marginBottom: 6 }}>
          {value}
        </div>
        {metaMet !== null && (
          <div style={{ fontSize: 10, color: metaMet ? '#27ae60' : '#e74c3c', fontWeight: 600, marginBottom: 2 }}>
            {metaLabel} · {metaMet ? '✓ Cumplida' : '✗ Por debajo'}
          </div>
        )}
        {metaMet === null && (
          <div style={{ fontSize: 10, color: 'var(--sz-muted)', marginBottom: 2 }}>{metaLabel}</div>
        )}
        <div style={{ fontSize: 10, color: 'var(--sz-muted)' }}>{sub}</div>
      </div>
    </Card>
  );
}
