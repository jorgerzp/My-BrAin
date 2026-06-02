-- Ejecutar sobre la BD mybrain (usuario con permisos):
-- mysql -u root -p mybrain < migration_finanzas_alimentacion.sql

USE mybrain;

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
