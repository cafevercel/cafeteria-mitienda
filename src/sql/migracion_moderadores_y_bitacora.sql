-- =========================================================================
-- MIGRACIÓN DE BASE DE DATOS: ROL DE MODERADOR Y BITÁCORA DE AUDITORÍA
-- =========================================================================
-- Descripción: Este script crea la tabla de bitácora para auditar las
--              acciones de los moderadores por día y optimiza las consultas.
-- =========================================================================

BEGIN;

-- 1. Crear la tabla de Bitácora para Moderadores
-- Esta tabla registrará de forma automática las operaciones de:
--   - 'crear_producto'
--   - 'entregar_producto'
--   - 'mover_vendedores'
--   - 'ver_transacciones'
CREATE TABLE IF NOT EXISTS bitacora_moderadores (
    id SERIAL PRIMARY KEY,
    moderador_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    accion VARCHAR(100) NOT NULL,
    detalles TEXT NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Crear un índice de alto rendimiento
-- Optimiza la carga del historial agrupado por día en la vista del administrador
CREATE INDEX IF NOT EXISTS idx_bitacora_moderadores_id_fecha 
ON bitacora_moderadores(moderador_id, fecha DESC);

-- =========================================================================
-- NOTAS DE INTEGRACIÓN:
-- 1. Los nuevos moderadores se crearán dinámicamente desde tu panel de admin.
-- 2. La columna 'rol' en la tabla 'usuarios' almacena el valor 'Moderador'
--    sin requerir cambios adicionales en la estructura de tu tabla actual.
-- =========================================================================

COMMIT;
