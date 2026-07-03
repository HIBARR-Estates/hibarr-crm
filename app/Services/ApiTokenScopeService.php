<?php

namespace App\Services;

class ApiTokenScopeService
{
    /**
     * @return array<string, string> scope key => label
     */
    public static function allScopes(): array
    {
        $scopes = [];

        foreach (config('api-token-scopes.groups', []) as $group) {
            foreach ($group['scopes'] ?? [] as $key => $label) {
                $scopes[$key] = $label;
            }
        }

        return $scopes;
    }

    /**
     * @return array<string, array{label: string, scopes: array<string, string>}>
     */
    public static function groupedScopes(): array
    {
        return config('api-token-scopes.groups', []);
    }

    /**
     * @return list<string>
     */
    public static function allScopeKeys(): array
    {
        return array_keys(self::allScopes());
    }

    /**
     * Null means unrestricted (full access).
     *
     * @return list<string>|null
     */
    public static function normalizeScopes(mixed $permissions): ?array
    {
        if ($permissions === null) {
            return null;
        }

        if (is_string($permissions)) {
            if ($permissions === '') {
                return [];
            }

            $decoded = json_decode($permissions, true);

            if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
                return [];
            }

            $permissions = $decoded;
        }

        if (!is_array($permissions)) {
            return [];
        }

        if (array_key_exists('scopes', $permissions)) {
            $scopes = $permissions['scopes'];

            if ($scopes === null || $scopes === []) {
                return null;
            }

            return self::sanitizeScopes(is_array($scopes) ? $scopes : []);
        }

        if ($permissions === []) {
            return null;
        }

        if (array_is_list($permissions)) {
            return self::sanitizeScopes($permissions);
        }

        return [];
    }

    public static function isUnrestricted(mixed $permissions): bool
    {
        return self::normalizeScopes($permissions) === null;
    }

    public static function routeAllowed(?string $routeName, mixed $permissions): bool
    {
        if ($routeName === null || $routeName === '') {
            return true;
        }

        $scopes = self::normalizeScopes($permissions);

        if ($scopes === null) {
            return true;
        }

        return in_array($routeName, $scopes, true);
    }

    /**
     * @param  list<string>  $scopes
     * @return array{scopes: list<string>}|null
     */
    public static function encodeScopes(?array $scopes): ?array
    {
        $scopes = self::sanitizeScopes($scopes ?? []);

        if ($scopes === []) {
            return null;
        }

        return ['scopes' => $scopes];
    }

    /**
     * @return list<string>
     */
    public static function scopesForToken(mixed $permissions): array
    {
        return self::normalizeScopes($permissions) ?? [];
    }

    /**
     * @param  list<string>  $scopeKeys
     * @return list<string>
     */
    public static function labelsForScopeKeys(array $scopeKeys): array
    {
        $all = self::allScopes();
        $labels = [];

        foreach ($scopeKeys as $key) {
            $labels[] = $all[$key] ?? $key;
        }

        return $labels;
    }

    /**
     * @param  list<string>  $scopes
     * @return list<string>
     */
    private static function sanitizeScopes(array $scopes): array
    {
        $allowed = array_flip(self::allScopeKeys());

        return array_values(array_unique(array_filter(
            $scopes,
            fn ($scope) => is_string($scope) && isset($allowed[$scope])
        )));
    }
}
