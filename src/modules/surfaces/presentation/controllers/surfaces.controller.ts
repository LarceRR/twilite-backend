import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import { SurfaceSnapshotResponseDto } from '@/modules/surface-objects/presentation/dto/surfaceObject.dto';
import type { SurfaceSnapshotDto } from '@/shared/contracts/surface.contract';
import {
  type AuthenticatedUser,
  CurrentUser,
  RequirePermission,
} from '@/shared/decorators/auth.decorators';

import { GetSurfaceSnapshotHandler } from '../../application/queries/getSurfaceSnapshot.handler';

@ApiTags('surfaces')
@Controller('spaces/:spaceId/surface')
export class SurfacesController {
  constructor(private readonly snapshot: GetSurfaceSnapshotHandler) {}

  @Get()
  @RequirePermission('surface.view')
  @ApiOperation({
    summary: 'Снимок поверхности',
    description: 'Пустые ячейки не существуют: занятость выводится из списка объектов.',
  })
  @ApiOkResponse({ type: SurfaceSnapshotResponseDto })
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('spaceId') spaceId: string,
  ): Promise<SurfaceSnapshotDto> {
    return this.snapshot.execute(spaceId as SpaceId, user.userId);
  }
}
