import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        await query('BEGIN');

        // 1. Actualizar la función del trigger para que tenga en cuenta el usuario_id
        console.log('🔄 Actualizando función del trigger update_usuario_producto_quantity...');
        await query(`
      CREATE OR REPLACE FUNCTION update_usuario_producto_quantity()
      RETURNS TRIGGER AS $$
      BEGIN
          UPDATE usuario_productos
          SET cantidad = (
              SELECT COALESCE(SUM(cantidad), 0)
              FROM usuario_producto_parametros
              WHERE producto_id = NEW.producto_id 
              AND usuario_id = NEW.usuario_id
          )
          WHERE producto_id = NEW.producto_id 
          AND usuario_id = NEW.usuario_id;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

        // 2. Verificar si el trigger existe, si no, crearlo
        // Primero intentamos borrarlo para asegurar que usa la función correcta
        await query(`
      DROP TRIGGER IF EXISTS trg_update_usuario_producto_quantity ON usuario_producto_parametros;
    `);

        await query(`
      CREATE TRIGGER trg_update_usuario_producto_quantity
      AFTER INSERT OR UPDATE OR DELETE ON usuario_producto_parametros
      FOR EACH ROW
      EXECUTE FUNCTION update_usuario_producto_quantity();
    `);

        await query('COMMIT');

        return NextResponse.json({
            success: true,
            message: 'Triggers actualizados correctamente para soporte multi-usuario'
        });
    } catch (error) {
        await query('ROLLBACK');
        console.error('Error updating triggers:', error);
        return NextResponse.json(
            { error: 'Error al actualizar triggers', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
