<?php

namespace Tests;

use App\Services\FeatureFlagService;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    use CreatesApplication;

    protected function tearDown(): void
    {
        if ($this->app->bound(FeatureFlagService::class)) {
            $this->app->make(FeatureFlagService::class)->clearTestingOverrides();
        }

        parent::tearDown();
    }
}
