import { knownKinds } from '@/modules/surface-objects/domain/value-objects/SurfaceObjectKind';

import type { LlmCompletion, LlmPrompt, LlmProvider } from '../../domain/ports/LlmProvider';

/**
 * Used when no API key is configured. It is deterministic and derived from the
 * same prompt the real provider gets, so the whole AI flow (permissions,
 * entitlements, queue, storage, contract) is exercisable without a vendor.
 */
export class StubLlmProvider implements LlmProvider {
  readonly available = true;

  async complete(prompt: LlmPrompt): Promise<LlmCompletion> {
    const balance = readNumber(prompt.user, /Баланс: (-?\d+\.\d+)/);
    const fire = readNumber(prompt.user, /Приятных моментов: (\d+)/);
    const cloud = readNumber(prompt.user, /Сложных: (\d+)/);

    return {
      text: [
        describeBalance(balance, fire, cloud),
        '- Назовите вслух один момент, который вас поддержал.',
        '- Спросите партнёра, что для него было самым тёплым за неделю.',
        cloud > fire
          ? '- Выберите одну сложную ситуацию и обсудите её без спешки.'
          : '- Сохраните один момент как важный, чтобы вернуться к нему позже.',
      ].join('\n'),
      model: 'stub',
    };
  }
}

function describeBalance(balance: number, fire: number, cloud: number): string {
  if (fire === 0 && cloud === 0) {
    return `На поверхности пока пусто — начните с одного «${knownKinds.fire}».`;
  }

  if (balance > 0.3) {
    return 'В этом периоде тёплых моментов заметно больше — вы хорошо друг друга замечаете.';
  }

  if (balance < -0.3) {
    return 'Сложных моментов пока больше: похоже, накопилось то, что стоит обсудить.';
  }

  return 'Тёплого и сложного примерно поровну — обычное живое равновесие.';
}

function readNumber(text: string, pattern: RegExp): number {
  const match = pattern.exec(text);

  return match?.[1] === undefined ? 0 : Number(match[1]);
}
