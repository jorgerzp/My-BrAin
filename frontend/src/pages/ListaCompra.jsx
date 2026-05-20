import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function etiquetaItemLista(it) {
  const n = Number(it.cantidad) || 1
  const base = it.item || ''
  return n > 1 ? `${base} x${n}` : base
}

export default function ListaCompra() {
  const { user } = useAuth()
  const userId = user?.id
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nuevoItem, setNuevoItem] = useState('')
  const [generandoDesdeMenu, setGenerandoDesdeMenu] = useState(false)
  const [mensajeOk, setMensajeOk] = useState('')

  const loadLista = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/alimentacion/lista?userId=${userId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al cargar la lista')
      setLista(data.items || [])
    } catch (e) {
      setError(e.message || 'Error de red')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadLista()
  }, [loadLista])

  const addLista = async (e) => {
    e.preventDefault()
    if (!userId || !nuevoItem.trim()) return
    setError('')
    try {
      const res = await fetch('/api/alimentacion/lista', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, item: nuevoItem.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setNuevoItem('')
      await loadLista()
    } catch (e) {
      setError(e.message)
    }
  }

  const toggleLista = async (id, comprado) => {
    if (!userId) return
    try {
      const res = await fetch(`/api/alimentacion/lista/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, comprado: !comprado }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      await loadLista()
    } catch (e) {
      setError(e.message)
    }
  }

  const delLista = async (id) => {
    if (!userId) return
    try {
      const res = await fetch(`/api/alimentacion/lista/${id}?userId=${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      await loadLista()
    } catch (e) {
      setError(e.message)
    }
  }

  const generarDesdeMenuSemanaActual = async () => {
    if (!userId) return
    setGenerandoDesdeMenu(true)
    setError('')
    setMensajeOk('')
    try {
      const res = await fetch('/api/alimentacion/lista/desde-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo generar la lista')
      const modo = data.origen === 'ia' ? 'IA' : 'texto del menú'
      const u = data.unidadesAñadidas ?? data.añadidos ?? 0
      const pu = data.productosUnicos ?? 0
      let msg = `Pendientes regenerados: ${pu} producto${pu === 1 ? '' : 's'}, ${u} unidades (${modo}).`
      if (data.aviso) msg += ` ${data.aviso}`
      setMensajeOk(msg)
      await loadLista()
    } catch (e) {
      setError(e.message || 'Error de red')
    } finally {
      setGenerandoDesdeMenu(false)
    }
  }

  const pendientes = lista.filter((it) => !it.comprado)
  const hechos = lista.filter((it) => it.comprado)

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <header className="lc-head animate-fade-in">
          <h1 className="dash-greeting">
            Lista de la compra — <span className="gradient-text">todo en un vistazo</span>
          </h1>
          <p className="dash-sub">
            Los <strong>pendientes</strong> se alinean solos con el <strong>menú de la semana actual</strong> (lunes a
            domingo) al cargar esta página: se regeneran desde los platos (sin tocar lo ya comprado). Cada producto es
            único (duplicados se unen sumando unidades) y va en <strong>orden alfabético</strong>. Para más cantidad usa
            «Huevos x6» o el mismo nombre otra vez.
          </p>
        </header>

        {error && (
          <p className="lc-error" role="alert">
            {error}
          </p>
        )}
        {mensajeOk && (
          <p className="lc-ok" role="status">
            {mensajeOk}
          </p>
        )}

        <section className="lc-from-menu glass animate-fade-in">
          <h2 className="lc-section-title">Menú e IA</h2>
          <p className="muted lc-hint">
            La lista de pendientes ya sigue el menú de esta semana al entrar aquí. Este botón <strong>vuelve a generar
            los pendientes</strong> con IA si el servidor tiene <code>GROQ_API_KEY</code>; si no, usa el mismo troceado
            de platos que al cargar. En Alimentación puedes elegir otra semana y el botón «Lista desde menú» usa ese
            rango.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={generarDesdeMenuSemanaActual}
            disabled={!userId || generandoDesdeMenu}
          >
            {generandoDesdeMenu ? 'Actualizando…' : 'Regenerar pendientes desde el menú (esta semana)'}
          </button>
        </section>

        <section className="lc-card glass animate-fade-in">
          <form className="lc-add" onSubmit={addLista}>
            <input
              type="text"
              placeholder="Producto (ej. Leche o Huevos x6)"
              value={nuevoItem}
              onChange={(e) => setNuevoItem(e.target.value)}
              autoComplete="off"
            />
            <button type="submit" className="btn-primary" disabled={!userId}>
              Añadir
            </button>
          </form>

          {loading ? (
            <p className="muted lc-muted">Cargando…</p>
          ) : lista.length === 0 ? (
            <p className="muted lc-muted">Lista vacía. Empieza añadiendo productos arriba.</p>
          ) : (
            <>
              {pendientes.length > 0 && (
                <>
                  <h2 className="lc-section-title">Por comprar ({pendientes.length})</h2>
                  <ul className="lc-ul">
                    {pendientes.map((it) => (
                      <li key={it.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => toggleLista(it.id, it.comprado)}
                          />
                          <span>{etiquetaItemLista(it)}</span>
                        </label>
                        <button type="button" className="lc-del" onClick={() => delLista(it.id)} aria-label="Quitar">
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {hechos.length > 0 && (
                <>
                  <h2 className="lc-section-title lc-done-title">En la despensa ({hechos.length})</h2>
                  <ul className="lc-ul lc-ul-done">
                    {hechos.map((it) => (
                      <li key={it.id} className="done">
                        <label>
                          <input
                            type="checkbox"
                            checked
                            onChange={() => toggleLista(it.id, it.comprado)}
                          />
                          <span>{etiquetaItemLista(it)}</span>
                        </label>
                        <button type="button" className="lc-del" onClick={() => delLista(it.id)} aria-label="Quitar">
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>

        <style>{`
          .lc-head { margin-bottom: 24px; }
          .dash-sub { color: var(--color-text-muted); margin-top: 8px; font-size: 0.95rem; }
          .lc-error {
            color: var(--color-danger);
            padding: 12px 14px;
            border-radius: 12px;
            background: rgba(255, 107, 107, 0.1);
            margin-bottom: 16px;
          }
          .lc-ok {
            color: var(--color-success);
            padding: 12px 14px;
            border-radius: 12px;
            background: rgba(5, 150, 105, 0.1);
            margin-bottom: 16px;
            font-size: 0.92rem;
          }
          .lc-from-menu {
            padding: 20px 22px;
            border-radius: 18px;
            max-width: min(1100px, 100%);
            margin-bottom: 20px;
          }
          .lc-from-menu .lc-section-title {
            margin-bottom: 8px;
          }
          .lc-hint {
            font-size: 0.88rem;
            line-height: 1.45;
            margin-bottom: 14px;
          }
          .lc-from-menu .btn-primary {
            width: fit-content;
          }
          .lc-card {
            padding: 28px;
            border-radius: 18px;
            max-width: min(1200px, 100%);
            width: 100%;
            box-sizing: border-box;
          }
          .lc-add {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 28px;
          }
          .lc-add input {
            flex: 1;
            min-width: 220px;
            padding: 12px 16px;
            border-radius: 12px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-card);
            color: var(--color-text);
            font-family: var(--font-main);
            font-size: 1rem;
          }
          .lc-muted { margin-top: 8px; }
          .lc-section-title {
            font-size: 0.85rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--color-primary-light);
            margin-bottom: 12px;
          }
          .lc-done-title {
            margin-top: 28px;
            color: var(--color-text-muted);
          }
          .lc-ul {
            list-style: none;
            padding: 0;
            margin: 0 0 8px;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            column-gap: 20px;
            row-gap: 0;
            align-items: start;
          }
          .lc-ul li {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 6px;
            border-bottom: 1px solid var(--color-border);
            gap: 12px;
            min-width: 0;
          }
          .lc-ul li.done span {
            text-decoration: line-through;
            opacity: 0.55;
          }
          .lc-ul label {
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            flex: 1;
            min-width: 0;
          }
          .lc-ul label span {
            word-break: break-word;
          }
          .lc-del {
            background: transparent;
            border: none;
            color: var(--color-danger);
            cursor: pointer;
            font-size: 1rem;
            padding: 6px 10px;
            border-radius: 8px;
            flex-shrink: 0;
          }
          .lc-del:hover {
            background: rgba(255, 107, 107, 0.12);
          }
          .muted { color: var(--color-text-muted); }
        `}</style>
      </main>
    </div>
  )
}
