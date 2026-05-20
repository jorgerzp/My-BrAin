import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import { readJsonResponse } from '../utils/readJsonResponse'
import { CATEGORIAS_GASTO, CATEGORIAS_INGRESO } from '../constants/categoriasGasto.js'
import { AppSelectCollapsible } from '@/components/ui/app-select-collapsible'

const TIPOS_MOVIMIENTO = [
  { value: 'gasto', label: 'Gasto' },
  { value: 'ingreso', label: 'Ingreso' },
]

const fmt = (n) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

function fmtFechaMovimiento(fechaStr) {
  if (!fechaStr) return '—'
  const day = String(fechaStr).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return String(fechaStr)
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function monthNow() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export default function Finanzas() {
  const { user } = useAuth()
  const location = useLocation()
  const userId = user?.id
  const [year, setYear] = useState(() => monthNow().year)
  const [month, setMonth] = useState(() => monthNow().month)
  const [resumen, setResumen] = useState({
    ingresos: 0,
    gastos: 0,
    ahorro_aportado: 0,
    balance: 0,
  })
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    tipo: 'gasto',
    monto: '',
    categoria: '',
    descripcion: '',
    fecha: new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [catLoading, setCatLoading] = useState(false)
  const [catError, setCatError] = useState('')
  const [catData, setCatData] = useState(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ userId: String(userId), year: String(year), month: String(month) })
      const [r1, r2] = await Promise.all([
        fetch(`/api/finanzas/resumen?${qs}`),
        fetch(`/api/finanzas/movimientos?${qs}`),
      ])
      const [j1, j2] = await Promise.all([readJsonResponse(r1), readJsonResponse(r2)])
      if (!r1.ok) throw new Error(j1.error || 'Error resumen')
      if (!r2.ok) throw new Error(j2.error || 'Error movimientos')
      setResumen({
        ingresos: Number(j1.ingresos ?? 0),
        gastos: Number(j1.gastos ?? 0),
        ahorro_aportado: Number(j1.ahorro_aportado ?? 0),
        balance: Number(j1.balance ?? 0),
      })
      setMovimientos(j2.movimientos || [])
    } catch (e) {
      setError(e.message || 'Error de red')
    } finally {
      setLoading(false)
    }
  }, [userId, year, month])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const tipo = location.state?.prefillTipo
    if (tipo === 'ingreso' || tipo === 'gasto') {
      setForm((f) => ({ ...f, tipo }))
    }
  }, [location.state])

  const abrirGastosPorCategoria = useCallback(async () => {
    if (!userId) return
    setCatModalOpen(true)
    setCatLoading(true)
    setCatError('')
    setCatData(null)
    try {
      const qs = new URLSearchParams({
        userId: String(userId),
        year: String(year),
        month: String(month),
      })
      const res = await fetch(`/api/finanzas/gastos-por-categoria?${qs}`)
      const data = await readJsonResponse(res)
      if (!res.ok) throw new Error(data.error || 'Error al cargar el desglose')
      setCatData(data)
    } catch (e) {
      setCatError(e.message || 'Error de red')
    } finally {
      setCatLoading(false)
    }
  }, [userId, year, month])

  const cerrarCatModal = useCallback(() => {
    setCatModalOpen(false)
    setCatData(null)
    setCatError('')
  }, [])

  useEffect(() => {
    if (!catModalOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') cerrarCatModal()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [catModalOpen, cerrarCatModal])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!userId) return
    const monto = parseFloat(String(form.monto).replace(',', '.'))
    if (!Number.isFinite(monto) || monto <= 0) {
      setError('Introduce un importe válido')
      return
    }
    if (form.tipo === 'gasto' && !form.categoria) {
      setError('Elige una categoría para el gasto')
      return
    }
    if (form.tipo === 'ingreso' && !form.categoria) {
      setError('Elige una categoría para el ingreso')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        userId,
        tipo: form.tipo,
        monto,
        categoria: form.categoria || null,
        descripcion: form.descripcion || null,
        fecha: form.fecha,
      }
      const res = await fetch('/api/finanzas/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await readJsonResponse(res)
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      setForm((f) => ({
        ...f,
        monto: '',
        categoria: '',
        descripcion: '',
      }))
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const eliminar = async (id) => {
    if (!userId || !confirm('¿Eliminar este movimiento?')) return
    try {
      const res = await fetch(`/api/finanzas/movimientos/${id}?userId=${userId}`, { method: 'DELETE' })
      const data = await readJsonResponse(res)
      if (!res.ok) throw new Error(data.error || 'Error')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const maxBar = Math.max(resumen.ingresos, resumen.gastos, 1)
  const pctIng = (resumen.ingresos / maxBar) * 100
  const pctGas = (resumen.gastos / maxBar) * 100

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <header className="page-head animate-fade-in">
          <h1 className="dash-greeting">
            Finanzas — <span className="gradient-text">control mensual</span>
          </h1>
          <p className="dash-sub">Ingresos y gastos vinculados a tu cuenta.</p>
        </header>

        <div className="fin-toolbar glass animate-fade-in">
          <label>
            Mes{' '}
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleString('es-ES', { month: 'long' })}
                </option>
              ))}
            </select>
          </label>
          <label>
            Año{' '}
            <input
              type="number"
              min={2020}
              max={2035}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
        </div>

        {error && (
          <p className="fin-error" role="alert">
            {error}
          </p>
        )}

        <section className="stats-grid animate-fade-in">
          <div className="stat-card glass">
            <div className="stat-icon">📈</div>
            <div className="stat-info">
              <p className="stat-label">Ingresos del mes</p>
              <p className="stat-value">{loading ? '…' : fmt(resumen.ingresos)}</p>
            </div>
          </div>
          <div className="stat-card glass">
            <div className="stat-icon">📉</div>
            <div className="stat-info">
              <p className="stat-label">Gastos del mes</p>
              <p className="stat-value">{loading ? '…' : fmt(resumen.gastos)}</p>
            </div>
          </div>
          <div className="stat-card glass">
            <div className="stat-icon">🏺</div>
            <div className="stat-info">
              <p className="stat-label">Ahorro en huchas (mes)</p>
              <p className="stat-value">{loading ? '…' : fmt(resumen.ahorro_aportado ?? 0)}</p>
            </div>
          </div>
          <div className="stat-card glass">
            <div className="stat-icon">⚖️</div>
            <div className="stat-info">
              <p className="stat-label">Balance</p>
              <p className={`stat-value ${resumen.balance >= 0 ? 'text-pos' : 'text-neg'}`}>
                {loading ? '…' : fmt(resumen.balance)}
              </p>
            </div>
          </div>
        </section>

        <section className="fin-chart glass animate-fade-in">
          <h2 className="section-title">Resumen visual</h2>
          <div className="fin-bars">
            <div>
              <span>Ingresos</span>
              <div className="fin-bar-track">
                <div className="fin-bar ing" style={{ width: `${pctIng}%` }} />
              </div>
            </div>
            <div>
              <span>Gastos</span>
              <div className="fin-bar-track">
                <div className="fin-bar gas" style={{ width: `${pctGas}%` }} />
              </div>
            </div>
          </div>
        </section>

        <section className="fin-form-section glass animate-fade-in">
          <h2 className="section-title">Registrar movimiento</h2>
          <form className="fin-form" onSubmit={handleSubmit}>
            <AppSelectCollapsible
              id="fin-tipo"
              value={form.tipo}
              onChange={(tipo) =>
                setForm({
                  ...form,
                  tipo,
                  categoria: '',
                })
              }
              options={TIPOS_MOVIMIENTO}
              ariaLabel="Tipo de movimiento: gasto o ingreso"
            />
            <input
              type="text"
              inputMode="decimal"
              placeholder="Importe (€)"
              value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })}
              required
            />
            <AppSelectCollapsible
              key={form.tipo}
              id="fin-categoria"
              value={form.categoria}
              onChange={(categoria) => setForm({ ...form, categoria })}
              options={form.tipo === 'gasto' ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO}
              placeholder="— Categoría —"
              ariaLabel={
                form.tipo === 'gasto' ? 'Categoría del gasto' : 'Categoría del ingreso'
              }
            />
            <input
              type="date"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Descripción"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
            <button type="submit" className="btn-primary" disabled={saving || !userId}>
              {saving ? 'Guardando…' : 'Añadir'}
            </button>
          </form>
          <p className="muted fin-hucha-hint">
            Las huchas y el dinero que aportas a ellas se gestionan en <Link to="/eventos">Eventos</Link>; aquí verás
            esos movimientos como «Ahorro (hucha)».
          </p>
        </section>

        <section className="fin-table-wrap glass animate-fade-in">
          <h2 className="section-title">Movimientos del mes</h2>
          {loading ? (
            <p className="muted">Cargando…</p>
          ) : movimientos.length === 0 ? (
            <p className="muted">No hay movimientos este mes. Añade el primero arriba.</p>
          ) : (
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Importe</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id}>
                    <td title={String(m.fecha || '').slice(0, 10)}>{fmtFechaMovimiento(m.fecha)}</td>
                    <td>
                      {m.tipo === 'ingreso'
                        ? 'Ingreso'
                        : m.tipo === 'aportacion_hucha'
                          ? 'Ahorro (hucha)'
                          : 'Gasto'}
                    </td>
                    <td
                      className={
                        m.tipo === 'ingreso' ? 'text-pos' : m.tipo === 'aportacion_hucha' ? 'text-pos' : 'text-neg'
                      }
                    >
                      {fmt(Number(m.monto))}
                    </td>
                    <td>{m.categoria || '—'}</td>
                    <td>{m.descripcion || '—'}</td>
                    <td>
                      <button type="button" className="btn-del" onClick={() => eliminar(m.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="fin-cat-section glass animate-fade-in">
          <div className="fin-cat-head">
            <div>
              <h2 className="section-title">Gastos por categoría</h2>
              <p className="muted fin-cat-desc">
                Desglose del mes seleccionado: incluye gastos <strong>manuales</strong> y los registrados desde{' '}
                <strong>tickets</strong> (escáner o texto con IA).
              </p>
            </div>
            <button
              type="button"
              className="btn-primary fin-cat-open-btn"
              disabled={!userId}
              onClick={abrirGastosPorCategoria}
            >
              Ver gastos detallados por categorías
            </button>
          </div>
        </section>

        {catModalOpen && (
          <div className="fin-cat-overlay" role="presentation" onClick={cerrarCatModal}>
            <div
              className="fin-cat-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="fin-cat-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="fin-cat-modal-toolbar">
                <div className="fin-cat-modal-headtext">
                  <h2 id="fin-cat-modal-title" className="fin-cat-modal-title">
                    Gastos por categoría
                  </h2>
                  <p className="fin-cat-modal-sub">
                    {new Date(year, month - 1, 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="fin-cat-modal-actions">
                  {catData && typeof catData.totalMes === 'number' && (
                    <span className="fin-cat-total-pill">
                      <span className="fin-cat-total-pill-label">Total mes</span>
                      <span className="fin-cat-total-pill-value">{fmt(catData.totalMes)}</span>
                    </span>
                  )}
                  <button type="button" className="fin-cat-close" onClick={cerrarCatModal} aria-label="Cerrar">
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              </div>
              <div className="fin-cat-modal-body">
                {catLoading && <p className="muted">Cargando…</p>}
                {catError && (
                  <p className="fin-error" role="alert">
                    {catError}
                  </p>
                )}
                {!catLoading && catData && catData.grupos?.length === 0 && (
                  <p className="muted">No hay gastos registrados en este mes.</p>
                )}
                {!catLoading &&
                  catData?.grupos?.map((g, gi) => (
                    <div key={g.categoria} className={`fin-cat-grupo fin-tone-${gi % 7}`}>
                      <div className="fin-cat-grupo-head">
                        <h3 className="fin-cat-grupo-title">{g.categoria}</h3>
                        <span className="fin-cat-grupo-total">{fmt(g.total)}</span>
                      </div>
                      <div className="fin-cat-table-scroll">
                        <table className="fin-cat-table">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Importe</th>
                            <th>Descripción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.lineas.map((ln) => (
                            <tr key={ln.id}>
                              <td title={String(ln.fecha || '').slice(0, 10)}>{fmtFechaMovimiento(ln.fecha)}</td>
                              <td className="text-neg">{fmt(ln.monto)}</td>
                              <td>{ln.descripcion || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        <style>{`
          .dashboard-main section.glass {
            background: rgba(255, 252, 248, 0.82);
            backdrop-filter: saturate(140%) blur(18px);
            -webkit-backdrop-filter: saturate(140%) blur(18px);
            border: 1px solid rgba(255, 255, 255, 0.9);
            box-shadow:
              0 4px 6px rgba(45, 38, 32, 0.04),
              0 16px 48px rgba(45, 38, 32, 0.1),
              inset 0 1px 0 rgba(255, 255, 255, 0.85);
          }
          .page-head { margin-bottom: 24px; }
          .dash-sub { color: var(--color-text-muted); font-size: 0.95rem; margin-top: 6px; }
          .fin-toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            padding: 16px 20px;
            margin-bottom: 20px;
            border-radius: 16px;
            align-items: center;
          }
          .fin-toolbar select,
          .fin-toolbar input[type='number'] {
            margin-left: 8px;
            padding: 8px 12px;
            border-radius: 10px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-card);
            color: var(--color-text);
            font-family: var(--font-main);
          }
          .fin-error {
            color: var(--color-danger);
            margin-bottom: 16px;
            padding: 12px;
            border-radius: 12px;
            background: rgba(255, 107, 107, 0.1);
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
          }
          .stat-card {
            padding: 22px;
            border-radius: 18px;
            display: flex;
            gap: 14px;
            align-items: flex-start;
          }
          .stat-label {
            font-size: 0.75rem;
            color: var(--color-text-muted);
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }
          .stat-value {
            font-size: 1.35rem;
            font-weight: 700;
            margin-top: 4px;
          }
          .text-pos { color: var(--color-success); }
          .text-neg { color: var(--color-danger); }
          .fin-chart { padding: 26px; border-radius: 20px; margin-bottom: 24px; }
          .fin-bars { display: flex; flex-direction: column; gap: 14px; margin-top: 12px; }
          .fin-bar-track {
            height: 12px;
            background: rgba(15, 23, 42, 0.06);
            border-radius: 8px;
            overflow: hidden;
            margin-top: 6px;
          }
          .fin-bar { height: 100%; border-radius: 8px; transition: width 0.4s ease; }
          .fin-bar.ing {
            background: linear-gradient(90deg, var(--color-success), var(--color-accent));
          }
          .fin-bar.gas {
            background: linear-gradient(90deg, var(--color-danger), var(--color-warning));
          }
          .fin-form-section {
            padding: 26px;
            border-radius: 20px;
            margin-bottom: 24px;
            overflow: visible;
            position: relative;
            z-index: 2;
          }
          .fin-form-section:has([data-state='open']) {
            z-index: 50;
          }
          .fin-hucha-hint {
            margin-top: 14px;
            font-size: 0.88rem;
          }
          .fin-hucha-hint a {
            color: var(--color-accent-light);
            font-weight: 600;
            text-decoration: none;
          }
          .fin-hucha-hint a:hover {
            text-decoration: underline;
          }
          .fin-form {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
            gap: 12px;
            align-items: end;
            margin-top: 12px;
            overflow: visible;
          }
          .fin-form input {
            width: 100%;
            box-sizing: border-box;
            min-height: 42px;
            padding: 10px 14px;
            border-radius: 12px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-card);
            color: var(--color-text);
            font-family: var(--font-main);
            font-size: 0.9375rem;
          }
          .fin-select-collapsible {
            width: 100%;
            min-width: 0;
          }
          .fin-select-trigger {
            font-family: var(--font-main);
            font-size: 0.9375rem;
            cursor: pointer;
            padding: 10px 14px;
            border-radius: 12px;
          }
          .fin-select-trigger span {
            white-space: normal;
            word-break: break-word;
          }
          .fin-select-menu,
          .fin-select-menu--portal {
            margin: 0;
            padding: 6px;
            list-style: none;
            border-radius: 12px;
            border: 1px solid var(--color-border);
            background: rgba(255, 255, 255, 0.98);
            box-shadow: 0 16px 40px rgba(74, 69, 62, 0.16);
            max-height: min(320px, 60vh);
            overflow-y: auto;
            box-sizing: border-box;
          }
          .fin-select-option {
            border: none;
            border-radius: 8px;
            background: transparent;
            color: var(--color-text);
            font-family: var(--font-main);
            cursor: pointer;
          }
          .fin-select-option:hover {
            background: rgba(74, 69, 62, 0.06);
          }
          .fin-select-option--active {
            background: rgba(74, 69, 62, 0.08);
            font-weight: 600;
            color: var(--color-accent-light);
          }
          .fin-table-wrap { padding: 26px; border-radius: 20px; overflow-x: auto; }
          .fin-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
            margin-top: 12px;
          }
          .fin-table th,
          .fin-table td {
            text-align: left;
            padding: 10px 12px;
            border-bottom: 1px solid var(--color-border);
          }
          .btn-del {
            background: transparent;
            border: 1px solid var(--color-border);
            color: var(--color-danger);
            padding: 6px 12px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.8rem;
          }
          .btn-del:hover { border-color: var(--color-danger); background: rgba(255,107,107,0.1); }
          .muted { color: var(--color-text-muted); }
          .dashboard-main .section-title {
            font-size: 1.12rem;
            font-weight: 700;
            letter-spacing: -0.02em;
            margin-bottom: 6px;
            color: #1c1917;
          }
          .fin-cat-section {
            padding: 24px 26px;
            border-radius: 20px;
            margin-bottom: 32px;
          }
          .fin-cat-head {
            display: flex;
            flex-wrap: wrap;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px 28px;
          }
          .fin-cat-desc {
            margin: 10px 0 0;
            font-size: 0.9rem;
            line-height: 1.6;
            max-width: 44rem;
            color: rgba(45, 42, 38, 0.72);
          }
          .fin-cat-open-btn {
            flex-shrink: 0;
            align-self: center;
            padding: 12px 22px;
            border-radius: 14px;
            font-weight: 600;
            letter-spacing: 0.01em;
            box-shadow: 0 4px 14px rgba(45, 90, 72, 0.22);
          }
          .fin-cat-overlay {
            position: fixed;
            inset: 0;
            z-index: 280;
            background: rgba(28, 25, 22, 0.52);
            backdrop-filter: blur(8px) saturate(120%);
            -webkit-backdrop-filter: blur(8px) saturate(120%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px 16px;
            overflow-y: auto;
            animation: finCatOverlayIn 0.22s ease-out;
          }
          @keyframes finCatOverlayIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          @keyframes finCatModalIn {
            from {
              opacity: 0;
              transform: translateY(12px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          .fin-cat-modal {
            width: 100%;
            max-width: 760px;
            max-height: min(92vh, 900px);
            display: flex;
            flex-direction: column;
            border-radius: 22px;
            overflow: hidden;
            margin: auto;
            background: linear-gradient(165deg, #fffdfb 0%, #faf6ef 48%, #f3ebe0 100%);
            border: 1px solid rgba(255, 255, 255, 0.95);
            box-shadow:
              0 0 0 1px rgba(45, 38, 32, 0.06),
              0 24px 64px rgba(28, 22, 18, 0.22),
              0 8px 24px rgba(28, 22, 18, 0.12),
              inset 0 1px 0 rgba(255, 255, 255, 0.9);
            animation: finCatModalIn 0.32s cubic-bezier(0.22, 1, 0.36, 1);
          }
          .fin-cat-modal-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            padding: 22px 24px 18px;
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.65) 0%, transparent 100%);
            border-bottom: 1px solid rgba(45, 38, 32, 0.08);
            flex-shrink: 0;
            position: relative;
          }
          .fin-cat-modal-toolbar::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            border-radius: 22px 0 0 0;
            background: linear-gradient(180deg, #5a8f6e, #3d6b8f);
          }
          .fin-cat-modal-headtext {
            padding-left: 12px;
          }
          .fin-cat-modal-title {
            margin: 0;
            font-size: 1.35rem;
            font-weight: 700;
            letter-spacing: -0.03em;
            color: #1c1917;
          }
          .fin-cat-modal-sub {
            margin: 8px 0 0;
            font-size: 0.92rem;
            color: rgba(45, 42, 38, 0.62);
            text-transform: capitalize;
          }
          .fin-cat-modal-actions {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-shrink: 0;
          }
          .fin-cat-total-pill {
            display: inline-flex;
            flex-direction: column;
            align-items: flex-end;
            padding: 8px 14px 10px;
            border-radius: 14px;
            background: rgba(139, 90, 74, 0.1);
            border: 1px solid rgba(139, 90, 74, 0.18);
          }
          .fin-cat-total-pill-label {
            font-size: 0.65rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: rgba(90, 60, 50, 0.65);
          }
          .fin-cat-total-pill-value {
            font-size: 1.1rem;
            font-weight: 700;
            color: #8b4a3c;
            font-variant-numeric: tabular-nums;
          }
          .fin-cat-close {
            width: 44px;
            height: 44px;
            border: none;
            border-radius: 12px;
            background: rgba(45, 38, 32, 0.06);
            font-size: 1.5rem;
            line-height: 1;
            cursor: pointer;
            color: rgba(45, 38, 38, 0.75);
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
          }
          .fin-cat-close:hover {
            background: rgba(139, 74, 60, 0.12);
            color: #6b2e24;
          }
          .fin-cat-close:active {
            transform: scale(0.96);
          }
          .fin-cat-modal-body {
            padding: 20px 22px 26px;
            overflow-y: auto;
            flex: 1;
            min-height: 0;
          }
          .fin-cat-grupo {
            margin-bottom: 18px;
            padding: 16px 18px 6px;
            border-radius: 16px;
            background: rgba(255, 255, 255, 0.55);
            border: 1px solid rgba(45, 38, 32, 0.07);
            box-shadow: 0 2px 12px rgba(45, 38, 32, 0.04);
          }
          .fin-cat-grupo:last-child {
            margin-bottom: 0;
          }
          .fin-cat-grupo.fin-tone-0 {
            border-left: 4px solid #7d6b5a;
          }
          .fin-cat-grupo.fin-tone-1 {
            border-left: 4px solid #5a8f6e;
          }
          .fin-cat-grupo.fin-tone-2 {
            border-left: 4px solid #3d7a8f;
          }
          .fin-cat-grupo.fin-tone-3 {
            border-left: 4px solid #b86b52;
          }
          .fin-cat-grupo.fin-tone-4 {
            border-left: 4px solid #8b6bb8;
          }
          .fin-cat-grupo.fin-tone-5 {
            border-left: 4px solid #2d8a7a;
          }
          .fin-cat-grupo.fin-tone-6 {
            border-left: 4px solid #7a7368;
          }
          .fin-cat-grupo-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 14px;
            margin-bottom: 12px;
            padding-bottom: 0;
            border-bottom: none;
          }
          .fin-cat-grupo-title {
            margin: 0;
            font-size: 1.02rem;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #292524;
          }
          .fin-cat-grupo-total {
            font-weight: 700;
            font-size: 1.05rem;
            color: #9a4a3d;
            font-variant-numeric: tabular-nums;
            padding: 4px 10px;
            border-radius: 10px;
            background: rgba(154, 74, 61, 0.08);
          }
          .fin-cat-table-scroll {
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid rgba(45, 38, 32, 0.06);
            background: rgba(255, 255, 255, 0.7);
          }
          .fin-cat-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
          }
          .fin-cat-table th,
          .fin-cat-table td {
            text-align: left;
            padding: 11px 14px;
            border-bottom: 1px solid rgba(45, 38, 32, 0.06);
          }
          .fin-cat-table tbody tr:last-child td {
            border-bottom: none;
          }
          .fin-cat-table tbody tr:hover td {
            background: rgba(90, 143, 110, 0.06);
          }
          .fin-cat-table th {
            font-size: 0.68rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            color: rgba(45, 42, 38, 0.5);
            background: rgba(245, 240, 232, 0.95);
          }
          .fin-cat-table td.text-neg {
            font-weight: 600;
            color: #a8483c;
            font-variant-numeric: tabular-nums;
          }
        `}</style>
      </main>
    </div>
  )
}
