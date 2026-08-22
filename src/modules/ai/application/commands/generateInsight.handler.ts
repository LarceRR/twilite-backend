import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { aiInsights, surfaceObjects } from '@/database/schema';
import { EntitlementsService } from '@/modules/billing/application/services/entitlements.service';
import { SpaceAccessService } from '@/modules/spaces/application/services/spaceAccess.service';
import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import {
  TIMELINE_REPOSITORY,
  type TimelineRepository,
} from '@/modules/timeline/domain/repositories/TimelineRepository';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import type { AiInsightDto } from '@/shared/contracts/ai.contract';
import { InfrastructureError, NotFoundError } from '@/shared/errors';
import { LLM_PROVIDER, type LlmProvider } from '../../domain/ports/LlmProvider';
import { buildInsightPrompt } from '../../domain/services/promptBuilder';

const RECENT_NOTES_LIMIT = 10;

@Injectable()
export class GenerateInsightHandler {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    @Inject(TIMELINE_REPOSITORY) private readonly timeline: TimelineRepository,
    private readonly access: SpaceAccessService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * Permission first, entitlement second, then context — the model is only ever
   * reached for a request that is allowed to make it.
   */
  async execute(params: {
    readonly spaceId: SpaceId;
    readonly userId: UserId;
    readonly windowDays: number;
  }): Promise<AiInsightDto> {
    const space = await this.access.assertPermission(params.spaceId, params.userId, 'space.view');
    await this.entitlements.assertGranted(params.userId, 'canUseAI');

    const statistics = await this.timeline.statistics(params.spaceId);
    const recentNotes = await this.loadRecentNotes(params.spaceId);

    const prompt = buildInsightPrompt({
      spaceType: space.type,
      windowDays: params.windowDays,
      statistics,
      recentNotes,
    });

    const [pending] = await this.db
      .insert(aiInsights)
      .values({
        spaceId: params.spaceId,
        requestedByUserId: params.userId,
        status: 'pending',
        context: { windowDays: params.windowDays, statistics },
      })
      .returning();

    if (pending === undefined) {
      throw new InfrastructureError('Не удалось создать запрос к AI');
    }

    try {
      const completion = await this.llm.complete(prompt);
      const { summary, suggestions } = parseCompletion(completion.text);

      const [ready] = await this.db
        .update(aiInsights)
        .set({
          status: 'ready',
          summary,
          suggestions,
          model: completion.model,
          completedAt: new Date(),
        })
        .where(eq(aiInsights.id, pending.id))
        .returning();

      return toDto(ready ?? pending);
    } catch (error) {
      await this.db
        .update(aiInsights)
        .set({ status: 'failed', completedAt: new Date() })
        .where(eq(aiInsights.id, pending.id));

      throw error;
    }
  }

  async latest(spaceId: SpaceId, userId: UserId): Promise<AiInsightDto> {
    await this.access.assertPermission(spaceId, userId, 'space.view');

    const [row] = await this.db
      .select()
      .from(aiInsights)
      .where(eq(aiInsights.spaceId, spaceId))
      .orderBy(desc(aiInsights.createdAt))
      .limit(1);

    if (row === undefined) {
      throw new NotFoundError('Для этого пространства ещё нет наблюдений', { spaceId });
    }

    return toDto(row);
  }

  private async loadRecentNotes(spaceId: SpaceId): Promise<readonly string[]> {
    const rows = await this.db
      .select({ metadata: surfaceObjects.metadata })
      .from(surfaceObjects)
      .where(eq(surfaceObjects.spaceId, spaceId))
      .orderBy(desc(surfaceObjects.createdAt))
      .limit(RECENT_NOTES_LIMIT);

    return rows
      .map((row) => (row.metadata as { note?: unknown } | null)?.note)
      .filter((note): note is string => typeof note === 'string' && note.trim().length > 0);
  }
}

/** First line is the observation; the bullet list becomes suggestions. */
function parseCompletion(text: string): { summary: string; suggestions: string[] } {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const suggestions = lines
    .filter((line) => line.startsWith('-') || line.startsWith('•'))
    .map((line) => line.replace(/^[-•]\s*/, ''));

  const summary = lines.find((line) => !line.startsWith('-') && !line.startsWith('•')) ?? text;

  return { summary, suggestions };
}

type InsightRow = typeof aiInsights.$inferSelect;

function toDto(row: InsightRow): AiInsightDto {
  return {
    id: row.id,
    spaceId: row.spaceId,
    status: row.status as AiInsightDto['status'],
    summary: row.summary,
    suggestions: Array.isArray(row.suggestions) ? (row.suggestions as string[]) : [],
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}
