-- =========================================================================
-- MIGRACIÓN DE BASE DE DATOS: MÓDULO DE INVENTARIOS FÍSICOS (AUDITORÍAS)
-- =========================================================================

BEGIN;

-- 1. Tabla principal de inventarios físicos
CREATE TABLE IF NOT EXISTS inventarios_fisicos (
    id SERIAL PRIMARY KEY,
    moderador_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    vendedor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    punto_venta_nombre VARCHAR(150) NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    total_items_auditados INTEGER NOT NULL DEFAULT 0,
    total_discrepancias INTEGER NOT NULL DEFAULT 0,
    observaciones TEXT
);

-- 2. Tabla de detalles por cada producto/variante auditado
CREATE TABLE IF NOT EXISTS inventario_fisico_detalles (
    id SERIAL PRIMARY KEY,
    inventario_id INTEGER REFERENCES inventarios_fisicos(id) ON DELETE CASCADE,
    producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
    nombre_producto VARCHAR(255) NOT NULL,
    codigo_barras VARCHAR(100),
    parametro_nombre VARCHAR(100),
    cantidad_sistema NUMERIC(10,2) NOT NULL,
    cantidad_fisica NUMERIC(10,2) NOT NULL,
    diferencia NUMERIC(10,2) NOT NULL,
    precio_compra NUMERIC(10,2) DEFAULT 0,
    precio_venta NUMERIC(10,2) DEFAULT 0
);

-- 3. Índices para acelerar consultas por moderador, punto de venta y fecha
CREATE INDEX IF NOT EXISTS idx_inventarios_fisicos_moderador_fecha 
ON inventarios_fisicos(moderador_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_inventarios_fisicos_vendedor_fecha 
ON inventarios_fisicos(vendedor_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_inventario_detalles_inventario_id 
ON inventario_fisico_detalles(inventario_id);

COMMIT;
