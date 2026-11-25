import { query } from '@/lib/db';
import { SYSTEM_SCHEMA_CONTEXT } from './schema-context';
import {
  resolveQueryEntities,
  getRealSchemaColumnsText,
  findSuggestionsForZeroRowSql,
} from './entity-resolver';

export interface AiQueryResult {
  respuesta: string;
  sqlEjecutado?: string;
  filas?: any[];
  error?: string;
  tiempoMs?: number;
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type CompletionStage = 'sql' | 'interpret';

export type GenerateCompletionFn = (
  messages: ChatCompletionMessage[],
  temperature: number,
  stage?: CompletionStage
) => Promise<string>;

interface SqlPlan {
  sql?: string;
  intencion?: string;
  requiere_sql?: boolean;
  mensaje_directo?: string;
}

/**
 * Elimina comentarios SQL (-- y /* * /) fuera de literales de texto '...'
 */
function stripSqlCommentsSafely(sql: string): string {
  let out = '';
  let i = 0;
  let inSingleQuote = false;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "'") {
      out += ch;
      if (inSingleQuote && next === "'") {
        // Comilla escapada ''
        out += next;
        i += 2;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      i++;
      continue;
    }

    if (!inSingleQuote) {
      if (ch === '-' && next === '-') {
        while (i < sql.length && sql[i] !== '\n') i++;
        out += ' ';
        continue;
      }
      if (ch === '/' && next === '*') {
        i += 2;
        while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
        i += 2;
        out += ' ';
        continue;
      }
    }

    out += ch;
    i++;
  }

  return out.trim();
}

/**
 * Verifica si existe la palabra clave LIMIT en el nivel superior (profundidad de paréntesis 0)
 */
function hasTopLevelLimit(sql: string): boolean {
  let depth = 0;
  let inSingleQuote = false;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'") {
      if (inSingleQuote && sql[i + 1] === "'") {
        i += 2;
        continue;
      }
      inSingleQuote = !inSingleQuote;
    } else if (!inSingleQuote) {
      if (ch === '(') depth++;
      else if (ch === ')' && depth > 0) depth--;
      else if (depth === 0) {
        const sub = sql.slice(i);
        if (/^LIMIT\b/i.test(sub)) {
          const prev = i === 0 ? ' ' : sql[i - 1];
          if (/[\s)]/.test(prev)) {
            return true;
          }
        }
      }
    }
    i++;
  }
  return false;
}

// Sanitizador y validador de seguridad SQL
export function validateAndSanitizeSql(rawSql: string): string {
  let sqlClean = rawSql.replace(/```sql/gi, '').replace(/```/g, '').trim();
  sqlClean = stripSqlCommentsSafely(sqlClean);

  if (sqlClean.endsWith(';')) {
    sqlClean = sqlClean.slice(0, -1).trim();
  }

  const upper = sqlClean.toUpperCase();

  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    throw new Error('Por motivos de seguridad, solo se permiten consultas de lectura (SELECT).');
  }

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
    /\bCALL\b/i,
    /\bCOPY\b/i,
    /\bINTO\s+OUTFILE\b/i,
    /\bPG_SLEEP\b/i,
    /\bINFORMATION_SCHEMA\b/i,
    /\bPG_CATALOG\b/i,
    /\bPASSWORD\b/i,
    /;\s*[A-Z]/i,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(sqlClean)) {
      throw new Error('Consulta rechazada por seguridad: comando o columna no autorizada detectada.');
    }
  }

  if (!hasTopLevelLimit(sqlClean)) {
    sqlClean += ' LIMIT 500';
  }

  return sqlClean;
}

/**
 * Parser JSON tolerante a saltos de línea sin escapar dentro de cadenas SQL devueltas por LLMs
 */
export function parseAiPlanJson(rawReply: string): SqlPlan {
  const cleaned = rawReply.replace(/```json/gi, '').replace(/```/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : cleaned;

  try {
    return JSON.parse(candidate);
  } catch {
    // Reemplazar saltos de línea literales y tabulaciones dentro de valores JSON de cadena
    let escaped = '';
    let inString = false;
    for (let i = 0; i < candidate.length; i++) {
      const c = candidate[i];
      const prev = i > 0 ? candidate[i - 1] : '';
      if (c === '"' && prev !== '\\') {
        inString = !inString;
        escaped += c;
      } else if (inString && c === '\n') {
        escaped += '\\n';
      } else if (inString && c === '\r') {
        escaped += ' ';
      } else if (inString && c === '\t') {
        escaped += ' ';
      } else {
        escaped += c;
      }
    }

    try {
      return JSON.parse(escaped);
    } catch {
      // Fallback: si devolvió SQL directo sin JSON válido
      const sqlBlockMatch = rawReply.match(/```sql\s*([\s\S]*?)```/i) || rawReply.match(/\b(WITH|SELECT)\b[\s\S]+/i);
      if (sqlBlockMatch) {
        return {
          sql: (sqlBlockMatch[1] || sqlBlockMatch[0]).trim(),
          intencion: 'consulta_extraida',
          requiere_sql: true,
        };
      }
      throw new Error('No se pudo interpretar la respuesta estructurada del modelo.');
    }
  }
}

function shouldAttemptZeroRowRecovery(sql: string): { shouldRetry: boolean; reason: string } {
  const lower = sql.toLowerCase();

  // Trampa conocida: ventas.vendedor_id es siempre NULL en esta DB
  if (/\bventas\b/.test(lower) && /\bvendedor_id\b/.test(lower)) {
    return {
      shouldRetry: true,
      reason: 'La columna ventas.vendedor_id está NULL en todos los registros de la base de datos. Debes usar ventas.vendedor para unir o filtrar por sucursal/vendedor.',
    };
  }

  // Consultó solo productos.cantidad sin mirar usuario_productos (almacén central suele estar en 0)
  if (/\bproductos\b/.test(lower) && !/\busuario_productos\b/.test(lower) && /\bcantidad\s*>/.test(lower)) {
    return {
      shouldRetry: true,
      reason: 'El almacén central (productos.cantidad) actualmente está en 0 para los artículos; el stock operativo disponible se encuentra en usuario_productos.cantidad unido a usuarios.',
    };
  }

  // Filtró usando cadenas de texto literales (= '...', ILIKE '...' o IN ('...'))
  if (/(?:ilike|like|=)\s*'[^']+'/i.test(sql) || /\bIN\s*\(\s*'[^']+'/i.test(sql)) {
    return {
      shouldRetry: true,
      reason: 'Un filtro de texto literal devolvió 0 filas; verifica posibles variantes ortográficas, tildes, espacios finales o sinónimos en el catálogo.',
    };
  }

  return { shouldRetry: false, reason: '' };
}

export async function runAiSqlPipeline(params: {
  userQuestion: string;
  providerLabel: string;
  generateCompletion: GenerateCompletionFn;
}): Promise<AiQueryResult> {
  const { userQuestion, generateCompletion } = params;
  const inicio = Date.now();

  const now = new Date();
  const fechaHoy = now.toISOString().split('T')[0];
  const diaSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][now.getDay()];

  // Paso 0: Pre-resolución inteligente de entidades con tolerancia ortográfica y fonética
  const entities = await resolveQueryEntities(userQuestion);

  const systemPrompt = `
${SYSTEM_SCHEMA_CONTEXT}

INFORMACIÓN TEMPORAL ACTUAL:
- Fecha de hoy: ${fechaHoy} (${diaSemana})
- Año actual: ${now.getFullYear()}
- Mes actual: ${now.getMonth() + 1}
${entities.formattedHint}
`;

  const userSqlPrompt = `
PREGUNTA DEL USUARIO:
"${userQuestion}"

INSTRUCCIONES DE GENERACIÓN:
1. Interpreta la intención de negocio aunque haya faltas de ortografía, abreviaturas, tildes omitidas o nombres de columnas que NO existen en la base de datos (traduce cualquier campo ficticio o conceptual usando el DICCIONARIO DE INTERPRETACIÓN del sistema).
2. Genera ÚNICAMENTE una consulta SQL SELECT (o WITH) válida en PostgreSQL usando EXCLUSIVAMENTE tablas y columnas reales.
3. Si en "ENTIDADES DETECTADAS EN LA BASE DE DATOS" aparecen sucursales, secciones o productos que coinciden con la consulta, úsalos en tu filtro WHERE (respetando si es una pregunta general de toda una sucursal sin filtrar a un único producto).
4. Devuelve tu respuesta estrictamente en JSON:
{
  "sql": "SELECT ...",
  "intencion": "Breve descripción de la consulta e interpretación de columnas aplicadas",
  "requiere_sql": true
}
Si la pregunta es únicamente un saludo o conversación general sin necesidad de consultar la base de datos:
{
  "sql": "",
  "intencion": "conversacion",
  "requiere_sql": false,
  "mensaje_directo": "Sistema de consultas y analítica listo. Puede solicitar reportes de ventas por fecha, márgenes de ganancia, auditoría de inventario o comparativas de rendimiento por sucursal."
}
No incluyas texto ni explicaciones fuera del JSON.
`;

  let parsedPlan: SqlPlan = {};
  try {
    const rawSqlReply = await generateCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userSqlPrompt },
      ],
      0.1,
      'sql'
    );
    parsedPlan = parseAiPlanJson(rawSqlReply);
  } catch (err: any) {
    console.error(`Error al generar SQL (${params.providerLabel}):`, err);
    return {
      respuesta: err.message || 'Tuve un problema al interpretar tu consulta. Por favor, intenta reformularla.',
      error: err.message,
      tiempoMs: Date.now() - inicio,
    };
  }

  if (!parsedPlan.requiere_sql || !parsedPlan.sql) {
    return {
      respuesta:
        parsedPlan.mensaje_directo ||
        'Sistema de consultas listo. Indíqueme qué análisis de ventas, inventario, márgenes o sucursales desea revisar.',
      tiempoMs: Date.now() - inicio,
    };
  }

  // Paso 2 y 3: Validación + Ejecución con auto-corrección ante errores de PostgreSQL (hasta 2 reintentos)
  let sqlFinal = '';
  let dbRows: any[] = [];
  let lastDbError: any = null;
  let zeroRowRetried = false;
  const maxSqlAttempts = 3;

  for (let attempt = 1; attempt <= maxSqlAttempts; attempt++) {
    try {
      sqlFinal = validateAndSanitizeSql(parsedPlan.sql || '');
    } catch (securityError: any) {
      return {
        respuesta: securityError.message,
        sqlEjecutado: parsedPlan.sql,
        error: securityError.message,
        tiempoMs: Date.now() - inicio,
      };
    }

    try {
      const queryResult = await query(sqlFinal);
      dbRows = queryResult.rows || [];
      lastDbError = null;

      // Paso 4: Recuperación inteligente ante 0 filas por posibles filtros rígidos o trampas del esquema
      if (dbRows.length === 0 && !zeroRowRetried && attempt < maxSqlAttempts) {
        const recovery = shouldAttemptZeroRowRecovery(sqlFinal);
        if (recovery.shouldRetry) {
          zeroRowRetried = true;
          const zeroSuggestions = await findSuggestionsForZeroRowSql(sqlFinal);
          const retryPrompt = `
La consulta SQL se ejecutó pero devolvió 0 filas:
${sqlFinal}

MOTIVO PROBABLE:
${recovery.reason}
${zeroSuggestions}

Revisa la consulta anterior para la pregunta "${userQuestion}". Si es posible ampliarla con tolerancia ortográfica (translate(lower(...))), usando los IDs correctos o consultando usuario_productos / ventas.vendedor según corresponda, devuelve un nuevo JSON con "sql" corregido. Si confirmas que los filtros ya eran exactos y simplemente no hubo actividad en ese rango, devuelve la misma consulta.
`;
          try {
            const correctedReply = await generateCompletion(
              [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userSqlPrompt },
                { role: 'assistant', content: JSON.stringify(parsedPlan) },
                { role: 'user', content: retryPrompt },
              ],
              0.1,
              'sql'
            );
            const nextPlan = parseAiPlanJson(correctedReply);
            if (nextPlan.sql && nextPlan.sql.trim() !== (parsedPlan.sql || '').trim()) {
              parsedPlan = nextPlan;
              continue;
            }
          } catch {
            // Si falla la re-evaluación, mantenemos el resultado vacío legítimo
          }
        }
      }

      break;
    } catch (dbError: any) {
      lastDbError = dbError;
      console.warn(`Intento ${attempt} falló en PostgreSQL (${dbError.message}):`, sqlFinal);

      if (attempt >= maxSqlAttempts) {
        break;
      }

      // Auto-corrección ante errores de columna inexistente, relación, función no instalada o tipos
      const realSchemaCols = await getRealSchemaColumnsText(sqlFinal);
      const fixPrompt = `
La consulta SQL que generaste falló al ejecutarse en PostgreSQL:
ERROR EXACTA DE POSTGRESQL: ${dbError.message}

CONSULTA SQL QUE FALLÓ:
${sqlFinal}

COLUMNAS REALES DISPONIBLES EN LAS TABLAS DEL ESQUEMA:
${realSchemaCols}

INSTRUCCIONES DE CORRECCIÓN:
- Reemplaza cualquier columna ficticia o inexistente (ej. stock_disponible -> up.cantidad, descripcion -> p.nombre, sucursal -> u.nombre, etc.) por las columnas REALES listadas arriba.
- Si falló por unaccent() o similarity(), recuerda que NO están instaladas; usa translate(lower(TRIM(col)), 'áéíóúüñ', 'aeiouun').
- Si falló por GROUP BY o tipos de datos, corrige las agregaciones o casts (::text / ::integer).
- Devuelve ÚNICAMENTE el JSON corregido con "sql", "intencion" y "requiere_sql": true.
`;
      try {
        const fixedReply = await generateCompletion(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userSqlPrompt },
            { role: 'assistant', content: JSON.stringify(parsedPlan) },
            { role: 'user', content: fixPrompt },
          ],
          0.1,
          'sql'
        );
        parsedPlan = parseAiPlanJson(fixedReply);
        if (!parsedPlan.sql) break;
      } catch (retryGenErr: any) {
        lastDbError = retryGenErr;
        break;
      }
    }
  }

  if (lastDbError) {
    console.error('Error definitivo ejecutando SQL en DB:', lastDbError, 'Query:', sqlFinal);
    return {
      respuesta: `No pude completar la consulta en la base de datos tras intentar corregir la sintaxis SQL. (${lastDbError.message})`,
      sqlEjecutado: sqlFinal,
      error: lastDbError.message,
      tiempoMs: Date.now() - inicio,
    };
  }

  // Paso 5: Interpretación ejecutiva en lenguaje natural
  const rowsForPrompt = dbRows.slice(0, 150);
  const truncationNote =
    dbRows.length > rowsForPrompt.length
      ? `\n(Nota: se muestran las primeras ${rowsForPrompt.length} de ${dbRows.length} filas totales devueltas).`
      : '';

  const promptInterpretacion = `
Eres el Asistente Financiero y de Negocios de "Mi Tienda / Cafetería".
Fecha de hoy: ${fechaHoy} (${diaSemana}).

PREGUNTA ORIGINAL DEL USUARIO:
"${userQuestion}"

CONSULTA SQL EJECUTADA (ya resuelta sobre las columnas reales de PostgreSQL):
${sqlFinal}

DATOS REALES OBTENIDOS (${dbRows.length} registros):${truncationNote}
${JSON.stringify(rowsForPrompt, null, 2)}

INSTRUCCIÓN DE REDACCIÓN:
- Responde directamente con un tono ejecutivo, sobrio, formal y analítico.
- ESTRICTAMENTE PROHIBIDO EL USO DE EMOJIS o íconos decorativos en todo el texto.
- Si el usuario escribió nombres con errores ortográficos, abreviaturas o utilizó nombres de columnas que no existen literalmente (como stock_disponible, sucursal, costo, categoria, descripcion, etc.), interpreta y responde con naturalidad sobre las equivalencias reales consultadas (y si aporta claridad, indica brevemente cómo se homologó el término).
- Si hay cifras de dinero, usa formato de moneda estándar (ej. $1,250.00).
- Si hay márgenes o tasas, exprésalos con dos decimales y símbolo de porcentaje (ej. 35.40%).
- Si hay comparativas o listas de registros, organízalas en tablas Markdown claras y ordenadas.
- Si no hubo registros en el período o filtro indicado, indícalo con precisión y sugiere verificar otro rango o sucursal si aplica.
- Si identificas una anomalía o punto de atención relevante, agrégalo al final bajo el encabezado 'Observación analítica:' de forma concisa.
`;

  try {
    const respuestaFinal = await generateCompletion(
      [
        {
          role: 'system',
          content: 'Eres un asistente financiero y de analítica de negocios experto, preciso y conciso. Nunca uses emojis.',
        },
        { role: 'user', content: promptInterpretacion },
      ],
      0.3,
      'interpret'
    );

    return {
      respuesta: respuestaFinal,
      sqlEjecutado: sqlFinal,
      filas: dbRows.slice(0, 20),
      tiempoMs: Date.now() - inicio,
    };
  } catch (interpretationError: any) {
    console.error(`Error al interpretar respuesta (${params.providerLabel}):`, interpretationError);
    return {
      respuesta: `Obtuve ${dbRows.length} resultados de la base de datos:\n\`\`\`json\n${JSON.stringify(dbRows.slice(0, 20), null, 2)}\n\`\`\``,
      sqlEjecutado: sqlFinal,
      filas: dbRows.slice(0, 20),
      tiempoMs: Date.now() - inicio,
    };
  }
}
