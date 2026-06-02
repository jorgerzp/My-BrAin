import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { parseTicketFechaFromString } from './ticketFecha.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Raíz: backend/server/data/nuevo-ticket/uploads/<usuarioId>/<ticketId>/ */
export const TICKETS_UPLOAD_ROOT = join(__dirname, 'data', 'nuevo-ticket', 'uploads')

export function generateTicketId() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${stamp}_${randomBytes(4).toString('hex')}`
}

export function ticketSessionDir(userId, ticketId) {
  return join(TICKETS_UPLOAD_ROOT, String(userId), ticketId)
}

/** Ruta relativa al directorio `backend/server/` (para mostrar en API). */
export function ticketRelativePathFromServer(userId, ticketId) {
  return ['data', 'nuevo-ticket', 'uploads', String(userId), ticketId].join('/')
}

function extFromMime(m) {
  if (!m) return '.jpg'
  if (m.includes('jpeg')) return '.jpg'
  if (m.includes('png')) return '.png'
  if (m.includes('webp')) return '.webp'
  return '.img'
}

function mergeManifest(dir, patch) {
  const p = join(dir, 'manifest.json')
  let m = {}
  if (existsSync(p)) {
    try {
      m = JSON.parse(readFileSync(p, 'utf8'))
    } catch {
      /* */
    }
  }
  writeFileSync(p, JSON.stringify({ ...m, ...patch }, null, 2), 'utf8')
}

/**
 * Crea la carpeta del ticket y guarda la imagen + manifest inicial.
 */
export function initTicketFolder(userId, ticketId, imageBuffer, mimetype, originalname) {
  const dir = ticketSessionDir(userId, ticketId)
  mkdirSync(dir, { recursive: true })
  const ext = extFromMime(mimetype)
  writeFileSync(join(dir, `imagen${ext}`), imageBuffer)
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify(
      {
        ticketId,
        userId,
        creadoEn: new Date().toISOString(),
        archivoOriginal: originalname ?? null,
        mime: mimetype ?? null,
        estado: 'imagen_guardada',
      },
      null,
      2
    ),
    'utf8'
  )
  return dir
}

export function writeTicketOcrText(userId, ticketId, text) {
  const dir = ticketSessionDir(userId, ticketId)
  writeFileSync(join(dir, 'ocr_extraccion.txt'), String(text ?? ''), 'utf8')
  mergeManifest(dir, {
    estado: 'ocr_completo',
    ocrCaracteres: String(text ?? '').length,
    ocrGuardadoEn: new Date().toISOString(),
  })
}

export function writeTicketStructured(userId, ticketId, model, structured) {
  const dir = ticketSessionDir(userId, ticketId)
  writeFileSync(
    join(dir, 'datos_estructurados.json'),
    JSON.stringify({ model, structured, generadoEn: new Date().toISOString() }, null, 2),
    'utf8'
  )
  mergeManifest(dir, {
    estado: 'ia_estructurado',
    modeloGroq: model ?? null,
    estructuraGuardadaEn: new Date().toISOString(),
  })
}

export function writeTicketError(userId, ticketId, mensaje) {
  const dir = ticketSessionDir(userId, ticketId)
  if (!existsSync(dir)) return
  writeFileSync(join(dir, 'error.log.txt'), String(mensaje ?? ''), 'utf8')
  mergeManifest(dir, { estado: 'error', error: String(mensaje ?? '').slice(0, 2000) })
}

/**
 * Marca que el usuario confirmó el guardado en BD (opcional, si se envía ticketId en save-ticket).
 */
export function writeTicketConfirmadoEnBd(userId, ticketId, payload) {
  const dir = ticketSessionDir(userId, ticketId)
  if (!existsSync(dir)) return false
  writeFileSync(
    join(dir, 'confirmado_en_bd.json'),
    JSON.stringify({ ...payload, confirmadoEn: new Date().toISOString() }, null, 2),
    'utf8'
  )
  mergeManifest(dir, { estado: 'confirmado_bd', confirmadoEn: new Date().toISOString() })
  return true
}

/** Lista carpetas de tickets guardados para un usuario (orden: más reciente primero). */
export function listSavedTicketsForUser(userId) {
  const uid = String(userId)
  const userDir = join(TICKETS_UPLOAD_ROOT, uid)
  if (!existsSync(userDir)) return []

  const ticketIds = readdirSync(userDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  const list = []
  for (const ticketId of ticketIds) {
    const dir = join(userDir, ticketId)
    let manifest = {}
    let structured = null
    try {
      manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
    } catch {
      /* */
    }
    try {
      const d = JSON.parse(readFileSync(join(dir, 'datos_estructurados.json'), 'utf8'))
      structured = d.structured ?? null
    } catch {
      /* */
    }
    const imagenExt = ['.jpg', '.png', '.webp', '.img'].find((ext) => existsSync(join(dir, `imagen${ext}`))) || null

    list.push({
      ticketId,
      carpetaRelativa: ticketRelativePathFromServer(uid, ticketId),
      estado: manifest.estado ?? null,
      creadoEn: manifest.creadoEn ?? null,
      archivoOriginal: manifest.archivoOriginal ?? null,
      entidad: structured?.entidad ?? null,
      total: structured?.total != null ? Number(structured.total) : null,
      imagenExt,
      confirmadoEnBd: existsSync(join(dir, 'confirmado_en_bd.json')),
    })
  }

  list.sort((a, b) => String(b.creadoEn || '').localeCompare(String(a.creadoEn || '')))
  return list
}

const MAX_DETALLE_OCR_CHARS = 150_000

/**
 * Lee manifest, OCR, datos estructurados y confirmación BD para un ticket del usuario.
 * @returns {object | null}
 */
export function getTicketDetailForUser(userId, ticketId) {
  const uid = String(userId)
  const tid = String(ticketId || '').trim()
  if (!tid || /[\\/]/.test(tid) || tid.length > 200) return null
  const dir = ticketSessionDir(uid, tid)
  if (!existsSync(dir)) return null

  let manifest = {}
  try {
    manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
  } catch {
    /* */
  }

  let textoOcr = ''
  const ocrPath = join(dir, 'ocr_extraccion.txt')
  if (existsSync(ocrPath)) {
    try {
      textoOcr = readFileSync(ocrPath, 'utf8')
    } catch {
      /* */
    }
  }
  const ocrTruncado = textoOcr.length > MAX_DETALLE_OCR_CHARS

  let datosEstructurados = null
  const dsPath = join(dir, 'datos_estructurados.json')
  if (existsSync(dsPath)) {
    try {
      datosEstructurados = JSON.parse(readFileSync(dsPath, 'utf8'))
    } catch {
      /* */
    }
  }

  let confirmadoEnBd = null
  const cPath = join(dir, 'confirmado_en_bd.json')
  if (existsSync(cPath)) {
    try {
      confirmadoEnBd = JSON.parse(readFileSync(cPath, 'utf8'))
    } catch {
      /* */
    }
  }

  const structured = datosEstructurados?.structured ?? null
  let fechaGasto =
    structured?.fecha != null && structured.fecha !== ''
      ? parseTicketFechaFromString(String(structured.fecha))
      : null
  if (!fechaGasto && confirmadoEnBd?.fecha != null && confirmadoEnBd.fecha !== '') {
    fechaGasto = parseTicketFechaFromString(String(confirmadoEnBd.fecha))
  }

  return {
    ticketId: tid,
    carpetaRelativa: ticketRelativePathFromServer(uid, tid),
    textoOcr: ocrTruncado ? textoOcr.slice(0, MAX_DETALLE_OCR_CHARS) : textoOcr,
    textoOcrTruncado: ocrTruncado,
    fechaGasto,
    fechaSubidaWeb: manifest.creadoEn ?? null,
    fechaAnadidoFinanzas: confirmadoEnBd?.confirmadoEn ?? null,
    manifest: {
      estado: manifest.estado ?? null,
      creadoEn: manifest.creadoEn ?? null,
      archivoOriginal: manifest.archivoOriginal ?? null,
      ocrGuardadoEn: manifest.ocrGuardadoEn ?? null,
      confirmadoEn: manifest.confirmadoEn ?? null,
    },
    structured,
    datosEstructuradosMeta: datosEstructurados
      ? {
          model: datosEstructurados.model ?? null,
          generadoEn: datosEstructurados.generadoEn ?? null,
        }
      : null,
    confirmadoEnBd,
    imagenExt: ['.jpg', '.png', '.webp', '.img'].find((ext) => existsSync(join(dir, `imagen${ext}`))) || null,
  }
}
