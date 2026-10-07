import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import {
  appThemeDtoSchema,
  appThemeListSchema,
  freeModelsResponseSchema,
  generateAppThemeSchema,
  generatedAppThemeSchema,
  rejectAppThemeSchema,
  submitAppThemeSchema,
} from '@/shared/contracts/appThemes.contract';
import { type AuthenticatedUser, CurrentUser } from '@/shared/decorators/auth.decorators';
import { RequireRbac } from '@/shared/decorators/rbac.decorators';

import { AppThemesService } from '../../application/appThemes.service';
import { APP_THEME_TOKEN_META } from '../../domain/tokenMeta';
import { OpenRouterThemesService } from '../../infrastructure/openRouterThemes.service';

class SubmitAppThemeDtoClass extends createZodDto(submitAppThemeSchema) {}
class RejectAppThemeDtoClass extends createZodDto(rejectAppThemeSchema) {}
class GenerateAppThemeDtoClass extends createZodDto(generateAppThemeSchema) {}
class AppThemeDtoClass extends createZodDto(appThemeDtoSchema) {}
class AppThemeListDtoClass extends createZodDto(appThemeListSchema) {}
class FreeModelsDtoClass extends createZodDto(freeModelsResponseSchema) {}
class GeneratedAppThemeDtoClass extends createZodDto(generatedAppThemeSchema) {}

@ApiTags('app-themes')
@Controller('app-themes')
export class AppThemesController {
  constructor(
    private readonly themes: AppThemesService,
    private readonly openRouter: OpenRouterThemesService,
  ) {}

  @Get('schema')
  @ApiOperation({ summary: 'Метаданные токенов темы для AI и UI' })
  schema() {
    return {
      tokens: APP_THEME_TOKEN_META,
      sky: { min: 2, max: 5 },
    };
  }

  @Get()
  @ApiOperation({ summary: 'Опубликованные темы' })
  @ApiOkResponse({ type: AppThemeListDtoClass })
  async listPublished() {
    const items = await this.themes.listPublished();
    return { items };
  }

  @Get('mine')
  @RequireRbac('tpg.themes.create')
  @ApiOperation({ summary: 'Темы текущего автора' })
  @ApiOkResponse({ type: AppThemeListDtoClass })
  async mine(@CurrentUser() user: AuthenticatedUser) {
    const items = await this.themes.listMine(user.userId);
    return { items };
  }

  @Get('moderation')
  @RequireRbac('tpg.themes.moderate')
  @ApiOperation({ summary: 'Очередь модерации' })
  @ApiOkResponse({ type: AppThemeListDtoClass })
  async moderation() {
    const items = await this.themes.listPending();
    return { items };
  }

  @Get('ai/models')
  @RequireRbac('tpg.themes.create')
  @ApiOperation({ summary: 'Бесплатные модели OpenRouter' })
  @ApiOkResponse({ type: FreeModelsDtoClass })
  async models() {
    const items = await this.openRouter.listFreeModels();
    return { items };
  }

  @Post('ai/generate')
  @RequireRbac('tpg.themes.create')
  @ApiOperation({ summary: 'Сгенерировать черновик темы' })
  @ApiOkResponse({ type: GeneratedAppThemeDtoClass })
  async generate(@Body() body: GenerateAppThemeDtoClass) {
    return this.openRouter.generateTheme(body.model, body.prompt);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Опубликованная тема' })
  @ApiOkResponse({ type: AppThemeDtoClass })
  async getPublished(@Param('id') id: string) {
    return this.themes.getPublished(id);
  }

  @Post()
  @RequireRbac('tpg.themes.create')
  @ApiOperation({ summary: 'Отправить тему на модерацию' })
  @ApiOkResponse({ type: AppThemeDtoClass })
  async submit(@CurrentUser() user: AuthenticatedUser, @Body() body: SubmitAppThemeDtoClass) {
    return this.themes.submit(user.userId, body);
  }

  @Patch(':id')
  @RequireRbac('tpg.themes.create')
  @ApiOperation({ summary: 'Исправить отклонённую тему и снова отправить' })
  @ApiOkResponse({ type: AppThemeDtoClass })
  async resubmit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: SubmitAppThemeDtoClass,
  ) {
    return this.themes.resubmit(user.userId, id, body);
  }

  @Delete(':id')
  @RequireRbac('tpg.themes.create')
  @ApiOperation({ summary: 'Удалить свою pending/rejected тему' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.themes.deleteOwned(user.userId, id);
    return { ok: true };
  }

  @Post(':id/publish')
  @RequireRbac('tpg.themes.moderate')
  @ApiOperation({ summary: 'Опубликовать тему' })
  @ApiOkResponse({ type: AppThemeDtoClass })
  async publish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.themes.publish(user.userId, id);
  }

  @Post(':id/reject')
  @RequireRbac('tpg.themes.moderate')
  @ApiOperation({ summary: 'Отклонить тему' })
  @ApiOkResponse({ type: AppThemeDtoClass })
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: RejectAppThemeDtoClass,
  ) {
    return this.themes.reject(user.userId, id, body.comment);
  }
}
