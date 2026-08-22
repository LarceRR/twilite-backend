import { Inject, Injectable } from '@nestjs/common';

import { cacheKeys, cacheTtl } from '@/infrastructure/redis/cacheKeys';
import { CACHE, type Cache } from '@/infrastructure/redis/redisCache';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import { AuthorizationError } from '@/shared/errors';
import { CLOCK, type Clock } from '@/shared/utils/clock';

import {
  type EntitlementKey,
  type Entitlements,
  freeEntitlements,
} from '../../domain/entities/Entitlements';
import {
  BILLING_REPOSITORY,
  type BillingRepository,
} from '../../domain/repositories/BillingRepository';

/**
 * The only way the rest of the system asks about paid access. Features name the
 * capability they need, so plans and stores can change here alone.
 */
@Injectable()
export class EntitlementsService {
  constructor(
    @Inject(BILLING_REPOSITORY) private readonly billing: BillingRepository,
    @Inject(CACHE) private readonly cache: Cache,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async forUser(userId: UserId): Promise<Entitlements> {
    return this.cache.remember(cacheKeys.entitlements(userId), cacheTtl.entitlements, async () => {
      const granted = await this.billing.listEntitlements(userId, this.clock.now());
      const result: Record<string, boolean> = { ...freeEntitlements };

      for (const entitlement of granted) {
        result[entitlement.key] = true;
      }

      return result as Entitlements;
    });
  }

  async isGranted(userId: UserId, key: EntitlementKey): Promise<boolean> {
    const entitlements = await this.forUser(userId);

    return entitlements[key];
  }

  async assertGranted(userId: UserId, key: EntitlementKey): Promise<void> {
    if (!(await this.isGranted(userId, key))) {
      throw new AuthorizationError('Эта возможность недоступна на текущем тарифе', {
        userId,
        entitlement: key,
      });
    }
  }

  async invalidate(userId: UserId): Promise<void> {
    await this.cache.invalidate(cacheKeys.entitlements(userId));
  }
}
