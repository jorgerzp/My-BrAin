import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import SmartScanner from '../components/SmartScanner'
import { AppCollapsible, AppCollapsibleChevron } from '@/components/ui/app-collapsible'
import { readJsonResponse } from '../utils/readJsonResponse'

const fmt = (n) =>
  n == null || !Number.isFinite(Number(n))
    ? '—'
    : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n))

function estadoLabel(estado) {
  const m = {
    imagen_guardada: 'Foto recibida',
    ocr_completo: 'Texto leído',
    ia_estructurado: 'Listo para confirmar',
    confirmado_bd: 'En Finanzas',
    error: 'Error',
  }
  return m[estado] || estado || '—'
}

function formatDiaTicket(ymd) {
  if (!ymd || typeof ymd !== 'string') return '—'
  const d = ymd.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return ymd
  const [y, mo, day] = d.split('-').map(Number)
  return new Date(y, mo - 1, day).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTs(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

export default function MisTickets() {
  const { user } = useAuth()
  const userId = user?.id
  const [carpetaAbierta, setCarpetaAbierta] = useState(false)
  const [aiOk, setAiOk] = useState(null)

  const [tickets, setTickets] = useState([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [errorLista, setErrorLista] = useState('')

  const [detalleTicketId, setDetalleTicketId] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [detalleLoading, setDetalleLoading] = useState(false)
  const [detalleError, setDetalleError] = useState('')

  const cerrarDetalle = useCallback(() => {
    setDetalleTicketId(null)
    setDetalle(null)
    setDetalleError('')
    setDetalleLoading(false)
  }, [])

  const abrirDetalle = useCallback(
    async (ticketId) => {
      if (!userId) return
      setDetalleTicketId(ticketId)
      setDetalle(null)
      setDetalleError('')
      setDetalleLoading(true)
      try {
        const res = await fetch(
          `/api/ticket-detalle?userId=${userId}&ticketId=${encodeURIComponent(ticketId)}`
        )
        const data = await readJsonResponse(res)
        if (!res.ok) throw new Error(data.error || 'Error al cargar el detalle')
        setDetalle(data)
      } catch (e) {
        setDetalleError(e.message || 'Error de red')
      } finally {
        setDetalleLoading(false)
      }
    },
    [userId]
  )

  useEffect(() => {
    if (!detalleTicketId) return
    const onKey = (e) => {
      if (e.key === 'Escape') cerrarDetalle()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [detalleTicketId, cerrarDetalle])

  const loadGuardados = useCallback(async () => {
    if (!userId) return
    setLoadingLista(true)
    setErrorLista('')
    try {
      const res = await fetch(`/api/tickets-guardados?userId=${userId}`)
      const data = await readJsonResponse(res)
      if (!res.ok) throw new Error(data.error || 'Error al cargar')
      setTickets(data.tickets || [])
    } catch (e) {
      setErrorLista(e.message || 'Error de red')
      setTickets([])
    } finally {
      setLoadingLista(false)
    }
  }, [userId])

  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => r.json())
      .then((d) => setAiOk(!!d.groq))
      .catch(() => setAiOk(false))
  }, [])

  useEffect(() => {
    loadGuardados()
  }, [loadGuardados])

  const onTicketGuardadoEnServidor = useCallback(async () => {
    await loadGuardados()
    setCarpetaAbierta(true)
  }, [loadGuardados])

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main dashboard-view mis-tickets-page">
        <div className="mt-page-inner">
          <header className="mt-hero">
            <div className="mt-hero-text">
              <p className="mt-eyebrow">Inteligencia artificial</p>
              <h1 className="dash-greeting mt-title">Mis tickets</h1>
              <p className="mt-lead">
                Sube una <strong>foto</strong> del ticket: te mostramos el total, la tienda, la fecha y los productos.
                Elige la <strong>categoría</strong> y confirma para guardarlo en <strong>Finanzas</strong>. Los{' '}
                <strong>gastos sin ticket</strong> puedes anotarlos en{' '}
                <Link to="/finanzas" className="mt-inline-link">
                  Finanzas
                </Link>
                .
              </p>
            </div>
            {aiOk === false && (
              <p className="mt-warn" role="status">
                El análisis automático del ticket no está disponible. Prueba más tarde o contacta con soporte.
              </p>
            )}
          </header>

          <div className="mt-layout">
            <section id="mis-tickets-nuevo" className="mt-panel mt-panel--add" aria-labelledby="mt-nuevo-title">
              <div className="mt-panel-head">
                <h2 id="mt-nuevo-title" className="mt-panel-title">
                  Añadir ticket
                </h2>
                <p className="mt-panel-desc">
                  Escáner solo con imagen (JPG, PNG o WebP). Tras analizar, elige categoría y confirma.
                </p>
              </div>

              <div className="mt-panel-body">
                <div className="mt-block">
                  <SmartScanner userId={userId} onSaved={onTicketGuardadoEnServidor} />
                </div>
              </div>
            </section>

            <section
              id="mis-tickets-guardados"
              className="mt-panel mt-panel--folder"
              aria-labelledby="mt-folder-label"
            >
              <h2 id="mt-folder-label" className="mt-sr-only">
                Tus tickets guardados
              </h2>

              <AppCollapsible
                id="mt-folder-collapsible"
                open={carpetaAbierta}
                onOpenChange={setCarpetaAbierta}
                disabled={loadingLista}
                showIndicator={false}
                className="mt-folder-collapsible"
                triggerClassName="mt-folder-trigger"
                contentInnerClassName="mt-folder-drawer"
                trigger={
                  <>
                <div className="mt-folder-illustration" aria-hidden>
                  <div className="mt-folder-tab">
                    <span className="mt-folder-tab-label">Tickets</span>
                  </div>
                  <div className="mt-folder-pocket">
                    <div className="mt-folder-pocket-inner" />
                  </div>
                </div>
                    <div className="mt-folder-caption-row">
                      <div className="mt-folder-caption">
                        <span className="mt-folder-caption-title">Tus tickets</span>
                        <span className="mt-folder-caption-count">
                          {loadingLista ? 'Cargando…' : `${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`}
                        </span>
                        <span className="mt-folder-caption-hint">
                          {carpetaAbierta ? 'Pulsa otra vez para cerrar' : 'Pulsa para ver tus tickets'}
                        </span>
                      </div>
                      <AppCollapsibleChevron className="mt-folder-chevron" />
                    </div>
                  </>
                }
              >
                <div className="mt-folder-drawer-head">
                  <div className="mt-folder-drawer-titles">
                    <p className="mt-folder-drawer-kicker">Lista</p>
                    <p className="mt-folder-drawer-lead">
                      {tickets.length > 0
                        ? 'Pulsa un ticket para ver todos los datos.'
                        : 'Aún no hay tickets. Sube una foto con el escáner de la izquierda.'}
                    </p>
                  </div>
                  <div className="mt-toolbar">
                    <a href="#mis-tickets-nuevo" className="mt-btn-ghost">
                      Añadir
                    </a>
                    <button
                      type="button"
                      className="btn-primary mt-btn-refresh"
                      onClick={loadGuardados}
                      disabled={loadingLista}
                    >
                      {loadingLista ? '…' : 'Actualizar'}
                    </button>
                  </div>
                </div>

                <div className="mt-folder-scroll">
                  {errorLista && (
                    <p className="mt-error" role="alert">
                      {errorLista}
                    </p>
                  )}

                  {loadingLista && !tickets.length ? (
                    <p className="mt-muted mt-lib-placeholder">Cargando…</p>
                  ) : !tickets.length ? (
                    <div className="mt-empty">
                      <span className="mt-empty-icon" aria-hidden>
                        📄
                      </span>
                      <p className="mt-empty-title">No hay tickets todavía</p>
                      <p className="mt-muted">Sube un ticket con el escáner; aparecerá aquí.</p>
                    </div>
                  ) : (
                    <ul className="mt-grid">
                      {tickets.map((t) => (
                        <li key={t.ticketId} className="mt-card-li">
                          <button
                            type="button"
                            className="mt-card mt-card-btn"
                            onClick={() => abrirDetalle(t.ticketId)}
                          >
                            <div className="mt-card-thumb-wrap">
                              {t.imagenExt ? (
                                <img
                                  className="mt-card-thumb"
                                  src={`/api/ticket-archivo/imagen?userId=${userId}&ticketId=${encodeURIComponent(t.ticketId)}`}
                                  alt=""
                                  loading="lazy"
                                />
                              ) : (
                                <div className="mt-card-thumb mt-card-thumb-placeholder" aria-hidden>
                                  🧾
                                </div>
                              )}
                            </div>
                            <div className="mt-card-body">
                              <p className="mt-card-title">{t.entidad || t.archivoOriginal || 'Ticket'}</p>
                              <p className="mt-card-total">{fmt(t.total)}</p>
                              <p className="mt-card-meta">
                                <span className={`mt-badge mt-badge-${t.estado === 'error' ? 'err' : 'ok'}`}>
                                  {estadoLabel(t.estado)}
                                </span>
                                {t.confirmadoEnBd && <span className="mt-badge mt-badge-bd">Finanzas</span>}
                              </p>
                              <p className="mt-card-date">
                                {t.creadoEn
                                  ? new Date(t.creadoEn).toLocaleDateString('es-ES', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : ''}
                              </p>
                              <span className="mt-card-hint">Ver detalle</span>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </AppCollapsible>
            </section>
          </div>
        </div>

        {detalleTicketId && (
          <div
            className="mt-modal-overlay"
            role="presentation"
            onClick={cerrarDetalle}
          >
            <div
              className="mt-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mt-detalle-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mt-modal-toolbar">
                <h2 id="mt-detalle-title" className="mt-modal-title">
                  Detalle del ticket
                </h2>
                <button type="button" className="mt-modal-close" onClick={cerrarDetalle} aria-label="Cerrar">
                  ×
                </button>
              </div>
              <div className="mt-modal-body">
                {detalleLoading && <p className="mt-muted">Cargando…</p>}
                {detalleError && (
                  <p className="mt-error" role="alert">
                    {detalleError}
                  </p>
                )}
                {!detalleLoading && detalle && (
                  <>
                    <dl className="mt-detalle-dl">
                      <div>
                        <dt>Fecha de la compra</dt>
                        <dd>{detalle.fechaGasto ? formatDiaTicket(detalle.fechaGasto) : '—'}</dd>
                      </div>
                      <div>
                        <dt>Recibido en la app</dt>
                        <dd>{formatTs(detalle.fechaSubidaWeb)}</dd>
                      </div>
                      <div>
                        <dt>En Finanzas</dt>
                        <dd>
                          {detalle.fechaAnadidoFinanzas
                            ? formatTs(detalle.fechaAnadidoFinanzas)
                            : 'Aún no guardado en Finanzas'}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-finanzas-hint">
                      Cuando confirmas, el <strong>importe</strong> pasa a Finanzas con la <strong>fecha de la
                      compra</strong>, para que cuadre con el mes que revisas.
                    </p>
                    {detalle.structured && (
                      <p className="mt-detalle-resumen">
                        <strong>{detalle.structured.entidad || '—'}</strong> · Total {fmt(detalle.structured.total)}
                      </p>
                    )}
                    {detalle.imagenExt ? (
                      <div className="mt-modal-thumb-wrap">
                        <img
                          className="mt-modal-thumb"
                          src={`/api/ticket-archivo/imagen?userId=${userId}&ticketId=${encodeURIComponent(detalle.ticketId)}`}
                          alt="Ticket"
                        />
                      </div>
                    ) : null}
                    <h3 className="mt-ocr-title">Texto leído en la foto</h3>
                    {detalle.textoOcrTruncado && (
                      <p className="mt-muted">Solo se muestra una parte del texto; el resto sigue asociado a tu ticket.</p>
                    )}
                    <pre className="mt-ocr-pre">{detalle.textoOcr || 'No hay texto guardado para este ticket.'}</pre>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <style>{`
          /* Toda la anchura disponible (columna principal), no capar a 1200px */
          .dashboard-layout .dashboard-main.mis-tickets-page {
            max-width: none;
            width: 100%;
            flex: 1 1 auto;
            min-width: 0;
            box-sizing: border-box;
            position: relative;
            z-index: 1;
            background: transparent !important;
          }
          .mis-tickets-page {
            padding-top: 20px;
            padding-bottom: 56px;
            min-height: 100vh;
            min-height: 100dvh;
            min-height: 100svh;
            background: transparent !important;
          }
          .mt-page-inner {
            max-width: 1120px;
            margin: 0 auto;
          }
          .mt-hero {
            margin-bottom: 28px;
            padding-bottom: 24px;
            border-bottom: 1px solid rgba(74, 69, 62, 0.1);
          }
          .mt-eyebrow {
            font-family: 'Poppins', var(--font-main);
            font-size: 0.68rem;
            font-weight: 600;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: #9a8b7a;
            margin: 0 0 6px;
          }
          .mt-title {
            margin-bottom: 0;
          }
          .mt-lead {
            margin-top: 12px;
            margin-bottom: 0;
            font-family: 'Lato', var(--font-main);
            font-size: 0.94rem;
            line-height: 1.6;
            color: #5c564c;
            max-width: 52rem;
          }
          .mt-lead code {
            font-size: 0.85em;
            background: rgba(74, 69, 62, 0.07);
            padding: 2px 7px;
            border-radius: 6px;
          }
          .mt-inline-link {
            color: #4a6f8f;
            font-weight: 600;
            text-decoration: none;
            border-bottom: 1px solid rgba(74, 111, 143, 0.35);
          }
          .mt-inline-link:hover {
            color: #355a78;
            border-bottom-color: rgba(53, 90, 120, 0.55);
          }
          .mt-sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
          }
          .mt-warn {
            margin-top: 14px;
            margin-bottom: 0;
            padding: 12px 16px;
            border-radius: 14px;
            background: linear-gradient(135deg, #fff5f0, #fde8e4);
            border: 1px solid rgba(200, 120, 100, 0.25);
            color: #6b2e22;
            font-size: 0.88rem;
            font-family: 'Lato', var(--font-main);
            max-width: 40rem;
          }
          .mt-layout {
            display: grid;
            grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
            gap: 22px 28px;
            align-items: start;
          }
          @media (max-width: 1024px) {
            .mt-layout {
              grid-template-columns: 1fr;
            }
          }
          .mt-panel {
            background: rgba(255, 255, 255, 0.94);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            border-radius: 22px;
            border: 1px solid rgba(255, 255, 255, 0.85);
            box-shadow:
              0 1px 0 rgba(255, 255, 255, 0.9) inset,
              0 14px 48px rgba(74, 69, 62, 0.07);
            overflow: hidden;
          }
          .mt-panel--folder {
            display: flex;
            flex-direction: column;
            overflow: hidden;
            min-height: 300px;
            background: linear-gradient(180deg, rgba(255, 252, 248, 0.98) 0%, rgba(245, 236, 224, 0.55) 100%);
            transition: box-shadow 0.28s ease;
          }
          .mt-panel--folder:has(.mt-folder-collapsible[data-state='open']) {
            box-shadow:
              0 1px 0 rgba(255, 255, 255, 0.95) inset,
              0 22px 56px rgba(120, 85, 45, 0.14);
          }
          .mt-folder-collapsible {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
          }
          .mt-folder-trigger {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            width: 100%;
            padding: 22px 22px 18px;
            margin: 0;
            border: none;
            border-bottom: 1px solid rgba(120, 90, 55, 0.12);
            background: transparent;
            cursor: pointer;
            font: inherit;
            text-align: left;
            transition: background 0.2s ease, transform 0.2s ease;
          }
          .mt-folder-trigger:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.35);
          }
          .mt-folder-trigger:disabled {
            opacity: 0.65;
            cursor: wait;
          }
          .mt-folder-trigger[data-state='open'] {
            background: rgba(255, 255, 255, 0.42);
          }
          .mt-folder-trigger[data-state='open'] .mt-folder-pocket {
            transform: translateY(2px) perspective(400px) rotateX(2deg);
          }
          .mt-folder-illustration {
            position: relative;
            height: 108px;
            margin: 0 8px 16px;
            filter: drop-shadow(0 14px 20px rgba(55, 40, 25, 0.18));
          }
          .mt-folder-tab {
            position: absolute;
            left: 10%;
            top: 0;
            width: 46%;
            max-width: 168px;
            height: 34px;
            z-index: 2;
            border-radius: 10px 10px 0 0;
            background: linear-gradient(180deg, #f0d4a8 0%, #deb887 55%, #cfa46e 100%);
            border: 1px solid rgba(110, 82, 48, 0.35);
            border-bottom: none;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .mt-folder-tab-label {
            font-family: 'Poppins', var(--font-main);
            font-size: 0.78rem;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: #5c4328;
          }
          .mt-folder-pocket {
            position: absolute;
            left: 0;
            right: 0;
            top: 28px;
            bottom: 0;
            border-radius: 4px 16px 16px 16px;
            background: linear-gradient(155deg, #c49655 0%, #b38242 38%, #9a6e38 100%);
            border: 1px solid rgba(70, 48, 28, 0.4);
            box-shadow:
              inset 0 2px 0 rgba(255, 255, 255, 0.18),
              inset 0 -12px 24px rgba(60, 40, 20, 0.15);
            transition: transform 0.25s ease;
          }
          .mt-folder-pocket-inner {
            position: absolute;
            left: 10px;
            right: 10px;
            top: 14px;
            bottom: 8px;
            border-radius: 6px;
            background: linear-gradient(180deg, rgba(255, 252, 245, 0.22) 0%, rgba(255, 255, 255, 0.06) 40%, transparent 100%);
            pointer-events: none;
          }
          .mt-folder-caption-row {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 12px;
            width: 100%;
            padding: 0 6px 2px;
          }
          .mt-folder-caption {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
            min-width: 0;
          }
          .mt-folder-chevron {
            color: #7a5a38;
            margin-bottom: 6px;
          }
          .mt-folder-caption-title {
            font-family: 'Poppins', var(--font-main);
            font-size: 0.95rem;
            font-weight: 700;
            color: #3d3428;
            letter-spacing: -0.02em;
          }
          .mt-folder-caption-count {
            font-family: 'Lato', var(--font-main);
            font-size: 0.88rem;
            font-weight: 600;
            color: #7a5a38;
          }
          .mt-folder-caption-hint {
            font-family: 'Lato', var(--font-main);
            font-size: 0.8rem;
            color: #8e7d6a;
            line-height: 1.4;
          }
          .mt-folder-drawer {
            border-top: 1px solid rgba(120, 90, 55, 0.1);
          }
          .mt-folder-drawer-head {
            display: flex;
            flex-wrap: wrap;
            align-items: flex-start;
            justify-content: space-between;
            gap: 14px 18px;
            padding: 16px 20px 12px;
            background: rgba(255, 255, 255, 0.5);
          }
          .mt-folder-drawer-kicker {
            margin: 0 0 4px;
            font-family: 'Poppins', var(--font-main);
            font-size: 0.62rem;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #9a8b7a;
          }
          .mt-folder-drawer-lead {
            margin: 0;
            font-family: 'Lato', var(--font-main);
            font-size: 0.84rem;
            line-height: 1.45;
            color: #6b6258;
            max-width: 22rem;
          }
          .mt-folder-scroll {
            padding: 4px 18px 20px;
            max-height: min(68vh, 640px);
            overflow-y: auto;
          }
          @media (max-width: 1024px) {
            .mt-folder-scroll {
              max-height: none;
            }
          }
          .mt-panel-head {
            padding: 20px 22px 16px;
            border-bottom: 1px solid rgba(74, 69, 62, 0.08);
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, transparent 100%);
          }
          .mt-panel-head--row {
            display: flex;
            flex-wrap: wrap;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px 20px;
          }
          .mt-panel-title {
            font-family: 'Poppins', var(--font-main);
            font-size: 1.12rem;
            font-weight: 600;
            color: #3a342c;
            margin: 0 0 6px;
            letter-spacing: -0.02em;
          }
          .mt-panel-desc {
            margin: 0;
            font-family: 'Lato', var(--font-main);
            font-size: 0.86rem;
            line-height: 1.5;
            color: #7a7166;
            max-width: 28rem;
          }
          .mt-toolbar {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-shrink: 0;
          }
          .mt-btn-ghost {
            font-family: 'Lato', var(--font-main);
            font-size: 0.86rem;
            font-weight: 600;
            color: #4a453e;
            text-decoration: none;
            padding: 9px 14px;
            border-radius: 12px;
            border: 1px solid rgba(74, 69, 62, 0.18);
            background: rgba(255, 255, 255, 0.6);
            transition: background 0.15s, border-color 0.15s;
          }
          .mt-btn-ghost:hover {
            background: rgba(255, 255, 255, 0.95);
            border-color: rgba(74, 69, 62, 0.28);
          }
          .mt-btn-refresh {
            min-width: 104px;
            padding-left: 16px !important;
            padding-right: 16px !important;
            background: #3d3830 !important;
          }
          .mt-panel-body {
            padding: 18px 20px 22px;
          }
          .mt-panel--add .smart-scanner-root {
            margin-bottom: 0;
          }
          .mt-panel-body--scroll {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            padding-top: 14px;
          }
          .mt-block {
            margin-bottom: 0;
          }
          .mt-error {
            color: #7a2420;
            background: #fdeded;
            border: 1px solid rgba(200, 100, 90, 0.25);
            padding: 12px 14px;
            border-radius: 14px;
            margin-bottom: 14px;
            font-size: 0.9rem;
            font-family: 'Lato', var(--font-main);
          }
          .mt-ok {
            color: #1a4d28;
            background: #e8f5eb;
            border: 1px solid rgba(80, 160, 100, 0.25);
            padding: 12px 14px;
            border-radius: 14px;
            margin-bottom: 16px;
            font-size: 0.9rem;
            font-family: 'Lato', var(--font-main);
            line-height: 1.45;
          }
          .mt-muted {
            color: #8e7d6a;
            font-size: 0.88rem;
            line-height: 1.45;
          }
          .mt-lib-placeholder {
            padding: 32px 16px;
            text-align: center;
          }
          .mt-empty {
            text-align: center;
            padding: 36px 20px 40px;
            border-radius: 16px;
            border: 1px dashed rgba(74, 69, 62, 0.15);
            background: rgba(255, 255, 255, 0.45);
          }
          .mt-empty-icon {
            display: block;
            font-size: 2.25rem;
            margin-bottom: 10px;
            opacity: 0.85;
          }
          .mt-empty-title {
            font-family: 'Poppins', var(--font-main);
            font-weight: 600;
            color: #4a453e;
            margin: 0 0 6px;
            font-size: 1rem;
          }
          .mt-grid {
            list-style: none;
            padding: 0;
            margin: 0;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 14px;
          }
          @media (min-width: 1200px) {
            .mt-grid {
              grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            }
          }
          .mt-card {
            padding: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: rgba(255, 255, 255, 0.88);
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.9);
            box-shadow: 0 8px 28px rgba(74, 69, 62, 0.06);
          }
          .mt-card-li {
            padding: 0;
            margin: 0;
          }
          .mt-card-btn {
            width: 100%;
            display: flex;
            flex-direction: column;
            cursor: pointer;
            text-align: left;
            font: inherit;
            color: inherit;
            padding: 0;
            margin: 0;
            border: none;
            border-radius: 16px;
            overflow: hidden;
            background: transparent;
            transition: transform 0.18s ease, box-shadow 0.18s ease;
          }
          .mt-card-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 14px 36px rgba(74, 69, 62, 0.1);
          }
          .mt-card-btn:focus-visible {
            outline: 2px solid #4a453e;
            outline-offset: 3px;
          }
          .mt-card-thumb-wrap {
            background: linear-gradient(160deg, #efe8df, #e4dcd2);
            min-height: 108px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .mt-card-thumb {
            width: 100%;
            max-height: 140px;
            object-fit: contain;
            display: block;
          }
          .mt-card-thumb-placeholder {
            color: #a89888;
            font-size: 1.75rem;
            padding: 32px;
          }
          .mt-card-body {
            padding: 12px 14px 14px;
          }
          .mt-card-title {
            font-family: 'Poppins', var(--font-main);
            font-weight: 600;
            color: #3a342c;
            font-size: 0.88rem;
            margin: 0 0 4px;
            line-height: 1.3;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .mt-card-total {
            font-family: 'Lato', var(--font-main);
            font-size: 1.05rem;
            color: #1f1c18;
            font-weight: 700;
            margin: 0 0 8px;
          }
          .mt-card-meta {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            margin: 0 0 6px;
          }
          .mt-badge {
            font-size: 0.62rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            padding: 4px 8px;
            border-radius: 8px;
            font-weight: 600;
          }
          .mt-badge-ok {
            background: #e4f0e8;
            color: #1d5c2e;
          }
          .mt-badge-err {
            background: #fce8e4;
            color: #8b2c2c;
          }
          .mt-badge-bd {
            background: #e8eef8;
            color: #1e3a5f;
          }
          .mt-card-date {
            font-size: 0.72rem;
            color: #8e7d6a;
            margin: 0 0 8px;
          }
          .mt-card-hint {
            display: inline-flex;
            align-items: center;
            font-size: 0.7rem;
            font-weight: 600;
            color: #6b5d4d;
            margin: 0;
            font-family: 'Lato', var(--font-main);
            letter-spacing: 0.02em;
          }
          .mt-card-hint::after {
            content: '→';
            margin-left: 5px;
            opacity: 0.65;
          }
          .mt-modal-overlay {
            position: fixed;
            inset: 0;
            z-index: 300;
            background: rgba(28, 24, 20, 0.48);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            overflow-y: auto;
          }
          .mt-modal {
            position: relative;
            width: 100%;
            max-width: 600px;
            max-height: min(90vh, 840px);
            display: flex;
            flex-direction: column;
            padding: 0;
            margin: auto;
            background: rgba(255, 255, 255, 0.97) !important;
            border-radius: 22px !important;
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.18);
            border: 1px solid rgba(255, 255, 255, 0.9) !important;
          }
          .mt-modal-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 18px 20px 14px;
            border-bottom: 1px solid rgba(74, 69, 62, 0.08);
            flex-shrink: 0;
          }
          .mt-modal-title {
            font-family: 'Poppins', var(--font-main);
            font-size: 1.05rem;
            font-weight: 600;
            color: #3a342c;
            margin: 0;
          }
          .mt-modal-close {
            flex-shrink: 0;
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 12px;
            background: rgba(74, 69, 62, 0.07);
            color: #4a453e;
            font-size: 1.35rem;
            line-height: 1;
            cursor: pointer;
            transition: background 0.15s;
          }
          .mt-modal-close:hover {
            background: rgba(74, 69, 62, 0.12);
          }
          .mt-modal-body {
            padding: 16px 20px 22px;
            overflow-y: auto;
            flex: 1;
            min-height: 0;
          }
          .mt-detalle-dl {
            margin: 0 0 16px;
            display: grid;
            gap: 14px;
            padding: 14px 16px;
            border-radius: 14px;
            background: rgba(74, 69, 62, 0.04);
            border: 1px solid rgba(74, 69, 62, 0.06);
          }
          .mt-detalle-dl > div {
            margin: 0;
          }
          .mt-detalle-dl dt {
            font-family: 'Poppins', var(--font-main);
            font-size: 0.65rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            color: #8e7d6a;
            margin-bottom: 5px;
          }
          .mt-detalle-dl dd {
            margin: 0;
            font-family: 'Lato', var(--font-main);
            font-size: 0.92rem;
            color: #2a241c;
            line-height: 1.45;
          }
          .mt-finanzas-hint {
            font-size: 0.84rem;
            color: #5c564c;
            line-height: 1.55;
            margin: 0 0 16px;
            padding: 12px 14px;
            background: rgba(255, 248, 240, 0.9);
            border-radius: 12px;
            border: 1px solid rgba(212, 197, 179, 0.45);
          }
          .mt-detalle-resumen {
            font-family: 'Lato', var(--font-main);
            font-size: 0.9rem;
            color: #4a453e;
            margin: 0 0 14px;
            padding: 10px 12px;
            border-radius: 10px;
            background: rgba(74, 69, 62, 0.04);
          }
          .mt-modal-thumb-wrap {
            background: #f0ebe4;
            border-radius: 14px;
            margin-bottom: 16px;
            display: flex;
            justify-content: center;
            max-height: 200px;
            overflow: hidden;
          }
          .mt-modal-thumb {
            max-width: 100%;
            max-height: 200px;
            object-fit: contain;
          }
          .mt-ocr-title {
            font-family: 'Poppins', var(--font-main);
            font-size: 0.82rem;
            font-weight: 600;
            color: #4a453e;
            margin: 0 0 8px;
          }
          .mt-ocr-pre {
            margin: 0 0 14px;
            padding: 14px 16px;
            max-height: 38vh;
            overflow: auto;
            white-space: pre-wrap;
            word-break: break-word;
            font-family: ui-monospace, monospace;
            font-size: 0.76rem;
            line-height: 1.5;
            color: #3d3830;
            background: #faf8f5;
            border: 1px solid rgba(212, 197, 179, 0.55);
            border-radius: 14px;
          }
        `}</style>
      </main>
    </div>
  )
}
