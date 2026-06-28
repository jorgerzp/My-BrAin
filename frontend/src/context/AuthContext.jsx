import { createContext, useState, useContext, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (res.ok && data.user) {
          setUser(data.user)
          localStorage.setItem('mybrain_user', JSON.stringify(data.user))
        } else {
          setUser(null)
          localStorage.removeItem('mybrain_user')
        }
      } catch (e) {
        console.error('[Auth] Error al verificar sesión en servidor:', e)
        // Fallback al valor local si el servidor no responde
        const saved = localStorage.getItem('mybrain_user')
        if (saved) {
          try {
            setUser(JSON.parse(saved))
          } catch (err) {
            localStorage.removeItem('mybrain_user')
          }
        }
      } finally {
        setLoading(false)
      }
    }
    checkSession()
  }, [])

  const login = async (username, password) => {
    if (!username || !password) {
      throw new Error('Usuario y contraseña son obligatorios')
    }

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Error al iniciar sesión')
    }

    localStorage.setItem('mybrain_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  const register = async (username, nombre, email, password) => {
    if (!username || !nombre || !email || !password) {
      throw new Error('Todos los campos son obligatorios')
    }

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, nombre, email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Error al registrarse')
    }

    localStorage.setItem('mybrain_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (e) {
      console.error('[Auth] Error al cerrar sesión en servidor:', e)
    } finally {
      localStorage.removeItem('mybrain_user')
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
