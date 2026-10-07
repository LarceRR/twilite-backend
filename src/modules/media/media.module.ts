import { Module } from '@nestjs/common';

import { BillingModule } from '@/modules/billing/billing.module';
import { IdempotencyService } from '@/shared/idempotency/idempotency.service';

import { ConfirmMediaUploadService } from './application/confirmMediaUpload.service';
import { ReceiveMediaUploadService } from './application/receiveMediaUpload.service';
import { MediaController } from './presentation/controllers/media.controller';

@Module({
  imports: [BillingModule],
  controllers: [MediaController],
  providers: [ConfirmMediaUploadService, ReceiveMediaUploadService, IdempotencyService],
})
export class MediaModule {}
