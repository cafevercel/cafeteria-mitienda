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

    // Extraer mes y año para consulta de salarios mensuales
    const inicioDate = new Date(fechaInicio);
    const mesInicio = inicioDate.getMonth() + 1;
    const anioInicio = inicioDate.getFullYear();

    // ✅ UNA SOLA QUERY OPTIMIZADA con CTEs y conversión de tipos
    const startTime = Date.now();
    const result = await sql`
      WITH date_range AS (
        SELECT generate_series(${fechaInicio}::date, ${fechaFin}::date, '1 day'::interval) as day
      ),
      period_factor AS (
        SELECT
          COALESCE(SUM(
            1.0 / EXTRACT(DAY FROM (date_trunc('MONTH', day) + interval '1 month - 1 day'))
          ), 0) as factor
        FROM date_range
      ),
      ventas_procesadas AS (
        SELECT
          v.id,
          v.vendedor::text as vendedor,
          v.total as venta_total,
          v.fecha,
          p.nombre as producto_nombre,
          v.cantidad,
          v.precio_unitario,
          COALESCE(v.precio_compra, 0) as precio_compra,
          (v.total - (COALESCE(v.precio_compra, 0) * v.cantidad)) as ganancia_producto,
          v.metodo_pago,
          CASE
            WHEN v.metodo_pago = 'transferencia' THEN
              CASE WHEN COALESCE(v.monto_efectivo, 0) > 0 THEN v.monto_efectivo ELSE 0 END
            WHEN v.metodo_pago = 'mixto' THEN
              CASE WHEN (COALESCE(v.monto_efectivo, 0) + COALESCE(v.monto_transferencia, 0)) > 0 THEN COALESCE(v.monto_efectivo, 0)
                   ELSE v.total END
            ELSE
              CASE WHEN (COALESCE(v.monto_efectivo, 0) + COALESCE(v.monto_transferencia, 0)) > 0 THEN COALESCE(v.monto_efectivo, 0)
                   ELSE v.total END
          END as venta_efectivo,
          CASE
            WHEN v.metodo_pago = 'transferencia' THEN
              CASE WHEN COALESCE(v.monto_transferencia, 0) > 0 THEN v.monto_transferencia ELSE v.total END
            WHEN v.metodo_pago = 'mixto' THEN
              CASE WHEN (COALESCE(v.monto_efectivo, 0) + COALESCE(v.monto_transferencia, 0)) > 0 THEN COALESCE(v.monto_transferencia, 0)
                   ELSE 0 END
            ELSE
              CASE WHEN (COALESCE(v.monto_efectivo, 0) + COALESCE(v.monto_transferencia, 0)) > 0 THEN COALESCE(v.monto_transferencia, 0)
                   ELSE 0 END
          END as venta_transferencia
        FROM ventas v
        JOIN productos p ON v.producto = p.id
        WHERE v.fecha::date >= ${fechaInicio}::date AND v.fecha::date <= ${fechaFin}::date
      ),
      ventas_vendedor AS (
        SELECT
          vp.vendedor,
          SUM(vp.venta_total) as venta_total,
          SUM(vp.venta_efectivo) as venta_efectivo,
          SUM(vp.venta_transferencia) as venta_transferencia,
          SUM(vp.ganancia_producto) as ganancia_bruta,
          SUM(
            CASE 
              WHEN vp.venta_total > 0 THEN (vp.venta_efectivo / vp.venta_total) * vp.ganancia_producto
              ELSE 0 
            END
          ) as ganancia_efectivo,
          SUM(
            CASE 
              WHEN vp.venta_total > 0 THEN (vp.venta_transferencia / vp.venta_total) * vp.ganancia_producto
              ELSE 0 
            END
          ) as ganancia_transferencia,
          json_agg(
            json_build_object(
              'producto', vp.producto_nombre,
              'cantidad', vp.cantidad,
              'precioVenta', vp.precio_unitario,
              'precioCompra', vp.precio_compra, 
              'total', vp.venta_total,
              'gananciaProducto', vp.ganancia_producto,
              'metodo_pago', COALESCE(vp.metodo_pago, 'efectivo'),
              'monto_efectivo', vp.venta_efectivo,
              'monto_transferencia', vp.venta_transferencia
            ) ORDER BY vp.fecha DESC
          ) FILTER (WHERE vp.id IS NOT NULL) as detalles_ventas
        FROM ventas_procesadas vp
        GROUP BY vp.vendedor
      ),
      gastos_vendedor AS (
        SELECT
          g.vendedor_id::text as vendedor_id,
          SUM(
            g.cantidad *
            (
                (LEAST((date_trunc('MONTH', g.fecha) + interval '1 month - 1 day')::date, ${fechaFin}::date) - 
                 GREATEST(date_trunc('MONTH', g.fecha)::date, ${fechaInicio}::date) + 1)::float
                /
                EXTRACT(DAY FROM (date_trunc('MONTH', g.fecha) + interval '1 month - 1 day'))
            )
          ) as total_gastos,
          SUM(
            CASE WHEN COALESCE(g.tipo_gasto, 'fijo') = 'fijo' THEN
              g.cantidad * ((LEAST((date_trunc('MONTH', g.fecha) + interval '1 month - 1 day')::date, ${fechaFin}::date) - GREATEST(date_trunc('MONTH', g.fecha)::date, ${fechaInicio}::date) + 1)::float / EXTRACT(DAY FROM (date_trunc('MONTH', g.fecha) + interval '1 month - 1 day')))
            ELSE 0 END
          ) as gastos_fijos,
          SUM(
            CASE WHEN COALESCE(g.tipo_gasto, 'fijo') = 'variable' THEN
              g.cantidad * ((LEAST((date_trunc('MONTH', g.fecha) + interval '1 month - 1 day')::date, ${fechaFin}::date) - GREATEST(date_trunc('MONTH', g.fecha)::date, ${fechaInicio}::date) + 1)::float / EXTRACT(DAY FROM (date_trunc('MONTH', g.fecha) + interval '1 month - 1 day')))
            ELSE 0 END
          ) as gastos_variables,
          json_agg(
            json_build_object(
              'nombre', g.nombre,
              'valorMensual', g.cantidad,
              'diasSeleccionados', (LEAST((date_trunc('MONTH', g.fecha) + interval '1 month - 1 day')::date, ${fechaFin}::date) - GREATEST(date_trunc('MONTH', g.fecha)::date, ${fechaInicio}::date) + 1),
              'valorProrrateado', (g.cantidad * ((LEAST((date_trunc('MONTH', g.fecha) + interval '1 month - 1 day')::date, ${fechaFin}::date) - GREATEST(date_trunc('MONTH', g.fecha)::date, ${fechaInicio}::date) + 1)::float / EXTRACT(DAY FROM (date_trunc('MONTH', g.fecha) + interval '1 month - 1 day')))),
              'tipo_gasto', COALESCE(g.tipo_gasto, 'fijo'),
              'fecha', g.fecha
            ) ORDER BY g.fecha DESC
          ) FILTER (WHERE g.nombre IS NOT NULL) as detalles_gastos
        FROM gastos g
        WHERE g.fecha::date >= ${fechaInicio}::date AND g.fecha::date <= ${fechaFin}::date
        GROUP BY g.vendedor_id::text
      ),
      salarios_vendedor AS (
        SELECT
          u.id::text as vendedor_id,
          COALESCE(
            (SELECT sm.salario * (SELECT factor FROM period_factor) FROM salarios_mensuales sm WHERE sm.usuario_id::text = u.id::text AND sm.mes = ${mesInicio} AND sm.anio = ${anioInicio} LIMIT 1),
            (SELECT s.salario * (SELECT factor FROM period_factor) FROM salarios s WHERE s.usuario_id::text = u.id::text AND s.activo = true LIMIT 1),
            0
          ) as total_salario
        FROM usuarios u
      ),
      merma_total AS (
        SELECT
          SUM(COALESCE(p.precio_compra, 0) * m.cantidad) as total_merma,
          json_agg(
            json_build_object(
              'producto', p.nombre,
              'cantidad', m.cantidad,
              'precio', COALESCE(p.precio_compra, 0),
              'total', COALESCE(p.precio_compra, 0) * m.cantidad,
              'fecha', m.fecha
            ) ORDER BY m.fecha DESC
          ) FILTER (WHERE p.nombre IS NOT NULL) as detalles_merma
        FROM merma m
        JOIN productos p ON m.producto_id = p.id
        WHERE m.fecha::date >= ${fechaInicio}::date AND m.fecha::date <= ${fechaFin}::date
      )
      SELECT
        u.id as vendedor_id,
        u.nombre as vendedor_nombre,
        COALESCE(vv.venta_total, 0) as venta_total,
        COALESCE(vv.venta_efectivo, 0) as venta_efectivo,
        COALESCE(vv.venta_transferencia, 0) as venta_transferencia,
        COALESCE(vv.ganancia_bruta, 0) as ganancia_bruta,
        COALESCE(vv.ganancia_efectivo, 0) as ganancia_efectivo,
        COALESCE(vv.ganancia_transferencia, 0) as ganancia_transferencia,
        COALESCE(gv.total_gastos, 0) as gastos,
        COALESCE(gv.gastos_fijos, 0) as gastos_fijos,
        COALESCE(gv.gastos_variables, 0) as gastos_variables,
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
        SUM(COALESCE(p.precio_compra, 0) * m.cantidad) as total_merma,
        json_agg(
          json_build_object(
            'producto', p.nombre,
            'cantidad', m.cantidad,
            'precio', COALESCE(p.precio_compra, 0),
            'total', COALESCE(p.precio_compra, 0) * m.cantidad,
            'fecha', m.fecha
          ) ORDER BY m.fecha DESC
        ) FILTER (WHERE p.nombre IS NOT NULL) as detalles_merma
      FROM merma m
      JOIN productos p ON m.producto_id = p.id
      WHERE m.fecha::date >= ${fechaInicio}::date AND m.fecha::date <= ${fechaFin}::date
    `;

    const totalMerma = parseFloat(mermaResult.rows[0]?.total_merma || 0);
    const detallesMerma = mermaResult.rows[0]?.detalles_merma || [];

    // ✅ Formatear resultados
    const resultados = result.rows.map(row => {
      const ventaTotal = parseFloat(row.venta_total) || 0;
      const ventaEfectivo = parseFloat(row.venta_efectivo) || 0;
      const ventaTransferencia = parseFloat(row.venta_transferencia) || 0;
      const gananciaBruta = parseFloat(row.ganancia_bruta) || 0;
      const gananciaEfectivo = parseFloat(row.ganancia_efectivo) || 0;
      const gananciaTransferencia = parseFloat(row.ganancia_transferencia) || 0;
      const gastos = parseFloat(row.gastos) || 0;
      const gastosFijos = parseFloat(row.gastos_fijos) || 0;
      const gastosVariables = parseFloat(row.gastos_variables) || 0;
      const gastosMerma = parseFloat(row.gastos_merma) || 0;
      const salario = parseFloat(row.salario) || 0;

      const utilidadFinal = gananciaBruta - gastos - gastosMerma - salario;
      const margenBrutoPct = ventaTotal > 0 ? (gananciaBruta / ventaTotal) * 100 : 0;
      const margenNetoPct = ventaTotal > 0 ? (utilidadFinal / ventaTotal) * 100 : 0;

      return {
        vendedorId: row.vendedor_id.toString(),
        vendedorNombre: row.vendedor_nombre,
        ventaTotal,
        ventaEfectivo,
        ventaTransferencia,
        gananciaBruta,
        gananciaEfectivo,
        gananciaTransferencia,
        gastos,
        gastosFijos,
        gastosVariables,
        gastosMerma,
        salario,
        resultado: utilidadFinal,
        utilidadFinal,
        margenBrutoPct,
        margenNetoPct,
        detalles: {
          ventas: Array.isArray(row.detalles_ventas) && row.detalles_ventas[0] !== null
            ? row.detalles_ventas.map((v: any) => ({
              producto: v.producto,
              cantidad: parseInt(v.cantidad) || 0,
              precioVenta: parseFloat(v.precioVenta) || 0,
              precioCompra: parseFloat(v.precioCompra) || 0,
              gananciaProducto: parseFloat(v.gananciaProducto) || 0,
              metodo_pago: v.metodo_pago || 'efectivo',
              monto_efectivo: parseFloat(v.monto_efectivo) || 0,
              monto_transferencia: parseFloat(v.monto_transferencia) || 0
            }))
            : [],
          gastosDesglosados: Array.isArray(row.detalles_gastos) && row.detalles_gastos[0] !== null
            ? row.detalles_gastos.map((g: any) => ({
              nombre: g.nombre,
              valorMensual: parseFloat(g.valorMensual) || 0,
              diasSeleccionados: parseInt(g.diasSeleccionados) || 30,
              valorProrrateado: parseFloat(g.valorProrrateado) || 0,
              tipo_gasto: g.tipo_gasto || 'fijo'
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
