import { describe, expect, it } from 'vitest';

import { buildInsightPrompt } from '@/modules/ai/domain/services/promptBuilder';
import { StubLlmProvider } from '@/modules/ai/infrastructure/providers/stubLlmProvider';
import { knownKinds } from '@/modules/surface-objects/domain/value-objects/SurfaceObjectKind';
import type { SpaceStatistics } from '@/modules/timeline/domain/entities/Statistics';

const statistics: SpaceStatistics = {
  totalObjects: 12,
  byKind: { [knownKinds.fire]: 9, [knownKinds.cloud]: 3 },
  favorites: 4,
  balance: 0.5,
  firstObjectAt: new Date('2026-01-01T00:00:00.000Z'),
  lastObjectAt: new Date('2026-01-08T00:00:00.000Z'),
};

describe('подготовка запроса к AI', () => {
  it('передаёт агрегаты, а не сырые записи', () => {
    const prompt = buildInsightPrompt({
      spaceType: 'Shared',
      windowDays: 7,
      statistics,
      recentNotes: ['помог с ужином'],
    });

    expect(prompt.user).toContain('Приятных моментов: 9');
    expect(prompt.user).toContain('Сложных: 3');
    expect(prompt.user).toContain('помог с ужином');
    expect(prompt.system).toContain('по-русски');
  });

  it('работает без заметок', () => {
    const prompt = buildInsightPrompt({
      spaceType: 'Personal',
      windowDays: 30,
      statistics,
      recentNotes: [],
    });

    expect(prompt.user).not.toContain('Последние заметки');
  });

  it('заглушка отвечает наблюдением и предложениями', async () => {
    const provider = new StubLlmProvider();
    const completion = await provider.complete(
      buildInsightPrompt({ spaceType: 'Shared', windowDays: 7, statistics, recentNotes: [] }),
    );

    const lines = completion.text.split('\n');

    expect(lines[0]).not.toMatch(/^-/);
    expect(lines.filter((line) => line.startsWith('-')).length).toBeGreaterThan(0);
    expect(completion.model).toBe('stub');
  });
});
