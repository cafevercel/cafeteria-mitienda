import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { Parametro, Merma } from '@/types';

export async function POST(request: Request) {
  try {
    const { producto_id, usuario_id, cantidad, parametros } = await request.json();

    // 1. Obtener información del producto
    const producto = await sql`
      SELECT * FROM productos WHERE id = ${producto_id}
    `;

    if (!producto.rows[0]) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Verificar si es merma de cafetería específicamente
    const esCafeteria = usuario_id === 'cafeteria';
    
    // Verificar si es una merma directa (sin usuario) o desde cafetería
    const esMermaDirecta = !usuario_id || usuario_id.trim() === '' || esCafeteria;
    
    // Buscar un usuario administrador para asociar con la merma en caso de cafetería
    // Esto es necesario porque la columna usuario_id no puede ser nula en la base de datos
    let idUsuarioMerma;
    let nombreUsuario = 'Cafetería';
    
    if (esMermaDirecta) {
      // Buscar un usuario con rol 'Almacen' para asociar con la merma
      const adminUser = await sql`
        SELECT id, nombre FROM usuarios WHERE rol = 'Almacen' LIMIT 1
      `;
      
      if (adminUser.rows.length > 0) {
        idUsuarioMerma = adminUser.rows[0].id;
      } else {
        // Si no hay usuarios de almacén, buscar cualquier usuario
        const anyUser = await sql`
          SELECT id, nombre FROM usuarios LIMIT 1
        `;
        
        if (anyUser.rows.length === 0) {
          return NextResponse.json(
            { error: 'No hay usuarios disponibles para asociar con la merma' },
            { status: 500 }
          );
        }
        
        idUsuarioMerma = anyUser.rows[0].id;
      }
    } else {
      // Si hay un usuario_id específico (no es cafetería ni vacío), verificar que exista
      const usuario = await sql`
        SELECT * FROM usuarios WHERE id = ${usuario_id}
      `;
      
      if (!usuario.rows[0]) {
        return NextResponse.json(
          { error: 'Usuario no encontrado' },
          { status: 404 }
        );
      }
      
      idUsuarioMerma = usuario_id;
      nombreUsuario = usuario.rows[0].nombre;
    }

    // 2. Crear registro en la tabla merma
    const mermaResult = await sql`
      INSERT INTO merma (
        producto_id,
        producto_nombre,
        cantidad,
        fecha,
        usuario_id,
        usuario_nombre
      ) VALUES (
        ${producto_id},
        ${producto.rows[0].nombre},
        ${cantidad},
        NOW(),
        ${idUsuarioMerma},
        ${nombreUsuario}
      )
      RETURNING id
    `;

    const mermaId = mermaResult.rows[0].id;

    if (producto.rows[0].tiene_parametros && parametros && parametros.length > 0) {
      // 3a. Para productos con parámetros
      const transaccionResult = await sql`
        INSERT INTO transacciones (
          producto,
          cantidad,
          desde,
          hacia,
          fecha,
          tipo
        ) VALUES (
          ${producto_id},
          ${cantidad},
          ${esMermaDirecta ? 'Inventario' : usuario_id},
          'MERMA',
          NOW(),
          'Baja'
        )
        RETURNING id
      `;

      const transaccionId = transaccionResult.rows[0].id;

      for (const param of parametros) {
        // Registrar en merma_parametros
        await sql`
          INSERT INTO merma_parametros (
            merma_id,
            nombre,
            cantidad
          ) VALUES (
            ${mermaId},
            ${param.nombre},
            ${param.cantidad}
          )
        `;

        // Registrar en transaccion_parametros
        await sql`
          INSERT INTO transaccion_parametros (
            transaccion_id,
            nombre,
            cantidad
          ) VALUES (
            ${transaccionId},
            ${param.nombre},
            ${param.cantidad}
          )
        `;

        if (esCafeteria) {
          // Si viene de cafetería, actualizar usuario_producto_parametros
          await sql`
            UPDATE usuario_producto_parametros
            SET cantidad = cantidad - ${param.cantidad}
            WHERE producto_id = ${producto_id}
            AND nombre = ${param.nombre}
          `;
        } else if (esMermaDirecta) {
          // Si es merma directa (no cafetería), actualizar en producto_parametros
          await sql`
            UPDATE producto_parametros
            SET cantidad = cantidad - ${param.cantidad}
            WHERE producto_id = ${producto_id}
            AND nombre = ${param.nombre}
          `;
        } else {
          // Si es un vendedor específico, actualizar en usuario_producto_parametros
          await sql`
            UPDATE usuario_producto_parametros
            SET cantidad = cantidad - ${param.cantidad}
            WHERE producto_id = ${producto_id}
            AND nombre = ${param.nombre}
          `;
        }
      }
    } else {
      // 3b. Para productos sin parámetros
      await sql`
        INSERT INTO transacciones (
          producto,
          cantidad,
          desde,
          hacia,
          fecha,
          tipo
        ) VALUES (
          ${producto_id},
          ${cantidad},
          ${esMermaDirecta ? 'Inventario' : usuario_id},
          'MERMA',
          NOW(),
          'Baja'
        )
      `;

      if (esCafeteria) {
        // Si viene de cafetería, actualizar usuario_productos
        await sql`
          UPDATE usuario_productos 
          SET cantidad = cantidad - ${cantidad}
          WHERE producto_id = ${producto_id}
        `;
      } else if (esMermaDirecta) {
        // Si es merma directa (no cafetería), actualizar en productos
        await sql`
          UPDATE productos 
          SET cantidad = cantidad - ${cantidad}
          WHERE id = ${producto_id}
        `;
      } else {
        // Si es de un vendedor específico, actualizar en usuario_productos
        await sql`
          UPDATE usuario_productos 
          SET cantidad = cantidad - ${cantidad}
          WHERE producto_id = ${producto_id}
        `;
      }
    }

    return NextResponse.json({ success: true, merma_id: mermaId });
  } catch (error) {
    console.error('Error en merma:', error);
    return NextResponse.json(
      { error: 'Error al procesar la merma' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const usuario_id = searchParams.get('usuario_id');

    // Consulta base para obtener las mermas
    const mermas = await sql`
      SELECT 
        m.id,
        m.producto_id,
        m.producto_nombre,
        m.cantidad,
        m.fecha,
        m.usuario_id,
        m.usuario_nombre,
        p.precio,
        p.foto,
        p.tiene_parametros
      FROM merma m
      INNER JOIN productos p ON m.producto_id = p.id
      WHERE CASE 
        WHEN ${usuario_id}::text IS NOT NULL THEN m.usuario_id = ${usuario_id}
        ELSE TRUE
      END
      ORDER BY m.fecha DESC
    `;

    const mermasFormateadas = await Promise.all(mermas.rows.map(async merma => {
      let parametros: Parametro[] = [];

      if (merma.tiene_parametros) {
        // Obtener los parámetros de merma_parametros
        const parametrosResult = await sql`
          SELECT 
            nombre,
            cantidad
          FROM merma_parametros
          WHERE merma_id = ${merma.id}
        `;
        
        parametros = parametrosResult.rows.map(row => ({
          nombre: row.nombre,
          cantidad: row.cantidad
        }));
      }

      return {
        id: merma.id,
        cantidad: merma.cantidad,
        fecha: merma.fecha,
        usuario_id: merma.usuario_id,
        producto: {
          id: merma.producto_id,
          nombre: merma.producto_nombre,
          precio: merma.precio,
          foto: merma.foto,
          tiene_parametros: merma.tiene_parametros,
          parametros: parametros
        }
      };
    }));

    return NextResponse.json(mermasFormateadas);
  } catch (error) {
    console.error('Error al obtener mermas:', error);
    return NextResponse.json(
      { error: 'Error al obtener mermas' },
      { status: 500 }
    );
  }
}


export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const producto_id = searchParams.get('producto_id');

    if (!producto_id) {
      return NextResponse.json(
        { error: 'Producto ID es requerido' },
        { status: 400 }
      );
    }

    // 1. Eliminar los registros de merma_parametros
    await sql`
      DELETE FROM merma_parametros
      WHERE merma_id IN (
        SELECT id FROM merma WHERE producto_id = ${producto_id}
      )
    `;

    // 2. Eliminar los registros de merma
    await sql`
      DELETE FROM merma
      WHERE producto_id = ${producto_id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar mermas:', error);
    return NextResponse.json(
      { error: 'Error al eliminar mermas' },
      { status: 500 }
    );
  }
}


