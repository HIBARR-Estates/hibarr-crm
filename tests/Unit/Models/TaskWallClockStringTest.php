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

    public function test_wall_clock_string_shifts_to_user_timezone_when_user_timezone_flag_is_on(): void
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

    /**
     * The write side is not flag-gated — TaskService::createTask/updateTask and
     * TaskController@reschedule always persist UTC via interpretWallClock() —
     * so the read side has to convert regardless of the flag or a 17:00 save
     * reloads as 14:00 for anyone not on UTC.
     */
    public function test_wall_clock_string_still_converts_to_company_timezone_when_flag_is_off(): void
    {
        app(FeatureFlagService::class)->setTestingOverrides([
            UserTimezone::FLAG => false,
        ]);

        $company = new Company(['timezone' => 'Europe/Istanbul']);
        // Flag off means the user's own timezone is ignored, but the company
        // timezone is still applied to the stored UTC instant.
        $user = new User(['timezone' => 'America/New_York']);

        $stored = Carbon::parse('2026-09-24 14:00:00', 'UTC');

        $this->assertSame(
            '2026-09-24 17:00:00',
            Task::wallClockString($stored, $user, $company),
        );
    }

    public function test_wall_clock_string_returns_null_for_missing_date(): void
    {
        $this->assertNull(Task::wallClockString(null));
    }

    /**
     * `completed_on` is stamped as a bare calendar date, so unlike due_date it
     * is not an instant to convert out of UTC. Converting it into the viewer
     * zone rolls it back a day for anyone west of UTC.
     */
    public function test_completion_date_string_keeps_its_calendar_date_for_a_western_viewer(): void
    {
        app(FeatureFlagService::class)->setTestingOverrides([
            UserTimezone::FLAG => true,
        ]);

        $company = new Company(['timezone' => 'Europe/Istanbul']);
        $user = new User(['timezone' => 'America/New_York']);

        // Stamped as `now()->format('Y-m-d')`, i.e. midnight UTC on the 24th.
        $stored = Carbon::parse('2026-09-24 00:00:00', 'UTC');

        $this->assertSame(
            '2026-09-24 00:00:00',
            Task::completionDateString($stored, $user, $company),
        );

        // The same instant as a due_date still converts: 00:00 UTC is 20:00
        // the previous day in New York.
        $this->assertSame(
            '2026-09-23 20:00:00',
            Task::wallClockString($stored, $user, $company),
        );
    }

    public function test_completion_date_string_converts_a_value_that_carries_a_time(): void
    {
        app(FeatureFlagService::class)->setTestingOverrides([
            UserTimezone::FLAG => true,
        ]);

        $company = new Company(['timezone' => 'Europe/Istanbul']);
        $user = new User(['timezone' => 'America/New_York']);

        // Not midnight, so it is a real instant and converts like due_date.
        $stored = Carbon::parse('2026-09-24 14:00:00', 'UTC');

        $this->assertSame(
            '2026-09-24 10:00:00',
            Task::completionDateString($stored, $user, $company),
        );
    }

    public function test_completion_date_string_returns_null_for_missing_date(): void
    {
        $this->assertNull(Task::completionDateString(null));
    }
}
