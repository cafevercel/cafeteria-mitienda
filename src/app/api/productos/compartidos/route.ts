import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Función helper para manejar errores de base de datos
function handleDatabaseError(error: unknown): NextResponse {
console.error('Database error:', error);

// Verificar si es un error con código
if (error && typeof error === 'object' && 'code' in error) {
  const dbError = error as { code: string; message?: string };
  
  switch (dbError.code) {
    case 'ECONNREFUSED':
      return NextResponse.json(
        { error: 'Error de conexión a la base de datos' }, 
        { status: 503 }
      );
    case '42P01': // Tabla no existe
      return NextResponse.json(
        { error: 'Error de configuración de base de datos' }, 
        { status: 500 }
      );
    case '23505': // Unique violation
      return NextResponse.json(
        { error: 'El registro ya existe' }, 
        { status: 409 }
      );
    case '42703': // Columna no existe
      return NextResponse.json(
        { error: 'Error de estructura de base de datos' }, 
        { status: 500 }
      );
    default:
      return NextResponse.json(
        { error: 'Error de base de datos' }, 
        { status: 500 }
      );
  }
}

// Error genérico
return NextResponse.json(
  { error: 'Error interno del servidor' }, 
  { status: 500 }
);
}

export async function GET() {
try {
  // Query optimizada que resuelve el problema N+1
  const result = await query(`
    SELECT 
      p.id,
      p.nombre,
      p.precio,
      p.foto,
      p.tiene_parametros,
      p.porcentaje_ganancia as "porcentajeGanancia",
      up.cantidad,
      COALESCE(
        json_agg(
          json_build_object(
            'nombre', upp.nombre,
            'cantidad', upp.cantidad
          )
        ) FILTER (WHERE upp.id IS NOT NULL),
        '[]'::json
      ) as parametros
    FROM productos p
    JOIN usuario_productos up ON p.id = up.producto_id
    LEFT JOIN usuario_producto_parametros upp ON p.id = upp.producto_id
    GROUP BY p.id, p.nombre, p.precio, p.foto, p.tiene_parametros, p.porcentaje_ganancia, up.cantidad
    ORDER BY p.nombre
  `);

  // Validar si hay resultados
  if (!result.rows || result.rows.length === 0) {
    return NextResponse.json({
      productos: [],
      mensaje: 'No hay productos compartidos disponibles'
    });
  }

  // Los datos ya vienen formateados desde SQL
  const productosFormateados = result.rows.map(producto => ({
    id: producto.id,
    nombre: producto.nombre,
    precio: producto.precio,
    foto: producto.foto,
    tieneParametros: producto.tiene_parametros,
    porcentajeGanancia: producto.porcentajeGanancia || 0,
    cantidad: producto.cantidad,
    parametros: producto.parametros
  }));

  return NextResponse.json(productosFormateados);

} catch (error) {
  return handleDatabaseError(error);
}
}

// Validación para el POST
function validatePostRequest(body: any): { 
usuarioId: number; 
limite: number; 
offset: number; 
errors: string[] 
} {
const errors: string[] = [];

// Validar usuarioId
const usuarioId = body?.usuarioId;
if (!usuarioId || typeof usuarioId !== 'number' || usuarioId <= 0) {
  errors.push('ID de usuario requerido y debe ser un número positivo');
}

// Validar limite
let limite = body?.limite || 50;
if (typeof limite !== 'number' || limite <= 0) {
  limite = 50;
}
if (limite > 100) {
  errors.push('El límite máximo es 100 productos');
}

// Validar offset
let offset = body?.offset || 0;
if (typeof offset !== 'number' || offset < 0) {
  offset = 0;
}

return { usuarioId, limite, offset, errors };
}

export async function POST(request: NextRequest) {
try {
  const body = await request.json();
  const { usuarioId, limite, offset, errors } = validatePostRequest(body);

  // Si hay errores de validación, retornar error 400
  if (errors.length > 0) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: errors },
      { status: 400 }
    );
  }

  // Query principal con parámetros validados
  const result = await query(`
    SELECT 
      p.id,
      p.nombre,
      p.precio,
      p.foto,
      p.tiene_parametros,
      p.porcentaje_ganancia as "porcentajeGanancia",
      up.cantidad,
      up.fecha_agregado,
      COALESCE(
        json_agg(
          json_build_object(
            'nombre', upp.nombre,
            'cantidad', upp.cantidad
          )
        ) FILTER (WHERE upp.id IS NOT NULL),
        '[]'::json
      ) as parametros
    FROM productos p
    JOIN usuario_productos up ON p.id = up.producto_id
    LEFT JOIN usuario_producto_parametros upp ON p.id = upp.producto_id
    WHERE up.usuario_id = $1
    GROUP BY p.id, p.nombre, p.precio, p.foto, p.tiene_parametros, 
             p.porcentaje_ganancia, up.cantidad, up.fecha_agregado
    ORDER BY up.fecha_agregado DESC
    LIMIT $2 OFFSET $3
  `, [usuarioId, limite, offset]);

  // Contar total para paginación
  const countResult = await query(`
    SELECT COUNT(DISTINCT p.id) as total
    FROM productos p
    JOIN usuario_productos up ON p.id = up.producto_id
    WHERE up.usuario_id = $1
  `, [usuarioId]);

  const total = parseInt(countResult.rows[0]?.total || '0');
  const hasMore = offset + limite < total;

  const productosFormateados = result.rows.map(producto => ({
    id: producto.id,
    nombre: producto.nombre,
    precio: producto.precio,
    foto: producto.foto,
    tieneParametros: producto.tiene_parametros,
    porcentajeGanancia: producto.porcentajeGanancia || 0,
    cantidad: producto.cantidad,
    fechaAgregado: producto.fecha_agregado,
    parametros: producto.parametros
  }));

  return NextResponse.json({
    productos: productosFormateados,
    paginacion: {
      total,
      limite,
      offset,
      hasMore,
      totalPaginas: Math.ceil(total / limite),
      paginaActual: Math.floor(offset / limite) + 1
    }
  });

} catch (error) {
  // Verificar si es error de JSON parsing
  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: 'Formato JSON inválido' },
      { status: 400 }
    );
  }
  
  return handleDatabaseError(error);
}
}