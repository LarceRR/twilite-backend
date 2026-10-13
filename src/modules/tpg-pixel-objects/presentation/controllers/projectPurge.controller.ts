import { Controller, Delete, HttpCode, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { type AuthenticatedUser, CurrentUser } from '@/shared/decorators/auth.decorators';
import { RequireRbac } from '@/shared/decorators/rbac.decorators';

import { ProjectPurgeService } from '../../application/projectPurge.service';

/**
 * Separate from ProjectsController: purge needs PixelObjectsService, and
 * ProjectsModule cannot import PixelObjectsModule (it already imports ProjectsModule).
 */
@ApiTags('tpg-projects')
@Controller('tpg/projects')
export class ProjectPurgeController {
  constructor(private readonly purgeService: ProjectPurgeService) {}

  @Delete(':id/permanent')
  @HttpCode(204)
  @RequireRbac('tpg.editor.purge')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Полностью удалить проект и все его объекты из Twilite App, включая файлы',
  })
  @ApiNoContentResponse()
  async purge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.purgeService.purge(user.userId, id);
  }
}
