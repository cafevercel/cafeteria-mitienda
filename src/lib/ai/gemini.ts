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
1. productos:
   - id: integer (PK)
   - nombre: varchar (Nombre del producto o alimento/bebida)
   - precio: numeric (Precio de venta al público en CUP o moneda local)
   - precio_compra: numeric (Costo de adquisición o elaboración unitario)
   - cantidad: integer (Stock actual en almacén central)
   - descripcion: text
   - tiene_parametros: boolean

2. usuarios:
   - id: integer o text (PK)
   - nombre: varchar (Nombre de la tienda, punto de venta o vendedor)
   - rol: varchar ('Almacen', 'Vendedor')
   - activo: boolean

3. empleados:
   - id: varchar (PK)
   - nombre: varchar (Nombre del trabajador asignado al punto de venta)
   - usuario_id: varchar (FK -> usuarios.id)
   - activo: boolean

4. ventas:
   - id: integer (PK)
   - producto: integer (FK -> productos.id)
   - cantidad: integer (Unidades vendidas)
   - precio_unitario: numeric (Precio al que se vendió)
   - precio_compra: numeric (Costo histórico unitario al momento de la venta)
   - total: numeric (Monto total de la venta = cantidad * precio_unitario)
   - vendedor: integer (FK -> usuarios.id)
   - fecha: timestamp with time zone (Fecha y hora exacta de la venta)
   - metodo_pago: varchar ('efectivo', 'transferencia', 'mixto')
   - monto_efectivo: numeric
   - monto_transferencia: numeric

5. gastos:
   - id: integer (PK)
   - vendedor_id: integer o text (FK -> usuarios.id)
   - nombre: varchar (Concepto del gasto, ej. Alquiler, Luz, Transporte)
   - cantidad: numeric (Monto monetario del gasto)
   - fecha: timestamp with time zone
   - tipo_gasto: varchar ('fijo', 'variable')

6. salarios_mensuales:
   - id: integer (PK)
   - usuario_id: text (FK -> usuarios.id)
   - mes: integer (1-12)
   - anio: integer
   - salario: numeric (Sueldo del vendedor)

7. merma:
   - id: integer (PK)
   - producto_id: integer (FK -> productos.id)
   - producto_nombre: varchar
   - cantidad: integer (Unidades dañadas/desperdiciadas)
   - fecha: timestamp with time zone

8. transacciones:
   - id: integer (PK)
   - producto: integer (FK -> productos.id)
   - cantidad: integer
   - tipo: varchar ('Entrega', 'Baja', 'Transferencia')
   - desde: integer (ID origen)
   - hacia: integer (ID destino)
   - fecha: timestamp with time zone
   - precio: numeric

REGLAS DE CÁLCULO DE NEGOCIO:
1. Ganancia Bruta por Venta = total - (COALESCE(precio_compra, 0) * cantidad)
2. Ganancia Bruta Total = SUM(v.total - (COALESCE(v.precio_compra, 0) * v.cantidad))
3. Margen Bruto (%) = CASE WHEN SUM(v.total) > 0 THEN (SUM(v.total - (COALESCE(v.precio_compra, 0) * v.cantidad)) / SUM(v.total)) * 100 ELSE 0 END
4. Rendimiento de Vendedores: Se mide comparando SUM(v.total) y Ganancia Bruta generada agrupando por v.vendedor y uniendo con usuarios u ON v.vendedor::text = u.id::text.
5. Comparaciones por fecha: En PostgreSQL la columna ventas.fecha es TIMESTAMP. Usa v.fecha::date = 'YYYY-MM-DD' o v.fecha::date BETWEEN 'YYYY-MM-DD' AND 'YYYY-MM-DD'.
6. Para nombres de productos usa comparación insensible a mayúsculas/minúsculas: ILIKE '%termino%'.
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
  "mensaje_directo": "¡Hola! Soy tu asistente de Mi Tienda. Puedes preguntarme sobre ventas de cualquier fecha, productos más vendidos, márgenes de ganancia o rendimiento de tus vendedores."
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
- Responde directamente a la pregunta del usuario en español claro, profesional y conciso.
- Si hay cantidades de dinero, usa formato de moneda (ej. $1,250.00 CUP o $).
- Si hay porcentajes de margen, exprésalos claramente (ej. 35.4%).
- Si hay listas o comparaciones (ej. varios productos o vendedores), preséntalos en una tabla Markdown limpia o con viñetas ordenadas.
- Si no hubo ventas o resultados, indícalo amablemente (ej. "No se registraron ventas para esa fecha").
- Si los datos sugieren algo importante (ej. producto con alto margen, o merma elevada, o stock casi agotado), agrega una breve recomendación o apunte al final con 💡.
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
