import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    const moderadorId = searchParams.get('moderadorId');
    const vendedorId = searchParams.get('vendedorId');

    // Si se pasa id directo por query param, devolver detalle completo
    if (idParam && !isNaN(Number(idParam))) {
      const headerResult = await query(
        `SELECT 
          i.id,
          i.moderador_id,
          u.nombre as moderador_nombre,
          i.vendedor_id,
          i.punto_venta_nombre,
          i.fecha,
          i.total_items_auditados,
          i.total_discrepancias,
          i.observaciones
        FROM inventarios_fisicos i
        LEFT JOIN usuarios u ON i.moderador_id = u.id
        WHERE i.id = $1`,
        [Number(idParam)]
      );

      if (headerResult.rows.length === 0) {
        return NextResponse.json({ error: 'Inventario no encontrado' }, { status: 404 });
      }

      const detailsResult = await query(
        `SELECT 
          id,
          inventario_id,
          producto_id,
          nombre_producto,
          codigo_barras,
          parametro_nombre,
          cantidad_sistema,
          cantidad_fisica,
          diferencia,
          precio_compra,
          precio_venta
        FROM inventario_fisico_detalles
        WHERE inventario_id = $1
        ORDER BY ABS(diferencia) DESC, nombre_producto ASC`,
        [Number(idParam)]
      );

      return NextResponse.json({
        ...headerResult.rows[0],
        detalles: detailsResult.rows
      });
    }

    let sql = `
      SELECT 
        i.id,
        i.moderador_id,
        u.nombre as moderador_nombre,
        i.vendedor_id,
        i.punto_venta_nombre,
        i.fecha,
        i.total_items_auditados,
        i.total_discrepancias,
        i.observaciones
      FROM inventarios_fisicos i
      LEFT JOIN usuarios u ON i.moderador_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (moderadorId) {
      params.push(Number(moderadorId));
      sql += ` AND i.moderador_id = $${params.length}`;
    }

    if (vendedorId) {
      params.push(Number(vendedorId));
      sql += ` AND i.vendedor_id = $${params.length}`;
    }

    sql += ` ORDER BY i.fecha DESC`;

    const result = await query(sql, params);
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error al listar inventarios:', error);
    return NextResponse.json(
      { error: 'Error al listar inventarios', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      moderadorId,
      vendedorId,
      puntoVentaNombre,
      detalles,
      observaciones
    } = body;

    if (!puntoVentaNombre || !Array.isArray(detalles) || detalles.length === 0) {
      return NextResponse.json(
        { error: 'Datos incompletos: se requiere punto de venta y al menos un producto auditado' },
        { status: 400 }
      );
    }

    await query('BEGIN');

    try {
      // 1. Calcular totales
      const totalItems = detalles.length;
      const totalDiscrepancias = detalles.filter((d: any) => Number(d.diferencia) !== 0).length;

      // 2. Insertar cabecera
      const headerResult = await query(
        `INSERT INTO inventarios_fisicos 
          (moderador_id, vendedor_id, punto_venta_nombre, fecha, total_items_auditados, total_discrepancias, observaciones)
         VALUES ($1, $2, $3, NOW(), $4, $5, $6)
         RETURNING *`,
        [
          moderadorId ? Number(moderadorId) : null,
          vendedorId ? Number(vendedorId) : null,
          puntoVentaNombre,
          totalItems,
          totalDiscrepancias,
          observaciones || ''
        ]
      );

      const inventarioId = headerResult.rows[0].id;

      // 3. Insertar cada detalle
      for (const d of detalles) {
        await query(
          `INSERT INTO inventario_fisico_detalles
            (inventario_id, producto_id, nombre_producto, codigo_barras, parametro_nombre, cantidad_sistema, cantidad_fisica, diferencia, precio_compra, precio_venta)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            inventarioId,
            d.productoId ? Number(d.productoId) : null,
            d.nombreProducto || 'Sin nombre',
            d.codigoBarras || null,
            d.parametroNombre || null,
            Number(d.cantidadSistema || 0),
            Number(d.cantidadFisica || 0),
            Number(d.diferencia || 0),
            Number(d.precioCompra || 0),
            Number(d.precioVenta || 0)
          ]
        );
      }

      // 4. Registrar en bitácora si hay moderadorId
      if (moderadorId) {
        await query(
          `INSERT INTO bitacora_moderadores (moderador_id, accion, detalles, fecha)
           VALUES ($1, 'inventario_fisico', $2, NOW())`,
          [
            Number(moderadorId),
            `Realizó auditoría de inventario físico en "${puntoVentaNombre}": ${totalItems} productos revisados, ${totalDiscrepancias} incidencias/diferencias.`
          ]
        );
      }

      await query('COMMIT');

      return NextResponse.json({
        success: true,
        inventario: headerResult.rows[0],
        totalItems,
        totalDiscrepancias
      });

    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }

  } catch (error: any) {
    console.error('Error al registrar inventario físico:', error);
    return NextResponse.json(
      { error: 'Error al registrar inventario físico', details: error.message },
      { status: 500 }
    );
  }
}
