<?php

namespace Tests\Concerns;

use App\Services\FeatureFlagService;

trait SetsFeatureFlags
{
    protected function setFeatureFlag(string $flag, bool $enabled): void
    {
        /** @var FeatureFlagService $service */
        $service = app(FeatureFlagService::class);
        $existing = $service->getTestingOverrides() ?? [];
        $existing[$flag] = $enabled;
        $service->setTestingOverrides($existing);
    }
}
