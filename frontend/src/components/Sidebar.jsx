import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
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
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen])

  const handleLogout = () => {
    setMobileOpen(false)
    logout()
    navigate('/login')
  }

  const closeMobile = () => setMobileOpen(false)

  const navContent = (
    <>
      <NavLink to="/dashboard" className="sidebar-brand" title="Ir al inicio" onClick={closeMobile}>
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
                      className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                      onClick={closeMobile}
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
    </>
  )

  return (
    <>
      <header className="mobile-top-bar glass" aria-label="Barra superior">
        <button
          type="button"
          className="mobile-menu-btn"
          aria-expanded={mobileOpen}
          aria-controls="sidebar-drawer"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span className="mobile-menu-icon" aria-hidden />
          <span className="sr-only">{mobileOpen ? 'Cerrar menú' : 'Abrir menú'}</span>
        </button>
        <NavLink to="/dashboard" className="mobile-top-brand" onClick={closeMobile}>
          <img src="/logo-mybrain.png" alt="MybrAIn" className="mobile-top-logo" decoding="async" />
        </NavLink>
      </header>

      <button
        type="button"
        className={`sidebar-backdrop${mobileOpen ? ' sidebar-backdrop--visible' : ''}`}
        aria-hidden={!mobileOpen}
        tabIndex={mobileOpen ? 0 : -1}
        onClick={closeMobile}
      />

      <aside
        id="sidebar-drawer"
        className={`sidebar glass${mobileOpen ? ' sidebar--open' : ''}`}
        aria-hidden={undefined}
      >
        {navContent}
      </aside>
    </>
  )
}
