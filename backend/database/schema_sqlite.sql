-- MyBrAIn — referencia SQLite (finanzas personales + menú / lista compra)
-- La inicialización real está en backend/server/sqlite-db.js
-- Tipos: INTEGER PRIMARY KEY AUTOINCREMENT, TEXT, REAL

PRAGMA foreign_keys = ON;

-- Usuarios de la aplicación
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

-- Huchas / sobres de ahorro por usuario
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

-- Ingresos, gastos y aportaciones a huchas (sin campos de trading/cripto)
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

-- Menú semanal / IA nutrición
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

-- Lista de la compra
CREATE TABLE IF NOT EXISTS lista_compra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  item TEXT NOT NULL,
  comprado INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lista_user ON lista_compra(usuario_id);
