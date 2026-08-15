import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. VENCIMIENTOS
    let vencimientos: any[] = [];
    try {
      const resVencimientos = await query(`
        SELECT 
          p.id, p.nombre, p.foto,
          COALESCE(
            CASE 
              WHEN p.tiene_parametros = true THEN (
                SELECT SUM(pp.cantidad) 
                FROM producto_parametros pp 
                WHERE pp.producto_id = p.id
              )
              ELSE p.cantidad
            END, 
            0
          ) as cantidad,
          p.seccion,
          p.tiene_vencimiento, 
          TO_CHAR(p.fecha_vencimiento, 'YYYY-MM-DD') as fecha_vencimiento
        FROM productos p
        WHERE p.tiene_vencimiento = true 
          AND p.fecha_vencimiento IS NOT NULL
          AND COALESCE(
            CASE 
              WHEN p.tiene_parametros = true THEN (
                SELECT SUM(pp.cantidad) 
                FROM producto_parametros pp 
                WHERE pp.producto_id = p.id
              )
              ELSE p.cantidad
            END, 
            0
          ) > 0
        ORDER BY p.fecha_vencimiento ASC
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
    let rotacionProductos: any[] = [];
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

      // NUEVA LÓGICA: Sistema de valoración por Índice de Rotación (Ventas vs Tiempo de Vigencia)
      // Aplica únicamente a Vendedores / Puntos de venta (excluye Almacenes)
      try {
        const resRotacion = await query(`
          SELECT 
            u.id AS vendedor_id,
            u.nombre AS vendedor_nombre,
            p.id AS producto_id,
            p.nombre AS producto_nombre,
            p.foto AS producto_foto,
            vp.cantidad_inicial AS unidades_entregadas,
            COALESCE(up.cantidad, 0) AS stock_actual,
            vp.fecha_inicio,
            vp.fecha_fin,
            vp.estado AS estado_vigencia,
            ROUND(
              GREATEST(
                EXTRACT(EPOCH FROM (COALESCE(vp.fecha_fin, NOW()) - vp.fecha_inicio)) / 86400.0,
                0.01
              )::numeric, 2
            ) AS dias_vigencia,
            COALESCE(SUM(v.cantidad), 0) AS unidades_vendidas,
            ROUND(
              (
                COALESCE(SUM(v.cantidad), 0) / 
                GREATEST(
                  EXTRACT(EPOCH FROM (COALESCE(vp.fecha_fin, NOW()) - vp.fecha_inicio)) / 86400.0,
                  0.01
                )
              )::numeric, 3
            ) AS indice_rotacion_diaria
          FROM vigencias_productos vp
          JOIN usuarios u ON u.id = vp.usuario_id AND u.rol = 'Vendedor'
          JOIN productos p ON p.id = vp.producto_id
          LEFT JOIN usuario_productos up ON up.usuario_id = vp.usuario_id AND up.producto_id = vp.producto_id
          LEFT JOIN ventas v ON (CAST(v.vendedor AS VARCHAR) = CAST(vp.usuario_id AS VARCHAR) OR v.vendedor = u.nombre)
                            AND (CAST(v.producto AS VARCHAR) = CAST(vp.producto_id AS VARCHAR))
                            AND v.fecha >= vp.fecha_inicio 
                            AND v.fecha <= COALESCE(vp.fecha_fin, NOW())
          GROUP BY u.id, u.nombre, p.id, p.nombre, p.foto, vp.id, vp.cantidad_inicial, up.cantidad, vp.fecha_inicio, vp.fecha_fin, vp.estado
          ORDER BY indice_rotacion_diaria DESC
        `);

        rotacionProductos = resRotacion.rows.map((row) => ({
          vendedor_id: String(row.vendedor_id),
          vendedor_nombre: row.vendedor_nombre,
          producto_id: row.producto_id,
          producto_nombre: row.producto_nombre,
          producto_foto: row.producto_foto,
          unidades_entregadas: Number(row.unidades_entregadas),
          stock_actual: Number(row.stock_actual),
          dias_vigencia: Number(row.dias_vigencia),
          unidades_vendidas: Number(row.unidades_vendidas),
          indice_rotacion_diaria: Number(row.indice_rotacion_diaria),
          estado_vigencia: row.estado_vigencia,
          evaluacion: Number(row.indice_rotacion_diaria) >= 1.0 ? 'Alta Rotación' : Number(row.indice_rotacion_diaria) >= 0.3 ? 'Rotación Media' : 'Baja Rotación'
        }));
      } catch (err) {
        console.warn('Error al obtener índice de rotación:', err);
      }

      // Compatibilidad con la respuesta anterior
      productosEstrella = rotacionProductos.filter(r => r.evaluacion === 'Alta Rotación').slice(0, 10);
      productosEstancados = rotacionProductos.filter(r => r.evaluacion === 'Baja Rotación');

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

    // 4. RECORDATORIOS
    let recordatoriosNotif: any[] = [];
    try {
      const resRecordatorios = await query(`
        SELECT 
          id, 
          texto, 
          TO_CHAR(fecha, 'YYYY-MM-DD') as fecha,
          completado,
          fecha_creacion
        FROM recordatorios
        WHERE completado = false AND fecha <= CURRENT_DATE
        ORDER BY fecha ASC
      `);
      recordatoriosNotif = resRecordatorios.rows;
    } catch (err) {
      console.warn('DB notification query warning (recordatorios):', err);
    }

    return NextResponse.json({
      vencimientos,
      almacen: alertasAlmacen,
      recordatorios: recordatoriosNotif,
      vendedores: {
        alertas: vendedoresAlertas,
        rotacionProductos,
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
