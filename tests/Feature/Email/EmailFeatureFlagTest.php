<?php

namespace Tests\Feature\Email;

use App\Email\EmailFeature;
use App\Services\FeatureFlagService;
use App\Support\FeatureFlags;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class EmailFeatureFlagTest extends TestCase
{
    use SetsFeatureFlags;

    public function test_flag_is_known_and_not_a_local_default(): void
    {
        $this->assertSame('crm.email', EmailFeature::FLAG);
        $this->assertContains(EmailFeature::FLAG, config('features.known_flags'));
        $this->assertArrayNotHasKey(EmailFeature::FLAG, config('features.local_defaults', []));
        $this->assertArrayNotHasKey(EmailFeature::FLAG, config('features.local_overrides', []));
    }

    public function test_for_inertia_includes_flag_and_it_is_off_by_default(): void
    {
        // Any unrelated override puts the service on its deterministic testing path.
        $this->setFeatureFlag('crm.lead-merge', true);

        $flags = FeatureFlags::forInertia();

        $this->assertArrayHasKey(EmailFeature::FLAG, $flags);
        $this->assertFalse($flags[EmailFeature::FLAG]);
        $this->assertFalse(EmailFeature::enabled());
    }

    public function test_helper_is_false_when_flag_is_explicitly_off(): void
    {
        $this->setFeatureFlag(EmailFeature::FLAG, false);

        $this->assertFalse(EmailFeature::enabled());
    }

    public function test_helper_is_false_when_remote_response_omits_the_flag(): void
    {
        Http::fake(['*' => Http::response(['data' => ['flags' => ['crm.lead-merge' => true]]])]);

        $this->assertFalse(EmailFeature::enabled());
        $this->assertFalse(FeatureFlags::forInertia()[EmailFeature::FLAG]);
    }

    public function test_helper_is_false_when_flags_service_is_unreachable(): void
    {
        Http::fake(['*' => Http::response([], 503)]);

        $this->assertFalse(EmailFeature::enabled());
    }

    public function test_helper_is_false_when_flags_service_throws(): void
    {
        $this->mock(FeatureFlagService::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andThrow(new \RuntimeException('flags down'));
            $mock->shouldReceive('clearTestingOverrides');
        });

        $this->assertFalse(EmailFeature::enabled());
    }

    public function test_helper_is_true_when_test_override_turns_flag_on(): void
    {
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->assertTrue(EmailFeature::enabled());
        $this->assertTrue(FeatureFlags::forInertia()[EmailFeature::FLAG]);
    }
}
