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
          SUM(g.cantidad * LEAST((${fechaFin}::date - ${fechaInicio}::date + 1), 30)::float / 30.0) as total_gastos,
          json_agg(
            json_build_object(
              'nombre', g.nombre,
              'valorMensual', g.cantidad,
              'diasSeleccionados', (${fechaFin}::date - ${fechaInicio}::date + 1),
              'valorProrrateado', (g.cantidad * LEAST((${fechaFin}::date - ${fechaInicio}::date + 1), 30)::float / 30.0),
              'fecha', g.fecha
            ) ORDER BY g.fecha DESC
          ) FILTER (WHERE g.nombre IS NOT NULL) as detalles_gastos
        FROM gastos g
        WHERE g.fecha >= ${fechaInicio}::date AND g.fecha <= ${fechaFin}::date
        GROUP BY g.vendedor_id::text
      ),
      salarios_vendedor AS (
        SELECT
          s.usuario_id::text as vendedor_id,
          SUM(s.salario) as total_salario
        FROM salarios s
        WHERE s.activo = true
        GROUP BY s.usuario_id::text
      ),
      merma_total AS (
        SELECT
          SUM(p.precio * m.cantidad) as total_merma,
          json_agg(
            json_build_object(
              'producto', p.nombre,
              'cantidad', m.cantidad,
              'precio', p.precio,
              'total', p.precio * m.cantidad,
              'fecha', m.fecha
            ) ORDER BY m.fecha DESC
          ) FILTER (WHERE p.nombre IS NOT NULL) as detalles_merma
        FROM merma m
        JOIN productos p ON m.producto_id = p.id
        WHERE m.fecha >= ${fechaInicio}::date AND m.fecha <= ${fechaFin}::date
      )
      SELECT
        u.id as vendedor_id,
        u.nombre as vendedor_nombre,
        COALESCE(vv.venta_total, 0) as venta_total,
        COALESCE(vv.ganancia_bruta, 0) as ganancia_bruta,
        COALESCE(gv.total_gastos, 0) as gastos,
        0 as gastos_merma,  -- Merma en 0 por vendedor
        COALESCE(sv.total_salario, 0) as salario,
        COALESCE(vv.detalles_ventas, '[]'::json) as detalles_ventas,
        COALESCE(gv.detalles_gastos, '[]'::json) as detalles_gastos,
        '[]'::json as detalles_merma  -- Vacío por vendedor
      FROM usuarios u
      LEFT JOIN ventas_vendedor vv ON u.id::text = vv.vendedor
      LEFT JOIN gastos_vendedor gv ON u.id::text = gv.vendedor_id
      LEFT JOIN salarios_vendedor sv ON u.id::text = sv.vendedor_id
      WHERE u.rol = 'Vendedor' AND u.activo = true
      ORDER BY u.nombre
    `;

    const queryTime = Date.now() - startTime;
    console.log(`✅ Query ejecutada en ${queryTime}ms, ${result.rows.length} vendedores procesados`);

    // Obtener merma total por separado
    const mermaResult = await sql`
      SELECT
        SUM(p.precio * m.cantidad) as total_merma,
        json_agg(
          json_build_object(
            'producto', p.nombre,
            'cantidad', m.cantidad,
            'precio', p.precio,
            'total', p.precio * m.cantidad,
            'fecha', m.fecha
          ) ORDER BY m.fecha DESC
        ) FILTER (WHERE p.nombre IS NOT NULL) as detalles_merma
      FROM merma m
      JOIN productos p ON m.producto_id = p.id
      WHERE m.fecha >= ${fechaInicio}::date AND m.fecha <= ${fechaFin}::date
    `;

    const totalMerma = parseFloat(mermaResult.rows[0]?.total_merma || 0);
    const detallesMerma = mermaResult.rows[0]?.detalles_merma || [];

    console.log('🔍 MERMA TOTAL:', totalMerma);
    console.log('🔍 DETALLES MERMA:', detallesMerma);

    // ✅ Formatear resultados
    const resultados = result.rows.map(row => {
      const gananciaBruta = parseFloat(row.ganancia_bruta) || 0;
      const gastos = parseFloat(row.gastos) || 0;
      const gastosMerma = parseFloat(row.gastos_merma) || 0;
      const salario = parseFloat(row.salario) || 0;

      // ✅ FÓRMULA CORRECTA: Ganancia Bruta - Gastos - Gastos Merma - Salario
      const resultado = gananciaBruta - gastos - gastosMerma - salario;

      return {
        vendedorId: row.vendedor_id.toString(),
        vendedorNombre: row.vendedor_nombre,
        ventaTotal: parseFloat(row.venta_total) || 0,
        gananciaBruta,
        gastos,
        gastosMerma,
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
            : [],
          mermaDesglosada: []  // Vacío por vendedor
        }
      };
    });

    // Agregar merma total al primer vendedor para que se muestre en el resumen
    if (resultados.length > 0 && totalMerma > 0) {
      resultados[0].gastosMerma = totalMerma;
      resultados[0].detalles.mermaDesglosada = detallesMerma.map((m: any) => ({
        producto: m.producto,
        cantidad: parseInt(m.cantidad) || 0,
        precio: parseFloat(m.precio) || 0,
        total: parseFloat(m.total) || 0,
        fecha: m.fecha
      }));
      // Recalcular resultado para el primer vendedor
      resultados[0].resultado = resultados[0].gananciaBruta - resultados[0].gastos - totalMerma - resultados[0].salario;
    }

    // Log final de resultados
    console.log('📦 RESULTADOS FINALES:');
    resultados.forEach(r => {
      console.log(`\nVendedor: ${r.vendedorNombre}`);
      console.log(`  - Venta Total: $${r.ventaTotal}`);
      console.log(`  - Ganancia Bruta: $${r.gananciaBruta}`);
      console.log(`  - Gastos: $${r.gastos}`);
      console.log(`  - Gastos Merma: $${r.gastosMerma}`);
      console.log(`  - Salario: $${r.salario}`);
      console.log(`  - Resultado: $${r.resultado}`);
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
