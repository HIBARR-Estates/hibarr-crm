<?php

namespace App\Support;

/**
 * Release identity written at artifact build (`public/build-version.json`).
 * Sitting tabs compare this to the id they booted with to detect a new deploy.
 */
final class AppBuild
{
    private static ?string $cachedId = null;

    private static bool $loaded = false;

    public static function id(): ?string
    {
        if (! self::$loaded) {
            self::$cachedId = self::readFrom(public_path('build-version.json'));
            self::$loaded = true;
        }

        return self::$cachedId;
    }

    /**
     * Id shared with browsers. Local/testing omit it so the banner never appears.
     */
    public static function clientId(): ?string
    {
        if (! app()->environment(['production', 'staging'])) {
            return null;
        }

        return self::id();
    }

    public static function forget(): void
    {
        self::$cachedId = null;
        self::$loaded = false;
    }

    public static function readFrom(string $path): ?string
    {
        if (! is_readable($path)) {
            return null;
        }

        $raw = file_get_contents($path);
        if ($raw === false || $raw === '') {
            return null;
        }

        $decoded = json_decode($raw, true);
        if (! is_array($decoded)) {
            return null;
        }

        $id = $decoded['id'] ?? null;
        if (! is_string($id) || $id === '') {
            return null;
        }

        return $id;
    }
}
