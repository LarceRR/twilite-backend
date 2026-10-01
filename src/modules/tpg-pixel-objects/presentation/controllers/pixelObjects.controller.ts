import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { pixelObjectLimitsSchema } from '@twilite/contracts';
import { createZodDto } from 'nestjs-zod';

import {
  pixelObjectDtoSchema,
  pixelObjectListSchema,
  pixelObjectMobileSchema,
  rejectPixelObjectSchema,
  submitPixelObjectSchema,
} from '@/shared/contracts/pixelObjects.contract';
import { type AuthenticatedUser, CurrentUser } from '@/shared/decorators/auth.decorators';
import { RequireAnyRbac, RequireRbac } from '@/shared/decorators/rbac.decorators';

import { catalogListQuerySchema } from '../../application/catalogCursor';
import { MediaGcService } from '../../application/mediaGc.service';
import { PixelObjectsService } from '../../application/pixelObjects.service';

class SubmitPixelObjectDtoClass extends createZodDto(submitPixelObjectSchema) {}
class RejectPixelObjectDtoClass extends createZodDto(rejectPixelObjectSchema) {}
class PixelObjectDtoClass extends createZodDto(pixelObjectDtoSchema) {}
class PixelObjectListDtoClass extends createZodDto(pixelObjectListSchema) {}
class PixelObjectMobileDtoClass extends createZodDto(pixelObjectMobileSchema) {}
class PixelObjectLimitsDtoClass extends createZodDto(pixelObjectLimitsSchema) {}
class CatalogListQueryDtoClass extends createZodDto(catalogListQuerySchema) {}

@ApiTags('pixel-objects')
@Controller('tpg/pixel-objects')
export class PixelObjectsController {
  constructor(
    private readonly objects: PixelObjectsService,
    private readonly mediaGc: MediaGcService,
  ) {}

  @Get()
  @RequireRbac('tpg.pixelObjects.readPublished')
  @ApiOperation({ summary: 'Опубликованный каталог пиксельных объектов' })
  @ApiOkResponse({ type: PixelObjectListDtoClass })
  async listPublished(@Query() query: CatalogListQueryDtoClass) {
    return this.objects.listPublished(catalogListQuerySchema.parse(query));
  }

  @Get('limits')
  @RequireAnyRbac(
    'tpg.pixelObjects.readPublished',
    'tpg.pixelObjects.submit',
    'tpg.pixelObjects.create',
  )
  @ApiOperation({ summary: 'Публичные лимиты TPO (canvas, frames, sheet bytes)' })
  @ApiOkResponse({ type: PixelObjectLimitsDtoClass })
  getLimits() {
    return this.objects.getLimits();
  }

  @Get('mine')
  @RequireAnyRbac('tpg.pixelObjects.submit', 'tpg.pixelObjects.create')
  @ApiOperation({ summary: 'Отправки текущего автора' })
  @ApiOkResponse({ type: PixelObjectListDtoClass })
  async mine(@CurrentUser() user: AuthenticatedUser) {
    const items = await this.objects.listMine(user.userId);
    return { items };
  }

  @Get('moderation')
  @RequireRbac('tpg.pixelObjects.moderate')
  @ApiOperation({ summary: 'Очередь модерации пиксельных объектов' })
  @ApiOkResponse({ type: PixelObjectListDtoClass })
  async moderation() {
    const items = await this.objects.listPending();
    return { items };
  }

  @Get(':id/mobile')
  @RequireRbac('tpg.pixelObjects.readPublished')
  @ApiOperation({ summary: 'DTO для мобильного плеера: sheet URL и default loop' })
  @ApiOkResponse({ type: PixelObjectMobileDtoClass })
  async mobile(@Param('id') id: string) {
    return this.objects.getMobile(id);
  }

  @Get(':id')
  @RequireRbac('tpg.pixelObjects.readPublished')
  @ApiOperation({ summary: 'Опубликованный пиксельный объект' })
  @ApiOkResponse({ type: PixelObjectDtoClass })
  async getPublished(@Param('id') id: string) {
    return this.objects.getPublished(id);
  }

  @Post()
  @RequireAnyRbac('tpg.pixelObjects.submit', 'tpg.pixelObjects.create')
  @ApiOperation({ summary: 'Отправить пиксельный объект на модерацию' })
  @ApiOkResponse({ type: PixelObjectDtoClass })
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: SubmitPixelObjectDtoClass,
  ) {
    return this.objects.submit(user.userId, body, idempotencyKey ?? null);
  }

  @Patch(':id')
  @RequireAnyRbac('tpg.pixelObjects.submit', 'tpg.pixelObjects.create')
  @ApiOperation({ summary: 'Исправить отклонённый или опубликованный объект и отправить снова' })
  @ApiOkResponse({ type: PixelObjectDtoClass })
  async resubmit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: SubmitPixelObjectDtoClass,
  ) {
    return this.objects.resubmit(user.userId, id, body, idempotencyKey ?? null);
  }

  @Post(':id/archive')
  @RequireAnyRbac(
    'tpg.pixelObjects.submit',
    'tpg.pixelObjects.create',
    'tpg.pixelObjects.moderate',
  )
  @ApiOperation({ summary: 'Архивировать объект (каталог скрывает, размещения остаются)' })
  @ApiOkResponse({ type: PixelObjectDtoClass })
  async archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.objects.archive(user.userId, id);
  }

  @Post(':id/publish')
  @RequireRbac('tpg.pixelObjects.moderate')
  @ApiOperation({ summary: 'Опубликовать пиксельный объект' })
  @ApiOkResponse({ type: PixelObjectDtoClass })
  async publish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.objects.publish(user.userId, id);
  }

  @Post(':id/reject')
  @RequireRbac('tpg.pixelObjects.moderate')
  @ApiOperation({ summary: 'Отклонить пиксельный объект' })
  @ApiOkResponse({ type: PixelObjectDtoClass })
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: RejectPixelObjectDtoClass,
  ) {
    return this.objects.reject(user.userId, id, body.comment);
  }

  @Post('admin/media-gc')
  @RequireRbac('tpg.pixelObjects.moderate')
  @ApiOperation({ summary: 'GC неподтверждённых uploads и orphan pixel-sheets (dry-run по умолчанию)' })
  async mediaGc(@Query('dryRun') dryRun = 'true') {
    return this.mediaGc.run({ dryRun: dryRun !== 'false' });
  }
}
