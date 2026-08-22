import { Module } from '@nestjs/common';

import { BillingModule } from '@/modules/billing/billing.module';

import { MediaController } from './presentation/controllers/media.controller';

@Module({
  imports: [BillingModule],
  controllers: [MediaController],
})
export class MediaModule {}
