import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {

  try {
    const result = await query('SELECT id, nombre, telefono, rol FROM usuarios WHERE rol = $1', ['Vendedor']);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error al obtener vendedores:', error);
    return NextResponse.json({ error: 'Error al obtener vendedores' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID no proporcionado' }, { status: 400 });
  }

  const { nombre, telefono, password } = await request.json();

  try {
    const queryParams = [nombre, telefono];
    let queryString = 'UPDATE usuarios SET nombre = $1, telefono = $2';

    if (password) {
      queryString += ', password = $3';
      queryParams.push(password);
    }

    queryString += ' WHERE id = $' + (queryParams.length + 1) + ' RETURNING id, nombre, telefono, rol';
    queryParams.push(id);

    const result = await query(queryString, queryParams);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Vendedor no encontrado' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar vendedor:', error);
    return NextResponse.json({ error: 'Error al actualizar vendedor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID no proporcionado' }, { status: 400 });
  }

  try {
    await query('BEGIN');

    try {
      // 1. Primero eliminar los registros de venta_parametros
      await query(`
        DELETE FROM venta_parametros 
        WHERE venta_id IN (
          SELECT id FROM ventas WHERE vendedor = $1
        )
      `, [id]);

      // 2. Luego eliminar las ventas
      await query('DELETE FROM ventas WHERE vendedor = $1', [id]);

      // 3. Eliminar los parámetros de transacciones relacionados con el vendedor
      await query(`
        DELETE FROM transaccion_parametros 
        WHERE transaccion_id IN (
          SELECT id FROM transacciones WHERE desde = $1 OR hacia = $1
        )
      `, [id]);

      // 4. Eliminar las transacciones relacionadas con el vendedor
      await query(`
        DELETE FROM transacciones 
        WHERE desde = $1 OR hacia = $1
      `, [id]);

      await query('COMMIT');

      return NextResponse.json({
        message: 'Ventas y transacciones eliminadas correctamente',
        vendedorId: id
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error al eliminar ventas y transacciones:', error);
    return NextResponse.json(
      { error: 'Error al eliminar ventas y transacciones' },
      { status: 500 }
    );
  }
}