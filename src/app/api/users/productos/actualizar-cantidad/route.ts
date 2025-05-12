import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PUT(request: NextRequest) {
  try {
    const { vendorId, productId, newQuantity, parametros } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { error: 'ID del producto es requerido' },
        { status: 400 }
      );
    }

    await query('BEGIN');

    try {
      if (parametros && parametros.length > 0) {
        // Actualizar cada parámetro
        for (const param of parametros) {
          await query(`
            UPDATE usuario_producto_parametros 
            SET cantidad = $1 
            WHERE producto_id = $2 
            AND nombre = $3
          `, [param.cantidad, productId, param.nombre]);
        }

        // Actualizar la cantidad total sumando los parámetros
        const totalQuantity = parametros.reduce((sum: number, param: { cantidad: number }) => sum + param.cantidad, 0);
        await query(`
          UPDATE usuario_productos 
          SET cantidad = $1 
          WHERE producto_id = $2
        `, [totalQuantity, productId]);
      } else {
        // Actualizar solo la cantidad total
        await query(`
          UPDATE usuario_productos 
          SET cantidad = $1 
          WHERE producto_id = $2
        `, [newQuantity, productId]);
      }

      await query('COMMIT');

      return NextResponse.json({
        message: 'Cantidad actualizada correctamente',
        vendorId,
        productId
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error al actualizar la cantidad:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la cantidad' },
      { status: 500 }
    );
  }
} 