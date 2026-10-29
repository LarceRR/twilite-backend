import { Module } from '@nestjs/common';

import { AuthModule } from '@/modules/auth/auth.module';

import { CleanupProcessor } from './infrastructure/processors/cleanup.processor';

@Module({
  imports: [AuthModule],
  providers: [CleanupProcessor],
})
export class NotificationsModule {}
