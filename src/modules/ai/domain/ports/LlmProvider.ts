export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export type LlmPrompt = {
  readonly system: string;
  readonly user: string;
};

export type LlmCompletion = {
  readonly text: string;
  readonly model: string;
};

/** A port: the model vendor is an implementation detail of the AI module. */
export interface LlmProvider {
  readonly available: boolean;
  complete(prompt: LlmPrompt): Promise<LlmCompletion>;
}
