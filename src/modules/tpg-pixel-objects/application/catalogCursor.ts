import { z } from 'zod';

const CURSOR_SEPARATOR = ':';

export const catalogListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CatalogListQuery = z.infer<typeof catalogListQuerySchema>;

export type CatalogCursor = {
  readonly publishedAt: string;
  readonly id: string;
};

export function encodeCatalogCursor(cursor: CatalogCursor): string {
  return Buffer.from(`${cursor.publishedAt}${CURSOR_SEPARATOR}${cursor.id}`, 'utf8').toString(
    'base64url',
  );
}

export function decodeCatalogCursor(raw: string): CatalogCursor | null {
  try {
    const text = Buffer.from(raw, 'base64url').toString('utf8');
    const separator = text.lastIndexOf(CURSOR_SEPARATOR);
    if (separator <= 0) {
      return null;
    }
    const publishedAt = text.slice(0, separator);
    const id = text.slice(separator + 1);
    if (publishedAt.length === 0 || id.length === 0) {
      return null;
    }
    return { publishedAt, id };
  } catch {
    return null;
  }
}
