// app/api/ventas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { productoId, cantidad, fecha, parametros, vendedorId } = body;

  if (!productoId || !cantidad || !fecha || !vendedorId) {
    return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
  }

  try {
    const fechaVenta = new Date(fecha);
    await query('BEGIN');

    // Verificar si el producto tiene parámetros
    const productoResult = await query(
      `SELECT p.precio, p.tiene_parametros, up.cantidad as stock_disponible 
       FROM productos p 
       JOIN usuario_productos up ON p.id = up.producto_id 
       WHERE p.id = $1`,
      [productoId]
    );

    if (productoResult.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Producto no encontrado en el inventario' }, { status: 404 });
    }

    const { precio: precioUnitario, stock_disponible, tiene_parametros } = productoResult.rows[0];

    // Verificar stock según si tiene parámetros o no
    if (tiene_parametros && parametros) {
      for (const param of parametros) {
        const stockParam = await query(
          `SELECT cantidad FROM usuario_producto_parametros 
           WHERE producto_id = $1 AND nombre = $2`,
          [productoId, param.nombre]
        );

        if (!stockParam.rows.length || stockParam.rows[0].cantidad < param.cantidad) {
          await query('ROLLBACK');
          return NextResponse.json({ 
            error: `Stock insuficiente para el parámetro ${param.nombre}` 
          }, { status: 400 });
        }
      }
    } else if (!tiene_parametros && stock_disponible < cantidad) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Stock insuficiente' }, { status: 400 });
    }

    // Crear venta
    const ventaResult = await query(
      `INSERT INTO ventas (producto, cantidad, precio_unitario, total, vendedor, fecha) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        productoId, 
        cantidad, 
        precioUnitario, 
        precioUnitario * cantidad, 
        vendedorId, 
        fechaVenta
      ]
    );

    // Si hay parámetros, insertarlos en la tabla venta_parametros
    if (tiene_parametros && parametros) {
      for (const param of parametros) {
        // Insertar parámetros de la venta
        await query(
          `INSERT INTO venta_parametros (venta_id, parametro, cantidad)
           VALUES ($1, $2, $3)`,
          [ventaResult.rows[0].id, param.nombre, param.cantidad]
        );

        // Actualizar stock de parámetros
        await query(
          `UPDATE usuario_producto_parametros 
           SET cantidad = cantidad - $1 
           WHERE producto_id = $2 AND nombre = $3`,
          [param.cantidad, productoId, param.nombre]
        );
      }
    } else {
      // Actualizar stock normal
      await query(
        'UPDATE usuario_productos SET cantidad = cantidad - $1 WHERE producto_id = $2',
        [cantidad, productoId]
      );
    }

    await query('COMMIT');
    return NextResponse.json(ventaResult.rows[0]);
  } catch (error) {
    await query('ROLLBACK');
    console.error('Error al crear venta:', error);
    return NextResponse.json({ error: 'Error al crear venta' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const vendedorId = searchParams.get('vendedorId');
  const productoId = searchParams.get('productoId');
  const ventaId = searchParams.get('id');
  const getAllVentas = searchParams.get('all') === 'true';

  try {
    let result;
    
    if (ventaId) {
      // Obtener venta con sus parámetros
      result = await query(
        `SELECT v.*, p.nombre as producto_nombre, p.foto as producto_foto, 
                v.precio_unitario,
                json_agg(json_build_object(
                  'nombre', vp.parametro,
                  'cantidad', vp.cantidad
                )) FILTER (WHERE vp.parametro IS NOT NULL) as parametros
         FROM ventas v
         JOIN productos p ON v.producto = p.id
         LEFT JOIN venta_parametros vp ON v.id = vp.venta_id
         WHERE v.id = $1
         GROUP BY v.id, p.nombre, p.foto`,
        [ventaId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
      }

      return NextResponse.json(result.rows[0]);
    }
    
    // Consultas para listar ventas
    const baseQuery = `
      SELECT v.*, p.nombre as producto_nombre, p.foto as producto_foto, 
             v.precio_unitario,
             u.nombre as vendedor_nombre,
             json_agg(json_build_object(
               'nombre', vp.parametro,
               'cantidad', vp.cantidad
             )) FILTER (WHERE vp.parametro IS NOT NULL) as parametros
      FROM ventas v
      JOIN productos p ON v.producto = p.id
      JOIN usuarios u ON v.vendedor = u.id
      LEFT JOIN venta_parametros vp ON v.id = vp.venta_id
    `;

    if (productoId) {
      const vendedorFilter = vendedorId ? 'AND v.vendedor = $2' : '';
      const params = vendedorId ? [productoId, vendedorId] : [productoId];
      
      result = await query(
        `${baseQuery}
         WHERE v.producto = $1 ${vendedorFilter}
         GROUP BY v.id, p.nombre, p.foto, u.nombre
         ORDER BY v.fecha DESC`,
        params
      );
    } else if (vendedorId) {
      result = await query(
        `${baseQuery}
         WHERE v.vendedor = $1
         GROUP BY v.id, p.nombre, p.foto, u.nombre
         ORDER BY v.fecha DESC`,
        [vendedorId]
      );
    } else if (getAllVentas) {
      // Si se solicitan todas las ventas
      result = await query(
        `${baseQuery}
         GROUP BY v.id, p.nombre, p.foto, u.nombre
         ORDER BY v.fecha DESC`
      );
    } else {
      return NextResponse.json({ error: 'Se requiere vendedorId, productoId, id o all=true' }, { status: 400 });
    }

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error al obtener ventas:', error);
    return NextResponse.json({ error: 'Error al obtener ventas' }, { status: 500 });
  }
}
