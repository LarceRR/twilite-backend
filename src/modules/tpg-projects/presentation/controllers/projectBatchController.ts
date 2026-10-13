import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { type AuthenticatedUser, CurrentUser } from '@/shared/decorators/auth.decorators';
import { RequireRbac } from '@/shared/decorators/rbac.decorators';

import { ProjectsService } from '../../application/projects.service';
import { ProjectPurgeService } from '@/modules/tpg-pixel-objects/application/projectPurge.service';

const batchDeleteRequestSchema = z.object({
  projectIds: z.array(z.string().uuid(), { description: 'Project IDs to soft-delete' }),
});

const batchDeleteResponseSchema = z.object({
  deleted: z.number({ description: 'Count of soft-deleted projects' }),
});

const batchPurgeRequestSchema = z.object({
  projectIds: z.array(z.string().uuid(), { description: 'Project IDs to hard-delete' }),
});

const batchPurgeResponseSchema = z.object({
  purged: z.number({ description: 'Count of purged projects' }),
});

class BatchDeleteRequestDto extends createZodDto(batchDeleteRequestSchema) {}
class BatchDeleteResponseDto extends createZodDto(batchDeleteResponseSchema) {}
class BatchPurgeRequestDto extends createZodDto(batchPurgeRequestSchema) {}
class BatchPurgeResponseDto extends createZodDto(batchPurgeResponseSchema) {}

@ApiTags('tpg-projects')
@Controller('tpg/projects')
export class ProjectBatchController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly purge: ProjectPurgeService,
  ) {}

  @Post('batch/delete')
  @RequireRbac('tpg.editor.delete')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Soft delete multiple projects (reassign to Twilite)',
  })
  @ApiOkResponse({ type: BatchDeleteResponseDto })
  async batchDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: BatchDeleteRequestDto,
  ): Promise<BatchDeleteResponseDto> {
    const deleted = await this.projects.batchSoftDelete(user.userId, body.projectIds);
    return { deleted };
  }

  @Post('batch/purge')
  @HttpCode(200)
  @RequireRbac('tpg.editor.purge')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Hard delete multiple projects with all objects and files',
  })
  @ApiOkResponse({ type: BatchPurgeResponseDto })
  async batchPurge(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: BatchPurgeRequestDto,
  ): Promise<BatchPurgeResponseDto> {
    const purged = await this.projects.batchHardDelete(user.userId, body.projectIds);
    return { purged };
  }
}
