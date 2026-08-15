import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vendedorId = searchParams.get('vendedorId');
    const mes = searchParams.get('mes');
    const anio = searchParams.get('anio');

    if (!anio) {
      return NextResponse.json({ error: 'Falta parámetro anio' }, { status: 400 });
    }

    if (vendedorId) {
      const result = await query(
        `SELECT sm.*, u.nombre as vendedor_nombre 
         FROM salarios_mensuales sm
         JOIN usuarios u ON sm.usuario_id::text = u.id::text
         WHERE sm.usuario_id::text = $1 AND sm.anio = $2
         ORDER BY sm.mes ASC`,
        [vendedorId.toString(), parseInt(anio)]
      );
      return NextResponse.json(result.rows);
    }

    if (mes) {
      const result = await query(
        `SELECT sm.*, u.nombre as vendedor_nombre 
         FROM salarios_mensuales sm
         JOIN usuarios u ON sm.usuario_id::text = u.id::text
         WHERE sm.mes = $1 AND sm.anio = $2`,
        [parseInt(mes), parseInt(anio)]
      );
      return NextResponse.json(result.rows);
    }

    return NextResponse.json({ error: 'Se requiere vendedorId o mes' }, { status: 400 });
  } catch (error: any) {
    console.error('Error al obtener salarios mensuales:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { usuario_id, mes, anio, salario } = body;

    if (!usuario_id || !mes || !anio || salario === undefined) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO salarios_mensuales (usuario_id, mes, anio, salario)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario_id, mes, anio) 
       DO UPDATE SET salario = EXCLUDED.salario
       RETURNING *`,
      [usuario_id.toString(), parseInt(mes), parseInt(anio), parseFloat(salario)]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error al guardar salario mensual:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}
