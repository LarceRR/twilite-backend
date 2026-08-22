import { Module } from '@nestjs/common';

import { ProcessWebhookHandler } from './application/commands/processWebhook.handler';
import { EntitlementsService } from './application/services/entitlements.service';
import { BILLING_REPOSITORY } from './domain/repositories/BillingRepository';
import { DrizzleBillingRepository } from './infrastructure/repositories/drizzleBillingRepository';
import { BillingController } from './presentation/controllers/billing.controller';

@Module({
  controllers: [BillingController],
  providers: [
    { provide: BILLING_REPOSITORY, useClass: DrizzleBillingRepository },
    EntitlementsService,
    ProcessWebhookHandler,
  ],
  exports: [EntitlementsService, BILLING_REPOSITORY],
})
export class BillingModule {}
