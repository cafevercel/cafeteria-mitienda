import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const vendedorId = searchParams.get('vendedorId');
    const banco = searchParams.get('banco')?.trim();
    const fechaInicio = searchParams.get('fechaInicio');
    const fechaFin = searchParams.get('fechaFin');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(
        rt.cliente_nombre ILIKE $${paramIndex} OR 
        rt.cliente_telefono ILIKE $${paramIndex} OR 
        COALESCE(rt.cliente_carnet, '') ILIKE $${paramIndex} OR 
        rt.numero_transaccion ILIKE $${paramIndex} OR 
        rt.banco ILIKE $${paramIndex} OR 
        COALESCE(rt.cuenta_nombre, '') ILIKE $${paramIndex} OR 
        COALESCE(rt.cuenta_numero, '') ILIKE $${paramIndex} OR 
        COALESCE(u.nombre, rt.vendedor_nombre, '') ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (vendedorId && vendedorId !== 'todos') {
      conditions.push(`rt.vendedor_id = $${paramIndex}`);
      params.push(parseInt(vendedorId, 10));
      paramIndex++;
    }

    if (banco && banco !== 'todos') {
      conditions.push(`rt.banco ILIKE $${paramIndex}`);
      params.push(banco);
      paramIndex++;
    }

    if (fechaInicio) {
      conditions.push(`rt.fecha >= $${paramIndex}::timestamp`);
      params.push(fechaInicio + ' 00:00:00');
      paramIndex++;
    }

    if (fechaFin) {
      conditions.push(`rt.fecha <= $${paramIndex}::timestamp`);
      params.push(fechaFin + ' 23:59:59');
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Consulta para obtener los registros
    const dataQuery = `
      SELECT 
        rt.id,
        rt.vendedor_id,
        COALESCE(u.nombre, rt.vendedor_nombre, 'Punto de Venta') as vendedor_nombre,
        rt.cliente_nombre,
        rt.cliente_telefono,
        rt.cliente_carnet,
        rt.numero_transaccion,
        rt.banco,
        rt.cuenta_banco_id,
        rt.cuenta_nombre,
        rt.cuenta_numero,
        rt.monto,
        rt.fecha,
        rt.detalles,
        rt.creado_en
      FROM registro_transferencias rt
      LEFT JOIN usuarios u ON rt.vendedor_id = u.id
      ${whereClause}
      ORDER BY rt.fecha DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataParams = [...params, limit, offset];
    const dataResult = await query(dataQuery, dataParams);

    // Consulta de agregados (totales)
    const summaryQuery = `
      SELECT 
        COUNT(rt.id) as total_count,
        COALESCE(SUM(rt.monto), 0) as total_monto
      FROM registro_transferencias rt
      LEFT JOIN usuarios u ON rt.vendedor_id = u.id
      ${whereClause}
    `;

    const summaryResult = await query(summaryQuery, params);
    const totalCount = parseInt(summaryResult.rows[0]?.total_count || '0', 10);
    const totalMonto = parseFloat(summaryResult.rows[0]?.total_monto || '0');

    return NextResponse.json({
      transferencias: dataResult.rows,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1
      },
      summary: {
        totalRegistros: totalCount,
        totalMonto
      }
    });

  } catch (error: any) {
    console.error('Error fetching registro_transferencias:', error);
    // Si la tabla no existe aún, devolvemos array vacío para evitar romper la UI antes de la migración
    if (error.code === '42P01') {
      return NextResponse.json({
        transferencias: [],
        pagination: { total: 0, page: 1, limit: 50, totalPages: 1 },
        summary: { totalRegistros: 0, totalMonto: 0 },
        tableNotCreated: true
      });
    }
    return NextResponse.json({ error: 'Error al obtener registros de transferencias' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items = Array.isArray(body) ? body : [body];

    if (items.length === 0) {
      return NextResponse.json({ error: 'No se recibieron datos' }, { status: 400 });
    }

    const inserted: any[] = [];

    for (const item of items) {
      const {
        vendedorId,
        vendedorNombre,
        clienteNombre,
        clienteTelefono,
        clienteCarnet,
        numeroTransaccion,
        banco,
        cuentaBancoId,
        cuentaNombre,
        cuentaNumero,
        monto,
        fecha,
        detalles
      } = item;

      if (!clienteNombre || !numeroTransaccion || !banco) {
        continue;
      }

      const fechaFinal = fecha ? new Date(fecha) : new Date();
      const detallesJson = typeof detalles === 'string' ? detalles : JSON.stringify(detalles || []);

      // Evitar duplicados por mismo numero_transaccion y mismo vendedor
      const existing = await query(
        'SELECT id FROM registro_transferencias WHERE numero_transaccion = $1 AND vendedor_id = $2 LIMIT 1',
        [numeroTransaccion, vendedorId ? parseInt(vendedorId, 10) : null]
      );

      if (existing.rows.length > 0) {
        inserted.push({ id: existing.rows[0].id, numeroTransaccion, status: 'already_exists' });
        continue;
      }

      const result = await query(
        `INSERT INTO registro_transferencias 
         (vendedor_id, vendedor_nombre, cliente_nombre, cliente_telefono, cliente_carnet, numero_transaccion, banco, cuenta_banco_id, cuenta_nombre, cuenta_numero, monto, fecha, detalles) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
         RETURNING id, numero_transaccion`,
        [
          vendedorId ? parseInt(vendedorId, 10) : null,
          vendedorNombre || null,
          clienteNombre,
          clienteTelefono || '',
          clienteCarnet || null,
          numeroTransaccion,
          banco,
          cuentaBancoId ? parseInt(cuentaBancoId, 10) : null,
          cuentaNombre || null,
          cuentaNumero || null,
          parseFloat(monto) || 0,
          fechaFinal,
          detallesJson
        ]
      );

      if (result.rows.length > 0) {
        inserted.push({ id: result.rows[0].id, numeroTransaccion: result.rows[0].numero_transaccion, status: 'inserted' });
      }
    }

    return NextResponse.json({ success: true, inserted });
  } catch (error: any) {
    console.error('Error insertando registro_transferencia:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
