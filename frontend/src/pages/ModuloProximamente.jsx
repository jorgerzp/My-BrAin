import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

export default function ModuloProximamente({ titulo, descripcion }) {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
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
      </main>
    </div>
  )
}
