import { Module } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '@/config/env';
import { BillingModule } from '@/modules/billing/billing.module';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { TimelineModule } from '@/modules/timeline/timeline.module';

import { GenerateInsightHandler } from './application/commands/generateInsight.handler';
import { LLM_PROVIDER, type LlmProvider } from './domain/ports/LlmProvider';
import { OpenAiProvider } from './infrastructure/providers/openAiProvider';
import { StubLlmProvider } from './infrastructure/providers/stubLlmProvider';
import { AiController } from './presentation/controllers/ai.controller';

@Module({
  imports: [SpacesModule, TimelineModule, BillingModule],
  controllers: [AiController],
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [APP_CONFIG],
      // Without a key the stub keeps the whole flow usable in development.
      useFactory: (config: AppConfig): LlmProvider =>
        config.ai.enabled ? new OpenAiProvider(config.ai) : new StubLlmProvider(),
    },
    GenerateInsightHandler,
  ],
})
export class AiModule {}
