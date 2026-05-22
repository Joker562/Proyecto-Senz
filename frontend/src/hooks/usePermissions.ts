import { create } from 'zustand';
import { api } from '@/services/api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PermKey =
  | 'dashboard' | 'workOrders' | 'assets' | 'maintenance' | 'calendar' | 'checklists'
  | 'users' | 'settings'
  | 'fleet' | 'oee' | 'audits';

export type RolePerms = Record<PermKey, boolean>;
export type AllPerms  = Record<string, RolePerms>;

// ─── Defaults (espejo del backend) ───────────────────────────────────────────

export const DEFAULT_PERMISSIONS: AllPerms = {
  ADMIN:      { dashboard:true,  workOrders:true,  assets:true,  maintenance:true,  calendar:true,  checklists:true,  users:true,  settings:true,  fleet:true,  oee:true,  audits:true  },
  SUPERVISOR: { dashboard:true,  workOrders:true,  assets:true,  maintenance:true,  calendar:true,  checklists:true,  users:false, settings:false, fleet:true,  oee:true,  audits:true  },
  TECHNICIAN: { dashboard:true,  workOrders:true,  assets:false, maintenance:false, calendar:true,  checklists:false, users:false, settings:false, fleet:false, oee:false, audits:false },
  EXECUTIVE:  { dashboard:true,  workOrders:true,  assets:false, maintenance:false, calendar:false, checklists:false, users:false, settings:false, fleet:false, oee:true,  audits:true  },
};

// ─── Store ────────────────────────────────────────────────────────────────────

interface PermissionsState {
  permissions: AllPerms;
  loaded: boolean;
  fetchPermissions: () => Promise<void>;
  hasPermission: (role: string | undefined, key: PermKey) => boolean;
  getRolePerms: (role: string | undefined) => RolePerms;
}

export const usePermissions = create<PermissionsState>((set, get) => ({
  permissions: DEFAULT_PERMISSIONS,
  loaded:      false,

  fetchPermissions: async () => {
    try {
      const { data } = await api.get<AllPerms>('/settings/role-permissions');
      // Fusionar con defaults para garantizar todas las claves
      const merged: AllPerms = {};
      for (const role of Object.keys(DEFAULT_PERMISSIONS)) {
        merged[role] = { ...DEFAULT_PERMISSIONS[role], ...(data[role] ?? {}) };
      }
      set({ permissions: merged, loaded: true });
    } catch {
      set({ loaded: true }); // fallback silencioso a defaults
    }
  },

  hasPermission: (role, key) => {
    if (!role) return false;
    const perms = get().permissions;
    return perms[role]?.[key] ?? DEFAULT_PERMISSIONS[role]?.[key] ?? false;
  },

  getRolePerms: (role) => {
    if (!role) return DEFAULT_PERMISSIONS['TECHNICIAN'];
    const perms = get().permissions;
    return perms[role] ?? DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS['TECHNICIAN'];
  },
}));
