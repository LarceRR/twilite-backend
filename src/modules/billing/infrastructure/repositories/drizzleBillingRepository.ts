import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, or } from 'drizzle-orm';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { billingWebhookEvents, entitlements, subscriptions } from '@/database/schema';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';

import { isEntitlementKey } from '../../domain/entities/Entitlements';
import type {
  BillingRepository,
  GrantedEntitlement,
  SubscriptionState,
} from '../../domain/repositories/BillingRepository';

@Injectable()
export class DrizzleBillingRepository implements BillingRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async listEntitlements(userId: UserId, now: Date): Promise<readonly GrantedEntitlement[]> {
    const rows = await this.db
      .select()
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, userId),
          // A null expiry means a lifetime grant.
          or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, now)),
        ),
      );

    return rows
      .filter((row) => isEntitlementKey(row.key))
      .map((row) => ({
        key: row.key as GrantedEntitlement['key'],
        source: row.source,
        expiresAt: row.expiresAt,
      }));
  }

  async findSubscription(userId: UserId): Promise<SubscriptionState | null> {
    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return {
      productId: row.productId,
      store: row.store as SubscriptionState['store'],
      status: row.status as SubscriptionState['status'],
      currentPeriodEnd: row.currentPeriodEnd,
    };
  }

  async grant(userId: UserId, entitlement: GrantedEntitlement): Promise<void> {
    await this.db.insert(entitlements).values({
      userId,
      key: entitlement.key,
      source: entitlement.source,
      expiresAt: entitlement.expiresAt,
    });
  }

  async revokeAll(userId: UserId): Promise<void> {
    await this.db.delete(entitlements).where(eq(entitlements.userId, userId));
  }

  async upsertSubscription(userId: UserId, state: SubscriptionState): Promise<void> {
    const existing = await this.findSubscription(userId);

    if (existing === null) {
      await this.db.insert(subscriptions).values({
        userId,
        productId: state.productId,
        store: state.store,
        status: state.status,
        currentPeriodEnd: state.currentPeriodEnd,
      });
      return;
    }

    await this.db
      .update(subscriptions)
      .set({
        productId: state.productId,
        store: state.store,
        status: state.status,
        currentPeriodEnd: state.currentPeriodEnd,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId));
  }

  /** Returns false when this webhook has already been recorded. */
  async recordWebhook(externalId: string, payload: unknown): Promise<boolean> {
    const rows = await this.db
      .insert(billingWebhookEvents)
      .values({ externalId, payload })
      .onConflictDoNothing()
      .returning({ id: billingWebhookEvents.id });

    return rows.length > 0;
  }
}
