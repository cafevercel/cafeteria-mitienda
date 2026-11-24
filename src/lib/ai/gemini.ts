import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_SCHEMA_CONTEXT } from './schema-context';
import {
  validateAndSanitizeSql,
  runAiSqlPipeline,
  AiQueryResult,
  ChatCompletionMessage,
} from './query-pipeline';

// Re-exportaciones para compatibilidad con módulos existentes
export { SYSTEM_SCHEMA_CONTEXT, validateAndSanitizeSql };
export type { AiQueryResult };

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

function formatGeminiError(err: any): Error {
  const errMsg = (err?.message || '').toLowerCase();

  if (errMsg.includes('leaked') || errMsg.includes('reported as leaked')) {
    return new Error(
      'Google detectó que tu clave de API fue filtrada/expuesta públicamente y la desactivó por seguridad. Genera una nueva clave en Google AI Studio y colócala en `.env.local`.'
    );
  }
  if (err?.status === 403 || errMsg.includes('403') || errMsg.includes('api_key_invalid')) {
    return new Error(
      'La clave de API de Gemini no es válida o no tiene permisos. Verifica `GEMINI_API_KEY` en `.env.local`.'
    );
  }
  if (err?.status === 429 || errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('resource_exhausted')) {
    return new Error(
      'Se ha alcanzado temporalmente el límite de consultas por minuto de Google. Espera unos segundos y vuelve a intentar.'
    );
  }

  return new Error(err?.message || 'Error al comunicarse con Google Gemini.');
}

export async function processBusinessQuery(
  userQuestion: string,
  _historialPrevio: Array<{ role: 'user' | 'model'; parts: string }> = []
): Promise<AiQueryResult> {
  const genAI = getGenAI();

  if (!genAI) {
    return {
      respuesta:
        'La clave de API de Gemini (`GEMINI_API_KEY`) no está configurada en las variables de entorno (.env). Agrégala para activar el asistente inteligente.',
      error: 'GEMINI_API_KEY_MISSING',
    };
  }

  return runAiSqlPipeline({
    userQuestion,
    providerLabel: 'Gemini',
    generateCompletion: async (messages: ChatCompletionMessage[], temperature: number) => {
      const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
      const conversationText = messages
        .filter((m) => m.role !== 'system')
        .map((m) => (m.role === 'assistant' ? `[Respuesta previa]:\n${m.content}` : m.content))
        .join('\n\n');

      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        ...(systemMsg ? { systemInstruction: systemMsg } : {}),
        generationConfig: { temperature },
      });

      try {
        const result = await model.generateContent(conversationText);
        return result.response.text();
      } catch (err: any) {
        throw formatGeminiError(err);
      }
    },
  });
}
