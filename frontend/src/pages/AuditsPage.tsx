import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LineChartSVG } from '@/components/ui/LineChartSVG';
import { SparkLine } from '@/components/ui/SparkLine';
import { mockAudits, mockCapas, mockAuditTrend, STATUS_MAP } from '@/data/mockData';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import CreateAuditModal from '@/components/audits/CreateAuditModal';
import type { MockAudit } from '@/data/mockData';

const AUDIT_SERIES = [
  { key: 'Corte',    color: '#e67e22' },
  { key: 'Ensamble', color: '#2980b9' },
  { key: 'Pintura',  color: '#27ae60' },
  { key: 'Almacén',  color: '#8b5cf6' },
  { key: 'Calidad',  color: '#c0392b' },
];

function scoreColor(s: number): string {
  if (s >= 90) return '#27ae60';
  if (s >= 70) return '#e67e22';
  return '#c0392b';
}

const TYPE_LABELS: Record<string, string> = {
  FIVE_S: '5S', PROCESS: 'Proceso', SAFETY: 'Seguridad', '5S': '5S',
};

export default function AuditsPage() {
  const navigate = useNavigate();
  const { push } = useToast();
  const [filter, setFilter] = useState<'ALL' | 'CLOSED' | 'SCHEDULED' | 'IN_PROGRESS'>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [audits, setAudits] = useState<MockAudit[]>(mockAudits);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; code: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const total     = audits.length;
  const closed    = audits.filter((a) => a.status === 'CLOSED').length;
  const scheduled = audits.filter((a) => a.status === 'SCHEDULED' || a.status === 'DRAFT').length;
  const openCapas = mockCapas.filter((c) => c.status !== 'CLOSED').length;
  const avgScore  = (() => {
    const scored = audits.filter((a) => a.score !== null);
    return scored.length ? scored.reduce((s, a) => s + a.score!, 0) / scored.length : 0;
  })();

  const areaScores: Record<string, number> = {};
  audits.filter((a) => a.score !== null).forEach((a) => { areaScores[a.area] = a.score!; });

  const kpis = [
    { label: 'Total',          value: total,     color: '#2980b9', spark: [5, 6, 5, 6, 7, total] },
    { label: 'Cerradas',       value: closed,    color: '#27ae60', spark: [3, 4, 4, 5, 4, closed] },
    { label: 'Programadas',    value: scheduled, color: '#e67e22', spark: [1, 2, 1, 1, 2, scheduled] },
    { label: 'CAPAs Abiertas', value: openCapas, color: '#c0392b', spark: [10, 8, 9, 8, 7, openCapas] },
  ];

  const filtered = filter === 'ALL'
    ? audits
    : audits.filter((a) => {
        if (filter === 'SCHEDULED') return a.status === 'SCHEDULED' || a.status === 'DRAFT';
        return a.status === filter;
      });

  const handleCreated = (created: {
    id: string; code: string; title: string; area: string;
    type: string; auditorName: string; scheduledAt: string;
  }) => {
    const newAudit: MockAudit = {
      id:      created.id,
      code:    created.code,
      title:   created.title,
      area:    created.area,
      type:    TYPE_LABELS[created.type] ?? created.type,
      status:  'SCHEDULED',
      score:   null,
      auditor: created.auditorName,
      date:    created.scheduledAt?.slice(0, 10) ?? '',
    };
    setAudits((prev) => [newAudit, ...prev]);
  };

  const confirmDelete = (e: React.MouseEvent, id: string, code: string) => {
    e.stopPropagation();
    setDeleteConfirm({ id, code });
  };

  const handleDelete = async () => {
    if (!deleteConfirm || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/audits/${deleteConfirm.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (msg?.includes('CAPA')) {
        push(msg, 'error');
        setDeleteConfirm(null);
        setDeleting(false);
        return;
      }
    }
    setAudits((prev) => prev.filter((a) => a.id !== deleteConfirm.id));
    push(`Auditoría ${deleteConfirm.code} eliminada`, 'success');
    setDeleteConfirm(null);
    setDeleting(false);
  };

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* Topbar */}
      <div style={{
        background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)',
        padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)' }}>Auditorías</span>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--sz-accent)', color: '#fff',
            border: 'none', borderRadius: 'var(--sz-radius)',
            padding: '7px 14px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
          }}
        >
          <Plus size={14} />
          Nueva Auditoría
        </button>
      </div>

      <div style={{ padding: '16px 24px' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {kpis.map((k) => (
            <Card key={k.label} topAccent={k.color}>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
                </div>
                <SparkLine data={k.spark} color={k.color} width={70} height={28} />
              </div>
            </Card>
          ))}
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16, marginBottom: 16 }}>

          {/* Table */}
          <Card>
            {/* Filter pills */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--sz-border)', display: 'flex', gap: 6 }}>
              {(['ALL', 'CLOSED', 'SCHEDULED', 'IN_PROGRESS'] as const).map((f) => {
                const sm = STATUS_MAP[f];
                const isActive = filter === f;
                return (
                  <button key={f} onClick={() => setFilter(f)} style={{
                    padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 20,
                    border: `1px solid ${isActive && sm ? sm.color : 'var(--sz-border)'}`,
                    background: isActive && sm ? sm.bg : 'transparent',
                    color: isActive && sm ? sm.color : 'var(--sz-muted)',
                    cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
                  }}>
                    {f === 'ALL' ? 'Todas' : STATUS_MAP[f]?.label ?? f}
                  </button>
                );
              })}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    {['Código', 'Título', 'Área', 'Tipo', 'Auditor', 'Estado', 'Puntaje', 'Fecha', ''].map((h) => (
                      <th key={h} style={{
                        padding: '7px 12px', textAlign: 'left', fontWeight: 600,
                        color: 'var(--sz-muted)', fontSize: 11, textTransform: 'uppercase',
                        letterSpacing: '.4px', borderBottom: '1px solid var(--sz-border)', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => {
                    const sm = STATUS_MAP[a.status] ?? STATUS_MAP['SCHEDULED'];
                    return (
                      <tr key={a.id} className="sz-table-row"
                        onClick={() => navigate(`/audits/${a.id}`)}
                        style={{
                          borderBottom: '1px solid var(--sz-border)', cursor: 'pointer',
                          background: i % 2 === 0 ? 'var(--sz-card)' : '#fafafa',
                        }}>
                        <td style={{ padding: '8px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-accent)', fontWeight: 700 }}>{a.code}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--sz-text)', maxWidth: 220 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{a.area}</td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.3px' }}>
                            {TYPE_LABELS[a.type] ?? a.type}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{a.auditor}</td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <Badge label={sm.label} color={sm.color} bg={sm.bg} />
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          {a.score !== null
                            ? <span style={{ fontWeight: 700, fontSize: 13, color: scoreColor(a.score) }}>{a.score}%</span>
                            : <span style={{ color: 'var(--sz-muted)', fontSize: 11 }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{a.date}</td>
                        <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={(e) => confirmDelete(e, a.id, a.code)}
                            title="Eliminar auditoría"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#ccc', padding: '3px 6px', borderRadius: 3,
                              display: 'flex', alignItems: 'center',
                              transition: 'color .15s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#c0392b')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#ccc')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Side: Puntaje por área */}
          <Card>
            <CardHeader title="Puntaje por Área" />
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(areaScores).map(([area, score]) => (
                <div key={area}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--sz-text)' }}>{area}</span>
                    <span style={{ fontWeight: 700, color: scoreColor(score) }}>{score}%</span>
                  </div>
                  <ProgressBar value={score} color={scoreColor(score)} height={7} />
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--sz-border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--sz-muted)' }}>Promedio</span>
                <span style={{ fontWeight: 800, color: scoreColor(avgScore) }}>{Math.round(avgScore)}%</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Trend chart */}
        <Card>
          <CardHeader title="Tendencia de Puntajes" subtitle="Últimos 6 meses por área" />
          <div style={{ padding: '16px 16px 8px' }}>
            <LineChartSVG
              data={mockAuditTrend}
              xKey="month"
              series={AUDIT_SERIES}
              height={160}
              yMin={40}
              yMax={110}
            />
            <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              {AUDIT_SERIES.map((s) => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--sz-muted)' }}>
                  <div style={{ width: 14, height: 2, background: s.color, borderRadius: 1 }} />
                  {s.key}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}
          onClick={() => !deleting && setDeleteConfirm(null)}
        >
          <div style={{
            background: '#fff', borderRadius: 4, padding: '24px 28px', width: 380,
            boxShadow: '0 8px 32px rgba(0,0,0,.2)', fontFamily: 'IBM Plex Sans, sans-serif',
          }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1c', marginBottom: 8 }}>
              Eliminar auditoría
            </div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 20, lineHeight: 1.5 }}>
              ¿Eliminar <strong>{deleteConfirm.code}</strong>? Esta acción no se puede deshacer.
              <br />
              <span style={{ fontSize: 11, color: '#888', marginTop: 6, display: 'block' }}>
                Las auditorías con CAPAs abiertas no pueden eliminarse.
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                style={{
                  padding: '7px 18px', fontSize: 12, background: 'transparent',
                  border: '1px solid #e4e4e4', borderRadius: 2, cursor: 'pointer',
                  fontFamily: 'inherit', color: '#1c1c1c',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '7px 18px', fontSize: 12, fontWeight: 600, borderRadius: 2,
                  background: deleting ? '#ccc' : '#c0392b', color: '#fff',
                  border: 'none', cursor: deleting ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateAuditModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(audit) => { handleCreated(audit); setModalOpen(false); }}
      />
    </div>
  );
}
