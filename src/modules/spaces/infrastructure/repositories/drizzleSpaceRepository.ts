import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, or, sql } from 'drizzle-orm';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { invitations, spaceMembers, spaces, users } from '@/database/schema';
import { toUserId, type UserId } from '@/modules/users/domain/value-objects/UserId';
import { ConflictError, InfrastructureError, NotFoundError } from '@/shared/errors';

import type { Invitation, InvitationId, InvitationStatus } from '../../domain/entities/Invitation';
import type { Space, SpaceMember } from '../../domain/entities/Space';
import type {
  CreateInvitationInput,
  CreateSpaceInput,
  SpaceRepository,
} from '../../domain/repositories/SpaceRepository';
import {
  defaultPermissionsForRole,
  isSpacePermission,
  type SpaceId,
  type SpacePermission,
  type SpaceRole,
  type SpaceType,
} from '../../domain/value-objects/SpacePermission';

type SpaceRow = typeof spaces.$inferSelect;
type MemberRow = typeof spaceMembers.$inferSelect;
type InvitationRow = typeof invitations.$inferSelect;

@Injectable()
export class DrizzleSpaceRepository implements SpaceRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findById(id: SpaceId): Promise<Space | null> {
    const [space] = await this.db.select().from(spaces).where(eq(spaces.id, id)).limit(1);

    if (space === undefined) {
      return null;
    }

    return this.withMembers([space]).then((result) => result[0] ?? null);
  }

  async listForUser(userId: UserId): Promise<readonly Space[]> {
    const rows = await this.db
      .select({ space: spaces })
      .from(spaces)
      .innerJoin(spaceMembers, eq(spaceMembers.spaceId, spaces.id))
      .where(eq(spaceMembers.userId, userId))
      .orderBy(spaces.createdAt);

    return this.withMembers(rows.map((row) => row.space));
  }

  async findPersonalSpace(userId: UserId): Promise<Space | null> {
    const [space] = await this.db
      .select()
      .from(spaces)
      .where(and(eq(spaces.ownerId, userId), eq(spaces.type, 'Personal')))
      .limit(1);

    if (space === undefined) {
      return null;
    }

    return this.withMembers([space]).then((result) => result[0] ?? null);
  }

  /** A space and its owner membership are one unit of work. */
  async create(input: CreateSpaceInput): Promise<Space> {
    const space = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(spaces)
        .values({ type: input.type, title: input.title, ownerId: input.ownerId })
        .returning();

      if (row === undefined) {
        throw new InfrastructureError('Не удалось создать пространство');
      }

      await tx.insert(spaceMembers).values({
        spaceId: row.id,
        userId: input.ownerId,
        role: 'Owner',
        permissions: [...defaultPermissionsForRole('Owner')],
      });

      return row;
    });

    const result = await this.findById(space.id as SpaceId);

    if (result === null) {
      throw new InfrastructureError('Пространство создано, но не найдено');
    }

    return result;
  }

  async addMember(spaceId: SpaceId, member: SpaceMember, expectedVersion: number): Promise<Space> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(spaces)
        .set({ version: sql`${spaces.version} + 1`, updatedAt: new Date() })
        .where(and(eq(spaces.id, spaceId), eq(spaces.version, expectedVersion)))
        .returning({ id: spaces.id });

      if (row === undefined) {
        throw new ConflictError('Пространство было изменено', { spaceId, expectedVersion });
      }

      await tx
        .insert(spaceMembers)
        .values({
          spaceId,
          userId: member.userId,
          role: member.role,
          permissions: [...member.permissions],
        })
        .onConflictDoUpdate({
          target: [spaceMembers.spaceId, spaceMembers.userId],
          set: { role: member.role, permissions: [...member.permissions] },
        });
    });

    return this.requireById(spaceId);
  }

  async removeMember(spaceId: SpaceId, userId: UserId, expectedVersion: number): Promise<Space> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(spaces)
        .set({ version: sql`${spaces.version} + 1`, updatedAt: new Date() })
        .where(and(eq(spaces.id, spaceId), eq(spaces.version, expectedVersion)))
        .returning({ id: spaces.id });

      if (row === undefined) {
        throw new ConflictError('Пространство было изменено', { spaceId, expectedVersion });
      }

      await tx
        .delete(spaceMembers)
        .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, userId)));
    });

    return this.requireById(spaceId);
  }

  async createInvitation(input: CreateInvitationInput): Promise<Invitation> {
    const [row] = await this.db
      .insert(invitations)
      .values({
        spaceId: input.spaceId,
        invitedByUserId: input.invitedByUserId,
        inviteeEmail: input.inviteeEmail,
        inviteeUserId: input.inviteeUserId,
        permissions: [...input.permissions],
      })
      .onConflictDoNothing()
      .returning();

    if (row === undefined) {
      throw new ConflictError('Приглашение уже отправлено', {
        spaceId: input.spaceId,
        email: input.inviteeEmail,
      });
    }

    return toInvitation(row);
  }

  async findInvitationById(id: InvitationId): Promise<Invitation | null> {
    const [row] = await this.db.select().from(invitations).where(eq(invitations.id, id)).limit(1);

    return row === undefined ? null : toInvitation(row);
  }

  async listInvitationsForUser(userId: UserId, email: string): Promise<readonly Invitation[]> {
    const rows = await this.db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.status, 'Pending'),
          or(eq(invitations.inviteeUserId, userId), eq(invitations.inviteeEmail, email)),
        ),
      )
      .orderBy(invitations.createdAt);

    return rows.map(toInvitation);
  }

  async setInvitationStatus(id: InvitationId, status: InvitationStatus): Promise<Invitation> {
    const [row] = await this.db
      .update(invitations)
      .set({ status, respondedAt: new Date() })
      .where(and(eq(invitations.id, id), eq(invitations.status, 'Pending')))
      .returning();

    if (row === undefined) {
      throw new ConflictError('Приглашение уже обработано', { invitationId: id });
    }

    return toInvitation(row);
  }

  private async requireById(spaceId: SpaceId): Promise<Space> {
    const space = await this.findById(spaceId);

    if (space === null) {
      throw new NotFoundError('Пространство не найдено', { spaceId });
    }

    return space;
  }

  /** One extra query for all members, instead of one per space. */
  private async withMembers(rows: readonly SpaceRow[]): Promise<Space[]> {
    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((row) => row.id);
    const memberRows = await this.db
      .select({ member: spaceMembers, displayName: users.displayName, avatarUrl: users.avatarUrl })
      .from(spaceMembers)
      .innerJoin(users, eq(users.id, spaceMembers.userId))
      .where(inArray(spaceMembers.spaceId, ids));

    const bySpace = new Map<string, SpaceMember[]>();

    for (const entry of memberRows) {
      const list = bySpace.get(entry.member.spaceId) ?? [];
      list.push(toMember(entry.member));
      bySpace.set(entry.member.spaceId, list);
    }

    return rows.map((row) => toSpace(row, bySpace.get(row.id) ?? []));
  }
}

function toSpace(row: SpaceRow, members: readonly SpaceMember[]): Space {
  return {
    id: row.id as SpaceId,
    type: row.type as SpaceType,
    title: row.title,
    ownerId: toUserId(row.ownerId),
    members,
    createdAt: row.createdAt,
    version: row.version,
  };
}

function toMember(row: MemberRow): SpaceMember {
  return {
    userId: toUserId(row.userId),
    role: row.role as SpaceRole,
    permissions: row.permissions.filter(isSpacePermission),
    joinedAt: row.joinedAt,
  };
}

function toInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id as InvitationId,
    spaceId: row.spaceId as SpaceId,
    invitedByUserId: toUserId(row.invitedByUserId),
    inviteeEmail: row.inviteeEmail,
    inviteeUserId: row.inviteeUserId === null ? null : toUserId(row.inviteeUserId),
    permissions: row.permissions.filter(isSpacePermission) as readonly SpacePermission[],
    status: row.status as InvitationStatus,
    createdAt: row.createdAt,
    respondedAt: row.respondedAt,
  };
}
