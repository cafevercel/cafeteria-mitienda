import { query } from '@/lib/db';
import { SYSTEM_SCHEMA_CONTEXT, validateAndSanitizeSql, AiQueryResult } from './gemini';

// Modelos disponibles para el usuario
export interface ModelOption {
  id: string;
  nombre: string;
  tier: 'free' | 'medium' | 'pro';
  tag: string;
  badgeClass: string;
  descripcion: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    nombre: 'Nemotron 3.5',
    tier: 'free',
    tag: 'Estándar',
    badgeClass: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700',
    descripcion: 'Sin costo. Procesamiento rápido para consultas operativas frecuentes.',
  },
  {
    id: 'deepseek/deepseek-v4.1-flash-1017',
    nombre: 'DeepSeek V4.1 Flash',
    tier: 'medium',
    tag: 'Optimizado',
    badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    descripcion: 'Alta velocidad y eficiencia ($0.036/1M tokens). Precisión optimizada en cálculos y SQL.',
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    nombre: 'Claude 3.5 Sonnet',
    tier: 'pro',
    tag: 'Avanzado',
    badgeClass: 'bg-purple-100 text-purple-900 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300 dark:border-purple-800',
    descripcion: 'Máxima profundidad analítica para correlaciones complejas y auditoría.',
  },
];

export const DEFAULT_MODEL = 'nvidia/nemotron-3.5-lightning:free';

// Función para llamar a OpenRouter mediante fetch
async function callOpenRouter(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  model: string = DEFAULT_MODEL,
  temperature: number = 0.1
) {
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY_MISSING');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://mitienda-cuba.com',
      'X-Title': 'Mi Tienda Cafeteria POS',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    const errorMsg = data.error?.message || response.statusText;
    const errorCode = data.error?.code || response.status;

    if (errorCode === 402 || errorMsg.includes('credits') || errorMsg.includes('Insufficient credits')) {
      throw new Error(`CRÉDITOS_INSUFICIENTES: El modelo seleccionado (${model}) requiere saldo en OpenRouter. Puedes cambiar al modelo Gratuito (NVIDIA Nemotron) o recargar créditos en openrouter.ai/settings/credits.`);
    }

    if (errorCode === 401 || errorMsg.includes('Unauthorized') || errorMsg.includes('User key not found')) {
      throw new Error('CLAVE_INVÁLIDA: La clave OPENROUTER_API_KEY no es válida.');
    }

    throw new Error(`OpenRouter (${model}): ${errorMsg}`);
  }

  const reply = data.choices?.[0]?.message?.content || '';
  return reply;
}

export async function processBusinessQueryOpenRouter(
  userQuestion: string,
  modelId: string = DEFAULT_MODEL
): Promise<AiQueryResult> {
  const inicio = Date.now();
  const selectedModel = modelId || DEFAULT_MODEL;

  const now = new Date();
  const fechaHoy = now.toISOString().split('T')[0];
  const diaSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][now.getDay()];

  // Fase 1: Pedir generar consulta SQL
  const systemPrompt = `
${SYSTEM_SCHEMA_CONTEXT}

INFORMACIÓN TEMPORAL ACTUAL:
- Fecha de hoy: ${fechaHoy} (${diaSemana})
- Año actual: ${now.getFullYear()}
- Mes actual: ${now.getMonth() + 1}
`;

  const userSqlPrompt = `
PREGUNTA DEL USUARIO:
"${userQuestion}"

INSTRUCCIÓN:
Genera ÚNICAMENTE una consulta SQL SELECT en PostgreSQL válida que responda a la pregunta.
Devuelve tu respuesta en formato JSON estrictamente como este:
{
  "sql": "SELECT ...",
  "intencion": "Breve descripción",
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
    const rawSqlReply = await callOpenRouter(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userSqlPrompt },
      ],
      selectedModel,
      0.1
    );

    const jsonMatch = rawSqlReply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedPlan = JSON.parse(jsonMatch[0]);
    } else {
      parsedPlan = JSON.parse(rawSqlReply);
    }
  } catch (err: any) {
    console.error('Error al generar SQL con OpenRouter:', err);
    return {
      respuesta: err.message || 'Lo siento, tuve un problema al interpretar tu pregunta.',
      error: err.message,
      tiempoMs: Date.now() - inicio,
    };
  }

  // Si no requiere SQL (saludos, etc.)
  if (!parsedPlan.requiere_sql || !parsedPlan.sql) {
    return {
      respuesta: parsedPlan.mensaje_directo || '¡Hola! Estoy listo para ayudarte a analizar las ventas, productos, gastos y márgenes de tu tienda. ¿Qué te gustaría consultar hoy?',
      tiempoMs: Date.now() - inicio,
    };
  }

  // Fase 2: Validar y sanitizar SQL
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

  // Fase 3: Ejecutar consulta en PostgreSQL (Neon)
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

  // Fase 4: Redactar respuesta final en lenguaje natural
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
    const respuestaFinal = await callOpenRouter(
      [
        { role: 'system', content: 'Eres un asistente financiero y de analítica de negocios experto y conciso.' },
        { role: 'user', content: promptInterpretacion },
      ],
      selectedModel,
      0.3
    );

    return {
      respuesta: respuestaFinal,
      sqlEjecutado: sqlFinal,
      filas: dbRows.slice(0, 15),
      tiempoMs: Date.now() - inicio,
    };
  } catch (interpretationError: any) {
    console.error('Error interpretando respuesta con OpenRouter:', interpretationError);
    return {
      respuesta: `Obtuve ${dbRows.length} resultados de la base de datos:\n\`\`\`json\n${JSON.stringify(dbRows, null, 2)}\n\`\`\``,
      sqlEjecutado: sqlFinal,
      filas: dbRows,
      tiempoMs: Date.now() - inicio,
    };
  }
}
