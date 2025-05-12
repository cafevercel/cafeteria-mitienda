import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST() {
  try {
    await query('BEGIN');
    
    try {
      // 1. Crear tablas temporales sin restricción usuario_id
      await query(`
        CREATE TABLE IF NOT EXISTS inventario_temporal (
          id SERIAL PRIMARY KEY,
          producto_id INTEGER NOT NULL,
          cantidad INTEGER NOT NULL DEFAULT 0,
          precio DECIMAL(10, 2) NOT NULL DEFAULT 0,
          UNIQUE(producto_id)
        )
      `);
      
      await query(`
        CREATE TABLE IF NOT EXISTS parametros_temporal (
          id SERIAL PRIMARY KEY,
          producto_id INTEGER NOT NULL,
          nombre VARCHAR(255) NOT NULL,
          cantidad INTEGER NOT NULL DEFAULT 0,
          UNIQUE(producto_id, nombre)
        )
      `);
      
      // 2. Migrar datos de las tablas originales a las temporales
      await query(`
        INSERT INTO inventario_temporal (producto_id, cantidad, precio)
        SELECT producto_id, SUM(cantidad) as cantidad, MAX(precio) as precio
        FROM usuario_productos
        GROUP BY producto_id
        ON CONFLICT (producto_id) 
        DO UPDATE SET 
          cantidad = inventario_temporal.cantidad + EXCLUDED.cantidad,
          precio = EXCLUDED.precio
      `);
      
      await query(`
        INSERT INTO parametros_temporal (producto_id, nombre, cantidad)
        SELECT producto_id, nombre, SUM(cantidad) as cantidad
        FROM usuario_producto_parametros
        GROUP BY producto_id, nombre
        ON CONFLICT (producto_id, nombre) 
        DO UPDATE SET 
          cantidad = parametros_temporal.cantidad + EXCLUDED.cantidad
      `);
      
      // 3. Alterar las tablas existentes para eliminar usuario_id
      // Primero verificamos si existen las restricciones y las eliminamos
      const fkCheckQuery = await query(`
        SELECT conname, confrelid::regclass::text
        FROM pg_constraint
        WHERE contype = 'f' AND conrelid = 'usuario_productos'::regclass
      `);
      
      for (const constraint of fkCheckQuery.rows) {
        await query(`ALTER TABLE usuario_productos DROP CONSTRAINT IF EXISTS ${constraint.conname}`);
      }
      
      const fkCheckQuery2 = await query(`
        SELECT conname, confrelid::regclass::text
        FROM pg_constraint
        WHERE contype = 'f' AND conrelid = 'usuario_producto_parametros'::regclass
      `);
      
      for (const constraint of fkCheckQuery2.rows) {
        await query(`ALTER TABLE usuario_producto_parametros DROP CONSTRAINT IF EXISTS ${constraint.conname}`);
      }
      
      // 4. Crear nuevas tablas con el esquema actualizado
      await query(`
        DROP TABLE IF EXISTS usuario_productos CASCADE;
        CREATE TABLE usuario_productos (
          id SERIAL PRIMARY KEY,
          producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
          cantidad INTEGER NOT NULL DEFAULT 0,
          precio DECIMAL(10, 2) NOT NULL DEFAULT 0,
          UNIQUE(producto_id)
        )
      `);
      
      await query(`
        DROP TABLE IF EXISTS usuario_producto_parametros CASCADE;
        CREATE TABLE usuario_producto_parametros (
          id SERIAL PRIMARY KEY,
          producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
          nombre VARCHAR(255) NOT NULL,
          cantidad INTEGER NOT NULL DEFAULT 0,
          UNIQUE(producto_id, nombre)
        )
      `);
      
      // 5. Insertar datos de las tablas temporales a las nuevas tablas
      await query(`
        INSERT INTO usuario_productos (producto_id, cantidad, precio)
        SELECT producto_id, cantidad, precio FROM inventario_temporal
      `);
      
      await query(`
        INSERT INTO usuario_producto_parametros (producto_id, nombre, cantidad)
        SELECT producto_id, nombre, cantidad FROM parametros_temporal
      `);
      
      // 6. Eliminar tablas temporales
      await query(`DROP TABLE IF EXISTS inventario_temporal`);
      await query(`DROP TABLE IF EXISTS parametros_temporal`);
      
      await query('COMMIT');
      
      return NextResponse.json({
        success: true,
        message: 'Migración de inventario completada correctamente'
      });
    } catch (error) {
      await query('ROLLBACK');
      console.error('Error durante la migración:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error al migrar el inventario:', error);
    return NextResponse.json({ error: 'Error al realizar la migración' }, { status: 500 });
  }
} 