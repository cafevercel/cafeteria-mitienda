import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

    // 6. vigencias_productos (Sistema de Índice de Rotación)
    await query(`
      CREATE TABLE IF NOT EXISTS vigencias_productos (
        id SERIAL PRIMARY KEY,
        usuario_id INT NOT NULL,
        producto_id INT NOT NULL,
        cantidad_inicial INT NOT NULL,
        fecha_inicio TIMESTAMP DEFAULT NOW(),
        fecha_fin TIMESTAMP NULL,
        estado VARCHAR(20) DEFAULT 'activa',
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_vigencia_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        CONSTRAINT fk_vigencia_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_vigencias_busqueda ON vigencias_productos (usuario_id, producto_id, estado)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_vigencias_fechas ON vigencias_productos (fecha_inicio, fecha_fin)`);
    
    // Auto-inicializar vigencias activas para productos que ya están en inventarios de vendedores con cantidad > 0
    await query(`
      INSERT INTO vigencias_productos (usuario_id, producto_id, cantidad_inicial, fecha_inicio, estado)
      SELECT up.usuario_id, up.producto_id, up.cantidad, NOW(), 'activa'
      FROM usuario_productos up
      JOIN usuarios u ON u.id = up.usuario_id AND u.rol = 'Vendedor'
      WHERE up.cantidad > 0
        AND NOT EXISTS (
          SELECT 1 FROM vigencias_productos vp 
          WHERE vp.usuario_id = up.usuario_id AND vp.producto_id = up.producto_id AND vp.estado = 'activa'
        )
    `);
    logs.push('✅ Tabla vigencias_productos e índice de rotación creados e inicializados');

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    console.error('Error en migración notifications-setup:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
