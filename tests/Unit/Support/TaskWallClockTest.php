<?php

namespace Tests\Unit\Support;

use App\Models\Company;
use App\Models\User;
use App\Services\FeatureFlagService;
use App\Support\TaskWallClock;
use App\Support\UserTimezone;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class TaskWallClockTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        app(FeatureFlagService::class)->clearTestingOverrides();
        parent::tearDown();
    }

    public function test_day_bounds_use_company_timezone_when_user_timezone_flag_is_off(): void
    {
        app(FeatureFlagService::class)->setTestingOverrides([
            UserTimezone::FLAG => false,
        ]);

        $company = new Company(['timezone' => 'Europe/Istanbul']);
        $user = new User(['timezone' => 'America/New_York']);

        Carbon::setTestNow(Carbon::parse('2026-09-24 21:30:00', 'UTC'));

        $bounds = TaskWallClock::dayBounds(['2026-09-24', '2026-09-24'], $user, $company);

        $this->assertSame('2026-09-24 00:00:00', $bounds[0]);
        $this->assertSame('2026-09-24 23:59:59', $bounds[1]);
        $this->assertSame('2026-09-25', TaskWallClock::todayDateString($user, $company));
    }

    public function test_day_bounds_use_user_timezone_when_flag_is_on(): void
    {
        app(FeatureFlagService::class)->setTestingOverrides([
            UserTimezone::FLAG => true,
        ]);

        $company = new Company(['timezone' => 'Europe/Istanbul']);
        $user = new User(['timezone' => 'America/New_York']);

        Carbon::setTestNow(Carbon::parse('2026-09-24 21:30:00', 'UTC'));

        $bounds = TaskWallClock::dayBounds(['2026-09-24', '2026-09-24'], $user, $company);

        $this->assertSame('2026-09-24 00:00:00', $bounds[0]);
        $this->assertSame('2026-09-24 23:59:59', $bounds[1]);
        $this->assertSame('2026-09-24', TaskWallClock::todayDateString($user, $company));
    }

    public function test_utc_instant_day_bounds_convert_viewer_midnight_to_utc(): void
    {
        app(FeatureFlagService::class)->setTestingOverrides([
            UserTimezone::FLAG => true,
        ]);

        $company = new Company(['timezone' => 'Europe/Istanbul']);
        $user = new User(['timezone' => 'Europe/Istanbul']);

        Carbon::setTestNow(Carbon::parse('2026-09-24 12:00:00', 'UTC'));

        $bounds = TaskWallClock::utcInstantDayBounds(
            ['2026-09-24', '2026-09-24'],
            $user,
            $company,
        );

        // Istanbul is UTC+3 on this date — local midnight is previous UTC evening.
        $this->assertSame('2026-09-23 21:00:00', $bounds[0]);
        $this->assertSame('2026-09-24 20:59:59', $bounds[1]);
    }
}
