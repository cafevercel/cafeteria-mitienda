import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from '@/lib/db';

// Asegurar soporte TLS en entornos locales y certificados autofirmados
if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const getApiKey = () => process.env.GEMINI_API_KEY || '';
const getGenAI = () => {
  const key = getApiKey();
  return key ? new GoogleGenerativeAI(key) : null;
};
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

// Diccionario de datos y reglas de negocio del sistema
export const SYSTEM_SCHEMA_CONTEXT = `
Eres el Analista de Datos Inteligente y Asistente Financiero de "Mi Tienda / Cafetería".
Tu objetivo es responder con precisión preguntas de negocio, ventas, márgenes, inventario y vendedores traduciendo las preguntas a consultas SQL para PostgreSQL.

TABLAS DE LA BASE DE DATOS DISPONIBLES:
1. productos (Catálogo general y Almacén Central):
   - id: integer (PK)
   - nombre: varchar (Nombre del producto o alimento/bebida)
   - precio: numeric (Precio de venta al público estándar en CUP o moneda local)
   - precio_compra: numeric (Costo de adquisición o elaboración unitario)
   - cantidad: integer (Stock actual EXCLUSIVAMENTE en ALMACÉN CENTRAL)
   - descripcion: text
   - tiene_parametros: boolean
   - seccion: integer (FK a secciones/categorías)

2. usuario_productos (INVENTARIO Y STOCK EN CADA SUCURSAL / PUNTO DE VENTA):
   - usuario_id: integer o text (FK -> usuarios.id. Identificador del Punto de Venta / Sucursal / Vendedor)
   - producto_id: integer (FK -> productos.id)
   - cantidad: integer (STOCK ACTUAL DISPONIBLE EN ESA SUCURSAL O PUNTO DE VENTA)
   - precio: numeric (Precio de venta específico en ese punto)

3. usuario_producto_parametros (Variaciones/parámetros en cada punto de venta):
   - usuario_id: integer o text (FK -> usuarios.id)
   - producto_id: integer (FK -> productos.id)
   - nombre: varchar (Nombre de la variante: talla, color, sabor)
   - cantidad: integer (Stock de la variante en esa sucursal)

4. usuarios (Puntos de Venta / Sucursales y Almacén):
   - id: integer o text (PK)
   - nombre: varchar (Nombre de la sucursal o punto de venta, ej: "ML Dórticos", "ML Santa Elena", etc.)
   - rol: varchar ('Almacen', 'Vendedor') -> Las sucursales o puntos de venta tienen rol = 'Vendedor'
   - activo: boolean

5. empleados:
   - id: varchar (PK)
   - nombre: varchar (Nombre del trabajador asignado al punto de venta)
   - usuario_id: varchar (FK -> usuarios.id)
   - activo: boolean

6. ventas (Historial de transacciones de venta):
   - id: integer (PK)
   - producto: integer (FK -> productos.id)
   - cantidad: integer (Unidades vendidas)
   - precio_unitario: numeric (Precio al que se vendió)
   - precio_compra: numeric (Costo histórico unitario al momento de la venta)
   - total: numeric (Monto total de la venta = cantidad * precio_unitario)
   - vendedor: integer (FK -> usuarios.id. Sucursal o vendedor que realizó la venta)
   - fecha: timestamp with time zone (Fecha y hora exacta de la venta)
   - metodo_pago: varchar ('efectivo', 'transferencia', 'mixto')
   - monto_efectivo: numeric
   - monto_transferencia: numeric

7. gastos:
   - id: integer (PK)
   - vendedor_id: integer o text (FK -> usuarios.id)
   - nombre: varchar (Concepto del gasto, ej. Alquiler, Luz, Transporte)
   - cantidad: numeric (Monto monetario del gasto)
   - fecha: timestamp with time zone
   - tipo_gasto: varchar ('fijo', 'variable')

8. salarios_mensuales:
   - id: integer (PK)
   - usuario_id: text (FK -> usuarios.id)
   - mes: integer (1-12)
   - anio: integer
   - salario: numeric (Sueldo del vendedor)

9. merma:
   - id: integer (PK)
   - producto_id: integer (FK -> productos.id)
   - producto_nombre: varchar
   - cantidad: integer (Unidades dañadas/desperdiciadas)
   - fecha: timestamp with time zone

10. transacciones:
   - id: integer (PK)
   - producto: integer (FK -> productos.id)
   - cantidad: integer
   - tipo: varchar ('Entrega', 'Baja', 'Transferencia')
   - desde: integer (ID origen)
   - hacia: integer (ID destino)
   - fecha: timestamp with time zone
   - precio: numeric

REGLAS CRÍTICAS DE STOCK Y SUCURSALES (MUY IMPORTANTE):
1. DIFERENCIA ENTRE ALMACÉN CENTRAL Y PUNTOS DE VENTA (SUCURSALES):
   - La tabla "productos.cantidad" es ÚNICAMENTE el stock en el Almacén Central.
   - El stock en las SUCURSALES / PUNTOS DE VENTA (como "ML Dórticos", "ML Santa Elena", etc.) está en la tabla "usuario_productos.cantidad".
   - Cuando el usuario pregunte por inventario, stock disponible o productos de una sucursal o punto de venta, NUNCA uses "productos.cantidad". DEBES consultar "usuario_productos up JOIN productos p ON up.producto_id = p.id JOIN usuarios u ON up.usuario_id::text = u.id::text".
   - El filtro de stock disponible en una sucursal es estrictamente: "up.cantidad > 0".
   - Para identificar la sucursal, usa coincidencia flexible de texto sobre usuarios.nombre: "u.nombre ILIKE '%Dórticos%'" o "u.nombre ILIKE '%Santa Elena%'".

2. ANÁLISIS DE VENTAS Y RENTABILIDAD POR SUCURSAL:
   - En la tabla "ventas", la columna "vendedor" es la FK hacia "usuarios.id" (la sucursal que vendió).
   - Para cruzar el inventario disponible de una sucursal con sus ventas históricas, une:
     "usuario_productos up" con "ventas v" mediante:
     "ON v.producto = up.producto_id AND v.vendedor::text = up.usuario_id::text"
   - Ganancia Bruta por Venta = total - (COALESCE(precio_compra, 0) * cantidad)
   - Ganancia Bruta Total = SUM(v.total - (COALESCE(v.precio_compra, p.precio_compra, 0) * v.cantidad))
   - Margen Bruto (%) = CASE WHEN SUM(v.total) > 0 THEN (SUM(v.total - (COALESCE(v.precio_compra, p.precio_compra, 0) * v.cantidad)) / SUM(v.total)) * 100 ELSE 0 END

3. COMPARATIVAS ENTRE SUCURSALES:
   - Para comparar dos o más sucursales para productos con stock_disponible > 0 en cada una, haz GROUP BY por sucursal ("u.nombre") y producto ("p.nombre", "p.id"), filtrando "up.cantidad > 0".
   - Las fechas en "ventas.fecha" son TIMESTAMP: para los últimos 90 días usa "v.fecha >= NOW() - INTERVAL '90 days'".
   - Para nombres de productos usa siempre comparación insensible a mayúsculas/minúsculas: ILIKE '%termino%'.
`;

// Sanitizador y validador de seguridad SQL
export function validateAndSanitizeSql(rawSql: string): string {
  // Limpiar markdown o bloques de código si el modelo los incluyó
  let sqlClean = rawSql.replace(/```sql/gi, '').replace(/```/g, '').trim();

  // Asegurar que no termine en múltiples sentencias
  if (sqlClean.endsWith(';')) {
    sqlClean = sqlClean.slice(0, -1).trim();
  }

  const upper = sqlClean.toUpperCase();

  // Debe comenzar estrictamente con SELECT o WITH
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    throw new Error('Por motivos de seguridad, solo se permiten consultas de lectura (SELECT).');
  }

  // Palabras clave y comandos estrictamente prohibidos
  const forbiddenPatterns = [
    /\bINSERT\b/i,
    /\bUPDATE\b/i,
    /\bDELETE\b/i,
    /\bDROP\b/i,
    /\bALTER\b/i,
    /\bTRUNCATE\b/i,
    /\bCREATE\b/i,
    /\bGRANT\b/i,
    /\bREVOKE\b/i,
    /\bEXEC\b/i,
    /\bEXECUTE\b/i,
    /\bINTO\s+OUTFILE\b/i,
    /\bPG_SLEEP\b/i,
    /\bINFORMATION_SCHEMA\b/i,
    /;\s*[A-Z]/i, // Evitar multi-queries encadenadas con ;
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(sqlClean)) {
      throw new Error(`Consulta rechazada por seguridad: comando no autorizado detectado.`);
    }
  }

  // Si no tiene LIMIT, agregar un límite defensivo para no sobrecargar memoria
  if (!upper.includes('LIMIT')) {
    sqlClean += ' LIMIT 100';
  }

  return sqlClean;
}

export interface AiQueryResult {
  respuesta: string;
  sqlEjecutado?: string;
  filas?: any[];
  error?: string;
  tiempoMs?: number;
}

export async function processBusinessQuery(
  userQuestion: string,
  historialPrevio: Array<{ role: 'user' | 'model'; parts: string }> = []
): Promise<AiQueryResult> {
  const inicio = Date.now();
  const genAI = getGenAI();

  if (!genAI) {
    return {
      respuesta: '⚠️ La clave de API de Gemini (`GEMINI_API_KEY`) no está configurada en las variables de entorno (.env). Por favor, agrégala para activar el asistente inteligente.',
      error: 'GEMINI_API_KEY_MISSING',
    };
  }

  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.1, // Baja temperatura para consultas SQL precisas y estructuradas
    },
  });

  const now = new Date();
  const fechaHoy = now.toISOString().split('T')[0];
  const diaSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][now.getDay()];

  // Fase 1: Pedir a Gemini generar la consulta SQL
  const promptGeneracionSql = `
${SYSTEM_SCHEMA_CONTEXT}

INFORMACIÓN TEMPORAL ACTUAL:
- Fecha de hoy: ${fechaHoy} (${diaSemana})
- Año actual: ${now.getFullYear()}
- Mes actual: ${now.getMonth() + 1}

PREGUNTA DEL USUARIO:
"${userQuestion}"

INSTRUCCIÓN:
Genera ÚNICAMENTE una consulta SQL SELECT en PostgreSQL válida que responda a la pregunta.
Devuelve tu respuesta en formato JSON estrictamente como este:
{
  "sql": "SELECT ...",
  "intencion": "Breve descripción de lo que busca la consulta",
  "requiere_sql": true
}
Si la pregunta es solo un saludo o no requiere consultar la base de datos (por ejemplo: "Hola", "¿Quién eres?"), responde con:
{
  "sql": "",
  "intencion": "conversacion",
  "requiere_sql": false,
  "mensaje_directo": "Sistema de consultas y analítica listo. Puede solicitar reportes de ventas por fecha, márgenes de ganancia, auditoría de inventario o comparativas de rendimiento por vendedor."
}
No agregues comentarios ni explicaciones fuera del bloque JSON.
`;

  let parsedPlan: { sql?: string; intencion?: string; requiere_sql?: boolean; mensaje_directo?: string } = {};

  try {
    const resultSql = await model.generateContent(promptGeneracionSql);
    const textResponse = resultSql.response.text();
    
    // Extraer JSON
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedPlan = JSON.parse(jsonMatch[0]);
    } else {
      parsedPlan = JSON.parse(textResponse);
    }
  } catch (err: any) {
    console.error('Error al generar SQL con Gemini:', err);
    let msgAmigable = 'Lo siento, tuve un problema al interpretar tu pregunta. Por favor, intenta reformularla.';
    const errMsg = (err.message || '').toLowerCase();
    
    if (errMsg.includes('leaked') || errMsg.includes('reported as leaked')) {
      msgAmigable = '⚠️ Google detectó que tu clave de API fue filtrada/expuesta públicamente y la desactivó por seguridad.\n\nPor favor, genera una **nueva clave de API** en [Google AI Studio](https://aistudio.google.com/app/apikey) y colócala directamente en tu archivo `.env.local` sin compartirla públicamente.';
    } else if (err.status === 403 || errMsg.includes('403') || errMsg.includes('api_key_invalid')) {
      msgAmigable = '⚠️ La clave de API de Gemini no es válida o no tiene permisos. Por favor verifica tu clave en `.env.local`.';
    } else if (err.status === 429 || errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('resource_exhausted')) {
      msgAmigable = '⏳ Se ha alcanzado temporalmente el límite de consultas por minuto de Google. Espera unos segundos y vuelve a intentar.';
    }

    return {
      respuesta: msgAmigable,
      error: err.message,
    };
  }

  // Si no requiere SQL (saludos, preguntas generales)
  if (!parsedPlan.requiere_sql || !parsedPlan.sql) {
    return {
      respuesta: parsedPlan.mensaje_directo || '¡Hola! Estoy listo para ayudarte a analizar las ventas, productos, gastos y márgenes de tu tienda. ¿Qué te gustaría consultar hoy?',
      tiempoMs: Date.now() - inicio,
    };
  }

  // Fase 2: Validar y sanitizar la consulta SQL
  let sqlFinal = '';
  try {
    sqlFinal = validateAndSanitizeSql(parsedPlan.sql);
  } catch (securityError: any) {
    return {
      respuesta: `⚠️ ${securityError.message}`,
      sqlEjecutado: parsedPlan.sql,
      error: securityError.message,
      tiempoMs: Date.now() - inicio,
    };
  }

  // Fase 3: Ejecutar la consulta en PostgreSQL
  let dbRows: any[] = [];
  try {
    const queryResult = await query(sqlFinal);
    dbRows = queryResult.rows || [];
  } catch (dbError: any) {
    console.error('Error ejecutando SQL en DB:', dbError, 'Query:', sqlFinal);
    return {
      respuesta: `No pude consultar la base de datos para responder a eso. (Error: ${dbError.message})`,
      sqlEjecutado: sqlFinal,
      error: dbError.message,
      tiempoMs: Date.now() - inicio,
    };
  }

  // Fase 4: Redactar respuesta final en lenguaje natural con formato enriquecido
  const promptInterpretacion = `
Eres el Asistente Financiero y de Negocios de "Mi Tienda / Cafetería".
Fecha de hoy: ${fechaHoy} (${diaSemana}).

PREGUNTA DEL USUARIO:
"${userQuestion}"

CONSULTA SQL EJECUTADA:
${sqlFinal}

DATOS REALES OBTENIDOS DE LA BASE DE DATOS:
${JSON.stringify(dbRows, null, 2)}

INSTRUCCIÓN DE REDACCIÓN:
- Responde directamente con un tono ejecutivo, sobrio, formal y analítico.
- ESTRICTAMENTE PROHIBIDO EL USO DE EMOJIS o íconos decorativos en todo el texto.
- Si hay cifras de dinero, usa formato de moneda estándar (ej. $1,250.00).
- Si hay márgenes o tasas, exprésalos con dos decimales y símbolo de porcentaje (ej. 35.40%).
- Si hay comparativas o listas de registros, organízalas en tablas Markdown elegantes o con viñetas estructuradas.
- Si no hubo registros en el período indicado, indícalo de manera precisa y profesional.
- Si identificas una anomalía o punto de atención relevante, agrégalo al final bajo el encabezado 'Observación analítica:' de forma concisa.
`;

  try {
    const interpretationModel = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { temperature: 0.3 },
    });

    const resultInterpretacion = await interpretationModel.generateContent(promptInterpretacion);
    const respuestaFinal = resultInterpretacion.response.text();

    return {
      respuesta: respuestaFinal,
      sqlEjecutado: sqlFinal,
      filas: dbRows.slice(0, 15), // Primeras 15 filas como muestra
      tiempoMs: Date.now() - inicio,
    };
  } catch (interpretationError: any) {
    console.error('Error al interpretar respuesta con Gemini:', interpretationError);
    // Si falla la interpretación de texto pero la query funcionó, mostrar los datos crudos
    return {
      respuesta: `Obtuve ${dbRows.length} resultados de la base de datos:\n\`\`\`json\n${JSON.stringify(dbRows, null, 2)}\n\`\`\``,
      sqlEjecutado: sqlFinal,
      filas: dbRows,
      tiempoMs: Date.now() - inicio,
    };
  }
}
