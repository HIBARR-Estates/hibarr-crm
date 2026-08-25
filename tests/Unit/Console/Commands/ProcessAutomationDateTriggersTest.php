<?php

namespace Tests\Unit\Console\Commands;

use App\Console\Commands\ProcessAutomationDateTriggers;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class ProcessAutomationDateTriggersTest extends TestCase
{
    protected ProcessAutomationDateTriggers $command;

    protected function setUp(): void
    {
        parent::setUp();

        $this->command = app(ProcessAutomationDateTriggers::class);
    }

    public function test_yearly_matches_month_and_day_only()
    {
        $anchor = Carbon::parse('1990-05-12');
        $today = Carbon::parse('2026-05-12');

        $this->assertTrue($this->invokeMatches($anchor, $today, true));
        $this->assertFalse($this->invokeMatches($anchor, Carbon::parse('2026-05-13'), true));
        $this->assertFalse($this->invokeMatches($anchor, Carbon::parse('2027-05-11'), true));
    }

    public function test_once_requires_exact_date()
    {
        $anchor = Carbon::parse('2026-05-12 14:30');
        $today = Carbon::parse('2026-05-12');

        $this->assertTrue($this->invokeMatches($anchor, $today, false));
        $this->assertFalse($this->invokeMatches($anchor, Carbon::parse('2027-05-12'), false));
    }

    public function test_scheduled_day_includes_one_day_grace_for_missed_scheduler_run()
    {
        $anchor = Carbon::parse('1990-05-12');
        $dayAfter = Carbon::parse('2026-05-13');

        $this->assertTrue($this->invokeScheduledDay($anchor, $dayAfter, true));
        $this->assertFalse($this->invokeScheduledDay($anchor, Carbon::parse('2026-05-14'), true));

        $onceAnchor = Carbon::parse('2026-05-12');
        $this->assertTrue($this->invokeScheduledDay($onceAnchor, Carbon::parse('2026-05-13'), false));
        $this->assertFalse($this->invokeScheduledDay($onceAnchor, Carbon::parse('2026-05-14'), false));
    }

    public function test_parses_raw_column_strings_and_carbon_instances()
    {
        $parsed = $this->invokeProtected($this->command, 'parseAnchorDate', ['1990-05-12']);

        $this->assertNotNull($parsed);
        $this->assertSame('1990-05-12', $parsed->toDateString());

        $carbon = Carbon::parse('2026-08-22 09:15:00');

        $this->assertEquals($carbon, $this->invokeProtected($this->command, 'parseAnchorDate', [$carbon]));

        $this->assertNull($this->invokeProtected($this->command, 'parseAnchorDate', ['not-a-date']));
        $this->assertNull($this->invokeProtected($this->command, 'parseAnchorDate', ['']));
        $this->assertNull($this->invokeProtected($this->command, 'parseAnchorDate', [null]));
    }

    protected function invokeMatches(Carbon $anchor, Carbon $today, bool $yearly): bool
    {
        return $this->invokeProtected($this->command, 'matchesToday', [$anchor, $today, $yearly]);
    }

    protected function invokeScheduledDay(Carbon $anchor, Carbon $today, bool $yearly): bool
    {
        return $this->invokeProtected($this->command, 'matchesScheduledDay', [$anchor, $today, $yearly]);
    }

    private function invokeProtected(object $object, string $method, array $args = []): mixed
    {
        $reflection = new \ReflectionMethod($object, $method);
        $reflection->setAccessible(true);

        return $reflection->invokeArgs($object, $args);
    }
}
