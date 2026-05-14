import type { LucideIcon } from 'lucide-react';

interface Feature {
  label: string;
  description: string;
}

interface Props {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  features: Feature[];
  accentColor?: string;
}

export default function PlaceholderPage({
  icon: Icon,
  title,
  subtitle,
  features,
  accentColor = '#e67e22',
}: Props) {
  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        background: '#f5f5f5',
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: '100%',
          background: '#fff',
          borderRadius: 12,
          padding: '40px 36px',
          boxShadow: '0 1px 4px rgba(0,0,0,.08)',
          textAlign: 'center',
          fontFamily: 'IBM Plex Sans, sans-serif',
        }}
      >
        {/* Icono */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: `${accentColor}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <Icon size={32} style={{ color: accentColor }} />
        </div>

        {/* Badge */}
        <span
          style={{
            display: 'inline-block',
            background: `${accentColor}18`,
            color: accentColor,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.6px',
            textTransform: 'uppercase',
            padding: '3px 10px',
            borderRadius: 20,
            marginBottom: 14,
          }}
        >
          Próximamente
        </span>

        {/* Título */}
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#1a1a1a',
            margin: '0 0 8px',
          }}
        >
          {title}
        </h1>
        <p style={{ fontSize: 14, color: '#666', margin: '0 0 32px', lineHeight: 1.6 }}>
          {subtitle}
        </p>

        {/* Lista de funcionalidades */}
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: '12px 14px',
                background: '#f9f9f9',
                borderRadius: 8,
                borderLeft: `3px solid ${accentColor}`,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: accentColor,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}>
                  {f.label}
                </div>
                <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{f.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
