import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const sections = [
  {
    title: 'PRINCIPAL',
    items: [{ path: '/dashboard', icon: '🏠', label: 'Dashboard', end: true }],
  },
  {
    title: 'MIS MÓDULOS',
    items: [
      { path: '/finanzas', icon: '💰', label: 'Finanzas' },
      { path: '/eventos', icon: '🎯', label: 'Eventos & Huchas' },
      { path: '/alimentacion', icon: '🍽️', label: 'Alimentación' },
    ],
  },
  {
    title: 'INTELIGENCIA ARTIFICIAL',
    items: [
      { path: '/asistente', icon: '🤖', label: 'Mi Asistente (Chat)' },
      { path: '/lista-compra', icon: '🛒', label: 'Lista de la compra' },
      { path: '/insights', icon: '📊', label: 'Insights & Alertas' },
      { path: '/mis-tickets', icon: '🧾', label: 'Mis tickets' },
    ],
  },
  {
    title: 'SISTEMA',
    items: [
      { path: '/perfil', icon: '👤', label: 'Mi Perfil (Admin)' },
      { action: 'logout', icon: '🚪', label: 'Cerrar Sesión' },
    ],
  },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      <aside className="sidebar glass">
        <NavLink to="/dashboard" className="sidebar-brand" title="Ir al inicio">
          <img
            src="/logo-mybrain.png"
            alt="MybrAIn"
            className="sidebar-logo-img"
            width={1024}
            height={559}
            decoding="async"
          />
        </NavLink>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          {sections.map((section) => (
            <div key={section.title} className="sidebar-section">
              <p className="sidebar-section-title">{section.title}</p>
              <ul className="sidebar-section-list">
                {section.items.map((item) => {
                  if (item.action === 'logout') {
                    return (
                      <li key="logout">
                        <button
                          type="button"
                          className="sidebar-link sidebar-link-button"
                          onClick={handleLogout}
                        >
                          <span className="sidebar-link-icon" aria-hidden>
                            {item.icon}
                          </span>
                          <span className="sidebar-link-label">{item.label}</span>
                        </button>
                      </li>
                    )
                  }
                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        end={item.end === true}
                        className={({ isActive }) =>
                          `sidebar-link${isActive ? ' active' : ''}`
                        }
                      >
                        <span className="sidebar-link-icon" aria-hidden>
                          {item.icon}
                        </span>
                        <span className="sidebar-link-label">{item.label}</span>
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar-user-strip">
          <div className="sidebar-avatar" aria-hidden>
            {user?.nombre?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="sidebar-user-meta">
            <p className="sidebar-user-name">{user?.nombre || 'Usuario'}</p>
            <p className="sidebar-user-email">{user?.email || ''}</p>
          </div>
        </div>
      </aside>

      <style>{`
        .sidebar {
          position: fixed;
          left: var(--sidebar-inset);
          top: var(--sidebar-inset);
          bottom: var(--sidebar-inset);
          width: var(--sidebar-width);
          display: flex;
          flex-direction: column;
          padding: 18px 14px 16px;
          z-index: 50;
          border-radius: 18px;
          box-sizing: border-box;
          backdrop-filter: saturate(160%) blur(28px);
          -webkit-backdrop-filter: saturate(160%) blur(28px);
        }

        .sidebar-brand {
          display: block;
          padding: 6px 8px 4px;
          margin-bottom: 8px;
          text-decoration: none;
          border-radius: 12px;
          transition: opacity 0.2s ease;
        }
        .sidebar-brand:hover {
          opacity: 0.9;
        }
        .sidebar-logo-img {
          width: 100%;
          max-width: 100%;
          height: auto;
          max-height: 48px;
          object-fit: contain;
          object-position: left center;
          display: block;
          /* Logo claro sobre glass: contorno suave para legibilidad */
          filter: drop-shadow(0 0 0.5px rgba(0, 0, 0, 0.14)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.06));
        }

        .sidebar-nav {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding-right: 4px;
          margin-bottom: 12px;
        }
        .sidebar-nav::-webkit-scrollbar {
          width: 4px;
        }
        .sidebar-nav::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.12);
          border-radius: 4px;
        }

        .sidebar-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .sidebar-section-title {
          margin: 0;
          padding: 0 10px;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #3aa89a;
        }
        .sidebar-section-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 11px;
          width: 100%;
          padding: 10px 12px;
          border-radius: 12px;
          color: var(--color-text);
          text-decoration: none;
          font-size: 0.88rem;
          font-weight: 500;
          border: 1px solid transparent;
          background: transparent;
          text-align: left;
          font-family: var(--font-main);
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
        }
        .sidebar-link:hover {
          background: rgba(255, 255, 255, 0.35);
          color: var(--color-text);
        }
        .sidebar-link.active {
          color: var(--color-text);
          font-weight: 600;
          background: rgba(0, 145, 220, 0.16);
          border-color: rgba(0, 113, 227, 0.22);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
        }
        .sidebar-link-icon {
          font-size: 1.15rem;
          line-height: 1;
          flex-shrink: 0;
          width: 1.35rem;
          text-align: center;
        }
        .sidebar-link-label {
          flex: 1;
          min-width: 0;
          line-height: 1.3;
        }
        .sidebar-link-button {
          margin: 0;
        }

        .sidebar-user-strip {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 12px 10px;
          margin-top: auto;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          flex-shrink: 0;
        }
        .sidebar-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.95rem;
          color: white;
          flex-shrink: 0;
        }
        .sidebar-user-meta {
          min-width: 0;
          flex: 1;
        }
        .sidebar-user-name {
          font-size: 0.82rem;
          font-weight: 700;
          margin: 0 0 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: var(--color-text);
        }
        .sidebar-user-email {
          font-size: 0.7rem;
          color: var(--color-text-muted);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        @media (max-width: 1024px) {
          .sidebar {
            display: none;
          }
        }
      `}</style>
    </>
  )
}
