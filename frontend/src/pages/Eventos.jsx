import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import { readJsonResponse } from '../utils/readJsonResponse'

const fmt = (n) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0)

export default function Eventos() {
  const { user } = useAuth()
  const userId = user?.id
  const [eventos, setEventos] = useState([])
  const [huchas, setHuchas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [evForm, setEvForm] = useState({
    titulo: '',
    fecha_evento: new Date().toISOString().slice(0, 10),
    descripcion: '',
  })
  const [huchaForm, setHuchaForm] = useState({ nombre: '', objetivo: '' })
  const [savingEv, setSavingEv] = useState(false)
  const [savingHucha, setSavingHucha] = useState(false)
  /** Borrador por id de hucha: importe, nota y fecha para «Registrar ahorro». */
  const [aportDraft, setAportDraft] = useState({})
  const [aportSavingId, setAportSavingId] = useState(null)

  const todayIso = () => new Date().toISOString().slice(0, 10)

  const getAportDraft = (id) =>
    aportDraft[id] || { monto: '', nota: '', fecha: todayIso() }

  const setAportField = (id, field, value) => {
    setAportDraft((prev) => {
      const cur = prev[id] || { monto: '', nota: '', fecha: todayIso() }
      return { ...prev, [id]: { ...cur, [field]: value } }
    })
  }

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError('')
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/eventos?userId=${userId}`),
        fetch(`/api/finanzas/huchas?userId=${userId}`),
      ])
      const j1 = await r1.json()
      const j2 = await r2.json()
      if (!r1.ok) throw new Error(j1.error || 'Error eventos')
      if (!r2.ok) throw new Error(j2.error || 'Error huchas')
      setEventos(j1.eventos || [])
      setHuchas(j2.huchas || [])
    } catch (e) {
      setError(e.message || 'Error de red')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const crearEvento = async (e) => {
    e.preventDefault()
    if (!userId || !evForm.titulo.trim()) return
    setSavingEv(true)
    setError('')
    try {
      const res = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          titulo: evForm.titulo.trim(),
          fecha_evento: evForm.fecha_evento,
          descripcion: evForm.descripcion.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setEvForm((f) => ({
        ...f,
        titulo: '',
        descripcion: '',
      }))
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingEv(false)
    }
  }

  const eliminarEvento = async (id) => {
    if (!userId || !confirm('¿Eliminar este evento?')) return
    try {
      const res = await fetch(`/api/eventos/${id}?userId=${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const crearHucha = async (e) => {
    e.preventDefault()
    if (!userId || !huchaForm.nombre.trim()) return
    const obj = parseFloat(String(huchaForm.objetivo).replace(',', '.'))
    setSavingHucha(true)
    setError('')
    try {
      const res = await fetch('/api/finanzas/huchas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          nombre: huchaForm.nombre.trim(),
          objetivo: Number.isFinite(obj) && obj > 0 ? obj : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setHuchaForm({ nombre: '', objetivo: '' })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingHucha(false)
    }
  }

  const eliminarHucha = async (id) => {
    if (!userId || !confirm('¿Eliminar esta hucha y su historial asociado en movimientos?')) return
    try {
      const res = await fetch(`/api/finanzas/huchas/${id}?userId=${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const registrarAhorroEnHucha = async (huchaId) => {
    if (!userId) return
    const d = getAportDraft(huchaId)
    const monto = parseFloat(String(d.monto).replace(',', '.'))
    if (!Number.isFinite(monto) || monto <= 0) {
      setError('Introduce un importe mayor que cero')
      return
    }
    setError('')
    setAportSavingId(huchaId)
    try {
      const res = await fetch('/api/finanzas/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tipo: 'aportacion_hucha',
          hucha_id: parseInt(String(huchaId), 10),
          monto,
          fecha: d.fecha || todayIso(),
          descripcion: d.nota?.trim() || null,
        }),
      })
      const data = await readJsonResponse(res)
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar')
      setAportDraft((prev) => ({
        ...prev,
        [huchaId]: { monto: '', nota: '', fecha: todayIso() },
      }))
      await load()
    } catch (e) {
      setError(e.message || 'Error de red')
    } finally {
      setAportSavingId(null)
    }
  }

  return (
    <DashboardLayout>
        <header className="ev-head animate-fade-in">
          <h1 className="dash-greeting">
            Eventos — <span className="gradient-text">próximos y objetivos</span>
          </h1>
          <p className="dash-sub">
            Planifica fechas importantes y crea huchas con meta de ahorro. El dinero que aportas a cada hucha se registra
            aquí y se refleja en Finanzas como movimiento de ahorro.
          </p>
        </header>

        {error && (
          <p className="ev-error" role="alert">
            {error}
          </p>
        )}

        <section className="ev-section glass animate-fade-in">
          <h2 className="section-title">Eventos próximos</h2>
          <p className="muted ev-intro">Solo se muestran eventos con fecha de hoy en adelante.</p>

          <form className="ev-form" onSubmit={crearEvento}>
            <input
              type="text"
              placeholder="Título (ej. Boda de Ana)"
              value={evForm.titulo}
              onChange={(e) => setEvForm({ ...evForm, titulo: e.target.value })}
              required
            />
            <label className="ev-label-inline">
              Fecha
              <input
                type="date"
                value={evForm.fecha_evento}
                onChange={(e) => setEvForm({ ...evForm, fecha_evento: e.target.value })}
                required
              />
            </label>
            <input
              type="text"
              placeholder="Detalle (opcional)"
              value={evForm.descripcion}
              onChange={(e) => setEvForm({ ...evForm, descripcion: e.target.value })}
            />
            <button type="submit" className="btn-primary" disabled={savingEv || !userId}>
              {savingEv ? 'Guardando…' : 'Crear evento'}
            </button>
          </form>

          {loading ? (
            <p className="muted">Cargando…</p>
          ) : eventos.length === 0 ? (
            <p className="muted ev-empty">No hay eventos próximos. Añade el primero arriba.</p>
          ) : (
            <ul className="ev-list">
              {eventos.map((ev) => (
                <li key={ev.id} className="ev-card">
                  <div>
                    <p className="ev-card-title">{ev.titulo}</p>
                    <p className="ev-card-date">
                      {new Date(ev.fecha_evento + 'T12:00:00').toLocaleDateString('es-ES', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    {ev.descripcion && <p className="muted ev-card-desc">{ev.descripcion}</p>}
                  </div>
                  <button type="button" className="btn-del-ev" onClick={() => eliminarEvento(ev.id)}>
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ev-section glass animate-fade-in">
          <h2 className="section-title">Objetivos de ahorro (huchas)</h2>
          <p className="muted ev-intro">
            Define un nombre y, si quieres, la meta en euros. Usa «Registrar ahorro» en cada hucha: el importe queda en la
            hucha y en Finanzas verás el movimiento como «Ahorro (hucha)».
          </p>

          <form className="ev-form ev-form-hucha" onSubmit={crearHucha}>
            <input
              type="text"
              placeholder="Nombre del objetivo (ej. Boda de amigo)"
              value={huchaForm.nombre}
              onChange={(e) => setHuchaForm({ ...huchaForm, nombre: e.target.value })}
              required
            />
            <input
              type="text"
              inputMode="decimal"
              placeholder="Meta en € (opcional, ej. 500)"
              value={huchaForm.objetivo}
              onChange={(e) => setHuchaForm({ ...huchaForm, objetivo: e.target.value })}
            />
            <button type="submit" className="btn-secondary" disabled={savingHucha || !userId}>
              {savingHucha ? 'Creando…' : 'Crear hucha'}
            </button>
          </form>

          {huchas.length > 0 && (
            <ul className="ev-huchas">
              {huchas.map((h) => {
                const meta = h.objetivo != null ? Number(h.objetivo) : null
                const saldo = Number(h.saldo) || 0
                const pct = meta && meta > 0 ? Math.min(100, Math.round((saldo / meta) * 100)) : null
                const draft = getAportDraft(h.id)
                return (
                  <li key={h.id} className="ev-hucha-card">
                    <div className="ev-hucha-top">
                      <span className="ev-hucha-name">{h.nombre}</span>
                      <button type="button" className="btn-del-ev" onClick={() => eliminarHucha(h.id)}>
                        Eliminar
                      </button>
                    </div>
                    <div className="ev-hucha-aport">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="ev-aport-monto"
                        placeholder="€"
                        aria-label={`Importe a ahorrar en ${h.nombre}`}
                        value={draft.monto}
                        onChange={(e) => setAportField(h.id, 'monto', e.target.value)}
                      />
                      <input
                        type="text"
                        className="ev-aport-nota"
                        placeholder="Nota (opcional)"
                        value={draft.nota}
                        onChange={(e) => setAportField(h.id, 'nota', e.target.value)}
                      />
                      <input
                        type="date"
                        className="ev-aport-fecha"
                        aria-label="Fecha del ahorro"
                        value={draft.fecha}
                        onChange={(e) => setAportField(h.id, 'fecha', e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-primary ev-aport-btn"
                        disabled={aportSavingId === h.id || !userId}
                        onClick={() => registrarAhorroEnHucha(h.id)}
                      >
                        {aportSavingId === h.id ? 'Guardando…' : 'Registrar ahorro'}
                      </button>
                    </div>
                    <p className="ev-hucha-saldo">
                      Ahorrado: <strong>{fmt(saldo)}</strong>
                      {meta != null && Number.isFinite(meta) && (
                        <>
                          {' '}
                          / objetivo {fmt(meta)}
                        </>
                      )}
                    </p>
                    {pct != null && (
                      <div className="ev-hucha-bar">
                        <div className="ev-hucha-fill" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <style>{`
          .ev-head { margin-bottom: 24px; }
          .dash-sub { color: var(--color-text-muted); margin-top: 8px; font-size: 0.95rem; max-width: 560px; line-height: 1.5; }
          .ev-link { color: var(--color-accent-light); text-decoration: none; font-weight: 600; }
          .ev-link:hover { text-decoration: underline; }
          .ev-error {
            color: var(--color-danger);
            padding: 12px 14px;
            border-radius: 12px;
            background: rgba(255, 107, 107, 0.1);
            margin-bottom: 16px;
          }
          .ev-section {
            padding: 24px;
            border-radius: 16px;
            margin-bottom: 22px;
            max-width: 720px;
          }
          .section-title { font-size: 1.05rem; font-weight: 600; margin-bottom: 8px; }
          .ev-intro { font-size: 0.88rem; margin-bottom: 18px; line-height: 1.45; }
          .ev-form {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 12px;
            align-items: end;
            margin-bottom: 22px;
          }
          .ev-form-hucha {
            align-items: end;
          }
          .ev-form input[type='text'],
          .ev-form input:not([type]) {
            padding: 10px 14px;
            border-radius: 12px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-card);
            color: var(--color-text);
            font-family: var(--font-main);
          }
          .ev-label-inline {
            display: flex;
            flex-direction: column;
            gap: 6px;
            font-size: 0.78rem;
            font-weight: 600;
            color: var(--color-text-muted);
          }
          .ev-label-inline input {
            padding: 10px 14px;
            border-radius: 12px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-card);
            color: var(--color-text);
            font-family: var(--font-main);
          }
          .ev-empty { margin-top: 8px; }
          .ev-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .ev-card {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            padding: 16px;
            border-radius: 14px;
            border: 1px solid var(--color-border);
            background: rgba(0, 0, 0, 0.035);
          }
          .ev-card-title { font-weight: 700; margin: 0 0 6px; font-size: 1rem; }
          .ev-card-date {
            margin: 0;
            font-size: 0.88rem;
            color: var(--color-text-muted);
            text-transform: capitalize;
          }
          .ev-card-desc { margin: 8px 0 0; font-size: 0.88rem; }
          .btn-del-ev {
            background: transparent;
            border: 1px solid var(--color-border);
            color: var(--color-danger);
            font-size: 0.8rem;
            padding: 8px 12px;
            border-radius: 10px;
            cursor: pointer;
            flex-shrink: 0;
            font-family: var(--font-main);
          }
          .btn-del-ev:hover {
            border-color: var(--color-danger);
            background: rgba(225, 29, 72, 0.08);
          }
          .ev-huchas {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .ev-hucha-card {
            padding: 16px;
            border-radius: 14px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-card);
          }
          .ev-hucha-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 10px;
          }
          .ev-hucha-name { font-weight: 700; font-size: 0.95rem; }
          .ev-hucha-aport {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: center;
            margin-bottom: 12px;
            padding: 12px;
            border-radius: 12px;
            background: rgba(0, 0, 0, 0.04);
            border: 1px dashed var(--color-border);
          }
          .ev-aport-monto {
            width: 88px;
            padding: 8px 10px;
            border-radius: 10px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-card);
            color: var(--color-text);
            font-family: var(--font-main);
          }
          .ev-aport-nota {
            flex: 1;
            min-width: 140px;
            padding: 8px 10px;
            border-radius: 10px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-card);
            color: var(--color-text);
            font-family: var(--font-main);
            font-size: 0.88rem;
          }
          .ev-aport-fecha {
            padding: 8px 10px;
            border-radius: 10px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-card);
            color: var(--color-text);
            font-family: var(--font-main);
          }
          .ev-aport-btn {
            padding: 8px 14px;
            font-size: 0.85rem;
            white-space: nowrap;
          }
          .ev-hucha-saldo { margin: 0 0 10px; font-size: 0.9rem; color: var(--color-text-muted); }
          .ev-hucha-saldo strong { color: var(--color-text); }
          .ev-hucha-bar {
            height: 8px;
            border-radius: 6px;
            background: rgba(15, 23, 42, 0.08);
            overflow: hidden;
          }
          .ev-hucha-fill {
            height: 100%;
            border-radius: 6px;
            background: linear-gradient(90deg, var(--color-primary), var(--color-primary-light));
            transition: width 0.4s ease;
          }
          .muted { color: var(--color-text-muted); }
        `}</style>
    </DashboardLayout>
  )
}
