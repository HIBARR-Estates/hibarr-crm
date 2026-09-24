<?php

namespace Tests\Unit\Models;

use App\Models\Company;
use App\Models\Task;
use App\Models\User;
use App\Services\FeatureFlagService;
use App\Support\UserTimezone;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class TaskWallClockStringTest extends TestCase
{
    protected function tearDown(): void
    {
        app(FeatureFlagService::class)->clearTestingOverrides();
        parent::tearDown();
    }

    public function test_wall_clock_string_shifts_to_viewer_timezone_when_user_timezone_flag_is_on(): void
    {
        app(FeatureFlagService::class)->setTestingOverrides([
            UserTimezone::FLAG => true,
        ]);

        $company = new Company(['timezone' => 'Europe/Istanbul']);
        $user = new User(['timezone' => 'Europe/Istanbul']);

        // 17:00 Istanbul was persisted as 14:00 UTC.
        $stored = Carbon::parse('2026-09-24 14:00:00', 'UTC');

        $this->assertSame(
            '2026-09-24 17:00:00',
            Task::wallClockString($stored, $user, $company),
        );
    }

    public function test_wall_clock_string_keeps_stored_digits_when_user_timezone_flag_is_off(): void
    {
        app(FeatureFlagService::class)->setTestingOverrides([
            UserTimezone::FLAG => false,
        ]);

        $stored = Carbon::parse('2026-09-24 14:00:00', 'UTC');

        $this->assertSame('2026-09-24 14:00:00', Task::wallClockString($stored));
    }
}
