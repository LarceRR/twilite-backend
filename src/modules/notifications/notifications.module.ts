import { Module } from '@nestjs/common';

import { AuthModule } from '@/modules/auth/auth.module';
import { SpacesModule } from '@/modules/spaces/spaces.module';

import { PushNotificationListener } from './application/listeners/pushNotification.listener';
import { CleanupProcessor } from './infrastructure/processors/cleanup.processor';
import { PushProcessor } from './infrastructure/processors/push.processor';
import { RealtimeGateway } from './presentation/gateways/realtime.gateway';

@Module({
  imports: [AuthModule, SpacesModule],
  providers: [RealtimeGateway, PushNotificationListener, PushProcessor, CleanupProcessor],
})
export class NotificationsModule {}
