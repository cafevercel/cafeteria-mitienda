import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Función helper para manejar errores de base de datos
function handleDatabaseError(error: unknown): NextResponse {
  console.error('Database error:', error);

  if (error && typeof error === 'object' && 'code' in error) {
    const dbError = error as { code: string; message?: string };

    switch (dbError.code) {
      case 'ECONNREFUSED':
        return NextResponse.json(
          { error: 'Error de conexión a la base de datos' },
          { status: 503 }
        );
      case '42P01':
        return NextResponse.json(
          { error: 'Error de configuración de base de datos' },
          { status: 500 }
        );
      case '23505':
        return NextResponse.json(
          { error: 'El registro ya existe' },
          { status: 409 }
        );
      case '42703':
        return NextResponse.json(
          { error: 'Error de estructura de base de datos' },
          { status: 500 }
        );
      case '23503': // Foreign key violation
        return NextResponse.json(
          { error: 'Referencia inválida' },
          { status: 400 }
        );
      default:
        return NextResponse.json(
          { error: 'Error de base de datos' },
          { status: 500 }
        );
    }
  }

  return NextResponse.json(
    { error: 'Error interno del servidor' },
    { status: 500 }
  );
}

// Validación para parámetros de productos
function validateParametros(parametros: any[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(parametros)) {
    errors.push('Los parámetros deben ser un array');
    return { valid: false, errors };
  }

  parametros.forEach((param, index) => {
    if (!param.nombre || typeof param.nombre !== 'string') {
      errors.push(`Parámetro ${index + 1}: nombre es requerido`);
    }
    if (param.cantidad === undefined || typeof param.cantidad !== 'number' || param.cantidad < 0) {
      errors.push(`Parámetro ${index + 1}: cantidad debe ser un número positivo`);
    }
  });

  return { valid: errors.length === 0, errors };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const usuarioId = searchParams.get('usuarioId');

    let queryText = `
    SELECT 
      p.id,
      p.nombre,
      p.precio,
      p.foto,
      p.tiene_parametros,
      p.porcentaje_ganancia as "porcentajeGanancia",
      up.cantidad,
      COALESCE(
        json_agg(
          json_build_object(
            'nombre', upp.nombre,
            'cantidad', upp.cantidad
          )
        ) FILTER (WHERE upp.id IS NOT NULL),
        '[]'::json
      ) as parametros
    FROM productos p
    JOIN usuario_productos up ON p.id = up.producto_id
    LEFT JOIN usuario_producto_parametros upp ON p.id = upp.producto_id AND upp.usuario_id = up.usuario_id
    WHERE 1=1
    `;

    const queryParams: any[] = [];

    if (usuarioId) {
      queryText += ` AND up.usuario_id = $${queryParams.length + 1}`;
      queryParams.push(Number(usuarioId));
    } else {
      // Fallback for legacy behavior or specific restricted view needed? 
      // For now, let's allow viewing all non-kitchen if no ID (or handle as error if safer)
      // But the previous code was `WHERE up.cocina IS NOT TRUE` which is vague.
      // Let's keep the filter `up.cocina IS NOT TRUE` as a fallback if no user specified, 
      // to avoid breaking existing generic calls if any.
      queryText += ` AND (up.cocina IS NOT TRUE OR up.cocina IS NULL)`;
    }

    queryText += `
    GROUP BY p.id, p.nombre, p.precio, p.foto, p.tiene_parametros, p.porcentaje_ganancia, up.cantidad
    ORDER BY p.nombre
    `;

    const result = await query(queryText, queryParams);

    if (!result.rows || result.rows.length === 0) {
      // Return empty array instead of 404/message to be cleaner for frontend
      return NextResponse.json([]);
    }

    const productosFormateados = result.rows.map(producto => ({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      foto: producto.foto,
      tieneParametros: producto.tiene_parametros,
      porcentajeGanancia: producto.porcentajeGanancia || 0,
      cantidad: producto.cantidad,
      parametros: producto.parametros
    }));

    return NextResponse.json(productosFormateados);

  } catch (error) {
    return handleDatabaseError(error);
  }
}

// Validación para el POST (consulta paginada)
function validatePostRequest(body: any): {
  usuarioId: number;
  limite: number;
  offset: number;
  errors: string[]
} {
  const errors: string[] = [];

  const usuarioId = body?.usuarioId;
  if (!usuarioId || typeof usuarioId !== 'number' || usuarioId <= 0) {
    errors.push('ID de usuario requerido y debe ser un número positivo');
  }

  let limite = body?.limite || 50;
  if (typeof limite !== 'number' || limite <= 0) {
    limite = 50;
  }
  if (limite > 100) {
    errors.push('El límite máximo es 100 productos');
  }

  let offset = body?.offset || 0;
  if (typeof offset !== 'number' || offset < 0) {
    offset = 0;
  }

  return { usuarioId, limite, offset, errors };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { usuarioId, limite, offset, errors } = validatePostRequest(body);

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: errors },
        { status: 400 }
      );
    }

    const result = await query(`
    SELECT 
      p.id,
      p.nombre,
      p.precio,
      p.foto,
      p.tiene_parametros,
      p.porcentaje_ganancia as "porcentajeGanancia",
      up.cantidad,
      up.fecha_agregado,
      COALESCE(
        json_agg(
          json_build_object(
            'nombre', upp.nombre,
            'cantidad', upp.cantidad
          )
        ) FILTER (WHERE upp.id IS NOT NULL),
        '[]'::json
      ) as parametros
    FROM productos p
    JOIN usuario_productos up ON p.id = up.producto_id
    LEFT JOIN usuario_producto_parametros upp ON p.id = upp.producto_id
    WHERE up.usuario_id = $1 AND up.cocina IS NOT TRUE
    GROUP BY p.id, p.nombre, p.precio, p.foto, p.tiene_parametros, 
             p.porcentaje_ganancia, up.cantidad, up.fecha_agregado
    ORDER BY up.fecha_agregado DESC
    LIMIT $2 OFFSET $3
  `, [usuarioId, limite, offset]);

    const countResult = await query(`
    SELECT COUNT(DISTINCT p.id) as total
    FROM productos p
    JOIN usuario_productos up ON p.id = up.producto_id
    WHERE up.usuario_id = $1 AND up.cocina IS NOT TRUE
  `, [usuarioId]);

    const total = parseInt(countResult.rows[0]?.total || '0');
    const hasMore = offset + limite < total;

    const productosFormateados = result.rows.map(producto => ({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      foto: producto.foto,
      tieneParametros: producto.tiene_parametros,
      porcentajeGanancia: producto.porcentajeGanancia || 0,
      cantidad: producto.cantidad,
      fechaAgregado: producto.fecha_agregado,
      parametros: producto.parametros
    }));

    return NextResponse.json({
      productos: productosFormateados,
      paginacion: {
        total,
        limite,
        offset,
        hasMore,
        totalPaginas: Math.ceil(total / limite),
        paginaActual: Math.floor(offset / limite) + 1
      }
    });

  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Formato JSON inválido' },
        { status: 400 }
      );
    }

    return handleDatabaseError(error);
  }
}

// NUEVO: Agregar producto a usuario con parámetros
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { usuarioId, productoId, cantidad, parametros } = body;

    // Validaciones básicas
    const errors: string[] = [];

    if (!usuarioId || typeof usuarioId !== 'number' || usuarioId <= 0) {
      errors.push('ID de usuario requerido y debe ser un número positivo');
    }

    if (!productoId || typeof productoId !== 'number' || productoId <= 0) {
      errors.push('ID de producto requerido y debe ser un número positivo');
    }

    if (cantidad === undefined || typeof cantidad !== 'number' || cantidad < 0) {
      errors.push('Cantidad debe ser un número positivo');
    }

    // Validar parámetros si existen
    if (parametros && parametros.length > 0) {
      const { valid, errors: paramErrors } = validateParametros(parametros);
      if (!valid) {
        errors.push(...paramErrors);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: errors },
        { status: 400 }
      );
    }

    await query('BEGIN');

    try {
      // Verificar si el producto existe
      const productoExiste = await query(
        'SELECT id, tiene_parametros FROM productos WHERE id = $1',
        [productoId]
      );

      if (productoExiste.rows.length === 0) {
        await query('ROLLBACK');
        return NextResponse.json(
          { error: 'Producto no encontrado' },
          { status: 404 }
        );
      }

      const tieneParametros = productoExiste.rows[0].tiene_parametros;

      // Verificar si ya existe la relación usuario-producto
      const relacionExiste = await query(
        'SELECT id FROM usuario_productos WHERE usuario_id = $1 AND producto_id = $2',
        [usuarioId, productoId]
      );

      if (tieneParametros) {
        // Para productos CON parámetros: NO actualizar cantidad directamente
        if (relacionExiste.rows.length === 0) {
          // Solo crear la relación - el trigger calculará la cantidad
          await query(
            'INSERT INTO usuario_productos (usuario_id, producto_id, cantidad, cocina) VALUES ($1, $2, $3, $4)',
            [usuarioId, productoId, 0, false] // Cantidad inicial 0, cocina false por defecto
          );
        }
        // Si ya existe la relación, no hacer nada aquí - el trigger se encargará
      } else {
        // Para productos SIN parámetros: SÍ actualizar cantidad directamente
        if (relacionExiste.rows.length > 0) {
          await query(
            'UPDATE usuario_productos SET cantidad = $1 WHERE usuario_id = $2 AND producto_id = $3',
            [cantidad, usuarioId, productoId]
          );
        } else {
          await query(
            'INSERT INTO usuario_productos (usuario_id, producto_id, cantidad, cocina) VALUES ($1, $2, $3, $4)',
            [usuarioId, productoId, cantidad, false] // cocina false por defecto
          );
        }
      }

      // Manejar parámetros si el producto los tiene
      if (tieneParametros && parametros && parametros.length > 0) {
        // Eliminar parámetros existentes del usuario específico
        await query(
          'DELETE FROM usuario_producto_parametros WHERE producto_id = $1 AND usuario_id = $2',
          [productoId, usuarioId]
        );

        // Insertar nuevos parámetros
        for (const param of parametros) {
          await query(
            'INSERT INTO usuario_producto_parametros (producto_id, usuario_id, nombre, cantidad) VALUES ($1, $2, $3, $4)',
            [productoId, usuarioId, param.nombre, param.cantidad]
          );
        }
        // ✅ El trigger automáticamente calculará usuario_productos.cantidad
      }

      await query('COMMIT');

      // Obtener el producto actualizado con parámetros
      const productoActualizado = await query(`
      SELECT 
        p.id,
        p.nombre,
        p.precio,
        p.foto,
        p.tiene_parametros,
        p.porcentaje_ganancia as "porcentajeGanancia",
        up.cantidad,
        up.fecha_agregado,
        COALESCE(
          json_agg(
            json_build_object(
              'nombre', upp.nombre,
              'cantidad', upp.cantidad
            )
          ) FILTER (WHERE upp.id IS NOT NULL),
          '[]'::json
        ) as parametros
      FROM productos p
      JOIN usuario_productos up ON p.id = up.producto_id
      LEFT JOIN usuario_producto_parametros upp ON p.id = upp.producto_id
      WHERE up.usuario_id = $1 AND p.id = $2 AND up.cocina IS NOT TRUE
      GROUP BY p.id, p.nombre, p.precio, p.foto, p.tiene_parametros, 
               p.porcentaje_ganancia, up.cantidad, up.fecha_agregado
    `, [usuarioId, productoId]);

      return NextResponse.json({
        mensaje: 'Producto agregado/actualizado correctamente',
        producto: productoActualizado.rows[0]
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Formato JSON inválido' },
        { status: 400 }
      );
    }

    return handleDatabaseError(error);
  }
}

// NUEVO: Eliminar producto de usuario
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { usuarioId, productoId } = body;

    // Validaciones
    const errors: string[] = [];

    if (!usuarioId || typeof usuarioId !== 'number' || usuarioId <= 0) {
      errors.push('ID de usuario requerido y debe ser un número positivo');
    }

    if (!productoId || typeof productoId !== 'number' || productoId <= 0) {
      errors.push('ID de producto requerido y debe ser un número positivo');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: errors },
        { status: 400 }
      );
    }

    await query('BEGIN');

    try {
      // Eliminar parámetros del producto específico del usuario
      await query(
        'DELETE FROM usuario_producto_parametros WHERE producto_id = $1 AND usuario_id = $2',
        [productoId, usuarioId]
      );

      // Eliminar relación usuario-producto
      const deleteResult = await query(
        'DELETE FROM usuario_productos WHERE usuario_id = $1 AND producto_id = $2',
        [usuarioId, productoId]
      );

      if (deleteResult.rowCount === 0) {
        await query('ROLLBACK');
        return NextResponse.json(
          { error: 'Producto no encontrado en la lista del usuario' },
          { status: 404 }
        );
      }

      await query('COMMIT');

      return NextResponse.json({
        mensaje: 'Producto eliminado correctamente'
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Formato JSON inválido' },
        { status: 400 }
      );
    }

    return handleDatabaseError(error);
  }
}
