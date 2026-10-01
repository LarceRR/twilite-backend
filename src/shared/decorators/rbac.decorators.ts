import { SetMetadata } from '@nestjs/common';

export const RBAC_REQUIRE_ALL = 'rbac:requireAll';
export const RBAC_REQUIRE_ANY = 'rbac:requireAny';

/** AND: user must have every listed platform permission. */
export const RequireRbac = (...permissions: string[]) =>
  SetMetadata(RBAC_REQUIRE_ALL, permissions);

/** OR: user must have at least one listed platform permission. */
export const RequireAnyRbac = (...permissions: string[]) =>
  SetMetadata(RBAC_REQUIRE_ANY, permissions);
