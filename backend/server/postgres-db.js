import pg from 'pg'
import './load-env.js'

const { Pool } = pg

export const poolPg = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
})

poolPg.on('error', (err) => {
  console.error('[PostgreSQL] Error inesperado en el cliente del Pool:', err)
})

export const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  avatar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS huchas_ahorro (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  objetivo DOUBLE PRECISION,
  saldo DOUBLE PRECISION NOT NULL DEFAULT 0,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movimientos_financieros (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  monto DOUBLE PRECISION NOT NULL,
  categoria VARCHAR(100),
  descripcion TEXT,
  fecha VARCHAR(50) NOT NULL,
  hucha_id INTEGER REFERENCES huchas_ahorro(id) ON DELETE SET NULL,
  banco_transaccion_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comidas_menu (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha VARCHAR(50) NOT NULL,
  momento VARCHAR(50) NOT NULL,
  plato VARCHAR(255) NOT NULL,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_comidas_menu_user_fecha_momento UNIQUE (usuario_id, fecha, momento)
);

CREATE TABLE IF NOT EXISTS lista_compra (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  item VARCHAR(255) NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  comprado INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS despensa (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  item VARCHAR(255) NOT NULL,
  origen VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS eventos (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  fecha_evento VARCHAR(50) NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conexiones_bancarias (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  requisition_id VARCHAR(255) NOT NULL UNIQUE,
  reference VARCHAR(255) NOT NULL UNIQUE,
  institution_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cuentas_bancarias (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  requisition_id VARCHAR(255) NOT NULL REFERENCES conexiones_bancarias(requisition_id) ON DELETE CASCADE,
  account_id VARCHAR(255) NOT NULL UNIQUE,
  banco_nombre VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
`;

export const INDEXES = `
CREATE INDEX IF NOT EXISTS idx_huchas_usuario ON huchas_ahorro(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mov_user_fecha ON movimientos_financieros(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_mov_hucha ON movimientos_financieros(hucha_id);
CREATE INDEX IF NOT EXISTS idx_comidas_user_fecha ON comidas_menu(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_lista_user ON lista_compra(usuario_id);
CREATE INDEX IF NOT EXISTS idx_despensa_user ON despensa(usuario_id);
CREATE INDEX IF NOT EXISTS idx_eventos_user_fecha ON eventos(usuario_id, fecha_evento);
CREATE INDEX IF NOT EXISTS idx_conexiones_usuario ON conexiones_bancarias(usuario_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_usuario ON cuentas_bancarias(usuario_id);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
`;

/**
 * Traduce consultas SQLite a formato PostgreSQL:
 * 1. Traduce ? a $1, $2, $3, etc.
 * 2. Convierte INSERT OR IGNORE INTO a ON CONFLICT DO NOTHING.
 * 3. Traduce strftime a SUBSTRING para compatibilidad de períodos de fecha.
 */
export function translateSql(sql) {
  let translated = sql;

  // Manejar INSERT OR IGNORE para cuentas_bancarias
  if (translated.toUpperCase().includes('INSERT OR IGNORE INTO CUENTAS_BANCARIAS')) {
    translated = translated.replace(/INSERT OR IGNORE INTO/i, 'INSERT INTO');
    if (!translated.toUpperCase().includes('ON CONFLICT')) {
      translated += ' ON CONFLICT (account_id) DO NOTHING';
    }
  }

  // Manejar INSERT OR IGNORE para movimientos_financieros
  if (translated.toUpperCase().includes('INSERT OR IGNORE INTO MOVIMIENTOS_FINANCIEROS')) {
    translated = translated.replace(/INSERT OR IGNORE INTO/i, 'INSERT INTO');
    if (!translated.toUpperCase().includes('ON CONFLICT')) {
      translated += ' ON CONFLICT (banco_transaccion_id) DO NOTHING';
    }
  }

  // Traducir strftime a SUBSTRING
  translated = translated.replace(/strftime\('%Y',\s*fecha\)/gi, 'SUBSTRING(fecha, 1, 4)');
  translated = translated.replace(/strftime\('%m',\s*fecha\)/gi, 'SUBSTRING(fecha, 6, 2)');

  // Traducir ? a $1, $2, $3...
  let pgSql = '';
  let paramIndex = 1;
  for (let i = 0; i < translated.length; i++) {
    if (translated[i] === '?') {
      pgSql += `$${paramIndex++}`;
    } else {
      pgSql += translated[i];
    }
  }

  return pgSql;
}

async function seedAdmin(client) {
  const res = await client.query('SELECT id FROM usuarios WHERE username = $1', ['admin'])
  if (res.rows.length > 0) return
  await client.query(
    'INSERT INTO usuarios (username, nombre, email, password) VALUES ($1, $2, $3, $4)',
    ['admin', 'Admin', 'admin@mybrain.com', '$2b$10$Y4FgB1OSe3H8UogOAB5k0O7ITPzypGms7QvgmdRYf2b7j5TEDPHeK']
  )
}

async function seedDemo(client) {
  const demoHash = '$2b$10$dqOXfuCrffSRTb7QI6ww0uc0pJVDDeLgvDPMY96ZcmIztz5loRQuC'
  const res = await client.query('SELECT id FROM usuarios WHERE username = $1', ['demo'])
  let demoId
  if (res.rows.length === 0) {
    const insertRes = await client.query(
      'INSERT INTO usuarios (username, nombre, email, password) VALUES ($1, $2, $3, $4) RETURNING id',
      ['demo', 'Demo', 'demo@mybrain.com', demoHash]
    )
    demoId = insertRes.rows[0].id
    console.log('[PostgreSQL] ✅ Usuario demo creado con éxito (ID:', demoId, ')')
  } else {
    demoId = res.rows[0].id
    await client.query('UPDATE usuarios SET password = $1 WHERE id = $2', [demoHash, demoId])
  }

  // Verificar si demo ya tiene movimientos
  const movCheck = await client.query('SELECT count(*) FROM movimientos_financieros WHERE usuario_id = $1', [demoId])
  if (parseInt(movCheck.rows[0].count, 10) === 0) {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const prevD = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const py = prevD.getFullYear()
    const pm = String(prevD.getMonth() + 1).padStart(2, '0')

    await client.query(
      'INSERT INTO huchas_ahorro (usuario_id, nombre, objetivo, saldo, orden) VALUES ($1, $2, $3, $4, $5), ($1, $6, $7, $8, $9), ($1, $10, $11, $12, $13)',
      [demoId, 'Vacaciones de Verano', 1500, 650, 1, 'Fondo de Emergencia', 3000, 1800, 2, 'Nuevo Portátil', 1200, 400, 3]
    )

    const movs = [
      ['ingreso', 2450.00, 'Nómina', 'Nómina mensual Tech Solutions', `${y}-${m}-01`],
      ['ingreso', 380.00, 'Otros', 'Proyecto freelance diseño UI', `${y}-${m}-12`],
      ['gasto', 750.00, 'Vivienda y Suministros', 'Alquiler piso centro', `${y}-${m}-02`],
      ['gasto', 135.40, 'Alimentación', 'Supermercado Mercadona compra semanal', `${y}-${m}-04`],
      ['gasto', 68.20, 'Vivienda y Suministros', 'Factura Luz y Gas Iberdrola', `${y}-${m}-07`],
      ['gasto', 45.00, 'Transporte', 'Abono mensual Transporte Público', `${y}-${m}-08`],
      ['gasto', 54.50, 'Ocio y Estilo de Vida', 'Cena restaurante italiano', `${y}-${m}-11`],
      ['gasto', 39.90, 'Salud y Cuidado Personal', 'Cuota mensual gimnasio Basic-Fit', `${y}-${m}-13`],
      ['gasto', 92.10, 'Alimentación', 'Compra Carrefour despensa y frescos', `${y}-${m}-16`],
      ['gasto', 22.98, 'Ocio y Estilo de Vida', 'Suscripciones streaming Spotify y HBO', `${y}-${m}-18`],
      ['gasto', 55.00, 'Transporte', 'Gasolina repostaje Repsol', `${y}-${m}-21`],
      ['gasto', 78.30, 'Alimentación', 'Supermercado Lidl productos frescos', `${y}-${m}-24`],
      ['ingreso', 2450.00, 'Nómina', 'Nómina mensual Tech Solutions', `${py}-${pm}-01`],
      ['gasto', 750.00, 'Vivienda y Suministros', 'Alquiler mensual', `${py}-${pm}-02`],
      ['gasto', 310.50, 'Alimentación', 'Supermercados compras acumuladas', `${py}-${pm}-10`],
      ['gasto', 95.00, 'Transporte', 'Transporte y combustible', `${py}-${pm}-14`],
      ['gasto', 120.00, 'Ocio y Estilo de Vida', 'Salidas y ocio fin de semana', `${py}-${pm}-20`],
    ]

    for (const mov of movs) {
      await client.query(
        'INSERT INTO movimientos_financieros (usuario_id, tipo, monto, categoria, descripcion, fecha) VALUES ($1, $2, $3, $4, $5, $6)',
        [demoId, ...mov]
      )
    }

    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diff)
    const addDaysIso = (base, n) => {
      const d = new Date(base)
      d.setDate(base.getDate() + n)
      return d.toISOString().slice(0, 10)
    }

    const weeklyMeals = [
      { offset: 0, momento: 'desayuno', plato: 'Tostadas con aguacate, tomate y café', notas: 'Desayuno mediterráneo saludable' },
      { offset: 0, momento: 'comida', plato: 'Lentejas estofadas con verduras', notas: 'Rico en hierro y proteínas' },
      { offset: 0, momento: 'cena', plato: 'Crema de calabacín y tortilla francesa', notas: 'Cena ligera' },
      { offset: 1, momento: 'desayuno', plato: 'Bowl de yogur griego con avena y frutos rojos', notas: '' },
      { offset: 1, momento: 'comida', plato: 'Pechuga de pollo a la plancha con quinoa y ensalada', notas: '' },
      { offset: 1, momento: 'cena', plato: 'Merluza al papillote con verduras', notas: '' },
      { offset: 2, momento: 'desayuno', plato: 'Tostada de pan integral con queso fresco y miel', notas: '' },
      { offset: 2, momento: 'comida', plato: 'Pasta al pesto casero con tomates cherry', notas: '' },
      { offset: 2, momento: 'cena', plato: 'Ensalada César con pollo y picatostes', notas: '' },
      { offset: 3, momento: 'desayuno', plato: 'Pancake de plátano y avena con café', notas: '' },
      { offset: 3, momento: 'comida', plato: 'Salmón al horno con patatas panaderas', notas: 'Omega 3' },
      { offset: 3, momento: 'cena', plato: 'Wok de verduras variadas con tofu', notas: '' },
      { offset: 4, momento: 'desayuno', plato: 'Tostada con jamón serrano y aceite de oliva', notas: '' },
      { offset: 4, momento: 'comida', plato: 'Arroz con verduras y champiñones', notas: '' },
      { offset: 4, momento: 'cena', plato: 'Pizza artesanal con base fina de verduras', notas: 'Noche de viernes' },
      { offset: 5, momento: 'desayuno', plato: 'Huevos revueltos con tostadas y zumo natural', notas: '' },
      { offset: 5, momento: 'comida', plato: 'Paella mixta de pollo y verduras', notas: 'Comida familiar' },
      { offset: 5, momento: 'cena', plato: 'Hamburguesa casera de ternera con ensalada', notas: '' },
      { offset: 6, momento: 'desayuno', plato: 'Café latte con bizcocho casero de avena', notas: '' },
      { offset: 6, momento: 'comida', plato: 'Guiso de patatas con ternera', notas: '' },
      { offset: 6, momento: 'cena', plato: 'Sopa de verduras caliente y huevo poché', notas: 'Preparación semana' },
    ]

    for (const meal of weeklyMeals) {
      await client.query(
        `INSERT INTO comidas_menu (usuario_id, fecha, momento, plato, notas) 
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (usuario_id, fecha, momento) DO UPDATE SET plato = EXCLUDED.plato, notas = EXCLUDED.notas`,
        [demoId, addDaysIso(monday, meal.offset), meal.momento, meal.plato, meal.notas]
      )
    }

    const itemsDespensa = [
      ['Arroz basmati (1kg)', 'Mercadona'],
      ['Aceite de oliva virgen extra', 'Almazara'],
      ['Café en grano 100% Arábica', 'Especialidad'],
      ['Copos de avena integral', 'Mercadona'],
      ['Atún en aceite de oliva (pack 6)', 'Lidl'],
      ['Pasta integral espaguetis', 'Carrefour'],
      ['Tomate triturado natural', 'Mercadona'],
      ['Lentejas pardinas cocidas', 'Mercadona'],
    ]
    for (const d of itemsDespensa) {
      await client.query('INSERT INTO despensa (usuario_id, item, origen) VALUES ($1, $2, $3)', [demoId, d[0], d[1]])
    }

    const itemsLista = [
      ['Bebida de avena sin azúcares', 2, 0],
      ['Aguacates maduros', 4, 0],
      ['Plátanos de Canarias', 6, 1],
      ['Pechuga de pollo de corral', 2, 0],
      ['Yogures griegos naturales', 6, 1],
      ['Nueces peladas', 1, 0],
      ['Pan de masa madre 100% espelta', 1, 0],
    ]
    for (const l of itemsLista) {
      await client.query('INSERT INTO lista_compra (usuario_id, item, cantidad, comprado) VALUES ($1, $2, $3, $4)', [demoId, l[0], l[1], l[2]])
    }

    const evs = [
      ['Reunión de seguimiento MyBrAIn', addDaysIso(now, 1), 'Presentación de avances y nuevas funcionalidades'],
      ['Cena con el equipo de producto', addDaysIso(now, 3), 'Cena informal para celebrar la demo'],
      ['Sesión de entrenamiento en gimnasio', addDaysIso(now, 5), 'Rutina de fuerza y core'],
    ]
    for (const ev of evs) {
      await client.query('INSERT INTO eventos (usuario_id, titulo, fecha_evento, descripcion) VALUES ($1, $2, $3, $4)', [demoId, ev[0], ev[1], ev[2]])
    }
  }
}

/**
 * Inicializa la base de datos PostgreSQL en Neon:
 * 1. Establece conexión mediante pool con SSL habilitado.
 * 2. Ejecuta el DDL (CREATE TABLE IF NOT EXISTS) para finanzas, alimentación, vida, banca y autenticación.
 * 3. Crea índices para optimización de consultas.
 * 4. Inserta el usuario administrador inicial si no existe.
 */
export async function inicializarBaseDeDatos() {
  if (!process.env.DATABASE_URL) {
    console.warn('[PostgreSQL] ⚠️ DATABASE_URL no está configurada en las variables de entorno.')
    return
  }

  console.log('[PostgreSQL] Conectando a Neon PostgreSQL y verificando esquema...')
  const client = await poolPg.connect()
  try {
    // Ejecutar creación del esquema (tablas de finanzas, alimentación, vida, etc.)
    await client.query(SCHEMA)
    // Crear índices
    await client.query(INDEXES)
    // Seed del usuario administrador por defecto
    await seedAdmin(client)
    // Seed del usuario demo por defecto
    await seedDemo(client)
    console.log('✅ Conexión exitosa a Neon PostgreSQL y esquema validado correctamente.')
  } catch (err) {
    console.error('❌ Error al inicializar PostgreSQL en Neon:', err)
    throw err
  } finally {
    client.release()
  }
}

// Alias para compatibilidad con código existente
export const initDatabase = inicializarBaseDeDatos

/**
 * Adaptador compatible con pool.execute de la base de datos anterior.
 * Traduce ? a $1, $2... y emula la respuesta [{ insertId, affectedRows }]/[rows].
 */
export const pool = {
  async execute(sql, params = []) {
    const pgSql = translateSql(sql)
    
    // Si es un INSERT, anexar RETURNING id para emular insertId de forma transparente
    const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
    let finalSql = pgSql;
    if (isInsert && !pgSql.toUpperCase().includes('RETURNING')) {
      finalSql += ' RETURNING id';
    }

    const res = await poolPg.query(finalSql, params)
    const cmd = sql.trim().split(/\s+/)[0].toUpperCase()

    if (cmd === 'SELECT' || cmd === 'WITH') {
      return [res.rows]
    }

    const insertId = res.rows[0]?.id || null
    return [
      {
        insertId: insertId,
        affectedRows: res.rowCount,
      },
    ]
  },
}

/**
 * Implementación de transacciones en PostgreSQL.
 */
export async function withTransaction(fn) {
  const client = await poolPg.connect()
  try {
    await client.query('BEGIN')
    const tx = {
      async run(sql, params = []) {
        const pgSql = translateSql(sql)
        // Anexar RETURNING id para inserts en transacciones
        const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
        let finalSql = pgSql;
        if (isInsert && !pgSql.toUpperCase().includes('RETURNING')) {
          finalSql += ' RETURNING id';
        }
        const res = await client.query(finalSql, params)
        return {
          lastID: res.rows[0]?.id || null,
          changes: res.rowCount,
        }
      }
    }
    const result = await fn(tx)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
