import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'

export default function MiPerfil() {
  const { user } = useAuth()

  const handleBorrarCuenta = async () => {
    if (!user?.email) return
    
    const confirm = window.confirm("⚠️ ¿Estás COMPLETAMENTE seguro? Esta acción borrará tu cuenta y todos tus datos de forma irreversible.")
    if (!confirm) return

    try {
      const res = await fetch('/api/borrar-cuenta', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      })
      const data = await res.json()

      if (res.ok) {
        alert("Tu cuenta ha sido eliminada con éxito. Esperamos verte de nuevo pronto. ¡Hasta luego!")
        // Limpiar el estado de sesión local
        localStorage.removeItem('mybrain_user')
        window.location.href = '/login'
      } else {
        alert(data.error || "No se pudo eliminar la cuenta.")
      }
    } catch (err) {
      console.error(err)
      alert("Error de red al intentar eliminar la cuenta.")
    }
  }

  return (
    <DashboardLayout>
        <header className="perfil-card glass animate-fade-in">
          <h1 className="dash-greeting">Mi perfil</h1>
          <p className="dash-sub">Datos de tu cuenta en MybrAIn.</p>
          <dl className="perfil-dl">
            <dt>Nombre</dt>
            <dd>{user?.nombre || '—'}</dd>
            <dt>Usuario</dt>
            <dd>{user?.username || '—'}</dd>
            <dt>Email</dt>
            <dd>{user?.email || '—'}</dd>
          </dl>
          <Link to="/dashboard" className="btn-secondary">
            Volver al inicio
          </Link>

          {/* ZONA DE PELIGRO */}
          <div className="danger-zone">
            <h3 className="danger-title">Zona de peligro</h3>
            <p className="danger-desc">
              Una vez que elimines tu cuenta, no hay marcha atrás. Todos tus datos financieros y personales se borrarán de forma irreversible.
            </p>
            <button type="button" onClick={handleBorrarCuenta} className="btn-danger">
              Eliminar cuenta definitivamente
            </button>
          </div>
        </header>

        <style>{`
          .perfil-card {
            padding: 28px;
            border-radius: 18px;
            max-width: min(480px, 100%);
          }
          .perfil-dl {
            margin: 20px 0;
            display: grid;
            gap: 12px;
          }
          .perfil-dl dt {
            font-size: 0.72rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--color-text-muted);
          }
          .perfil-dl dd {
            margin: 0;
            font-size: 1rem;
            color: var(--color-text);
          }
          .danger-zone {
            margin-top: 28px;
            padding-top: 24px;
            border-top: 1px solid rgba(239, 68, 68, 0.15);
          }
          .danger-title {
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #ef4444;
            margin-bottom: 6px;
          }
          .danger-desc {
            font-size: 0.75rem;
            color: var(--color-text-muted);
            margin-bottom: 16px;
            line-height: 1.4;
          }
          .btn-danger {
            width: 100%;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: #ffffff;
            border: none;
            padding: 10px 16px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.875rem;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
            transition: opacity 0.2s;
          }
          .btn-danger:hover {
            opacity: 0.9;
          }
        `}</style>
    </DashboardLayout>
  )
}
