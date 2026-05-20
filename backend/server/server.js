import './load-env.js'
import http from 'node:http'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcrypt'
import multer from 'multer'
import { initDatabase, pool, withTransaction } from './sqlite-db.js'
import { groqGenerateText, parseJsonFromModel, groqChatCompletion, safeParseJsonFromModel } from './ai/groq.js'
import { parseTicketFechaOrToday } from './ticketFecha.js'
import {
  ocrTicketImage,
  structureReceiptFromOcr,
  assertCategoriaGastoEleccion,
  assertCategoriaIngresoEleccion,
  CATEGORIAS_GASTO,
} from './ticketScanService.js'
import {
  generateTicketId,
  initTicketFolder,
  writeTicketOcrText,
  writeTicketStructured,
  writeTicketError,
  writeTicketConfirmadoEnBd,
  ticketRelativePathFromServer,
  listSavedTicketsForUser,
  ticketSessionDir,
  getTicketDetailForUser,
} from './ticketStorage.js'

await initDatabase()

/** Claves Groq suelen empezar por `gsk_` */
const GROQ_KEY = (() => {
  const k = process.env.GROQ_API_KEY?.trim()
  return k && k.startsWith('gsk_') ? k : ''
})()

const app = express()
const PREFERRED_PORT = Number(process.env.PORT) || 3001
const __serverDir = dirname(fileURLToPath(import.meta.url))
const DEV_API_PORT_FILE = join(__serverDir, '.dev-api-port')

const ticketUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/i.test(file.mimetype)) cb(null, true)
    else cb(new Error('Formato no permitido. Usa JPG, PNG o WebP.'))
  },
})

function parseTicketFechaBody(s) {
  return parseTicketFechaOrToday(s)
}

// Middleware
app.use(cors())
app.use(express.json())

// ============================================
// RUTAS DE AUTENTICACIÓN
// ============================================

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' })
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id, username, nombre, email, password, avatar FROM usuarios WHERE username = ?',
      [username]
    )

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })
    }

    const user = rows[0]
    const passwordMatch = await bcrypt.compare(password, user.password)

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })
    }

    // Devolver usuario sin la contraseña
    const { password: _, ...userData } = user
    res.json({ user: userData })
  } catch (err) {
    console.error('Error en login:', err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { username, nombre, email, password } = req.body

  if (!username || !nombre || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' })
  }

  try {
    // Comprobar si ya existe el usuario o email
    const [existing] = await pool.execute(
      'SELECT id FROM usuarios WHERE username = ? OR email = ?',
      [username, email]
    )

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese usuario o email' })
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10)

    const [result] = await pool.execute(
      'INSERT INTO usuarios (username, nombre, email, password) VALUES (?, ?, ?, ?)',
      [username, nombre, email, hashedPassword]
    )

    const user = {
      id: result.insertId,
      username,
      nombre,
      email,
    }

    res.status(201).json({ user })
  } catch (err) {
    console.error('Error en register:', err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/auth/me (verificar sesión)
app.get('/api/auth/me', async (req, res) => {
  // Por ahora sin JWT, solo validación básica
  res.json({ ok: true })
})

function parseUserId(req) {
  const q = req.query.userId ?? req.body?.userId
  const id = parseInt(String(q), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

// ============================================
// FINANZAS
// ============================================

app.get('/api/finanzas/movimientos', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  const year = parseInt(req.query.year, 10) || new Date().getFullYear()
  const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1

  try {
    const [rows] = await pool.execute(
      `SELECT id, tipo, monto, categoria, descripcion, fecha, hucha_id, created_at
       FROM movimientos_financieros
       WHERE usuario_id = ? AND strftime('%Y', fecha) = ? AND CAST(strftime('%m', fecha) AS INTEGER) = ?
       ORDER BY fecha DESC, id DESC`,
      [userId, String(year), month]
    )
    res.json({ movimientos: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar movimientos' })
  }
})

// GET /api/finanzas/gastos-por-categoria — gastos del mes agrupados (manual + tickets)
app.get('/api/finanzas/gastos-por-categoria', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  const year = parseInt(req.query.year, 10) || new Date().getFullYear()
  const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1

  try {
    const [rows] = await pool.execute(
      `SELECT id, monto, categoria, descripcion, fecha
       FROM movimientos_financieros
       WHERE usuario_id = ? AND tipo = 'gasto'
         AND strftime('%Y', fecha) = ? AND CAST(strftime('%m', fecha) AS INTEGER) = ?
       ORDER BY COALESCE(categoria, '') ASC, fecha DESC, id DESC`,
      [userId, String(year), month]
    )
    const byCat = new Map()
    for (const r of rows) {
      const cat = (r.categoria && String(r.categoria).trim()) || 'Sin categoría'
      if (!byCat.has(cat)) {
        byCat.set(cat, { categoria: cat, total: 0, lineas: [] })
      }
      const g = byCat.get(cat)
      const m = Number(r.monto) || 0
      g.total += m
      g.lineas.push({
        id: r.id,
        monto: m,
        descripcion: r.descripcion,
        fecha: r.fecha,
      })
    }
    const grupos = Array.from(byCat.values()).sort((a, b) => b.total - a.total)
    const totalMes = grupos.reduce((s, g) => s + g.total, 0)
    res.json({ year, month, totalMes, grupos })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar gastos por categoría' })
  }
})

app.get('/api/finanzas/resumen', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  const year = parseInt(req.query.year, 10) || new Date().getFullYear()
  const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1

  try {
    const [ing] = await pool.execute(
      `SELECT COALESCE(SUM(monto), 0) AS total FROM movimientos_financieros
       WHERE usuario_id = ? AND tipo = 'ingreso' AND strftime('%Y', fecha) = ? AND CAST(strftime('%m', fecha) AS INTEGER) = ?`,
      [userId, String(year), month]
    )
    const [gas] = await pool.execute(
      `SELECT COALESCE(SUM(monto), 0) AS total FROM movimientos_financieros
       WHERE usuario_id = ? AND tipo = 'gasto' AND strftime('%Y', fecha) = ? AND CAST(strftime('%m', fecha) AS INTEGER) = ?`,
      [userId, String(year), month]
    )
    const [ahorroRows] = await pool.execute(
      `SELECT COALESCE(SUM(monto), 0) AS total FROM movimientos_financieros
       WHERE usuario_id = ? AND tipo = 'aportacion_hucha' AND strftime('%Y', fecha) = ? AND CAST(strftime('%m', fecha) AS INTEGER) = ?`,
      [userId, String(year), month]
    )
    const ingresos = Number(ing[0]?.total ?? 0)
    const gastos = Number(gas[0]?.total ?? 0)
    const ahorro_aportado = Number(ahorroRows[0]?.total ?? 0)
    const balance = ingresos - gastos - ahorro_aportado
    res.json({ ingresos, gastos, ahorro_aportado, balance })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al calcular resumen' })
  }
})

app.post('/api/finanzas/movimientos', async (req, res) => {
  const userId = parseUserId(req)
  const { tipo, monto, categoria, descripcion, fecha, hucha_id } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!['ingreso', 'gasto', 'aportacion_hucha'].includes(tipo)) {
    return res.status(400).json({ error: 'tipo debe ser ingreso, gasto o aportacion_hucha' })
  }
  const hid = hucha_id != null ? parseInt(String(hucha_id), 10) : null
  if (tipo === 'aportacion_hucha') {
    if (!Number.isFinite(hid) || hid <= 0) {
      return res.status(400).json({ error: 'aportacion_hucha requiere hucha_id válido' })
    }
  }
  const cantidad = Number(monto)
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return res.status(400).json({ error: 'monto inválido' })
  }
  if (!fecha) return res.status(400).json({ error: 'fecha requerida' })

  let categoriaInsert = categoria?.slice(0, 80) || null
  if (tipo === 'gasto') {
    const cat = assertCategoriaGastoEleccion(categoria)
    if (!cat) {
      return res.status(400).json({
        error: `Para gastos elige una categoría: ${CATEGORIAS_GASTO.join(', ')}.`,
      })
    }
    categoriaInsert = cat
  } else if (tipo === 'ingreso') {
    const cat = assertCategoriaIngresoEleccion(categoria)
    if (!cat) {
      return res.status(400).json({
        error: 'Para ingresos elige categoría: Nómina u Otros.',
      })
    }
    categoriaInsert = cat
  } else if (tipo === 'aportacion_hucha') {
    categoriaInsert = null
  }

  try {
    if (tipo === 'aportacion_hucha') {
      const [huchaRows] = await pool.execute(`SELECT id FROM huchas_ahorro WHERE id = ? AND usuario_id = ?`, [
        hid,
        userId,
      ])
      if (!huchaRows?.length) return res.status(400).json({ error: 'Hucha no encontrada' })
    }

    const [result] = await pool.execute(
      `INSERT INTO movimientos_financieros (usuario_id, tipo, monto, categoria, descripcion, fecha, hucha_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        tipo,
        cantidad,
        categoriaInsert,
        descripcion?.slice(0, 500) || null,
        fecha,
        tipo === 'aportacion_hucha' ? hid : null,
      ]
    )

    if (tipo === 'aportacion_hucha') {
      await pool.execute(`UPDATE huchas_ahorro SET saldo = saldo + ? WHERE id = ? AND usuario_id = ?`, [
        cantidad,
        hid,
        userId,
      ])
    }

    res.status(201).json({
      movimiento: {
        id: result.insertId,
        usuario_id: userId,
        tipo,
        monto: cantidad,
        categoria: categoriaInsert,
        descripcion,
        fecha,
        hucha_id: tipo === 'aportacion_hucha' ? hid : null,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo guardar el movimiento' })
  }
})

app.delete('/api/finanzas/movimientos/:id', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido (query)' })

  const id = parseInt(req.params.id, 10)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' })

  try {
    const [prevRows] = await pool.execute(
      `SELECT tipo, monto, hucha_id FROM movimientos_financieros WHERE id = ? AND usuario_id = ?`,
      [id, userId]
    )
    const prev = prevRows[0]
    if (!prev) return res.status(404).json({ error: 'No encontrado' })

    const [r] = await pool.execute(
      'DELETE FROM movimientos_financieros WHERE id = ? AND usuario_id = ?',
      [id, userId]
    )
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' })

    if (prev.tipo === 'aportacion_hucha' && prev.hucha_id) {
      await pool.execute(
        `UPDATE huchas_ahorro SET saldo = saldo - ? WHERE id = ? AND usuario_id = ?`,
        [Number(prev.monto), prev.hucha_id, userId]
      )
    }

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar' })
  }
})

// --- Huchas de ahorro ---
app.get('/api/finanzas/huchas', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  try {
    const [rows] = await pool.execute(
      `SELECT id, nombre, objetivo, saldo, orden, created_at FROM huchas_ahorro
       WHERE usuario_id = ? ORDER BY orden ASC, id ASC`,
      [userId]
    )
    res.json({ huchas: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar huchas' })
  }
})

app.post('/api/finanzas/huchas', async (req, res) => {
  const userId = parseUserId(req)
  const { nombre, objetivo, orden } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!nombre?.trim()) return res.status(400).json({ error: 'nombre requerido' })
  try {
    const obj = objetivo != null && objetivo !== '' ? Number(objetivo) : null
    const ord = orden != null ? parseInt(String(orden), 10) : 0
    const [result] = await pool.execute(
      `INSERT INTO huchas_ahorro (usuario_id, nombre, objetivo, orden) VALUES (?, ?, ?, ?)`,
      [userId, nombre.trim().slice(0, 120), Number.isFinite(obj) ? obj : null, Number.isFinite(ord) ? ord : 0]
    )
    res.status(201).json({ id: result.insertId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo crear la hucha' })
  }
})

app.patch('/api/finanzas/huchas/:id', async (req, res) => {
  const userId = parseUserId(req)
  const id = parseInt(req.params.id, 10)
  const { nombre, objetivo, orden } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' })
  try {
    const fields = []
    const vals = []
    if (nombre != null) {
      fields.push('nombre = ?')
      vals.push(String(nombre).trim().slice(0, 120))
    }
    if (objetivo !== undefined) {
      fields.push('objetivo = ?')
      vals.push(objetivo === null || objetivo === '' ? null : Number(objetivo))
    }
    if (orden !== undefined) {
      fields.push('orden = ?')
      vals.push(parseInt(String(orden), 10) || 0)
    }
    if (fields.length === 0) return res.status(400).json({ error: 'Nada que actualizar' })
    vals.push(id, userId)
    const [r] = await pool.execute(
      `UPDATE huchas_ahorro SET ${fields.join(', ')} WHERE id = ? AND usuario_id = ?`,
      vals
    )
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar' })
  }
})

app.delete('/api/finanzas/huchas/:id', async (req, res) => {
  const userId = parseUserId(req)
  const id = parseInt(req.params.id, 10)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' })
  try {
    const [r] = await pool.execute(`DELETE FROM huchas_ahorro WHERE id = ? AND usuario_id = ?`, [id, userId])
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar' })
  }
})

// --- Eventos próximos ---
app.get('/api/eventos', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  const hoy = new Date().toISOString().slice(0, 10)
  try {
    const [rows] = await pool.execute(
      `SELECT id, titulo, fecha_evento, descripcion, created_at FROM eventos
       WHERE usuario_id = ? AND fecha_evento >= ?
       ORDER BY fecha_evento ASC, id ASC`,
      [userId, hoy]
    )
    res.json({ eventos: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: sqliteFriendlyError(err, 'Error al cargar eventos') })
  }
})

app.post('/api/eventos', async (req, res) => {
  const userId = parseUserId(req)
  const { titulo, fecha_evento, descripcion } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!titulo?.trim()) return res.status(400).json({ error: 'titulo requerido' })
  if (!fecha_evento?.trim()) return res.status(400).json({ error: 'fecha del evento requerida' })

  try {
    const [result] = await pool.execute(
      `INSERT INTO eventos (usuario_id, titulo, fecha_evento, descripcion) VALUES (?, ?, ?, ?)`,
      [
        userId,
        titulo.trim().slice(0, 200),
        String(fecha_evento).trim().slice(0, 10),
        descripcion?.trim() ? descripcion.trim().slice(0, 500) : null,
      ]
    )
    res.status(201).json({ id: result.insertId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo crear el evento' })
  }
})

app.delete('/api/eventos/:id', async (req, res) => {
  const userId = parseUserId(req)
  const id = parseInt(req.params.id, 10)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' })
  try {
    const [r] = await pool.execute(`DELETE FROM eventos WHERE id = ? AND usuario_id = ?`, [id, userId])
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar' })
  }
})

// ============================================
// ALIMENTACIÓN — menús y lista de compra
// ============================================

const PLATOS_SUGERIDOS = {
  desayuno: [
    'Avena con frutos rojos y nueces',
    'Tostadas integrales con aguacate y huevo',
    'Yogur griego con granola y miel',
    'Tortilla francesa con espárragos',
    'Pan integral con tomate y aceite de oliva',
    'Smoothie de plátano y espinacas',
    'Chía pudding con mango',
  ],
  comida: [
    'Pollo al horno con verduras asadas',
    'Ensalada de quinoa, garbanzos y feta',
    'Salmón a la plancha con arroz integral',
    'Lentejas estofadas con verduras',
    'Pasta integral con pesto y cherry',
    'Merluza en salsa verde con patata',
    'Arroz con verduras y tofu salteado',
  ],
  cena: [
    'Crema de calabaza y zanahoria',
    'Ensalada mixta con atún y huevo',
    'Sopa de miso con tofu y algas',
    'Revuelto de setas y espárragos',
    'Tortilla de patata ligera con ensalada',
    'Pescado al vapor con brócoli',
    'Wrap de pollo y verduras a la plancha',
  ],
}

function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length]
}

function normListaItem(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 200)
}

/** Ítems que no son compra: eco de modelo, “IA (…)”, slugs Groq/OpenAI, etc. */
function itemListaCompraEsRuidoTecnico(s) {
  const raw = normListaItem(s)
  if (!raw) return true
  const t = raw.toLowerCase()
  if (/^ia\s*\(/.test(t)) return true
  if (/^modelo\s*\(/.test(t)) return true
  if (/\(llama[-.]\d/i.test(raw) || /\(gpt[-_\d]/i.test(raw) || /\(claude/i.test(raw)) return true
  if (/\bmeta[-_]?llama\b/i.test(t)) return true
  if (/-versatile\b/i.test(t) || /\d+b-versatile/i.test(t)) return true
  if (/\bllama[-_.]\d+\.\d+/i.test(t)) return true
  if (/\bgroq\b|\bopenai\b|\banthropic\b/i.test(t)) return true
  if (/\bgpt[-_]?\d/i.test(t) || /\bclaude[-_]?\d/i.test(t)) return true
  return false
}

function filtrarProductosListaCompra(arr) {
  if (!Array.isArray(arr)) return []
  const out = []
  for (const p of arr) {
    if (p == null) continue
    const s = typeof p === 'string' ? p.trim() : typeof p === 'number' && Number.isFinite(p) ? String(p) : ''
    if (!s || itemListaCompraEsRuidoTecnico(s)) continue
    out.push(s)
  }
  return out
}

/** Quita filas ya guardadas que sean ruido técnico (p. ej. eco del modelo en JSON). */
async function eliminarListaCompraItemsRuidoTecnico(userId) {
  const [rows] = await pool.execute(`SELECT id, item FROM lista_compra WHERE usuario_id = ?`, [userId])
  for (const r of rows || []) {
    if (itemListaCompraEsRuidoTecnico(r.item)) {
      await pool.execute(`DELETE FROM lista_compra WHERE id = ? AND usuario_id = ?`, [r.id, userId])
    }
  }
}

/** "Huevos x3" → nombre canónico + factor (para sumar sin filas duplicadas). */
function splitListaNombreCantidad(itemStr) {
  const t = normListaItem(itemStr)
  const m = t.match(/^(.+?)\s*(?:x|×)\s*(\d+)\s*$/i)
  if (m) {
    const qty = Math.min(9999, Math.max(1, parseInt(m[2], 10) || 1))
    return { nombre: normListaItem(m[1]).slice(0, 200), qtyMul: qty }
  }
  return { nombre: t.slice(0, 200), qtyMul: 1 }
}

/** Agrupa líneas repetidas del mismo producto sumando unidades. */
function aggregateProductosLista(productos) {
  const map = new Map()
  for (const p of productos) {
    const item = normListaItem(p)
    if (!item || itemListaCompraEsRuidoTecnico(item)) continue
    const { nombre, qtyMul } = splitListaNombreCantidad(item)
    const canon = nombre
    if (!canon) continue
    const key = canon.toLowerCase()
    const prev = map.get(key)
    const add = qtyMul
    if (!prev) map.set(key, { nombre: canon, cantidad: add })
    else prev.cantidad = Math.min(9999, prev.cantidad + add)
  }
  return [...map.values()]
}

async function listaCompraSumarCantidad(userId, nombreRaw, unidadesExtra = 1) {
  const { nombre, qtyMul } = splitListaNombreCantidad(nombreRaw)
  const canon = normListaItem(nombre).slice(0, 200)
  const u = Math.floor(Number(unidadesExtra) || 1)
  const add = Math.min(9999, Math.max(1, u * qtyMul))
  if (!canon || add <= 0 || itemListaCompraEsRuidoTecnico(canon)) return { ok: false, unidades: 0 }

  const [rows] = await pool.execute(
    `SELECT id, COALESCE(cantidad, 1) AS cantidad FROM lista_compra WHERE usuario_id = ? AND LOWER(TRIM(item)) = LOWER(?)`,
    [userId, canon]
  )
  if (!rows.length) {
    await pool.execute(
      `INSERT INTO lista_compra (usuario_id, item, cantidad, comprado) VALUES (?, ?, ?, 0)`,
      [userId, canon, add]
    )
    return { ok: true, unidades: add }
  }
  const nueva = Math.min(9999, (Number(rows[0].cantidad) || 1) + add)
  await pool.execute(`UPDATE lista_compra SET cantidad = ? WHERE id = ? AND usuario_id = ?`, [
    nueva,
    rows[0].id,
    userId,
  ])
  return { ok: true, unidades: add }
}

/**
 * Une filas duplicadas (mismo producto normalizado y mismo comprado) sumando cantidades.
 * Mantiene el id más bajo y borra el resto.
 */
async function consolidarListaCompraSiDuplicados(userId) {
  const [rows] = await pool.execute(
    `SELECT id, item, COALESCE(cantidad, 1) AS cantidad, comprado FROM lista_compra WHERE usuario_id = ?`,
    [userId]
  )
  if (!rows?.length) return

  const groups = new Map()
  for (const r of rows) {
    const { nombre, qtyMul } = splitListaNombreCantidad(r.item)
    const canon = normListaItem(nombre).slice(0, 200)
    if (!canon) continue
    const comprado = Number(r.comprado) === 1 ? 1 : 0
    const key = `${canon.toLowerCase()}\u0000${comprado}`
    const cantBase = Math.min(9999, Math.max(1, Number(r.cantidad) || 1))
    const add = Math.min(9999, cantBase * qtyMul)
    if (!groups.has(key)) {
      groups.set(key, { ids: [r.id], totalQty: add, canon, comprado })
    } else {
      const g = groups.get(key)
      g.ids.push(r.id)
      g.totalQty = Math.min(9999, g.totalQty + add)
    }
  }

  const ops = []
  for (const g of groups.values()) {
    if (g.ids.length < 2) continue
    g.ids.sort((a, b) => a - b)
    const keepId = g.ids[0]
    const deleteIds = g.ids.slice(1)
    ops.push({ keepId, deleteIds, canon: g.canon, totalQty: Math.min(9999, Math.max(1, g.totalQty)), comprado: g.comprado })
  }
  if (!ops.length) return

  await withTransaction(async (tx) => {
    for (const op of ops) {
      await tx.run(`UPDATE lista_compra SET item = ?, cantidad = ?, comprado = ? WHERE id = ? AND usuario_id = ?`, [
        op.canon,
        op.totalQty,
        op.comprado,
        op.keepId,
        userId,
      ])
      for (const id of op.deleteIds) {
        await tx.run(`DELETE FROM lista_compra WHERE id = ? AND usuario_id = ?`, [id, userId])
      }
    }
  })
}

/** Si no hay IA: fragmenta platos en trozos; permite repetidos para luego agrupar xN. */
function listaProductosDesdeMenuPorTexto(rows) {
  const out = []
  for (const r of rows) {
    const text = [r.plato, r.notas].filter(Boolean).join(' · ')
    const bits = text.split(/\s*(?:,|;|\/|\||·|\s+y\s+|\s+con\s+)\s*/i)
    for (let b of bits) {
      b = normListaItem(b)
      if (b.length < 2 || b.length > 90) continue
      if (itemListaCompraEsRuidoTecnico(b)) continue
      out.push(b.charAt(0).toUpperCase() + b.slice(1))
    }
  }
  return out.slice(0, 120)
}

async function listaProductosGroqDesdeMenu(apiKey, rows) {
  const lines = rows.map(
    (r) =>
      `- ${r.fecha} (${r.momento}): ${r.plato}${r.notas ? `. Notas: ${r.notas}` : ''}`
  )
  const prompt = `Eres ayudante de compras para cocina casera en España.

A partir del menú siguiente, deduce una lista de COMPRA de supermercado: ingredientes y productos necesarios para preparar esos platos durante el periodo indicado.
- Incluye verduras, fruta, carnes/pescados, lácteos, huevos, legumbres secas, arroz/pasta, especias básicas, aceite, pan, etc. cuando encajen con los platos.
- No repitas el mismo producto en distintas líneas; si hace falta más cantidad usa un solo ítem con sufijo (ej. "Huevos x6", "Tomates cherry x2").
- Cantidades opcionales entre paréntesis si ayuda (ej. "Leche entera (1 L)").
- Entre 15 y 55 ítems según complejidad del menú.
- Nombres cortos en español.
- Nunca incluyas nombres de modelos de IA, la palabra "Groq", "OpenAI", "IA (…)", JSON ni metadatos: solo productos de supermercado.

Responde ÚNICAMENTE con JSON válido (sin markdown ni texto extra):
{"productos":["ítem 1","ítem 2",...]}

Menú:
${lines.join('\n')}`

  const { text } = await groqGenerateText(apiKey, prompt, {
    temperature: 0.35,
    maxOutputTokens: 4096,
  })
  const parsed = parseJsonFromModel(text)
  const arr = parsed?.productos
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('La IA no devolvió la lista en el formato esperado.')
  }
  const limpios = filtrarProductosListaCompra(arr)
  if (!limpios.length) {
    throw new Error('La IA no devolvió productos válidos tras filtrar la respuesta.')
  }
  return limpios.map(normListaItem).filter(Boolean).slice(0, 60)
}

/**
 * Sustituye todos los pendientes (comprado = 0) por ítems derivados del menú dado.
 * Los ítems ya comprados no se modifican.
 * preferGroq: true intenta Groq; false solo texto (rápido, p. ej. al cargar la lista).
 * Si no se puede extraer ningún producto, no borra la lista pendiente actual.
 */
async function reemplazarListaPendienteDesdeMenus(userId, menus, preferGroq) {
  if (!menus?.length) {
    return { ok: false, razon: 'sin_menu', origen: null, agregados: [], productos: [] }
  }
  let productos = []
  let origen = 'texto'
  if (preferGroq && GROQ_KEY) {
    try {
      productos = await listaProductosGroqDesdeMenu(GROQ_KEY, menus)
      origen = 'ia'
    } catch (e) {
      console.warn('[lista menú]', e?.message || e)
      productos = listaProductosDesdeMenuPorTexto(menus)
      origen = 'texto'
    }
  } else {
    productos = listaProductosDesdeMenuPorTexto(menus)
  }

  const agregados = aggregateProductosLista(productos)
  if (!agregados.length) {
    console.warn('[lista menú] sin productos extraíbles; no se alteran pendientes')
    return { ok: false, razon: 'sin_productos', origen, agregados: [], productos }
  }

  await withTransaction(async (tx) => {
    await tx.run(`DELETE FROM lista_compra WHERE usuario_id = ? AND comprado = 0`, [userId])
    for (const row of agregados) {
      const canon = normListaItem(row.nombre).slice(0, 200)
      const qty = Math.min(9999, Math.max(1, Number(row.cantidad) || 1))
      if (!canon) continue
      await tx.run(
        `INSERT INTO lista_compra (usuario_id, item, cantidad, comprado) VALUES (?, ?, ?, 0)`,
        [userId, canon, qty]
      )
    }
  })
  await consolidarListaCompraSiDuplicados(userId)
  return { ok: true, origen, agregados, productos }
}

function sqliteFriendlyError(err, accion) {
  const msg = String(err?.message || '')
  if (msg.includes('no such table')) {
    return `${accion}: borra backend/database/database.sqlite y reinicia el servidor para recrear tablas.`
  }
  return `${accion}. Si persiste, mira el error en la terminal del servidor.`
}

app.get('/api/alimentacion/menu', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  const { from, to } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from y to (YYYY-MM-DD) requeridos' })

  try {
    const [rows] = await pool.execute(
      `SELECT id, fecha, momento, plato, notas FROM comidas_menu
       WHERE usuario_id = ? AND fecha BETWEEN ? AND ?
       ORDER BY fecha,
         CASE momento WHEN 'desayuno' THEN 1 WHEN 'comida' THEN 2 WHEN 'cena' THEN 3 ELSE 4 END`,
      [userId, from, to]
    )
    res.json({ menus: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: sqliteFriendlyError(err, 'Error al cargar menús') })
  }
})

app.post('/api/alimentacion/menu', async (req, res) => {
  const userId = parseUserId(req)
  const { fecha, momento, plato, notas } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!fecha || !momento || !plato) {
    return res.status(400).json({ error: 'fecha, momento y plato son obligatorios' })
  }
  if (!['desayuno', 'comida', 'cena'].includes(momento)) {
    return res.status(400).json({ error: 'momento inválido' })
  }

  try {
    await pool.execute(
      `INSERT INTO comidas_menu (usuario_id, fecha, momento, plato, notas)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(usuario_id, fecha, momento) DO UPDATE SET
         plato = excluded.plato,
         notas = excluded.notas`,
      [userId, fecha, momento, plato.slice(0, 255), notas?.slice(0, 500) || null]
    )
    const [last] = await pool.execute(
      `SELECT id FROM comidas_menu WHERE usuario_id = ? AND fecha = ? AND momento = ?`,
      [userId, fecha, momento]
    )
    res.status(201).json({ ok: true, id: last[0]?.id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo guardar el menú' })
  }
})

app.delete('/api/alimentacion/menu/:id', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  const id = parseInt(req.params.id, 10)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' })

  try {
    const [r] = await pool.execute('DELETE FROM comidas_menu WHERE id = ? AND usuario_id = ?', [
      id,
      userId,
    ])
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar' })
  }
})

app.post('/api/alimentacion/menu/generar-semana', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  try {
    const start = new Date()
    start.setHours(12, 0, 0, 0)
    const momentos = ['desayuno', 'comida', 'cena']

    for (let d = 0; d < 7; d++) {
      const day = new Date(start)
      day.setDate(start.getDate() + d)
      const iso = day.toISOString().slice(0, 10)
      const seedBase = userId * 100 + d * 17

      for (let m = 0; m < momentos.length; m++) {
        const momento = momentos[m]
        const plato = pick(PLATOS_SUGERIDOS[momento], seedBase + m * 31)
        await pool.execute(
          `INSERT INTO comidas_menu (usuario_id, fecha, momento, plato, notas)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(usuario_id, fecha, momento) DO UPDATE SET
             plato = excluded.plato,
             notas = excluded.notas`,
          [userId, iso, momento, plato, null]
        )
      }
    }

    res.json({ ok: true, mensaje: 'Menú de 7 días generado desde hoy' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo generar el menú' })
  }
})

app.get('/api/alimentacion/lista', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  try {
    await consolidarListaCompraSiDuplicados(userId)
    await eliminarListaCompraItemsRuidoTecnico(userId)

    const hoy = new Date().toISOString().slice(0, 10)
    const from = mondayOfWeekContaining(hoy)
    const to = addDaysIso(from, 6)
    const [menusSemana] = await pool.execute(
      `SELECT fecha, momento, plato, notas FROM comidas_menu
       WHERE usuario_id = ? AND fecha BETWEEN ? AND ?
       ORDER BY fecha,
         CASE momento WHEN 'desayuno' THEN 1 WHEN 'comida' THEN 2 WHEN 'cena' THEN 3 ELSE 4 END`,
      [userId, from, to]
    )

    const menuSemanaSync = {
      semana: { from, to },
      hayMenu: menusSemana.length > 0,
      pendientesActualizados: false,
      origen: null,
    }
    if (menusSemana.length > 0) {
      const sync = await reemplazarListaPendienteDesdeMenus(userId, menusSemana, false)
      menuSemanaSync.pendientesActualizados = Boolean(sync.ok)
      menuSemanaSync.origen = sync.origen
    }

    const [rows] = await pool.execute(
      `SELECT id, item, COALESCE(cantidad, 1) AS cantidad, comprado FROM lista_compra WHERE usuario_id = ? ORDER BY comprado ASC, item COLLATE NOCASE ASC`,
      [userId]
    )
    res.json({ items: rows, menuSemanaSync })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: sqliteFriendlyError(err, 'Error al cargar lista') })
  }
})

app.post('/api/alimentacion/lista', async (req, res) => {
  const userId = parseUserId(req)
  const { item } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!item?.trim()) return res.status(400).json({ error: 'item requerido' })

  try {
    const r = await listaCompraSumarCantidad(userId, item.trim(), 1)
    if (!r.ok) return res.status(400).json({ error: 'Ítem no válido' })
    res.status(201).json({ ok: true, unidades: r.unidades })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo añadir' })
  }
})

app.patch('/api/alimentacion/lista/:id', async (req, res) => {
  const userId = parseUserId(req)
  const { comprado } = req.body || {}
  const id = parseInt(req.params.id, 10)

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' })
  if (typeof comprado !== 'boolean') return res.status(400).json({ error: 'comprado debe ser boolean' })

  try {
    const [r] = await pool.execute(
      'UPDATE lista_compra SET comprado = ? WHERE id = ? AND usuario_id = ?',
      [comprado ? 1 : 0, id, userId]
    )
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar' })
  }
})

app.delete('/api/alimentacion/lista/:id', async (req, res) => {
  const userId = parseUserId(req)
  const id = parseInt(req.params.id, 10)

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' })

  try {
    const [r] = await pool.execute('DELETE FROM lista_compra WHERE id = ? AND usuario_id = ?', [
      id,
      userId,
    ])
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar' })
  }
})

/**
 * Regenera los pendientes de la lista desde el menú en [from, to] (los comprados no se tocan).
 * Sin from/to: semana actual (lunes–domingo).
 * Con GROQ_API_KEY: intenta ingredientes con IA; si no hay clave o falla: mismo criterio que al cargar la lista (texto).
 */
app.post('/api/alimentacion/lista/desde-menu', async (req, res) => {
  const userId = parseUserId(req)
  let { from, to } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  if (!from || !to) {
    const hoy = new Date().toISOString().slice(0, 10)
    from = mondayOfWeekContaining(hoy)
    to = addDaysIso(from, 6)
  }

  try {
    const [menus] = await pool.execute(
      `SELECT fecha, momento, plato, notas FROM comidas_menu
       WHERE usuario_id = ? AND fecha BETWEEN ? AND ?
       ORDER BY fecha,
         CASE momento WHEN 'desayuno' THEN 1 WHEN 'comida' THEN 2 WHEN 'cena' THEN 3 ELSE 4 END`,
      [userId, from, to]
    )

    if (!menus.length) {
      return res.status(400).json({
        error:
          'No hay platos en el menú para ese periodo. Genera o rellena el menú primero en Alimentación.',
      })
    }

    const sync = await reemplazarListaPendienteDesdeMenus(userId, menus, Boolean(GROQ_KEY))
    if (!sync.ok && sync.razon === 'sin_productos') {
      return res.status(400).json({
        error:
          'No se pudieron extraer productos del menú. Usa nombres de plato más descriptivos o revisa las notas.',
      })
    }
    if (!sync.ok) {
      return res.status(400).json({ error: 'No se pudo actualizar la lista desde el menú.' })
    }

    const { origen, agregados, productos } = sync
    const unidadesAñadidas = agregados.reduce(
      (s, row) => s + Math.min(9999, Math.max(1, Number(row.cantidad) || 1)),
      0
    )
    const lineasTocadas = agregados.length

    const [totalRows] = await pool.execute(
      `SELECT COUNT(*) AS n FROM lista_compra WHERE usuario_id = ?`,
      [userId]
    )
    const totalLista = totalRows[0]?.n ?? 0

    res.json({
      ok: true,
      origen,
      periodo: { from, to },
      generados: productos.length,
      productosUnicos: agregados.length,
      unidadesAñadidas,
      lineasTocadas,
      totalLista,
      aviso:
        origen === 'texto'
          ? 'Lista aproximada desde los nombres de los platos. Con GROQ_API_KEY el botón puede usar IA para ingredientes más útiles.'
          : undefined,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: sqliteFriendlyError(err, 'No se pudo generar la lista desde el menú') })
  }
})

// ============================================
// IA (Groq — finanzas personales y menú semanal)
// ============================================

app.get('/api/ai/status', (req, res) => {
  res.json({
    groq: Boolean(GROQ_KEY && GROQ_KEY.length > 8),
    ayuda: 'Crea GROQ_API_KEY en backend/server/.env (https://console.groq.com/)',
  })
})

function addDaysIso(iso, n) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function mondayOfWeekContaining(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

app.post('/api/ai/menu-semanal', async (req, res) => {
  const userId = parseUserId(req)
  const { preferencias, semanaInicio } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!GROQ_KEY) {
    return res.status(503).json({
      error: 'IA no configurada. Añade GROQ_API_KEY en backend/server/.env (https://console.groq.com/).',
    })
  }

  try {
    const [[user]] = await pool.execute('SELECT nombre FROM usuarios WHERE id = ?', [userId])
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

    const anchor = semanaInicio || new Date().toISOString().slice(0, 10)
    const lunes = mondayOfWeekContaining(anchor)
    const fechas = Array.from({ length: 7 }, (_, i) => addDaysIso(lunes, i))

    const prompt = `Eres nutricionista. Propón un menú casero para una semana en España.
Usuario: ${user.nombre}.
Preferencias / restricciones: ${preferencias || 'Dieta equilibrada, cocina sencilla, sin alimentos caros.'}

Debes usar EXACTAMENTE estas fechas en orden (ISO YYYY-MM-DD), una por día:
${fechas.join(', ')}

Responde ÚNICAMENTE con un JSON válido (sin markdown ni texto extra) con esta forma exacta:
{"dias":[{"fecha":"YYYY-MM-DD","desayuno":"...","comida":"...","cena":"..."}]}

7 elementos en "dias". Platos concretos en español, variados y realistas.`

    const { text, model } = await groqGenerateText(GROQ_KEY, prompt)
    let parsed
    try {
      parsed = parseJsonFromModel(text)
    } catch {
      return res.status(502).json({
        error: 'La IA no devolvió JSON válido. Inténtalo de nuevo.',
        raw: text.slice(0, 500),
      })
    }

    const dias = parsed?.dias
    if (!Array.isArray(dias) || dias.length !== 7) {
      return res.status(502).json({ error: 'Formato de menú incorrecto de la IA.' })
    }

    const momentos = ['desayuno', 'comida', 'cena']
    for (let i = 0; i < 7; i++) {
      const esperada = fechas[i]
      const dia = dias[i]
      const fechaUsar = fechas.includes(dia?.fecha) ? dia.fecha : esperada

      for (const m of momentos) {
        const plato = String(dia?.[m] || '').slice(0, 255) || pick(PLATOS_SUGERIDOS[m], userId + i)
        await pool.execute(
          `INSERT INTO comidas_menu (usuario_id, fecha, momento, plato, notas)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(usuario_id, fecha, momento) DO UPDATE SET
             plato = excluded.plato,
             notas = excluded.notas`,
          [
            userId,
            fechaUsar,
            m,
            plato,
            `IA (${model})`,
          ]
        )
      }
    }

    res.json({
      ok: true,
      fuente: 'groq',
      modelo: model,
      desde: fechas[0],
      hasta: fechas[6],
      mensaje: 'Menú semanal generado y guardado.',
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error al generar menú con IA' })
  }
})

app.post('/api/ai/menu-diario', async (req, res) => {
  const userId = parseUserId(req)
  const { preferencias, fecha } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha).trim())) {
    return res.status(400).json({ error: 'fecha obligatoria (YYYY-MM-DD)' })
  }
  const fechaIso = String(fecha).trim().slice(0, 10)

  if (!GROQ_KEY) {
    return res.status(503).json({
      error: 'IA no configurada. Añade GROQ_API_KEY en backend/server/.env (https://console.groq.com/).',
    })
  }

  try {
    const [[user]] = await pool.execute('SELECT nombre FROM usuarios WHERE id = ?', [userId])
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

    const prompt = `Eres nutricionista. Propón un menú casero para UN SOLO DÍA en España.
Usuario: ${user.nombre}.
Fecha del día (ISO): ${fechaIso}.
Preferencias / restricciones: ${preferencias || 'Dieta equilibrada, cocina sencilla, sin alimentos caros.'}

Responde ÚNICAMENTE con un JSON válido (sin markdown ni texto extra) con esta forma exacta:
{"desayuno":"...","comida":"...","cena":"..."}

Platos concretos en español, variados y realistas para ese día.`

    const { text, model } = await groqGenerateText(GROQ_KEY, prompt)
    let parsed
    try {
      parsed = parseJsonFromModel(text)
    } catch {
      return res.status(502).json({
        error: 'La IA no devolvió JSON válido. Inténtalo de nuevo.',
        raw: text.slice(0, 500),
      })
    }

    const momentos = ['desayuno', 'comida', 'cena']
    for (let i = 0; i < momentos.length; i++) {
      const m = momentos[i]
      const plato =
        String(parsed?.[m] || '').slice(0, 255) ||
        pick(PLATOS_SUGERIDOS[m], userId + i * 17 + parseInt(fechaIso.replace(/-/g, ''), 10) || 0)
      await pool.execute(
        `INSERT INTO comidas_menu (usuario_id, fecha, momento, plato, notas)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(usuario_id, fecha, momento) DO UPDATE SET
           plato = excluded.plato,
           notas = excluded.notas`,
        [userId, fechaIso, m, plato, `IA (${model})`]
      )
    }

    res.json({
      ok: true,
      fuente: 'groq',
      modelo: model,
      fecha: fechaIso,
      mensaje: 'Menú del día generado y guardado.',
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error al generar menú diario con IA' })
  }
})

app.post('/api/ai/informe-finanzas', async (req, res) => {
  const userId = parseUserId(req)
  const { semanaInicio } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!GROQ_KEY) {
    return res.status(503).json({
      error:
        'IA no configurada. Añade GROQ_API_KEY en backend/server/.env (https://console.groq.com/).',
    })
  }

  try {
    const [[user]] = await pool.execute('SELECT nombre FROM usuarios WHERE id = ?', [userId])
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

    const anchor = semanaInicio || new Date().toISOString().slice(0, 10)
    const desde = mondayOfWeekContaining(anchor)
    const hasta = addDaysIso(desde, 6)

    const [movs] = await pool.execute(
      `SELECT tipo, monto, categoria, descripcion, fecha
       FROM movimientos_financieros
       WHERE usuario_id = ? AND fecha >= ? AND fecha <= ?
       ORDER BY fecha ASC, id ASC`,
      [userId, desde, hasta]
    )

    const ingresos = movs.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0)
    const gastos = movs.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + Number(m.monto), 0)
    const balance = ingresos - gastos

    const prompt = `Actúa como asesor financiero para un proyecto educativo (ESO / FP / universidad).
Redacta un INFORME SEMANAL claro en español para la persona "${user.nombre}".

Semana natural: del ${desde} al ${hasta} (ambos inclusive).

Totales de la semana (€):
- Ingresos: ${ingresos.toFixed(2)}
- Gastos: ${gastos.toFixed(2)}
- Balance: ${balance.toFixed(2)}

Movimientos (JSON, puede estar vacío):
${JSON.stringify(movs, null, 0)}

Instrucciones:
1) Empieza con un título en una línea: "# Informe semanal (${desde} – ${hasta})"
2) Resumen ejecutivo (4–8 frases) basado SOLO en estos datos.
3) Sección "## Observaciones" con viñetas.
4) Sección "## Recomendaciones" con 3 consejos prácticos y realistas.
5) Si no hay movimientos, indica que no hay datos y sugiere registrar gastos/ingresos.
No inventes cifras. Usa Markdown simple (títulos ## y listas con -).`

    const { text, model } = await groqGenerateText(GROQ_KEY, prompt, { temperature: 0.5 })

    res.json({
      ok: true,
      fuente: 'groq',
      modelo: model,
      desde,
      hasta,
      totales: { ingresos, gastos, balance },
      informeMarkdown: text,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error al generar informe' })
  }
})

// ============================================
// IA — Chat, lista por pasillos, insights, ticket
// ============================================

function calendarPrevMonth(year, month) {
  if (month <= 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

async function fetchChatContextForUser(userId) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const hoy = now.toISOString().slice(0, 10)
  const from = mondayOfWeekContaining(hoy)
  const to = addDaysIso(from, 6)

  const [movs] = await pool.execute(
    `SELECT tipo, monto, categoria, descripcion, fecha
     FROM movimientos_financieros
     WHERE usuario_id = ? AND strftime('%Y', fecha) = ? AND CAST(strftime('%m', fecha) AS INTEGER) = ?
     ORDER BY fecha DESC, id DESC
     LIMIT 100`,
    [userId, String(y), m]
  )
  const [menus] = await pool.execute(
    `SELECT fecha, momento, plato, notas FROM comidas_menu
     WHERE usuario_id = ? AND fecha BETWEEN ? AND ?
     ORDER BY fecha,
       CASE momento WHEN 'desayuno' THEN 1 WHEN 'comida' THEN 2 WHEN 'cena' THEN 3 ELSE 4 END`,
    [userId, from, to]
  )

  return {
    mesActual: `${y}-${String(m).padStart(2, '0')}`,
    movimientosMesActual: movs,
    menuSemanaActual: { desde: from, hasta: to, platos: menus },
  }
}

async function gastosPorCategoriaMes(userId, year, month) {
  const [rows] = await pool.execute(
    `SELECT COALESCE(NULLIF(TRIM(categoria), ''), '(sin categoría)') AS categoria,
            COALESCE(SUM(monto), 0) AS total
     FROM movimientos_financieros
     WHERE usuario_id = ? AND tipo = 'gasto'
       AND strftime('%Y', fecha) = ? AND CAST(strftime('%m', fecha) AS INTEGER) = ?
     GROUP BY 1
     ORDER BY total DESC`,
    [userId, String(year), month]
  )
  return rows.map((r) => ({ categoria: r.categoria, total: Number(r.total) }))
}

async function smartListPasillosGroq(apiKey, menus) {
  const lines = menus.map(
    (r) => `- ${r.fecha} (${r.momento}): ${r.plato}${r.notas ? `. Notas: ${r.notas}` : ''}`
  )
  const prompt = `A partir de este listado de platos:
${lines.join('\n')}

Extrae los ingredientes necesarios. Devuelve ÚNICAMENTE un objeto JSON válido con las claves como pasillos del supermercado (ej. 'Frutería', 'Carnicería', 'Lácteos') y los valores como arrays de strings con los ingredientes. No añadas texto Markdown extra.`

  const { text } = await groqGenerateText(apiKey, prompt, {
    temperature: 0.25,
    maxOutputTokens: 4096,
  })
  const parsed = safeParseJsonFromModel(text)
  if (!parsed.ok) {
    throw new Error(`JSON de la IA no válido: ${parsed.error}`)
  }
  const obj = parsed.value
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    throw new Error('La IA no devolvió un objeto JSON en la raíz.')
  }
  const pasillos = {}
  for (const [k, v] of Object.entries(obj)) {
    if (!k || typeof k !== 'string') continue
    if (!Array.isArray(v)) continue
    const arr = v.map((x) => String(x).trim()).filter(Boolean)
    if (arr.length) pasillos[k.trim().slice(0, 80)] = arr
  }
  if (Object.keys(pasillos).length === 0) {
    throw new Error('La IA devolvió pasillos vacíos o formato incorrecto.')
  }
  return pasillos
}

// POST /api/chat — contexto mes + menú semana en system prompt
app.post('/api/chat', async (req, res) => {
  const userId = parseUserId(req)
  const { message, history } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'message requerido' })
  }
  if (!GROQ_KEY) {
    return res.status(503).json({
      error: 'IA no configurada. Añade GROQ_API_KEY en backend/server/.env (https://console.groq.com/).',
    })
  }

  try {
    const ctx = await fetchChatContextForUser(userId)
    const inyectado = JSON.stringify(ctx, null, 0)
    const system = `Eres el asistente de MybrAIn. Responde a la pregunta del usuario basándote ÚNICAMENTE en estos datos financieros y de nutrición del usuario: ${inyectado}. Sé breve y directo. Si no hay datos suficientes, indícalo sin inventar cifras.`

    const hist = Array.isArray(history)
      ? history
          .slice(-16)
          .map((h) => ({
            role: h.role === 'assistant' ? 'assistant' : 'user',
            content: String(h.content || '').trim().slice(0, 8000),
          }))
          .filter((h) => h.content)
      : []

    const messages = [
      { role: 'system', content: system },
      ...hist,
      { role: 'user', content: String(message).trim().slice(0, 8000) },
    ]

    const { text, model } = await groqChatCompletion(GROQ_KEY, messages, {
      temperature: 0.45,
      maxOutputTokens: 2048,
    })
    res.json({ reply: text, model })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error en el chat' })
  }
})

// POST /api/smart-list — JSON por pasillos (no escribe en lista_compra)
app.post('/api/smart-list', async (req, res) => {
  const userId = parseUserId(req)
  let { from, to } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!GROQ_KEY) {
    return res.status(503).json({
      error: 'IA no configurada. Añade GROQ_API_KEY en backend/server/.env (https://console.groq.com/).',
    })
  }

  if (!from || !to) {
    const hoy = new Date().toISOString().slice(0, 10)
    from = mondayOfWeekContaining(hoy)
    to = addDaysIso(from, 6)
  }

  try {
    const [menus] = await pool.execute(
      `SELECT fecha, momento, plato, notas FROM comidas_menu
       WHERE usuario_id = ? AND fecha BETWEEN ? AND ?
       ORDER BY fecha,
         CASE momento WHEN 'desayuno' THEN 1 WHEN 'comida' THEN 2 WHEN 'cena' THEN 3 ELSE 4 END`,
      [userId, from, to]
    )
    if (!menus.length) {
      return res.status(400).json({
        error:
          'No hay platos en el menú para ese periodo. Rellena el menú en Alimentación primero.',
      })
    }

    const pasillos = await smartListPasillosGroq(GROQ_KEY, menus)
    res.json({ ok: true, periodo: { from, to }, pasillos })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'No se pudo generar la lista inteligente' })
  }
})

// POST /api/insights — comparativa mes actual vs anterior + JSON 3 textos
app.post('/api/insights', async (req, res) => {
  const userId = parseUserId(req)

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!GROQ_KEY) {
    return res.status(503).json({
      error: 'IA no configurada. Añade GROQ_API_KEY en backend/server/.env (https://console.groq.com/).',
    })
  }

  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const prev = calendarPrevMonth(y, m)

  try {
    const actual = await gastosPorCategoriaMes(userId, y, m)
    const anterior = await gastosPorCategoriaMes(userId, prev.year, prev.month)
    const totActual = actual.reduce((s, r) => s + r.total, 0)
    const totAnt = anterior.reduce((s, r) => s + r.total, 0)

    const payload = {
      mesActual: `${y}-${String(m).padStart(2, '0')}`,
      mesAnterior: `${prev.year}-${String(prev.month).padStart(2, '0')}`,
      totalGastosActual: totActual,
      totalGastosAnterior: totAnt,
      porCategoriaActual: actual,
      porCategoriaAnterior: anterior,
    }

    const prompt = `Analiza estos gastos mensuales (solo tipo "gasto"):
${JSON.stringify(payload, null, 0)}

Genera 3 insights breves (máximo 2 líneas cada uno) en formato JSON ÚNICO sin markdown ni texto extra:
{"positivo":"...","alerta":"...","consejo":"..."}
- positivo: felicita por algo positivo (datos reales).
- alerta: señala una categoría donde se gasta mucho o empeoró respecto al mes anterior.
- consejo: consejo genérico de ahorro o nutrición cruzada con el contexto de gastos.
No inventes cifras que no estén en el JSON.`

    const { text, model } = await groqGenerateText(GROQ_KEY, prompt, { temperature: 0.4, maxOutputTokens: 1024 })
    const parsed = safeParseJsonFromModel(text)
    if (!parsed.ok) {
      return res.status(502).json({
        error: 'La IA no devolvió JSON válido.',
        datos: payload,
        raw: parsed.raw,
      })
    }
    const v = parsed.value
    if (typeof v !== 'object' || v === null) {
      return res.status(502).json({ error: 'Formato de insights incorrecto.', datos: payload })
    }
    res.json({
      ok: true,
      model,
      datos: payload,
      insights: {
        positivo: String(v.positivo || '').trim(),
        alerta: String(v.alerta || '').trim(),
        consejo: String(v.consejo || '').trim(),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error al generar insights' })
  }
})

// GET /api/tickets-guardados — lista tickets guardados en disco (por usuario)
app.get('/api/tickets-guardados', (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  try {
    const tickets = listSavedTicketsForUser(userId)
    res.json({
      tickets,
      carpetaUsuarioRelativa: ['data', 'nuevo-ticket', 'uploads', String(userId)].join('/'),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo listar los tickets guardados' })
  }
})

// GET /api/ticket-detalle — OCR, fechas y metadatos de un ticket guardado (mismo usuario)
app.get('/api/ticket-detalle', (req, res) => {
  const userId = parseUserId(req)
  const ticketId = String(req.query.ticketId || '').trim()
  if (!userId || !ticketId) {
    return res.status(400).json({ error: 'userId y ticketId requeridos' })
  }
  if (/[\\/]/.test(ticketId) || ticketId.length > 200) {
    return res.status(400).json({ error: 'ticketId inválido' })
  }
  try {
    const detail = getTicketDetailForUser(userId, ticketId)
    if (!detail) return res.status(404).json({ error: 'Ticket no encontrado' })
    res.json(detail)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo leer el detalle del ticket' })
  }
})

// GET /api/ticket-archivo/imagen — miniatura del ticket (mismo usuario)
app.get('/api/ticket-archivo/imagen', (req, res) => {
  const userId = parseUserId(req)
  const ticketId = String(req.query.ticketId || '').trim()
  if (!userId || !ticketId || /[\\/]/.test(ticketId) || ticketId.length > 200) {
    return res.status(400).json({ error: 'userId y ticketId requeridos' })
  }
  const dir = ticketSessionDir(userId, ticketId)
  if (!existsSync(dir)) {
    return res.status(404).end()
  }
  const candidates = [
    ['.jpg', 'image/jpeg'],
    ['.png', 'image/png'],
    ['.webp', 'image/webp'],
  ]
  for (const [ext, ct] of candidates) {
    const filePath = join(dir, `imagen${ext}`)
    if (existsSync(filePath)) {
      res.setHeader('Content-Type', ct)
      return res.sendFile(filePath, (err) => {
        if (err && !res.headersSent) res.status(500).end()
      })
    }
  }
  const fallback = join(dir, 'imagen.img')
  if (existsSync(fallback)) {
    res.setHeader('Content-Type', 'application/octet-stream')
    return res.sendFile(fallback)
  }
  res.status(404).end()
})

// POST /api/scan-ticket — imagen → OCR (Tesseract) → JSON (Groq); no guarda en BD
app.post(
  '/api/scan-ticket',
  (req, res, next) => {
    ticketUpload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Error al subir el archivo' })
      next()
    })
  },
  async (req, res) => {
    const uid = parseInt(String(req.body?.userId ?? ''), 10)
    if (!Number.isFinite(uid) || uid <= 0) {
      return res.status(400).json({ error: 'userId obligatorio en el formulario (campo userId).' })
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'Falta la imagen (campo de archivo "file").' })
    }

    const ticketId = generateTicketId()
    const mime = req.file.mimetype || 'image/jpeg'
    const originalname = req.file.originalname || null

    const respCarpeta = () => ({
      ticketId,
      carpetaRelativa: ticketRelativePathFromServer(uid, ticketId),
    })

    try {
      initTicketFolder(uid, ticketId, req.file.buffer, mime, originalname)
    } catch (e) {
      console.error('[scan-ticket] disco:', e)
      return res.status(500).json({ error: 'No se pudo guardar la imagen del ticket en disco.' })
    }

    if (!GROQ_KEY) {
      try {
        writeTicketError(uid, ticketId, 'IA no configurada (GROQ_API_KEY). Imagen guardada en carpeta local.')
      } catch {
        /* */
      }
      return res.status(503).json({
        error: 'IA no configurada. Añade GROQ_API_KEY en backend/server/.env (https://console.groq.com/).',
        ...respCarpeta(),
      })
    }

    let rawOcr = ''
    try {
      rawOcr = await ocrTicketImage(req.file.buffer)
      writeTicketOcrText(uid, ticketId, rawOcr)
    } catch (e) {
      const msg = e?.message || String(e)
      try {
        writeTicketError(uid, ticketId, `OCR: ${msg}`)
      } catch {
        /* */
      }
      return res.status(500).json({
        error: msg || 'Error en OCR',
        ...respCarpeta(),
      })
    }

    if (rawOcr.length < 10) {
      try {
        writeTicketError(uid, ticketId, 'OCR insuficiente: texto demasiado corto.')
      } catch {
        /* */
      }
      return res.status(422).json({
        error:
          'OCR insuficiente: no se leyó texto claro en la imagen. Prueba más luz, encuadre o sube una foto nítida.',
        ocrPreview: rawOcr,
        ...respCarpeta(),
      })
    }

    try {
      const { model, structured } = await structureReceiptFromOcr(GROQ_KEY, rawOcr)
      writeTicketStructured(uid, ticketId, model, structured)
      res.json({
        ok: true,
        model,
        ocrTextPreview: rawOcr.slice(0, 2000),
        structured,
        ...respCarpeta(),
      })
    } catch (err) {
      console.error('[scan-ticket]', err)
      try {
        writeTicketError(uid, ticketId, err?.message || String(err))
      } catch {
        /* */
      }
      res.status(500).json({
        error: err.message || 'Error al analizar el ticket',
        modelText: err.modelText,
        raw: err.raw,
        ...respCarpeta(),
      })
    }
  }
)

// POST /api/save-ticket — confirma datos ya revisados (escáner o manual)
app.post('/api/save-ticket', async (req, res) => {
  const userId = parseUserId(req)
  const { total, entidad, fecha, items, categoria, ticketId: ticketIdBody } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  const monto = Math.abs(Number(total))
  const comercio = String(entidad || '').trim().slice(0, 120) || 'Comercio'
  const fechaMov = parseTicketFechaBody(fecha)
  const cat = assertCategoriaGastoEleccion(categoria)
  if (!cat) {
    return res.status(400).json({
      error: `Elige una categoría válida: ${CATEGORIAS_GASTO.join(', ')}.`,
    })
  }
  const listaItems = Array.isArray(items) ? items.map((x) => String(x).trim()).filter(Boolean) : []
  const ticketIdRaw = typeof ticketIdBody === 'string' ? ticketIdBody.trim() : ''
  const ticketId =
    ticketIdRaw &&
    !/[\\/]/.test(ticketIdRaw) &&
    ticketIdRaw.length <= 180 &&
    ticketIdRaw.length >= 10
      ? ticketIdRaw
      : null

  if (!Number.isFinite(monto) || monto <= 0) {
    return res.status(400).json({ error: 'total inválido' })
  }

  const descripcion = `Compra en ${comercio}`.slice(0, 500)

  try {
    await withTransaction(async (tx) => {
      await tx.run(
        `INSERT INTO movimientos_financieros (usuario_id, tipo, monto, categoria, descripcion, fecha, hucha_id)
         VALUES (?, 'gasto', ?, ?, ?, ?, NULL)`,
        [userId, monto, cat, descripcion, fechaMov]
      )
      for (const it of listaItems.slice(0, 200)) {
        await tx.run(`INSERT INTO despensa (usuario_id, item, origen) VALUES (?, ?, ?)`, [
          userId,
          it.slice(0, 200),
          'ticket_scan',
        ])
      }
    })

    if (ticketId) {
      writeTicketConfirmadoEnBd(userId, ticketId, {
        monto,
        categoria: cat,
        entidad: comercio,
        fecha: fechaMov,
        itemsEnDespensa: Math.min(listaItems.length, 200),
      })
    }

    res.json({
      ok: true,
      guardado: {
        monto,
        categoria: cat,
        entidad: comercio,
        fecha: fechaMov,
        itemsEnDespensa: Math.min(listaItems.length, 200),
        ticketIdArchivo: ticketId,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error al guardar el ticket' })
  }
})

// POST /api/process-ticket — Groq interpreta texto; categoría la elige el usuario en el cliente
app.post('/api/process-ticket', async (req, res) => {
  const userId = parseUserId(req)
  const { texto, categoria } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!texto || !String(texto).trim()) {
    return res.status(400).json({ error: 'texto requerido (contenido del ticket)' })
  }
  const cat = assertCategoriaGastoEleccion(categoria)
  if (!cat) {
    return res.status(400).json({
      error: `Elige una categoría válida: ${CATEGORIAS_GASTO.join(', ')}.`,
    })
  }
  if (!GROQ_KEY) {
    return res.status(503).json({
      error: 'IA no configurada. Añade GROQ_API_KEY en backend/server/.env (https://console.groq.com/).',
    })
  }

  const rawTicket = String(texto).trim().slice(0, 14000)
  const prompt = `Analiza el texto de un ticket de compra (puede venir pegado o ser salida de OCR). Devuelve ÚNICAMENTE un JSON válido, sin markdown ni texto extra:
{"total": <float>, "entidad": "<nombre comercial en español, limpio>", "fecha": "<YYYY-MM-DD o null>", "items": [<strings>]}

Reglas:
- "total": importe total a pagar (número).
- "entidad": nombre del establecimiento; corrige errores evidentes de OCR; sin texto legal largo.
- "fecha": fecha de la compra en ISO; si en el ticket está DD/MM/AAAA, convierte; si no hay fecha clara, null.
- "items": solo productos o líneas de producto legibles en español, una cadena por producto, nombre breve (≤ ~70 caracteres), sin cabeceras de tabla, sin "TOTAL"/"IVA"/"CAMBIO", sin líneas solo numéricas. Corrige ruido típico de OCR en los nombres. Si no hay productos claros, [].

Texto del ticket:
${rawTicket}`

  try {
    const { text, model } = await groqGenerateText(GROQ_KEY, prompt, { temperature: 0.15, maxOutputTokens: 4096 })
    const parsed = safeParseJsonFromModel(text)
    if (!parsed.ok) {
      return res.status(422).json({
        error: `No se pudo interpretar la respuesta de la IA: ${parsed.error}`,
        raw: parsed.raw,
      })
    }
    const o = parsed.value
    const total = Number(o?.total)
    const entidad = String(o?.entidad || '').trim().slice(0, 120) || 'Comercio'
    const items = Array.isArray(o?.items) ? o.items.map((x) => String(x).trim()).filter(Boolean) : []
    const fechaTicket =
      o?.fecha === null || o?.fecha === undefined || o?.fecha === ''
        ? null
        : parseTicketFechaBody(typeof o.fecha === 'string' ? o.fecha : String(o.fecha))

    if (!Number.isFinite(total) || total <= 0) {
      return res.status(422).json({
        error: 'No se obtuvo un importe total válido en el JSON. Revisa el ticket o inténtalo de nuevo.',
        preview: text.slice(0, 600),
      })
    }

    const fechaMov = fechaTicket || new Date().toISOString().slice(0, 10)
    const descBase = `Ticket ${entidad}`
    const descripcion = `${descBase}${items.length ? ` — ${items.slice(0, 4).join(', ')}` : ''}`.slice(0, 500)

    await withTransaction(async (tx) => {
      await tx.run(
        `INSERT INTO movimientos_financieros (usuario_id, tipo, monto, categoria, descripcion, fecha, hucha_id)
         VALUES (?, 'gasto', ?, ?, ?, ?, NULL)`,
        [userId, total, cat, descripcion, fechaMov]
      )
      for (const it of items.slice(0, 200)) {
        await tx.run(`INSERT INTO despensa (usuario_id, item, origen) VALUES (?, ?, ?)`, [
          userId,
          it.slice(0, 200),
          'ticket_ia',
        ])
      }
    })

    res.json({
      ok: true,
      model,
      registrado: {
        total,
        entidad,
        fecha: fechaMov,
        categoria: cat,
        itemsGuardados: Math.min(items.length, 200),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error al procesar el ticket' })
  }
})

// ============================================
// Iniciar servidor (primer puerto libre desde PREFERRED_PORT; Vite lee .dev-api-port)
// ============================================
function writeDevApiPortFile(port) {
  try {
    writeFileSync(DEV_API_PORT_FILE, `${port}\n`, 'utf8')
  } catch (e) {
    console.warn('No se pudo escribir .dev-api-port:', e?.message || e)
  }
}

function clearDevApiPortFile() {
  try {
    unlinkSync(DEV_API_PORT_FILE)
  } catch {
    /* no existe */
  }
}

const PORT_MAX = PREFERRED_PORT + 30
/** @type {import('node:http').Server | null} */
let activeHttpServer = null

function startHttp(port) {
  const srv = http.createServer(app)
  srv.once('error', (err) => {
    if (err?.code === 'EADDRINUSE' && port < PORT_MAX) {
      console.warn(`[MyBrAIn] Puerto ${port} en uso; probando ${port + 1}…`)
      srv.close(() => startHttp(port + 1))
      return
    }
    console.error(err)
    process.exit(1)
  })
  srv.listen(port, () => {
    activeHttpServer = srv
    writeDevApiPortFile(port)
    if (port !== PREFERRED_PORT) {
      console.warn(
        `\n⚠️  El puerto ${PREFERRED_PORT} estaba ocupado: API en http://127.0.0.1:${port}\n` +
          '   Vite reenvía /api leyendo backend/server/.dev-api-port.\n'
      )
    }
    console.log(`🧠 MyBrAIn Server corriendo en http://127.0.0.1:${port}`)
    if (GROQ_KEY) {
      console.log('🤖 IA: Groq configurada (menú, informes, chat, lista inteligente, insights, tickets)')
    } else {
      console.log('💡 IA: añade GROQ_API_KEY en server/.env — https://console.groq.com/')
    }
  })
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    clearDevApiPortFile()
    if (activeHttpServer) {
      activeHttpServer.close(() => process.exit(0))
    } else {
      process.exit(0)
    }
  })
}

startHttp(PREFERRED_PORT)
