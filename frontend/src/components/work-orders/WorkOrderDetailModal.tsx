import { useEffect, useState, FormEvent } from 'react';
import Modal from '@/components/ui/Modal';
import SignaturePad from '@/components/ui/SignaturePad';
import PhotoUpload from '@/components/ui/PhotoUpload';
import ChecklistPanel from '@/components/ui/ChecklistPanel';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { WorkOrder } from '@/types';
import { Send, Clock, User, Tag, PenLine, Camera, CheckSquare, Trash2, Package, Plus, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface Photo { id: string; filename: string; originalName: string; phase: string; createdAt: string }
interface Comment { id: string; content: string; createdAt: string; author: { id: string; name: string } }
interface ChecklistItem { id: string; order: number; description: string; required: boolean; checked: boolean; checkedAt?: string; notes?: string; checkedBy?: { id: string; name: string } }
interface Checklist { id: string; completedAt?: string; items: ChecklistItem[] }
interface Signature { id: string; data: string; signerName: string; signedAt: string; signedBy: { name: string } }

interface DetailedOrder extends WorkOrder {
  comments: Comment[];
  photos: Photo[];
  signature?: Signature;
  checklist?: Checklist;
}

interface Props { workOrderId: string | null; onClose: () => void; onUpdated: () => void }

type Tab = 'detail' | 'photos' | 'checklist' | 'signature' | 'parts';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En Progreso', ON_HOLD: 'En Espera', COMPLETED: 'Completada', CANCELLED: 'Cancelada',
};

export default function WorkOrderDetailModal({ workOrderId, onClose, onUpdated }: Props) {
  const { user } = useAuth();
  const { push } = useToast();
  const [order, setOrder] = useState<DetailedOrder | null>(null);
  const [comment, setComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerNameInput, setSignerNameInput] = useState(false);
  const [tab, setTab] = useState<Tab>('detail');
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);

  // ── Solicitud de partes ───────────────────────────────────────────
  const [partsItems, setPartsItems]   = useState([{ name: '', quantity: 1, notes: '' }]);
  const [partsNotes, setPartsNotes]   = useState('');
  const [partsEmail, setPartsEmail]   = useState('');
  const [partsSaving, setPartsSaving]       = useState(false);
  const [partsError, setPartsError]         = useState('');
  const [partsSent, setPartsSent]           = useState(false);
  const [partsPreviewUrl, setPartsPreviewUrl] = useState<string | null>(null);

  const addPartItem = () => setPartsItems((p) => [...p, { name: '', quantity: 1, notes: '' }]);
  const removePartItem = (i: number) => setPartsItems((p) => p.filter((_, idx) => idx !== i));
  const setPartField = (i: number, field: string, value: string | number) =>
    setPartsItems((p) => p.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));

  const handlePartsRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!partsEmail.trim()) { setPartsError('Ingresa el email del destinatario'); return; }
    if (partsItems.some((p) => !p.name.trim())) { setPartsError('Todos los ítems deben tener nombre'); return; }
    if (!workOrderId) return;
    setPartsSaving(true); setPartsError('');
    try {
      const res = await api.post('/part-requests', {
        workOrderId,
        parts: partsItems.map((p) => ({ name: p.name.trim(), quantity: Number(p.quantity), notes: p.notes || undefined })),
        additionalNotes: partsNotes.trim() || undefined,
        recipientEmail: partsEmail.trim(),
      });
      const data = res.data as { previewUrl?: string };
      push('Solicitud enviada por correo', 'success');
      setPartsSent(true);
      setPartsPreviewUrl(data.previewUrl ?? null);
      setPartsItems([{ name: '', quantity: 1, notes: '' }]);
      setPartsNotes(''); setPartsEmail('');
      fetchOrder(workOrderId);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setPartsError(typeof msg === 'string' ? msg : 'Error al enviar el correo');
    } finally { setPartsSaving(false); }
  };

  const fetchOrder = async (id: string) => {
    const { data } = await api.get<DetailedOrder>(`/work-orders/${id}`);
    setOrder(data);
  };

  useEffect(() => {
    if (workOrderId) {
      fetchOrder(workOrderId);
      api.get<{ id: string; name: string }[]>('/checklists/templates').then(({ data }) => setTemplates(data));
    } else setOrder(null);
  }, [workOrderId]);

  const handleComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !workOrderId) return;
    setSendingComment(true);
    try {
      await api.post(`/work-orders/${workOrderId}/comments`, { content: comment });
      setComment('');
      fetchOrder(workOrderId);
    } catch { push('Error al enviar comentario', 'error'); }
    finally { setSendingComment(false); }
  };

  const updateStatus = async (status: string) => {
    if (!workOrderId) return;
    await api.patch(`/work-orders/${workOrderId}/status`, { status });
    push('Estado actualizado', 'success');
    onUpdated();
    fetchOrder(workOrderId);
  };

  const handleSign = async (data: string) => {
    if (!workOrderId || !signerName.trim()) return;
    try {
      await api.post(`/signatures/${workOrderId}`, { data, signerName });
      push('Orden firmada y completada', 'success');
      setSignerNameInput(false);
      onUpdated();
      fetchOrder(workOrderId);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      push(msg ?? 'Error al firmar', 'error');
    }
  };

  const handlePhotoDeleted = async (photoId: string) => {
    await api.delete(`/photos/${photoId}`);
    push('Foto eliminada', 'success');
    if (workOrderId) fetchOrder(workOrderId);
  };

  const canAct = user?.role !== 'EXECUTIVE';
  const isDone = order?.status === 'COMPLETED' || order?.status === 'CANCELLED';
  const canDelete = user?.role === 'ADMIN';

  const handleDelete = async () => {
    if (!workOrderId) return;
    if (!confirm('¿Eliminar permanentemente esta orden de trabajo? Esta acción no se puede deshacer.')) return;
    try {
      await api.delete(`/work-orders/${workOrderId}`);
      push('Orden eliminada', 'success');
      onUpdated();
      onClose();
    } catch { push('Error al eliminar la orden', 'error'); }
  };

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'detail', label: 'Detalle', icon: Tag },
    { id: 'photos', label: `Fotos (${(order?.photos ?? []).length})`, icon: Camera },
    { id: 'checklist', label: 'Checklist', icon: CheckSquare },
    { id: 'signature', label: 'Firma', icon: PenLine },
    { id: 'parts', label: 'Partes', icon: Package },
  ];

  return (
    <Modal open={!!workOrderId} onClose={onClose} title="Orden de Trabajo" size="lg">
      {!order ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-base leading-tight">{order.title}</h3>
              <div className="flex items-center gap-2 shrink-0">
                {canDelete && (
                  <button
                    onClick={handleDelete}
                    title="Eliminar orden"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '3px 10px', fontSize: 12, borderRadius: 2,
                      background: '#fde8e6', color: '#c0392b',
                      border: '1px solid #c0392b', cursor: 'pointer',
                      fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: 600,
                    }}
                  >
                    <Trash2 size={12} /> Eliminar
                  </button>
                )}
                <span className={cn('text-xs px-2 py-0.5 rounded-full', {
                  'bg-amber-100 text-amber-800': order.status === 'PENDING',
                  'bg-blue-100 text-blue-800': order.status === 'IN_PROGRESS',
                  'bg-purple-100 text-purple-800': order.status === 'ON_HOLD',
                  'bg-emerald-100 text-emerald-800': order.status === 'COMPLETED',
                  'bg-gray-100 text-gray-600': order.status === 'CANCELLED',
                })}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{order.description}</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
                  tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                <Icon size={12} />{label}
              </button>
            ))}
          </div>

          {/* Tab: Detail */}
          {tab === 'detail' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { icon: Tag, label: 'Activo', value: `${order.asset.name} (${order.asset.code})` },
                  { icon: User, label: 'Asignado', value: order.assignedTo?.name ?? '—' },
                  { icon: Clock, label: 'Programado', value: order.scheduledAt ? new Date(order.scheduledAt).toLocaleDateString('es', { dateStyle: 'medium' }) : '—' },
                  { icon: Clock, label: 'Horas est.', value: order.estimatedHours ? `${order.estimatedHours}h` : '—' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-2 text-muted-foreground">
                    <Icon size={13} className="shrink-0" />
                    <span className="font-medium text-foreground">{label}:</span> {value}
                  </div>
                ))}
              </div>

              {/* Status actions */}
              {canAct && !isDone && (
                <div className="flex gap-2 flex-wrap">
                  {order.status === 'PENDING' && (
                    <button onClick={() => updateStatus('IN_PROGRESS')} className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium">Iniciar</button>
                  )}
                  {order.status === 'IN_PROGRESS' && <>
                    <button onClick={() => updateStatus('ON_HOLD')} className="text-xs px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-medium">Pausar</button>
                    <button onClick={() => setTab('signature')} className="text-xs px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 font-medium">Completar con firma</button>
                  </>}
                  {order.status === 'ON_HOLD' && (
                    <button onClick={() => updateStatus('IN_PROGRESS')} className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium">Reanudar</button>
                  )}
                </div>
              )}

              {/* Comments */}
              <div className="border-t pt-3 space-y-2">
                <h4 className="font-medium text-sm">Comentarios ({order.comments.length})</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {order.comments.length === 0 ? <p className="text-xs text-muted-foreground">Sin comentarios.</p>
                    : order.comments.map((c) => (
                      <div key={c.id} className="bg-muted/40 rounded-lg px-3 py-2">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs font-medium">{c.author.name}</span>
                          <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-sm">{c.content}</p>
                      </div>
                    ))}
                </div>
                {canAct && (
                  <form onSubmit={handleComment} className="flex gap-2">
                    <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Agregar comentario..."
                      className="flex-1 px-3 py-2 border rounded-lg text-sm bg-background focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    <button type="submit" disabled={sendingComment || !comment.trim()}
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40">
                      <Send size={15} />
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Tab: Photos */}
          {tab === 'photos' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PhotoUpload
                workOrderId={order.id} phase="BEFORE"
                photos={(order.photos ?? []).filter((p) => p.phase === 'BEFORE')}
                onUploaded={() => fetchOrder(order.id)}
                onDeleted={handlePhotoDeleted}
                readOnly={!canAct}
              />
              <PhotoUpload
                workOrderId={order.id} phase="AFTER"
                photos={(order.photos ?? []).filter((p) => p.phase === 'AFTER')}
                onUploaded={() => fetchOrder(order.id)}
                onDeleted={handlePhotoDeleted}
                readOnly={!canAct}
              />
            </div>
          )}

          {/* Tab: Checklist */}
          {tab === 'checklist' && (
            <ChecklistPanel
              workOrderId={order.id}
              checklist={order.checklist ?? null}
              onUpdated={() => fetchOrder(order.id)}
              templates={templates}
            />
          )}

          {/* Tab: Partes */}
          {tab === 'parts' && (
            <div className="space-y-4">
              {partsSent && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 space-y-1">
                  <div className="flex items-center gap-2 text-sm text-emerald-700">
                    ✓ Solicitud enviada correctamente.
                    <button className="ml-auto text-xs underline" onClick={() => { setPartsSent(false); setPartsPreviewUrl(null); }}>Nueva solicitud</button>
                  </div>
                  {partsPreviewUrl && (
                    <div className="text-xs text-emerald-600">
                      📧 Modo prueba (Ethereal) —{' '}
                      <a href={partsPreviewUrl} target="_blank" rel="noreferrer" className="underline font-medium">
                        Ver correo enviado aquí
                      </a>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handlePartsRequest} className="space-y-4">
                {/* Lista de partes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Partes requeridas *</label>
                    <button type="button" onClick={addPartItem}
                      className="flex items-center gap-1 text-xs px-2 py-1 border border-violet-500 text-violet-600 rounded hover:bg-violet-50">
                      <Plus size={11} /> Agregar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {partsItems.map((item, i) => (
                      <div key={i} className="grid grid-cols-[1fr_60px_1fr_auto] gap-2 items-center">
                        <input
                          value={item.name}
                          onChange={(e) => setPartField(i, 'name', e.target.value)}
                          placeholder="Nombre de la parte"
                          required
                          className="px-2 py-1.5 text-xs border rounded bg-muted/30 focus:outline-none focus:ring-1 focus:ring-violet-400"
                        />
                        <input
                          type="number" min="1"
                          value={item.quantity}
                          onChange={(e) => setPartField(i, 'quantity', Number(e.target.value))}
                          className="px-2 py-1.5 text-xs border rounded bg-muted/30 text-center focus:outline-none focus:ring-1 focus:ring-violet-400"
                        />
                        <input
                          value={item.notes}
                          onChange={(e) => setPartField(i, 'notes', e.target.value)}
                          placeholder="Notas (opcional)"
                          className="px-2 py-1.5 text-xs border rounded bg-muted/30 focus:outline-none focus:ring-1 focus:ring-violet-400"
                        />
                        {partsItems.length > 1 && (
                          <button type="button" onClick={() => removePartItem(i)}
                            className="text-red-400 hover:text-red-600">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Columnas: Nombre · Cantidad · Notas</p>
                </div>

                {/* Notas adicionales */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground block mb-1">Notas adicionales</label>
                  <textarea
                    value={partsNotes}
                    onChange={(e) => setPartsNotes(e.target.value)}
                    placeholder="Urgencia, contexto de la falla, alternativas aceptadas..."
                    rows={2}
                    className="w-full px-3 py-2 text-xs border rounded-lg bg-muted/30 resize-none focus:outline-none focus:ring-1 focus:ring-violet-400"
                  />
                </div>

                {/* Email destinatario */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground block mb-1">Email destinatario *</label>
                  <input
                    type="email"
                    value={partsEmail}
                    onChange={(e) => setPartsEmail(e.target.value)}
                    placeholder="almacen@empresa.com"
                    required
                    className="w-full px-3 py-2 text-xs border rounded-lg bg-muted/30 focus:outline-none focus:ring-1 focus:ring-violet-400"
                  />
                </div>

                {/* Error */}
                {partsError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{partsError}</p>
                )}

                {/* Botón enviar */}
                <button
                  type="submit"
                  disabled={partsSaving}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                >
                  <Send size={14} />
                  {partsSaving ? 'Enviando...' : 'Enviar Solicitud por Correo'}
                </button>
              </form>
            </div>
          )}

          {/* Tab: Signature */}
          {tab === 'signature' && (
            <div className="space-y-3">
              {order.signature ? (
                <div className="space-y-2">
                  <p className="text-sm text-emerald-700 font-medium">✓ Orden firmada por {order.signature.signerName}</p>
                  <p className="text-xs text-muted-foreground">{new Date(order.signature.signedAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  <div className="border rounded-xl overflow-hidden bg-white p-2">
                    <img src={order.signature.data} alt="Firma" className="max-h-32 mx-auto" />
                  </div>
                </div>
              ) : canAct ? (
                <div className="space-y-3">
                  {!signerNameInput ? (
                    <button onClick={() => setSignerNameInput(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">
                      <PenLine size={15} /> Agregar firma de conformidad
                    </button>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Nombre del firmante <span className="text-red-500">*</span></label>
                        <input value={signerName} onChange={(e) => setSignerName(e.target.value)}
                          placeholder="Nombre completo del responsable"
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                      </div>
                      {signerName.trim().length >= 2 && (
                        <SignaturePad onSave={handleSign} onCancel={() => { setSignerNameInput(false); setSignerName(''); }} />
                      )}
                    </>
                  )}
                </div>
              ) : <p className="text-sm text-muted-foreground">Sin firma registrada.</p>}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
