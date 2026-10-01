import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainError, NotFoundError } from '@/shared/errors';
import { ErrorCode } from '@/shared/errors/AppError';

import { ConfirmMediaUploadService } from './confirmMediaUpload.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const ASSET_ID = '33333333-3333-4333-8333-333333333333';

function pendingRow(overrides?: Record<string, unknown>) {
  return {
    id: ASSET_ID,
    ownerId: OWNER,
    spaceId: null,
    kind: 'pixel-sheet',
    storageKey: `${OWNER}/pixel-sheet/${ASSET_ID}`,
    contentType: 'image/png',
    byteSize: 128,
    status: 'pending',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    confirmedAt: null,
    ...overrides,
  };
}

describe('ConfirmMediaUploadService', () => {
  const selectLimit = vi.fn();
  const selectWhere = vi.fn(() => ({ limit: selectLimit }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const updateWhere = vi.fn();
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const db = {
    select: vi.fn(() => ({ from: selectFrom })),
    update: vi.fn(() => ({ set: updateSet })),
  };

  const storage = {
    enabled: true,
    publicUrl: vi.fn((key: string) => `https://cdn.example/${key}`),
    createUploadUrl: vi.fn(),
    headObject: vi.fn(),
    getObject: vi.fn(),
    delete: vi.fn(),
  };

  const logger = { warn: vi.fn(), log: vi.fn(), error: vi.fn() };

  let service: ConfirmMediaUploadService;

  beforeEach(() => {
    vi.clearAllMocks();
    selectWhere.mockImplementation(() => ({ limit: selectLimit }));
    selectFrom.mockImplementation(() => ({ where: selectWhere }));
    db.select.mockImplementation(() => ({ from: selectFrom }));
    updateSet.mockImplementation(() => ({ where: updateWhere }));
    db.update.mockImplementation(() => ({ set: updateSet }));
    storage.headObject.mockResolvedValue({
      exists: true,
      contentLength: 128,
      contentType: 'image/png',
    });
    storage.delete.mockResolvedValue(undefined);
    service = new ConfirmMediaUploadService(db as never, storage as never, logger as never);
  });

  it('confirms an owned pending asset after HEAD verification', async () => {
    const pending = pendingRow();
    const ready = pendingRow({
      status: 'ready',
      confirmedAt: new Date('2026-01-01T00:01:00.000Z'),
    });
    selectLimit.mockResolvedValueOnce([pending]);
    updateWhere.mockReturnValue({ returning: vi.fn().mockResolvedValue([ready]) });

    const dto = await service.confirm(OWNER, ASSET_ID);

    expect(dto.status).toBe('ready');
    expect(dto.id).toBe(ASSET_ID);
    expect(storage.headObject).toHaveBeenCalledWith(pending.storageKey);
  });

  it('returns 404 semantics for a foreign asset (no leak)', async () => {
    selectLimit.mockResolvedValueOnce([]);

    await expect(service.confirm(OTHER, ASSET_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(db.update).not.toHaveBeenCalled();
    expect(storage.headObject).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing asset', async () => {
    selectLimit.mockResolvedValueOnce([]);

    await expect(service.confirm(OWNER, ASSET_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('is idempotent for an already ready owned asset', async () => {
    const ready = pendingRow({
      status: 'ready',
      confirmedAt: new Date('2026-01-01T00:01:00.000Z'),
    });
    selectLimit.mockResolvedValueOnce([ready]);

    const dto = await service.confirm(OWNER, ASSET_ID);

    expect(dto.status).toBe('ready');
    expect(storage.headObject).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('rejects when the object is missing in storage', async () => {
    selectLimit.mockResolvedValueOnce([pendingRow()]);
    storage.headObject.mockResolvedValueOnce(null);
    updateWhere.mockResolvedValueOnce(undefined);

    await expect(service.confirm(OWNER, ASSET_ID)).rejects.toMatchObject({
      code: ErrorCode.MEDIA_OBJECT_MISSING,
    });
    expect(storage.delete).toHaveBeenCalled();
  });

  it('rejects on byte size mismatch', async () => {
    selectLimit.mockResolvedValueOnce([pendingRow()]);
    storage.headObject.mockResolvedValueOnce({
      exists: true,
      contentLength: 999,
      contentType: 'image/png',
    });
    updateWhere.mockResolvedValueOnce(undefined);

    const error = await service.confirm(OWNER, ASSET_ID).catch((value) => value);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ code: ErrorCode.MEDIA_SIZE_MISMATCH });
  });
});
