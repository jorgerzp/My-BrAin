-- ============================================
-- MyBrAIn - Base de datos MySQL
-- BD: mybrain | Usuario MySQL: mybrain_user
-- Login: admin / 1234
--
-- Recreación total (borra BD y usuarios, vuelve a crear todo): ver
-- backend/database/setup_desde_cero.sql y SETUP.md.
-- ============================================

USE mybrain;

-- ============================================
-- TABLA: usuarios
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  avatar VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- Usuario por defecto: admin / 1234
-- Contraseña hasheada con bcrypt (10 rounds)
-- ============================================
INSERT INTO usuarios (username, nombre, email, password) VALUES
('admin', 'Admin', 'admin@mybrain.com', '$2b$10$Y4FgB1OSe3H8UogOAB5k0O7ITPzypGms7QvgmdRYf2b7j5TEDPHeK')
ON DUPLICATE KEY UPDATE nombre = nombre;

-- Finanzas y alimentación (misma estructura que migration_finanzas_alimentacion.sql)
CREATE TABLE IF NOT EXISTS movimientos_financieros (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tipo ENUM('ingreso','gasto') NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  categoria VARCHAR(80) DEFAULT NULL,
  descripcion VARCHAR(500) DEFAULT NULL,
  fecha DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mov_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_mov_user_fecha (usuario_id, fecha)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS menus_comidas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  fecha DATE NOT NULL,
  momento ENUM('desayuno','comida','cena') NOT NULL,
  plato VARCHAR(255) NOT NULL,
  notas VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY uq_menu_user_fecha_momento (usuario_id, fecha, momento)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lista_compra (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  item VARCHAR(200) NOT NULL,
  comprado TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lista_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_lista_user (usuario_id)
) ENGINE=InnoDB;

-- Despensa: productos inferidos (p. ej. desde ticket IA); el backend SQLite ya la crea en migración local.
CREATE TABLE IF NOT EXISTS despensa (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  item VARCHAR(200) NOT NULL,
  origen VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_despensa_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_despensa_user (usuario_id)
) ENGINE=InnoDB;
