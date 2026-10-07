import { z } from 'zod';

import { pixelObjectTypeSchema } from '@/shared/contracts/pixelObjects.contract';
import { ValidationError } from '@/shared/errors';

import { type CatalogCursor, catalogListQuerySchema, decodeCatalogCursor } from './catalogCursor';

/** Previews shown on one project card. Matches the mobile catalog row. */
export const CATALOG_MOMENTS_PER_PROJECT = 4;

const UUID_TEXT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Separate from the flat object list: a smaller page, a required type,
 * and an optional title search. Existing list contracts stay unchanged.
 */
export const catalogProjectsQuerySchema = catalogListQuerySchema.extend({
  objectType: pixelObjectTypeSchema,
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export type CatalogProjectsQuery = z.infer<typeof catalogProjectsQuerySchema>;

/** Bound parameter for `ILIKE ... ESCAPE '\'`. Null means "no search". */
export function likeContainsPattern(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim().slice(0, 80);
  if (trimmed.length === 0) return null;
  return `%${trimmed.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export function readCatalogCursor(raw: string | undefined): CatalogCursor | null {
  if (raw === undefined) return null;
  const cursor = decodeCatalogCursor(raw);
  if (cursor === null || !UUID_TEXT.test(cursor.id)) {
    throw invalidCursor();
  }
  const at = new Date(cursor.publishedAt);
  if (Number.isNaN(at.getTime())) throw invalidCursor();
  return { publishedAt: at.toISOString(), id: cursor.id };
}

function invalidCursor(): ValidationError {
  return new ValidationError('Некорректный cursor', [
    { path: 'cursor', message: 'Ожидается opaque catalog cursor' },
  ]);
}
