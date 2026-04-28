import { FormEvent, useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { FormField, inputClass, selectClass } from '@/components/ui/FormField';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';

interface Props { open: boolean; onClose: () => void; onCreated: () => void }

interface Area { id: string; name: string }

const emptyForm = { code: '', name: '', description: '', location: '', area: '', manufacturer: '', model: '', serialNumber: '' };

export default function CreateAssetModal({ open, onClose, onCreated }: Props) {
  const { push } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [areas, setAreas] = useState<Area[]>([]);

  useEffect(() => {
    if (!open) return;
    api.get<Area[]>('/areas').then(({ data }) => setAreas(data)).catch(() => {});
  }, [open]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/assets', form);
      push('Activo creado correctamente', 'success');
      onCreated();
      onClose();
      setForm(emptyForm);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(typeof msg === 'string' ? msg : 'Error al crear el activo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Activo" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Codigo" required>
            <input className={inputClass} value={form.code} onChange={set('code')} placeholder="Ej: COMP-002" required />
          </FormField>
          <FormField label="Nombre" required>
            <input className={inputClass} value={form.name} onChange={set('name')} placeholder="Ej: Compresor Secundario" required />
          </FormField>
        </div>

        <FormField label="Descripcion">
          <textarea className={inputClass} rows={2} value={form.description} onChange={set('description')} placeholder="Descripcion del activo..." />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Area" required>
            <select className={selectClass} value={form.area} onChange={set('area')} required>
              <option value="">Seleccionar area...</option>
              {areas.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
          </FormField>
          <FormField label="Ubicacion" required>
            <input className={inputClass} value={form.location} onChange={set('location')} placeholder="Ej: Sala de Maquinas B" required />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Fabricante">
            <input className={inputClass} value={form.manufacturer} onChange={set('manufacturer')} placeholder="Ej: Siemens" />
          </FormField>
          <FormField label="Modelo">
            <input className={inputClass} value={form.model} onChange={set('model')} placeholder="Ej: XY-200" />
          </FormField>
          <FormField label="No de Serie">
            <input className={inputClass} value={form.serialNumber} onChange={set('serialNumber')} placeholder="SN-XXXXXX" />
          </FormField>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button
            type="submit" disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
          >
            {loading ? 'Guardando...' : 'Crear Activo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
