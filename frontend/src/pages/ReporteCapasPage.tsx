import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, Clock, XCircle, ChevronRight,
  Filter, User, Download, RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { api } from '@/services/api';
import { exportCapasExcel } from '@/lib/excelExport';
import type { CapaAction, CapaSeverity, CapaStatus } from '@/types';

const FONT = 'IBM Plex Sans, sans-serif';

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

function isOverdue(dueDate: string, status: CapaStatus) {
  return status !== 'CLOSED' && new Date(dueDate) < new Date();
}

interface GlobalStats {
  total: number; open: number; inProgress: number;
  pendingVerification: number; closed: number; overdue: number;
}
interface ByResponsable {
  id: string; name: string; total: number; closed: number; overdue: number; pct: number;
}

function KpiCard({ label, value, color, icon: Icon, sub }: {
  label: string; value: number; color: string; icon: React.ElementType; sub?: string;
}) {
  return (
    <div style={{ background: 'var(--sz-card)', border: `1px solid ${color}30`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: FONT, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--sz-muted)', fontFamily: FONT, marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color, fontFamily: FONT, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid var(--sz-border)', borderRadius: 8,
  fontSize: 12, fontFamily: FONT, background: 'var(--sz-card)', color: 'var(--sz-text)', outline: 'none',
};

export default function ReporteCapasPage() {
  const navigate = useNavigate();
  const [capas, setCapas]                   = useState<CapaAction[]>([]);
  const [globalStats, setGlobalStats]       = useState<GlobalStats | null>(null);
  const [byResponsable, setByResponsable]   = useState<ByResponsable[]>([]);
  const [loading, setLoading]               = useState(true);
  const [filterSev, setFilterSev]           = useState('');
  const [filterStatus, setFilterStatus]     = useState('');
  const [filterUser, setFilterUser]         = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ globalStats: GlobalStats; capas: CapaAction[]; byResponsable: ByResponsable[] }>('/audits/reports/capas');
      setGlobalStats(data.globalStats);
      setCapas(data.capas);
      setByResponsable(data.byResponsable);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return capas.filter((c) => {
      if (filterSev    && c.severity !== filterSev) return false;
      if (filterStatus && c.status   !== filterStatus) return false;
      if (filterUser   && c.assignedTo?.name !== filterUser) return false;
      return true;
    });
  }, [capas, filterSev, filterStatus, filterUser]);

  const gs = globalStats ?? { total: 0, open: 0, inProgress: 0, pendingVerification: 0, closed: 0, overdue: 0 };

  const uniqueUsers = useMemo(() => [...new Set(byResponsable.map(r => r.name))], [byResponsable]);

  const chartData = byResponsable.slice(0, 8).map((r) => ({
    name: r.name.split(' ')[0],
    fullName: r.name,
    pct: r.pct,
    total: r.total,
    overdue: r.overdue,
  }));

  return (
    <div style={{ fontFamily: FONT, paddingBottom: 60, padding: '24px' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e74c3c18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={18} style={{ color: '#e74c3c' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--sz-text)' }}>Reporte de CAPAs</h1>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--sz-muted)' }}>Acciones correctivas y preventivas · Seguimiento global</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={load}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid var(--sz-border)', borderRadius: 8, background: 'var(--sz-card)', cursor: 'pointer', fontSize: 12, color: 'var(--sz-text)' }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Actualizar
          </button>
          <button
            onClick={() => exportCapasExcel(filtered)}
            disabled={loading || filtered.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid var(--sz-border)', borderRadius: 8, background: 'var(--sz-card)', cursor: 'pointer', fontSize: 12, color: 'var(--sz-text)' }}
          >
            <Download size={13} />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* ── KPIs globales ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <KpiCard label="Abiertas"              value={gs.open}                color="#e74c3c"  icon={XCircle} />
        <KpiCard label="En Proceso"            value={gs.inProgress}          color="#e67e22"  icon={Clock} />
        <KpiCard label="Pend. Verificación"    value={gs.pendingVerification} color="#3498db"  icon={AlertTriangle} />
        <KpiCard label="Cerradas"              value={gs.closed}              color="#27ae60"  icon={CheckCircle2} />
        <KpiCard label="Vencidas"              value={gs.overdue}             color="#c0392b"  icon={AlertTriangle} sub={gs.overdue > 0 ? '¡Requieren atención!' : ''} />
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={14} style={{ color: 'var(--sz-muted)' }} />
        <select style={selectStyle} value={filterSev} onChange={(e) => setFilterSev(e.target.value)}>
          <option value="">Severidad: Todas</option>
          {(['CRITICAL','MAJOR','MINOR','OBSERVATION'] as CapaSeverity[]).map((s) => (
            <option key={s} value={s}>{SEV_LABEL[s]}</option>
          ))}
        </select>
        <select style={selectStyle} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Estado: Todos</option>
          {(['OPEN','IN_PROGRESS','PENDING_VERIFICATION','CLOSED'] as CapaStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select style={selectStyle} value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
          <option value="">Responsable: Todos</option>
          {uniqueUsers.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        {(filterSev || filterStatus || filterUser) && (
          <button
            onClick={() => { setFilterSev(''); setFilterStatus(''); setFilterUser(''); }}
            style={{ padding: '7px 12px', border: '1px solid var(--sz-border)', borderRadius: 8, background: 'var(--sz-card)', cursor: 'pointer', fontSize: 11, color: 'var(--sz-muted)' }}
          >
            Limpiar
          </button>
        )}
        <span style={{ fontSize: 11, color: 'var(--sz-muted)', marginLeft: 4 }}>
          {loading ? 'Cargando…' : `${filtered.length} registros`}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

        {/* ── Tabla de CAPAs ────────────────────────────────────────────────── */}
        <div style={{ background: 'var(--sz-card)', border: '1px solid var(--sz-border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--sz-bg)', borderBottom: `2px solid var(--sz-border)` }}>
                  {['Código', 'Descripción', 'Severidad', 'Responsable', 'Vencimiento', 'Estado', ''].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--sz-muted)', fontFamily: FONT, whiteSpace: 'nowrap', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--sz-muted)' }}>Cargando CAPAs…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--sz-muted)' }}>Sin acciones CAPA con los filtros aplicados</td></tr>
                ) : filtered.map((c, i) => {
                  const overdue = isOverdue(c.dueDate, c.status);
                  const sev = c.severity;
                  const st  = c.status;
                  return (
                    <tr key={c.id} style={{ borderBottom: `1px solid var(--sz-border)`, background: i % 2 === 0 ? 'var(--sz-card)' : 'var(--sz-bg)', cursor: 'pointer' }}>
                      <td style={{ padding: '10px 12px', fontFamily: FONT }}>
                        <span style={{ fontWeight: 600, color: 'var(--sz-accent)', fontSize: 11 }}>{c.code}</span>
                        <div style={{ fontSize: 10, color: 'var(--sz-muted)', marginTop: 1 }}>{c.type === 'CORRECTIVE' ? 'Correctiva' : 'Preventiva'}</div>
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: 220, fontFamily: FONT }}>
                        <div style={{ color: 'var(--sz-text)', lineHeight: 1.4 }}>{c.description}</div>
                        <div style={{ fontSize: 10, color: 'var(--sz-muted)', marginTop: 2 }}>{c.audit?.area ?? '—'}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          background: `${SEV_COLOR[sev]}18`, color: SEV_COLOR[sev],
                          fontWeight: 700, fontSize: 10, padding: '2px 7px', borderRadius: 10,
                          whiteSpace: 'nowrap', fontFamily: FONT,
                        }}>
                          ● {SEV_LABEL[sev]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: FONT }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <User size={11} style={{ color: 'var(--sz-muted)' }} />
                          <span style={{ fontSize: 12, color: 'var(--sz-muted)' }}>{c.assignedTo?.name ?? '—'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontFamily: FONT }}>
                        <span style={{ color: overdue ? '#e74c3c' : 'var(--sz-muted)', fontWeight: overdue ? 700 : 400 }}>
                          {new Date(c.dueDate).toLocaleDateString('es-MX')}
                        </span>
                        {overdue && <div style={{ fontSize: 9, color: '#e74c3c', fontWeight: 700, marginTop: 1 }}>VENCIDA</div>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          background: `${STATUS_COLOR[st]}18`, color: STATUS_COLOR[st],
                          fontWeight: 600, fontSize: 10, padding: '2px 8px', borderRadius: 10,
                          whiteSpace: 'nowrap', fontFamily: FONT,
                        }}>
                          {STATUS_LABEL[st]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <button
                          onClick={() => navigate(`/audits/${c.auditId}`)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sz-muted)', padding: 4 }}
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
          <div style={{ background: 'var(--sz-card)', border: '1px solid var(--sz-border)', borderRadius: 12, padding: 16 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--sz-text)', fontFamily: FONT }}>
              Cumplimiento por Responsable
            </h3>
            {chartData.length === 0 ? (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sz-muted)', fontSize: 12 }}>Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
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
          <div style={{ background: 'var(--sz-card)', border: '1px solid var(--sz-border)', borderRadius: 12, padding: 16 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--sz-text)', fontFamily: FONT }}>
              Desglose por Responsable
            </h3>
            {byResponsable.length === 0 ? (
              <div style={{ color: 'var(--sz-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>Sin datos</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {byResponsable.map((r) => (
                  <div key={r.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sz-text)', fontFamily: FONT }}>{r.name}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {r.overdue > 0 && (
                          <span style={{ fontSize: 10, color: '#e74c3c', fontWeight: 700 }}>{r.overdue} vencida{r.overdue > 1 ? 's' : ''}</span>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--sz-muted)' }}>{r.closed}/{r.total}</span>
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
