import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(username.trim(), password)
      } else {
        await register(username.trim(), nombre.trim(), email.trim(), password)
      }
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card glass-strong animate-fade-in">
        <div className="login-brand-wrap">
          <img
            src="/logo-mybrain.png"
            alt="MybrAIn — Your Intelligent Personal Assistant"
            className="login-brand-logo"
            width={1024}
            height={559}
            decoding="async"
          />
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

        <p className="login-footer">
          <Link to="/sonora" className="login-link">
            Sonora · landing
          </Link>
        </p>
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
      `}</style>
    </div>
  )
}
