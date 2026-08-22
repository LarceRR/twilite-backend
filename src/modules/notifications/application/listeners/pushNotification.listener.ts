import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';

import { jobNames, queueNames } from '@/infrastructure/queue/queue.constants';
import {
  domainEventNames,
  type InvitationCreatedEvent,
  type SurfaceObjectCreatedEvent,
} from '@/shared/events/domainEvents';

/**
 * Notifications are queued, never sent inline: a slow push provider must not slow
 * down the request that placed an object.
 */
@Injectable()
export class PushNotificationListener {
  constructor(
    @InjectQueue(queueNames.push) private readonly pushQueue: Queue,
    @InjectQueue(queueNames.email) private readonly emailQueue: Queue,
  ) {}

  @OnEvent(domainEventNames.surfaceObjectCreated)
  async onSurfaceObjectCreated(event: SurfaceObjectCreatedEvent): Promise<void> {
    // The person the object is about hears about it; the author already knows.
    if (event.object.subjectUserId === event.actorUserId) {
      return;
    }

    await this.pushQueue.add(jobNames.sendPush, {
      userId: event.object.subjectUserId,
      kind: event.object.kind,
      spaceId: event.spaceId,
      objectId: event.object.id,
    });
  }

  @OnEvent(domainEventNames.invitationCreated)
  async onInvitationCreated(event: InvitationCreatedEvent): Promise<void> {
    await this.emailQueue.add(jobNames.sendInvitationEmail, {
      invitationId: event.invitationId,
      email: event.inviteeEmail,
      spaceId: event.spaceId,
    });
  }
}
