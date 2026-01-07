-- Crear tabla de empleados para puntos de venta
-- Esta tabla gestiona los empleados asociados a cada punto de venta (usuario)
-- Cada empleado tiene su propio login y es redirigido al panel de su punto de venta

CREATE TABLE empleados (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    nombre VARCHAR(255) NOT NULL,
    usuario_id VARCHAR(36) NOT NULL,
    password VARCHAR(255) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Clave foránea al usuario (punto de venta)
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    
    -- Índices para mejorar consultas
    INDEX idx_usuario_id (usuario_id),
    INDEX idx_activo (activo),
    INDEX idx_created_at (created_at)
);

-- Trigger para actualizar automáticamente el campo updated_at
DELIMITER //
CREATE TRIGGER trg_empleados_before_update
BEFORE UPDATE ON empleados
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;