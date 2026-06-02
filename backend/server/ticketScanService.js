import { createWorker } from 'tesseract.js'
import { groqChatCompletion, safeParseJsonFromModel } from './ai/groq.js'

import { parseTicketFechaFromString } from './ticketFecha.js'

/** Ingresos en Finanzas */
export const CATEGORIAS_INGRESO = Object.freeze(['Nómina', 'Otros'])
const ALLOWED_INGRESO = new Set(CATEGORIAS_INGRESO)

/** Gastos manuales y tickets (escáner / texto IA) */
export const CATEGORIAS_GASTO = Object.freeze([
  'Vivienda y Suministros',
  'Alimentación',
  'Transporte',
  'Salud y Cuidado Personal',
  'Ocio y Estilo de Vida',
  'Finanzas',
  'Otros',
])
const ALLOWED_GASTO = new Set(CATEGORIAS_GASTO)

export function assertCategoriaIngresoEleccion(raw) {
  const s = String(raw ?? '').trim()
  return ALLOWED_INGRESO.has(s) ? s : null
}

export function assertCategoriaGastoEleccion(raw) {
  const s = String(raw ?? '').trim()
  return ALLOWED_GASTO.has(s) ? s : null
}

/** Lecturas legacy / datos antiguos (tickets o filas antiguas) */
export function normalizeCategoria(raw) {
  const s = String(raw || '').trim()
  if (ALLOWED_GASTO.has(s)) return s
  const legacy = {
    Supermercado: 'Alimentación',
    'Supermercado ': 'Alimentación',
    Restauración: 'Ocio y Estilo de Vida',
    Ingreso: 'Otros',
    Nómina: 'Otros',
  }
  if (legacy[s] != null) return legacy[s]
  return 'Otros'
}

const RECEIPT_SYSTEM = `Eres un experto analizador de recibos de compra. A partir del texto OCR del ticket, devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta (sin texto antes ni después):
{ "total": <número float>, "entidad": "<nombre comercial limpio>", "fecha": "<YYYY-MM-DD o null>", "items": [<strings>] }

Campo "entidad": nombre del comercio en español, sin ruido de OCR (corrige letras sueltas erróneas si son obvias). Sin direcciones largas si el nombre ya es claro.

Campo "fecha": fecha de la compra en el ticket en formato ISO YYYY-MM-DD. Si aparece en español DD/MM/AAAA, conviértela. Si no es legible, null.

Campo "items" — lista de productos o servicios cobrados (no la categoría; eso lo elige el usuario aparte):
- Cada elemento: una sola línea en español, nombre del producto legible y breve (ideal ≤ 70 caracteres), capitalización natural (ej. "Leche semidesnatada 1 L").
- Corrige errores típicos de OCR en nombres (confusiones I/l, 0/O solo si es evidente).
- No incluyas cabeceras de tabla, líneas solo numéricas, subtotales, IVA desglosado, "TOTAL", "CAMBIO", "GRACIAS POR SU VISITA", códigos de barras ni NIF/CIF.
- Si una línea mezcla cantidad y nombre, deja el nombre del producto sin la cantidad repetida al final si ya está claro.
- Si no hay productos claros, devuelve [].

No incluyas claves extra. No incluyas "categoria" en el JSON.`

/**
 * OCR en memoria (spa+eng). Puede tardar la primera vez (descarga de idiomas).
 * @param {Buffer} buffer
 */
export async function ocrTicketImage(buffer) {
  const worker = await createWorker('spa+eng', 1, { logger: () => {} })
  try {
    const {
      data: { text },
    } = await worker.recognize(buffer)
    return String(text || '').trim()
  } finally {
    await worker.terminate().catch(() => {})
  }
}

/**
 * @param {string} apiKey
 * @param {string} ocrText
 */
export async function structureReceiptFromOcr(apiKey, ocrText) {
  const trimmed = String(ocrText || '').trim().slice(0, 14000)
  if (!trimmed) {
    throw new Error('No se obtuvo texto legible del OCR.')
  }

  const { text, model } = await groqChatCompletion(
    apiKey,
    [
      { role: 'system', content: RECEIPT_SYSTEM },
      { role: 'user', content: trimmed },
    ],
    { temperature: 0.1, maxOutputTokens: 4096 }
  )

  const parsed = safeParseJsonFromModel(text)
  if (!parsed.ok) {
    const err = new Error(`La IA no devolvió JSON válido: ${parsed.error}`)
    err.raw = parsed.raw
    err.modelText = text?.slice(0, 800)
    throw err
  }

  const o = parsed.value
  const total = Number(o?.total)
  const entidad = String(o?.entidad || '').trim().slice(0, 120) || 'Comercio'
  const fechaNorm = parseTicketFechaFromString(o?.fecha != null ? String(o.fecha) : '')
  const fecha = fechaNorm ?? new Date().toISOString().slice(0, 10)
  const items = Array.isArray(o?.items) ? o.items.map((x) => String(x).trim()).filter(Boolean) : []

  if (!Number.isFinite(total) || total <= 0) {
    const err = new Error('El JSON no contiene un total numérico válido.')
    err.modelText = text?.slice(0, 800)
    throw err
  }

  return {
    model,
    structured: { total, entidad, fecha, items },
  }
}
