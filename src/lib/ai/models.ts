// Definición de modelos disponibles en OpenRouter (módulo seguro para cliente y servidor)
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
