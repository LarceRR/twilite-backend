import { Module } from '@nestjs/common';

import { USER_REPOSITORY } from './domain/repositories/UserRepository';
import { DrizzleUserRepository } from './infrastructure/repositories/drizzleUserRepository';
import { UsersController } from './presentation/controllers/users.controller';

/**
 * The port is bound to its adapter here. Everything else injects `USER_REPOSITORY`
 * and stays unaware that Drizzle exists.
 */
@Module({
  controllers: [UsersController],
  providers: [{ provide: USER_REPOSITORY, useClass: DrizzleUserRepository }],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}
