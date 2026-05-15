import { createContext, useContext, useEffect, useState } from 'react';
import { THEMES, DEFAULT_THEME_KEY, hexToHsl, type Theme } from './themes';

interface ThemeContextValue {
  themeKey: string;
  theme: Theme;
  setThemeKey: (key: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeKey: DEFAULT_THEME_KEY,
  theme: THEMES[DEFAULT_THEME_KEY],
  setThemeKey: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeKey, setThemeKeyState] = useState<string>(() => {
    const stored = localStorage.getItem('senz-theme');
    return stored && THEMES[stored] ? stored : DEFAULT_THEME_KEY;
  });

  const theme = THEMES[themeKey] ?? THEMES[DEFAULT_THEME_KEY];

  useEffect(() => {
    const root = document.documentElement;

    root.style.setProperty('--sz-sidebar',        theme.sidebar);
    root.style.setProperty('--sz-sidebar-border', theme.sidebarBorder);
    root.style.setProperty('--sz-sidebar-muted',  theme.sidebarMuted);
    root.style.setProperty('--sz-sidebar-active', theme.sidebarActive);
    root.style.setProperty('--sz-accent',         theme.accent);
    root.style.setProperty('--sz-topbar',         theme.topbar);
    root.style.setProperty('--sz-bg',             theme.bg);
    root.style.setProperty('--sz-card',           theme.card);
    root.style.setProperty('--sz-border',         theme.border);
    root.style.setProperty('--sz-text',           theme.text);
    root.style.setProperty('--sz-muted',          theme.muted);
    root.style.setProperty('--sz-row-hov',        theme.rowHov);
    root.style.setProperty('--sz-radius',         theme.radius);

    // Keep Tailwind HSL vars in sync (only for hex colors, skip rgba sidebar values)
    if (theme.bg.startsWith('#'))     root.style.setProperty('--background', hexToHsl(theme.bg));
    if (theme.card.startsWith('#'))   root.style.setProperty('--card',       hexToHsl(theme.card));
    if (theme.border.startsWith('#')) root.style.setProperty('--border',     hexToHsl(theme.border));
    if (theme.accent.startsWith('#')) root.style.setProperty('--primary',    hexToHsl(theme.accent));
    if (theme.text.startsWith('#'))   root.style.setProperty('--foreground', hexToHsl(theme.text));
    if (theme.muted.startsWith('#'))  root.style.setProperty('--muted-foreground', hexToHsl(theme.muted));

    root.style.setProperty('--radius', theme.radius === '2px' ? '0.125rem'
      : theme.radius === '3px' ? '0.1875rem'
      : theme.radius === '4px' ? '0.25rem'
      : theme.radius === '5px' ? '0.3125rem'
      : '0.375rem');

    localStorage.setItem('senz-theme', themeKey);
  }, [themeKey, theme]);

  const setThemeKey = (key: string) => {
    if (THEMES[key]) setThemeKeyState(key);
  };

  return (
    <ThemeContext.Provider value={{ themeKey, theme, setThemeKey }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
