import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from 'nestjs-pino';

import { toUserId } from '@/modules/users/domain/value-objects/UserId';
import { domainEventNames, type EntitlementsChangedEvent } from '@/shared/events/domainEvents';

import { entitlementKeys } from '../../domain/entities/Entitlements';
import {
  BILLING_REPOSITORY,
  type BillingRepository,
  type SubscriptionState,
} from '../../domain/repositories/BillingRepository';
import { EntitlementsService } from '../services/entitlements.service';

export type ProcessWebhookCommand = {
  readonly externalId: string;
  readonly type: string;
  readonly appUserId: string;
  readonly productId: string;
  readonly store: SubscriptionState['store'];
  readonly expiresAt: string | null;
  readonly payload: unknown;
};

/** Store events that mean "access is active". */
const ACTIVATING = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE']);
const DEACTIVATING = new Set(['EXPIRATION', 'CANCELLATION', 'BILLING_ISSUE']);

@Injectable()
export class ProcessWebhookHandler {
  constructor(
    @Inject(BILLING_REPOSITORY) private readonly billing: BillingRepository,
    private readonly entitlements: EntitlementsService,
    private readonly events: EventEmitter2,
    private readonly logger: Logger,
  ) {}

  async execute(command: ProcessWebhookCommand): Promise<void> {
    // Stores retry aggressively; the same event must not grant access twice.
    const isNew = await this.billing.recordWebhook(command.externalId, command.payload);

    if (!isNew) {
      this.logger.log({ externalId: command.externalId }, 'Повторный webhook пропущен');
      return;
    }

    const userId = toUserId(command.appUserId);
    const expiresAt = command.expiresAt === null ? null : new Date(command.expiresAt);

    if (ACTIVATING.has(command.type)) {
      await this.billing.revokeAll(userId);

      // A purchase grants the full capability set; per-product mapping belongs in
      // a product catalogue once there is more than one plan.
      for (const key of entitlementKeys) {
        await this.billing.grant(userId, { key, source: command.productId, expiresAt });
      }

      await this.billing.upsertSubscription(userId, {
        productId: command.productId,
        store: command.store,
        status: 'active',
        currentPeriodEnd: expiresAt,
      });
    } else if (DEACTIVATING.has(command.type)) {
      await this.billing.revokeAll(userId);
      await this.billing.upsertSubscription(userId, {
        productId: command.productId,
        store: command.store,
        status: command.type === 'BILLING_ISSUE' ? 'grace' : 'expired',
        currentPeriodEnd: expiresAt,
      });
    } else {
      this.logger.log({ type: command.type }, 'Событие биллинга не требует действий');
      return;
    }

    await this.entitlements.invalidate(userId);

    this.events.emit(domainEventNames.entitlementsChanged, {
      userId,
    } satisfies EntitlementsChangedEvent);
  }
}
