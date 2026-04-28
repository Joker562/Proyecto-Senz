import { useEffect, useState, FormEvent } from 'react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { Plus, Trash2, Settings } from 'lucide-react';

/* ── Senz palette ── */
const ACCENT = '#e67e22';
const BORDER = '#e4e4e4';
const TEXT   = '#1c1c1c';
const MUTED  = '#888';
const TOPBAR = '#ffffff';
const CARD   = '#ffffff';
const TH_BG  = '#fafafa';
const C_RED  = '#c0392b';

interface Area { id: string; name: string; createdAt: string }

const selStyle: React.CSSProperties = {
  padding: '6px 10px', fontSize: 13, border: `1px solid ${BORDER}`,
  background: '#f9f9f9', color: TEXT, fontFamily: 'IBM Plex Sans, sans-serif',
  borderRadius: 2, outline: 'none', width: '100%', boxSizing: 'border-box',
};

export default function SettingsPage() {
  const { push } = useToast();
  const [areas, setAreas]       = useState<Area[]>([]);
  const [newArea, setNewArea]   = useState('');
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [savingArea, setSavingArea]     = useState(false);
  const [deletingId, setDeletingId]     = useState<string | null>(null);

  const fetchAreas = () => {
    setLoadingAreas(true);
    api.get<Area[]>('/areas')
      .then(({ data }) => setAreas(data))
      .finally(() => setLoadingAreas(false));
  };

  useEffect(fetchAreas, []);

  const handleAddArea = async (e: FormEvent) => {
    e.preventDefault();
    if (!newArea.trim()) return;
    setSavingArea(true);
    try {
      await api.post('/areas', { name: newArea.trim() });
      push(`Área "${newArea.trim()}" creada`, 'success');
      setNewArea('');
      fetchAreas();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      push(msg ?? 'Error al crear área', 'error');
    } finally {
      setSavingArea(false);
    }
  };

  const handleDeleteArea = async (area: Area) => {
    if (!confirm(`¿Eliminar el área "${area.name}"? Los activos que la usaban conservarán su valor actual.`)) return;
    setDeletingId(area.id);
    try {
      await api.delete(`/areas/${area.id}`);
      push(`Área "${area.name}" eliminada`, 'success');
      fetchAreas();
    } catch {
      push('Error al eliminar el área', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const card: React.CSSProperties = { background: CARD, border: `1px solid ${BORDER}`, fontFamily: 'IBM Plex Sans, sans-serif' };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'IBM Plex Sans, sans-serif' }}>

      {/* Topbar */}
      <div style={{ background: TOPBAR, borderBottom: `1px solid ${BORDER}`, padding: '0 24px', height: 48, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Settings size={16} color={MUTED} />
        <span style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Configuración</span>
      </div>

      <div style={{ padding: 24, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Gestión de Áreas ── */}
        <div style={card}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>Gestión de Áreas</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: MUTED }}>{areas.length} área{areas.length !== 1 ? 's' : ''}</span>
          </div>

          <div style={{ padding: 18 }}>
            <p style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>
              Las áreas se usan para clasificar activos y órdenes de trabajo. Puedes agregar o eliminar según la estructura de tu planta.
            </p>

            {/* Formulario de nueva área */}
            <form onSubmit={handleAddArea} style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              <input
                value={newArea}
                onChange={(e) => setNewArea(e.target.value)}
                placeholder="Nombre del área (ej: Corte, Costura, Almacén…)"
                style={{ ...selStyle, flex: 1 }}
                maxLength={60}
              />
              <button
                type="submit"
                disabled={savingArea || !newArea.trim()}
                style={{
                  padding: '6px 16px', fontSize: 12, fontWeight: 600,
                  background: newArea.trim() ? ACCENT : '#ccc',
                  color: '#fff', border: 'none', borderRadius: 2, cursor: newArea.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                }}
              >
                <Plus size={13} />
                {savingArea ? 'Guardando…' : 'Agregar'}
              </button>
            </form>

            {/* Tabla de áreas */}
            {loadingAreas ? (
              <p style={{ color: MUTED, fontSize: 13 }}>Cargando…</p>
            ) : areas.length === 0 ? (
              <p style={{ color: MUTED, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No hay áreas registradas.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: TH_BG }}>
                    {['Nombre', 'Creada', ''].map((h) => (
                      <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {areas.map((area, i) => (
                    <tr key={area.id} style={{ background: i % 2 === 0 ? CARD : TH_BG, borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: TEXT }}>{area.name}</td>
                      <td style={{ padding: '8px 12px', color: MUTED }}>
                        {new Date(area.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleDeleteArea(area)}
                          disabled={deletingId === area.id}
                          style={{
                            background: 'transparent', border: `1px solid ${C_RED}`, color: C_RED,
                            padding: '3px 8px', borderRadius: 2, cursor: 'pointer', fontSize: 11,
                            display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'IBM Plex Sans, sans-serif',
                            opacity: deletingId === area.id ? .5 : 1,
                          }}
                        >
                          <Trash2 size={11} />
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
