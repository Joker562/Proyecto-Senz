import { useEffect, useState, FormEvent } from 'react';
import Modal from '@/components/ui/Modal';
import { FormField, inputClass, selectClass } from '@/components/ui/FormField';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { Asset } from '@/types';

interface Props { open: boolean; onClose: () => void; onCreated: () => void }

const empty = { name: '', description: '', type: 'PREVENTIVE', triggerType: 'TIME', frequency: '1', frequencyUnit: 'months', nextDue: '', usageThreshold: '', usageUnit: 'hours', assetId: '', checklistTemplateId: '' };

export default function CreateMaintenancePlanModal({ open, onClose, onCreated }: Props) {
  const { push } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      api.get<Asset[]>('/assets'),
      api.get<{ id: string; name: string }[]>('/checklists/templates'),
    ]).then(([a, t]) => { setAssets(a.data); setTemplates(t.data); });
  }, [open]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const isTime = form.triggerType === 'TIME' || form.triggerType === 'BOTH';
  const isUsage = form.triggerType === 'USAGE' || form.triggerType === 'BOTH';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/maintenance-plans', {
        name: form.name,
        description: form.description || undefined,
        type: form.type,
        triggerType: form.triggerType,
        ...(isTime && form.frequency ? { frequency: Number(form.frequency), frequencyUnit: form.frequencyUnit } : {}),
        ...(isTime && form.nextDue ? { nextDue: new Date(form.nextDue).toISOString() } : {}),
        ...(isUsage && form.usageThreshold ? { usageThreshold: Number(form.usageThreshold), usageUnit: form.usageUnit } : {}),
        assetId: form.assetId,
        checklistTemplateId: form.checklistTemplateId || undefined,
      });
      push('Plan de mantenimiento creado', 'success');
      onCreated();
      onClose();
      setForm(empty);
    } catch { push('Error al crear el plan', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Plan de Mantenimiento" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Nombre del plan" required>
          <input className={inputClass} value={form.name} onChange={set('name')} placeholder="Ej: PM Mensual Compresor" required />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Activo" required>
            <select className={selectClass} value={form.assetId} onChange={set('assetId')} required>
              <option value="">Seleccionar activo...</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
            </select>
          </FormField>
          <FormField label="Tipo">
            <select className={selectClass} value={form.type} onChange={set('type')}>
              <option value="PREVENTIVE">Preventivo</option>
              <option value="INSPECTION">Inspeccion</option>
              <option value="PREDICTIVE">Predictivo</option>
              <option value="CORRECTIVE">Correctivo</option>
            </select>
          </FormField>
        </div>

        <FormField label="Trigger de activacion" required>
          <select className={selectClass} value={form.triggerType} onChange={set('triggerType')}>
            <option value="TIME">Por tiempo (diario/semanal/mensual)</option>
            <option value="USAGE">Por uso (horas/ciclos/km)</option>
            <option value="BOTH">Ambos (el primero que se cumpla)</option>
          </select>
        </FormField>

        {isTime && (
          <div className="grid grid-cols-3 gap-3 p-3 border rounded-lg bg-muted/20">
            <p className="col-span-3 text-xs font-medium text-muted-foreground">Configuracion por tiempo</p>
            <FormField label="Frecuencia" required={isTime}>
              <input className={inputClass} type="number" min="1" value={form.frequency} onChange={set('frequency')} />
            </FormField>
            <FormField label="Unidad">
              <select className={selectClass} value={form.frequencyUnit} onChange={set('frequencyUnit')}>
                <option value="days">Dias</option>
                <option value="weeks">Semanas</option>
                <option value="months">Meses</option>
              </select>
            </FormField>
            <FormField label="Proxima fecha" required={isTime && !isUsage}>
              <input className={inputClass} type="datetime-local" value={form.nextDue} onChange={set('nextDue')} />
            </FormField>
          </div>
        )}

        {isUsage && (
          <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg bg-muted/20">
            <p className="col-span-2 text-xs font-medium text-muted-foreground">Configuracion por uso</p>
            <FormField label="Umbral de activacion" required={isUsage}>
              <input className={inputClass} type="number" min="1" value={form.usageThreshold} onChange={set('usageThreshold')} placeholder="Ej: 500" />
            </FormField>
            <FormField label="Unidad de uso">
              <select className={selectClass} value={form.usageUnit} onChange={set('usageUnit')}>
                <option value="hours">Horas de operacion</option>
                <option value="cycles">Ciclos</option>
                <option value="km">Kilometros</option>
              </select>
            </FormField>
          </div>
        )}

        {templates.length > 0 && (
          <FormField label="Checklist (opcional)">
            <select className={selectClass} value={form.checklistTemplateId} onChange={set('checklistTemplateId')}>
              <option value="">Sin checklist</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </FormField>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-muted">Cancelar</button>
          <button type="submit" disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Guardando...' : 'Crear Plan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
