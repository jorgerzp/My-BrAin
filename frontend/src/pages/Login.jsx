import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AILoader from '@/components/ui/ai-loader'

export default function Login() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setIsExiting(false)
    const startTime = Date.now()
    try {
      if (mode === 'login') {
        await login(username.trim(), password)
      } else {
        await register(username.trim(), nombre.trim(), email.trim(), password)
      }
      
      const elapsedTime = Date.now() - startTime
      const minDuration = 2500
      if (elapsedTime < minDuration) {
        await new Promise((resolve) => setTimeout(resolve, minDuration - elapsedTime))
      }
      
      setIsExiting(true)
      await new Promise((resolve) => setTimeout(resolve, 500)) // Wait for the fade-out duration
      
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Error')
      setIsExiting(false)
      setLoading(false)
    }
  }

  const handleFillDemo = () => {
    setMode('login')
    setUsername('demo')
    setPassword('demo')
    setError('')
  }

  const handleQuickDemoLogin = async () => {
    setError('')
    setMode('login')
    setUsername('demo')
    setPassword('demo')
    setLoading(true)
    setIsExiting(false)
    const startTime = Date.now()
    try {
      await login('demo', 'demo')
      const elapsedTime = Date.now() - startTime
      const minDuration = 2000
      if (elapsedTime < minDuration) {
        await new Promise((resolve) => setTimeout(resolve, minDuration - elapsedTime))
      }
      setIsExiting(true)
      await new Promise((resolve) => setTimeout(resolve, 500))
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión con demo')
      setIsExiting(false)
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {loading && <AILoader text={mode === 'login' ? 'Entrando' : 'Registrando'} isExiting={isExiting} />}
      <div className="login-card glass-strong animate-fade-in">
        <div className="login-brand-wrap">
          <AILoader size={180} text="" fullScreen={false} />
        </div>

        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login')
              setError('')
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`login-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setMode('register')
              setError('')
            }}
          >
            Crear cuenta
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <label className="login-label">
            Usuario
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>

          {mode === 'register' && (
            <>
              <label className="login-label">
                Nombre
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </label>
              <label className="login-label">
                Email
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
            </>
          )}

          <label className="login-label">
            Contraseña
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button type="submit" className="btn-primary login-submit" disabled={loading}>
            {loading ? '…' : mode === 'login' ? 'Entrar' : 'Registrarse'}
          </button>
        </form>

        <div className="login-demo-card">
          <div className="login-demo-header">
            <span className="login-demo-badge">✨ ACCESO DEMO</span>
            <span className="login-demo-tag">Modo visualización</span>
          </div>
          <p className="login-demo-desc">
            ¿Quieres explorar el proyecto? Puedes entrar libremente con la cuenta demo:
          </p>
          <div className="login-demo-creds">
            <button
              type="button"
              className="login-demo-pill"
              onClick={handleFillDemo}
              title="Clic para autorrellenar campos"
            >
              <span className="demo-pill-label">Usuario:</span>
              <span className="demo-pill-val">demo</span>
            </button>
            <button
              type="button"
              className="login-demo-pill"
              onClick={handleFillDemo}
              title="Clic para autorrellenar campos"
            >
              <span className="demo-pill-label">Contraseña:</span>
              <span className="demo-pill-val">demo</span>
            </button>
          </div>
          <button
            type="button"
            className="login-demo-btn"
            onClick={handleQuickDemoLogin}
            disabled={loading}
          >
            <span className="demo-btn-icon">⚡</span>
            <span>Entrar directamente como Demo</span>
          </button>
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: radial-gradient(ellipse at top, rgba(0, 0, 0, 0.05), transparent 55%),
            linear-gradient(180deg, #fafafa 0%, var(--color-bg-dark) 50%);
        }
        .login-card {
          width: 100%;
          max-width: 400px;
          padding: 32px;
          border-radius: 20px;
        }
        .login-brand-wrap {
          display: flex;
          justify-content: center;
          margin-bottom: 28px;
        }
        .login-brand-logo {
          width: 100%;
          max-width: min(320px, 100%);
          height: auto;
          display: block;
          object-fit: contain;
          filter: drop-shadow(0 0 0.5px rgba(0, 0, 0, 0.12)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05));
        }
        .login-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        .login-tab {
          flex: 1;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid var(--color-border);
          background: rgba(15, 23, 42, 0.04);
          color: var(--color-text-muted);
          font-family: var(--font-main);
          font-weight: 600;
          font-size: 0.88rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .login-tab.active {
          color: var(--color-text);
          border-color: rgba(0, 0, 0, 0.18);
          background: rgba(0, 0, 0, 0.06);
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .login-label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.8rem;
          color: var(--color-text-muted);
          font-weight: 500;
        }
        .login-label input {
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid var(--color-border);
          background: var(--color-bg-card);
          color: var(--color-text);
          font-family: var(--font-main);
          font-size: 0.95rem;
        }
        .login-error {
          color: var(--color-danger);
          font-size: 0.88rem;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(255, 107, 107, 0.1);
        }
        .login-submit {
          width: 100%;
          margin-top: 8px;
        }
        .login-footer {
          margin-top: 20px;
          text-align: center;
        }
        .login-link {
          color: var(--color-accent-light);
          font-size: 0.85rem;
          text-decoration: none;
        }
        .login-link:hover {
          text-decoration: underline;
        }

        /* Card de Acceso Demo */
        .login-demo-card {
          margin-top: 22px;
          padding: 16px 18px;
          border-radius: 16px;
          background: rgba(99, 102, 241, 0.05);
          border: 1px solid rgba(99, 102, 241, 0.2);
          box-shadow: 0 4px 18px -2px rgba(99, 102, 241, 0.08);
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: all 0.2s ease;
        }
        .login-demo-card:hover {
          border-color: rgba(99, 102, 241, 0.35);
          background: rgba(99, 102, 241, 0.07);
        }
        .login-demo-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .login-demo-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: #4f46e5;
          text-transform: uppercase;
        }
        .login-demo-tag {
          font-size: 0.72rem;
          color: var(--color-text-muted);
          font-weight: 500;
        }
        .login-demo-desc {
          font-size: 0.8rem;
          color: var(--color-text-muted);
          line-height: 1.35;
          margin: 0;
        }
        .login-demo-creds {
          display: flex;
          gap: 8px;
        }
        .login-demo-pill {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 10px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px dashed rgba(99, 102, 241, 0.35);
          font-size: 0.8rem;
          color: var(--color-text);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .login-demo-pill:hover {
          background: #ffffff;
          border-color: #6366f1;
          border-style: solid;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
        }
        .demo-pill-label {
          color: var(--color-text-muted);
          font-weight: 500;
        }
        .demo-pill-val {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-weight: 700;
          color: #4f46e5;
        }
        .login-demo-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: #ffffff;
          font-family: var(--font-main);
          font-size: 0.84rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(79, 70, 229, 0.28);
          transition: all 0.2s ease;
        }
        .login-demo-btn:hover:not(:disabled) {
          filter: brightness(1.08);
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(79, 70, 229, 0.38);
        }
        .login-demo-btn:active:not(:disabled) {
          transform: scale(0.99);
        }
        .login-demo-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .demo-btn-icon {
          font-size: 0.95rem;
        }
      `}</style>
    </div>
  )
}
