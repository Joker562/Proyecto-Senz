import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, Clock, XCircle, ChevronRight,
  FileDown, Filter, RefreshCw, User,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { api } from '@/services/api';
import { exportCapasExcel } from '@/lib/excelExport';
import type { CapaAction, CapaSeverity, CapaStatus } from '@/types';

const FONT = 'IBM Plex Sans, sans-serif';

// ─── Labels / colores ─────────────────────────────────────────────────────────
const SEV_LABEL: Record<CapaSeverity, string> = {
  CRITICAL: 'Crítico', MAJOR: 'Mayor', MINOR: 'Menor', OBSERVATION: 'Observación',
};
const SEV_COLOR: Record<CapaSeverity, string> = {
  CRITICAL: '#e74c3c', MAJOR: '#e67e22', MINOR: '#f39c12', OBSERVATION: '#95a5a6',
};
const STATUS_LABEL: Record<CapaStatus, string> = {
  OPEN: 'Abierta', IN_PROGRESS: 'En Proceso',
  PENDING_VERIFICATION: 'Pend. Verificación', CLOSED: 'Cerrada',
};
const STATUS_COLOR: Record<CapaStatus, string> = {
  OPEN: '#e74c3c', IN_PROGRESS: '#e67e22',
  PENDING_VERIFICATION: '#3498db', CLOSED: '#27ae60',
};

function fmt(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isOverdue(capa: CapaAction) {
  return capa.status !== 'CLOSED' && new Date(capa.dueDate) < new Date();
}

// ─── Tipos de respuesta del endpoint ─────────────────────────────────────────
interface ByResponsable {
  id: string;
  name: string;
  total: number;
  closed: number;
  overdue: number;
  pct: number;
}

interface GlobalStats {
  total: number;
  open: number;
  inProgress: number;
  pendingVerification: number;
  closed: number;
  overdue: number;
}

interface ReporteCapasResponse {
  globalStats: GlobalStats;
  capas: CapaAction[];
  byResponsable: ByResponsable[];
}

// ─── Componente KPI card ──────────────────────────────────────────────────────
function KpiCard({ label, value, color, icon: Icon, sub }: {
  label: string; value: number; color: string; icon: React.ElementType; sub?: string;
}) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${color}30`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: FONT, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#888', fontFamily: FONT, marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color, fontFamily: FONT, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ReporteCapasPage() {
  const navigate = useNavigate();
  const [data, setData]         = useState<ReporteCapasResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [filterSev, setFilterSev]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [filterUser, setFilterUser] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSev)    params.set('severity', filterSev);
      if (filterStatus) params.set('status',   filterStatus);
      if (filterUser)   params.set('assignedTo', filterUser);
      const { data: r } = await api.get<ReporteCapasResponse>(`/audits/reports/capas?${params}`);
      setData(r);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [filterSev, filterStatus, filterUser]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get<{ id: string; name: string }[]>('/users').then(r => setUsers(r.data)).catch(() => {});
  }, []);

  const selectStyle: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid #e0e0e0', borderRadius: 8,
    fontSize: 12, fontFamily: FONT, background: '#fff', color: '#444', outline: 'none',
  };

  const gs = data?.globalStats;

  // Datos para gráfico de barras de responsable
  const chartData = (data?.byResponsable ?? []).slice(0, 8).map(r => ({
    name: r.name.split(' ')[0],
    fullName: r.name,
    pct: r.pct,
    total: r.total,
    overdue: r.overdue,
  }));

  return (
    <div style={{ fontFamily: FONT, paddingBottom: 60 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e74c3c18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={18} style={{ color: '#e74c3c' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Reporte de CAPAs</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Acciones correctivas y preventivas · Seguimiento global</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => data && exportCapasExcel(data.capas)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#555' }}
          >
            <FileDown size={14} /> Excel
          </button>
          <button
            onClick={load}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 12px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#888' }}
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── KPIs globales ──────────────────────────────────────────────────── */}
      {gs && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          <KpiCard label="Abiertas"              value={gs.open}                color="#e74c3c"  icon={XCircle} />
          <KpiCard label="En Proceso"            value={gs.inProgress}          color="#e67e22"  icon={Clock} />
          <KpiCard label="Pend. Verificación"    value={gs.pendingVerification} color="#3498db"  icon={AlertTriangle} />
          <KpiCard label="Cerradas"              value={gs.closed}              color="#27ae60"  icon={CheckCircle2} />
          <KpiCard label="Vencidas"              value={gs.overdue}             color="#c0392b"  icon={AlertTriangle} sub={gs.overdue > 0 ? '¡Requieren atención!' : ''} />
        </div>
      )}

      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={14} style={{ color: '#aaa' }} />
        <select style={selectStyle} value={filterSev} onChange={e => setFilterSev(e.target.value)}>
          <option value="">Severidad: Todas</option>
          {(['CRITICAL','MAJOR','MINOR','OBSERVATION'] as CapaSeverity[]).map(s => (
            <option key={s} value={s}>{SEV_LABEL[s]}</option>
          ))}
        </select>
        <select style={selectStyle} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Estado: Todos</option>
          {(['OPEN','IN_PROGRESS','PENDING_VERIFICATION','CLOSED'] as CapaStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select style={selectStyle} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
          <option value="">Responsable: Todos</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        {(filterSev || filterStatus || filterUser) && (
          <button
            onClick={() => { setFilterSev(''); setFilterStatus(''); setFilterUser(''); }}
            style={{ padding: '7px 12px', border: '1px solid #e0e0e0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 11, color: '#888' }}
          >
            Limpiar
          </button>
        )}
        {data && <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>{data.capas.length} registros</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

        {/* ── Tabla de CAPAs ────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f9f9f9', borderBottom: '2px solid #eee' }}>
                  {['Código', 'Descripción', 'Severidad', 'Responsable', 'Vencimiento', 'Estado', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#666', fontFamily: FONT, whiteSpace: 'nowrap', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#bbb' }}>Cargando…</td></tr>
                ) : (data?.capas ?? []).length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#bbb' }}>Sin acciones CAPA con los filtros aplicados</td></tr>
                ) : (data?.capas ?? []).map((c, i) => {
                  const overdue = isOverdue(c);
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f5f5f5', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '10px 12px', fontFamily: FONT }}>
                        <span style={{ fontWeight: 600, color: '#444', fontSize: 11 }}>{c.code}</span>
                        <div style={{ fontSize: 10, color: '#bbb', marginTop: 1 }}>{c.type === 'CORRECTIVE' ? 'Correctiva' : 'Preventiva'}</div>
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: 220, fontFamily: FONT }}>
                        <div style={{ color: '#333', lineHeight: 1.4 }}>{c.description}</div>
                        {c.audit && (
                          <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
                            {c.audit.code} · {c.audit.area}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          background: `${SEV_COLOR[c.severity]}18`,
                          color: SEV_COLOR[c.severity],
                          fontWeight: 700, fontSize: 10,
                          padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap',
                          fontFamily: FONT,
                        }}>
                          ● {SEV_LABEL[c.severity]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: FONT }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <User size={11} style={{ color: '#bbb' }} />
                          <span style={{ fontSize: 12, color: '#555' }}>{c.assignedTo?.name ?? '—'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontFamily: FONT }}>
                        <span style={{ color: overdue ? '#e74c3c' : '#555', fontWeight: overdue ? 700 : 400 }}>
                          {fmt(c.dueDate)}
                        </span>
                        {overdue && <div style={{ fontSize: 9, color: '#e74c3c', fontWeight: 700, marginTop: 1 }}>VENCIDA</div>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          background: `${STATUS_COLOR[c.status]}18`,
                          color: STATUS_COLOR[c.status],
                          fontWeight: 600, fontSize: 10,
                          padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
                          fontFamily: FONT,
                        }}>
                          {STATUS_LABEL[c.status]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <button
                          onClick={() => navigate(`/audits/${c.auditId}`)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 4 }}
                          title="Ver auditoría"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Panel lateral ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Gráfico por responsable */}
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#1a1a1a', fontFamily: FONT }}>
              Cumplimiento por Responsable
            </h3>
            {chartData.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#ccc', padding: '20px 0', fontSize: 12 }}>Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={55} tick={{ fontSize: 11, fontFamily: FONT }} />
                  <Tooltip
                    formatter={(val, _name, props) => [`${val}%`, `${props.payload.fullName} (${props.payload.total} CAPAs)`]}
                    contentStyle={{ fontFamily: FONT, fontSize: 12 }}
                  />
                  <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.pct >= 80 ? '#27ae60' : entry.pct >= 50 ? '#e67e22' : '#e74c3c'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Lista de responsables con barra de progreso */}
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#1a1a1a', fontFamily: FONT }}>
              Desglose por Responsable
            </h3>
            {(data?.byResponsable ?? []).length === 0 ? (
              <div style={{ textAlign: 'center', color: '#ccc', padding: '12px 0', fontSize: 12 }}>Sin datos</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(data?.byResponsable ?? []).map(r => (
                  <div key={r.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#333', fontFamily: FONT }}>{r.name}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {r.overdue > 0 && (
                          <span style={{ fontSize: 10, color: '#e74c3c', fontWeight: 700 }}>{r.overdue} vencida{r.overdue > 1 ? 's' : ''}</span>
                        )}
                        <span style={{ fontSize: 11, color: '#888' }}>{r.closed}/{r.total}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: r.pct >= 80 ? '#27ae60' : r.pct >= 50 ? '#e67e22' : '#e74c3c',
                        }}>{r.pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3, transition: 'width .4s',
                        width: `${r.pct}%`,
                        background: r.pct >= 80 ? '#27ae60' : r.pct >= 50 ? '#e67e22' : '#e74c3c',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
