import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck, Plus, AlertTriangle, CheckCircle2, Clock,
  ChevronRight, X, Search, Filter, ChevronDown, ChevronUp,
  Eye, Star, Layers, List, FileDown,
} from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { exportAuditsExcel } from '@/lib/excelExport';
import type { Audit, AuditDashboard, AuditType, AuditStatus, AuditTemplate, User } from '@/types';

// ─── Constantes visuales ──────────────────────────────────────────────────────
const TYPE_LABEL: Record<AuditType, string>    = { FIVE_S: '5S', PROCESS: 'Procesos' };
const TYPE_COLOR: Record<AuditType, string>    = { FIVE_S: '#8e44ad', PROCESS: '#2980b9' };
const STATUS_LABEL: Record<AuditStatus, string> = {
  DRAFT: 'Borrador', IN_PROGRESS: 'En Curso', COMPLETED: 'Completada', CLOSED: 'Cerrada',
};
const STATUS_COLOR: Record<AuditStatus, string> = {
  DRAFT: '#95a5a6', IN_PROGRESS: '#e67e22', COMPLETED: '#27ae60', CLOSED: '#2c3e50',
};

const FONT = 'IBM Plex Sans, sans-serif';

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span style={{ color: '#bbb', fontSize: 12 }}>—</span>;
  const color = score >= 80 ? '#27ae60' : score >= 60 ? '#e67e22' : '#e74c3c';
  return (
    <span style={{
      background: `${color}18`, color, fontWeight: 700, fontSize: 13,
      padding: '2px 8px', borderRadius: 12, fontFamily: FONT,
    }}>
      {score}%
    </span>
  );
}

function StatusBadge({ status }: { status: AuditStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span style={{
      background: `${color}18`, color, fontWeight: 600, fontSize: 11,
      padding: '2px 8px', borderRadius: 12, fontFamily: FONT, whiteSpace: 'nowrap',
    }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

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

// ─── Mini vista previa de plantilla (dentro del modal) ───────────────────────
function TemplateMiniPreview({ template, onClose }: { template: AuditTemplate; onClose: () => void }) {
  const [openIdx, setOpenIdx] = useState<number>(0);
  const totalItems = template.sections.reduce((s, sec) => s + sec.items.length, 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, fontFamily: FONT }}>{template.name}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888', fontFamily: FONT }}>{template.sections.length} secciones · {totalItems} ítems</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><X size={16} /></button>
        </div>
        <div style={{ overflowY: 'auto', padding: '10px 16px', flex: 1 }}>
          {template.sections.map((section, si) => (
            <div key={section.id} style={{ marginBottom: 6, border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenIdx(openIdx === si ? -1 : si)}
                style={{ width: '100%', padding: '9px 12px', background: openIdx === si ? '#f5f5f5' : '#fafafa', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, color: '#333' }}>{section.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {section.weight !== 1 && <span style={{ fontSize: 11, background: '#e67e2215', color: '#e67e22', padding: '1px 5px', borderRadius: 6, fontFamily: FONT }}>×{section.weight}</span>}
                  <span style={{ fontSize: 11, color: '#bbb', fontFamily: FONT }}>{section.items.length} ítems</span>
                  {openIdx === si ? <ChevronUp size={12} style={{ color: '#888' }} /> : <ChevronDown size={12} style={{ color: '#888' }} />}
                </div>
              </button>
              {openIdx === si && (
                <div style={{ padding: '4px 0 6px' }}>
                  {section.items.map((item, ii) => (
                    <div key={item.id} style={{ display: 'flex', gap: 8, padding: '5px 12px', borderTop: ii > 0 ? '1px solid #f8f8f8' : undefined }}>
                      <span style={{ fontSize: 11, color: '#ccc', minWidth: 18, textAlign: 'right', marginTop: 1 }}>{ii + 1}.</span>
                      <span style={{ flex: 1, fontSize: 12, color: '#555', fontFamily: FONT, lineHeight: 1.4 }}>{item.description}</span>
                      {item.weight !== 1 && <span style={{ fontSize: 10, background: '#f5f5f5', color: '#888', padding: '1px 5px', borderRadius: 5, fontFamily: FONT, alignSelf: 'flex-start', marginTop: 1 }}>×{item.weight}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 7, cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Crear Auditoría ────────────────────────────────────────────────────
interface CreateModalProps {
  onClose: () => void;
  onCreated: (audit: Audit) => void;
}

function CreateAuditModal({ onClose, onCreated }: CreateModalProps) {
  const { push } = useToast();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [templates, setTemplates] = useState<AuditTemplate[]>([]);
  const [previewTemplate, setPreviewTemplate] = useState<AuditTemplate | null>(null);
  const [form, setForm] = useState({
    title: '', type: 'FIVE_S' as AuditType, area: '',
    scheduledAt: new Date().toISOString().slice(0, 16),
    auditorId: '', templateId: '', notes: '',
  });

  useEffect(() => {
    Promise.all([
      api.get<User[]>('/users'),
      api.get<{ id: string; name: string }[]>('/areas'),
      api.get<AuditTemplate[]>('/audits/templates'),
    ]).then(([u, a, t]) => {
      setUsers(u.data);
      setAreas(a.data);
      setTemplates(t.data);
      // Auto-select default template for initial type
      const def = t.data.find(tmpl => tmpl.type === 'FIVE_S' && tmpl.isDefault);
      if (def) setForm(f => ({ ...f, templateId: def.id }));
    }).catch(() => {});
  }, []);

  // Auto-select default when type changes
  const handleTypeChange = (newType: AuditType) => {
    const def = templates.find(t => t.type === newType && t.isDefault);
    setForm(f => ({ ...f, type: newType, templateId: def?.id || '' }));
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const typeTemplates = templates.filter(t => t.type === form.type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.area || !form.auditorId) { push('Completa todos los campos requeridos', 'error'); return; }
    if (!form.templateId && typeTemplates.length > 0) { push('Selecciona una plantilla', 'error'); return; }
    setLoading(true);
    try {
      const { data } = await api.post<Audit>('/audits', {
        ...form, scheduledAt: new Date(form.scheduledAt).toISOString(),
      });
      push('Auditoría creada', 'success');
      onCreated(data);
    } catch {
      push('Error al crear auditoría', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8,
    fontSize: 13, fontFamily: FONT, outline: 'none', background: '#fff',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase',
    letterSpacing: '.5px', fontFamily: FONT, display: 'block', marginBottom: 5,
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 540, maxHeight: '92vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: FONT }}>Nueva Auditoría</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Título</label>
              <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ej. Auditoría 5S Línea 1 — Semana 18" required />
            </div>

            {/* Tipo */}
            <div>
              <label style={labelStyle}>Tipo de auditoría</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {([['FIVE_S', '5S', '#8e44ad'], ['PROCESS', 'Procesos', '#2980b9']] as [AuditType, string, string][]).map(([val, label, color]) => (
                  <label key={val} style={{ flex: 1, cursor: 'pointer' }}>
                    <input type="radio" checked={form.type === val} onChange={() => handleTypeChange(val)} style={{ display: 'none' }} />
                    <div style={{
                      padding: '9px 12px', border: `2px solid ${form.type === val ? color : '#e0e0e0'}`,
                      borderRadius: 8, textAlign: 'center', fontSize: 13, fontWeight: 600,
                      color: form.type === val ? color : '#aaa', fontFamily: FONT,
                      background: form.type === val ? `${color}10` : '#fff', transition: 'all .15s',
                    }}>
                      {label}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Template picker */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Plantilla</label>
                <span style={{ fontSize: 11, color: '#aaa', fontFamily: FONT }}>{typeTemplates.length} disponible{typeTemplates.length !== 1 ? 's' : ''}</span>
              </div>
              {typeTemplates.length === 0 ? (
                <div style={{ padding: '12px 14px', background: '#fff8e1', border: '1px solid #ffd54f', borderRadius: 8, fontSize: 12, color: '#e65100', fontFamily: FONT }}>
                  No hay plantillas para este tipo. Créalas en la sección Plantillas.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {typeTemplates.map(t => {
                    const selected = form.templateId === t.id;
                    const totalItems = t.sections.reduce((s, sec) => s + sec.items.length, 0);
                    const hasWeights = t.sections.some(s => s.weight !== 1 || s.items.some(i => i.weight !== 1));
                    return (
                      <div
                        key={t.id}
                        onClick={() => set('templateId', t.id)}
                        style={{
                          border: `2px solid ${selected ? '#27ae60' : '#e8e8e8'}`,
                          borderRadius: 9, padding: '10px 12px', cursor: 'pointer',
                          background: selected ? '#27ae6008' : '#fff',
                          display: 'flex', alignItems: 'center', gap: 10,
                          transition: 'all .12s',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, color: '#1a1a1a' }}>{t.name}</span>
                            {t.isDefault && <Star size={11} fill="#f39c12" style={{ color: '#f39c12', flexShrink: 0 }} />}
                            {hasWeights && <span style={{ fontSize: 10, background: '#e74c3c10', color: '#e74c3c', padding: '1px 5px', borderRadius: 5, fontFamily: FONT }}>Ponderada</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#aaa', fontFamily: FONT }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Layers size={10} /> {t.sections.length} secc.</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><List size={10} /> {totalItems} ítems</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setPreviewTemplate(t); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '5px 8px', background: '#f5f5f5', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: FONT, color: '#666' }}
                          >
                            <Eye size={11} /> Previa
                          </button>
                          {selected && <CheckCircle2 size={16} style={{ color: '#27ae60' }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Área</label>
                <select style={inputStyle} value={form.area} onChange={e => set('area', e.target.value)} required>
                  <option value="">Seleccionar…</option>
                  {areas.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Auditor</label>
                <select style={inputStyle} value={form.auditorId} onChange={e => set('auditorId', e.target.value)} required>
                  <option value="">Seleccionar…</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Fecha programada</label>
              <input style={inputStyle} type="datetime-local" value={form.scheduledAt} onChange={e => set('scheduledAt', e.target.value)} required />
            </div>

            <div>
              <label style={labelStyle}>Notas (opcional)</label>
              <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Contexto, alcance u observaciones previas…" />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={onClose} style={{ padding: '9px 18px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>
                Cancelar
              </button>
              <button type="submit" disabled={loading} style={{ padding: '9px 20px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600, opacity: loading ? .7 : 1 }}>
                {loading ? 'Creando…' : 'Crear Auditoría'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {previewTemplate && (
        <TemplateMiniPreview template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
      )}
    </>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AuditsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dashboard, setDashboard]   = useState<AuditDashboard | null>(null);
  const [audits, setAudits]         = useState<Audit[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch]         = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (filterArea) params.set('area', filterArea);
      if (filterStatus) params.set('status', filterStatus);
      const [dashRes, auditRes] = await Promise.all([
        api.get<AuditDashboard>('/audits/dashboard'),
        api.get<Audit[]>(`/audits?${params}`),
      ]);
      setDashboard(dashRes.data);
      setAudits(auditRes.data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [filterType, filterArea, filterStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  const filtered = audits.filter(a =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.code.toLowerCase().includes(search.toLowerCase()) ||
    a.area.toLowerCase().includes(search.toLowerCase())
  );

  const areas = [...new Set(audits.map(a => a.area))].sort();

  return (
    <div style={{ padding: '24px', fontFamily: FONT, maxWidth: 1200 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#27ae6018', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardCheck size={18} style={{ color: '#27ae60' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Auditorías</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>5S y Procesos · Factor humano · CAPA</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => exportAuditsExcel(filtered, `Auditorias${filterType ? '_' + filterType : ''}${filterArea ? '_' + filterArea : ''}`)}
            title="Exportar vista actual a Excel"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 600, color: '#555' }}
          >
            <FileDown size={14} /> Excel
          </button>
          {canCreate && (
            <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>
              <Plus size={15} /> Nueva Auditoría
            </button>
          )}
        </div>
      </div>

      {/* ── Dashboard KPIs ─────────────────────────────────────────────── */}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total', value: dashboard.totalAudits, color: '#2980b9', icon: ClipboardCheck },
            { label: 'En Curso', value: dashboard.byStatus['IN_PROGRESS'] || 0, color: '#e67e22', icon: Clock },
            { label: 'Completadas', value: dashboard.byStatus['COMPLETED'] || 0, color: '#27ae60', icon: CheckCircle2 },
            { label: 'CAPAs Abiertas', value: dashboard.capaStats.open, color: '#e74c3c', icon: AlertTriangle },
            { label: 'CAPAs Vencidas', value: dashboard.capaStats.overdue, color: '#c0392b', icon: AlertTriangle },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Cumplimiento por Área ───────────────────────────────────────── */}
      {dashboard && dashboard.byArea.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px' }}>Cumplimiento por Área</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dashboard.byArea.map(({ area, avgScore, count }) => (
              <div key={area}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{area} <span style={{ color: '#bbb', fontWeight: 400 }}>({count})</span></span>
                  <ScoreBadge score={avgScore} />
                </div>
                <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3, transition: 'width .4s',
                    width: avgScore !== null ? `${avgScore}%` : '0%',
                    background: avgScore !== null ? (avgScore >= 80 ? '#27ae60' : avgScore >= 60 ? '#e67e22' : '#e74c3c') : '#eee',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#bbb' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar auditoría…"
            style={{ paddingLeft: 30, padding: '7px 10px 7px 30px', border: '1px solid #eee', borderRadius: 7, fontSize: 13, fontFamily: FONT, outline: 'none', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <Filter size={13} style={{ color: '#bbb', flexShrink: 0 }} />
        {[
          { label: 'Tipo', val: filterType, set: setFilterType, opts: [['', 'Todos'], ['FIVE_S', '5S'], ['PROCESS', 'Procesos']] },
          { label: 'Estado', val: filterStatus, set: setFilterStatus, opts: [['', 'Todos'], ['DRAFT', 'Borrador'], ['IN_PROGRESS', 'En Curso'], ['COMPLETED', 'Completada'], ['CLOSED', 'Cerrada']] },
          { label: 'Área', val: filterArea, set: setFilterArea, opts: [['', 'Todas'], ...areas.map(a => [a, a])] },
        ].map(({ val, set: setF, opts }) => (
          <select key={opts[0][1]} value={val} onChange={e => setF(e.target.value)} style={{ padding: '7px 10px', border: '1px solid #eee', borderRadius: 7, fontSize: 12, fontFamily: FONT, outline: 'none', background: '#fff' }}>
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
      </div>

      {/* ── Tabla de Auditorías ─────────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#bbb', fontFamily: FONT }}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <ClipboardCheck size={36} style={{ color: '#ddd', marginBottom: 12 }} />
            <p style={{ margin: 0, color: '#bbb', fontFamily: FONT }}>No hay auditorías que coincidan</p>
            {canCreate && <button onClick={() => setShowModal(true)} style={{ marginTop: 12, padding: '8px 16px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>Crear primera auditoría</button>}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '1px solid #eee' }}>
                {['Código', 'Título', 'Tipo', 'Área', 'Auditor', 'Fecha', 'CAPAs', 'Puntaje', 'Estado', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.4px', fontFamily: FONT, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr
                  key={a.id}
                  onClick={() => navigate(`/audits/${a.id}`)}
                  style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: i % 2 === 0 ? '#fff' : '#fafafa', transition: 'background .12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0f9f4')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa')}
                >
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#888', fontFamily: FONT }}>{a.code}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 500, color: '#1a1a1a', fontFamily: FONT, maxWidth: 220 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</span>
                  </td>
                  <td style={{ padding: '11px 14px' }}><TypeBadge type={a.type} /></td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: '#444', fontFamily: FONT }}>{a.area}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#666', fontFamily: FONT }}>{a.auditor.name}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#666', fontFamily: FONT, whiteSpace: 'nowrap' }}>{new Date(a.scheduledAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                    {(a._count?.capaActions ?? 0) > 0 && (
                      <span style={{ background: '#e74c3c18', color: '#e74c3c', fontWeight: 700, fontSize: 12, padding: '2px 8px', borderRadius: 12 }}>
                        {a._count?.capaActions}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '11px 14px' }}><ScoreBadge score={a.score} /></td>
                  <td style={{ padding: '11px 14px' }}><StatusBadge status={a.status} /></td>
                  <td style={{ padding: '11px 14px' }}><ChevronRight size={14} style={{ color: '#bbb' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <CreateAuditModal
          onClose={() => setShowModal(false)}
          onCreated={(a) => { setShowModal(false); navigate(`/audits/${a.id}`); }}
        />
      )}
    </div>
  );
}
