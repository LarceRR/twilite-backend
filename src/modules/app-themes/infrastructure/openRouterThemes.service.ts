import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '@/config/env';
import {
  generatedAppThemeSchema,
  type GeneratedAppThemeDto,
} from '@/shared/contracts/appThemes.contract';
import { InfrastructureError, ValidationError } from '@/shared/errors';

import { buildThemeAiSystemPrompt } from '../domain/tokenMeta';

export type FreeModel = {
  readonly id: string;
  readonly name: string;
  readonly contextLength: number | null;
};

type OpenRouterModel = {
  readonly id?: string;
  readonly name?: string;
  readonly context_length?: number;
  readonly pricing?: {
    readonly prompt?: string;
    readonly completion?: string;
  };
};

@Injectable()
export class OpenRouterThemesService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async listFreeModels(): Promise<readonly FreeModel[]> {
    const apiKey = this.apiKey();
    const url =
      'https://openrouter.ai/api/v1/models?max_price=0&max_completion_price=0&limit=100';
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new InfrastructureError(openRouterFailureMessage(response.status, 'list models'), {
        themeCode: 'THEME_AI_UNAVAILABLE',
        status: response.status,
      });
    }

    const body = (await response.json()) as { data?: OpenRouterModel[] };
    const models = body.data ?? [];

    return models
      .filter(isFreeModel)
      .map((model) => ({
        id: model.id!,
        name: model.name ?? model.id!,
        contextLength: model.context_length ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async generateTheme(model: string, prompt: string): Promise<GeneratedAppThemeDto> {
    const apiKey = this.apiKey();
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: [
          { role: 'system', content: buildThemeAiSystemPrompt() },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new InfrastructureError(openRouterFailureMessage(response.status, 'generate theme'), {
        themeCode: 'THEME_AI_UNAVAILABLE',
        status: response.status,
      });
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new ValidationError('OpenRouter returned an empty response', [], {
        themeCode: 'THEME_AI_INVALID_OUTPUT',
      });
    }

    return parseGeneratedTheme(content);
  }

  private apiKey(): string {
    const key = this.config.openRouter.apiKey.trim();
    if (key.length === 0) {
      throw new InfrastructureError(
        'OpenRouter is not configured: set OPENROUTER_API_KEY in Twilite-backend/.env and fully restart the API',
        { themeCode: 'THEME_AI_UNAVAILABLE' },
      );
    }
    return key;
  }
}

function isFreeModel(model: OpenRouterModel): boolean {
  if (typeof model.id !== 'string' || model.id.length === 0) {
    return false;
  }
  const prompt = model.pricing?.prompt ?? '1';
  const completion = model.pricing?.completion ?? '1';
  return (
    (prompt === '0' && completion === '0') ||
    model.id.endsWith(':free') ||
    model.id.includes('/free')
  );
}

export function parseGeneratedTheme(content: string): GeneratedAppThemeDto {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(content));
  } catch {
    throw new ValidationError('OpenRouter returned invalid JSON', [], {
      themeCode: 'THEME_AI_INVALID_OUTPUT',
    });
  }

  const result = generatedAppThemeSchema.safeParse(parsed);
  if (!result.success) {
    throw new ValidationError('Generated theme failed validation', [], {
      themeCode: 'THEME_AI_INVALID_OUTPUT',
      issues: result.error.issues.map((issue) => issue.message),
    });
  }

  return result.data;
}

function openRouterFailureMessage(status: number, action: string): string {
  if (status === 429) {
    return `OpenRouter rate limit (429) on ${action}: wait and retry, or buy ≥$10 credits for higher free-model daily quota (50→1000/day)`;
  }
  if (status === 402) {
    return `OpenRouter insufficient credits (402) on ${action}`;
  }
  return `OpenRouter ${action} failed with HTTP ${status}`;
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}
