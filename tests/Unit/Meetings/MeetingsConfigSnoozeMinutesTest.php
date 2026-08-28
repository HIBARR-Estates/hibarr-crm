<?php

namespace Tests\Unit\Meetings;

use Tests\TestCase;

/**
 * config/meetings.php validates MEETING_ATTENDANCE_CONFIRMATION_SNOOZE_MINUTES
 * itself (a self-invoking closure) rather than trusting the raw env value —
 * this locks that validation in.
 */
class MeetingsConfigSnoozeMinutesTest extends TestCase
{
    protected function tearDown(): void
    {
        putenv('MEETING_ATTENDANCE_CONFIRMATION_SNOOZE_MINUTES');

        parent::tearDown();
    }

    public function test_negative_value_falls_back_to_default(): void
    {
        $this->assertSame(60, $this->snoozeMinutesFor('-5'));
    }

    public function test_zero_value_falls_back_to_default(): void
    {
        $this->assertSame(60, $this->snoozeMinutesFor('0'));
    }

    public function test_non_numeric_value_falls_back_to_default(): void
    {
        $this->assertSame(60, $this->snoozeMinutesFor('not-a-number'));
    }

    public function test_unset_value_falls_back_to_default(): void
    {
        putenv('MEETING_ATTENDANCE_CONFIRMATION_SNOOZE_MINUTES');

        $this->assertSame(60, (require base_path('config/meetings.php'))['attendance_confirmation_snooze_minutes']);
    }

    public function test_valid_positive_value_is_preserved(): void
    {
        $this->assertSame(45, $this->snoozeMinutesFor('45'));
    }

    private function snoozeMinutesFor(string $envValue): int
    {
        putenv("MEETING_ATTENDANCE_CONFIRMATION_SNOOZE_MINUTES={$envValue}");

        return (require base_path('config/meetings.php'))['attendance_confirmation_snooze_minutes'];
    }
}
