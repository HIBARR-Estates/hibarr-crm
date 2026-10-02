<?php

namespace Tests\Unit\Support;

use App\Models\Company;
use App\Models\Task;
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

        // `due_date` holds UTC instants, so bounds are the viewer's day
        // converted to UTC. Istanbul is UTC+3: local midnight is 21:00 UTC the
        // day before, and 23:59:59 local is 20:59:59 UTC the day of.
        $bounds = TaskWallClock::dayBounds(['2026-09-24', '2026-09-24'], $user, $company);

        $this->assertSame('2026-09-23 21:00:00', $bounds[0]);
        $this->assertSame('2026-09-24 20:59:59', $bounds[1]);
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

        // New York is UTC-4 in September, so its day is a single UTC day.
        $bounds = TaskWallClock::dayBounds(['2026-09-24', '2026-09-24'], $user, $company);

        $this->assertSame('2026-09-24 04:00:00', $bounds[0]);
        $this->assertSame('2026-09-25 03:59:59', $bounds[1]);
        $this->assertSame('2026-09-24', TaskWallClock::todayDateString($user, $company));
    }

    public function test_day_bounds_span_the_utc_dates_a_viewer_day_covers(): void
    {
        app(FeatureFlagService::class)->setTestingOverrides([
            UserTimezone::FLAG => false,
        ]);

        $company = new Company(['timezone' => 'Europe/Istanbul']);
        $user = new User(['timezone' => 'Europe/Istanbul']);

        $bounds = TaskWallClock::dayBounds(['2026-09-25', '2026-09-25'], $user, $company);

        // A task due 01:00 local on 2026-09-25 is stored 22:00 UTC on 2026-09-24,
        // so naive local-day bounds would drop it from "due that day".
        $this->assertSame('2026-09-24 21:00:00', $bounds[0]);
        $this->assertSame('2026-09-25 20:59:59', $bounds[1]);
    }

    public function test_utc_now_and_today_bounds_stay_on_the_utc_basis(): void
    {
        app(FeatureFlagService::class)->setTestingOverrides([
            UserTimezone::FLAG => false,
        ]);

        $company = new Company(['timezone' => 'Europe/Istanbul']);
        $user = new User(['timezone' => 'Europe/Istanbul']);

        Carbon::setTestNow(Carbon::parse('2026-09-24 21:30:00', 'UTC'));

        // Raw-column comparison bound: UTC digits, never viewer-local ones.
        $this->assertSame('2026-09-24 21:30:00', TaskWallClock::utcNowDateTimeString());
        $this->assertSame('2026-09-25 00:30:00', TaskWallClock::nowDateTimeString($user, $company));

        // Viewer is already on 2026-09-25 locally, so "due today" is the UTC
        // window between those two dates rather than one DATE() match.
        $this->assertSame(
            ['2026-09-24 21:00:00', '2026-09-25 20:59:59'],
            TaskWallClock::utcTodayBounds($user, $company),
        );
    }

    /**
     * The predicate behind the kanban "overdue" count. Both operands must be
     * the same basis: a task due 17:00 local (stored 14:00 UTC) is not overdue
     * at 16:00 local, which an unconverted LHS against a local "now" got wrong.
     */
    public function test_overdue_comparison_does_not_flag_a_task_before_its_local_due_time(): void
    {
        app(FeatureFlagService::class)->setTestingOverrides([
            UserTimezone::FLAG => false,
        ]);

        $company = new Company(['timezone' => 'Europe/Istanbul']);
        $user = new User(['timezone' => 'Europe/Istanbul']);

        $dueAtFiveLocal = Carbon::parse('2026-09-24 14:00:00', 'UTC');

        // 16:00 Istanbul = 13:00 UTC — an hour before the task is due locally.
        Carbon::setTestNow(Carbon::parse('2026-09-24 13:00:00', 'UTC'));
        $this->assertFalse(
            Task::wallClockString($dueAtFiveLocal, $user, $company)
                < TaskWallClock::nowDateTimeString($user, $company),
        );

        // 18:00 Istanbul = 15:00 UTC — an hour past due.
        Carbon::setTestNow(Carbon::parse('2026-09-24 15:00:00', 'UTC'));
        $this->assertTrue(
            Task::wallClockString($dueAtFiveLocal, $user, $company)
                < TaskWallClock::nowDateTimeString($user, $company),
        );
    }
}
