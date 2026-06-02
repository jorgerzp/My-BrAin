import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'

export default function MiPerfil() {
  const { user } = useAuth()

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
        `}</style>
    </DashboardLayout>
  )
}
