import { useEffect, useState, useCallback } from 'react';
import { api } from '@/services/api';
import { Asset, AssetStatus } from '@/types';
import { Search, Factory, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import CreateAssetModal from '@/components/assets/CreateAssetModal';

const STATUS_LABELS: Record<AssetStatus, string> = {
  OPERATIONAL: 'Operativo', UNDER_MAINTENANCE: 'En Mantenimiento',
  OUT_OF_SERVICE: 'Fuera de Servicio', DECOMMISSIONED: 'Dado de Baja',
};
const STATUS_COLORS: Record<AssetStatus, string> = {
  OPERATIONAL: 'bg-emerald-100 text-emerald-800',
  UNDER_MAINTENANCE: 'bg-amber-100 text-amber-800',
  OUT_OF_SERVICE: 'bg-red-100 text-red-800',
  DECOMMISSIONED: 'bg-gray-100 text-gray-600',
};

export default function AssetsPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Asset | null>(null);

  const canEdit = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const canDelete = user?.role === 'ADMIN';

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (areaFilter) params.area = areaFilter;
      const { data } = await api.get<Asset[]>('/assets', { params });
      setAssets(data);
    } finally {
      setLoading(false);
    }
  }, [areaFilter]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      await api.delete(`/assets/${confirmDelete.id}`);
      push(`Activo "${confirmDelete.name}" eliminado`, 'success');
      setConfirmDelete(null);
      fetchAssets();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      push(msg ?? 'Error al eliminar el activo', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const areas = [...new Set(assets.map((a) => a.area))].sort();

  const filtered = assets.filter(
    (a) => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activos de Planta</h1>
          <p className="text-muted-foreground text-sm">{assets.length} activos registrados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAssets} className="p-2 border rounded-lg hover:bg-muted transition-colors" title="Refrescar">
            <RefreshCw size={16} />
          </button>
          {canEdit && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus size={16} /> Nuevo Activo
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o codigo..."
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
          />
        </div>
        <select
          value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
        >
          <option value="">Todas las areas</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando activos...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center space-y-2">
          <Factory size={40} className="mx-auto text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">No se encontraron activos</p>
          {canEdit && (
            <button onClick={() => setShowCreate(true)} className="text-sm text-blue-600 hover:underline">
              Crear el primero
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((asset) => (
            <div key={asset.id} className="bg-card border rounded-xl p-5 space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 p-2.5 rounded-lg shrink-0">
                    <Factory size={18} className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{asset.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{asset.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[asset.status]}`}>
                    {STATUS_LABELS[asset.status]}
                  </span>
                  {canDelete && (
                    <button
                      onClick={() => setConfirmDelete(asset)}
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Eliminar activo"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
                <div className="flex justify-between">
                  <span className="font-medium text-foreground">Area</span>
                  <span>{asset.area}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-foreground">Ubicacion</span>
                  <span className="text-right max-w-32 truncate">{asset.location}</span>
                </div>
                {asset.manufacturer && (
                  <div className="flex justify-between">
                    <span className="font-medium text-foreground">Fabricante</span>
                    <span>{asset.manufacturer}</span>
                  </div>
                )}
              </div>

              {asset._count && asset._count.workOrders > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 text-xs text-amber-700 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                  {asset._count.workOrders} OT{asset._count.workOrders > 1 ? 's' : ''} activa{asset._count.workOrders > 1 ? 's' : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateAssetModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchAssets}
      />

      {/* Modal de confirmación de borrado */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="bg-red-100 p-2 rounded-lg">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Eliminar Activo</h3>
                <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm">
              ¿Confirmas eliminar el activo <span className="font-semibold">{confirmDelete.name}</span>{' '}
              <span className="font-mono text-xs text-muted-foreground">({confirmDelete.code})</span>?
            </p>
            {confirmDelete._count && confirmDelete._count.workOrders > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Atención: tiene {confirmDelete._count.workOrders} OT(s) activa(s). No se puede eliminar hasta cerrarlas.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deletingId === confirmDelete.id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
              >
                {deletingId === confirmDelete.id ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
