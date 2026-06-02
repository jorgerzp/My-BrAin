import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Finanzas from './pages/Finanzas'
import Alimentacion from './pages/Alimentacion'
import ListaCompra from './pages/ListaCompra'
import Eventos from './pages/Eventos'
import MiPerfil from './pages/MiPerfil'
import MiAsistente from './pages/MiAsistente'
import InsightsAlertas from './pages/InsightsAlertas'
import MisTickets from './pages/MisTickets'
import SonoraParticleHero from './components/sonora/SonoraParticleHero'
import { AuroraBackground } from '@/components/ui/aurora-background'

// Componente para proteger rutas
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <AuroraBackground showRadialGradient>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src="/logo-mybrain.png"
            alt=""
            width={72}
            height={72}
            decoding="async"
            style={{
              width: 72,
              height: 'auto',
              maxHeight: 72,
              objectFit: 'contain',
              animation: 'pulse-glow 2s ease-in-out infinite',
              filter:
                'drop-shadow(0 0 0.5px rgba(0,0,0,0.12)) drop-shadow(0 1px 2px rgba(0,0,0,0.06))',
            }}
          />
        </div>
      </AuroraBackground>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <AuroraBackground showRadialGradient>{children}</AuroraBackground>
}

// Redirigir si ya está logueado
function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/finanzas"
        element={
          <ProtectedRoute>
            <Finanzas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alimentacion"
        element={
          <ProtectedRoute>
            <Alimentacion />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lista-compra"
        element={
          <ProtectedRoute>
            <ListaCompra />
          </ProtectedRoute>
        }
      />
      <Route
        path="/eventos"
        element={
          <ProtectedRoute>
            <Eventos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/asistente"
        element={
          <ProtectedRoute>
            <MiAsistente />
          </ProtectedRoute>
        }
      />
      <Route
        path="/insights"
        element={
          <ProtectedRoute>
            <InsightsAlertas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mis-tickets"
        element={
          <ProtectedRoute>
            <MisTickets />
          </ProtectedRoute>
        }
      />
      <Route path="/ticket-ia" element={<Navigate to="/mis-tickets" replace />} />
      <Route path="/tickets-guardados" element={<Navigate to="/mis-tickets" replace />} />
      <Route
        path="/perfil"
        element={
          <ProtectedRoute>
            <MiPerfil />
          </ProtectedRoute>
        }
      />
      {/* Landing marketing Sonora (3D); la app My_BrAIn entra por / → dashboard o login */}
      <Route path="/sonora" element={<SonoraParticleHero />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
