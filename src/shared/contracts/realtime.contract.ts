import { z } from 'zod';
import { uuidSchema } from './common.contract';
import { surfaceObjectSchema } from './surface.contract';
import { timelineEventSchema } from './timeline.contract';

export const realtimeChannels = ['scene', 'timeline', 'notifications', 'presence'] as const;

export type RealtimeChannel = (typeof realtimeChannels)[number];

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('subscribe'), spaceId: uuidSchema }),
  z.object({ type: z.literal('unsubscribe'), spaceId: uuidSchema }),
  z.object({ type: z.literal('ping') }),
]);

/**
 * Realtime is a hint, not the source of truth: every message carries the new
 * `version` so a client can tell whether it already has that state, and after a
 * reconnect the client re-syncs over HTTP.
 */
export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pong') }),
  z.object({ type: z.literal('subscribed'), spaceId: uuidSchema }),
  z.object({
    type: z.literal('surfaceObject.created'),
    spaceId: uuidSchema,
    object: surfaceObjectSchema,
  }),
  z.object({
    type: z.literal('surfaceObject.updated'),
    spaceId: uuidSchema,
    object: surfaceObjectSchema,
  }),
  z.object({
    type: z.literal('surfaceObject.deleted'),
    spaceId: uuidSchema,
    objectId: uuidSchema,
  }),
  z.object({
    type: z.literal('timeline.appended'),
    spaceId: uuidSchema,
    event: timelineEventSchema,
  }),
  z.object({
    type: z.literal('presence.changed'),
    spaceId: uuidSchema,
    userIds: z.array(uuidSchema),
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
  }),
]);

export type RealtimeClientMessage = z.infer<typeof clientMessageSchema>;
export type RealtimeServerMessage = z.infer<typeof serverMessageSchema>;
