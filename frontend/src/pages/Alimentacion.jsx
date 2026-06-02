import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'

const MEALS = [
  { key: 'desayuno', label: 'Desayuno', icon: '🌅' },
  { key: 'comida', label: 'Comida', icon: '☀️' },
  { key: 'cena', label: 'Cena', icon: '🌙' },
]

function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function weekRangeMonday() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(12, 0, 0, 0)
  const from = monday.toISOString().slice(0, 10)
  const to = addDays(from, 6)
  return { from, to }
}

/** Lunes de la semana ISO que contiene la fecha local (YYYY-MM-DD). */
function mondayOfWeekContaining(isoDate) {
  const d = new Date(isoDate + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return monday.toISOString().slice(0, 10)
}

function formatRangoSemanaLabel(fromIso, toIso) {
  const a = new Date(fromIso + 'T12:00:00')
  const b = new Date(toIso + 'T12:00:00')
  const o1 = { day: 'numeric', month: 'short' }
  const o2 = { day: 'numeric', month: 'short', year: 'numeric' }
  if (a.getFullYear() === b.getFullYear()) {
    return `${a.toLocaleDateString('es-ES', o1)} – ${b.toLocaleDateString('es-ES', o2)}`
  }
  return `${a.toLocaleDateString('es-ES', o2)} – ${b.toLocaleDateString('es-ES', o2)}`
}

/** Lunes del número de semana ISO (valor de `<input type="week">`, ej. 2026-W03). */
function isoWeekStringToMonday(isoWeekStr) {
  const m = /^(\d{4})-W(\d{2})$/.exec(isoWeekStr)
  if (!m) return null
  const isoYear = parseInt(m[1], 10)
  const week = parseInt(m[2], 10)
  if (week < 1 || week > 53) return null
  const jan4 = new Date(isoYear, 0, 4, 12, 0, 0)
  const jd = jan4.getDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - (jd - 1))
  const monday = new Date(week1Monday)
  monday.setDate(week1Monday.getDate() + (week - 1) * 7)
  return monday.toISOString().slice(0, 10)
}

/** Valor ISO para `<input type="week">` a partir del lunes de esa semana. */
function mondayToIsoWeekString(mondayIso) {
  const date = new Date(mondayIso + 'T12:00:00')
  const thursday = new Date(date)
  thursday.setDate(date.getDate() + 3)
  const isoYear = thursday.getFullYear()
  const jan4 = new Date(isoYear, 0, 4, 12, 0, 0)
  const jd = jan4.getDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - (jd - 1))
  const diff = Math.round((date.getTime() - week1Monday.getTime()) / 86400000)
  const week = 1 + Math.floor(diff / 7)
  if (week < 1 || week > 53) return `${isoYear}-W01`
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

export default function Alimentacion() {
  const { user } = useAuth()
  const location = useLocation()
  const userId = user?.id
  const { from: defaultFrom, to: defaultTo } = useMemo(() => weekRangeMonday(), [])
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [menus, setMenus] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generando, setGenerando] = useState(false)
  const [aiGroq, setAiGroq] = useState(false)
  const [preferenciasIA, setPreferenciasIA] = useState('')
  const [generandoIA, setGenerandoIA] = useState(false)
  const [generandoIADiario, setGenerandoIADiario] = useState(false)
  const [fechaMenuDiarioIA, setFechaMenuDiarioIA] = useState(() => new Date().toISOString().slice(0, 10))
  const [generandoListaMenu, setGenerandoListaMenu] = useState(false)
  const [mensajeListaOk, setMensajeListaOk] = useState('')

  const [editForm, setEditForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    momento: 'comida',
    plato: '',
    notas: '',
  })

  const loadMenus = useCallback(
    async (rangeOverride) => {
      if (!userId) return
      const f = rangeOverride?.from ?? from
      const t = rangeOverride?.to ?? to
      const qs = new URLSearchParams({ userId: String(userId), from: f, to: t })
      const res = await fetch(`/api/alimentacion/menu?${qs}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error menú')
      setMenus(data.menus || [])
    },
    [userId, from, to]
  )

  const loadAll = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError('')
    try {
      await loadMenus()
    } catch (e) {
      setError(e.message || 'Error de red')
    } finally {
      setLoading(false)
    }
  }, [userId, loadMenus])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => r.json())
      .then((d) => setAiGroq(!!d.groq))
      .catch(() => setAiGroq(false))
  }, [])

  useEffect(() => {
    if (!location.state?.focusIa) return
    requestAnimationFrame(() => {
      document.getElementById('section-menu-ia')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [location.state])

  const menusPorDia = useMemo(() => {
    const map = {}
    for (const m of menus) {
      if (!map[m.fecha]) map[m.fecha] = {}
      map[m.fecha][m.momento] = m
    }
    return map
  }, [menus])

  const diasEnRango = useMemo(() => {
    const out = []
    let cur = from
    let guard = 0
    while (cur <= to && guard < 14) {
      out.push(cur)
      cur = addDays(cur, 1)
      guard++
    }
    return out
  }, [from, to])

  const guardarPlatoManual = async (e) => {
    e.preventDefault()
    if (!userId) return
    setError('')
    try {
      const res = await fetch('/api/alimentacion/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          fecha: editForm.fecha,
          momento: editForm.momento,
          plato: editForm.plato,
          notas: editForm.notas || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No guardado')
      setEditForm((f) => ({ ...f, plato: '', notas: '' }))
      await loadMenus()
    } catch (err) {
      setError(err.message)
    }
  }

  const generarSemana = async () => {
    if (!userId) return
    setGenerando(true)
    setError('')
    try {
      const res = await fetch('/api/alimentacion/menu/generar-semana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      const today = new Date().toISOString().slice(0, 10)
      const end = addDays(today, 6)
      setFrom(today)
      setTo(end)
      await loadMenus({ from: today, to: end })
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerando(false)
    }
  }

  const generarSemanaIA = async () => {
    if (!userId) return
    setGenerandoIA(true)
    setError('')
    try {
      const res = await fetch('/api/ai/menu-semanal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          preferencias: preferenciasIA.trim() || undefined,
          semanaInicio: from,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setFrom(data.desde)
      setTo(data.hasta)
      await loadMenus({ from: data.desde, to: data.hasta })
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerandoIA(false)
    }
  }

  const generarMenuDiarioIA = async () => {
    if (!userId || !fechaMenuDiarioIA) return
    setGenerandoIADiario(true)
    setError('')
    try {
      const res = await fetch('/api/ai/menu-diario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          fecha: fechaMenuDiarioIA,
          preferencias: preferenciasIA.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      const lunes = mondayOfWeekContaining(data.fecha)
      const domingo = addDays(lunes, 6)
      setFrom(lunes)
      setTo(domingo)
      await loadMenus({ from: lunes, to: domingo })
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerandoIADiario(false)
    }
  }

  const generarListaDesdeMenu = async () => {
    if (!userId) return
    setGenerandoListaMenu(true)
    setMensajeListaOk('')
    setError('')
    try {
      const res = await fetch('/api/alimentacion/lista/desde-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, from, to }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo generar la lista')
      const modo = data.origen === 'ia' ? 'IA' : 'aproximación desde platos'
      const u = data.unidadesAñadidas ?? data.añadidos ?? 0
      const pu = data.productosUnicos ?? 0
      let msg = `Lista de pendientes actualizada: ${pu} producto${pu === 1 ? '' : 's'}, ${u} unidades (${modo}). Total líneas en lista: ${data.totalLista}.`
      if (data.aviso) msg += ` ${data.aviso}`
      setMensajeListaOk(msg)
    } catch (e) {
      setError(e.message || 'Error de red')
    } finally {
      setGenerandoListaMenu(false)
    }
  }

  const borrarMenu = async (id) => {
    if (!userId || !confirm('¿Quitar esta comida del menú?')) return
    try {
      const res = await fetch(`/api/alimentacion/menu/${id}?userId=${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      await loadMenus()
    } catch (e) {
      setError(e.message)
    }
  }

  const aplicarSemanaLunesDomingo = (lunesIso) => {
    setFrom(lunesIso)
    setTo(addDays(lunesIso, 6))
  }

  const semanaAnterior = () => aplicarSemanaLunesDomingo(addDays(from, -7))
  const semanaSiguiente = () => aplicarSemanaLunesDomingo(addDays(from, 7))
  const irSemanaActual = () => {
    const { from: f } = weekRangeMonday()
    aplicarSemanaLunesDomingo(f)
  }

  const onIrASemanaFecha = (e) => {
    const v = e.target.value
    if (!v) return
    aplicarSemanaLunesDomingo(mondayOfWeekContaining(v))
    e.target.blur()
  }

  const onSemanaInputWeek = (e) => {
    const raw = e.target.value
    if (!raw) return
    const mon = isoWeekStringToMonday(raw)
    if (mon) aplicarSemanaLunesDomingo(mon)
  }

  const weekInputValue = useMemo(() => mondayToIsoWeekString(mondayOfWeekContaining(from)), [from])

  return (
    <DashboardLayout>
        <header className="ali-head animate-fade-in">
          <h1 className="dash-greeting">
            Alimentación — <span className="gradient-text">menú semanal</span>
          </h1>
          <p className="dash-sub">Planifica las comidas de la semana. La lista de compra está en el panel lateral.</p>
        </header>

        {error && (
          <p className="ali-error" role="alert">
            {error}
          </p>
        )}

        <section className="ali-toolbar glass animate-fade-in">
          <div className="ali-range">
            <label>
              Desde{' '}
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              Hasta{' '}
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <div className="ali-gen-stack" id="section-menu-ia">
            <button type="button" className="btn-secondary btn-gen" onClick={generarSemana} disabled={generando || !userId}>
              {generando ? 'Generando…' : 'Menú rápido (sin IA)'}
            </button>
            <div className="ali-ia-box">
              <div className="ali-ia-prefs-grid">
                <label className="ali-ia-prefs-field" htmlFor="ali-prefs-semana">
                  <span className="ali-ia-prefs-label">Preferencias → menú semanal</span>
                  <span className="ali-ia-prefs-sub">
                    Dieta, alergias, presupuesto, estilo de cocina… (se comparte con la caja de al lado).
                  </span>
                  <textarea
                    id="ali-prefs-semana"
                    className="ali-prefs"
                    rows={3}
                    placeholder="Ej. vegetariano, sin lactosa, cocina rápida…"
                    value={preferenciasIA}
                    onChange={(e) => setPreferenciasIA(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label className="ali-ia-prefs-field" htmlFor="ali-prefs-dia">
                  <span className="ali-ia-prefs-label">Preferencias → menú diario</span>
                  <span className="ali-ia-prefs-sub">
                    Es el mismo texto que la columna anterior: edítalo aquí o allí; Groq recibe el mismo
                    contenido.
                  </span>
                  <textarea
                    id="ali-prefs-dia"
                    className="ali-prefs"
                    rows={3}
                    placeholder="Ej. vegetariano, sin lactosa, cocina rápida…"
                    value={preferenciasIA}
                    onChange={(e) => setPreferenciasIA(e.target.value)}
                    autoComplete="off"
                  />
                </label>
              </div>
              <p className="ali-ia-prefs-sync-note">
                Un único criterio para ambos modos: los dos cuadros están enlazados y el texto se envía a la IA
                tanto si generas la semana como un solo día.
              </p>
              {!aiGroq && (
                <p className="ali-ia-hint">
                  Para menú con IA: añade <code>GROQ_API_KEY</code> en <code>backend/server/.env</code> (Groq).
                </p>
              )}
              <div className="ali-ia-actions-row">
                <button
                  type="button"
                  className="btn-primary btn-gen ali-ia-action-week"
                  onClick={generarSemanaIA}
                  disabled={generandoIA || generandoIADiario || !userId || !aiGroq}
                  title={
                    !aiGroq
                      ? 'Configura GROQ_API_KEY en el servidor'
                      : 'Genera la semana usando las preferencias de arriba.'
                  }
                >
                  {generandoIA ? 'Generando semana…' : 'Menú semanal con IA (Groq)'}
                </button>
                <div className="ali-ia-dia-row">
                  <label className="ali-ia-dia-label">
                    Día a generar
                    <input
                      type="date"
                      value={fechaMenuDiarioIA}
                      onChange={(e) => setFechaMenuDiarioIA(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn-secondary btn-gen ali-btn-diario"
                    onClick={generarMenuDiarioIA}
                    disabled={generandoIA || generandoIADiario || !userId || !aiGroq || !fechaMenuDiarioIA}
                    title={
                      !aiGroq
                        ? 'Configura GROQ_API_KEY en el servidor'
                        : 'Genera ese día usando las mismas preferencias.'
                    }
                  >
                    {generandoIADiario ? 'Generando día…' : 'Menú diario con IA (Groq)'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ali-form-block glass animate-fade-in">
          <h2 className="section-title">Añadir o editar una comida</h2>
          <form className="ali-form" onSubmit={guardarPlatoManual}>
            <input type="date" value={editForm.fecha} onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })} />
            <select value={editForm.momento} onChange={(e) => setEditForm({ ...editForm, momento: e.target.value })}>
              {MEALS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Plato principal"
              value={editForm.plato}
              onChange={(e) => setEditForm({ ...editForm, plato: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Notas (opcional)"
              value={editForm.notas}
              onChange={(e) => setEditForm({ ...editForm, notas: e.target.value })}
            />
            <button type="submit" className="btn-primary">
              Guardar comida
            </button>
          </form>
        </section>

        <section className="ali-week glass animate-fade-in">
          <div className="ali-week-head">
            <h2 className="section-title">Menú por días</h2>
            <div className="ali-week-picker">
              <div className="ali-week-nav">
                <button type="button" className="btn-secondary ali-week-btn" onClick={semanaAnterior}>
                  ← Semana anterior
                </button>
                <button type="button" className="btn-secondary ali-week-btn" onClick={irSemanaActual}>
                  Esta semana
                </button>
                <button type="button" className="btn-secondary ali-week-btn" onClick={semanaSiguiente}>
                  Semana siguiente →
                </button>
              </div>
              <div className="ali-week-row2">
                <label className="ali-week-field">
                  Semana (ISO)
                  <input type="week" value={weekInputValue} onChange={onSemanaInputWeek} />
                </label>
                <label className="ali-week-field">
                  Ir al día
                  <input type="date" onChange={onIrASemanaFecha} />
                </label>
              </div>
              <p className="ali-week-caption muted">
                Mostrando: <strong>{formatRangoSemanaLabel(from, to)}</strong>
              </p>
              <div className="ali-week-lista-row">
                <button
                  type="button"
                  className="btn-primary ali-week-btn"
                  onClick={generarListaDesdeMenu}
                  disabled={generandoListaMenu || !userId}
                >
                  {generandoListaMenu ? 'Generando lista…' : 'Lista de la compra desde este menú'}
                </button>
                <p className="muted ali-week-lista-hint">
                  Propone ingredientes según los platos del periodo mostrado y los añade a tu lista (sin repetir ítems que ya
                  tengas).
                </p>
              </div>
              {mensajeListaOk && (
                <p className="ali-msg-ok" role="status">
                  {mensajeListaOk}
                </p>
              )}
            </div>
          </div>
          {loading ? (
            <p className="muted">Cargando…</p>
          ) : (
            <div className="ali-days">
              {diasEnRango.map((dia) => (
                <div key={dia} className="ali-day-card">
                  <h3>
                    {new Date(dia + 'T12:00:00').toLocaleDateString('es-ES', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </h3>
                  {MEALS.map(({ key, label, icon }) => {
                    const row = menusPorDia[dia]?.[key]
                    return (
                      <div key={key} className="ali-slot">
                        <span className="ali-slot-label">
                          {icon} {label}
                        </span>
                        {row ? (
                          <div className="ali-slot-body">
                            <p>{row.plato}</p>
                            {row.notas && <small className="muted">{row.notas}</small>}
                            <button type="button" className="link-del" onClick={() => borrarMenu(row.id)}>
                              Quitar
                            </button>
                          </div>
                        ) : (
                          <span className="muted small">Sin definir</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </section>

        <style>{`
          .ali-head { margin-bottom: 20px; }
          .dash-sub { color: var(--color-text-muted); margin-top: 6px; font-size: 0.95rem; }
          .ali-error {
            color: var(--color-danger);
            padding: 12px;
            border-radius: 12px;
            background: rgba(255, 107, 107, 0.1);
            margin-bottom: 16px;
          }
          .ali-toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            align-items: flex-end;
            justify-content: space-between;
            padding: 18px 20px;
            border-radius: 16px;
            margin-bottom: 20px;
          }
          .ali-range {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
          }
          .ali-range input[type='date'] {
            margin-left: 8px;
            padding: 8px 12px;
            border-radius: 10px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-card);
            color: var(--color-text);
          }
          .btn-gen { white-space: nowrap; }
          .ali-gen-stack {
            display: flex;
            flex-direction: column;
            gap: 14px;
            align-items: stretch;
            min-width: min(100%, 340px);
          }
          .ali-ia-box {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .ali-ia-prefs-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 14px;
            align-items: stretch;
          }
          .ali-ia-prefs-sync-note {
            font-size: 0.74rem;
            line-height: 1.4;
            color: var(--color-text-muted);
            margin: 0;
          }
          .ali-ia-actions-row {
            display: flex;
            flex-wrap: wrap;
            align-items: flex-end;
            gap: 12px;
          }
          .ali-ia-action-week {
            flex: 1 1 200px;
          }
          .ali-ia-prefs-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin: 0;
            cursor: text;
          }
          .ali-ia-prefs-label {
            font-size: 0.82rem;
            font-weight: 700;
            color: var(--color-text);
          }
          .ali-ia-prefs-sub {
            font-size: 0.76rem;
            line-height: 1.4;
            color: var(--color-text-muted);
            margin: 0 0 2px;
          }
          .ali-prefs {
            width: 100%;
            padding: 10px 12px;
            border-radius: 12px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-card);
            color: var(--color-text);
            font-family: var(--font-main);
            font-size: 0.88rem;
            resize: vertical;
          }
          .ali-ia-hint {
            font-size: 0.78rem;
            color: var(--color-warning);
            margin: 0;
            line-height: 1.4;
          }
          .ali-ia-hint code {
            font-size: 0.72rem;
            background: rgba(15, 23, 42, 0.06);
            padding: 2px 6px;
            border-radius: 6px;
          }
          .ali-ia-dia-row {
            display: flex;
            flex-wrap: wrap;
            align-items: flex-end;
            gap: 12px;
            flex: 2 1 280px;
          }
          .ali-ia-dia-label {
            display: flex;
            flex-direction: column;
            gap: 6px;
            font-size: 0.78rem;
            font-weight: 600;
            color: var(--color-text-muted);
          }
          .ali-ia-dia-label input[type='date'] {
            padding: 10px 12px;
            border-radius: 12px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-card);
            color: var(--color-text);
            font-family: var(--font-main);
          }
          .ali-btn-diario {
            flex-shrink: 0;
          }
          .ali-form-block { padding: 22px; border-radius: 16px; margin-bottom: 22px; }
          .ali-form {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px;
            align-items: end;
            margin-top: 12px;
          }
          .ali-form input,
          .ali-form select {
            padding: 10px 14px;
            border-radius: 12px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-card);
            color: var(--color-text);
            font-family: var(--font-main);
          }
          .ali-week { padding: 22px; border-radius: 16px; margin-bottom: 22px; }
          .ali-week-head {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin-bottom: 16px;
          }
          .ali-week-head .section-title { margin-bottom: 0; }
          .ali-week-picker {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 16px;
            border-radius: 14px;
            border: 1px solid var(--color-border);
            background: rgba(0, 0, 0, 0.03);
          }
          .ali-week-nav {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: center;
          }
          .ali-week-btn {
            font-size: 0.82rem;
            padding: 8px 16px;
          }
          .ali-week-row2 {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            align-items: flex-end;
          }
          .ali-week-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
            font-size: 0.78rem;
            color: var(--color-text-muted);
            font-weight: 600;
          }
          .ali-week-field input[type='week'],
          .ali-week-field input[type='date'] {
            padding: 8px 12px;
            border-radius: 10px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-card);
            color: var(--color-text);
            font-family: var(--font-main);
          }
          .ali-week-caption {
            font-size: 0.88rem;
            margin: 0;
          }
          .ali-week-caption strong {
            color: var(--color-text);
            font-weight: 600;
          }
          .ali-week-lista-row {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 4px;
            padding-top: 14px;
            border-top: 1px dashed var(--color-border);
          }
          .ali-week-lista-hint {
            font-size: 0.82rem;
            line-height: 1.45;
            margin: 0;
          }
          .ali-msg-ok {
            font-size: 0.88rem;
            color: var(--color-success);
            margin: 0;
            padding: 10px 12px;
            border-radius: 10px;
            background: rgba(5, 150, 105, 0.1);
          }
          .ali-days {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: 16px;
            margin-top: 16px;
          }
          .ali-day-card {
            padding: 16px;
            border-radius: 14px;
            border: 1px solid var(--color-border);
            background: rgba(0, 0, 0, 0.035);
          }
          .ali-day-card h3 {
            font-size: 0.95rem;
            text-transform: capitalize;
            margin-bottom: 12px;
            color: var(--color-text);
          }
          .ali-slot { margin-bottom: 12px; }
          .ali-slot-label { font-size: 0.78rem; color: var(--color-text-muted); display: block; margin-bottom: 4px; }
          .ali-slot-body p { font-size: 0.9rem; margin: 0; }
          .ali-slot-body small { display: block; margin-top: 4px; }
          .link-del {
            background: none;
            border: none;
            color: var(--color-danger);
            cursor: pointer;
            font-size: 0.75rem;
            margin-top: 6px;
            padding: 0;
          }
          .small { font-size: 0.8rem; }
          .section-title { font-size: 1.05rem; font-weight: 600; }
          .muted { color: var(--color-text-muted); }
        `}</style>
    </DashboardLayout>
  )
}
