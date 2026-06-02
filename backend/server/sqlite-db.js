/**
 * SQLite — archivo local en backend/database/database.sqlite
 * Esquema: finanzas (ingresos, gastos, aportaciones a huchas), comidas_menu (IA nutrición), lista_compra.
 */
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Ruta absoluta al fichero de base de datos */
export const SQLITE_PATH = join(__dirname, '..', 'database', 'database.sqlite')

let db = null

/** Creación inicial (bases nuevas). Tipos validados en la API: ingreso | gasto | aportacion_hucha */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  avatar TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS huchas_ahorro (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  objetivo REAL,
  saldo REAL NOT NULL DEFAULT 0,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_huchas_usuario ON huchas_ahorro(usuario_id);

CREATE TABLE IF NOT EXISTS movimientos_financieros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  monto REAL NOT NULL,
  categoria TEXT,
  descripcion TEXT,
  fecha TEXT NOT NULL,
  hucha_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (hucha_id) REFERENCES huchas_ahorro(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mov_user_fecha ON movimientos_financieros(usuario_id, fecha);

CREATE TABLE IF NOT EXISTS comidas_menu (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  momento TEXT NOT NULL,
  plato TEXT NOT NULL,
  notas TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE (usuario_id, fecha, momento)
);

CREATE TABLE IF NOT EXISTS lista_compra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  item TEXT NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  comprado INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lista_user ON lista_compra(usuario_id);

CREATE TABLE IF NOT EXISTS despensa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  item TEXT NOT NULL,
  origen TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_despensa_user ON despensa(usuario_id);

CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  fecha_evento TEXT NOT NULL,
  descripcion TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_eventos_user_fecha ON eventos(usuario_id, fecha_evento);
`

async function tableExists(database, name) {
  const row = await database.get(
    `SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`,
    [name]
  )
  return Boolean(row)
}

/**
 * Bases antiguas tenían CHECK (tipo IN ('ingreso','gasto')) y rechazaban aportacion_hucha al insertar.
 * Recrea la tabla sin ese CHECK (los tipos se validan en la API).
 */
async function migrateMovimientosFinancierosTipo(database) {
  const rows = await database.all(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='movimientos_financieros'`
  )
  const sql = String(rows[0]?.sql || '')
  if (!sql.includes("tipo IN ('ingreso', 'gasto')") || sql.includes('aportacion_hucha')) return

  await database.exec('PRAGMA foreign_keys = OFF')
  await database.exec(`
    CREATE TABLE movimientos_financieros__new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      monto REAL NOT NULL,
      categoria TEXT,
      descripcion TEXT,
      fecha TEXT NOT NULL,
      hucha_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (hucha_id) REFERENCES huchas_ahorro(id) ON DELETE SET NULL
    );
    INSERT INTO movimientos_financieros__new (id, usuario_id, tipo, monto, categoria, descripcion, fecha, hucha_id, created_at)
    SELECT id, usuario_id, tipo, monto, categoria, descripcion, fecha, hucha_id, created_at FROM movimientos_financieros;
    DROP TABLE movimientos_financieros;
    ALTER TABLE movimientos_financieros__new RENAME TO movimientos_financieros;
  `)
  await database.exec(
    'CREATE INDEX IF NOT EXISTS idx_mov_user_fecha ON movimientos_financieros(usuario_id, fecha)'
  )
  await database.exec('PRAGMA foreign_keys = ON')
}

/**
 * Migraciones ligeras: renombre menus_comidas → comidas_menu, tablas/columnas nuevas.
 */
async function migrateLegacy(database) {
  if (!(await tableExists(database, 'huchas_ahorro'))) {
    await database.exec(`
      CREATE TABLE huchas_ahorro (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        objetivo REAL,
        saldo REAL NOT NULL DEFAULT 0,
        orden INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_huchas_usuario ON huchas_ahorro(usuario_id);
    `)
  }

  if (await tableExists(database, 'movimientos_financieros')) {
    const cols = await database.all(`PRAGMA table_info(movimientos_financieros)`)
    const names = new Set(cols.map((c) => c.name))
    if (!names.has('hucha_id')) {
      await database.exec(`
        ALTER TABLE movimientos_financieros ADD COLUMN hucha_id INTEGER REFERENCES huchas_ahorro(id) ON DELETE SET NULL
      `)
    }
    await migrateMovimientosFinancierosTipo(database)
  }

  if (await tableExists(database, 'lista_compra')) {
    const cols = await database.all(`PRAGMA table_info(lista_compra)`)
    const names = new Set(cols.map((c) => c.name))
    if (!names.has('cantidad')) {
      await database.exec(`ALTER TABLE lista_compra ADD COLUMN cantidad INTEGER NOT NULL DEFAULT 1`)
    }
    await mergeListaCompraDuplicates(database)
  }

  if (!(await tableExists(database, 'despensa'))) {
    await database.exec(`
      CREATE TABLE despensa (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        item TEXT NOT NULL,
        origen TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_despensa_user ON despensa(usuario_id);
    `)
  }
}

/** Separa "Tomates x3" → nombre + factor; fusiona filas duplicadas por nombre canónico. */
function splitListaNombreCantidad(itemStr) {
  const t = String(itemStr || '').trim().replace(/\s+/g, ' ')
  const m = t.match(/^(.+?)\s*(?:x|×)\s*(\d+)\s*$/i)
  if (m) {
    const qty = Math.min(9999, Math.max(1, parseInt(m[2], 10) || 1))
    return { nombre: m[1].trim(), qtyMul: qty }
  }
  return { nombre: t, qtyMul: 1 }
}

async function mergeListaCompraDuplicates(database) {
  const rows = await database.all(
    `SELECT id, usuario_id, item, comprado, COALESCE(cantidad, 1) AS cantidad FROM lista_compra ORDER BY usuario_id, id`
  )
  const groups = new Map()
  for (const r of rows) {
    const { nombre: rawNombre, qtyMul } = splitListaNombreCantidad(r.item)
    const nombre = rawNombre.slice(0, 200)
    if (!nombre) continue
    const cantCol = Number(r.cantidad) || 1
    const totalUnits = cantCol * qtyMul
    const key = `${r.usuario_id}\u0000${nombre.toLowerCase()}`
    if (!groups.has(key)) {
      groups.set(key, {
        ids: [r.id],
        usuario_id: r.usuario_id,
        nombre,
        cantidad: totalUnits,
        comprados: [Number(r.comprado) === 1],
      })
    } else {
      const g = groups.get(key)
      g.ids.push(r.id)
      g.cantidad += totalUnits
      g.comprados.push(Number(r.comprado) === 1)
    }
  }
  for (const g of groups.values()) {
    const keepId = g.ids[0]
    const comprado = g.comprados.every(Boolean) ? 1 : 0
    const cantidad = Math.min(9999, Math.max(1, g.cantidad))
    await database.run(`UPDATE lista_compra SET item = ?, cantidad = ?, comprado = ? WHERE id = ?`, [
      g.nombre,
      cantidad,
      comprado,
      keepId,
    ])
    for (let i = 1; i < g.ids.length; i++) {
      await database.run(`DELETE FROM lista_compra WHERE id = ?`, [g.ids[i]])
    }
  }
}

async function seedAdmin(database) {
  const row = await database.get(`SELECT id FROM usuarios WHERE username = ?`, ['admin'])
  if (row) return
  await database.run(
    `INSERT INTO usuarios (username, nombre, email, password) VALUES (?, ?, ?, ?)`,
    ['admin', 'Admin', 'admin@mybrain.com', '$2b$10$Y4FgB1OSe3H8UogOAB5k0O7ITPzypGms7QvgmdRYf2b7j5TEDPHeK']
  )
}

export async function initDatabase() {
  mkdirSync(dirname(SQLITE_PATH), { recursive: true })
  db = await open({
    filename: SQLITE_PATH,
    driver: sqlite3.Database,
  })
  await db.exec('PRAGMA foreign_keys = ON')
  /* Antes del SCHEMA: renombrar tabla antigua para no crear comidas_menu vacía duplicada */
  if ((await tableExists(db, 'menus_comidas')) && !(await tableExists(db, 'comidas_menu'))) {
    await db.exec(`ALTER TABLE menus_comidas RENAME TO comidas_menu`)
  }
  await db.exec(SCHEMA)
  await migrateLegacy(db)
  await seedAdmin(db)
  console.log('✅ Conexión exitosa a SQLite (database.sqlite)')
  return db
}

/** Adaptador tipo mysql2: execute → [rows] en SELECT, [{ insertId, affectedRows }] en mutaciones */
export const pool = {
  async execute(sql, params = []) {
    if (!db) throw new Error('Base de datos no inicializada: llama a initDatabase() antes.')
    const cmd = sql.trim().split(/\s+/)[0].toUpperCase()
    if (cmd === 'SELECT' || cmd === 'WITH') {
      const rows = await db.all(sql, params)
      return [rows]
    }
    const result = await db.run(sql, params)
    return [
      {
        insertId: result.lastID,
        affectedRows: result.changes,
      },
    ]
  },
}

/**
 * Transacción SQLite (BEGIN IMMEDIATE … COMMIT / ROLLBACK).
 * @param {(tx: { run: (sql: string, params?: unknown[]) => Promise<import('sqlite').RunResult> }) => Promise<void>} fn
 */
export async function withTransaction(fn) {
  if (!db) throw new Error('Base de datos no inicializada: llama a initDatabase() antes.')
  await db.exec('BEGIN IMMEDIATE')
  try {
    const out = await fn({
      run(sql, params = []) {
        return db.run(sql, params)
      },
    })
    await db.exec('COMMIT')
    return out
  } catch (err) {
    await db.exec('ROLLBACK').catch(() => {})
    throw err
  }
}
