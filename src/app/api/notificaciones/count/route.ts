import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // 1. Conteo de vencimientos (vencido o vence pronto <= 7 dias)
    let vencimientosSummary: any[] = [];
    try {
      const resVencimientos = await query(`
        SELECT 
          id, 
          estado,
          fecha_vencimiento
        FROM (
          SELECT 
            id,
            fecha_vencimiento,
            CASE 
              WHEN fecha_vencimiento < CURRENT_DATE THEN 'vencido'
              WHEN fecha_vencimiento <= CURRENT_DATE + INTERVAL '7 days' THEN 'vence_pronto'
              ELSE 'vigente'
            END as estado
          FROM productos 
          WHERE tiene_vencimiento = true AND fecha_vencimiento IS NOT NULL
        ) sub
        WHERE estado IN ('vencido', 'vence_pronto')
      `);
      vencimientosSummary = resVencimientos.rows;
    } catch (err) {
      console.warn('DB notification count warning (vencimientos):', err);
    }

    // 2. Conteo de almacén (Agotados y Bajo Stock)
    let almacenSummary: any[] = [];
    try {
      const resAlmacen = await query(`
        SELECT 
          u.id as usuario_id,
          p.id as producto_id,
          CASE 
            WHEN (
              COALESCE(
                CASE 
                  WHEN p.tiene_parametros = true THEN (
                    SELECT SUM(upp.cantidad) 
                    FROM usuario_producto_parametros upp 
                    WHERE upp.producto_id = p.id AND upp.usuario_id = u.id
                  )
                  ELSE up.cantidad
                END, 
                0
              )
            ) = 0 THEN 'agotado'
            ELSE 'bajo_stock'
          END as estado,
          COALESCE(
            CASE 
              WHEN p.tiene_parametros = true THEN (
                SELECT SUM(upp.cantidad) 
                FROM usuario_producto_parametros upp 
                WHERE upp.producto_id = p.id AND upp.usuario_id = u.id
              )
              ELSE up.cantidad
            END, 
            0
          ) as cantidad
        FROM usuarios u
        JOIN productos p ON true
        LEFT JOIN usuario_productos up ON up.producto_id = p.id AND up.usuario_id = u.id
        WHERE u.rol = 'Vendedor' AND u.activo = true
          AND (
            up.id IS NOT NULL 
            OR EXISTS (
              SELECT 1 FROM usuario_producto_parametros upp 
              WHERE upp.producto_id = p.id AND upp.usuario_id = u.id
            )
          )
          AND (
            COALESCE(
              CASE 
                WHEN p.tiene_parametros = true THEN (
                  SELECT SUM(upp.cantidad) 
                  FROM usuario_producto_parametros upp 
                  WHERE upp.producto_id = p.id AND upp.usuario_id = u.id
                )
                ELSE up.cantidad
              END, 
              0
            ) <= COALESCE(p.stock_minimo, 0)
          )
      `);

      almacenSummary = resAlmacen.rows;
    } catch (err) {
      console.warn('DB notification count warning (almacen):', err);
    }

    return NextResponse.json({
      vencimientos: vencimientosSummary,
      almacen: almacenSummary
    });

  } catch (error) {
    console.error('Error fetching notification counts:', error);
    return NextResponse.json({ error: 'Error al obtener conteo' }, { status: 500 });
  }
}
