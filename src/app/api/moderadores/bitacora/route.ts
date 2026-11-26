import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const moderadorId = searchParams.get('moderadorId');

    if (!moderadorId) {
      return NextResponse.json({ error: 'ID de moderador requerido' }, { status: 400 });
    }

    // Consulta para obtener todos los registros del moderador ordenados cronológicamente
    const result = await query(
      `SELECT id, moderador_id, accion, detalles, fecha 
       FROM bitacora_moderadores 
       WHERE moderador_id = $1 
       ORDER BY fecha DESC`,
      [moderadorId]
    );

    // Obtener catálogo de productos con precio de compra para calcular resúmenes de entregas
    const productosResult = await query(
      `SELECT LOWER(TRIM(nombre)) as nombre_norm, precio_compra FROM productos`
    );
    const priceMap = new Map<string, number>();
    for (const p of productosResult.rows) {
      if (p.nombre_norm && p.precio_compra != null) {
        priceMap.set(p.nombre_norm, Number(p.precio_compra) || 0);
      }
    }

    const enrichedLogs = result.rows.map(row => {
      const isEntrega = row.accion === 'entregar_producto' || (row.detalles && row.detalles.toLowerCase().startsWith('entregó'));
      if (isEntrega && row.detalles) {
        const text = row.detalles;
        const multiMatch = text.match(/^(?:Entregó\s+)?(\d+)\s+unidades\s+totales\s*\((.+?)\)(?:\s+al\s+punto\s+de\s+venta|\s*$)/i);
        const singleMatch = text.match(/^(?:Entregó\s+)?(\d+)\s+unidades\s+de\s+["']([^"']+)["']/i);
        const fallbackMatch = text.match(/^(?:Entregó\s+)?(\d+)\s+unidades\s+totales/i);

        let items: Array<{ nombre: string; cantidad: number; precio_compra: number; subtotal: number }> = [];
        let totalUnidades = 0;
        let totalMonto = 0;

        if (multiMatch) {
          totalUnidades = parseInt(multiMatch[1], 10) || 0;
          const inner = multiMatch[2];
          const itemRegex = /["']([^"']+)["']\s*:\s*(\d+)/g;
          let m;
          while ((m = itemRegex.exec(inner)) !== null) {
            const rawName = m[1].trim();
            const qty = parseInt(m[2], 10) || 0;
            const unitPrice = priceMap.get(rawName.toLowerCase()) || 0;
            const subtotal = unitPrice * qty;
            items.push({
              nombre: rawName,
              cantidad: qty,
              precio_compra: unitPrice,
              subtotal
            });
            totalMonto += subtotal;
          }
          if (items.length > 0) {
            totalUnidades = items.reduce((sum, it) => sum + it.cantidad, 0);
          }
        } else if (singleMatch) {
          const qty = parseInt(singleMatch[1], 10) || 0;
          const rawName = singleMatch[2].trim();
          const unitPrice = priceMap.get(rawName.toLowerCase()) || 0;
          const subtotal = unitPrice * qty;
          totalUnidades = qty;
          totalMonto = subtotal;
          items.push({
            nombre: rawName,
            cantidad: qty,
            precio_compra: unitPrice,
            subtotal
          });
        } else if (fallbackMatch) {
          totalUnidades = parseInt(fallbackMatch[1], 10) || 0;
        }

        return {
          ...row,
          resumen_entrega: {
            total_unidades: totalUnidades,
            total_monto: totalMonto,
            items
          }
        };
      }
      return row;
    });

    return NextResponse.json(enrichedLogs);
  } catch (error) {
    console.error('Error al obtener bitácora de moderador:', error);
    return NextResponse.json({ error: 'Error al obtener bitácora' }, { status: 500 });
  }
}
