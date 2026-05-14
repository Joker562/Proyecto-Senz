import { useState } from 'react';
import { CheckSquare, Square, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  id: string; order: number; description: string; required: boolean;
  checked: boolean; checkedAt?: string; notes?: string;
  checkedBy?: { id: string; name: string };
}
interface Checklist { id: string; completedAt?: string; items: ChecklistItem[] }

interface Props {
  workOrderId: string;
  checklist: Checklist | null;
  onUpdated: () => void;
  templates: { id: string; name: string }[];
}

export default function ChecklistPanel({ workOrderId, checklist, onUpdated, templates }: Props) {
  const { user } = useAuth();
  const { push } = useToast();
  const [creating, setCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customItems, setCustomItems] = useState<{ description: string; required: boolean }[]>([]);
  const [mode, setMode] = useState<'template' | 'custom'>('template');
  const canEdit = user?.role !== 'EXECUTIVE';

  const toggleItem = async (item: ChecklistItem) => {
    if (!canEdit) return;
    try {
      await api.patch(`/checklists/items/${item.id}`, { checked: !item.checked });
      onUpdated();
    } catch { push('Error al actualizar item', 'error'); }
  };

  const createChecklist = async () => {
    try {
      if (mode === 'template' && selectedTemplate) {
        await api.post(`/checklists/work-order/${workOrderId}`, { templateId: selectedTemplate });
      } else if (mode === 'custom' && customItems.length) {
        await api.post(`/checklists/work-order/${workOrderId}`, { items: customItems });
      } else return;
      push('Checklist creado', 'success');
      onUpdated();
      setCreating(false);
    } catch { push('Error al crear checklist', 'error'); }
  };

  const addCustomItem = () => setCustomItems((prev) => [...prev, { description: '', required: false }]);
  const removeCustomItem = (i: number) => setCustomItems((prev) => prev.filter((_, j) => j !== i));
  const updateCustomItem = (i: number, field: string, value: unknown) =>
    setCustomItems((prev) => prev.map((item, j) => j === i ? { ...item, [field]: value } : item));

  if (!checklist) {
    if (!canEdit) return <p className="text-xs text-muted-foreground">Sin checklist</p>;
    return (
      <div className="space-y-3">
        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
          >
            <Plus size={14} /> Agregar checklist
          </button>
        ) : (
          <div className="border rounded-xl p-4 space-y-3 bg-muted/20">
            <div className="flex gap-2">
              {['template', 'custom'].map((m) => (
                <button key={m} onClick={() => setMode(m as 'template' | 'custom')}
                  className={cn('text-xs px-3 py-1 rounded-lg font-medium transition-colors', mode === m ? 'bg-blue-600 text-white' : 'border hover:bg-muted')}>
                  {m === 'template' ? 'Desde plantilla' : 'Personalizado'}
                </button>
              ))}
            </div>

            {mode === 'template' ? (
              <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="">Seleccionar plantilla...</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            ) : (
              <div className="space-y-2">
                {customItems.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={item.description} onChange={(e) => updateCustomItem(i, 'description', e.target.value)}
                      placeholder={`Item ${i + 1}`}
                      className="flex-1 px-2 py-1.5 border rounded-lg text-sm bg-background focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                      <input type="checkbox" checked={item.required} onChange={(e) => updateCustomItem(i, 'required', e.target.checked)} />
                      Obligatorio
                    </label>
                    <button onClick={() => removeCustomItem(i)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button onClick={addCustomItem} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <Plus size={12} /> Agregar item
                </button>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setCreating(false)} className="text-xs px-3 py-1.5 border rounded-lg hover:bg-muted">Cancelar</button>
              <button onClick={createChecklist} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                Crear checklist
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const done = checklist.items.filter((i) => i.checked).length;
  const total = checklist.items.length;
  const requiredPending = checklist.items.filter((i) => i.required && !i.checked).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Checklist ({done}/{total})</span>
        {requiredPending > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <AlertCircle size={12} /> {requiredPending} obligatorio{requiredPending > 1 ? 's' : ''} pendiente{requiredPending > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-1.5">
        <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>

      <div className="space-y-1.5 max-h-56 overflow-y-auto">
        {checklist.items.map((item) => (
          <div
            key={item.id}
            onClick={() => toggleItem(item)}
            className={cn('flex items-start gap-2.5 p-2 rounded-lg transition-colors', canEdit ? 'cursor-pointer hover:bg-muted/50' : '', item.checked ? 'opacity-70' : '')}
          >
            {item.checked
              ? <CheckSquare size={16} className="text-emerald-500 mt-0.5 shrink-0" />
              : <Square size={16} className={cn('mt-0.5 shrink-0', item.required ? 'text-amber-500' : 'text-muted-foreground')} />}
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm', item.checked && 'line-through text-muted-foreground')}>{item.description}</p>
              {item.required && !item.checked && <span className="text-xs text-amber-500">Obligatorio</span>}
              {item.checked && item.checkedBy && (
                <p className="text-xs text-muted-foreground">{item.checkedBy.name} · {item.checkedAt ? new Date(item.checkedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
