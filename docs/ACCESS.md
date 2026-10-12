# Access — unified permission & feature-flag checker

CRM half of backlog 7.1. Port this shape to OS (#5.1 / #7.2) rather than designing a second API.

`Access` answers “is X gated?” whether X is a permission or a feature flag. It wraps the two existing systems; it does not replace them.

## Signatures

PHP (`App\Support\Access`):

```php
Access::permission(User $user, string $key, string|int|null $scope = null): bool
Access::flag(string $name): bool
```

TypeScript (`resources/js/lib/access.ts`):

```ts
checkPermission(permissions, key, scope?)
checkFlag(featureFlags, name)

const { permission, flag } = useAccess()
permission("edit_deals", "owned")
flag("crm.lead-merge")
```

Unknown or empty keys return `false` and do not throw (fail closed).

## Permission scope matrix

Matches `hasAccess()` in `resources/js/lib/permissionUtils.tsx`. This is the user’s **granted** scope, not record ownership.

| User has | no scope | `added` | `owned` | `both` | `all` |
|---|---|---|---|---|---|
| `all` (4) | grant | grant | grant | grant | grant |
| `both` (3) | grant | grant | grant | grant | deny |
| `owned` (2) | grant | deny | grant | deny | deny |
| `added` (1) | grant | grant | deny | deny | deny |
| `none` (5) / missing / `false` | deny | deny | deny | deny | deny |

`Access::permission($user, $key, 'all')` matches `PermissionGates::allows($user, $key)`.

## Flags

`Access::flag($name)` / `flag(name)` delegates to `FeatureFlags::enabled()` / `featureFlags[name] === true`. Unknown names are off. Caching stays in `FeatureFlagService`; this helper does not add a second cache.

## What this is not

- **Not record-level access.** `PermissionService::checkAccess()` still answers “can this user act on *this* deal/lead?”
- **Not a migration.** `usePermission()` and the per-flag hooks stay. New call sites should use `Access` / `useAccess()`.
- **Not a product flag.** The checker is an internal abstraction; correctness is parity tests, not a rollout flag.
- **Not writable.** The PageLayout inspector is read-only. It does not toggle remote flags or change grants.

## Inspector

`AccessInspector` sits next to the language switcher in `PageLayout` (admin, or anyone on Vite DEV). It lists Inertia `featureFlags` and `auth.permissions`. Hidden for non-admin production sessions.

## OS port

Copy the signatures, fail-closed rule, and scope matrix. Keep the name `Access` (Laravel already owns `Gate`). Do not fold CRM-specific `PermissionGates` constants into the helper — those stay a named-gate list on top of `User::permission()`.
