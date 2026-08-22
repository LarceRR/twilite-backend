import { Body, Controller, Get, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { APP_CONFIG, type AppConfig } from '@/config/env';
import type { BillingStateDto } from '@/shared/contracts/billing.contract';
import { billingStateSchema } from '@/shared/contracts/billing.contract';
import { type AuthenticatedUser, CurrentUser, Public } from '@/shared/decorators/auth.decorators';
import { AuthorizationError } from '@/shared/errors';

import { ProcessWebhookHandler } from '../../application/commands/processWebhook.handler';
import { EntitlementsService } from '../../application/services/entitlements.service';
import {
  BILLING_REPOSITORY,
  type BillingRepository,
} from '../../domain/repositories/BillingRepository';

class BillingStateResponseDto extends createZodDto(billingStateSchema) {}

const webhookSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  appUserId: z.string().min(1),
  productId: z.string().default(''),
  store: z.enum(['appstore', 'playstore', 'revenuecat', 'none']).default('revenuecat'),
  expiresAt: z.string().nullish(),
});

class BillingWebhookDto extends createZodDto(webhookSchema) {}

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly entitlements: EntitlementsService,
    private readonly webhook: ProcessWebhookHandler,
    @Inject(BILLING_REPOSITORY) private readonly billing: BillingRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('state')
  @ApiOperation({ summary: 'Доступные возможности и текущая подписка' })
  @ApiOkResponse({ type: BillingStateResponseDto })
  async state(@CurrentUser() user: AuthenticatedUser): Promise<BillingStateDto> {
    const [entitlements, subscription] = await Promise.all([
      this.entitlements.forUser(user.userId),
      this.billing.findSubscription(user.userId),
    ]);

    return {
      entitlements,
      subscription:
        subscription === null
          ? null
          : {
              productId: subscription.productId,
              store: subscription.store,
              status: subscription.status,
              currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
            },
    };
  }

  /**
   * Purchases are verified by the store, not by the client: the app never tells
   * the API what it bought, the store webhook does.
   */
  @Public()
  @Post('webhook')
  @HttpCode(202)
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: BillingWebhookDto,
  ): Promise<void> {
    this.assertWebhookSecret(authorization);

    await this.webhook.execute({
      externalId: body.id,
      type: body.type,
      appUserId: body.appUserId,
      productId: body.productId,
      store: body.store,
      expiresAt: body.expiresAt ?? null,
      payload: body,
    });
  }

  private assertWebhookSecret(authorization: string | undefined): void {
    const secret = this.config.billing.webhookSecret;

    if (secret.length === 0) {
      throw new AuthorizationError('Обработка платежных событий не настроена');
    }

    if (authorization !== `Bearer ${secret}`) {
      throw new AuthorizationError('Неверная подпись webhook');
    }
  }
}
