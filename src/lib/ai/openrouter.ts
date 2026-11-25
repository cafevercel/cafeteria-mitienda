import { AVAILABLE_MODELS, DEFAULT_MODEL, ModelOption } from './models';
import {
  runAiSqlPipeline,
  AiQueryResult,
  ChatCompletionMessage,
  CompletionStage,
} from './query-pipeline';

export { AVAILABLE_MODELS, DEFAULT_MODEL };
export type { ModelOption };

async function callOpenRouter(
  messages: ChatCompletionMessage[],
  model: string = DEFAULT_MODEL,
  temperature: number = 0.1,
  stage?: CompletionStage
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY_MISSING');
  }

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    temperature,
  };

  if (model.toLowerCase().includes('nemotron')) {
    requestBody.reasoning = { enabled: false };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://mitienda-cuba.com',
        'X-Title': 'Mi Tienda Cafeteria POS',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`El modelo (${model}) tardó demasiado en responder (>25s). Intenta con una pregunta más específica o cambia de modelo.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    const errorMsg = data.error?.message || response.statusText;
    const errorCode = data.error?.code || response.status;

    if (errorCode === 402 || errorMsg.includes('credits') || errorMsg.includes('Insufficient credits')) {
      throw new Error(
        `CRÉDITOS_INSUFICIENTES: El modelo seleccionado (${model}) requiere saldo en OpenRouter. Puedes cambiar al modelo Estándar (sin costo) o recargar créditos en openrouter.ai/settings/credits.`
      );
    }

    if (errorCode === 401 || errorMsg.includes('Unauthorized') || errorMsg.includes('User key not found')) {
      throw new Error('CLAVE_INVÁLIDA: La clave OPENROUTER_API_KEY no es válida.');
    }

    throw new Error(`OpenRouter (${model}): ${errorMsg}`);
  }

  return data.choices?.[0]?.message?.content || '';
}

export async function processBusinessQueryOpenRouter(
  userQuestion: string,
  modelId: string = DEFAULT_MODEL
): Promise<AiQueryResult> {
  const selectedModel = modelId || DEFAULT_MODEL;

  return runAiSqlPipeline({
    userQuestion,
    providerLabel: `OpenRouter (${selectedModel})`,
    generateCompletion: (messages, temperature, stage) =>
      callOpenRouter(messages, selectedModel, temperature, stage),
  });
}
