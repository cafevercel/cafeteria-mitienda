import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const logs: string[] = [];

    // 1. tiene_vencimiento
    const checkVenc = await query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'productos' AND column_name = 'tiene_vencimiento'
    `);
    if (checkVenc.rows.length === 0) {
      await query(`ALTER TABLE productos ADD COLUMN tiene_vencimiento BOOLEAN DEFAULT FALSE`);
      logs.push('✅ Columna tiene_vencimiento agregada');
    } else {
      logs.push('ℹ️ Columna tiene_vencimiento ya existía');
    }

    // 2. fecha_vencimiento
    const checkFecha = await query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'productos' AND column_name = 'fecha_vencimiento'
    `);
    if (checkFecha.rows.length === 0) {
      await query(`ALTER TABLE productos ADD COLUMN fecha_vencimiento DATE NULL`);
      logs.push('✅ Columna fecha_vencimiento agregada');
    } else {
      logs.push('ℹ️ Columna fecha_vencimiento ya existía');
    }

    // 3. stock_minimo en productos
    const checkStockP = await query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'productos' AND column_name = 'stock_minimo'
    `);
    if (checkStockP.rows.length === 0) {
      await query(`ALTER TABLE productos ADD COLUMN stock_minimo NUMERIC DEFAULT 0`);
      logs.push('✅ Columna stock_minimo agregada a productos');
    } else {
      logs.push('ℹ️ Columna stock_minimo ya existía en productos');
    }

    // 4. stock_minimo en usuario_productos
    const checkStockUP = await query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'usuario_productos' AND column_name = 'stock_minimo'
    `);
    if (checkStockUP.rows.length === 0) {
      await query(`ALTER TABLE usuario_productos ADD COLUMN stock_minimo NUMERIC DEFAULT 0`);
      logs.push('✅ Columna stock_minimo agregada a usuario_productos');
    } else {
      logs.push('ℹ️ Columna stock_minimo ya existía en usuario_productos');
    }

    // 5. notificaciones_vendedores
    await query(`
      CREATE TABLE IF NOT EXISTS notificaciones_vendedores (
        id SERIAL PRIMARY KEY,
        vendedor_id INT NOT NULL,
        tipo VARCHAR(50) NOT NULL,
        mensaje TEXT NOT NULL,
        fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        leido BOOLEAN DEFAULT FALSE
      )
    `);
    logs.push('✅ Tabla notificaciones_vendedores creada o verificada');

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    console.error('Error en migración notifications-setup:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
