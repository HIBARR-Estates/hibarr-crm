<?php

namespace App\Support;

use App\Services\FeatureFlagService;

class FeatureFlags
{
    public static function enabled(string $flag): bool
    {
        return app(FeatureFlagService::class)->isEnabled($flag);
    }

    /**
     * @return array<string, bool>
     */
    public static function all(): array
    {
        return app(FeatureFlagService::class)->all();
    }

    /**
     * @return array<string, bool>
     */
    public static function forInertia(): array
    {
        return app(FeatureFlagService::class)->forInertia();
    }
}
