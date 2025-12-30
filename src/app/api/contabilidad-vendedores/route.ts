// /src/app/api/contabilidad-vendedores/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
  console.log('📥 Recibida petición de contabilidad');

  try {
    const { searchParams } = new URL(request.url);
    const fechaInicio = searchParams.get('fechaInicio');
    const fechaFin = searchParams.get('fechaFin');

    if (!fechaInicio || !fechaFin) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: fechaInicio, fechaFin' },
        { status: 400 }
      );
    }

    console.log(`📊 Calculando contabilidad del ${fechaInicio} al ${fechaFin}`);

    // ✅ UNA SOLA QUERY OPTIMIZADA con CTEs y conversión de tipos
    const startTime = Date.now();

    const result = await sql`
      WITH ventas_vendedor AS (
        SELECT 
          v.vendedor::text as vendedor,
          SUM(v.total) as venta_total,
          SUM(v.total - (COALESCE(p.precio_compra, 0) * v.cantidad)) as ganancia_bruta,
          json_agg(
            json_build_object(
              'producto', p.nombre,
              'cantidad', v.cantidad,
              'precioVenta', v.precio_unitario,
              'precioCompra', COALESCE(p.precio_compra, 0),
              'total', v.total,
              'gananciaProducto', v.total - (COALESCE(p.precio_compra, 0) * v.cantidad)
            ) ORDER BY v.fecha DESC
          ) FILTER (WHERE v.id IS NOT NULL) as detalles_ventas
        FROM ventas v
        JOIN productos p ON v.producto = p.id
        WHERE v.fecha >= ${fechaInicio}::date AND v.fecha <= ${fechaFin}::date
        GROUP BY v.vendedor::text
      ),
      gastos_vendedor AS (
        SELECT 
          g.vendedor_id::text as vendedor_id,
          SUM(g.cantidad) as total_gastos,
          json_agg(
            json_build_object(
              'nombre', g.nombre,
              'valorMensual', g.cantidad,
              'diasSeleccionados', 30,
              'valorProrrateado', g.cantidad,
              'fecha', g.fecha
            ) ORDER BY g.fecha DESC
          ) FILTER (WHERE g.nombre IS NOT NULL) as detalles_gastos
        FROM gastos g
        WHERE g.fecha >= ${fechaInicio}::date AND g.fecha <= ${fechaFin}::date
        GROUP BY g.vendedor_id::text
      )
      SELECT 
        u.id as vendedor_id,
        u.nombre as vendedor_nombre,
        COALESCE(vv.venta_total, 0) as venta_total,
        COALESCE(vv.ganancia_bruta, 0) as ganancia_bruta,
        COALESCE(gv.total_gastos, 0) as gastos,
        0 as salario,
        COALESCE(vv.detalles_ventas, '[]'::json) as detalles_ventas,
        COALESCE(gv.detalles_gastos, '[]'::json) as detalles_gastos
      FROM usuarios u
      LEFT JOIN ventas_vendedor vv ON u.id::text = vv.vendedor
      LEFT JOIN gastos_vendedor gv ON u.id::text = gv.vendedor_id
      WHERE u.rol = 'Vendedor' AND u.activo = true
      ORDER BY u.nombre
    `;

    const queryTime = Date.now() - startTime;
    console.log(`✅ Query ejecutada en ${queryTime}ms, ${result.rows.length} vendedores procesados`);

    // ✅ Formatear resultados
    const resultados = result.rows.map(row => {
      const gananciaBruta = parseFloat(row.ganancia_bruta) || 0;
      const gastos = parseFloat(row.gastos) || 0;
      const salario = parseFloat(row.salario) || 0;

      // ✅ FÓRMULA CORRECTA: Ganancia Bruta - Gastos - Salario
      const resultado = gananciaBruta - gastos - salario;

      return {
        vendedorId: row.vendedor_id.toString(),
        vendedorNombre: row.vendedor_nombre,
        ventaTotal: parseFloat(row.venta_total) || 0,
        gananciaBruta,
        gastos,
        salario,
        resultado,
        detalles: {
          ventas: Array.isArray(row.detalles_ventas) && row.detalles_ventas[0] !== null
            ? row.detalles_ventas.map((v: any) => ({
              producto: v.producto,
              cantidad: parseInt(v.cantidad) || 0,
              precioVenta: parseFloat(v.precioVenta) || 0,
              precioCompra: parseFloat(v.precioCompra) || 0,
              gananciaProducto: parseFloat(v.gananciaProducto) || 0
            }))
            : [],
          gastosDesglosados: Array.isArray(row.detalles_gastos) && row.detalles_gastos[0] !== null
            ? row.detalles_gastos.map((g: any) => ({
              nombre: g.nombre,
              valorMensual: parseFloat(g.valorMensual) || 0,
              diasSeleccionados: parseInt(g.diasSeleccionados) || 30,
              valorProrrateado: parseFloat(g.valorProrrateado) || 0
            }))
            : []
        }
      };
    });

    console.log(`📦 Enviando ${resultados.length} resultados al cliente`);

    return NextResponse.json(resultados, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener contabilidad de vendedores:', error);

    // ✅ Mejor manejo de errores
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

    if (errorMessage.includes('timeout')) {
      return NextResponse.json(
        {
          error: 'La consulta tardó demasiado tiempo. Intenta con un rango de fechas más pequeño.',
          details: errorMessage
        },
        { status: 504 }
      );
    }

    if (errorMessage.includes('connection')) {
      return NextResponse.json(
        {
          error: 'Error de conexión con la base de datos. Por favor, intenta nuevamente.',
          details: errorMessage
        },
        { status: 503 }
      );
    }

    if (errorMessage.includes('does not exist')) {
      return NextResponse.json(
        {
          error: 'Error en la estructura de la base de datos. Verifica las tablas.',
          details: errorMessage
        },
        { status: 500 }
      );
    }

    if (errorMessage.includes('operator does not exist')) {
      return NextResponse.json(
        {
          error: 'Error de tipos de datos en la base de datos.',
          details: errorMessage
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Error al obtener contabilidad de vendedores',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
