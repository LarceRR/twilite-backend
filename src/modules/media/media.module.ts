import { Module } from '@nestjs/common';

import { BillingModule } from '@/modules/billing/billing.module';

import { ConfirmMediaUploadService } from './application/confirmMediaUpload.service';
import { MediaController } from './presentation/controllers/media.controller';

@Module({
  imports: [BillingModule],
  controllers: [MediaController],
  providers: [ConfirmMediaUploadService],
})
export class MediaModule {}
