export interface Theme {
  name:          string;
  sidebar:       string;
  sidebarBorder: string;
  sidebarMuted:  string;
  sidebarActive: string;
  accent:        string;
  topbar:        string;
  bg:            string;
  card:          string;
  border:        string;
  text:          string;
  muted:         string;
  rowHov:        string;
  radius:        string;
}

export const THEMES: Record<string, Theme> = {
  clasico: {
    name: 'Clásico',
    sidebar:       '#1c1c1c',
    sidebarBorder: 'rgba(255,255,255,.10)',
    sidebarMuted:  'rgba(255,255,255,.55)',
    sidebarActive: 'rgba(255,255,255,.08)',
    accent:        '#e67e22',
    topbar:        '#ffffff',
    bg:            '#f5f5f3',
    card:          '#ffffff',
    border:        '#e4e4e4',
    text:          '#1c1c1c',
    muted:         '#888888',
    rowHov:        '#fff4ec',
    radius:        '2px',
  },
  steel: {
    name: 'Steel',
    sidebar:       '#1a2535',
    sidebarBorder: 'rgba(255,255,255,.10)',
    sidebarMuted:  'rgba(255,255,255,.50)',
    sidebarActive: 'rgba(255,255,255,.07)',
    accent:        '#3b82f6',
    topbar:        '#ffffff',
    bg:            '#f0f4f8',
    card:          '#ffffff',
    border:        '#dde3eb',
    text:          '#1a2535',
    muted:         '#7a8fa6',
    rowHov:        '#eff6ff',
    radius:        '4px',
  },
  slate: {
    name: 'Slate',
    sidebar:       '#0f172a',
    sidebarBorder: 'rgba(255,255,255,.08)',
    sidebarMuted:  'rgba(226,232,240,.55)',
    sidebarActive: 'rgba(255,255,255,.06)',
    accent:        '#f59e0b',
    topbar:        '#1e293b',
    bg:            '#0f172a',
    card:          '#1e293b',
    border:        '#334155',
    text:          '#e2e8f0',
    muted:         '#94a3b8',
    rowHov:        '#1e3a5f',
    radius:        '6px',
  },
  linen: {
    name: 'Linen',
    sidebar:       '#2c2420',
    sidebarBorder: 'rgba(255,255,255,.10)',
    sidebarMuted:  'rgba(255,255,255,.50)',
    sidebarActive: 'rgba(255,255,255,.07)',
    accent:        '#c0714a',
    topbar:        '#fffdf9',
    bg:            '#f5f0e8',
    card:          '#fffdf9',
    border:        '#e0d8cc',
    text:          '#2c2420',
    muted:         '#8a7a70',
    rowHov:        '#fdf0e8',
    radius:        '4px',
  },
  dusk: {
    name: 'Dusk',
    sidebar:       '#1e2233',
    sidebarBorder: 'rgba(255,255,255,.09)',
    sidebarMuted:  'rgba(255,255,255,.50)',
    sidebarActive: 'rgba(255,255,255,.07)',
    accent:        '#c9a84c',
    topbar:        '#ffffff',
    bg:            '#eef0f5',
    card:          '#ffffff',
    border:        '#dde0e9',
    text:          '#1e2233',
    muted:         '#7a8099',
    rowHov:        '#fdf6e3',
    radius:        '5px',
  },
  studio: {
    name: 'Studio',
    sidebar:       '#1f1f1f',
    sidebarBorder: 'rgba(255,255,255,.09)',
    sidebarMuted:  'rgba(255,255,255,.50)',
    sidebarActive: 'rgba(255,255,255,.07)',
    accent:        '#6b8f71',
    topbar:        '#ffffff',
    bg:            '#f7f7f6',
    card:          '#ffffff',
    border:        '#e3e3e1',
    text:          '#1f1f1f',
    muted:         '#888884',
    rowHov:        '#f0f5f1',
    radius:        '3px',
  },
};

export const DEFAULT_THEME_KEY = 'clasico';

export function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
