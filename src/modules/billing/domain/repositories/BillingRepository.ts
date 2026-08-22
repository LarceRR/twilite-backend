import type { UserId } from '@/modules/users/domain/value-objects/UserId';

import type { EntitlementKey } from '../entities/Entitlements';

export type SubscriptionState = {
  readonly productId: string;
  readonly store: 'appstore' | 'playstore' | 'revenuecat' | 'none';
  readonly status: 'active' | 'expired' | 'grace' | 'canceled' | 'none';
  readonly currentPeriodEnd: Date | null;
};

export type GrantedEntitlement = {
  readonly key: EntitlementKey;
  readonly source: string;
  readonly expiresAt: Date | null;
};

export interface BillingRepository {
  listEntitlements(userId: UserId, now: Date): Promise<readonly GrantedEntitlement[]>;
  findSubscription(userId: UserId): Promise<SubscriptionState | null>;
  grant(userId: UserId, entitlement: GrantedEntitlement): Promise<void>;
  revokeAll(userId: UserId): Promise<void>;
  upsertSubscription(userId: UserId, state: SubscriptionState): Promise<void>;
  /** Webhooks are stored before processing so a replay is detectable. */
  recordWebhook(externalId: string, payload: unknown): Promise<boolean>;
}

export const BILLING_REPOSITORY = Symbol('BILLING_REPOSITORY');
