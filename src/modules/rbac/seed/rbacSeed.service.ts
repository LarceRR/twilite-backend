import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  ADMIN_GROUP_PERMISSIONS,
  ARTIST_GROUP_PERMISSIONS,
  PERMISSION_CATALOG,
  USER_GROUP_PERMISSIONS,
} from '../domain/catalog/permissionCatalog';
import { RBAC_REPOSITORY, type RbacRepository } from '../domain/repositories/RbacRepository';

/**
 * Idempotent: upserts catalog permissions and User/Artist/Admin groups.
 */
@Injectable()
export class RbacSeedService {
  private readonly logger = new Logger(RbacSeedService.name);

  constructor(@Inject(RBAC_REPOSITORY) private readonly rbac: RbacRepository) {}

  async seed(): Promise<void> {
    const permissionByName = new Map<string, string>();

    for (const entry of PERMISSION_CATALOG) {
      const permission = await this.rbac.upsertPermission(entry);
      permissionByName.set(permission.name, permission.id);
    }

    const userGroup = await this.rbac.upsertGroup({
      name: 'User',
      descriptionEn: 'Default group for new registrations',
      descriptionRu: 'Группа по умолчанию для новых регистраций',
      parentGroupId: null,
      isDefault: true,
    });

    const artistGroup = await this.rbac.upsertGroup({
      name: 'Artist',
      descriptionEn: 'Editors with project create/edit/delete',
      descriptionRu: 'Редакторы с созданием и правкой проектов',
      parentGroupId: userGroup.id,
      isDefault: false,
    });

    await this.rbac.upsertGroup({
      name: 'Admin',
      descriptionEn: 'Administrators with admin panel access',
      descriptionRu: 'Администраторы с доступом к админ-панели',
      parentGroupId: artistGroup.id,
      isDefault: false,
    });

    // Re-fetch Admin after upsert (parent already set).
    const groups = await this.rbac.listGroups();
    const adminGroup = groups.find((group) => group.name === 'Admin');

    if (adminGroup === undefined) {
      throw new Error('Admin group missing after seed');
    }

    await this.rbac.replaceGroupPermissions(
      userGroup.id,
      resolveIds(USER_GROUP_PERMISSIONS, permissionByName),
    );
    await this.rbac.replaceGroupPermissions(
      artistGroup.id,
      resolveIds(ARTIST_GROUP_PERMISSIONS, permissionByName),
    );
    await this.rbac.replaceGroupPermissions(
      adminGroup.id,
      resolveIds(ADMIN_GROUP_PERMISSIONS, permissionByName),
    );

    this.logger.log(
      `RBAC seed complete: ${PERMISSION_CATALOG.length} permissions, groups User/Artist/Admin`,
    );
  }
}

function resolveIds(names: readonly string[], byName: Map<string, string>): string[] {
  return names.map((name) => {
    const id = byName.get(name);

    if (id === undefined) {
      throw new Error(`Permission not in catalog: ${name}`);
    }

    return id;
  });
}
