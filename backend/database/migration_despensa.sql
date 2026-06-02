-- MyBrAIn — tabla despensa (productos desde ticket IA u otros orígenes)
-- Uso: mysql -u root -p mybrain < backend/database/migration_despensa.sql

USE mybrain;

CREATE TABLE IF NOT EXISTS despensa (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  item VARCHAR(200) NOT NULL,
  origen VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_despensa_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_despensa_user (usuario_id)
) ENGINE=InnoDB;
