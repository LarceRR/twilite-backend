import { Inject, Injectable } from '@nestjs/common';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import type { CatalogProjectsQuery } from './catalogProjectsQuery';
import { listCatalogProjects } from './listCatalogProjects';

@Injectable()
export class CatalogProjectsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  list(query: CatalogProjectsQuery) {
    return listCatalogProjects(this.db, query);
  }
}
