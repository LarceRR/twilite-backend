import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
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

import { PixelObjectsService } from '../../application/pixelObjects.service';

class SubmitPixelObjectDtoClass extends createZodDto(submitPixelObjectSchema) {}
class RejectPixelObjectDtoClass extends createZodDto(rejectPixelObjectSchema) {}
class PixelObjectDtoClass extends createZodDto(pixelObjectDtoSchema) {}
class PixelObjectListDtoClass extends createZodDto(pixelObjectListSchema) {}
class PixelObjectMobileDtoClass extends createZodDto(pixelObjectMobileSchema) {}

@ApiTags('pixel-objects')
@Controller('tpg/pixel-objects')
export class PixelObjectsController {
  constructor(private readonly objects: PixelObjectsService) {}

  @Get()
  @RequireRbac('tpg.pixelObjects.readPublished')
  @ApiOperation({ summary: 'Опубликованный каталог пиксельных объектов' })
  @ApiOkResponse({ type: PixelObjectListDtoClass })
  async listPublished() {
    const items = await this.objects.listPublished();
    return { items };
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
  async submit(@CurrentUser() user: AuthenticatedUser, @Body() body: SubmitPixelObjectDtoClass) {
    return this.objects.submit(user.userId, body);
  }

  @Patch(':id')
  @RequireAnyRbac('tpg.pixelObjects.submit', 'tpg.pixelObjects.create')
  @ApiOperation({ summary: 'Исправить отклонённый или опубликованный объект и отправить снова' })
  @ApiOkResponse({ type: PixelObjectDtoClass })
  async resubmit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: SubmitPixelObjectDtoClass,
  ) {
    return this.objects.resubmit(user.userId, id, body);
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
}
