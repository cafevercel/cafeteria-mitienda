import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function handleExportInventario(
  request: NextRequest,
  context?: { params?: { id?: string } | Promise<{ id?: string }> }
) {
  try {
    const rawParams = context?.params ? await Promise.resolve(context.params) : null;
    let inventarioId = rawParams?.id;

    if (!inventarioId || isNaN(Number(inventarioId))) {
      inventarioId = request.nextUrl.searchParams.get('id') || undefined;
    }

    if (!inventarioId || isNaN(Number(inventarioId))) {
      const parts = request.nextUrl.pathname.split('/').filter(Boolean);
      const exportIdx = parts.indexOf('export');
      if (exportIdx > 0) {
        inventarioId = parts[exportIdx - 1];
      } else {
        inventarioId = parts[parts.length - 1];
      }
    }

    if (!inventarioId || isNaN(Number(inventarioId))) {
      return NextResponse.json(
        { error: 'ID de inventario inválido o no proporcionado' },
        { status: 400 }
      );
    }

    // 1. Obtener cabecera del inventario físico
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

    const header = headerResult.rows[0];

    // 2. Obtener detalles del inventario
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

    const detalles = detailsResult.rows;

    let fechaFormateada = 'N/A';
    if (header.fecha) {
      try {
        const d = new Date(header.fecha);
        fechaFormateada = !isNaN(d.getTime()) ? d.toLocaleString('es-ES') : String(header.fecha);
      } catch {
        fechaFormateada = String(header.fecha);
      }
    }

    // 3. Estructurar filas para Excel (Encabezados informativos + Tabla de datos)
    const aoaData: any[][] = [
      ['REPORTE DE AUDITORÍA DE INVENTARIO FÍSICO'],
      [],
      ['Punto de Venta:', header.punto_venta_nombre || 'N/A'],
      ['Fecha de Auditoría:', fechaFormateada],
      ['Moderador:', header.moderador_nombre || 'No asignado'],
      ['Total Ítems Auditados:', Number(header.total_items_auditados ?? detalles.length)],
      ['Total Discrepancias:', Number(header.total_discrepancias ?? 0)],
      ['Observaciones:', header.observaciones || 'Sin observaciones'],
      [],
      [
        'N°',
        'Nombre del Producto',
        'Código de Barras',
        'Variante / Parámetro',
        'Cantidad en Sistema',
        'Cantidad Física (Conteo)',
        'Diferencia',
        'Estado',
        'Precio Compra',
        'Precio Venta'
      ]
    ];

    detalles.forEach((d: any, index: number) => {
      const cantSis = Number(d.cantidad_sistema || 0);
      const cantFis = Number(d.cantidad_fisica || 0);
      const dif = Number(d.diferencia !== undefined && d.diferencia !== null ? d.diferencia : cantFis - cantSis);

      let estado = 'Exacto';
      if (dif > 0) {
        estado = 'Sobrante';
      } else if (dif < 0) {
        estado = 'Faltante';
      }

      aoaData.push([
        index + 1,
        d.nombre_producto || 'Sin nombre',
        d.codigo_barras || 'N/A',
        d.parametro_nombre || '-',
        cantSis,
        cantFis,
        dif,
        estado,
        Number(d.precio_compra || 0),
        Number(d.precio_venta || 0)
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(aoaData);

    worksheet['!cols'] = [
      { wch: 6 },  // N°
      { wch: 36 }, // Nombre del Producto
      { wch: 20 }, // Código de Barras
      { wch: 22 }, // Variante / Parámetro
      { wch: 20 }, // Cantidad en Sistema
      { wch: 24 }, // Cantidad Física (Conteo)
      { wch: 14 }, // Diferencia
      { wch: 16 }, // Estado
      { wch: 15 }, // Precio Compra
      { wch: 15 }  // Precio Venta
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Auditoria_Inventario');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    const fechaStr = header.fecha
      ? new Date(header.fecha).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const safePunto = (header.punto_venta_nombre || 'Punto')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    const filename = `Inventario_${safePunto}_${fechaStr}.xlsx`;

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });

  } catch (error: any) {
    console.error('Error al exportar inventario a Excel:', error);
    return NextResponse.json(
      { error: 'Error al exportar inventario a Excel', details: error.message },
      { status: 500 }
    );
  }
}
