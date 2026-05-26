/**
 * OEERecordsPage — Lista paginada de registros OEE con filtros y acciones.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { oeeApi, OEERecord } from '@/services/api';
import { api } from '@/services/api';
import CreateOEEModal from '@/components/oee/CreateOEEModal';
import CreateDowntimeModal from '@/components/oee/CreateDowntimeModal';
import { useToast } from '@/hooks/useToast';

interface Asset { id: string; code: string; name: string }

const SHIFT_LABEL: Record<string, string> = {
  MORNING: '🌅 Mañana', AFTERNOON: '☀️ Tarde', NIGHT: '🌙 Noche',
};
const today = () => new Date().toISOString().split('T')[0];
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().split('T')[0];

const semCol = (v: number | null, good: number, warn: number) =>
  !v ? '#aaa' : v >= good ? '#27ae60' : v >= warn ? '#e67e22' : '#c0392b';

function OEEBadge({ value, good, warn }: { value: number | null; good: number; warn: number }) {
  const color = semCol(value, good, warn);
  return (
    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 700, color }}>
      {value !== null ? `${value}%` : '—'}
    </span>
  );
}

export default function OEERecordsPage() {
  const { push } = useToast();
  const [records,  setRecords]  = useState<OEERecord[]>([]);
  const [assets,   setAssets]   = useState<Asset[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const LIMIT = 15;

  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate,   setEndDate]   = useState(today());
  const [assetId,   setAssetId]   = useState('');
  const [shift,     setShift]     = useState('');

  const [createOEE, setCreateOEE] = useState(false);
  const [dtRecord,  setDtRecord]  = useState<OEERecord | null>(null);

  // Cargar activos una sola vez
  useEffect(() => {
    api.get<Asset[]>('/assets').then(r => setAssets(Array.isArray(r.data) ? r.data : [])).catch(console.error);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await oeeApi.getRecords({
        assetId: assetId || undefined,
        shift:   shift   || undefined,
        startDate, endDate,
        page, limit: LIMIT,
      });
      setRecords(res.data);
      setTotal(res.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [assetId, shift, startDate, endDate, page]);

  useEffect(() => { load(); }, [load]);

  // Reset página al cambiar filtros
  useEffect(() => { setPage(1); }, [assetId, shift, startDate, endDate]);

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este registro OEE y todos sus eventos de paro?')) return;
    try {
      await oeeApi.deleteRecord(id);
      push('Registro eliminado', 'success');
      load();
    } catch {
      push('No se pudo eliminar', 'error');
    }
  }

  const totalPages = Math.ceil(total / LIMIT);
  const inputStyle: React.CSSProperties = { fontSize: 12, border: '1px solid var(--sz-border)', borderRadius: 5, padding: '5px 8px', background: 'var(--sz-card)', color: 'var(--sz-text)' };

  return (
    <div style={{ minHeight: '100%', background: 'var(--sz-bg)', paddingBottom: 32 }}>

      {/* Topbar */}
      <div style={{ background: 'var(--sz-topbar)', borderBottom: '1px solid var(--sz-border)', padding: '0 24px', minHeight: 48, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sz-text)', flex: 1 }}>Registros OEE</span>

        {/* Filtros */}
        <select style={inputStyle} value={assetId} onChange={e => setAssetId(e.target.value)}>
          <option value="">Todos los activos</option>
          {assets.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </select>
        <select style={inputStyle} value={shift} onChange={e => setShift(e.target.value)}>
          <option value="">Todos los turnos</option>
          <option value="MORNING">Mañana</option>
          <option value="AFTERNOON">Tarde</option>
          <option value="NIGHT">Noche</option>
        </select>
        <input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
        <span style={{ color: 'var(--sz-muted)', fontSize: 12 }}>→</span>
        <input type="date" value={endDate} min={startDate} max={today()} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
        <button onClick={load} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid var(--sz-border)', background: 'var(--sz-card)', cursor: 'pointer', color: 'var(--sz-muted)', display: 'flex' }}>
          <RefreshCw size={13} />
        </button>
        <button onClick={() => setCreateOEE(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: 'none', background: '#2980b9', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={13} /> Registrar OEE
        </button>
      </div>

      <div style={{ padding: '16px 24px' }}>
        <Card>
          <CardHeader
            title={`${total} registros encontrados`}
            subtitle={`Página ${page} de ${totalPages || 1}`}
          />

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>Cargando…</div>
          ) : records.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--sz-muted)', fontSize: 13 }}>
              No se encontraron registros con los filtros aplicados.<br />
              <button onClick={() => setCreateOEE(true)} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2980b9', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
                Registrar primer turno
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--sz-border)', background: 'var(--sz-bg)' }}>
                    {['Fecha', 'Turno', 'Activo', 'Área', 'Disponib.', 'Rendim.', 'Calidad', 'OEE', 'Paros', 'Acciones'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--sz-muted)', textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--sz-border)', background: i % 2 === 0 ? 'var(--sz-card)' : 'var(--sz-bg)' }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--sz-text)', whiteSpace: 'nowrap' }}>
                        {new Date(r.date).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'var(--sz-bg)', border: '1px solid var(--sz-border)', color: 'var(--sz-text)' }}>
                          {SHIFT_LABEL[r.shift] ?? r.shift}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--sz-text)', whiteSpace: 'nowrap' }}>
                        {r.asset.code}
                        <div style={{ fontSize: 10, color: 'var(--sz-muted)', fontWeight: 400 }}>{r.asset.name}</div>
                      </td>
                      <td style={{ padding: '9px 12px', color: 'var(--sz-muted)', whiteSpace: 'nowrap' }}>{r.asset.area}</td>
                      <td style={{ padding: '9px 12px' }}><OEEBadge value={r.availability} good={90} warn={75} /></td>
                      <td style={{ padding: '9px 12px' }}><OEEBadge value={r.performance}  good={95} warn={80} /></td>
                      <td style={{ padding: '9px 12px' }}><OEEBadge value={r.quality}      good={99} warn={95} /></td>
                      <td style={{ padding: '9px 12px' }}>
                        <OEEBadge value={r.oee} good={85} warn={65} />
                        {r.oee !== null && (
                          <div style={{ marginTop: 3, height: 3, width: 50, background: '#f0f0f0', borderRadius: 2 }}>
                            <div style={{ width: `${r.oee}%`, height: '100%', background: semCol(r.oee, 85, 65), borderRadius: 2 }} />
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                        {(r._count?.downtimeEvents ?? 0) > 0 ? (
                          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: '#fef2f2', color: '#c0392b', fontWeight: 700 }}>
                            {r._count!.downtimeEvents}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--sz-muted)' }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => setDtRecord(r)}
                            title="Registrar paro"
                            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #e67e22', background: 'transparent', color: '#e67e22', cursor: 'pointer', fontSize: 11 }}>
                            + Paro
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            title="Eliminar"
                            style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #fca5a5', background: 'transparent', color: '#c0392b', cursor: 'pointer', fontSize: 11 }}>
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--sz-border)' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid var(--sz-border)', background: 'var(--sz-card)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? .5 : 1, display: 'flex', color: 'var(--sz-text)' }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 12, color: 'var(--sz-muted)' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid var(--sz-border)', background: 'var(--sz-card)', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? .5 : 1, display: 'flex', color: 'var(--sz-text)' }}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </Card>
      </div>

      <CreateOEEModal open={createOEE} onClose={() => setCreateOEE(false)} onSuccess={load} />
      {dtRecord && (
        <CreateDowntimeModal
          open={!!dtRecord}
          onClose={() => setDtRecord(null)}
          onSuccess={() => { setDtRecord(null); load(); }}
          oeeRecordId={dtRecord.id}
          assetId={dtRecord.assetId}
        />
      )}
    </div>
  );
}
