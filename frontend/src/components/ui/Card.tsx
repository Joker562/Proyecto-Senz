import { type ReactNode, type CSSProperties } from 'react';

interface CardProps {
  children: ReactNode;
  topAccent?: string;
  style?: CSSProperties;
  className?: string;
}

export function Card({ children, topAccent, style, className }: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--sz-card)',
        border: '1px solid var(--sz-border)',
        borderRadius: 'var(--sz-radius)',
        borderTop: topAccent ? `3px solid ${topAccent}` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, icon, action }: CardHeaderProps) {
  return (
    <div style={{
      padding: '12px 16px',
      borderBottom: '1px solid var(--sz-border)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {icon && <span style={{ color: 'var(--sz-muted)', display: 'flex' }}>{icon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--sz-text)', lineHeight: 1.3 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--sz-muted)', marginTop: 1 }}>{subtitle}</div>}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
