-- =====================================================
-- MIGRACIÓN COMPLETA: Sistema Multi-Usuario
-- =====================================================
-- Descripción: Migra de sistema cafetería/cocina fijo
--              a sistema multi-usuario con usuario_id
-- =====================================================

BEGIN;

-- =====================================================
-- PASO 1: Crear Usuarios por Defecto
-- =====================================================

-- Crear usuario "Cafetería" para productos actuales de usuario_productos
INSERT INTO usuarios (nombre, password, telefono, rol, activo)
VALUES ('Cafetería', 'cafeteria123', '', 'Vendedor', true)
ON CONFLICT (nombre) DO NOTHING;

-- Crear usuario "Cocina" para productos actuales de tabla cocina
INSERT INTO usuarios (nombre, password, telefono, rol, activo)
VALUES ('Cocina', 'cocina123', '', 'Vendedor', true)
ON CONFLICT (nombre) DO NOTHING;

-- =====================================================
-- PASO 2: Modificar Tabla usuario_productos
-- =====================================================

-- Eliminar columna usuario_id si ya existe (puede ser UUID de intento anterior)
ALTER TABLE usuario_productos 
DROP COLUMN IF EXISTS usuario_id;

-- Agregar columna usuario_id como INTEGER (no UUID)
ALTER TABLE usuario_productos 
ADD COLUMN usuario_id INTEGER;


-- =====================================================
-- PASO 3: Migrar Datos de usuario_productos
-- =====================================================

DO $$
DECLARE
    cafeteria_id INTEGER;
BEGIN
    -- Obtener ID del usuario Cafetería
    SELECT id INTO cafeteria_id 
    FROM usuarios 
    WHERE nombre = 'Cafetería' 
    LIMIT 1;

    
    -- Asignar todos los productos existentes a Cafetería
    UPDATE usuario_productos 
    SET usuario_id = cafeteria_id 
    WHERE usuario_id IS NULL;
    
    RAISE NOTICE 'Productos migrados a Cafetería: %', 
        (SELECT COUNT(*) FROM usuario_productos WHERE usuario_id = cafeteria_id);
END $$;

-- =====================================================
-- PASO 4: Migrar Datos de Tabla cocina
-- =====================================================

DO $$
DECLARE
    cocina_id INTEGER;
    producto_record RECORD;
BEGIN
    -- Obtener ID del usuario Cocina
    SELECT id INTO cocina_id 
    FROM usuarios 
    WHERE nombre = 'Cocina' 
    LIMIT 1;

    
    -- Migrar productos de cocina a usuario_productos
    FOR producto_record IN 
        SELECT c.producto_id, c.cantidad, p.precio
        FROM cocina c
        JOIN productos p ON c.producto_id = p.id
    LOOP
        -- Insertar en usuario_productos
        INSERT INTO usuario_productos (usuario_id, producto_id, cantidad, precio)
        VALUES (cocina_id, producto_record.producto_id, producto_record.cantidad, producto_record.precio)
        ON CONFLICT (usuario_id, producto_id) 
        DO UPDATE SET 
            cantidad = usuario_productos.cantidad + EXCLUDED.cantidad;
    END LOOP;
    
    RAISE NOTICE 'Productos migrados de cocina a usuario_productos: %', 
        (SELECT COUNT(*) FROM cocina);
END $$;

-- =====================================================
-- PASO 5: Migrar Parámetros de cocina_parametros
-- =====================================================

DO $$
DECLARE
    cocina_id INTEGER;
    parametro_record RECORD;
BEGIN
    -- Obtener ID del usuario Cocina
    SELECT id INTO cocina_id 
    FROM usuarios 
    WHERE nombre = 'Cocina' 
    LIMIT 1;

    
    -- Migrar parámetros de cocina a usuario_producto_parametros
    FOR parametro_record IN 
        SELECT producto_id, nombre, cantidad
        FROM cocina_parametros
    LOOP
        -- Insertar en usuario_producto_parametros
        INSERT INTO usuario_producto_parametros (usuario_id, producto_id, nombre, cantidad)
        VALUES (cocina_id, parametro_record.producto_id, parametro_record.nombre, parametro_record.cantidad)
        ON CONFLICT (usuario_id, producto_id, nombre) 
        DO UPDATE SET 
            cantidad = usuario_producto_parametros.cantidad + EXCLUDED.cantidad;
    END LOOP;
    
    RAISE NOTICE 'Parámetros migrados de cocina_parametros: %', 
        (SELECT COUNT(*) FROM cocina_parametros);
END $$;

-- =====================================================
-- PASO 6: Aplicar Constraints a usuario_productos
-- =====================================================

-- Hacer usuario_id NOT NULL
ALTER TABLE usuario_productos 
ALTER COLUMN usuario_id SET NOT NULL;

-- Agregar foreign key
ALTER TABLE usuario_productos
DROP CONSTRAINT IF EXISTS fk_usuario_productos_usuario;

ALTER TABLE usuario_productos
ADD CONSTRAINT fk_usuario_productos_usuario
FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;

-- Eliminar constraint único anterior y crear uno nuevo con usuario_id
ALTER TABLE usuario_productos
DROP CONSTRAINT IF EXISTS usuario_productos_producto_id_key;

ALTER TABLE usuario_productos
DROP CONSTRAINT IF EXISTS usuario_productos_usuario_producto_unique;

ALTER TABLE usuario_productos
ADD CONSTRAINT usuario_productos_usuario_producto_unique
UNIQUE (usuario_id, producto_id);

-- Crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_usuario_productos_usuario_id 
ON usuario_productos(usuario_id);

-- =====================================================
-- PASO 7: Eliminar Columna "cocina" de usuario_productos
-- =====================================================

-- Esta columna ya no es necesaria porque ahora diferenciamos por usuario_id
ALTER TABLE usuario_productos
DROP COLUMN IF EXISTS cocina;

-- =====================================================
-- PASO 8: Renombrar Tablas Antiguas (Backup)
-- =====================================================

-- Renombrar tabla cocina a cocina_old (por si necesitamos rollback)
ALTER TABLE IF EXISTS cocina 
RENAME TO cocina_old;

-- Renombrar tabla cocina_parametros a cocina_parametros_old
ALTER TABLE IF EXISTS cocina_parametros 
RENAME TO cocina_parametros_old;

-- =====================================================
-- PASO 9: Verificación de Migración
-- =====================================================

DO $$
DECLARE
    total_productos INTEGER;
    productos_sin_usuario INTEGER;
    usuarios_con_productos INTEGER;
BEGIN
    -- Contar total de productos
    SELECT COUNT(*) INTO total_productos FROM usuario_productos;
    
    -- Verificar que no haya productos sin usuario
    SELECT COUNT(*) INTO productos_sin_usuario 
    FROM usuario_productos 
    WHERE usuario_id IS NULL;
    
    -- Contar usuarios con productos
    SELECT COUNT(DISTINCT usuario_id) INTO usuarios_con_productos 
    FROM usuario_productos;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN DE MIGRACIÓN';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total de productos en usuario_productos: %', total_productos;
    RAISE NOTICE 'Productos sin usuario_id: %', productos_sin_usuario;
    RAISE NOTICE 'Usuarios con productos: %', usuarios_con_productos;
    RAISE NOTICE '========================================';
    
    -- Verificar que no haya productos sin usuario
    IF productos_sin_usuario > 0 THEN
        RAISE EXCEPTION 'ERROR: Hay % productos sin usuario_id asignado', productos_sin_usuario;
    END IF;
    
    RAISE NOTICE 'Migración completada exitosamente!';
END $$;

-- =====================================================
-- PASO 10: Mostrar Resumen por Usuario
-- =====================================================

SELECT 
    u.nombre AS usuario,
    u.rol,
    COUNT(up.producto_id) AS total_productos,
    SUM(up.cantidad) AS cantidad_total
FROM usuarios u
LEFT JOIN usuario_productos up ON u.id = up.usuario_id
WHERE up.producto_id IS NOT NULL
GROUP BY u.id, u.nombre, u.rol
ORDER BY total_productos DESC;

COMMIT;

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================
-- 1. Las tablas cocina y cocina_parametros se renombran a *_old
-- 2. NO se eliminan automáticamente por seguridad
-- 3. Después de verificar que todo funciona, puedes eliminarlas con:
--    DROP TABLE IF EXISTS cocina_old;
--    DROP TABLE IF EXISTS cocina_parametros_old;
-- =====================================================
