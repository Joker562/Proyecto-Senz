import { useEffect, useState, useCallback } from 'react';
import { api } from '@/services/api';
import { Calendar, Clock, CheckCircle2, AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import CreateMaintenancePlanModal from '@/components/work-orders/CreateMaintenancePlanModal';

interface MaintenancePlan {
  id: string;
  name: string;
  description?: string;
  type: string;
  frequency: number;
  frequencyUnit: string;
  nextDue: string;
  active: boolean;
  asset: { id: string; name: string; code: string; area: string };
}

const TYPE_LABELS: Record<string, string> = {
  PREVENTIVE: 'Preventivo', CORRECTIVE: 'Correctivo', PREDICTIVE: 'Predictivo', INSPECTION: 'Inspeccion',
};
const TYPE_COLORS: Record<string, string> = {
  PREVENTIVE: 'bg-blue-100 text-blue-700', INSPECTION: 'bg-purple-100 text-purple-700',
  PREDICTIVE: 'bg-cyan-100 text-cyan-700', CORRECTIVE: 'bg-orange-100 text-orange-700',
};
const UNIT_LABELS: Record<string, string> = { days: 'dias', weeks: 'semanas', months: 'meses' };

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

export default function MaintenancePage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'overdue'>('all');

  const canCreate = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<MaintenancePlan[]>('/maintenance-plans', { params: { active: 'true' } });
      setPlans(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const categorized = {
    overdue: plans.filter((p) => daysUntil(p.nextDue) < 0),
    upcoming: plans.filter((p) => { const d = daysUntil(p.nextDue); return d >= 0 && d <= 7; }),
    later: plans.filter((p) => daysUntil(p.nextDue) > 7),
  };

  const visible = filter === 'all' ? plans : filter === 'overdue' ? categorized.overdue : categorized.upcoming;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plan de Mantenimiento</h1>
          <p className="text-muted-foreground text-sm">Calendario de mantenimientos preventivos e inspecciones</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchPlans} className="p-2 border rounded-lg hover:bg-muted transition-colors">
            <RefreshCw size={16} />
          </button>
          {canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus size={16} /> Nuevo Plan
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {!loading && plans.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'all', icon: Calendar, label: 'Total planes', count: plans.length, color: 'text-blue-500', bg: 'bg-blue-50' },
            { key: 'upcoming', icon: Clock, label: 'Proximos 7 dias', count: categorized.upcoming.length, color: 'text-amber-500', bg: 'bg-amber-50' },
            { key: 'overdue', icon: AlertTriangle, label: 'Vencidos', count: categorized.overdue.length, color: 'text-red-500', bg: 'bg-red-50' },
          ].map(({ key, icon: Icon, label, count, color, bg }) => (
            <button
              key={key}
              onClick={() => setFilter(filter === key ? 'all' : key as typeof filter)}
              className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${filter === key ? 'ring-2 ring-blue-500 border-blue-300' : 'bg-card hover:shadow-sm'}`}
            >
              <div className={`${bg} p-2 rounded-lg`}>
                <Icon className={`${color} h-5 w-5`} />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="text-2xl font-bold">{count}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando planes...</p>
      ) : plans.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center space-y-3">
          <Calendar size={48} className="mx-auto text-muted-foreground/30" />
          <p className="font-medium">Sin planes de mantenimiento</p>
          <p className="text-sm text-muted-foreground">Crea el primer plan para comenzar a programar mantenimientos.</p>
          {canCreate && (
            <button onClick={() => setShowCreate(true)} className="text-sm text-blue-600 hover:underline font-medium">
              Crear primer plan
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((plan) => {
            const days = daysUntil(plan.nextDue);
            const overdue = days < 0;
            const urgent = days >= 0 && days <= 3;
            return (
              <div
                key={plan.id}
                className={`bg-card border rounded-xl p-4 flex items-center gap-4 transition-colors ${overdue ? 'border-red-200 bg-red-50/50' : urgent ? 'border-amber-200 bg-amber-50/50' : ''}`}
              >
                <div className={`p-2.5 rounded-lg shrink-0 ${overdue ? 'bg-red-100' : urgent ? 'bg-amber-100' : 'bg-blue-50'}`}>
                  {overdue ? <AlertTriangle size={18} className="text-red-600" /> : urgent ? <Clock size={18} className="text-amber-600" /> : <CheckCircle2 size={18} className="text-blue-600" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{plan.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[plan.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {TYPE_LABELS[plan.type] ?? plan.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {plan.asset.name} ({plan.asset.code}) — {plan.asset.area}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className={`font-semibold text-sm ${overdue ? 'text-red-600' : urgent ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {overdue ? `Vencido hace ${Math.abs(days)}d` : days === 0 ? 'Hoy' : `En ${days} dias`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cada {plan.frequency} {UNIT_LABELS[plan.frequencyUnit] ?? plan.frequencyUnit}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(plan.nextDue).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateMaintenancePlanModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchPlans}
      />
    </div>
  );
}
