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
