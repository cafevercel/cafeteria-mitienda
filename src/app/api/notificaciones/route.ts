import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. VENCIMIENTOS
    let vencimientos: any[] = [];
    try {
      const resVencimientos = await query(`
        SELECT 
          id, nombre, foto, cantidad, seccion,
          tiene_vencimiento, 
          TO_CHAR(fecha_vencimiento, 'YYYY-MM-DD') as fecha_vencimiento
        FROM productos 
        WHERE tiene_vencimiento = true AND fecha_vencimiento IS NOT NULL
        ORDER BY fecha_vencimiento ASC
      `);
      
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      vencimientos = resVencimientos.rows.map((p) => {
        const fVenc = new Date(p.fecha_vencimiento + 'T00:00:00');
        const diffMs = fVenc.getTime() - hoy.getTime();
        const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let estado: 'vencido' | 'vence_pronto' | 'vigente' = 'vigente';
        if (diffDias < 0) {
          estado = 'vencido';
        } else if (diffDias <= 7) {
          estado = 'vence_pronto';
        }

        return {
          ...p,
          dias_diferencia: Math.abs(diffDias),
          estado
        };
      });
    } catch (err) {
      console.warn('DB notification columns warning (vencimientos):', err);
    }

    // 2. ALMACÉN Y PUNTOS DE VENTA (Agotados y Bajo Stock)
    let alertasAlmacen: any[] = [];
    try {
      const resAlmacen = await query(`
        SELECT 
          up.id as usuario_producto_id,
          p.id as producto_id,
          p.nombre,
          p.foto,
          u.id as usuario_id,
          u.nombre as usuario_nombre,
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
          ) as cantidad,
          COALESCE(p.stock_minimo, 0) as stock_minimo
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
      `);

      alertasAlmacen = resAlmacen.rows.map((row) => {
        const cant = Number(row.cantidad);
        const stMin = Number(row.stock_minimo);
        let estado: 'agotado' | 'bajo_stock' | 'normal' = 'normal';
        
        if (cant === 0) {
          estado = 'agotado';
        } else if (stMin > 0 && cant <= stMin) {
          estado = 'bajo_stock';
        }

        return {
          ...row,
          cantidad: cant,
          stock_minimo: stMin,
          estado
        };
      }).filter((item) => item.estado !== 'normal');
    } catch (err) {
      console.warn('DB notification query warning (almacen):', err);
    }

    // 3. VENDEDORES (Stock Crítico e Inteligencia de Ventas)
    let vendedoresAlertas: any[] = [];
    let productosEstrella: any[] = [];
    let productosEstancados: any[] = [];
    let rankingVendedores: any[] = [];

    try {
      // Vendedores activos
      const resVendedores = await query(`SELECT id, nombre, telefono FROM usuarios WHERE rol = 'Vendedor' AND activo = true ORDER BY nombre`);
      
      for (const vend of resVendedores.rows) {
        const itemsVend = alertasAlmacen.filter((a) => String(a.usuario_id) === String(vend.id));
        if (itemsVend.length > 0) {
          vendedoresAlertas.push({
            vendedor_id: String(vend.id),
            vendedor_nombre: vend.nombre,
            vendedor_telefono: vend.telefono,
            total_agotados: itemsVend.filter((i) => i.estado === 'agotado').length,
            total_bajo_stock: itemsVend.filter((i) => i.estado === 'bajo_stock').length,
            productos_criticos: itemsVend.map((i) => ({
              id: i.producto_id,
              nombre: i.nombre,
              cantidad: i.cantidad,
              stock_minimo: i.stock_minimo,
              estado: i.estado
            }))
          });
        }
      }

      // Ventas generales para productos estrella
      const resVentas = await query(`
        SELECT 
          v.producto as producto_id,
          v.producto_nombre,
          v.producto_foto,
          SUM(v.cantidad) as total_vendido,
          SUM(v.total) as monto_total
        FROM ventas v
        GROUP BY v.producto, v.producto_nombre, v.producto_foto
        ORDER BY total_vendido DESC
      `);

      productosEstrella = resVentas.rows.slice(0, 10).map((row, idx) => ({
        id: row.producto_id,
        nombre: row.producto_nombre,
        foto: row.producto_foto,
        total_vendido: Number(row.total_vendido),
        monto_total: Number(row.monto_total),
        top_rank: idx + 1
      }));

      // Productos estancados (< 5 ventas)
      const resEstancados = await query(`
        SELECT 
          p.id, p.nombre, p.foto,
          COALESCE(SUM(v.cantidad), 0) as total_vendido
        FROM productos p
        LEFT JOIN ventas v ON v.producto = CAST(p.id AS VARCHAR) 
          AND v.fecha >= NOW() - INTERVAL '30 days'
        GROUP BY p.id, p.nombre, p.foto
        HAVING COALESCE(SUM(v.cantidad), 0) < 5
        ORDER BY total_vendido ASC
      `);

      productosEstancados = resEstancados.rows.map((row) => ({
        id: row.id,
        nombre: row.nombre,
        foto: row.foto,
        total_vendido: Number(row.total_vendido),
        es_estancado: true
      }));

      // Ranking mejores vendedores
      const resRankVendedores = await query(`
        SELECT 
          u.id as vendedor_id,
          u.nombre as vendedor_nombre,
          COALESCE(SUM(v.cantidad), 0) as unidades_vendidas,
          COALESCE(SUM(v.total), 0) as monto_total
        FROM usuarios u
        LEFT JOIN ventas v ON (CAST(v.vendedor AS VARCHAR) = CAST(u.id AS VARCHAR) OR v.vendedor = u.nombre)
        WHERE u.rol = 'Vendedor' AND u.activo = true
        GROUP BY u.id, u.nombre
        ORDER BY monto_total DESC
      `);

      rankingVendedores = resRankVendedores.rows.map((row, idx) => ({
        vendedor_id: String(row.vendedor_id),
        vendedor_nombre: row.vendedor_nombre,
        unidades_vendidas: Number(row.unidades_vendidas),
        monto_total: Number(row.monto_total),
        rank: idx + 1
      }));

    } catch (err) {
      console.warn('DB notification query warning (vendedores):', err);
    }

    return NextResponse.json({
      vencimientos,
      almacen: alertasAlmacen,
      vendedores: {
        alertas: vendedoresAlertas,
        productosEstrella,
        productosEstancados,
        rankingVendedores
      }
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Error al obtener notificaciones' }, { status: 500 });
  }
}
