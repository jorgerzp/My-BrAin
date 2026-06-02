import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import { readJsonResponse } from '../utils/readJsonResponse'

const fmt = (n) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0)

function etiquetaMes(ym) {
  if (!ym || typeof ym !== 'string') return '—'
  const d = ym.length >= 7 ? ym.slice(0, 7) : ym
  if (!/^\d{4}-\d{2}$/.test(d)) return ym
  const [y, mo] = d.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
}

function mergeCategorias(actual, anterior) {
  const map = new Map()
  for (const r of actual || []) {
    const cat = r.categoria || 'Sin categoría'
    map.set(cat, { categoria: cat, act: Number(r.total) || 0, ant: 0 })
  }
  for (const r of anterior || []) {
    const cat = r.categoria || 'Sin categoría'
    const ex = map.get(cat)
    const ant = Number(r.total) || 0
    if (ex) ex.ant = ant
    else map.set(cat, { categoria: cat, act: 0, ant })
  }
  return [...map.values()].sort((a, b) => b.act + b.ant - (a.act + a.ant))
}

function variacionGastoTotal(prev, curr) {
  const p = Number(prev)
  const c = Number(curr)
  if (!Number.isFinite(p) || !Number.isFinite(c)) return null
  if (p === 0 && c === 0) return { label: 'Sin gastos registrados', tone: 'neutral' }
  if (p === 0) return { label: 'Primer mes con gastos', tone: 'up' }
  const raw = ((c - p) / Math.abs(p)) * 100
  const sign = raw >= 0 ? '+' : ''
  return {
    label: `${sign}${raw.toFixed(1)}% respecto al mes anterior`,
    tone: raw > 0.5 ? 'up' : raw < -0.5 ? 'down' : 'neutral',
  }
}

export default function InsightsAlertas() {
  const { user } = useAuth()
  const userId = user?.id
  const [loading, setLoading] = useState(true)
  const [initial, setInitial] = useState(true)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState(null)
  const [insights, setInsights] = useState(null)
  const [aiOk, setAiOk] = useState(null)
  const [modelUsed, setModelUsed] = useState(null)

  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => r.json())
      .then((d) => setAiOk(!!d.groq))
      .catch(() => setAiOk(false))
  }, [])

  const cargar = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      setInitial(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await readJsonResponse(res)
      if (data.datos) setPayload(data.datos)
      if (!res.ok) {
        setInsights(null)
        setModelUsed(null)
        throw new Error(data.error || 'Error al cargar insights')
      }
      setInsights(data.insights || null)
      setModelUsed(data.model || null)
    } catch (e) {
      setError(e.message || 'Error de red')
    } finally {
      setLoading(false)
      setInitial(false)
    }
  }, [userId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const filasCat = useMemo(
    () => mergeCategorias(payload?.porCategoriaActual, payload?.porCategoriaAnterior),
    [payload]
  )

  const maxBar = useMemo(() => {
    let m = 0
    for (const r of filasCat) {
      m = Math.max(m, r.act, r.ant)
    }
    return m > 0 ? m : 1
  }, [filasCat])

  const varTotal = useMemo(
    () =>
      payload
        ? variacionGastoTotal(payload.totalGastosAnterior, payload.totalGastosActual)
        : null,
    [payload]
  )

  const sinGastos =
    payload &&
    Number(payload.totalGastosActual) === 0 &&
    Number(payload.totalGastosAnterior) === 0

  const showSkeleton = initial && loading && !payload

  return (
    <DashboardLayout className="ins-main">
        <header className="ins-hero animate-fade-in">
          <p className="ins-eyebrow">Finanzas personales</p>
          <h1 className="dash-greeting ins-title">
            Insights <span className="gradient-text">&amp; alertas</span>
          </h1>
          <p className="dash-sub ins-lead">
            Comparativa de <strong>gastos por categoría</strong> (mes en curso frente al anterior) y tres lecturas
            breves generadas con IA a partir de tus datos reales.
          </p>
          {aiOk === false && (
            <p className="ins-banner ins-banner--warn" role="status">
              Sin clave de IA en el servidor no se pueden generar los textos automáticos. Los gráficos solo aparecen
              cuando la petición completa responde OK; configura <code>GROQ_API_KEY</code> en el backend.
            </p>
          )}
        </header>

        <div className="ins-toolbar animate-fade-in">
          <button type="button" className="btn-primary" onClick={cargar} disabled={!userId || loading}>
            {loading ? 'Actualizando…' : 'Actualizar análisis'}
          </button>
          <Link to="/finanzas" className="btn-secondary ins-link-fin">
            Ir a Finanzas
          </Link>
        </div>

        {error && (
          <div className="ins-alert glass animate-fade-in" role="alert">
            <span className="ins-alert-icon" aria-hidden>
              !
            </span>
            <div>
              <p className="ins-alert-title">No se pudo completar la petición</p>
              <p className="ins-alert-msg">{error}</p>
              {payload && (
                <p className="ins-alert-hint">Mostramos igualmente los datos numéricos disponibles.</p>
              )}
            </div>
          </div>
        )}

        {showSkeleton && (
          <div className="ins-skeleton animate-fade-in" aria-busy="true" aria-label="Cargando">
            <div className="ins-skel-row">
              <div className="ins-skel-card" />
              <div className="ins-skel-card" />
            </div>
            <div className="ins-skel-pills">
              <div className="ins-skel-pill" />
              <div className="ins-skel-pill" />
              <div className="ins-skel-pill" />
            </div>
            <div className="ins-skel-block" />
          </div>
        )}

        {payload && !showSkeleton && (
          <>
            <section className="ins-kpi-strip animate-fade-in">
              <article className="ins-kpi glass-strong">
                <span className="ins-kpi-label">Mes en curso</span>
                <p className="ins-kpi-mes">{etiquetaMes(payload.mesActual)}</p>
                <p className="ins-kpi-total">{fmt(payload.totalGastosActual)}</p>
                <span className="ins-kpi-hint">Total gastos registrados</span>
              </article>
              <article className="ins-kpi glass-strong">
                <span className="ins-kpi-label">Mes anterior</span>
                <p className="ins-kpi-mes">{etiquetaMes(payload.mesAnterior)}</p>
                <p className="ins-kpi-total ins-kpi-total--muted">{fmt(payload.totalGastosAnterior)}</p>
                <span className="ins-kpi-hint">Misma lógica de categorías</span>
              </article>
              {varTotal && (
                <article className={`ins-kpi ins-kpi--delta glass-strong ins-delta--${varTotal.tone}`}>
                  <span className="ins-kpi-label">Tendencia</span>
                  <p className="ins-delta-label">Gasto total</p>
                  <p className="ins-delta-val">{varTotal.label}</p>
                  <span className="ins-kpi-hint">Más gasto no siempre es malo; mira el detalle por categoría</span>
                </article>
              )}
            </section>

            {sinGastos && (
              <section className="ins-empty glass animate-fade-in">
                <p className="ins-empty-title">Aún no hay gastos en estos meses</p>
                <p className="ins-empty-text">
                  Cuando registres movimientos en Finanzas, aquí verás la comparativa y podrás generar insights con IA.
                </p>
                <Link to="/finanzas" className="btn-primary">
                  Registrar gastos
                </Link>
              </section>
            )}

            {insights && (
              <section className="ins-insights animate-fade-in" aria-label="Lecturas generadas">
                <h2 className="ins-section-title">Lecturas del mes</h2>
                <div className="ins-cards">
                  <article className="ins-card ins-card--ok glass">
                    <div className="ins-card-head">
                      <span className="ins-card-icon" aria-hidden>
                        ✦
                      </span>
                      <span className="ins-card-tag">Positivo</span>
                    </div>
                    <p className="ins-card-body">{insights.positivo || '—'}</p>
                  </article>
                  <article className="ins-card ins-card--warn glass">
                    <div className="ins-card-head">
                      <span className="ins-card-icon" aria-hidden>
                        ⚠
                      </span>
                      <span className="ins-card-tag">Alerta</span>
                    </div>
                    <p className="ins-card-body">{insights.alerta || '—'}</p>
                  </article>
                  <article className="ins-card ins-card--tip glass">
                    <div className="ins-card-head">
                      <span className="ins-card-icon" aria-hidden>
                        💡
                      </span>
                      <span className="ins-card-tag">Consejo</span>
                    </div>
                    <p className="ins-card-body">{insights.consejo || '—'}</p>
                  </article>
                </div>
              </section>
            )}

            {!insights && !sinGastos && error && (
              <p className="ins-muted-block animate-fade-in">
                Los textos de IA no están disponibles en esta carga. Si el error fue solo del modelo, pulsa
                «Actualizar análisis».
              </p>
            )}

            {!sinGastos && filasCat.length > 0 && (
              <section className="ins-chart glass-strong animate-fade-in">
                <div className="ins-chart-head">
                  <h2 className="ins-section-title">Comparativa por categoría</h2>
                  <div className="ins-legend">
                    <span className="ins-legend-item">
                      <i className="ins-dot ins-dot--curr" /> Mes actual
                    </span>
                    <span className="ins-legend-item">
                      <i className="ins-dot ins-dot--prev" /> Mes anterior
                    </span>
                  </div>
                </div>
                <ul className="ins-bar-list">
                  {filasCat.map((row) => {
                    const wAct = Math.round((row.act / maxBar) * 100)
                    const wAnt = Math.round((row.ant / maxBar) * 100)
                    const diff = row.act - row.ant
                    let badge = null
                    if (row.ant > 0 && row.act !== row.ant) {
                      const pct = ((row.act - row.ant) / row.ant) * 100
                      badge =
                        pct > 1 ? (
                          <span className="ins-mini-badge ins-mini-badge--up">+{pct.toFixed(0)}%</span>
                        ) : pct < -1 ? (
                          <span className="ins-mini-badge ins-mini-badge--down">{pct.toFixed(0)}%</span>
                        ) : null
                    } else if (row.act > 0 && row.ant === 0) {
                      badge = <span className="ins-mini-badge ins-mini-badge--new">Nuevo</span>
                    }
                    return (
                      <li key={row.categoria} className="ins-bar-li">
                        <div className="ins-bar-top">
                          <span className="ins-bar-name" title={row.categoria}>
                            {row.categoria}
                          </span>
                          {badge}
                        </div>
                        <div className="ins-bar-tracks">
                          <div className="ins-bar-row-inner">
                            <span className="ins-bar-ghost" style={{ width: `${wAnt}%` }} />
                          </div>
                          <div className="ins-bar-row-inner ins-bar-row-inner--main">
                            <span className="ins-bar-fill" style={{ width: `${wAct}%` }} />
                          </div>
                        </div>
                        <div className="ins-bar-amounts">
                          <span className="ins-amt-curr">{fmt(row.act)}</span>
                          <span className="ins-amt-prev">antes {fmt(row.ant)}</span>
                          {diff !== 0 && (
                            <span className={`ins-amt-diff ${diff > 0 ? 'ins-amt-diff--more' : 'ins-amt-diff--less'}`}>
                              {diff > 0 ? '+' : ''}
                              {fmt(diff)}
                            </span>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </>
        )}

        {!payload && !showSkeleton && !loading && (
          <section className="ins-empty glass animate-fade-in">
            <p className="ins-empty-title">No hay datos que mostrar</p>
            <p className="ins-empty-text">
              Comprueba que el backend esté en marcha y que exista <code>GROQ_API_KEY</code> para esta ruta, o revisa el
              mensaje de error arriba.
            </p>
            <button type="button" className="btn-primary" onClick={cargar} disabled={!userId}>
              Reintentar
            </button>
          </section>
        )}

        {modelUsed && (
          <p className="ins-footnote animate-fade-in">
            Textos generados con asistencia de modelo en el servidor (referencia técnica, no visible en tus gastos).
          </p>
        )}

        <style>{`
          .ins-main {
            max-width: none;
            width: 100%;
            flex: 1 1 auto;
            min-width: 0;
            box-sizing: border-box;
            position: relative;
            padding-top: 24px;
            padding-bottom: 48px;
          }
          .ins-main {
            background: transparent;
          }
          .ins-hero {
            margin-bottom: 20px;
          }
          .ins-eyebrow {
            font-size: 0.68rem;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--color-text-muted);
            margin: 0 0 8px;
          }
          .ins-title {
            margin-bottom: 0;
          }
          .ins-lead {
            max-width: 40rem;
            margin-top: 10px;
          }
          .ins-banner {
            margin-top: 16px;
            padding: 12px 16px;
            border-radius: 14px;
            font-size: 0.88rem;
            line-height: 1.5;
            max-width: 44rem;
          }
          .ins-banner--warn {
            background: rgba(255, 245, 230, 0.95);
            border: 1px solid rgba(217, 119, 6, 0.22);
            color: #92400e;
          }
          .ins-banner code {
            font-size: 0.85em;
            padding: 2px 6px;
            border-radius: 6px;
            background: rgba(0, 0, 0, 0.06);
          }
          .ins-toolbar {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 12px;
            margin-bottom: 22px;
          }
          .ins-link-fin {
            text-decoration: none;
            display: inline-flex;
            align-items: center;
          }
          .ins-alert {
            display: flex;
            gap: 14px;
            align-items: flex-start;
            padding: 16px 18px;
            border-radius: 16px;
            margin-bottom: 22px;
            max-width: 52rem;
          }
          .ins-alert-icon {
            flex-shrink: 0;
            width: 32px;
            height: 32px;
            border-radius: 10px;
            background: rgba(225, 29, 72, 0.12);
            color: var(--color-danger);
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1rem;
          }
          .ins-alert-title {
            font-weight: 700;
            font-size: 0.95rem;
            margin: 0 0 4px;
            color: var(--color-text);
          }
          .ins-alert-msg {
            margin: 0;
            font-size: 0.9rem;
            color: var(--color-text-muted);
            line-height: 1.45;
          }
          .ins-alert-hint {
            margin: 8px 0 0;
            font-size: 0.82rem;
            color: var(--color-success);
            font-weight: 500;
          }
          .ins-skeleton {
            display: flex;
            flex-direction: column;
            gap: 18px;
            max-width: 960px;
          }
          .ins-skel-row {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 14px;
          }
          .ins-skel-card,
          .ins-skel-pill,
          .ins-skel-block {
            border-radius: 16px;
            background: linear-gradient(90deg, rgba(0, 0, 0, 0.06) 0%, rgba(0, 0, 0, 0.04) 50%, rgba(0, 0, 0, 0.06) 100%);
            background-size: 200% 100%;
            animation: ins-shimmer 1.2s ease-in-out infinite;
            min-height: 96px;
          }
          .ins-skel-pills {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: 12px;
          }
          .ins-skel-pill {
            min-height: 120px;
          }
          .ins-skel-block {
            min-height: 200px;
            max-width: 720px;
          }
          @keyframes ins-shimmer {
            0% {
              background-position: 100% 0;
            }
            100% {
              background-position: -100% 0;
            }
          }
          .ins-kpi-strip {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: 16px;
            margin-bottom: 28px;
            max-width: 1100px;
          }
          .ins-kpi {
            padding: 20px 22px;
            border-radius: 18px;
          }
          .ins-kpi-label {
            font-size: 0.7rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--color-text-muted);
          }
          .ins-kpi-mes {
            margin: 8px 0 4px;
            font-size: 1.05rem;
            font-weight: 700;
            color: var(--color-text);
            text-transform: capitalize;
          }
          .ins-kpi-total {
            margin: 0;
            font-size: 1.65rem;
            font-weight: 700;
            letter-spacing: -0.03em;
            color: var(--color-text);
          }
          .ins-kpi-total--muted {
            color: var(--color-text-muted);
            font-size: 1.35rem;
          }
          .ins-kpi-hint {
            display: block;
            margin-top: 10px;
            font-size: 0.78rem;
            color: var(--color-text-muted);
            line-height: 1.4;
          }
          .ins-delta-label {
            margin: 8px 0 0;
            font-size: 0.88rem;
            color: var(--color-text-muted);
          }
          .ins-delta-val {
            margin: 4px 0 0;
            font-size: 1.05rem;
            font-weight: 700;
            line-height: 1.35;
          }
          .ins-delta--up .ins-delta-val {
            color: var(--color-danger);
          }
          .ins-delta--down .ins-delta-val {
            color: var(--color-success);
          }
          .ins-delta--neutral .ins-delta-val {
            color: var(--color-text);
          }
          .ins-empty {
            padding: 32px 28px;
            border-radius: 20px;
            max-width: 480px;
            text-align: center;
            margin-bottom: 28px;
          }
          .ins-empty-title {
            font-size: 1.1rem;
            font-weight: 700;
            margin: 0 0 10px;
            color: var(--color-text);
          }
          .ins-empty-text {
            margin: 0 0 20px;
            font-size: 0.92rem;
            color: var(--color-text-muted);
            line-height: 1.55;
          }
          .ins-empty .btn-primary {
            text-decoration: none;
            display: inline-flex;
            justify-content: center;
          }
          .ins-section-title {
            font-size: 0.82rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            color: var(--color-text-muted);
            margin: 0 0 14px;
          }
          .ins-insights {
            margin-bottom: 32px;
            max-width: 1100px;
          }
          .ins-cards {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: 16px;
          }
          .ins-card {
            padding: 18px 20px 20px;
            border-radius: 18px;
            min-height: 140px;
            display: flex;
            flex-direction: column;
          }
          .ins-card-head {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
          }
          .ins-card-icon {
            font-size: 1.15rem;
            opacity: 0.85;
          }
          .ins-card-tag {
            font-size: 0.68rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }
          .ins-card--ok .ins-card-tag {
            color: var(--color-success);
          }
          .ins-card--warn .ins-card-tag {
            color: var(--color-danger);
          }
          .ins-card--tip .ins-card-tag {
            color: #7c3aed;
          }
          .ins-card-body {
            margin: 0;
            font-size: 0.94rem;
            line-height: 1.55;
            color: var(--color-text);
            flex: 1;
          }
          .ins-muted-block {
            font-size: 0.88rem;
            color: var(--color-text-muted);
            max-width: 40rem;
            margin-bottom: 24px;
            line-height: 1.5;
          }
          .ins-chart {
            padding: 22px 24px 26px;
            border-radius: 20px;
            max-width: 900px;
          }
          .ins-chart-head {
            display: flex;
            flex-wrap: wrap;
            align-items: flex-end;
            justify-content: space-between;
            gap: 12px 20px;
            margin-bottom: 18px;
          }
          .ins-legend {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            font-size: 0.78rem;
            color: var(--color-text-muted);
          }
          .ins-legend-item {
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .ins-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
          }
          .ins-dot--curr {
            background: var(--color-primary);
          }
          .ins-dot--prev {
            background: rgba(0, 0, 0, 0.22);
          }
          .ins-bar-list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 18px;
          }
          .ins-bar-li {
            margin: 0;
          }
          .ins-bar-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 6px;
          }
          .ins-bar-name {
            font-weight: 600;
            font-size: 0.9rem;
            color: var(--color-text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            min-width: 0;
          }
          .ins-mini-badge {
            flex-shrink: 0;
            font-size: 0.65rem;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 8px;
            letter-spacing: 0.02em;
          }
          .ins-mini-badge--up {
            background: rgba(225, 29, 72, 0.1);
            color: var(--color-danger);
          }
          .ins-mini-badge--down {
            background: rgba(5, 150, 105, 0.12);
            color: var(--color-success);
          }
          .ins-mini-badge--new {
            background: rgba(0, 113, 227, 0.1);
            color: var(--color-accent);
          }
          .ins-bar-tracks {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .ins-bar-row-inner {
            height: 8px;
            border-radius: 6px;
            background: rgba(0, 0, 0, 0.05);
            overflow: hidden;
          }
          .ins-bar-row-inner--main {
            height: 10px;
          }
          .ins-bar-ghost {
            display: block;
            height: 100%;
            border-radius: 6px;
            background: rgba(0, 0, 0, 0.18);
            min-width: 2px;
            transition: width 0.35s ease;
          }
          .ins-bar-fill {
            display: block;
            height: 100%;
            border-radius: 6px;
            background: linear-gradient(90deg, #1d1d1f, #424245);
            min-width: 2px;
            transition: width 0.35s ease;
          }
          .ins-bar-amounts {
            display: flex;
            flex-wrap: wrap;
            align-items: baseline;
            gap: 8px 14px;
            margin-top: 8px;
            font-size: 0.8rem;
          }
          .ins-amt-curr {
            font-weight: 700;
            color: var(--color-text);
            font-size: 0.88rem;
          }
          .ins-amt-prev {
            color: var(--color-text-muted);
          }
          .ins-amt-diff {
            font-weight: 600;
            font-variant-numeric: tabular-nums;
          }
          .ins-amt-diff--more {
            color: var(--color-danger);
          }
          .ins-amt-diff--less {
            color: var(--color-success);
          }
          .ins-footnote {
            margin-top: 28px;
            font-size: 0.72rem;
            color: var(--color-text-muted);
            max-width: 36rem;
            line-height: 1.45;
          }
        `}</style>
    </DashboardLayout>
  )
}
