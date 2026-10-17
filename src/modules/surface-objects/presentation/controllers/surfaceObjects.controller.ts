import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import type { KindPolicyDto, SurfaceObjectDto } from '@/shared/contracts/surface.contract';
import {
  type AuthenticatedUser,
  CurrentUser,
  RequirePermission,
} from '@/shared/decorators/auth.decorators';
import { ChangeSurfaceObjectStateHandler } from '../../application/commands/changeSurfaceObjectState.handler';
import { CreateSurfaceObjectHandler } from '../../application/commands/createSurfaceObject.handler';
import { UpdateSurfaceObjectHandler } from '../../application/commands/updateSurfaceObject.handler';
import { toSurfaceObjectDto } from '../../application/mappers/surfaceObject.mapper';
import { SurfaceObjectDataHandler } from '../../application/surfaceObjectData.handler';
import type { SurfaceObjectId } from '../../domain/entities/SurfaceObject';
import { allKindPolicies } from '../../domain/value-objects/SurfaceObjectKind';
import {
  ChangeStateDto,
  CreateSurfaceObjectDto,
  DeleteSurfaceObjectQueryDto,
  KindPolicyResponseDto,
  SurfaceObjectResponseDto,
  UpdateSurfaceObjectDto,
} from '../dto/surfaceObject.dto';

class SurfaceMomentStatsResponseDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  good!: number;

  @ApiProperty()
  bad!: number;
}

@ApiTags('surface-objects')
@Controller()
export class SurfaceObjectsController {
  constructor(
    private readonly createHandler: CreateSurfaceObjectHandler,
    private readonly changeStateHandler: ChangeSurfaceObjectStateHandler,
    private readonly updateHandler: UpdateSurfaceObjectHandler,
    private readonly dataHandler: SurfaceObjectDataHandler,
  ) {}

  @Get('surface-object-kinds')
  @ApiOperation({ summary: 'Реестр типов объектов и их политики' })
  @ApiOkResponse({ type: KindPolicyResponseDto, isArray: true })
  kinds(): readonly KindPolicyDto[] {
    return allKindPolicies().map((policy) => ({
      kind: policy.kind,
      valence: policy.valence,
      allowSelfSubject: policy.allowSelfSubject,
      spawnRadius: policy.spawnRadius,
      minSeparation: policy.minSeparation,
    }));
  }

  @Get('spaces/:spaceId/surface-objects/stats')
  @RequirePermission('surfaceObject.create')
  @ApiOperation({ summary: 'Сводка моментов пространства' })
  @ApiOkResponse({ type: SurfaceMomentStatsResponseDto })
  momentStats(
    @CurrentUser() user: AuthenticatedUser,
    @Param('spaceId') spaceId: string,
  ): Promise<SurfaceMomentStatsResponseDto> {
    return this.dataHandler.getMomentStats(spaceId as SpaceId, user.userId);
  }

  @Delete('spaces/:spaceId/surface-objects')
  @RequirePermission('surfaceObject.delete')
  @HttpCode(204)
  @ApiOperation({ summary: 'Удалить моменты и историю личного пространства' })
  @ApiNoContentResponse()
  async clearPersonalSpace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('spaceId') spaceId: string,
  ): Promise<void> {
    await this.dataHandler.clearPersonalSpace(spaceId as SpaceId, user.userId);
  }

  @Post('spaces/:spaceId/surface-objects')
  @RequirePermission('surfaceObject.create')
  @ApiOperation({
    summary: 'Поставить объект на поверхность',
    description: 'Клиент не передаёт координаты: сервер выбирает свободную активную ячейку.',
  })
  @ApiOkResponse({ type: SurfaceObjectResponseDto })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('spaceId') spaceId: string,
    @Body() body: CreateSurfaceObjectDto,
  ): Promise<SurfaceObjectDto> {
    const object = await this.createHandler.execute({
      spaceId: spaceId as SpaceId,
      createdByUserId: user.userId,
      kind: body.kind,
      subjectUserId: (body.subjectUserId as UserId | undefined) ?? null,
      metadata: body.metadata,
      ...(body.pixelObjectId !== undefined ? { pixelObjectId: body.pixelObjectId } : {}),
      idempotencyKey: idempotencyKey ?? null,
    });
    return toSurfaceObjectDto(object);
  }

  @Post('surface-objects/:objectId/state')
  @ApiOperation({ summary: 'Перевести объект в следующее состояние' })
  @ApiOkResponse({ type: SurfaceObjectResponseDto })
  async changeState(
    @CurrentUser() user: AuthenticatedUser,
    @Param('objectId') objectId: string,
    @Body() body: ChangeStateDto,
  ): Promise<SurfaceObjectDto> {
    return toSurfaceObjectDto(
      await this.changeStateHandler.execute({
        objectId: objectId as SurfaceObjectId,
        actorUserId: user.userId,
        transition: body.transition,
        expectedVersion: body.version,
      }),
    );
  }

  @Patch('surface-objects/:objectId')
  @ApiOperation({ summary: 'Изменить заметку или избранное' })
  @ApiOkResponse({ type: SurfaceObjectResponseDto })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('objectId') objectId: string,
    @Body() body: UpdateSurfaceObjectDto,
  ): Promise<SurfaceObjectDto> {
    return toSurfaceObjectDto(
      await this.updateHandler.execute({
        objectId: objectId as SurfaceObjectId,
        actorUserId: user.userId,
        metadata: body.metadata ?? null,
        favorite: body.favorite ?? null,
        expectedVersion: body.version,
      }),
    );
  }

  @Delete('surface-objects/:objectId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Убрать объект с поверхности' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('objectId') objectId: string,
    @Query() query: DeleteSurfaceObjectQueryDto,
  ): Promise<void> {
    await this.updateHandler.delete({
      objectId: objectId as SurfaceObjectId,
      actorUserId: user.userId,
      expectedVersion: query.version,
    });
  }
}
