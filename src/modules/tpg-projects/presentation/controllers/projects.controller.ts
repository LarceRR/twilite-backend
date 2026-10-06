import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createZodDto } from 'nestjs-zod';
import { uploadTicketSchema } from '@twilite/contracts';

import { catalogListQuerySchema } from '@/modules/tpg-pixel-objects/application/catalogCursor';
import { pixelObjectListSchema } from '@/shared/contracts/pixelObjects.contract';
import {
  createProjectAvatarUploadSchema,
  createProjectSchema,
  projectDtoSchema,
  projectLimitsSchema,
  projectListSchema,
  reassignProjectSchema,
  updateProjectSchema,
} from '@/shared/contracts/projects.contract';
import { type AuthenticatedUser, CurrentUser } from '@/shared/decorators/auth.decorators';
import { RequireAnyRbac, RequireRbac } from '@/shared/decorators/rbac.decorators';

import { ProjectsService } from '../../application/projects.service';

class CreateProjectDtoClass extends createZodDto(createProjectSchema) {}
class UpdateProjectDtoClass extends createZodDto(updateProjectSchema) {}
class ReassignProjectDtoClass extends createZodDto(reassignProjectSchema) {}
class CreateProjectAvatarDtoClass extends createZodDto(createProjectAvatarUploadSchema) {}
class ProjectDtoClass extends createZodDto(projectDtoSchema) {}
class ProjectListDtoClass extends createZodDto(projectListSchema) {}
class ProjectLimitsDtoClass extends createZodDto(projectLimitsSchema) {}
class UploadTicketDtoClass extends createZodDto(uploadTicketSchema) {}
class PixelObjectListDtoClass extends createZodDto(pixelObjectListSchema) {}
class CatalogListQueryDtoClass extends createZodDto(catalogListQuerySchema) {}

@ApiTags('tpg-projects')
@Controller('tpg/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get('limits')
  @RequireAnyRbac('tpg.editor.view', 'tpg.editor.createProject')
  @ApiOperation({ summary: 'Лимиты TPG-проектов' })
  @ApiOkResponse({ type: ProjectLimitsDtoClass })
  getLimits() {
    return this.projects.getLimits();
  }

  @Get('mine')
  @RequireRbac('tpg.editor.view')
  @ApiOperation({ summary: 'Проекты текущего владельца' })
  @ApiOkResponse({ type: ProjectListDtoClass })
  async mine(@CurrentUser() user: AuthenticatedUser) {
    return this.projects.listMine(user.userId);
  }

  @Post()
  @RequireRbac('tpg.editor.createProject')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Создать пустой TPG-проект' })
  @ApiOkResponse({ type: ProjectDtoClass })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreateProjectDtoClass,
  ) {
    return this.projects.create(user.userId, body, idempotencyKey ?? null);
  }

  @Get(':id')
  @RequireRbac('tpg.editor.view')
  @ApiOperation({ summary: 'Проект по id (только владелец)' })
  @ApiOkResponse({ type: ProjectDtoClass })
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.getById(user.userId, id);
  }

  @Get(':id/objects')
  @RequireAnyRbac('tpg.pixelObjects.submit', 'tpg.pixelObjects.create', 'tpg.editor.view')
  @ApiOperation({ summary: 'Объекты проекта' })
  @ApiOkResponse({ type: PixelObjectListDtoClass })
  async listObjects(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CatalogListQueryDtoClass,
  ) {
    return this.projects.listObjects(user.userId, id, catalogListQuerySchema.parse(query));
  }

  @Patch(':id')
  @RequireRbac('tpg.editor.edit')
  @ApiOperation({ summary: 'Переименовать проект или сбросить аватар' })
  @ApiOkResponse({ type: ProjectDtoClass })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProjectDtoClass,
  ) {
    return this.projects.update(user.userId, id, body);
  }

  @Post(':id/avatar')
  @RequireRbac('tpg.editor.edit')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Тикет загрузки аватара проекта' })
  @ApiOkResponse({ type: UploadTicketDtoClass })
  async createAvatarUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateProjectAvatarDtoClass,
  ) {
    return this.projects.createAvatarUpload(user.userId, id, body);
  }

  @Post(':id/avatar/:assetId/confirm')
  @RequireRbac('tpg.editor.edit')
  @ApiOperation({ summary: 'Подтвердить аватар проекта' })
  @ApiOkResponse({ type: ProjectDtoClass })
  async confirmAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
  ) {
    return this.projects.confirmAvatar(user.userId, id, assetId);
  }

  @Post(':id/reassign')
  @RequireRbac('tpg.editor.edit')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Передать проект другому пользователю' })
  @ApiOkResponse({ type: ProjectDtoClass })
  async reassign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReassignProjectDtoClass,
  ) {
    return this.projects.reassign(user.userId, id, body);
  }

  @Delete(':id')
  @RequireRbac('tpg.editor.delete')
  @ApiOperation({ summary: 'Удалить проект (передача пользователю Twilite)' })
  @ApiOkResponse({ type: ProjectDtoClass })
  async softDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.softDelete(user.userId, id);
  }
}
