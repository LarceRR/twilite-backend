import type { Database } from '@/database/drizzle/drizzle.module';
import type { CatalogPageDto } from './catalogPageSchema';
import { catalogPageFromSources } from './catalogProjectMapper';
import { selectCatalogMoments, selectCatalogProjects } from './catalogProjectReads';
import {
  type CatalogProjectsQuery,
  likeContainsPattern,
  readCatalogCursor,
} from './catalogProjectsQuery';

/**
 * One page of projects that have a published object of the requested type,
 * then at most four previews per project. Callers must not fan out per project.
 */
export async function listCatalogProjects(
  db: Database,
  query: CatalogProjectsQuery,
): Promise<CatalogPageDto> {
  const cursor = readCatalogCursor(query.cursor);
  const pattern = likeContainsPattern(query.q);
  const projects = await selectCatalogProjects(db, query, pattern, cursor);
  const pageIds = projects.slice(0, query.limit).map((project) => project.id);
  const moments = await selectCatalogMoments(db, pageIds, query.objectType, pattern);
  return catalogPageFromSources(projects, moments, query.limit);
}
