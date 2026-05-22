import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';

interface Vehicle {
  id: string; code: string; plate: string; brand: string; model: string;
  year: number; color: string | null; type: string; status: string;
  fuelType: string; tankCapacity: number | null; currentKm: number;
  area: string | null;
  insuranceExpiry: string | null; verificationExpiry: string | null;
  licenseExpiry: string | null; circulationCard: string | null;
  driver: { id: string; name: string } | null;
}

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

const STATUS_FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'AVAILABLE', label: 'Disponible' },
  { key: 'IN_USE', label: 'En uso' },
  { key: 'MAINTENANCE', label: 'Mantenimiento' },
  { key: 'OUT_OF_SERVICE', label: 'Fuera de servicio' },
];

const emptyForm = {
  code: '', plate: '', brand: '', model: '',
  year: String(new Date().getFullYear()), color: '', type: 'CAR',
  status: 'AVAILABLE', fuelType: 'DIESEL', tankCapacity: '',
  currentKm: '0', area: '',
  insuranceExpiry: '', verificationExpiry: '',
  licenseExpiry: '', circulationCard: '',
};

const inp: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)',
  background: 'var(--sz-bg)', color: 'var(--sz-text)',
  fontFamily: 'IBM Plex Sans, sans-serif', boxSizing: 'border-box',
};

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--sz-muted)',
  textTransform: 'uppercase' as const, letterSpacing: '.4px', marginBottom: 4,
};

const btn = (active: boolean): React.CSSProperties => ({
  padding: '5px 14px', fontSize: 12, fontWeight: 600,
  borderRadius: 20, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
  border: `1px solid ${active ? 'var(--sz-accent)' : 'var(--sz-border)'}`,
  background: active ? 'var(--sz-accent)' : 'var(--sz-card)',
  color: active ? '#fff' : 'var(--sz-muted)', transition: 'all .15s',
});

export default function FleetVehiclesPage() {
  const toast = useToast();

  const [vehicles, setVehicles]     = useState<Vehicle[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<Vehicle | null>(null);
  const [form, setForm]             = useState({ ...emptyForm });
  const [saving, setSaving]         = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (search)       params.search = search;
    api.get<{ data: Vehicle[] }>('/fleet/vehicles', { params })
      .then(r => setVehicles(r.data.data ?? []))
      .catch(() => toast.push('Error al cargar vehículos', 'error'))
      .finally(() => setLoading(false));
  }, [statusFilter, search, toast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, year: String(new Date().getFullYear()) });
    setModalOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({
      code: v.code, plate: v.plate, brand: v.brand, model: v.model,
      year: String(v.year), color: v.color ?? '', type: v.type,
      status: v.status, fuelType: v.fuelType,
      tankCapacity: v.tankCapacity != null ? String(v.tankCapacity) : '',
      currentKm: String(v.currentKm), area: v.area ?? '',
      insuranceExpiry:    v.insuranceExpiry    ? v.insuranceExpiry.slice(0, 10)    : '',
      verificationExpiry: v.verificationExpiry ? v.verificationExpiry.slice(0, 10) : '',
      licenseExpiry:      v.licenseExpiry      ? v.licenseExpiry.slice(0, 10)      : '',
      circulationCard:    v.circulationCard    ? v.circulationCard.slice(0, 10)    : '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        year:          Number(form.year),
        currentKm:     Number(form.currentKm),
        tankCapacity:  form.tankCapacity !== '' ? Number(form.tankCapacity) : null,
        color:         form.color || null,
        area:          form.area  || null,
        insuranceExpiry:    form.insuranceExpiry    || null,
        verificationExpiry: form.verificationExpiry || null,
        licenseExpiry:      form.licenseExpiry      || null,
        circulationCard:    form.circulationCard    || null,
      };
      if (editing) {
        await api.patch(`/fleet/vehicles/${editing.id}`, payload);
        toast.push('Vehículo actualizado', 'success');
      } else {
        await api.post('/fleet/vehicles', payload);
        toast.push('Vehículo creado', 'success');
      }
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Error al guardar';
      toast.push(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/fleet/vehicles/${id}`);
      toast.push('Vehículo eliminado', 'success');
      setConfirmDel(null);
      load();
    } catch {
      toast.push('Error al eliminar', 'error');
    }
  };

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const TH = ['Código','Placa','Vehículo','Tipo','Combustible','Km Actual','Área','Conductor','Estado',''];

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* Topbar */}
      <div style={{ background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)', padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>Vehículos</span>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--sz-accent)', color: '#fff', border: 'none', borderRadius: 'var(--sz-radius)', padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}>
          <Plus size={14} /> Nuevo Vehículo
        </button>
      </div>

      <div style={{ padding: '16px 24px' }}>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--sz-muted)' }} />
            <input placeholder="Placa o código..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, width: 200, paddingLeft: 28 }} />
          </div>
          {STATUS_FILTERS.map(f => (
            <button key={f.key} onClick={() => setStatus(f.key)} style={btn(statusFilter === f.key)}>{f.label}</button>
          ))}
          <button onClick={load} title="Recargar" style={{ background: 'var(--sz-card)', border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)', cursor: 'pointer', padding: '6px 10px', color: 'var(--sz-muted)', display: 'flex' }}>
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Tabla */}
        <Card>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>Cargando...</div>
            ) : vehicles.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>Sin vehículos registrados</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--sz-bg)' }}>
                    {TH.map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v, i) => {
                    const st = STATUS_MAP[v.status];
                    return (
                      <tr key={v.id} style={{ borderBottom: '1px solid var(--sz-border)', background: i % 2 === 0 ? 'var(--sz-card)' : 'var(--sz-bg)' }}>
                        <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-accent)', fontWeight: 700 }}>{v.code}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700 }}>{v.plate}</td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: 'var(--sz-text)' }}>{v.brand} {v.model} <span style={{ color: 'var(--sz-muted)' }}>({v.year})</span></td>
                        <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{TYPE_LABELS[v.type] ?? v.type}</td>
                        <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{FUEL_LABELS[v.fuelType] ?? v.fuelType}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, whiteSpace: 'nowrap' }}>{v.currentKm.toLocaleString('es-MX')} km</td>
                        <td style={{ padding: '9px 12px', color: 'var(--sz-muted)' }}>{v.area ?? '—'}</td>
                        <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{v.driver?.name ?? '—'}</td>
                        <td style={{ padding: '9px 12px' }}>{st && <Badge label={st.label} color={st.color} bg={st.bg} />}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => openEdit(v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sz-muted)', padding: 4, display: 'flex' }}><Pencil size={13} /></button>
                            <button onClick={() => setConfirmDel(v.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', padding: 4, display: 'flex' }}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      {/* Modal crear/editar */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--sz-card)', borderRadius: 12, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.25)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--sz-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--sz-text)' }}>{editing ? 'Editar Vehículo' : 'Nuevo Vehículo'}</span>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--sz-muted)' }}>✕</button>
            </div>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {([
                { k: 'code',  l: 'Código',       t: 'text'   },
                { k: 'plate', l: 'Placa',         t: 'text'   },
                { k: 'brand', l: 'Marca',         t: 'text'   },
                { k: 'model', l: 'Modelo',        t: 'text'   },
                { k: 'year',  l: 'Año',           t: 'number' },
                { k: 'color', l: 'Color',         t: 'text'   },
                { k: 'currentKm',    l: 'Km Actual',           t: 'number' },
                { k: 'tankCapacity', l: 'Capacidad Tanque (L)', t: 'number' },
                { k: 'area',         l: 'Área',                t: 'text'   },
              ] as { k: string; l: string; t: string }[]).map(({ k, l, t }) => (
                <div key={k}>
                  <label style={lbl}>{l}</label>
                  <input type={t} value={(form as Record<string, string>)[k]} onChange={e => setF(k, e.target.value)} style={inp} step="any" />
                </div>
              ))}
              <div>
                <label style={lbl}>Tipo</label>
                <select value={form.type} onChange={e => setF('type', e.target.value)} style={inp}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Combustible</label>
                <select value={form.fuelType} onChange={e => setF('fuelType', e.target.value)} style={inp}>
                  {Object.entries(FUEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Estado</label>
                <select value={form.status} onChange={e => setF('status', e.target.value)} style={inp}>
                  {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10, marginTop: 4 }}>Documentos (fecha de vencimiento)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {([
                    { k: 'insuranceExpiry',    l: 'Seguro vehicular'       },
                    { k: 'verificationExpiry', l: 'Verificación vehicular'  },
                    { k: 'licenseExpiry',      l: 'Licencia'               },
                    { k: 'circulationCard',    l: 'Tarjeta de circulación'  },
                  ] as { k: string; l: string }[]).map(({ k, l }) => (
                    <div key={k}>
                      <label style={lbl}>{l}</label>
                      <input type="date" value={(form as Record<string, string>)[k]} onChange={e => setF(k, e.target.value)} style={inp} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sz-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setModalOpen(false)} style={{ padding: '7px 16px', background: 'var(--sz-bg)', border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)', cursor: 'pointer', fontSize: 13, color: 'var(--sz-muted)' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '7px 16px', background: 'var(--sz-accent)', color: '#fff', border: 'none', borderRadius: 'var(--sz-radius)', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? .6 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--sz-card)', borderRadius: 10, padding: 24, maxWidth: 360, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--sz-text)', marginBottom: 8 }}>¿Eliminar vehículo?</div>
            <div style={{ fontSize: 13, color: 'var(--sz-muted)', marginBottom: 20 }}>Esta acción no se puede deshacer.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => setConfirmDel(null)} style={{ padding: '7px 18px', background: 'var(--sz-bg)', border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={() => handleDelete(confirmDel)} style={{ padding: '7px 18px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: 'var(--sz-radius)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
