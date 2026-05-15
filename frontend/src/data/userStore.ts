// Persists new users in localStorage so they survive page reloads and navigation
import { mockUsers, type MockUser } from './mockData';

const LS_KEY = 'senz-extra-users';

function loadExtra(): MockUser[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as MockUser[]) : [];
  } catch {
    return [];
  }
}

function saveExtra(users: MockUser[]): void {
  // Only save the users not in the original mock list
  const baseIds = new Set(mockUsers.map((u) => u.id));
  const extra = users.filter((u) => !baseIds.has(u.id));
  localStorage.setItem(LS_KEY, JSON.stringify(extra));
}

// Build the working list: base mocks + anything previously saved
const _users: MockUser[] = [...mockUsers, ...loadExtra()];
const _listeners = new Set<() => void>();

export const userStore = {
  getAll: (): MockUser[] => [..._users],

  add: (user: MockUser): void => {
    _users.push(user);
    saveExtra(_users);
    _listeners.forEach((fn) => fn());
  },

  emailExists: (email: string): boolean =>
    _users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase()),

  subscribe: (fn: () => void): (() => void) => {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};
