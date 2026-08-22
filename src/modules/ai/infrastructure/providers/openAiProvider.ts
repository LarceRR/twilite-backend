import type { AppConfig } from '@/config/env';
import { InfrastructureError } from '@/shared/errors';

import type { LlmCompletion, LlmPrompt, LlmProvider } from '../../domain/ports/LlmProvider';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const TIMEOUT_MS = 30_000;

type ChatResponse = {
  choices?: readonly { message?: { content?: string } }[];
};

/**
 * Plain fetch instead of a vendor SDK: the request is one POST, and this keeps the
 * provider swappable without a dependency that ships its own transport.
 */
export class OpenAiProvider implements LlmProvider {
  readonly available = true;

  constructor(private readonly config: AppConfig['ai']) {}

  async complete(prompt: LlmPrompt): Promise<LlmCompletion> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.7,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new InfrastructureError('Провайдер AI вернул ошибку', {
          status: response.status,
        });
      }

      const payload = (await response.json()) as ChatResponse;
      const text = payload.choices?.[0]?.message?.content;

      if (typeof text !== 'string' || text.length === 0) {
        throw new InfrastructureError('Провайдер AI вернул пустой ответ');
      }

      return { text, model: this.config.model };
    } catch (error) {
      if (error instanceof InfrastructureError) {
        throw error;
      }

      throw new InfrastructureError('Не удалось обратиться к провайдеру AI', {}, error);
    } finally {
      clearTimeout(timer);
    }
  }
}
