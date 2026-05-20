import { useCallback, useEffect, useRef, useState } from 'react'
import { CATEGORIAS_GASTO } from '../constants/categoriasGasto.js'

const INPUT_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'

/**
 * Escáner de ticket: subida de imagen → análisis automático → vista previa → confirmación y guardado en Finanzas.
 * @param {{ userId?: number, onSaved?: () => void }} props — onSaved se llama tras guardar en BD con éxito.
 */
export default function SmartScanner({ userId, onSaved }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [draft, setDraft] = useState(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const resetPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
  }

  const runScan = useCallback(
    async (file) => {
      if (!userId || !file) return
      setError('')
      setSuccess('')
      setDraft(null)
      setAnalyzing(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('userId', String(userId))
        const res = await fetch('/api/scan-ticket', {
          method: 'POST',
          body: fd,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'No se pudo analizar la imagen')
        const s = data.structured || null
        if (s) {
          setDraft({
            total: s.total,
            entidad: s.entidad,
            fecha: s.fecha,
            items: Array.isArray(s.items) ? s.items : [],
            categoria: '',
            ticketId: data.ticketId || null,
            carpetaRelativa: data.carpetaRelativa || null,
          })
        } else {
          setDraft(null)
        }
      } catch (e) {
        setError(e.message || 'Error de red')
        resetPreview()
      } finally {
        setAnalyzing(false)
      }
    },
    [userId]
  )

  const onFileChosen = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Usa una imagen (JPG, PNG o WebP).')
      return
    }
    setError('')
    setSuccess('')
    setDraft(null)
    resetPreview()
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    runScan(file)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFileChosen(f)
  }

  const confirmSave = async () => {
    if (!userId || !draft || saving) return
    if (!draft.categoria) {
      setError('Elige una categoría para poder guardar.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/save-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          total: draft.total,
          entidad: draft.entidad,
          fecha: draft.fecha,
          items: draft.items,
          categoria: draft.categoria,
          ticketId: draft.ticketId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      setSuccess(
        `Listo: ${data.guardado?.entidad} — ${Number(data.guardado?.monto).toFixed(2)} € · ${data.guardado?.categoria} · ${data.guardado?.fecha}.`
      )
      setDraft(null)
      resetPreview()
      onSaved?.()
    } catch (e) {
      setError(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const cancelDraft = () => {
    setDraft(null)
    setError('')
    resetPreview()
  }

  return (
    <div className="smart-scanner-root">
      <h2 className="scanner-section-title">Escáner inteligente</h2>
      <p className="scanner-section-lead">
        Arrastra la foto del ticket aquí o elige un archivo. Te mostramos el importe, la tienda y la fecha; nada se
        guarda en Finanzas hasta que pulses confirmar.
      </p>

      {error && (
        <div className="scanner-alert scanner-alert-error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="scanner-alert scanner-alert-ok" role="status">
          {success}
        </div>
      )}

      <div
        className={`opaque-card scanner-drop ${dragOver ? 'scanner-drop-active' : ''} ${analyzing ? 'scanner-drop-busy' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {analyzing && (
          <div className="scanner-loading-overlay" aria-live="polite">
            <div className="scanner-spinner" aria-hidden />
            <p className="scanner-loading-text">Analizando tu ticket…</p>
          </div>
        )}

        {previewUrl && !analyzing && (
          <img src={previewUrl} alt="Vista previa del ticket" className="scanner-thumb" />
        )}

        <div className="scanner-drop-inner">
          <p className="scanner-drop-title">Arrastra aquí tu imagen</p>
          <p className="scanner-drop-hint">JPG, PNG o WebP · máx. 10 MB</p>
          <button
            type="button"
            className="btn-primary scanner-browse-btn"
            disabled={!userId || analyzing}
            onClick={() => inputRef.current?.click()}
          >
            Elegir archivo
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={INPUT_ACCEPT}
            className="scanner-file-input"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) onFileChosen(f)
            }}
          />
        </div>
      </div>

      {draft && (
        <div className="opaque-card scanner-preview">
          <h3 className="scanner-preview-title">Vista previa</h3>
          <dl className="scanner-dl">
            <div>
              <dt>Total</dt>
              <dd>{Number(draft.total).toFixed(2)} €</dd>
            </div>
            <div>
              <dt>Entidad</dt>
              <dd>{draft.entidad}</dd>
            </div>
            <div>
              <dt>Fecha de la compra</dt>
              <dd className="scanner-dd-fecha">
                <input
                  type="date"
                  className="scanner-fecha-input"
                  value={draft.fecha && /^\d{4}-\d{2}-\d{2}$/.test(draft.fecha) ? draft.fecha : ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setDraft((d) => (d ? { ...d, fecha: v || d.fecha } : d))
                  }}
                  aria-label="Fecha de la compra en el ticket"
                />
                <span className="scanner-fecha-hint">La que sale en el ticket</span>
              </dd>
            </div>
            <div>
              <dt>Categoría del gasto</dt>
              <dd className="scanner-dd-cat">
                <select
                  className="scanner-cat-select"
                  value={draft.categoria || ''}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, categoria: e.target.value } : d))
                  }
                  aria-label="Categoría del gasto"
                >
                  <option value="">— Elige categoría —</option>
                  {CATEGORIAS_GASTO.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <span className="scanner-fecha-hint">Necesaria para guardarlo en Finanzas.</span>
              </dd>
            </div>
          </dl>
          {Array.isArray(draft.items) && draft.items.length > 0 && (
            <>
              <h4 className="scanner-items-title">Artículos</h4>
              <ul className="scanner-items">
                {draft.items.slice(0, 40).map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
                {draft.items.length > 40 && <li className="scanner-items-more">… y {draft.items.length - 40} más</li>}
              </ul>
            </>
          )}
          <div className="scanner-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={saving || !draft.categoria}
              onClick={confirmSave}
            >
              {saving ? 'Guardando…' : 'Confirmar y guardar'}
            </button>
            <button type="button" className="scanner-btn-ghost" disabled={saving} onClick={cancelDraft}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <style>{`
        .smart-scanner-root {
          margin-bottom: 28px;
        }
        .scanner-section-title {
          font-family: 'Poppins', var(--font-main);
          font-size: 1.2rem;
          font-weight: 600;
          color: #4a453e;
          margin-bottom: 6px;
        }
        .scanner-section-lead {
          font-family: 'Lato', var(--font-main);
          font-size: 0.92rem;
          color: #6b665f;
          line-height: 1.5;
          max-width: 40rem;
          margin-bottom: 16px;
        }
        .scanner-alert {
          padding: 12px 14px;
          border-radius: 14px;
          margin-bottom: 14px;
          font-size: 0.9rem;
          font-family: 'Lato', var(--font-main);
        }
        .scanner-alert-error {
          background: #fcecec;
          color: #7a2e24;
          border: 1px solid #e8c4c0;
        }
        .scanner-alert-ok {
          background: #e8f4ea;
          color: #1d5c2e;
          border: 1px solid #b8d9be;
        }
        .scanner-drop {
          position: relative;
          padding: 28px 24px;
          min-height: 200px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .scanner-drop-active {
          border-color: rgba(212, 197, 179, 0.95) !important;
          box-shadow: 0 12px 44px rgba(142, 125, 106, 0.12) !important;
        }
        .scanner-drop-busy {
          pointer-events: none;
        }
        .scanner-loading-overlay {
          position: absolute;
          inset: 0;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          background: rgba(255, 255, 255, 0.82);
          backdrop-filter: blur(6px);
          border-radius: 20px;
        }
        .scanner-spinner {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 3px solid #d4c5b3;
          border-top-color: #8e7d6a;
          animation: scanner-spin 0.75s linear infinite;
        }
        .scanner-loading-text {
          font-family: 'Poppins', var(--font-main);
          font-size: 0.95rem;
          color: #4a453e;
          font-weight: 500;
        }
        @keyframes scanner-spin {
          to {
            transform: rotate(360deg);
          }
        }
        .scanner-thumb {
          max-width: 100%;
          max-height: 200px;
          object-fit: contain;
          border-radius: 12px;
          margin-bottom: 16px;
          border: 1px solid rgba(212, 197, 179, 0.6);
        }
        .scanner-drop-inner {
          position: relative;
          z-index: 1;
        }
        .scanner-drop-title {
          font-family: 'Poppins', var(--font-main);
          font-weight: 600;
          color: #4a453e;
          margin-bottom: 6px;
        }
        .scanner-drop-hint {
          font-family: 'Lato', var(--font-main);
          font-size: 0.85rem;
          color: #6b665f;
          margin-bottom: 16px;
        }
        .scanner-browse-btn {
          background: #4a453e !important;
        }
        .scanner-browse-btn:hover:not(:disabled) {
          filter: brightness(1.08);
        }
        .scanner-file-input {
          display: none;
        }
        .scanner-preview {
          margin-top: 20px;
          padding: 24px 26px;
        }
        .scanner-preview-title {
          font-family: 'Poppins', var(--font-main);
          font-size: 1.05rem;
          font-weight: 600;
          color: #4a453e;
          margin-bottom: 16px;
        }
        .scanner-dl {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 12px 20px;
          margin-bottom: 16px;
        }
        .scanner-dl dt {
          font-family: 'Lato', var(--font-main);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #8e7d6a;
          margin-bottom: 4px;
        }
        .scanner-dl dd {
          font-family: 'Lato', var(--font-main);
          font-size: 0.95rem;
          color: #4a453e;
          font-weight: 600;
        }
        .scanner-dd-fecha {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
        }
        .scanner-fecha-input {
          font: inherit;
          font-size: 0.9rem;
          font-weight: 500;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid #d4c5b3;
          color: #4a453e;
          background: #fff;
        }
        .scanner-fecha-hint {
          font-size: 0.72rem;
          font-weight: 400;
          color: #8e7d6a;
          line-height: 1.35;
        }
        .scanner-dd-cat {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .scanner-cat-select {
          font: inherit;
          font-size: 0.9rem;
          font-weight: 500;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid #d4c5b3;
          color: #4a453e;
          background: #fff;
          max-width: 100%;
        }
        .scanner-items-title {
          font-family: 'Poppins', var(--font-main);
          font-size: 0.78rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #8e7d6a;
          margin: 8px 0 8px;
        }
        .scanner-items {
          list-style: disc;
          padding-left: 1.25rem;
          margin: 0 0 16px;
          font-family: 'Lato', var(--font-main);
          font-size: 0.88rem;
          color: #6b665f;
          line-height: 1.45;
          max-height: 220px;
          overflow-y: auto;
        }
        .scanner-items-more {
          list-style: none;
          margin-left: -1rem;
          font-style: italic;
          color: #8e7d6a;
        }
        .scanner-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 8px;
        }
        .scanner-btn-ghost {
          font-family: 'Lato', var(--font-main);
          padding: 11px 20px;
          border-radius: 980px;
          border: 1px solid #d4c5b3;
          background: rgba(255, 255, 255, 0.6);
          color: #4a453e;
          cursor: pointer;
        }
        .scanner-btn-ghost:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
