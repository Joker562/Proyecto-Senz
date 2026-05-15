import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary:     { DEFAULT: 'hsl(var(--primary))',     foreground: 'hsl(var(--primary-foreground))' },
        secondary:   { DEFAULT: 'hsl(var(--secondary))',   foreground: 'hsl(var(--secondary-foreground))' },
        muted:       { DEFAULT: 'hsl(var(--muted))',       foreground: 'hsl(var(--muted-foreground))' },
        accent:      { DEFAULT: 'hsl(var(--accent))',      foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        card:        { DEFAULT: 'hsl(var(--card))',        foreground: 'hsl(var(--card-foreground))' },
        // Senz design-token palette
        sz: {
          sidebar:        'var(--sz-sidebar)',
          'sidebar-border': 'var(--sz-sidebar-border)',
          'sidebar-muted':  'var(--sz-sidebar-muted)',
          'sidebar-active': 'var(--sz-sidebar-active)',
          accent:         'var(--sz-accent)',
          topbar:         'var(--sz-topbar)',
          bg:             'var(--sz-bg)',
          card:           'var(--sz-card)',
          border:         'var(--sz-border)',
          text:           'var(--sz-text)',
          muted:          'var(--sz-muted)',
          'row-hov':      'var(--sz-row-hov)',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg:  'var(--radius)',
        md:  'calc(var(--radius) - 2px)',
        sm:  'calc(var(--radius) - 4px)',
        sz:  'var(--sz-radius)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
