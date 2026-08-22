import { knownKinds } from '@/modules/surface-objects/domain/value-objects/SurfaceObjectKind';
import type { SpaceStatistics } from '@/modules/timeline/domain/entities/Statistics';

import type { LlmPrompt } from '../ports/LlmProvider';

export type InsightContext = {
  readonly spaceType: 'Personal' | 'Shared';
  readonly windowDays: number;
  readonly statistics: SpaceStatistics;
  readonly recentNotes: readonly string[];
};

const SYSTEM_PROMPT = [
  'Ты помогаешь людям замечать хорошее в отношениях.',
  'Отвечай по-русски, спокойно и коротко, без диагнозов и советов «расстаться».',
  'Формат: первая строка — наблюдение, затем до трёх пунктов с мягкими предложениями.',
].join(' ');

/**
 * The prompt is built from aggregates, not raw rows: the model sees counts,
 * balance and short notes, never anything that is not needed for the observation.
 */
export function buildInsightPrompt(context: InsightContext): LlmPrompt {
  const fire = context.statistics.byKind[knownKinds.fire] ?? 0;
  const cloud = context.statistics.byKind[knownKinds.cloud] ?? 0;

  const lines = [
    `Тип пространства: ${context.spaceType === 'Shared' ? 'общее' : 'личное'}.`,
    `Период: последние ${context.windowDays} дней.`,
    `Приятных моментов: ${fire}. Сложных: ${cloud}.`,
    `Баланс: ${context.statistics.balance.toFixed(2)} (от -1 до 1).`,
    `Отмечено как важное: ${context.statistics.favorites}.`,
  ];

  if (context.recentNotes.length > 0) {
    lines.push('Последние заметки:');
    lines.push(...context.recentNotes.map((note) => `- ${note}`));
  }

  return { system: SYSTEM_PROMPT, user: lines.join('\n') };
}
