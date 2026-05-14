import { useEffect, useState, FormEvent } from 'react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { Plus, Trash2, CheckSquare, GripVertical } from 'lucide-react';
import Modal from '@/components/ui/Modal';

interface TemplateItem { id: string; order: number; description: string; required: boolean }
interface Template { id: string; name: string; description?: string; items: TemplateItem[] }

export default function ChecklistTemplatesPage() {
  const { push } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [items, setItems] = useState<{ description: string; required: boolean }[]>([{ description: '', required: false }]);
  const [saving, setSaving] = useState(false);

  const fetch = () => api.get<Template[]>('/checklists/templates').then(({ data }) => setTemplates(data));
  useEffect(() => { fetch(); }, []);

  const addItem = () => setItems((prev) => [...prev, { description: '', required: false }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, j) => j !== i));
  const updateItem = (i: number, field: string, value: unknown) =>
    setItems((prev) => prev.map((item, j) => j === i ? { ...item, [field]: value } : item));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((i) => i.description.trim());
    if (!validItems.length) return push('Agrega al menos un item', 'warning');
    setSaving(true);
    try {
      await api.post('/checklists/templates', { ...form, items: validItems });
      push('Plantilla creada', 'success');
      setShowCreate(false);
      setForm({ name: '', description: '' });
      setItems([{ description: '', required: false }]);
      fetch();
    } catch { push('Error al crear plantilla', 'error'); }
    finally { setSaving(false); }
  };

  const deleteTemplate = async (id: string) => {
    await api.delete(`/checklists/templates/${id}`);
    push('Plantilla eliminada', 'success');
    fetch();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plantillas de Checklist</h1>
          <p className="text-muted-foreground text-sm">Checklists reutilizables para ordenes de trabajo</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus size={16} /> Nueva Plantilla
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center space-y-2">
          <CheckSquare size={40} className="mx-auto text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">Sin plantillas creadas</p>
          <button onClick={() => setShowCreate(true)} className="text-sm text-blue-600 hover:underline">
            Crear primera plantilla
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-card border rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{t.name}</p>
                  {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                </div>
                <button onClick={() => deleteTemplate(t.id)} className="text-muted-foreground hover:text-red-600 transition-colors p-1">
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="border-t pt-3 space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">{t.items.length} items</p>
                {t.items.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <GripVertical size={12} className="text-muted-foreground shrink-0" />
                    <span className={item.required ? 'font-medium' : ''}>{item.description}</span>
                    {item.required && <span className="text-xs text-amber-500 ml-auto">Obligatorio</span>}
                  </div>
                ))}
                {t.items.length > 5 && <p className="text-xs text-muted-foreground">+{t.items.length - 5} mas...</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nueva Plantilla de Checklist" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nombre <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
              placeholder="Ej: Revision mensual compresor"
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Descripcion</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descripcion opcional"
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium block">Items del checklist <span className="text-red-500">*</span></label>
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                <input value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)}
                  placeholder={`Item ${i + 1}...`}
                  className="flex-1 px-2.5 py-1.5 border rounded-lg text-sm bg-background focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                <label className="flex items-center gap-1 text-xs whitespace-nowrap cursor-pointer">
                  <input type="checkbox" checked={item.required} onChange={(e) => updateItem(i, 'required', e.target.checked)} />
                  Obligatorio
                </label>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
              <Plus size={12} /> Agregar item
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-muted">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Crear Plantilla'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
