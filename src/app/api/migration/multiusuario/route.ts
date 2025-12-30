import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Iniciando migración multi-usuario...');

    // PASO 1: Crear usuarios por defecto
    console.log('📝 Paso 1: Creando usuarios Cafetería y Cocina...');

    await query(`
      INSERT INTO usuarios (nombre, password, telefono, rol, activo)
      VALUES ('Cafetería', 'cafeteria123', '', 'Vendedor', true)
      ON CONFLICT (nombre) DO NOTHING
    `);

    await query(`
      INSERT INTO usuarios (nombre, password, telefono, rol, activo)
      VALUES ('Cocina', 'cocina123', '', 'Vendedor', true)
      ON CONFLICT (nombre) DO NOTHING
    `);

    // Obtener IDs de los usuarios creados
    const cafeteriaResult = await query(`SELECT id FROM usuarios WHERE nombre = 'Cafetería' LIMIT 1`);
    const cocinaResult = await query(`SELECT id FROM usuarios WHERE nombre = 'Cocina' LIMIT 1`);

    if (cafeteriaResult.rows.length === 0 || cocinaResult.rows.length === 0) {
      throw new Error('No se pudieron crear los usuarios por defecto');
    }

    const cafeteriaId = cafeteriaResult.rows[0].id;
    const cocinaId = cocinaResult.rows[0].id;

    console.log(`✅ Usuarios creados - Cafetería: ${cafeteriaId}, Cocina: ${cocinaId}`);

    // PASO 2: Agregar columna usuario_id a usuario_productos
    console.log('📝 Paso 2: Preparando columna usuario_id...');

    // Primero, eliminar la columna si ya existe (puede ser UUID del intento anterior)
    await query(`
      ALTER TABLE usuario_productos 
      DROP COLUMN IF EXISTS usuario_id
    `);

    // Ahora agregar la columna como INTEGER
    await query(`
      ALTER TABLE usuario_productos 
      ADD COLUMN usuario_id INTEGER
    `);

    console.log('✅ Columna usuario_id creada como INTEGER');



    // PASO 3: Migrar datos existentes de usuario_productos a Cafetería
    console.log('📝 Paso 3: Migrando productos existentes a Cafetería...');

    const updateResult = await query(`
      UPDATE usuario_productos 
      SET usuario_id = $1 
      WHERE usuario_id IS NULL
    `, [cafeteriaId]);

    console.log(`✅ ${updateResult.rowCount} productos asignados a Cafetería`);

    // PASO 4: Aplicar constraints ANTES de migrar cocina
    console.log('📝 Paso 4: Aplicando constraints...');

    // Hacer usuario_id NOT NULL
    await query(`
      ALTER TABLE usuario_productos 
      ALTER COLUMN usuario_id SET NOT NULL
    `);

    // Agregar foreign key
    await query(`
      ALTER TABLE usuario_productos
      DROP CONSTRAINT IF EXISTS fk_usuario_productos_usuario
    `);

    await query(`
      ALTER TABLE usuario_productos
      ADD CONSTRAINT fk_usuario_productos_usuario
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    `);

    // Eliminar constraint único anterior y crear uno nuevo
    await query(`
      ALTER TABLE usuario_productos
      DROP CONSTRAINT IF EXISTS usuario_productos_producto_id_key
    `);

    await query(`
      ALTER TABLE usuario_productos
      DROP CONSTRAINT IF EXISTS usuario_productos_usuario_producto_unique
    `);

    // Consolidar duplicados antes de crear el constraint UNIQUE
    console.log('📝 Consolidando registros duplicados...');

    await query(`
      -- Crear tabla temporal con datos consolidados
      CREATE TEMP TABLE temp_usuario_productos AS
      SELECT 
        usuario_id,
        producto_id,
        SUM(cantidad) as cantidad,
        MAX(precio) as precio,
        MIN(id) as id_keep
      FROM usuario_productos
      WHERE usuario_id IS NOT NULL
      GROUP BY usuario_id, producto_id;

      -- Eliminar todos los registros
      DELETE FROM usuario_productos WHERE usuario_id IS NOT NULL;

      -- Insertar registros consolidados
      INSERT INTO usuario_productos (usuario_id, producto_id, cantidad, precio)
      SELECT usuario_id, producto_id, cantidad, precio
      FROM temp_usuario_productos;

      -- Eliminar tabla temporal
      DROP TABLE temp_usuario_productos;
    `);

    console.log('✅ Duplicados consolidados');

    await query(`
      ALTER TABLE usuario_productos
      ADD CONSTRAINT usuario_productos_usuario_producto_unique
      UNIQUE (usuario_id, producto_id)
    `);


    // Crear índice
    await query(`
      CREATE INDEX IF NOT EXISTS idx_usuario_productos_usuario_id 
      ON usuario_productos(usuario_id)
    `);

    console.log('✅ Constraints aplicados correctamente');

    // PASO 4.5: Preparar tabla usuario_producto_parametros
    console.log('📝 Paso 4.5: Preparando tabla usuario_producto_parametros...');

    // Verificar si la tabla existe
    const parametrosTableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'usuario_producto_parametros'
      )
    `);

    if (parametrosTableCheck.rows[0].exists) {
      // Eliminar columna usuario_id si existe
      await query(`
        ALTER TABLE usuario_producto_parametros 
        DROP COLUMN IF EXISTS usuario_id
      `);

      // Agregar columna usuario_id como INTEGER
      await query(`
        ALTER TABLE usuario_producto_parametros 
        ADD COLUMN usuario_id INTEGER
      `);

      // Migrar datos existentes a Cafetería
      await query(`
        UPDATE usuario_producto_parametros 
        SET usuario_id = $1 
        WHERE usuario_id IS NULL
      `, [cafeteriaId]);

      // Hacer usuario_id NOT NULL
      await query(`
        ALTER TABLE usuario_producto_parametros 
        ALTER COLUMN usuario_id SET NOT NULL
      `);

      // Agregar foreign key
      await query(`
        ALTER TABLE usuario_producto_parametros
        DROP CONSTRAINT IF EXISTS fk_usuario_producto_parametros_usuario
      `);

      await query(`
        ALTER TABLE usuario_producto_parametros
        ADD CONSTRAINT fk_usuario_producto_parametros_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      `);

      // Actualizar constraint único
      await query(`
        ALTER TABLE usuario_producto_parametros
        DROP CONSTRAINT IF EXISTS usuario_producto_parametros_producto_id_nombre_key
      `);

      await query(`
        ALTER TABLE usuario_producto_parametros
        DROP CONSTRAINT IF EXISTS usuario_producto_parametros_usuario_id_producto_id_nombre_key
      `);

      await query(`
        ALTER TABLE usuario_producto_parametros
        DROP CONSTRAINT IF EXISTS usuario_producto_parametros_unique
      `);


      // Consolidar duplicados
      console.log('📝 Consolidando parámetros duplicados...');

      await query(`
        CREATE TEMP TABLE temp_parametros AS
        SELECT 
          usuario_id,
          producto_id,
          nombre,
          SUM(cantidad) as cantidad
        FROM usuario_producto_parametros
        WHERE usuario_id IS NOT NULL
        GROUP BY usuario_id, producto_id, nombre;

        DELETE FROM usuario_producto_parametros WHERE usuario_id IS NOT NULL;

        INSERT INTO usuario_producto_parametros (usuario_id, producto_id, nombre, cantidad)
        SELECT usuario_id, producto_id, nombre, cantidad
        FROM temp_parametros;

        DROP TABLE temp_parametros;
      `);

      console.log('✅ Parámetros duplicados consolidados');

      await query(`
        ALTER TABLE usuario_producto_parametros
        ADD CONSTRAINT usuario_producto_parametros_unique
        UNIQUE (usuario_id, producto_id, nombre)
      `);


      console.log('✅ Tabla usuario_producto_parametros preparada');
    }

    // PASO 5: Verificar si existe la tabla cocina

    const cocinaTableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'cocina'
      )
    `);

    const cocinaExists = cocinaTableCheck.rows[0].exists;

    if (cocinaExists) {
      console.log('📝 Paso 5: Migrando productos de tabla cocina...');

      // Migrar productos de cocina a usuario_productos
      const cocinaProducts = await query(`
        SELECT c.producto_id, c.cantidad, p.precio
        FROM cocina c
        JOIN productos p ON c.producto_id = p.id
      `);

      for (const producto of cocinaProducts.rows) {
        await query(`
          INSERT INTO usuario_productos (usuario_id, producto_id, cantidad, precio)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (usuario_id, producto_id) 
          DO UPDATE SET cantidad = usuario_productos.cantidad + EXCLUDED.cantidad
        `, [cocinaId, producto.producto_id, producto.cantidad, producto.precio]);
      }

      console.log(`✅ ${cocinaProducts.rows.length} productos migrados de cocina`);

      // PASO 6: Migrar parámetros de cocina_parametros
      console.log('📝 Paso 6: Migrando parámetros de cocina...');

      const cocinaParametrosCheck = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'cocina_parametros'
        )
      `);

      if (cocinaParametrosCheck.rows[0].exists) {
        const cocinaParametros = await query(`
          SELECT producto_id, nombre, cantidad
          FROM cocina_parametros
        `);

        for (const param of cocinaParametros.rows) {
          await query(`
            INSERT INTO usuario_producto_parametros (usuario_id, producto_id, nombre, cantidad)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (usuario_id, producto_id, nombre) 
            DO UPDATE SET cantidad = usuario_producto_parametros.cantidad + EXCLUDED.cantidad
          `, [cocinaId, param.producto_id, param.nombre, param.cantidad]);
        }

        console.log(`✅ ${cocinaParametros.rows.length} parámetros migrados`);
      }
    } else {
      console.log('ℹ️ Tabla cocina no existe, saltando migración de cocina');
    }

    // PASO 7: Eliminar columna cocina si existe
    console.log('📝 Paso 7: Eliminando columna cocina de usuario_productos...');


    await query(`
      ALTER TABLE usuario_productos
      DROP COLUMN IF EXISTS cocina
    `);

    // PASO 8: Renombrar tablas antiguas
    if (cocinaExists) {
      console.log('📝 Paso 8: Renombrando tablas antiguas...');

      await query(`ALTER TABLE IF EXISTS cocina RENAME TO cocina_old`);
      await query(`ALTER TABLE IF EXISTS cocina_parametros RENAME TO cocina_parametros_old`);

      console.log('✅ Tablas renombradas a *_old');
    }

    // PASO 9: Verificación
    console.log('📝 Paso 9: Verificando migración...');

    const verificacion = await query(`
      SELECT 
        COUNT(*) as total_productos,
        COUNT(*) FILTER (WHERE usuario_id IS NULL) as sin_usuario,
        COUNT(DISTINCT usuario_id) as usuarios_con_productos
      FROM usuario_productos
    `);

    const stats = verificacion.rows[0];

    if (parseInt(stats.sin_usuario) > 0) {
      throw new Error(`Hay ${stats.sin_usuario} productos sin usuario_id asignado`);
    }

    // Obtener resumen por usuario
    const resumen = await query(`
      SELECT 
        u.nombre AS usuario,
        u.rol,
        COUNT(up.producto_id) AS total_productos,
        SUM(up.cantidad) AS cantidad_total
      FROM usuarios u
      LEFT JOIN usuario_productos up ON u.id = up.usuario_id
      WHERE up.producto_id IS NOT NULL
      GROUP BY u.id, u.nombre, u.rol
      ORDER BY total_productos DESC
    `);

    console.log('✅ Migración completada exitosamente!');

    return NextResponse.json({
      success: true,
      message: 'Migración completada exitosamente',
      estadisticas: {
        total_productos: parseInt(stats.total_productos),
        usuarios_con_productos: parseInt(stats.usuarios_con_productos),
        productos_sin_usuario: parseInt(stats.sin_usuario)
      },
      resumen_por_usuario: resumen.rows
    });

  } catch (error) {
    console.error('❌ Error en migración:', error);

    return NextResponse.json({
      success: false,
      error: 'Error en la migración',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

// Endpoint GET para verificar el estado actual
export async function GET() {
  try {
    // Verificar si ya se ejecutó la migración
    const columnCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'usuario_productos' 
      AND column_name = 'usuario_id'
    `);

    const migracionEjecutada = columnCheck.rows.length > 0;

    if (!migracionEjecutada) {
      return NextResponse.json({
        migrado: false,
        message: 'La migración aún no se ha ejecutado'
      });
    }

    // Obtener estadísticas
    const stats = await query(`
      SELECT 
        u.nombre AS usuario,
        u.rol,
        COUNT(up.producto_id) AS total_productos,
        SUM(up.cantidad) AS cantidad_total
      FROM usuarios u
      LEFT JOIN usuario_productos up ON u.id = up.usuario_id
      WHERE up.producto_id IS NOT NULL
      GROUP BY u.id, u.nombre, u.rol
      ORDER BY total_productos DESC
    `);

    return NextResponse.json({
      migrado: true,
      message: 'La migración ya fue ejecutada',
      resumen: stats.rows
    });

  } catch (error) {
    console.error('Error verificando estado de migración:', error);

    return NextResponse.json({
      error: 'Error al verificar estado',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
