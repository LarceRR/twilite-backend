import { z } from 'zod';

import { entitlementKeys } from '@/modules/billing/domain/entities/Entitlements';

import { isoDateTime } from './common.contract';

export const entitlementKeySchema = z.enum(entitlementKeys);

export const entitlementsSchema = z.object({
  canUseAI: z.boolean(),
  canCreateMultipleSpaces: z.boolean(),
  canExportTimeline: z.boolean(),
  canUploadVoice: z.boolean(),
});

export const subscriptionSchema = z.object({
  productId: z.string(),
  store: z.enum(['appstore', 'playstore', 'revenuecat', 'none']),
  status: z.enum(['active', 'expired', 'grace', 'canceled', 'none']),
  currentPeriodEnd: isoDateTime.nullable(),
});

export const billingStateSchema = z.object({
  entitlements: entitlementsSchema,
  subscription: subscriptionSchema.nullable(),
});

export type EntitlementsDto = z.infer<typeof entitlementsSchema>;
export type BillingStateDto = z.infer<typeof billingStateSchema>;
