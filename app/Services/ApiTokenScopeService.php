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
     * Scopes granted by a token's permissions payload. Empty or malformed
     * payloads grant nothing — full access is the token's separate
     * `unrestricted` flag, never an absence of scopes.
     *
     * @return list<string>
     */
    public static function normalizeScopes(mixed $permissions): array
    {
        if (is_string($permissions)) {
            $permissions = json_decode($permissions, true);
        }

        if (!is_array($permissions)) {
            return [];
        }

        if (array_key_exists('scopes', $permissions)) {
            return self::sanitizeScopes(is_array($permissions['scopes']) ? $permissions['scopes'] : []);
        }

        if (array_is_list($permissions)) {
            return self::sanitizeScopes($permissions);
        }

        return [];
    }

    public static function routeAllowed(?string $routeName, mixed $permissions, bool $unrestricted = false): bool
    {
        if ($unrestricted) {
            return true;
        }

        // Scopes are route names, so an unnamed route can't be granted.
        if ($routeName === null || $routeName === '') {
            return false;
        }

        $scopes = self::normalizeScopes($permissions);

        if (in_array($routeName, $scopes, true)) {
            return true;
        }

        // ApiRoute appends ".{version}" (e.g. ".v1") to route names; scope config
        // stores the unversioned name (e.g. api.properties.index).
        $version = config('api.default_version');
        if (is_string($version) && $version !== '' && str_ends_with($routeName, '.' . $version)) {
            $unversioned = substr($routeName, 0, -(strlen($version) + 1));

            return in_array($unversioned, $scopes, true);
        }

        return false;
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
        return self::normalizeScopes($permissions);
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
