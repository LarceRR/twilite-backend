import { Module } from '@nestjs/common';

import { ConfigModule } from '@/config/config.module';
import { RedisModule } from '@/infrastructure/redis/redis.module';

import { EffectivePermissionsService } from './application/services/effectivePermissions.service';
import {
  GroupsService,
  PermissionsAdminService,
  RbacBootstrapService,
  UserRbacService,
} from './application/services/rbacAdmin.services';
import { RbacCacheService } from './application/services/rbacCache.service';
import { RBAC_REPOSITORY } from './domain/repositories/RbacRepository';
import { DrizzleRbacRepository } from './infrastructure/repositories/drizzleRbacRepository';
import {
  AdminGroupsController,
  AdminPermissionsController,
  AdminUsersController,
} from './presentation/controllers/admin.controller';
import { RbacSeedService } from './seed/rbacSeed.service';
import { AdminPanelGuard } from '@/shared/guards/adminPanel.guard';

@Module({
  imports: [ConfigModule, RedisModule],
  controllers: [AdminPermissionsController, AdminGroupsController, AdminUsersController],
  providers: [
    { provide: RBAC_REPOSITORY, useClass: DrizzleRbacRepository },
    RbacCacheService,
    EffectivePermissionsService,
    GroupsService,
    PermissionsAdminService,
    UserRbacService,
    RbacSeedService,
    RbacBootstrapService,
    AdminPanelGuard,
  ],
  exports: [
    RBAC_REPOSITORY,
    EffectivePermissionsService,
    UserRbacService,
    RbacCacheService,
    RbacSeedService,
    AdminPanelGuard,
  ],
})
export class RbacModule {}
