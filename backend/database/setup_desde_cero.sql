-- =============================================================================
-- MyBrAIn — Recrear base de datos desde cero (MySQL instalado en el sistema)
-- =============================================================================
-- ⚠️  BORRA por completo la base `mybrain` y el usuario `mybrain_user` en los
--     hosts `localhost` y `127.0.0.1`, y los vuelve a crear con tablas y admin.
--
-- Ejecutar como root del servidor MySQL (ajusta la contraseña si la cambias en .env):
--
--   cd /ruta/al/repo/My_BrAIn
--   sudo mysql < backend/database/setup_desde_cero.sql
--
-- Tras esto, en backend/server/.env usa (valores por defecto del proyecto):
--   DB_HOST=127.0.0.1
--   DB_PORT=3306
--   DB_USER=mybrain_user
--   DB_PASSWORD="MyBr4in_S3cur3!"
--   DB_NAME=mybrain
--
-- Login web: admin / 1234
-- =============================================================================

SET NAMES utf8mb4;

DROP DATABASE IF EXISTS mybrain;

CREATE DATABASE mybrain
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Usuario para Node/DBeaver vía socket (localhost) y TCP (127.0.0.1)
DROP USER IF EXISTS 'mybrain_user'@'localhost';
DROP USER IF EXISTS 'mybrain_user'@'127.0.0.1';

CREATE USER 'mybrain_user'@'localhost' IDENTIFIED BY 'MyBr4in_S3cur3!';
CREATE USER 'mybrain_user'@'127.0.0.1' IDENTIFIED BY 'MyBr4in_S3cur3!';

GRANT ALL PRIVILEGES ON mybrain.* TO 'mybrain_user'@'localhost';
GRANT ALL PRIVILEGES ON mybrain.* TO 'mybrain_user'@'127.0.0.1';
FLUSH PRIVILEGES;

USE mybrain;

-- ========== Esquema (mismo contenido que init.sql) ==========

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

INSERT INTO usuarios (username, nombre, email, password) VALUES
('admin', 'Admin', 'admin@mybrain.com', '$2b$10$Y4FgB1OSe3H8UogOAB5k0O7ITPzypGms7QvgmdRYf2b7j5TEDPHeK')
ON DUPLICATE KEY UPDATE nombre = nombre;

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
