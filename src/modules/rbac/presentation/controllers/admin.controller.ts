import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import {
  adminGroupSchema,
  adminPermissionSchema,
  adminUserDetailSchema,
  adminUserSummarySchema,
  setUserPermissionsRequestSchema,
  updateGroupRequestSchema,
} from '@/shared/contracts/rbac.contract';
import { RequireRbac } from '@/shared/decorators/rbac.decorators';
import { AdminPanelGuard } from '@/shared/guards/adminPanel.guard';
import {
  GroupsService,
  PermissionsAdminService,
  UserRbacService,
} from '../../application/services/rbacAdmin.services';

class UpdateGroupDto extends createZodDto(updateGroupRequestSchema) {}
class SetUserPermissionsDto extends createZodDto(setUserPermissionsRequestSchema) {}
class AdminPermissionDto extends createZodDto(adminPermissionSchema) {}
class AdminGroupDto extends createZodDto(adminGroupSchema) {}
class AdminUserSummaryDto extends createZodDto(adminUserSummarySchema) {}
class AdminUserDetailDto extends createZodDto(adminUserDetailSchema) {}

@ApiTags('admin')
@Controller('admin')
@UseGuards(AdminPanelGuard)
export class AdminPermissionsController {
  constructor(private readonly permissions: PermissionsAdminService) {}

  @Get('permissions')
  @RequireRbac('ta.adminPanel.permissions.view')
  @ApiOperation({ summary: 'Список всех platform-прав' })
  @ApiOkResponse({ type: [AdminPermissionDto] })
  list() {
    return this.permissions.list();
  }
}

@ApiTags('admin')
@Controller('admin')
@UseGuards(AdminPanelGuard)
export class AdminGroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get('groups')
  @RequireRbac('ta.adminPanel.groups.view')
  @ApiOperation({ summary: 'Список групп' })
  @ApiOkResponse({ type: [AdminGroupDto] })
  list() {
    return this.groups.list();
  }

  @Get('groups/:id')
  @RequireRbac('ta.adminPanel.groups.view')
  @ApiOperation({ summary: 'Детали группы' })
  @ApiOkResponse({ type: AdminGroupDto })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const group = await this.groups.getById(id);

    if (group === null) {
      throw new NotFoundException('Группа не найдена');
    }

    return group;
  }

  @Patch('groups/:id')
  @RequireRbac('ta.adminPanel.groups.edit')
  @ApiOperation({ summary: 'Обновить группу и права' })
  @ApiOkResponse({ type: AdminGroupDto })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateGroupDto) {
    const group = await this.groups.update(id, {
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.descriptionEn === undefined ? {} : { descriptionEn: body.descriptionEn }),
      ...(body.descriptionRu === undefined ? {} : { descriptionRu: body.descriptionRu }),
      ...(body.parentGroupId === undefined ? {} : { parentGroupId: body.parentGroupId }),
      ...(body.permissionIds === undefined ? {} : { permissionIds: body.permissionIds }),
    });

    if (group === null) {
      throw new NotFoundException('Группа не найдена');
    }

    return group;
  }
}

@ApiTags('admin')
@Controller('admin')
@UseGuards(AdminPanelGuard)
export class AdminUsersController {
  constructor(private readonly users: UserRbacService) {}

  @Get('users')
  @RequireRbac('ta.adminPanel.users.view')
  @ApiOperation({ summary: 'Список пользователей' })
  @ApiOkResponse({ type: [AdminUserSummaryDto] })
  async list() {
    const users = await this.users.listUsers();
    return users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
    }));
  }

  @Get('users/:id')
  @RequireRbac('ta.adminPanel.users.view')
  @ApiOperation({ summary: 'Пользователь с группами и правами' })
  @ApiOkResponse({ type: AdminUserDetailDto })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.users.getUser(id);

    if (user === null) {
      throw new NotFoundException('Пользователь не найден');
    }

    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      groups: user.groups.map((group) => ({ id: group.id, name: group.name })),
    };
  }

  @Patch('users/:id/permissions')
  @RequireRbac('ta.adminPanel.users.view')
  @ApiOperation({ summary: 'Переопределения прав пользователя' })
  @ApiOkResponse({ type: AdminUserDetailDto })
  async setPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetUserPermissionsDto,
  ) {
    const user = await this.users.setUserOverrides(id, body.overrides);

    if (user === null) {
      throw new NotFoundException('Пользователь не найден');
    }

    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      groups: user.groups.map((group) => ({ id: group.id, name: group.name })),
    };
  }
}
