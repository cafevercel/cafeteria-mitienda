import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const rawParams = context?.params ? await Promise.resolve(context.params) : null;
    let inventarioId = rawParams?.id;
    if (!inventarioId || isNaN(Number(inventarioId))) {
      const parts = request.nextUrl.pathname.split('/').filter(Boolean);
      inventarioId = parts[parts.length - 1];
    }

    if (!inventarioId || isNaN(Number(inventarioId))) {
      return NextResponse.json({ error: 'ID de inventario inválido o no proporcionado' }, { status: 400 });
    }

    // 1. Obtener cabecera
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
      [Number(inventarioId)]
    );

    if (headerResult.rows.length === 0) {
      return NextResponse.json({ error: 'Inventario no encontrado' }, { status: 404 });
    }

    // 2. Obtener detalles
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
      [Number(inventarioId)]
    );

    return NextResponse.json({
      ...headerResult.rows[0],
      detalles: detailsResult.rows
    });

  } catch (error: any) {
    console.error('Error al obtener detalle de inventario:', error);
    return NextResponse.json(
      { error: 'Error al obtener detalle de inventario', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const rawParams = context?.params ? await Promise.resolve(context.params) : null;
    let inventarioId = rawParams?.id;
    if (!inventarioId || isNaN(Number(inventarioId))) {
      const parts = request.nextUrl.pathname.split('/').filter(Boolean);
      inventarioId = parts[parts.length - 1];
    }

    if (!inventarioId || isNaN(Number(inventarioId))) {
      return NextResponse.json({ error: 'ID de inventario inválido o no requerido' }, { status: 400 });
    }

    await query('DELETE FROM inventarios_fisicos WHERE id = $1', [Number(inventarioId)]);

    return NextResponse.json({ success: true, message: 'Inventario eliminado correctamente' });
  } catch (error: any) {
    console.error('Error al eliminar inventario:', error);
    return NextResponse.json(
      { error: 'Error al eliminar inventario', details: error.message },
      { status: 500 }
    );
  }
}
