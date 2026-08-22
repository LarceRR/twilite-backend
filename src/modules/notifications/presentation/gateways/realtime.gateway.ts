import { Injectable, type OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Logger } from 'nestjs-pino';
import type { WebSocket } from 'ws';

import { TokenService } from '@/modules/auth/application/services/token.service';
import { SpaceAccessService } from '@/modules/spaces/application/services/spaceAccess.service';
import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import {
  clientMessageSchema,
  type RealtimeServerMessage,
} from '@/shared/contracts/realtime.contract';
import {
  domainEventNames,
  type SurfaceObjectCreatedEvent,
  type SurfaceObjectDeletedEvent,
  type SurfaceObjectStateChangedEvent,
  type SurfaceObjectUpdatedEvent,
  type TimelineAppendedEvent,
} from '@/shared/events/domainEvents';

type Connection = {
  readonly socket: WebSocket;
  readonly userId: UserId;
  readonly spaces: Set<SpaceId>;
};

/**
 * Realtime is a delivery channel, never the source of truth: a client that missed
 * a message re-syncs over HTTP. Subscriptions are checked against space
 * permissions, so a socket cannot listen to a space it has no access to.
 */
@Injectable()
@WebSocketGateway({ path: '/realtime' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  private readonly connections = new Map<WebSocket, Connection>();

  constructor(
    private readonly tokens: TokenService,
    private readonly access: SpaceAccessService,
    private readonly logger: Logger,
  ) {}

  onModuleInit(): void {
    this.logger.log('Realtime gateway готов на /realtime');
  }

  async handleConnection(socket: WebSocket, request: { url?: string }): Promise<void> {
    const token = extractToken(request.url);

    if (token === null) {
      this.send(socket, { type: 'error', message: 'Требуется токен доступа' });
      socket.close();
      return;
    }

    try {
      const payload = await this.tokens.verifyAccessToken(token);
      this.connections.set(socket, {
        socket,
        userId: payload.userId,
        spaces: new Set<SpaceId>(),
      });

      socket.on('message', (raw: Buffer | string) => {
        void this.handleMessage(socket, raw);
      });
    } catch {
      this.send(socket, { type: 'error', message: 'Токен недействителен' });
      socket.close();
    }
  }

  handleDisconnect(socket: WebSocket): void {
    this.connections.delete(socket);
  }

  @OnEvent(domainEventNames.surfaceObjectCreated)
  onObjectCreated(event: SurfaceObjectCreatedEvent): void {
    this.broadcast(event.spaceId as SpaceId, {
      type: 'surfaceObject.created',
      spaceId: event.spaceId,
      object: event.object,
    });
  }

  @OnEvent(domainEventNames.surfaceObjectStateChanged)
  onObjectStateChanged(event: SurfaceObjectStateChangedEvent): void {
    this.broadcast(event.spaceId as SpaceId, {
      type: 'surfaceObject.updated',
      spaceId: event.spaceId,
      object: event.object,
    });
  }

  @OnEvent(domainEventNames.surfaceObjectUpdated)
  onObjectUpdated(event: SurfaceObjectUpdatedEvent): void {
    this.broadcast(event.spaceId as SpaceId, {
      type: 'surfaceObject.updated',
      spaceId: event.spaceId,
      object: event.object,
    });
  }

  @OnEvent(domainEventNames.surfaceObjectDeleted)
  onObjectDeleted(event: SurfaceObjectDeletedEvent): void {
    this.broadcast(event.spaceId as SpaceId, {
      type: 'surfaceObject.deleted',
      spaceId: event.spaceId,
      objectId: event.objectId,
    });
  }

  @OnEvent(domainEventNames.timelineAppended)
  onTimelineAppended(event: TimelineAppendedEvent): void {
    this.broadcast(event.spaceId as SpaceId, {
      type: 'timeline.appended',
      spaceId: event.spaceId,
      event: event.event,
    });
  }

  private async handleMessage(socket: WebSocket, raw: Buffer | string): Promise<void> {
    const connection = this.connections.get(socket);

    if (connection === undefined) {
      return;
    }

    const parsed = clientMessageSchema.safeParse(safeJson(raw.toString()));

    if (!parsed.success) {
      this.send(socket, { type: 'error', message: 'Некорректное сообщение' });
      return;
    }

    const message = parsed.data;

    if (message.type === 'ping') {
      this.send(socket, { type: 'pong' });
      return;
    }

    if (message.type === 'unsubscribe') {
      connection.spaces.delete(message.spaceId as SpaceId);
      return;
    }

    try {
      await this.access.assertPermission(
        message.spaceId as SpaceId,
        connection.userId,
        'space.view',
      );

      connection.spaces.add(message.spaceId as SpaceId);
      this.send(socket, { type: 'subscribed', spaceId: message.spaceId });
      this.publishPresence(message.spaceId as SpaceId);
    } catch {
      this.send(socket, { type: 'error', message: 'Нет доступа к пространству' });
    }
  }

  private publishPresence(spaceId: SpaceId): void {
    const userIds = [...this.connections.values()]
      .filter((connection) => connection.spaces.has(spaceId))
      .map((connection) => connection.userId);

    this.broadcast(spaceId, {
      type: 'presence.changed',
      spaceId,
      userIds: [...new Set(userIds)],
    });
  }

  private broadcast(spaceId: SpaceId, message: RealtimeServerMessage): void {
    for (const connection of this.connections.values()) {
      if (connection.spaces.has(spaceId)) {
        this.send(connection.socket, message);
      }
    }
  }

  private send(socket: WebSocket, message: RealtimeServerMessage): void {
    // readyState 1 === OPEN; writing to a closing socket throws.
    if (socket.readyState === 1) {
      socket.send(JSON.stringify(message));
    }
  }
}

function extractToken(url: string | undefined): string | null {
  if (url === undefined) {
    return null;
  }

  const token = new URL(url, 'http://localhost').searchParams.get('token');

  return token === null || token.length === 0 ? null : token;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
