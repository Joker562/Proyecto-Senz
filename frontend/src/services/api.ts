import axios from 'axios';

// En desarrollo: Vite proxy resuelve /api → localhost:4000
// En producción: usa la URL de Railway directamente
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1');

const RAILWAY_URL = 'https://proyecto-senz-production.up.railway.app';

const BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : isLocalhost
    ? '/api'
    : `${RAILWAY_URL}/api`;

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Limpiar AMBAS claves: la que usa el interceptor de request y la de zustand persist
      localStorage.removeItem('token');
      localStorage.removeItem('auth-store');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── OEE Types ────────────────────────────────────────────────────────────────

export interface OEERecord {
  id: string;
  date: string;
  shift: 'MORNING' | 'AFTERNOON' | 'NIGHT';
  plannedTime: number;
  breakTime: number;
  totalCount: number;
  goodCount: number;
  idealCycleTime: number;
  availability: number | null;
  performance:  number | null;
  quality:      number | null;
  oee:          number | null;
  notes?: string | null;
  assetId: string;
  asset: { id: string; code: string; name: string; area: string };
  operator?: { id: string; name: string } | null;
  recordedBy?: { id: string; name: string };
  downtimeEvents?: DowntimeEvent[];
  _count?: { downtimeEvents: number };
  createdAt: string;
}

export interface DowntimeEvent {
  id: string;
  startTime: string;
  endTime?:  string | null;
  duration?: number | null;
  category: 'PLANNED' | 'UNPLANNED' | 'SETUP' | 'MINOR_STOP';
  lossType: 'AVAILABILITY' | 'PERFORMANCE' | 'QUALITY';
  reason: string;
  notes?: string | null;
  oeeRecordId: string;
  assetId: string;
  asset?:      { id: string; code: string; name: string };
  reportedBy?: { id: string; name: string };
  oeeRecord?:  { id: string; date: string; shift: string };
  createdAt: string;
}

export interface OEESummary {
  availability: number;
  performance:  number;
  quality:      number;
  oee:          number;
  recordCount:  number;
  totalPlannedHours?: number;
  totalPieces?:       number;
  totalGood?:         number;
  totalDefects?:      number;
  byArea?: Array<{
    area: string; availability: number; performance: number;
    quality: number; oee: number; recordCount: number;
  }>;
}

export interface OEETrendPoint {
  period: string;
  availability: number;
  performance:  number;
  quality:      number;
  oee:          number;
  recordCount:  number;
  totalCount:   number;
  goodCount:    number;
}

export interface Paginated<T> {
  data: T[]; total: number; page: number; totalPages: number;
}

// ─── OEE API ─────────────────────────────────────────────────────────────────

export const oeeApi = {
  // Records CRUD
  getRecords: (params?: {
    assetId?: string; shift?: string; startDate?: string; endDate?: string;
    area?: string; page?: number; limit?: number;
  }) => api.get<Paginated<OEERecord>>('/oee', { params }).then(r => r.data),

  getRecord: (id: string) =>
    api.get<OEERecord>(`/oee/${id}`).then(r => r.data),

  createRecord: (data: {
    date: string; shift: string; plannedTime: number; breakTime?: number;
    totalCount: number; goodCount: number; idealCycleTime: number;
    notes?: string; assetId: string; operatorId?: string;
  }) => api.post<OEERecord>('/oee', data).then(r => r.data),

  updateRecord: (id: string, data: Partial<{
    date: string; shift: string; plannedTime: number; breakTime: number;
    totalCount: number; goodCount: number; idealCycleTime: number; notes: string;
  }>) => api.patch<OEERecord>(`/oee/${id}`, data).then(r => r.data),

  deleteRecord: (id: string) =>
    api.delete(`/oee/${id}`).then(r => r.data),

  // Summaries
  getPlantSummary: (params?: {
    startDate?: string; endDate?: string; shift?: string; area?: string;
  }) => api.get<OEESummary>('/oee/summary/plant', { params }).then(r => r.data),

  getAssetSummary: (assetId: string, params?: {
    startDate?: string; endDate?: string; shift?: string;
  }) => api.get<OEESummary & { asset: OEERecord['asset']; recentRecords: OEERecord[] }>(
    `/oee/summary/asset/${assetId}`, { params }
  ).then(r => r.data),

  getTrend: (params?: {
    startDate?: string; endDate?: string; shift?: string;
    area?: string; assetId?: string; groupBy?: 'day' | 'week';
  }) => api.get<OEETrendPoint[]>('/oee/summary/trend', { params }).then(r => r.data),

  // Downtime CRUD
  getDowntimeEvents: (params?: {
    oeeRecordId?: string; assetId?: string; category?: string;
    lossType?: string; open?: string; page?: number; limit?: number;
  }) => api.get<Paginated<DowntimeEvent>>('/downtime', { params }).then(r => r.data),

  createDowntimeEvent: (data: {
    startTime: string; endTime?: string; category: string; lossType: string;
    reason: string; notes?: string; oeeRecordId: string; assetId: string;
  }) => api.post<DowntimeEvent>('/downtime', data).then(r => r.data),

  updateDowntimeEvent: (id: string, data: Partial<{
    endTime: string; category: string; lossType: string; reason: string; notes: string;
  }>) => api.patch<DowntimeEvent>(`/downtime/${id}`, data).then(r => r.data),

  deleteDowntimeEvent: (id: string) =>
    api.delete(`/downtime/${id}`).then(r => r.data),
};
