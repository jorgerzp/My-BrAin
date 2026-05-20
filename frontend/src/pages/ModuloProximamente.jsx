import { Link } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'

export default function ModuloProximamente({ titulo, descripcion }) {
  return (
    <DashboardLayout>
        <header className="mp-card glass animate-fade-in">
          <h1 className="dash-greeting">{titulo}</h1>
          <p className="dash-sub">{descripcion || 'Estamos trabajando en este módulo.'}</p>
          <Link to="/dashboard" className="btn-secondary">
            Volver al inicio
          </Link>
        </header>
        <style>{`
          .mp-card {
            padding: 28px;
            border-radius: 18px;
            max-width: 560px;
          }
        `}</style>
    </DashboardLayout>
  )
}
