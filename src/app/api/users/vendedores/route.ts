import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {

  try {
    const result = await query('SELECT id, nombre, telefono, rol, activo FROM usuarios WHERE rol = $1', ['Vendedor']);
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

  try {
    // Obtener los datos actuales del usuario antes de actualizarlos
    const userResult = await query('SELECT nombre, telefono FROM usuarios WHERE id = $1', [id]);
    
    if (userResult.rowCount === 0) {
      return NextResponse.json({ error: 'Vendedor no encontrado' }, { status: 404 });
    }
    
    const currentUser = userResult.rows[0];
    
    // Obtener los nuevos valores o usar los actuales si no se proporcionan
    const { nombre, telefono, password, activo } = await request.json();
    
    // Si solo se está actualizando el estado activo y no se proporcionan otros campos,
    // usamos los valores actuales para los campos obligatorios
    const nombreToUpdate = nombre !== undefined ? nombre : currentUser.nombre;
    const telefonoToUpdate = telefono !== undefined ? telefono : currentUser.telefono;
    
    // Construir la consulta
    const queryParams = [nombreToUpdate, telefonoToUpdate];
    let queryString = 'UPDATE usuarios SET nombre = $1, telefono = $2';
    
    // Si se proporciona el estado "activo", lo incluimos en la actualización
    if (activo !== undefined) {
      queryString += ', activo = $' + (queryParams.length + 1);
      queryParams.push(activo);
    }

    if (password) {
      queryString += ', password = $' + (queryParams.length + 1);
      queryParams.push(password);
    }

    queryString += ' WHERE id = $' + (queryParams.length + 1) + ' RETURNING id, nombre, telefono, rol, activo';
    queryParams.push(id);

    console.log('Query string:', queryString);
    console.log('Query params:', queryParams);

    const result = await query(queryString, queryParams);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Error al actualizar vendedor' }, { status: 500 });
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