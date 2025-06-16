import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Consulta única optimizada con JOINs y agregación JSON
    const optimizedQuery = `
      SELECT 
        t.id, 
        p.nombre as producto, 
        t.cantidad, 
        t.tipo, 
        t.desde, 
        t.hacia, 
        t.fecha, 
        p.precio,
        p.tiene_parametros,
        COALESCE(
          json_agg(
            json_build_object(
              'nombre', tp.nombre,
              'cantidad', tp.cantidad
            )
          ) FILTER (WHERE tp.id IS NOT NULL),
          '[]'::json
        ) as parametros
      FROM transacciones t 
      JOIN productos p ON t.producto = p.id 
      LEFT JOIN transaccion_parametros tp ON t.id = tp.transaccion_id
      GROUP BY t.id, p.nombre, t.cantidad, t.tipo, t.desde, t.hacia, t.fecha, p.precio, p.tiene_parametros
      ORDER BY t.fecha DESC
    `;

    const result = await query(optimizedQuery);

    return NextResponse.json(result.rows);

  } catch (error) {
    console.error('Error fetching transactions:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Error al obtener transacciones', details: error.message },
        { status: 500 }
      );
    } else {
      return NextResponse.json(
        { error: 'Error desconocido al obtener transacciones' },
        { status: 500 }
      );
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const producto = formData.get('producto') as string;
    const cantidad = formData.get('cantidad') as string;
    const tipo = formData.get('tipo') as string;
    const desde = formData.get('desde') as string;
    const hacia = formData.get('hacia') as string;
    const parametrosRaw = formData.get('parametros') as string;
    const parametros = parametrosRaw ? JSON.parse(parametrosRaw) : [];

    // Validación básica
    if (!producto || !cantidad || !tipo) {
      return NextResponse.json({
        error: 'Producto, cantidad y tipo son requeridos'
      }, { status: 400 });
    }

    // Iniciar transacción
    await query('BEGIN');

    try {
      // 1. Insertar transacción
      const transaccionResult = await query(
        `INSERT INTO transacciones (producto, cantidad, tipo, desde, hacia, fecha) 
         VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
        [Number(producto), Number(cantidad), tipo, desde, hacia]
      );

      const transaccionId = transaccionResult.rows[0].id;

      // 2. Insertar parámetros si los tiene
      if (parametros.length > 0) {
        for (const param of parametros) {
          await query(
            `INSERT INTO transaccion_parametros (transaccion_id, nombre, cantidad) 
             VALUES ($1, $2, $3)`,
            [transaccionId, param.nombre, param.cantidad]
          );
        }
      }

      // Confirmar transacción
      await query('COMMIT');

      // Obtener la transacción completa recién creada
      const transaccionCompleta = await query(`
        SELECT 
          t.id, 
          p.nombre as producto, 
          t.cantidad, 
          t.tipo, 
          t.desde, 
          t.hacia, 
          t.fecha, 
          p.precio,
          p.tiene_parametros,
          COALESCE(
            json_agg(
              json_build_object(
                'nombre', tp.nombre,
                'cantidad', tp.cantidad
              )
            ) FILTER (WHERE tp.id IS NOT NULL),
            '[]'::json
          ) as parametros
        FROM transacciones t 
        JOIN productos p ON t.producto = p.id 
        LEFT JOIN transaccion_parametros tp ON t.id = tp.transaccion_id
        WHERE t.id = $1
        GROUP BY t.id, p.nombre, t.cantidad, t.tipo, t.desde, t.hacia, t.fecha, p.precio, p.tiene_parametros
      `, [transaccionId]);

      return NextResponse.json(transaccionCompleta.rows[0]);

    } catch (error) {
      // Revertir transacción en caso de error
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({
      error: 'Error interno del servidor al crear transacción'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const producto = formData.get('producto') as string;
    const cantidad = formData.get('cantidad') as string;
    const tipo = formData.get('tipo') as string;
    const desde = formData.get('desde') as string;
    const hacia = formData.get('hacia') as string;
    const parametrosRaw = formData.get('parametros') as string;
    const parametros = parametrosRaw ? JSON.parse(parametrosRaw) : [];

    if (!id) {
      return NextResponse.json({
        error: 'ID de la transacción es requerido'
      }, { status: 400 });
    }

    // Iniciar transacción
    await query('BEGIN');

    try {
      // 1. Actualizar transacción
      await query(
        `UPDATE transacciones 
         SET producto = $1, cantidad = $2, tipo = $3, desde = $4, hacia = $5
         WHERE id = $6`,
        [Number(producto), Number(cantidad), tipo, desde, hacia, Number(id)]
      );

      // 2. Eliminar parámetros existentes
      await query(
        `DELETE FROM transaccion_parametros WHERE transaccion_id = $1`,
        [Number(id)]
      );

      // 3. Insertar nuevos parámetros
      if (parametros.length > 0) {
        for (const param of parametros) {
          await query(
            `INSERT INTO transaccion_parametros (transaccion_id, nombre, cantidad) 
             VALUES ($1, $2, $3)`,
            [Number(id), param.nombre, param.cantidad]
          );
        }
      }

      // Confirmar transacción
      await query('COMMIT');

      // Obtener la transacción actualizada
      const transaccionActualizada = await query(`
        SELECT 
          t.id, 
          p.nombre as producto, 
          t.cantidad, 
          t.tipo, 
          t.desde, 
          t.hacia, 
          t.fecha, 
          p.precio,
          p.tiene_parametros,
          COALESCE(
            json_agg(
              json_build_object(
                'nombre', tp.nombre,
                'cantidad', tp.cantidad
              )
            ) FILTER (WHERE tp.id IS NOT NULL),
            '[]'::json
          ) as parametros
        FROM transacciones t 
        JOIN productos p ON t.producto = p.id 
        LEFT JOIN transaccion_parametros tp ON t.id = tp.transaccion_id
        WHERE t.id = $1
        GROUP BY t.id, p.nombre, t.cantidad, t.tipo, t.desde, t.hacia, t.fecha, p.precio, p.tiene_parametros
      `, [Number(id)]);

      return NextResponse.json(transaccionActualizada.rows[0]);

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json({
      error: 'Error interno del servidor al actualizar transacción'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        error: 'ID de la transacción es requerido'
      }, { status: 400 });
    }

    // Iniciar transacción
    await query('BEGIN');

    try {
      // 1. Eliminar parámetros
      await query(
        `DELETE FROM transaccion_parametros WHERE transaccion_id = $1`,
        [Number(id)]
      );

      // 2. Eliminar transacción
      const result = await query(
        `DELETE FROM transacciones WHERE id = $1 RETURNING *`,
        [Number(id)]
      );

      if (result.rows.length === 0) {
        await query('ROLLBACK');
        return NextResponse.json({
          error: 'Transacción no encontrada'
        }, { status: 404 });
      }

      // Confirmar transacción
      await query('COMMIT');

      return NextResponse.json({
        message: 'Transacción eliminada exitosamente',
        transaccion: result.rows[0]
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json({
      error: 'Error interno del servidor al eliminar transacción'
    }, { status: 500 });
  }
}
