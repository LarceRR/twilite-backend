import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cache } from '@/infrastructure/redis/redisCache';
import type { SpaceAccessService } from '@/modules/spaces/application/services/spaceAccess.service';
import type { Space } from '@/modules/spaces/domain/entities/Space';
import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';

import type { SurfaceObjectRepository } from '../domain/repositories/SurfaceObjectRepository';
import { SurfaceObjectDataHandler } from './surfaceObjectData.handler';

const spaceId = 'space-1' as SpaceId;
const userId = 'user-1' as UserId;

describe('SurfaceObjectDataHandler', () => {
  const countBySpace = vi.fn();
  const clearSpaceData = vi.fn();
  const assertPermission = vi.fn();
  const requireSpace = vi.fn();
  const invalidate = vi.fn();
  const invalidatePrefix = vi.fn();
  const emit = vi.fn();
  const personalSpace = {
    id: spaceId,
    type: 'Personal',
    ownerId: userId,
  } as Space;
  const repository = { countBySpace, clearSpaceData } as unknown as SurfaceObjectRepository;
  const access = { assertPermission, requireSpace, invalidate } as unknown as SpaceAccessService;
  const cache = { invalidatePrefix } as unknown as Cache;
  const events = { emit } as never;
  let handler: SurfaceObjectDataHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    assertPermission.mockResolvedValue(personalSpace);
    requireSpace.mockResolvedValue({ ...personalSpace, members: [{ userId }] });
    countBySpace.mockResolvedValue([
      { kind: 'Fire', count: 2 },
      { kind: 'Cloud', count: 3 },
      { kind: 'Unknown', count: 4 },
    ]);
    handler = new SurfaceObjectDataHandler(repository, access, cache, events);
  });

  it('aggregates total, positive, and negative moment counts by kind policy', async () => {
    await expect(handler.getMomentStats(spaceId, userId)).resolves.toEqual({
      total: 9,
      good: 2,
      bad: 3,
    });
    expect(requireSpace).toHaveBeenCalledWith(spaceId);
  });

  it('clears personal space data and invalidates related caches', async () => {
    await handler.clearPersonalSpace(spaceId, userId);

    expect(clearSpaceData).toHaveBeenCalledWith(spaceId, userId);
    expect(invalidate).toHaveBeenCalledWith(spaceId);
    expect(invalidatePrefix).toHaveBeenCalledWith(`timeline:${spaceId}`);
    expect(emit).toHaveBeenCalledWith('surface.cleared', { spaceId });
  });

  it('rejects stats requests from non-members', async () => {
    requireSpace.mockResolvedValue({ ...personalSpace, members: [] });

    await expect(handler.getMomentStats(spaceId, userId)).rejects.toThrow(
      'Недостаточно прав в этом пространстве',
    );
    expect(countBySpace).not.toHaveBeenCalled();
  });

  it('rejects clearing a shared space', async () => {
    assertPermission.mockResolvedValue({ ...personalSpace, type: 'Shared' });

    await expect(handler.clearPersonalSpace(spaceId, userId)).rejects.toThrow(
      'Можно очистить только своё личное пространство',
    );
    expect(clearSpaceData).not.toHaveBeenCalled();
  });
});
