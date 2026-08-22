import { Module } from '@nestjs/common';

import { BillingModule } from '@/modules/billing/billing.module';
import { DrizzleModule } from '@/database/drizzle/drizzle.module';
import { SurfacesModule } from '@/modules/surfaces/surfaces.module';
import { UsersModule } from '@/modules/users/users.module';
import { IdempotencyService } from '@/shared/idempotency/idempotency.service';

import { CreateSpaceHandler } from './application/commands/createSpace.handler';
import { InviteMemberHandler } from './application/commands/inviteMember.handler';
import { RespondToInvitationHandler } from './application/commands/respondToInvitation.handler';
import { ListSpacesHandler } from './application/queries/listSpaces.handler';
import { SpaceAccessService } from './application/services/spaceAccess.service';
import { SPACE_REPOSITORY } from './domain/repositories/SpaceRepository';
import { DrizzleSpaceRepository } from './infrastructure/repositories/drizzleSpaceRepository';
import { SpacesController } from './presentation/controllers/spaces.controller';

@Module({
  imports: [DrizzleModule, UsersModule, SurfacesModule, BillingModule],
  controllers: [SpacesController],
  providers: [
    { provide: SPACE_REPOSITORY, useClass: DrizzleSpaceRepository },
    IdempotencyService,
    SpaceAccessService,
    ListSpacesHandler,
    CreateSpaceHandler,
    InviteMemberHandler,
    RespondToInvitationHandler,
  ],
  exports: [SPACE_REPOSITORY, SpaceAccessService, CreateSpaceHandler],
})
export class SpacesModule {}
