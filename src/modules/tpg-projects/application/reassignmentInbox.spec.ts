import { describe, expect, it, vi } from 'vitest';

import { REASSIGNMENT_INBOX_TITLE } from '@/shared/constants/twiliteSystemUser';
import { ConflictError } from '@/shared/errors';

import { ProjectsService } from './projects.service';

type ProjectRow = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  isReassignmentInbox: boolean;
  avatarMediaId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function project(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: 'project-1',
    ownerId: 'author-1',
    title: 'Studio',
    description: '',
    isReassignmentInbox: false,
    avatarMediaId: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createService(options: {
  readonly selectResults: unknown[];
  readonly onInsert?: (input: Record<string, unknown>) => unknown;
}) {
  const inserts: Record<string, unknown>[] = [];
  const updates: unknown[] = [];
  let selectIndex = 0;
  const selectBuilder = (result: unknown) => {
    const builder = {
      from: () => builder,
      innerJoin: () => builder,
      leftJoin: () => builder,
      where: () => builder,
      orderBy: () => builder,
      limit: async () => result,
    };
    return builder;
  };
  const db = {
    select: () => selectBuilder(options.selectResults[selectIndex++]),
    insert: () => ({
      values: (input: Record<string, unknown>) => ({
        returning: async () => {
          inserts.push(input);
          if (options.onInsert !== undefined) {
            return options.onInsert(input);
          }
          return [
            project({
              id: 'inbox-1',
              ownerId: String(input['ownerId']),
              title: String(input['title']),
              description: String(input['description'] ?? ''),
              isReassignmentInbox: input['isReassignmentInbox'] === true,
            }),
          ];
        },
      }),
    }),
    update: () => {
      const builder = {
        set: (patch: unknown) => {
          updates.push(patch);
          return builder;
        },
        where: () => Promise.resolve(undefined),
      };
      return builder;
    },
    transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  const storage = { publicUrl: (key: string) => `https://cdn.example/${key}` };
  const service = new ProjectsService(
    db as never,
    storage as never,
    {} as never,
    { warn: vi.fn() } as never,
    {} as never,
  );
  return { service, inserts, updates };
}

describe('ensureReassignmentInbox', () => {
  it('creates Переназначенные for a user who has no inbox yet', async () => {
    const { service, inserts } = createService({
      selectResults: [[], [project({ id: 'inbox-1', isReassignmentInbox: true })]],
    });

    const created = await service.ensureReassignmentInbox('twilite-1');
    const again = await service.ensureReassignmentInbox('twilite-1');

    expect(created).toMatchObject({
      id: 'inbox-1',
      title: REASSIGNMENT_INBOX_TITLE,
      isReassignmentInbox: true,
    });
    expect(inserts).toHaveLength(1);
    expect(again.id).toBe('inbox-1');
  });

  it('reuses the inbox created by a concurrent insert', async () => {
    const existing = project({
      id: 'inbox-raced',
      ownerId: 'twilite-1',
      title: REASSIGNMENT_INBOX_TITLE,
      isReassignmentInbox: true,
    });
    const duplicate = Object.assign(new Error('duplicate key'), { code: '23505' });
    const { service, inserts } = createService({
      selectResults: [[], [existing]],
      onInsert: () => {
        throw duplicate;
      },
    });

    await expect(service.ensureReassignmentInbox('twilite-1')).resolves.toMatchObject({
      id: 'inbox-raced',
    });
    expect(inserts).toHaveLength(1);
  });
});

describe('project transfer', () => {
  it('moves a normal project without creating an inbox', async () => {
    const owned = project();
    const { service, inserts, updates } = createService({
      selectResults: [
        [owned],
        [{ id: 'recipient-1' }],
        [
          {
            project: { ...owned, ownerId: 'recipient-1' },
            ownerDisplayName: 'Recipient',
            objectCount: 2,
            avatarStorageKey: 'avatars/recipient.png',
          },
        ],
      ],
    });

    await service.reassign('author-1', 'project-1', { toUserId: 'recipient-1' });

    expect(inserts).toEqual([]);
    expect(updates[0]).toMatchObject({ ownerId: 'recipient-1' });
    expect(updates[0]).not.toHaveProperty('isReassignmentInbox');
    expect(updates[1]).toMatchObject({ authorUserId: 'recipient-1' });
  });

  it('refuses to transfer or delete the reassignment inbox', async () => {
    const inbox = project({ title: REASSIGNMENT_INBOX_TITLE, isReassignmentInbox: true });
    const transfer = createService({ selectResults: [[inbox]] });
    const removal = createService({ selectResults: [[inbox]] });

    await expect(
      transfer.service.reassign('author-1', 'project-1', { toUserId: 'recipient-1' }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(removal.service.softDelete('author-1', 'project-1')).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(transfer.inserts).toEqual([]);
    expect(removal.updates).toEqual([]);
  });
});
