-- Tabla para el seguimiento de la vigencia e índice de rotación de productos por punto de venta
CREATE TABLE IF NOT EXISTS vigencias_productos (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL,                  -- ID del vendedor / punto de venta
    producto_id INT NOT NULL,                 -- ID del producto entregado
    cantidad_inicial INT NOT NULL,            -- Unidades entregadas en la remesa/lote
    fecha_inicio TIMESTAMP DEFAULT NOW(),     -- Inicio automático de la vigencia al entregar
    fecha_fin TIMESTAMP NULL,                 -- Momento en que el stock del vendedor llega a 0
    estado VARCHAR(20) DEFAULT 'activa',      -- 'activa' o 'agotada'
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_vigencia_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_vigencia_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);

-- Índices para optimizar las consultas de rotación por vendedor y producto
CREATE INDEX IF NOT EXISTS idx_vigencias_busqueda ON vigencias_productos (usuario_id, producto_id, estado);
CREATE INDEX IF NOT EXISTS idx_vigencias_fechas ON vigencias_productos (fecha_inicio, fecha_fin);
