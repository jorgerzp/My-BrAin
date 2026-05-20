import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'

const fmt = (n) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0)

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function weekMondayToSundayIso() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(12, 0, 0, 0)
  const from = monday.toISOString().slice(0, 10)
  return { from, to: addDays(from, 6) }
}

function prevMonth(year, month) {
  const d = new Date(year, month - 2, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function pastMonthsWindow(count) {
  const out = []
  const d = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push({ year: x.getFullYear(), month: x.getMonth() + 1 })
  }
  return out
}

function pctVsPrev(prevVal, currVal) {
  const p = Number(prevVal)
  const c = Number(currVal)
  if (!Number.isFinite(p) || !Number.isFinite(c)) return null
  if (p === 0 && c === 0) return 'sin cambio'
  if (p === 0) return '+100% vs mes ant.'
  const raw = ((c - p) / Math.abs(p)) * 100
  const sign = raw >= 0 ? '+' : ''
  return `${sign}${raw.toFixed(1)}% vs mes ant.`
}

/** Días hasta la fecha ISO (hoy = 0). */
function diasHasta(isoDate) {
  const t = new Date(isoDate + 'T12:00:00')
  const hoy = new Date()
  hoy.setHours(12, 0, 0, 0)
  return Math.round((t.getTime() - hoy.getTime()) / 86400000)
}

export default function Dashboard() {
  const { user } = useAuth()
  const userId = user?.id
  const navigate = useNavigate()

  const now = useMemo(() => new Date(), [])
  const curYear = now.getFullYear()
  const curMonth = now.getMonth() + 1

  const [loading, setLoading] = useState(true)
  const [resumen, setResumen] = useState({
    ingresos: 0,
    gastos: 0,
    ahorro_aportado: 0,
    balance: 0,
  })
  const [resumenPrev, setResumenPrev] = useState({
    ingresos: 0,
    gastos: 0,
    ahorro_aportado: 0,
    balance: 0,
  })
  const [menusSemana, setMenusSemana] = useState(0)
  const [chartMonths, setChartMonths] = useState([])
  const [menuHoy, setMenuHoy] = useState({ comida: null, cena: null })
  const [eventosProximos, setEventosProximos] = useState([])

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const pm = prevMonth(curYear, curMonth)
      const qsCur = new URLSearchParams({
        userId: String(userId),
        year: String(curYear),
        month: String(curMonth),
      })
      const qsPrev = new URLSearchParams({
        userId: String(userId),
        year: String(pm.year),
        month: String(pm.month),
      })

      const today = new Date().toISOString().slice(0, 10)
      const week = weekMondayToSundayIso()
      const qsWeek = new URLSearchParams({
        userId: String(userId),
        from: week.from,
        to: week.to,
      })
      const qsToday = new URLSearchParams({
        userId: String(userId),
        from: today,
        to: today,
      })

      const window = pastMonthsWindow(4)
      const chartReq = window.map(({ year, month }) =>
        fetch(`/api/finanzas/resumen?userId=${userId}&year=${year}&month=${month}`).then((r) => r.json())
      )

      const [rCur, rPrev, rWeek, rToday, rEv, ...chartJsons] = await Promise.all([
        fetch(`/api/finanzas/resumen?${qsCur}`).then((r) => r.json()),
        fetch(`/api/finanzas/resumen?${qsPrev}`).then((r) => r.json()),
        fetch(`/api/alimentacion/menu?${qsWeek}`).then((r) => r.json()),
        fetch(`/api/alimentacion/menu?${qsToday}`).then((r) => r.json()),
        fetch(`/api/eventos?userId=${userId}`).then((r) => r.json()),
        ...chartReq,
      ])

      setResumen({
        ingresos: Number(rCur.ingresos ?? 0),
        gastos: Number(rCur.gastos ?? 0),
        ahorro_aportado: Number(rCur.ahorro_aportado ?? 0),
        balance: Number(rCur.balance ?? 0),
      })
      setResumenPrev({
        ingresos: Number(rPrev.ingresos ?? 0),
        gastos: Number(rPrev.gastos ?? 0),
        ahorro_aportado: Number(rPrev.ahorro_aportado ?? 0),
        balance: Number(rPrev.balance ?? 0),
      })

      const menusArr = rWeek.menus || []
      setMenusSemana(Array.isArray(menusArr) ? menusArr.length : 0)

      const menusToday = rToday.menus || []
      let comida = null
      let cena = null
      for (const m of menusToday) {
        if (m.momento === 'comida') comida = m.plato
        if (m.momento === 'cena') cena = m.plato
      }
      setMenuHoy({ comida, cena })

      setEventosProximos(Array.isArray(rEv.eventos) ? rEv.eventos : [])

      const maxGasto = Math.max(
        ...chartJsons.map((j) => Number(j.gastos ?? 0)),
        1
      )
      setChartMonths(
        window.map((wm, i) => {
          const g = Number(chartJsons[i]?.gastos ?? 0)
          return {
            label: new Date(wm.year, wm.month - 1, 1).toLocaleDateString('es-ES', { month: 'short' }),
            gastos: g,
            pct: (g / maxGasto) * 100,
            isActive: wm.year === curYear && wm.month === curMonth,
          }
        })
      )
    } catch {
      /* silencioso: paneles muestran vacío */
    } finally {
      setLoading(false)
    }
  }, [userId, curYear, curMonth])

  useEffect(() => {
    load()
  }, [load])

  const stats = [
    {
      titulo: 'Balance del mes',
      valor: loading ? '…' : fmt(resumen.balance),
      cambio: pctVsPrev(resumenPrev.balance, resumen.balance),
      positivo: resumen.balance >= 0,
      icono: '💰',
    },
    {
      titulo: 'Gastos del mes',
      valor: loading ? '…' : fmt(resumen.gastos),
      cambio: pctVsPrev(resumenPrev.gastos, resumen.gastos),
      positivo: resumen.gastos <= resumenPrev.gastos,
      icono: '📉',
    },
    {
      titulo: 'Ingresos del mes',
      valor: loading ? '…' : fmt(resumen.ingresos),
      cambio: pctVsPrev(resumenPrev.ingresos, resumen.ingresos),
      positivo: resumen.ingresos >= resumenPrev.ingresos,
      icono: '🏦',
    },
    {
      titulo: 'Platos en el menú',
      valor: loading ? '…' : String(menusSemana),
      cambio: 'esta semana',
      positivo: null,
      icono: '🍽️',
    },
  ]

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buenos días'
    if (hour < 20) return 'Buenas tardes'
    return 'Buenas noches'
  }

  const proximoEvento = eventosProximos[0]
  const siguientesEventos = eventosProximos.slice(1, 4)

  return (
    <DashboardLayout>
        <header className="dash-header animate-fade-in">
          <div>
            <h1 className="dash-greeting">
              {getGreeting()}, <span className="gradient-text">{user?.nombre || 'Usuario'}</span>
            </h1>
            <p className="dash-date">
              {new Date().toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </header>

        <section className="stats-grid">
          {stats.map((stat, i) => (
            <div
              key={stat.titulo}
              className="stat-card glass animate-fade-in"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="stat-icon">{stat.icono}</div>
              <div className="stat-info">
                <p className="stat-label">{stat.titulo}</p>
                <p className="stat-value">{stat.valor}</p>
                {stat.cambio && (
                  <span
                    className={`stat-change ${
                      stat.positivo === true ? 'positive' : stat.positivo === false ? 'negative' : 'neutral'
                    }`}
                  >
                    {stat.cambio}
                  </span>
                )}
              </div>
            </div>
          ))}
        </section>

        <section className="quick-actions animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <h2 className="section-title">Acciones rápidas</h2>
          <div className="actions-grid">
            <button
              type="button"
              className="action-card glass"
              onClick={() => navigate('/finanzas', { state: { prefillTipo: 'ingreso' } })}
            >
              <span className="action-icon">➕</span>
              <span className="action-label">Añadir Ingreso</span>
            </button>
            <button
              type="button"
              className="action-card glass"
              onClick={() => navigate('/finanzas', { state: { prefillTipo: 'gasto' } })}
            >
              <span className="action-icon">➖</span>
              <span className="action-label">Añadir Gasto</span>
            </button>
            <button
              type="button"
              className="action-card glass"
              onClick={() => navigate('/alimentacion', { state: { focusIa: true } })}
            >
              <span className="action-icon">🤖</span>
              <span className="action-label">Generar Menú</span>
            </button>
            <button
              type="button"
              className="action-card glass"
              onClick={() => navigate('/lista-compra')}
            >
              <span className="action-icon">🛒</span>
              <span className="action-label">Lista Compra</span>
            </button>
          </div>
        </section>

        <section className="dash-events-cal glass animate-fade-in" style={{ animationDelay: '0.45s' }}>
          <div className="dash-events-cal-head">
            <h2 className="section-title dash-events-title">📅 Próximos eventos</h2>
            <button type="button" className="dash-events-link" onClick={() => navigate('/eventos')}>
              Gestionar en Eventos →
            </button>
          </div>
          {loading ? (
            <p className="muted dash-events-loading">Cargando calendario…</p>
          ) : proximoEvento ? (
            <div className="dash-events-body">
              <div className="dash-cal-tile" aria-hidden="true">
                <span className="dash-cal-month">
                  {new Date(proximoEvento.fecha_evento + 'T12:00:00').toLocaleDateString('es-ES', {
                    month: 'short',
                  })}
                </span>
                <span className="dash-cal-day">
                  {new Date(proximoEvento.fecha_evento + 'T12:00:00').getDate()}
                </span>
              </div>
              <div className="dash-cal-main">
                <p className="dash-cal-kicker">Tu próximo evento</p>
                <h3 className="dash-cal-event-title">{proximoEvento.titulo}</h3>
                <p className="dash-cal-full-date">
                  {new Date(proximoEvento.fecha_evento + 'T12:00:00').toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <p className="dash-cal-countdown">
                  {(() => {
                    const d = diasHasta(proximoEvento.fecha_evento)
                    if (d === 0) return 'Es hoy'
                    if (d === 1) return 'Mañana'
                    if (d > 1) return `En ${d} días`
                    return ''
                  })()}
                </p>
                {proximoEvento.descripcion && (
                  <p className="muted dash-cal-desc">{proximoEvento.descripcion}</p>
                )}
              </div>
              {siguientesEventos.length > 0 && (
                <div className="dash-cal-sidebar">
                  <p className="dash-cal-sidebar-label">Después</p>
                  <ul className="dash-cal-mini-list">
                    {siguientesEventos.map((ev) => (
                      <li key={ev.id}>
                        <span className="dash-cal-mini-day">
                          {new Date(ev.fecha_evento + 'T12:00:00').getDate()}{' '}
                          {new Date(ev.fecha_evento + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short' })}
                        </span>
                        <span className="dash-cal-mini-title">{ev.titulo}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="dash-events-empty">
              <p className="muted">No tienes eventos próximos en el calendario.</p>
              <button type="button" className="btn-primary dash-events-cta" onClick={() => navigate('/eventos')}>
                Añadir evento
              </button>
            </div>
          )}
        </section>

        <section className="panels-grid animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <div className="panel glass">
            <div className="panel-header">
              <h3>📊 Gastos por mes</h3>
              <span className="panel-badge">Live</span>
            </div>
            <div className="panel-content">
              <div className="finance-placeholder">
                {chartMonths.length === 0 ? (
                  <p className="panel-note" style={{ marginTop: 24 }}>
                    {loading ? 'Cargando…' : 'Sin datos todavía'}
                  </p>
                ) : (
                  chartMonths.map((m) => (
                    <div
                      key={m.label}
                      className={`chart-bar ${m.isActive ? 'active' : ''}`}
                      style={{ height: `${Math.max(12, m.pct)}%` }}
                      title={`${m.label}: ${fmt(m.gastos)}`}
                    >
                      <span>{m.label}</span>
                    </div>
                  ))
                )}
              </div>
              <p className="panel-note">Altura ~ gastos del mes (últimos 4 meses)</p>
            </div>
          </div>

          <div className="panel glass">
            <div className="panel-header">
              <h3>🍽️ Menú de Hoy</h3>
              <span className="panel-badge">IA</span>
            </div>
            <div className="panel-content">
              <div className="menu-item">
                <span className="menu-time">☀️ Comida</span>
                <p className="menu-dish">
                  {loading ? '…' : menuHoy.comida || 'Sin definir — edita en Alimentación'}
                </p>
              </div>
              <div className="menu-divider"></div>
              <div className="menu-item">
                <span className="menu-time">🌙 Cena</span>
                <p className="menu-dish">
                  {loading ? '…' : menuHoy.cena || 'Sin definir — edita en Alimentación'}
                </p>
              </div>
            </div>
          </div>
        </section>
      

      <style>{`

        /* Header */
        .dash-header {
          margin-bottom: 32px;
        }
        .dash-date {
          color: var(--color-text-muted);
          font-size: 0.9rem;
          margin-top: 4px;
          text-transform: capitalize;
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        .stat-card {
          padding: 24px;
          border-radius: 16px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          transition: all 0.3s ease;
          cursor: default;
        }
        .stat-card:hover {
          transform: translateY(-3px);
          border-color: rgba(0, 0, 0, 0.1);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
        }
        .stat-icon {
          font-size: 2rem;
          line-height: 1;
        }
        .stat-info {
          flex: 1;
        }
        .stat-label {
          font-size: 0.8rem;
          color: var(--color-text-muted);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 4px;
        }
        .stat-change {
          font-size: 0.78rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 6px;
          display: inline-block;
          margin-top: 6px;
        }
        .stat-change.positive {
          color: var(--color-success);
          background: rgba(0, 184, 148, 0.1);
        }
        .stat-change.negative {
          color: var(--color-danger);
          background: rgba(255, 107, 107, 0.1);
        }
        .stat-change.neutral {
          color: var(--color-text-muted);
          background: rgba(100, 116, 139, 0.12);
        }

        /* Quick Actions */
        .section-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 16px;
          color: var(--color-text);
        }
        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 14px;
          margin-bottom: 32px;
        }
        .action-card {
          padding: 20px;
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: var(--font-main);
          color: var(--color-text);
        }
        .action-card:hover {
          transform: translateY(-3px);
          border-color: rgba(0, 0, 0, 0.12);
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.08);
        }
        .action-icon {
          font-size: 1.6rem;
        }
        .action-label {
          font-size: 0.85rem;
          font-weight: 500;
        }

        /* Tarjeta calendario — próximo evento */
        .dash-events-cal {
          padding: 22px 24px;
          border-radius: 16px;
          margin-bottom: 28px;
        }
        .dash-events-cal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 18px;
        }
        .dash-events-title {
          margin-bottom: 0;
        }
        .dash-events-link {
          background: none;
          border: none;
          color: var(--color-accent-light);
          font-family: var(--font-main);
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          padding: 6px 0;
        }
        .dash-events-link:hover {
          text-decoration: underline;
        }
        .dash-events-loading {
          margin: 8px 0 0;
        }
        .dash-events-body {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 20px 28px;
          align-items: start;
        }
        .dash-cal-tile {
          grid-column: 1;
          grid-row: 1 / span 2;
          width: 96px;
          min-height: 112px;
          border-radius: 16px;
          background: var(--color-primary);
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 12px;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
        }
        .dash-cal-month {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          opacity: 0.92;
        }
        .dash-cal-day {
          font-size: 2.35rem;
          font-weight: 800;
          line-height: 1.1;
          margin-top: 4px;
        }
        .dash-cal-main {
          grid-column: 2;
          grid-row: 1;
          min-width: 0;
        }
        .dash-cal-kicker {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-text-muted);
          margin: 0 0 6px;
        }
        .dash-cal-event-title {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0 0 8px;
          line-height: 1.25;
        }
        .dash-cal-full-date {
          margin: 0 0 6px;
          font-size: 0.92rem;
          color: var(--color-text-muted);
          text-transform: capitalize;
        }
        .dash-cal-countdown {
          margin: 0 0 8px;
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-accent);
        }
        .dash-cal-desc {
          margin: 0;
          font-size: 0.88rem;
          line-height: 1.45;
        }
        .dash-cal-sidebar {
          grid-column: 2;
          grid-row: 2;
          padding-top: 12px;
          margin-top: 0;
          border-top: 1px dashed var(--color-border);
        }
        .dash-cal-sidebar-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-text-muted);
          margin: 0 0 10px;
        }
        .dash-cal-mini-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .dash-cal-mini-list li {
          display: flex;
          align-items: baseline;
          gap: 12px;
          font-size: 0.88rem;
        }
        .dash-cal-mini-day {
          flex-shrink: 0;
          font-weight: 700;
          color: var(--color-text);
          min-width: 3.2rem;
        }
        .dash-cal-mini-title {
          color: var(--color-text);
          line-height: 1.35;
        }
        .dash-events-empty {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 14px;
        }
        .dash-events-cta {
          padding: 10px 20px;
          font-size: 0.9rem;
        }
        @media (max-width: 640px) {
          .dash-events-body {
            grid-template-columns: 1fr;
          }
          .dash-cal-tile {
            grid-column: 1;
            grid-row: auto;
            width: 100%;
            max-width: 120px;
            min-height: 100px;
            flex-direction: row;
            justify-content: center;
            gap: 12px;
          }
          .dash-cal-main {
            grid-column: 1;
            grid-row: auto;
          }
          .dash-cal-sidebar {
            grid-column: 1;
            grid-row: auto;
            padding-top: 12px;
            margin-top: 8px;
            border-top: 1px dashed var(--color-border);
          }
        }

        /* Panels */
        .panels-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .panel {
          padding: 24px;
          border-radius: 16px;
        }
        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .panel-header h3 {
          font-size: 1rem;
          font-weight: 600;
        }
        .panel-badge {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 20px;
          background: var(--color-primary);
          color: white;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .panel-note {
          text-align: center;
          color: var(--color-text-muted);
          font-size: 0.8rem;
          margin-top: 12px;
        }

        /* Mini chart */
        .finance-placeholder {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 16px;
          height: 120px;
          padding: 0 10px;
        }
        .chart-bar {
          flex: 1;
          max-width: 50px;
          background: rgba(0, 0, 0, 0.08);
          border-radius: 8px 8px 0 0;
          position: relative;
          transition: all 0.3s ease;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          min-height: 12px;
        }
        .chart-bar:hover {
          background: rgba(0, 0, 0, 0.14);
        }
        .chart-bar.active {
          background: linear-gradient(to top, var(--color-primary), var(--color-primary-light));
        }
        .chart-bar span {
          position: absolute;
          bottom: -22px;
          font-size: 0.7rem;
          color: var(--color-text-muted);
          text-transform: capitalize;
        }

        /* Menu items */
        .menu-item {
          padding: 12px 0;
        }
        .menu-time {
          font-size: 0.8rem;
          color: var(--color-text);
          font-weight: 600;
        }
        .menu-dish {
          margin-top: 4px;
          color: var(--color-text-muted);
          font-size: 0.9rem;
        }
        .menu-divider {
          height: 1px;
          background: var(--color-border);
        }

        @media (max-width: 1024px) {
          .panels-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 640px) {
          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </DashboardLayout>
  )
}
