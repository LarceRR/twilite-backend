# Platform RBAC

Twilite uses a custom platform RBAC layer (no CASL/Casbin). Space-scoped permissions (`space.view`, …) remain separate and still apply on space routes.

## Model

- **Permissions** — `module.resource.action` strings (wildcards with `*` supported).
- **Groups** — named sets of permissions with optional single-parent inheritance (`User` ← `Artist` ← `Admin`).
- **User overrides** — per-user `GRANT` / `DENY` rows that win over group membership for that exact permission name.

Effective permissions:

```
(group ∪ ancestors ∪ GRANTs) − DENYs
```

Cached in Redis as `rbac:user:{userId}:effective_permissions` (`RBAC_CACHE_TTL`, default 300s).

## Adding a permission

1. Add an entry to [`src/modules/rbac/domain/catalog/permissionCatalog.ts`](../src/modules/rbac/domain/catalog/permissionCatalog.ts) (EN + RU descriptions).
2. If default users need it, add the name to `USER_GROUP_PERMISSIONS` / `ARTIST_GROUP_PERMISSIONS` / `ADMIN_GROUP_PERMISSIONS` in the same file.
3. Put `@RequireRbac('your.permission.name')` on the Nest controller method (keep `@RequirePermission` for space routes).
4. Restart the API — `RbacSeedService` upserts the catalog on boot.
5. Optionally gate UI in Twilite App / tpg with the same string and wildcard helpers.

## Adding a group

Prefer the Admin Panel (`PATCH /v1/admin/groups/:id`) or seed updates. Inheritance cycles are rejected with HTTP 400.

## Key endpoints

| Method | Path | Permission |
|--------|------|------------|
| GET | `/v1/users/me` | JWT only — returns `groups` + effective `permissions` |
| GET | `/v1/admin/permissions` | `ta.adminPanel.permissions.view` |
| GET/PATCH | `/v1/admin/groups…` | `ta.adminPanel.groups.view` / `.edit` |
| GET/PATCH | `/v1/admin/users…` | `ta.adminPanel.users.view` |

Product routes (auth sessions, spaces, media, tpg, …) require **authentication only** (+ existing space permissions where applicable). Platform `@RequireRbac` is reserved for `/v1/admin/*`.

Admin panel entry also requires `ta.adminPanel.access` (`AdminPanelGuard`).

## Tests

```bash
npm test -- src/modules/rbac src/shared/guards/rbacPermissions.guard.spec.ts
RUN_INTEGRATION=1 npm test -- test/integration/rbac.spec.ts
```
