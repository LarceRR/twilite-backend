import { Module } from '@nestjs/common';

import { RbacModule } from '@/modules/rbac/rbac.module';

import { AvatarService } from './application/avatar.service';
import { USER_REPOSITORY } from './domain/repositories/UserRepository';
import { DrizzleUserRepository } from './infrastructure/repositories/drizzleUserRepository';
import { UsersController } from './presentation/controllers/users.controller';

@Module({
  imports: [RbacModule],
  controllers: [UsersController],
  providers: [
    { provide: USER_REPOSITORY, useClass: DrizzleUserRepository },
    AvatarService,
  ],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}
