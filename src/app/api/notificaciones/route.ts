import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const isBellMode = searchParams.get('mode') === 'bell';

    // 1. VENCIMIENTOS
    let vencimientos: any[] = [];
    try {
      const resVencimientos = await query(`
        WITH up_stock AS (
          SELECT producto_id, SUM(cantidad) AS up_total
          FROM usuario_productos
          GROUP BY producto_id
        ),
        upp_stock AS (
          SELECT producto_id, SUM(cantidad) AS upp_total
          FROM usuario_producto_parametros
          GROUP BY producto_id
        ),
        pp_stock AS (
          SELECT producto_id, SUM(cantidad) AS pp_total
          FROM producto_parametros
          GROUP BY producto_id
        )
        SELECT 
          p.id, 
          p.nombre,
          p.foto,
          p.seccion,
          COALESCE(p.tiene_vencimiento, false) as tiene_vencimiento, 
          TO_CHAR(p.fecha_vencimiento, 'YYYY-MM-DD') as fecha_vencimiento,
          (
            CASE 
              WHEN p.tiene_parametros = true THEN COALESCE(pp.pp_total, 0) + COALESCE(upp.upp_total, 0)
              ELSE COALESCE(p.cantidad, 0) + COALESCE(up.up_total, 0)
            END
          ) as cantidad
        FROM productos p
        LEFT JOIN up_stock up ON up.producto_id = p.id
        LEFT JOIN upp_stock upp ON upp.producto_id = p.id
        LEFT JOIN pp_stock pp ON pp.producto_id = p.id
        WHERE p.fecha_vencimiento IS NOT NULL
        ORDER BY p.fecha_vencimiento ASC
      `);
      
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      vencimientos = resVencimientos.rows
        .map((p) => {
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
            cantidad: Number(p.cantidad) || 0,
            dias_diferencia: Math.abs(diffDias),
            estado
          };
        })
        .filter((p) => (Number(p.cantidad) || 0) > 0);
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
        JOIN usuario_productos up ON up.usuario_id = u.id
        JOIN productos p ON p.id = up.producto_id
        WHERE u.rol = 'Vendedor' AND u.activo = true
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

      // Si es modo campana, no calculamos la rotación pesada ni rankings históricos
      if (!isBellMode) {
        try {
          const resRotacion = await query(`
          WITH vigencias_resumen AS (
            SELECT 
              vp.usuario_id,
              vp.producto_id,
              SUM(vp.cantidad_inicial) AS total_entregado,
              MIN(vp.fecha_inicio) AS primera_entrega,
              MAX(vp.fecha_inicio) AS ultima_entrega,
              SUM(
                GREATEST(
                  EXTRACT(EPOCH FROM (COALESCE(vp.fecha_fin, NOW()) - vp.fecha_inicio)) / 86400.0,
                  0.05
                )
              ) AS total_dias_vigencia,
              bool_or(vp.estado = 'activa') AS tiene_vigencia_activa
            FROM vigencias_productos vp
            GROUP BY vp.usuario_id, vp.producto_id
          ),
          ventas_resumen AS (
            SELECT 
              COALESCE(v.vendedor_id, v.vendedor) AS usuario_id,
              v.producto AS producto_id,
              SUM(v.cantidad) AS total_vendido
            FROM ventas v
            JOIN vigencias_productos vp ON vp.usuario_id = COALESCE(v.vendedor_id, v.vendedor)
                                       AND vp.producto_id = v.producto
                                       AND v.fecha >= vp.fecha_inicio
                                       AND v.fecha <= COALESCE(vp.fecha_fin, NOW())
            GROUP BY COALESCE(v.vendedor_id, v.vendedor), v.producto
          )
          SELECT 
            u.id AS vendedor_id,
            u.nombre AS vendedor_nombre,
            p.id AS producto_id,
            p.nombre AS producto_nombre,
            p.foto AS producto_foto,
            p.seccion AS producto_seccion,
            vr.total_entregado AS unidades_entregadas,
            COALESCE(up.cantidad, 0) AS stock_actual,
            ROUND(vr.total_dias_vigencia::numeric, 1) AS dias_vigencia,
            COALESCE(vnt.total_vendido, 0) AS unidades_vendidas,
            ROUND(
              (
                COALESCE(vnt.total_vendido, 0) / 
                GREATEST(vr.total_dias_vigencia, 0.05)
              )::numeric, 2
            ) AS indice_rotacion_diaria,
            CASE 
              WHEN COALESCE(up.cantidad, 0) > 0 THEN 'en_existencia'
              ELSE 'agotado'
            END AS estado_stock,
            vr.tiene_vigencia_activa
          FROM vigencias_resumen vr
          JOIN usuarios u ON u.id = vr.usuario_id AND u.rol = 'Vendedor'
          JOIN productos p ON p.id = vr.producto_id
          LEFT JOIN usuario_productos up ON up.usuario_id = vr.usuario_id AND up.producto_id = vr.producto_id
          LEFT JOIN ventas_resumen vnt ON vnt.usuario_id = vr.usuario_id AND vnt.producto_id = vr.producto_id
          ORDER BY indice_rotacion_diaria DESC
        `);

        rotacionProductos = resRotacion.rows.map((row) => {
          const indice = Number(row.indice_rotacion_diaria) || 0;
          let evaluacion = 'Baja Rotación';
          if (indice >= 10.0) evaluacion = 'Excelente Rotación';
          else if (indice >= 3.0) evaluacion = 'Alta Rotación';
          else if (indice >= 0.5) evaluacion = 'Rotación Media';

          return {
            vendedor_id: String(row.vendedor_id),
            vendedor_nombre: row.vendedor_nombre,
            producto_id: row.producto_id,
            producto_nombre: row.producto_nombre,
            producto_foto: row.producto_foto || '',
            producto_seccion: row.producto_seccion || '',
            unidades_entregadas: Number(row.unidades_entregadas),
            stock_actual: Number(row.stock_actual),
            dias_vigencia: Number(row.dias_vigencia),
            unidades_vendidas: Number(row.unidades_vendidas),
            indice_rotacion_diaria: indice,
            estado_stock: row.estado_stock,
            tiene_vigencia_activa: row.tiene_vigencia_activa,
            estado_vigencia: row.tiene_vigencia_activa ? 'activa' : 'agotada',
            evaluacion
          };
        });
      } catch (err) {
        console.warn('Error al obtener índice de rotación:', err);
      }

      // Compatibilidad con la respuesta anterior
      productosEstrella = rotacionProductos.filter(r => r.evaluacion === 'Excelente Rotación' || r.evaluacion === 'Alta Rotación').slice(0, 10);
      productosEstancados = rotacionProductos.filter(r => r.evaluacion === 'Baja Rotación' && r.dias_vigencia > 10);

      // Ranking mejores vendedores
      const resRankVendedores = await query(`
        SELECT 
          u.id as vendedor_id,
          u.nombre as vendedor_nombre,
          COALESCE(SUM(v.cantidad), 0) as unidades_vendidas,
          COALESCE(SUM(v.total), 0) as monto_total
        FROM usuarios u
        LEFT JOIN ventas v ON (v.vendedor = u.id OR v.vendedor_id = u.id)
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
      }
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
