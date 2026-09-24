<?php

namespace App\Support;

use App\Models\User;

/**
 * Unified permission + feature-flag checker.
 *
 * One call answers "is this gated?" regardless of which system backs it.
 * Port this shape to OS (#5.1 / #7.2). See docs/ACCESS.md.
 *
 * This is not record-level access — use PermissionService::checkAccess()
 * when the answer depends on a model instance (owned/added vs this deal).
 */
class Access
{
    private const SCOPES = [
        'all' => 4,
        'both' => 3,
        'owned' => 2,
        'added' => 1,
        'none' => 5,
    ];

    /**
     * Whether the user holds $key at the optional required scope.
     *
     * No $scope → granted if the value is not none / missing.
     * Unknown or empty $key → false (fail closed).
     */
    public static function permission(User $user, string $key, string|int|null $scope = null): bool
    {
        if ($key === '') {
            return false;
        }

        return self::hasAccess($user->permission($key), $scope);
    }

    /**
     * Whether the named feature flag is on. Unknown / empty name → false.
     */
    public static function flag(string $name): bool
    {
        if ($name === '') {
            return false;
        }

        return FeatureFlags::enabled($name);
    }

    /**
     * Scope matrix shared with resources/js/lib/access.ts
     * (and permissionUtils hasAccess).
     */
    public static function hasAccess(mixed $value, string|int|null $requiredScope = null): bool
    {
        if ($value === null || $value === false || $value === '') {
            return false;
        }

        $userLevel = self::normalize($value);

        if ($requiredScope === null) {
            return $userLevel !== 5 && $userLevel !== 0;
        }

        $requiredLevel = self::normalize($requiredScope);

        if ($userLevel === 4) {
            return true;
        }

        if ($userLevel === $requiredLevel && $userLevel !== 0) {
            return true;
        }

        if ($userLevel === 3) {
            return $requiredLevel === 1 || $requiredLevel === 2;
        }

        return false;
    }

    private static function normalize(mixed $val): int
    {
        if (is_int($val)) {
            return $val;
        }

        if (is_string($val) && is_numeric($val)) {
            return (int) $val;
        }

        if (is_string($val) && isset(self::SCOPES[$val])) {
            return self::SCOPES[$val];
        }

        return 0;
    }
}
