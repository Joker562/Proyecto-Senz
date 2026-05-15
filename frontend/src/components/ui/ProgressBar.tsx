interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  showLabel?: boolean;
  label?: string;
}

export function ProgressBar({ value, max = 100, color = 'var(--sz-accent)', height = 8, showLabel, label }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      {(showLabel || label) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--sz-text)', marginBottom: 3 }}>
          {label && <span>{label}</span>}
          {showLabel && <span style={{ fontWeight: 600, color }}>{value}</span>}
        </div>
      )}
      <div style={{ height, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width .4s' }} />
      </div>
    </div>
  );
}
