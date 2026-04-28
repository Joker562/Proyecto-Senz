import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Ingresa usuario y contraseña.'); return; }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const inputBase: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: 14,
    border: '1px solid #d0d0d0', borderRadius: 3,
    fontFamily: 'IBM Plex Sans, sans-serif', outline: 'none',
    background: '#fff', color: '#1c1c1c', boxSizing: 'border-box',
    transition: 'border-color .15s',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'IBM Plex Sans, sans-serif' }}>

      {/* ── Panel izquierdo — marca ── */}
      <div className="login-brand-panel" style={{
        width: 420, background: '#1c1c1c', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 48, flexShrink: 0,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Líneas decorativas diagonales */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: .05, pointerEvents: 'none' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ position: 'absolute', top: `${i * 14}%`, left: -40, right: -40, height: 1, background: '#fff', transform: 'rotate(-15deg)' }} />
          ))}
        </div>

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <img
            src="/logo-s-clean.png"
            alt="Senz"
            style={{ display: 'block', width: 64, height: 64, objectFit: 'contain', margin: '0 auto 20px', filter: 'brightness(0) invert(1)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div style={{ color: '#fff', fontSize: 30, fontWeight: 700, letterSpacing: '.5px', marginBottom: 6 }}>senz</div>
          <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 13, letterSpacing: '.5px', marginBottom: 48, textTransform: 'uppercase' }}>
            Sistema de Mantenimiento
          </div>

          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              ['◈', 'Gestión de órdenes de trabajo'],
              ['◈', 'Seguimiento de equipos y maquinaria'],
              ['◈', 'Alertas de mantenimiento vencido'],
              ['◈', 'Reportes y métricas en tiempo real'],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#e67e22', fontSize: 12 }}>{icon}</span>
                <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 13 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,.2)', fontSize: 11 }}>
          Persianas &amp; Cortinas Senz © 2026
        </div>
      </div>

      {/* ── Panel derecho — formulario ── */}
      <div className="login-form-panel" style={{ flex: 1, background: '#f7f7f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1c1c1c', marginBottom: 6 }}>Iniciar sesión</div>
            <div style={{ fontSize: 13, color: '#888' }}>Ingresa tus credenciales para continuar</div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
                Usuario
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu.usuario@senz.mx"
                style={inputBase}
                onFocus={(e) => (e.target.style.borderColor = '#e67e22')}
                onBlur={(e) => (e.target.style.borderColor = '#d0d0d0')}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ ...inputBase, paddingRight: 38 }}
                  onFocus={(e) => (e.target.style.borderColor = '#e67e22')}
                  onBlur={(e) => (e.target.style.borderColor = '#d0d0d0')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 0, display: 'flex', alignItems: 'center' }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: '#fde8e6', color: '#c0392b', padding: '8px 12px', borderRadius: 3, fontSize: 12, border: '1px solid #f5c6c2' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#e67e22', fontFamily: 'IBM Plex Sans, sans-serif' }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '11px 0', background: loading ? '#ccc' : '#e67e22',
                color: '#fff', border: 'none', borderRadius: 3, fontSize: 14, fontWeight: 600,
                cursor: loading ? 'default' : 'pointer',
                fontFamily: 'IBM Plex Sans, sans-serif',
                transition: 'background .15s',
                letterSpacing: '.3px',
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{
                    width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)',
                    borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block',
                    animation: 'spin .7s linear infinite',
                  }} />
                  Verificando…
                </span>
              ) : 'Ingresar al sistema'}
            </button>
          </form>

        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 767px) {
          .login-brand-panel { display: none !important; }
          .login-form-panel {
            padding: 32px 24px !important;
            align-items: flex-start !important;
          }
          .login-form-panel > div { max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
