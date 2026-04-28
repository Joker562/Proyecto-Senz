import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, Copy, Trash2, Edit3, Eye, ChevronDown, ChevronUp,
  CheckCircle2, X, GripVertical, AlertTriangle, Star, Layers, List,
  Save, ArrowUp, ArrowDown,
} from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import type { AuditTemplate, AuditType } from '@/types';

// ─── Constantes ───────────────────────────────────────────────────────────────
const FONT = 'IBM Plex Sans, sans-serif';
const TYPE_LABEL: Record<AuditType, string> = { FIVE_S: '5S', PROCESS: 'Procesos' };
const TYPE_COLOR: Record<AuditType, string> = { FIVE_S: '#8e44ad', PROCESS: '#2980b9' };

// ─── Tipos locales del editor ─────────────────────────────────────────────────
interface DraftItem {
  _key: string;
  description: string;
  weight: number;
}

interface DraftSection {
  _key: string;
  name: string;
  isBehavior: boolean;
  weight: number;
  items: DraftItem[];
}

interface DraftTemplate {
  id?: string;
  name: string;
  type: AuditType;
  isDefault: boolean;
  sections: DraftSection[];
}

function newItem(): DraftItem {
  return { _key: `item-${Date.now()}-${Math.random()}`, description: '', weight: 1 };
}

function newSection(): DraftSection {
  return {
    _key: `sec-${Date.now()}-${Math.random()}`,
    name: '',
    isBehavior: false,
    weight: 1,
    items: [newItem()],
  };
}

function templateToDraft(t: AuditTemplate): DraftTemplate {
  return {
    id: t.id,
    name: t.name,
    type: t.type,
    isDefault: t.isDefault,
    sections: t.sections.map(s => ({
      _key: s.id,
      name: s.name,
      isBehavior: s.isBehavior,
      weight: s.weight,
      items: s.items.map(i => ({
        _key: i.id,
        description: i.description,
        weight: i.weight,
      })),
    })),
  };
}

function emptyDraft(): DraftTemplate {
  return { name: '', type: 'FIVE_S', isDefault: false, sections: [newSection()] };
}

// ─── Componente: badge de tipo ────────────────────────────────────────────────
function TypeBadge({ type }: { type: AuditType }) {
  const color = TYPE_COLOR[type];
  return (
    <span style={{
      background: `${color}18`, color, fontWeight: 600, fontSize: 11,
      padding: '2px 8px', borderRadius: 12, fontFamily: FONT,
    }}>
      {TYPE_LABEL[type]}
    </span>
  );
}

// ─── Componente: badge de peso ────────────────────────────────────────────────
function WeightBadge({ weight, base = false }: { weight: number; base?: boolean }) {
  if (weight === 1 && !base) return null;
  const color = weight >= 3 ? '#e74c3c' : weight >= 2 ? '#e67e22' : '#27ae60';
  return (
    <span style={{
      background: `${color}15`, color, fontWeight: 700, fontSize: 11,
      padding: '1px 6px', borderRadius: 8, fontFamily: FONT, whiteSpace: 'nowrap',
    }}>
      ×{weight}
    </span>
  );
}

// ─── Componente: modal de vista previa ────────────────────────────────────────
function PreviewModal({ template, onClose }: { template: AuditTemplate; onClose: () => void }) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set([template.sections[0]?.id]));

  const totalItems = template.sections.reduce((s, sec) => s + sec.items.length, 0);
  const totalWeight = template.sections.reduce((total, sec) =>
    total + sec.items.reduce((st, item) => st + sec.weight * item.weight, 0), 0);

  const toggle = (id: string) =>
    setOpenSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 580, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.22)' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <TypeBadge type={template.type} />
              {template.isDefault && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#f39c1215', color: '#f39c12', fontWeight: 600, fontSize: 11, padding: '1px 7px', borderRadius: 10, fontFamily: FONT }}>
                  <Star size={10} fill="#f39c12" /> Predeterminada
                </span>
              )}
            </div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{template.name}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888', fontFamily: FONT }}>
              {template.sections.length} secciones · {totalItems} ítems · Peso total: {totalWeight.toFixed(1)}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 4, flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        {/* Sections accordion */}
        <div style={{ overflowY: 'auto', padding: '12px 18px', flex: 1 }}>
          {template.sections.map(section => {
            const isOpen = openSections.has(section.id);
            const sectionScore = section.items.reduce((s, i) => s + section.weight * i.weight, 0);
            return (
              <div key={section.id} style={{ marginBottom: 8, border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
                <button
                  onClick={() => toggle(section.id)}
                  style={{ width: '100%', padding: '10px 14px', background: isOpen ? '#f8f8f8' : '#fafafa', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, textAlign: 'left' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, color: '#1a1a1a' }}>{section.name}</span>
                    {section.isBehavior && (
                      <span style={{ background: '#9b59b615', color: '#9b59b6', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, fontFamily: FONT }}>Factor Humano</span>
                    )}
                    <WeightBadge weight={section.weight} />
                    <span style={{ fontSize: 11, color: '#aaa', fontFamily: FONT, marginLeft: 'auto' }}>
                      {section.items.length} ítems · {sectionScore.toFixed(1)} pts
                    </span>
                  </div>
                  {isOpen ? <ChevronUp size={14} style={{ color: '#888', flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: '#888', flexShrink: 0 }} />}
                </button>
                {isOpen && (
                  <div style={{ padding: '4px 0 8px' }}>
                    {section.items.map((item, idx) => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 14px', borderTop: idx > 0 ? '1px solid #f5f5f5' : undefined }}>
                        <span style={{ fontSize: 11, color: '#bbb', fontFamily: FONT, minWidth: 20, textAlign: 'right', marginTop: 1 }}>{idx + 1}.</span>
                        <span style={{ flex: 1, fontSize: 13, color: '#444', fontFamily: FONT, lineHeight: 1.4 }}>{item.description}</span>
                        <WeightBadge weight={item.weight} base />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente: editor de ítem ───────────────────────────────────────────────
function ItemEditor({
  item, index, total, sectionKey,
  onChange, onDelete, onMove,
}: {
  item: DraftItem; index: number; total: number; sectionKey: string;
  onChange: (key: string, field: keyof DraftItem, val: string | number) => void;
  onDelete: (sectionKey: string, key: string) => void;
  onMove: (sectionKey: string, key: string, dir: 'up' | 'down') => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
      <span style={{ fontSize: 11, color: '#ccc', fontFamily: FONT, minWidth: 18, textAlign: 'right', marginTop: 10 }}>{index + 1}</span>
      <GripVertical size={14} style={{ color: '#ddd', marginTop: 10, flexShrink: 0 }} />
      <textarea
        value={item.description}
        onChange={e => onChange(item._key, 'description', e.target.value)}
        placeholder="Descripción del ítem / pregunta de auditoría…"
        rows={2}
        style={{ flex: 1, padding: '7px 10px', border: '1px solid #e8e8e8', borderRadius: 7, fontSize: 12, fontFamily: FONT, resize: 'vertical', outline: 'none', lineHeight: 1.4 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
        <label style={{ fontSize: 10, color: '#aaa', fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '.3px' }}>Peso</label>
        <input
          type="number" min={0.1} max={10} step={0.5}
          value={item.weight}
          onChange={e => onChange(item._key, 'weight', parseFloat(e.target.value) || 1)}
          style={{ width: 52, padding: '5px 6px', border: '1px solid #e8e8e8', borderRadius: 6, fontSize: 12, fontFamily: FONT, textAlign: 'center', outline: 'none' }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
        <button onClick={() => onMove(sectionKey, item._key, 'up')} disabled={index === 0}
          style={{ padding: 4, background: 'none', border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? .3 : 1, color: '#888' }}>
          <ArrowUp size={12} />
        </button>
        <button onClick={() => onDelete(sectionKey, item._key)} disabled={total <= 1}
          style={{ padding: 4, background: 'none', border: 'none', cursor: total <= 1 ? 'not-allowed' : 'pointer', opacity: total <= 1 ? .3 : 1, color: '#e74c3c' }}>
          <Trash2 size={12} />
        </button>
        <button onClick={() => onMove(sectionKey, item._key, 'down')} disabled={index === total - 1}
          style={{ padding: 4, background: 'none', border: 'none', cursor: index === total - 1 ? 'not-allowed' : 'pointer', opacity: index === total - 1 ? .3 : 1, color: '#888' }}>
          <ArrowDown size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Componente: editor de sección ───────────────────────────────────────────
function SectionEditor({
  section, index, total,
  onChangeSection, onDeleteSection, onMoveSection,
  onAddItem, onChangeItem, onDeleteItem, onMoveItem,
}: {
  section: DraftSection; index: number; total: number;
  onChangeSection: (key: string, field: keyof DraftSection, val: string | number | boolean) => void;
  onDeleteSection: (key: string) => void;
  onMoveSection: (key: string, dir: 'up' | 'down') => void;
  onAddItem: (sectionKey: string) => void;
  onChangeItem: (sectionKey: string, itemKey: string, field: keyof DraftItem, val: string | number) => void;
  onDeleteItem: (sectionKey: string, itemKey: string) => void;
  onMoveItem: (sectionKey: string, itemKey: string, dir: 'up' | 'down') => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
      {/* Section header */}
      <div style={{ background: '#f9f9f9', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <GripVertical size={14} style={{ color: '#ccc', flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: '#bbb', fontFamily: FONT, minWidth: 24 }}>§{index + 1}</span>

        <input
          value={section.name}
          onChange={e => onChangeSection(section._key, 'name', e.target.value)}
          placeholder="Nombre de la sección"
          style={{ flex: 1, padding: '6px 10px', border: '1px solid #e0e0e0', borderRadius: 7, fontSize: 13, fontFamily: FONT, fontWeight: 600, outline: 'none', background: '#fff' }}
        />

        {/* isBehavior toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0 }}>
          <div
            onClick={() => onChangeSection(section._key, 'isBehavior', !section.isBehavior)}
            style={{
              width: 32, height: 18, borderRadius: 9, background: section.isBehavior ? '#9b59b6' : '#e0e0e0',
              position: 'relative', transition: 'background .2s', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <div style={{
              width: 14, height: 14, borderRadius: '50%', background: '#fff',
              position: 'absolute', top: 2, left: section.isBehavior ? 16 : 2, transition: 'left .2s',
              boxShadow: '0 1px 3px rgba(0,0,0,.2)',
            }} />
          </div>
          <span style={{ fontSize: 11, color: section.isBehavior ? '#9b59b6' : '#aaa', fontFamily: FONT, whiteSpace: 'nowrap' }}>F. Humano</span>
        </label>

        {/* Weight */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#aaa', fontFamily: FONT }}>Peso</span>
          <input
            type="number" min={0.1} max={10} step={0.5}
            value={section.weight}
            onChange={e => onChangeSection(section._key, 'weight', parseFloat(e.target.value) || 1)}
            style={{ width: 52, padding: '4px 6px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 12, fontFamily: FONT, textAlign: 'center', outline: 'none' }}
          />
        </div>

        {/* Section actions */}
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button onClick={() => onMoveSection(section._key, 'up')} disabled={index === 0}
            style={{ padding: 5, background: 'none', border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? .3 : 1, color: '#666' }}>
            <ArrowUp size={13} />
          </button>
          <button onClick={() => onMoveSection(section._key, 'down')} disabled={index === total - 1}
            style={{ padding: 5, background: 'none', border: 'none', cursor: index === total - 1 ? 'not-allowed' : 'pointer', opacity: index === total - 1 ? .3 : 1, color: '#666' }}>
            <ArrowDown size={13} />
          </button>
          <button onClick={() => onDeleteSection(section._key)} disabled={total <= 1}
            style={{ padding: 5, background: 'none', border: 'none', cursor: total <= 1 ? 'not-allowed' : 'pointer', opacity: total <= 1 ? .3 : 1, color: '#e74c3c' }}>
            <Trash2 size={13} />
          </button>
          <button onClick={() => setCollapsed(c => !c)}
            style={{ padding: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {/* Items */}
      {!collapsed && (
        <div style={{ padding: '4px 14px 10px' }}>
          {section.items.map((item, ii) => (
            <ItemEditor
              key={item._key}
              item={item} index={ii} total={section.items.length} sectionKey={section._key}
              onChange={onChangeItem} onDelete={onDeleteItem} onMove={onMoveItem}
            />
          ))}
          <button
            onClick={() => onAddItem(section._key)}
            style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'none', border: '1px dashed #ccc', borderRadius: 7, cursor: 'pointer', color: '#888', fontSize: 12, fontFamily: FONT }}
          >
            <Plus size={12} /> Agregar ítem
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Componente: drawer editor de plantilla ───────────────────────────────────
function TemplateEditor({
  draft, onSave, onClose, saving,
}: {
  draft: DraftTemplate;
  onSave: (d: DraftTemplate) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<DraftTemplate>(draft);

  const setField = (field: keyof DraftTemplate, val: unknown) =>
    setForm(f => ({ ...f, [field]: val }));

  // Section operations
  const addSection = () => setForm(f => ({ ...f, sections: [...f.sections, newSection()] }));

  const changeSection = (key: string, field: keyof DraftSection, val: string | number | boolean) =>
    setForm(f => ({ ...f, sections: f.sections.map(s => s._key === key ? { ...s, [field]: val } : s) }));

  const deleteSection = (key: string) =>
    setForm(f => ({ ...f, sections: f.sections.filter(s => s._key !== key) }));

  const moveSection = (key: string, dir: 'up' | 'down') => {
    setForm(f => {
      const arr = [...f.sections];
      const idx = arr.findIndex(s => s._key === key);
      if (idx < 0) return f;
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= arr.length) return f;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...f, sections: arr };
    });
  };

  // Item operations
  const addItem = (sectionKey: string) =>
    setForm(f => ({
      ...f, sections: f.sections.map(s =>
        s._key === sectionKey ? { ...s, items: [...s.items, newItem()] } : s
      ),
    }));

  const changeItem = (sectionKey: string, itemKey: string, field: keyof DraftItem, val: string | number) =>
    setForm(f => ({
      ...f, sections: f.sections.map(s =>
        s._key === sectionKey
          ? { ...s, items: s.items.map(i => i._key === itemKey ? { ...i, [field]: val } : i) }
          : s
      ),
    }));

  const deleteItem = (sectionKey: string, itemKey: string) =>
    setForm(f => ({
      ...f, sections: f.sections.map(s =>
        s._key === sectionKey ? { ...s, items: s.items.filter(i => i._key !== itemKey) } : s
      ),
    }));

  const moveItem = (sectionKey: string, itemKey: string, dir: 'up' | 'down') =>
    setForm(f => ({
      ...f, sections: f.sections.map(s => {
        if (s._key !== sectionKey) return s;
        const arr = [...s.items];
        const idx = arr.findIndex(i => i._key === itemKey);
        if (idx < 0) return s;
        const target = dir === 'up' ? idx - 1 : idx + 1;
        if (target < 0 || target >= arr.length) return s;
        [arr[idx], arr[target]] = [arr[target], arr[idx]];
        return { ...s, items: arr };
      }),
    }));

  const totalItems = form.sections.reduce((t, s) => t + s.items.length, 0);
  const isValid = form.name.trim().length >= 2 &&
    form.sections.length >= 1 &&
    form.sections.every(s => s.name.trim().length >= 1 && s.items.length >= 1 && s.items.every(i => i.description.trim().length >= 1));

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 8,
    fontSize: 14, fontFamily: FONT, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase',
    letterSpacing: '.5px', fontFamily: FONT, display: 'block', marginBottom: 5,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 150, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,.15)' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#2980b915', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={16} style={{ color: '#2980b9' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, fontFamily: FONT }}>
                {form.id ? 'Editar Plantilla' : 'Nueva Plantilla'}
              </h2>
              <p style={{ margin: 0, fontSize: 11, color: '#888', fontFamily: FONT }}>
                {form.sections.length} secciones · {totalItems} ítems
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>

          {/* Basic fields */}
          <div style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Nombre de la plantilla</label>
              <input style={inputStyle} value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Ej. Auditoría 5S Estándar — Producción" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Tipo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['FIVE_S', 'PROCESS'] as AuditType[]).map(t => (
                    <label key={t} style={{ flex: 1, cursor: 'pointer' }}>
                      <input type="radio" name="type" value={t} checked={form.type === t} onChange={() => setField('type', t)} style={{ display: 'none' }} />
                      <div style={{
                        padding: '8px 12px', border: `2px solid ${form.type === t ? TYPE_COLOR[t] : '#e0e0e0'}`,
                        borderRadius: 8, textAlign: 'center', fontSize: 13, fontWeight: 600,
                        color: form.type === t ? TYPE_COLOR[t] : '#888', fontFamily: FONT,
                        background: form.type === t ? `${TYPE_COLOR[t]}10` : '#fff',
                        transition: 'all .15s',
                      }}>
                        {TYPE_LABEL[t]}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <div
                    onClick={() => setField('isDefault', !form.isDefault)}
                    style={{
                      width: 40, height: 22, borderRadius: 11, background: form.isDefault ? '#f39c12' : '#ddd',
                      position: 'relative', cursor: 'pointer', transition: 'background .2s',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 2, left: form.isDefault ? 20 : 2, transition: 'left .2s',
                      boxShadow: '0 1px 4px rgba(0,0,0,.25)',
                    }} />
                  </div>
                  <span style={{ fontSize: 13, fontFamily: FONT, color: form.isDefault ? '#f39c12' : '#888', fontWeight: form.isDefault ? 600 : 400 }}>
                    Plantilla predeterminada
                  </span>
                  {form.isDefault && <Star size={13} fill="#f39c12" style={{ color: '#f39c12' }} />}
                </label>
                <p style={{ margin: '4px 0 0 50px', fontSize: 11, color: '#bbb', fontFamily: FONT }}>
                  Se usará automáticamente al crear auditorías de este tipo
                </p>
              </div>
            </div>
          </div>

          {/* Section builder */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, fontFamily: FONT, color: '#1a1a1a' }}>Secciones y preguntas</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa', fontFamily: FONT }}>
                El peso de sección multiplica al peso de cada ítem. Ítems sin marcar (N/A) no cuentan para el puntaje.
              </p>
            </div>
          </div>

          {form.sections.map((section, si) => (
            <SectionEditor
              key={section._key}
              section={section} index={si} total={form.sections.length}
              onChangeSection={changeSection}
              onDeleteSection={deleteSection}
              onMoveSection={moveSection}
              onAddItem={addItem}
              onChangeItem={changeItem}
              onDeleteItem={deleteItem}
              onMoveItem={moveItem}
            />
          ))}

          <button
            onClick={addSection}
            style={{ width: '100%', padding: '10px', background: 'none', border: '2px dashed #d0d0d0', borderRadius: 10, cursor: 'pointer', color: '#888', fontSize: 13, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20 }}
          >
            <Plus size={14} /> Agregar sección
          </button>

          {/* Weight info box */}
          <div style={{ background: '#2980b908', border: '1px solid #2980b922', borderRadius: 8, padding: '10px 14px' }}>
            <p style={{ margin: 0, fontSize: 12, color: '#2980b9', fontFamily: FONT, lineHeight: 1.5 }}>
              <strong>¿Cómo funciona el peso?</strong> El puntaje final se calcula como:<br />
              Puntos obtenidos (ítems PASA) ÷ Puntos posibles × 100%<br />
              Peso efectivo = Peso de sección × Peso de ítem. Los ítems N/A se excluyen.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid #eee', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!isValid || saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: isValid && !saving ? '#2980b9' : '#bbb', color: '#fff', border: 'none', borderRadius: 8, cursor: isValid && !saving ? 'pointer' : 'not-allowed', fontFamily: FONT, fontSize: 13, fontWeight: 600 }}
          >
            <Save size={14} /> {saving ? 'Guardando…' : 'Guardar Plantilla'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente: tarjeta de plantilla ────────────────────────────────────────
function TemplateCard({
  template, canEdit, onPreview, onEdit, onDuplicate, onDelete,
}: {
  template: AuditTemplate;
  canEdit: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const totalItems = template.sections.reduce((s, sec) => s + sec.items.length, 0);
  const totalWeight = template.sections.reduce((total, sec) =>
    total + sec.items.reduce((st, item) => st + sec.weight * item.weight, 0), 0);
  const hasCustomWeights = template.sections.some(s => s.weight !== 1 || s.items.some(i => i.weight !== 1));
  const auditCount = template._count?.audits ?? 0;
  const typeColor = TYPE_COLOR[template.type];

  return (
    <div style={{
      background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
      transition: 'box-shadow .15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.04)')}
    >
      {/* Color stripe */}
      <div style={{ height: 4, background: typeColor }} />

      <div style={{ padding: '14px 16px', flex: 1 }}>
        {/* Badges */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <TypeBadge type={template.type} />
          {template.isDefault && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#f39c1215', color: '#f39c12', fontWeight: 600, fontSize: 11, padding: '2px 7px', borderRadius: 10, fontFamily: FONT }}>
              <Star size={10} fill="#f39c12" /> Predeterminada
            </span>
          )}
          {hasCustomWeights && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#e74c3c10', color: '#e74c3c', fontWeight: 600, fontSize: 11, padding: '2px 7px', borderRadius: 10, fontFamily: FONT }}>
              Ponderada
            </span>
          )}
        </div>

        {/* Name */}
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, fontFamily: FONT, color: '#1a1a1a', lineHeight: 1.3 }}>
          {template.name}
        </h3>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#666', fontFamily: FONT }}>
            <Layers size={12} style={{ color: '#aaa' }} /> {template.sections.length} secciones
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#666', fontFamily: FONT }}>
            <List size={12} style={{ color: '#aaa' }} /> {totalItems} ítems
          </span>
          {hasCustomWeights && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#666', fontFamily: FONT }}>
              <Star size={12} style={{ color: '#aaa' }} /> {totalWeight.toFixed(1)} pts totales
            </span>
          )}
        </div>
        {auditCount > 0 && (
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#aaa', fontFamily: FONT }}>
            {auditCount} auditoría{auditCount > 1 ? 's' : ''} usada{auditCount > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ borderTop: '1px solid #f0f0f0', padding: '10px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={onPreview} style={{ flex: 1, minWidth: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px 8px', background: '#f5f5f5', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontFamily: FONT, color: '#444' }}>
          <Eye size={13} /> Vista Previa
        </button>
        {canEdit && (
          <>
            <button onClick={onEdit} style={{ flex: 1, minWidth: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px 8px', background: '#2980b910', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontFamily: FONT, color: '#2980b9' }}>
              <Edit3 size={13} /> Editar
            </button>
            <button onClick={onDuplicate} style={{ flex: 1, minWidth: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px 8px', background: '#27ae6010', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontFamily: FONT, color: '#27ae60' }}>
              <Copy size={13} /> Duplicar
            </button>
            <button onClick={onDelete} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px 8px', background: auditCount > 0 ? '#f5f5f5' : '#e74c3c10', border: 'none', borderRadius: 7, cursor: auditCount > 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: FONT, color: auditCount > 0 ? '#ccc' : '#e74c3c' }}
              title={auditCount > 0 ? `No se puede eliminar: ${auditCount} auditoría${auditCount > 1 ? 's' : ''} vinculada${auditCount > 1 ? 's' : ''}` : 'Eliminar plantilla'}
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Componente: modal confirmación de borrado ─────────────────────────────────
function DeleteConfirmModal({
  template, onConfirm, onClose, deleting,
}: {
  template: AuditTemplate;
  onConfirm: () => void;
  onClose: () => void;
  deleting: boolean;
}) {
  const auditCount = template._count?.audits ?? 0;
  const blocked = auditCount > 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '20px 22px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e74c3c18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {blocked ? <AlertTriangle size={18} style={{ color: '#e67e22' }} /> : <Trash2 size={18} style={{ color: '#e74c3c' }} />}
          </div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, fontFamily: FONT }}>
            {blocked ? 'No se puede eliminar' : 'Eliminar plantilla'}
          </h2>
        </div>
        <div style={{ padding: '18px 22px' }}>
          {blocked ? (
            <>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#444', fontFamily: FONT, lineHeight: 1.5 }}>
                La plantilla <strong>"{template.name}"</strong> tiene <strong>{auditCount} auditoría{auditCount > 1 ? 's' : ''} vinculada{auditCount > 1 ? 's' : ''}</strong> en el historial.
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#666', fontFamily: FONT, lineHeight: 1.5 }}>
                Por integridad de datos, no es posible eliminar plantillas con auditorías existentes. Puedes desactivarla marcando una nueva plantilla predeterminada.
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: '#444', fontFamily: FONT, lineHeight: 1.5 }}>
              ¿Estás seguro de que quieres eliminar la plantilla <strong>"{template.name}"</strong>? Esta acción no se puede deshacer.
            </p>
          )}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #eee', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>
            {blocked ? 'Entendido' : 'Cancelar'}
          </button>
          {!blocked && (
            <button onClick={onConfirm} disabled={deleting}
              style={{ padding: '8px 18px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 8, cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600, opacity: deleting ? .7 : 1 }}>
              {deleting ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AuditTemplatesPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const [templates, setTemplates] = useState<AuditTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | AuditType>('ALL');
  const [previewTemplate, setPreviewTemplate] = useState<AuditTemplate | null>(null);
  const [editDraft, setEditDraft] = useState<DraftTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuditTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canEdit = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<AuditTemplate[]>('/audits/templates');
      setTemplates(data);
    } catch {
      push('Error al cargar plantillas', 'error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const filtered = filterType === 'ALL' ? templates : templates.filter(t => t.type === filterType);

  const fiveS = templates.filter(t => t.type === 'FIVE_S');
  const process = templates.filter(t => t.type === 'PROCESS');

  // ── Save (create or update) ───────────────────────────────────────────────
  const handleSave = async (draft: DraftTemplate) => {
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        type: draft.type,
        isDefault: draft.isDefault,
        sections: draft.sections.map(s => ({
          name: s.name.trim(),
          isBehavior: s.isBehavior,
          weight: s.weight,
          items: s.items.map(i => ({
            description: i.description.trim(),
            weight: i.weight,
          })),
        })),
      };

      if (draft.id) {
        await api.put(`/audits/templates/${draft.id}`, payload);
        push('Plantilla actualizada', 'success');
      } else {
        await api.post('/audits/templates', payload);
        push('Plantilla creada', 'success');
      }
      setEditDraft(null);
      loadTemplates();
    } catch (err: any) {
      push(err?.response?.data?.error || 'Error al guardar plantilla', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Duplicate ─────────────────────────────────────────────────────────────
  const handleDuplicate = async (template: AuditTemplate) => {
    try {
      const { data } = await api.post<AuditTemplate>(`/audits/templates/${template.id}/duplicate`);
      push(`Plantilla duplicada como "${data.name}"`, 'success');
      loadTemplates();
      // Open editor for the new copy
      setEditDraft(templateToDraft(data));
    } catch {
      push('Error al duplicar plantilla', 'error');
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/audits/templates/${deleteTarget.id}`);
      push('Plantilla eliminada', 'success');
      setDeleteTarget(null);
      loadTemplates();
    } catch (err: any) {
      push(err?.response?.data?.error || 'Error al eliminar plantilla', 'error');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ padding: '24px', fontFamily: FONT, maxWidth: 1200 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: '#2980b915', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={19} style={{ color: '#2980b9' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Plantillas de Auditoría</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Gestión de checklists · Ponderación · Versiones</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Summary chips */}
          {[
            { label: '5S', count: fiveS.length, color: TYPE_COLOR['FIVE_S'] },
            { label: 'Procesos', count: process.length, color: TYPE_COLOR['PROCESS'] },
          ].map(({ label, count, color }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, background: `${color}12`, color, fontWeight: 600, fontSize: 12, padding: '5px 10px', borderRadius: 20, fontFamily: FONT }}>
              <FileText size={12} /> {count} {label}
            </span>
          ))}
          {canEdit && (
            <button
              onClick={() => setEditDraft(emptyDraft())}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#2980b9', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600 }}
            >
              <Plus size={14} /> Nueva Plantilla
            </button>
          )}
        </div>
      </div>

      {/* ── Type filter tabs ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f5f5f5', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[
          { id: 'ALL' as const, label: `Todas (${templates.length})` },
          { id: 'FIVE_S' as const, label: `5S (${fiveS.length})` },
          { id: 'PROCESS' as const, label: `Procesos (${process.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            style={{
              padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontFamily: FONT, fontSize: 13, fontWeight: 600, transition: 'all .15s',
              background: filterType === tab.id ? '#fff' : 'transparent',
              color: filterType === tab.id ? '#1a1a1a' : '#888',
              boxShadow: filterType === tab.id ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Template grid ──────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#bbb', fontFamily: FONT }}>Cargando plantillas…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <FileText size={40} style={{ color: '#ddd', marginBottom: 14 }} />
          <p style={{ margin: 0, fontSize: 15, color: '#bbb', fontFamily: FONT }}>No hay plantillas {filterType !== 'ALL' ? `de tipo ${TYPE_LABEL[filterType as AuditType]}` : ''}</p>
          {canEdit && (
            <button
              onClick={() => setEditDraft(emptyDraft())}
              style={{ marginTop: 14, padding: '9px 18px', background: '#2980b9', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}
            >
              Crear primera plantilla
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              canEdit={canEdit}
              onPreview={() => setPreviewTemplate(template)}
              onEdit={() => setEditDraft(templateToDraft(template))}
              onDuplicate={() => handleDuplicate(template)}
              onDelete={() => setDeleteTarget(template)}
            />
          ))}
        </div>
      )}

      {/* ── Modals / Overlays ───────────────────────────────────────────── */}
      {previewTemplate && (
        <PreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
      )}

      {editDraft && (
        <TemplateEditor
          draft={editDraft}
          onSave={handleSave}
          onClose={() => setEditDraft(null)}
          saving={saving}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          template={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
