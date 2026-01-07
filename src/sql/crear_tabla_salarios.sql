-- Crear tabla de salarios para empleados
-- Esta tabla almacena los salarios de los empleados por punto de venta
-- Los salarios se usan para calcular gastos en la contabilidad

CREATE TABLE salarios (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    usuario_id VARCHAR(36) NOT NULL,  -- Punto de venta al que pertenece el empleado
    empleado_id VARCHAR(36) NOT NULL,  -- Empleado específico
    salario DECIMAL(10, 2) NOT NULL DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Claves foráneas
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
    
    -- Índices para mejorar consultas
    INDEX idx_usuario_id (usuario_id),
    INDEX idx_empleado_id (empleado_id),
    INDEX idx_activo (activo),
    INDEX idx_created_at (created_at),
    
    -- Un empleado solo puede tener un salario activo por punto de venta
    UNIQUE KEY unique_empleado_activo (empleado_id, activo)
);

-- Trigger para actualizar automáticamente el campo updated_at
DELIMITER //
CREATE TRIGGER trg_salarios_before_update
BEFORE UPDATE ON salarios
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;