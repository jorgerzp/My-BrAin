import { useEffect, useState, useCallback } from 'react'
import {
  Building2,
  RefreshCw,
  Trash2,
  Plus,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react'

export default function BankConnect({ userId, onSyncSuccess }) {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(false)
  const [callbackLoading, setCallbackLoading] = useState(false)
  const [syncingAccountId, setSyncingAccountId] = useState(null)
  const [disconnectingRequisitionId, setDisconnectingRequisitionId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 1. Cargar conexiones existentes
  const loadData = useCallback(async () => {
    if (!userId) return
    setError('')
    try {
      // Cargar conexiones actuales
      const resConn = await fetch(`/api/banks/connections?userId=${userId}`)
      const dataConn = await resConn.json()
      if (resConn.ok) {
        setConnections(dataConn.connections || [])
      }
    } catch (e) {
      console.error(e)
      setError('No se pudo conectar con el servidor para cargar los datos bancarios.')
    }
  }, [userId])

  // 2. Gestionar el callback del banco (?ref=...)
  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search)
      const ref = params.get('ref')
      if (!ref || !userId) return

      setCallbackLoading(true)
      setError('')
      setSuccess('')

      try {
        // Enviar callback al backend para obtener account_id y asociar cuenta
        const resCall = await fetch(`/api/banks/callback?ref=${ref}`)
        const dataCall = await resCall.json()

        if (!resCall.ok) {
          throw new Error(dataCall.error || 'Error al completar el enlace con tu banco.')
        }

        setSuccess(`¡Conectado con éxito a ${dataCall.bancoNombre || 'tu banco'}! Sincronizando movimientos...`)

        // Sincronizar transacciones inmediatamente de los últimos 30 días
        const resSync = await fetch(`/api/banks/transactions?userId=${userId}`)
        const dataSync = await resSync.json()

        if (resSync.ok) {
          setSuccess(`¡Sincronización completada con éxito! Se han importado ${dataSync.importedCount} transacciones.`)
          if (onSyncSuccess) {
            onSyncSuccess() // Recargar finanzas principales
          }
        } else {
          setError(`Banco enlazado, pero falló la sincronización inicial de movimientos: ${dataSync.error}`)
        }

        // Limpiar parámetro URL sin recargar la página
        const newUrl = window.location.pathname
        window.history.replaceState({}, document.title, newUrl)

        // Recargar las conexiones
        loadData()
      } catch (err) {
        console.error(err)
        setError(err.message || 'Error durante el proceso de enlace con el banco.')
      } finally {
        setCallbackLoading(false)
      }
    }

    handleCallback()
  }, [userId, loadData, onSyncSuccess])

  // 3. Cargar conexiones de inicio
  useEffect(() => {
    loadData()
  }, [loadData])

  // 4. Iniciar flujo de conexión
  const handleConnect = async (e) => {
    e.preventDefault()
    if (!userId) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/tink/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al iniciar sesión de conexión con Tink.')
      }

      if (data.url) {
        console.log(`[Tink] Redirigiendo a Tink Link: ${data.url}`)
        window.location.href = data.url
      } else {
        throw new Error('No se recibió la URL de redirección segura.')
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Error al iniciar la conexión con el banco.')
      setLoading(false)
    }
  }

  // 5. Sincronizar movimientos manualmente
  const handleSyncTransactions = async () => {
    if (!userId) return
    setSyncingAccountId('all')
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/banks/transactions?userId=${userId}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al sincronizar transacciones.')
      }

      setSuccess(`Sincronización finalizada. ${data.message}`)
      if (onSyncSuccess) {
        onSyncSuccess()
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Error en la sincronización manual.')
    } finally {
      setSyncingAccountId(null)
    }
  }

  // 6. Desconectar banco
  const handleDisconnect = async (requisitionId) => {
    if (!userId || !confirm('¿Estás seguro de que quieres desconectar este banco? Se eliminarán todas las cuentas bancarias asociadas.')) return
    setDisconnectingRequisitionId(requisitionId)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/banks/connections/${requisitionId}?userId=${userId}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al desconectar el banco.')
      }

      setSuccess('Banco desconectado con éxito.')
      loadData()
      if (onSyncSuccess) {
        onSyncSuccess()
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Error al desconectar el banco.')
    } finally {
      setDisconnectingRequisitionId(null)
    }
  }


  // Agrupar cuentas por conexión/requisición
  const groupedConnections = connections.reduce((acc, current) => {
    const key = current.requisition_id
    if (!acc[key]) {
      acc[key] = {
        requisitionId: current.requisition_id,
        institutionId: current.institution_id,
        status: current.status,
        createdAt: current.created_at,
        bancoNombre: current.banco_nombre || 'Banco',
        accounts: [],
      }
    }
    if (current.account_id) {
      acc[key].accounts.push({
        id: current.account_id,
      })
    }
    return acc
  }, {})

  const connectionsList = Object.values(groupedConnections)

  return (
    <div className="bank-connect-widget w-full">
      {/* Estado de Carga Callback */}
      {callbackLoading && (
        <div className="callback-overlay glass animate-fade-in">
          <div className="callback-content">
            <Loader2 className="animate-spin text-accent-light" size={48} />
            <h3 className="callback-title">Enlazando con tu banco</h3>
            <p className="callback-text">Estamos autorizando y descargando tus movimientos de los últimos 30 días de forma segura...</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Alertas */}
        {error && (
          <div className="alert-box alert-box-error animate-fade-in" role="alert">
            <AlertCircle size={20} className="shrink-0" />
            <p className="alert-message">{error}</p>
          </div>
        )}
        {success && (
          <div className="alert-box alert-box-success animate-fade-in" role="status">
            <CheckCircle2 size={20} className="shrink-0" />
            <p className="alert-message">{success}</p>
          </div>
        )}

        {/* Sección de Conectar Nuevo Banco */}
        <div className="bank-connect-card p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="icon-wrap bg-primary/10">
              <Building2 size={22} className="text-primary" />
            </div>
            <div>
              <h3 className="card-title font-semibold text-lg">Open Banking</h3>
              <p className="card-subtitle text-sm muted">Sincroniza tus cuentas bancarias para importar transacciones de forma segura y automática.</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-2 p-4 bg-primary/5 rounded-xl border border-primary/10">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-success mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium">Conexión cifrada de extremo a extremo</p>
                <p className="text-xs text-muted-foreground">Serás redirigido de forma segura a Tink para seleccionar tu banco y autorizar la sincronización de tus cuentas.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleConnect}
              disabled={loading}
              className="btn-primary shrink-0 flex items-center justify-center gap-2 w-full md:w-auto h-[42px] px-6"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Redirigiendo...</span>
                </>
              ) : (
                <>
                  <Plus size={18} />
                  <span>Conectar Banco</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Lista de Bancos Conectados */}
        {connectionsList.length > 0 && (
          <div className="connected-banks-card p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h4 className="font-semibold text-md">Cuentas vinculadas</h4>
              <button
                onClick={handleSyncTransactions}
                disabled={syncingAccountId === 'all'}
                className="btn-sync flex items-center gap-1.5 text-xs font-medium"
              >
                <RefreshCw size={14} className={syncingAccountId === 'all' ? 'animate-spin' : ''} />
                Sincronizar todas
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {connectionsList.map((conn) => (
                <div key={conn.requisitionId} className="bank-item glass p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bank-logo-placeholder">
                      {conn.bancoNombre.charAt(0)}
                    </div>
                    <div>
                      <p className="bank-name font-semibold text-sm">{conn.bancoNombre}</p>
                      <p className="bank-status text-xs flex items-center gap-1">
                        <span className="dot dot-active"></span>
                        <span className="muted">Enlazado ({conn.accounts.length} {conn.accounts.length === 1 ? 'cuenta' : 'cuentas'})</span>
                      </p>
                      {conn.accounts.map((acc, index) => (
                        <p key={acc.id} className="account-details text-[11px] muted font-mono mt-1">
                          Cuenta {index + 1}: ****{acc.id.slice(-6)}
                        </p>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDisconnect(conn.requisitionId)}
                    disabled={disconnectingRequisitionId === conn.requisitionId}
                    className="btn-disconnect flex items-center justify-center gap-1.5 text-xs text-danger"
                    title="Desconectar cuenta bancaria"
                  >
                    {disconnectingRequisitionId === conn.requisitionId ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    Desvincular
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .bank-connect-card, .connected-banks-card {
          background: rgba(255, 255, 255, 0.46);
          backdrop-filter: saturate(165%) blur(20px);
          -webkit-backdrop-filter: saturate(165%) blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.52);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
          border-radius: 20px;
        }
        .icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .select-placeholder {
          height: 42px;
          border: 1px solid var(--color-border);
          background: var(--color-bg-card);
          border-radius: 12px;
          display: flex;
          align-items: center;
          padding: 0 14px;
          color: var(--color-text-muted);
          font-size: 0.9375rem;
        }
        .alert-box {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 14px;
          font-size: 0.9rem;
          line-height: 1.4;
          font-weight: 500;
        }
        .alert-box-error {
          background: rgba(225, 29, 72, 0.1);
          border: 1px solid rgba(225, 29, 72, 0.2);
          color: var(--color-danger);
        }
        .alert-box-success {
          background: rgba(5, 150, 105, 0.1);
          border: 1px solid rgba(5, 150, 105, 0.2);
          color: var(--color-success);
        }
        .btn-sync {
          background: transparent;
          border: none;
          color: var(--color-accent-light);
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .btn-sync:hover {
          opacity: 0.8;
        }
        .bank-item {
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.7);
        }
        .bank-logo-placeholder {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #1d1d1f 0%, #636366 100%);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1rem;
        }
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
        .dot-active {
          background-color: var(--color-success);
          box-shadow: 0 0 8px var(--color-success);
        }
        .btn-disconnect {
          background: transparent;
          border: 1px solid rgba(225, 29, 72, 0.15);
          padding: 8px 14px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          transition: background-color 0.2s, border-color 0.2s;
        }
        .btn-disconnect:hover:not(:disabled) {
          background-color: rgba(225, 29, 72, 0.08);
          border-color: rgba(225, 29, 72, 0.35);
        }
        .btn-disconnect:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        /* Callback Overlay */
        .callback-overlay {
          position: fixed;
          inset: 0;
          z-index: 99999;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .callback-content {
          text-align: center;
          max-width: 420px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .callback-title {
          font-family: 'Poppins', sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-text);
        }
        .callback-text {
          color: var(--color-text-muted);
          font-size: 0.95rem;
          line-height: 1.5;
        }
      `}</style>
    </div>
  )
}
