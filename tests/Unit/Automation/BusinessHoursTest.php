<?php

namespace Tests\Unit\Automation;

use App\Support\BusinessHours;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;

/**
 * Working-hours arithmetic for contact SLAs. Pure: no framework, no database.
 */
class BusinessHoursTest extends TestCase
{
    private const WEEKDAYS = ['timezone' => 'Europe/Berlin', 'days' => [1, 2, 3, 4, 5], 'start' => '09:00', 'end' => '18:00'];

    private function berlin(string $time): DateTimeImmutable
    {
        return new DateTimeImmutable($time, new DateTimeZone('Europe/Berlin'));
    }

    private function show(DateTimeImmutable $at): string
    {
        return $at->setTimezone(new DateTimeZone('Europe/Berlin'))->format('D Y-m-d H:i:s');
    }

    /** @return array<string, array{0: string, 1: int, 2: string}> */
    public static function additions(): array
    {
        return [
            'inside the window' => ['2026-11-25 10:00', 3600, 'Wed 2026-11-25 11:00:00'],
            'runs past closing into the next day' => ['2026-11-25 17:55', 600, 'Thu 2026-11-26 09:05:00'],
            'Friday evening into Monday' => ['2026-11-27 17:55', 600, 'Mon 2026-11-30 09:05:00'],
            'arrives on a Saturday' => ['2026-11-28 12:00', 300, 'Mon 2026-11-30 09:05:00'],
            'arrives before opening' => ['2026-11-25 07:00', 600, 'Wed 2026-11-25 09:10:00'],
            'arrives after closing' => ['2026-11-25 20:00', 600, 'Thu 2026-11-26 09:10:00'],
            'exactly fills the day' => ['2026-11-25 09:00', 9 * 3600, 'Wed 2026-11-25 18:00:00'],
            'one second more rolls over' => ['2026-11-25 09:00', 9 * 3600 + 1, 'Thu 2026-11-26 09:00:01'],
            'zero seconds' => ['2026-11-25 10:00', 0, 'Wed 2026-11-25 10:00:00'],
            'twenty working hours' => ['2026-11-25 09:00', 20 * 3600, 'Fri 2026-11-27 11:00:00'],
        ];
    }

    /**
     * @dataProvider additions
     */
    public function test_adding_working_seconds_skips_time_outside_the_window(string $from, int $seconds, string $expected): void
    {
        $this->assertSame($expected, $this->show(BusinessHours::addWorkingSeconds($this->berlin($from), $seconds, self::WEEKDAYS)));
    }

    public function test_without_a_window_the_clock_runs_around_the_clock(): void
    {
        $this->assertSame(
            'Sat 2026-11-28 03:05:00',
            $this->show(BusinessHours::addWorkingSeconds($this->berlin('2026-11-28 03:00'), 300, null))
        );
    }

    public function test_working_seconds_between_two_moments_count_only_the_window(): void
    {
        $w = self::WEEKDAYS;
        $this->assertSame(600, BusinessHours::workingSecondsBetween($this->berlin('2026-11-27 17:55'), $this->berlin('2026-11-30 09:05'), $w));
        $this->assertSame(0, BusinessHours::workingSecondsBetween($this->berlin('2026-11-28 00:00'), $this->berlin('2026-11-29 23:59'), $w));
        $this->assertSame(9 * 3600, BusinessHours::workingSecondsBetween($this->berlin('2026-11-25 00:00'), $this->berlin('2026-11-26 00:00'), $w));
        $this->assertSame(600, BusinessHours::workingSecondsBetween($this->berlin('2026-11-28 10:00'), $this->berlin('2026-11-28 10:10'), null));
        $this->assertSame(0, BusinessHours::workingSecondsBetween($this->berlin('2026-11-25 11:00'), $this->berlin('2026-11-25 10:00'), $w));
    }

    public function test_adding_and_measuring_agree(): void
    {
        $start = $this->berlin('2026-11-27 16:20');
        $due = BusinessHours::addWorkingSeconds($start, 5 * 3600, self::WEEKDAYS);

        $this->assertSame(5 * 3600, BusinessHours::workingSecondsBetween($start, $due, self::WEEKDAYS));
    }

    public function test_the_window_is_open_from_its_start_up_to_but_not_including_its_end(): void
    {
        $w = self::WEEKDAYS;
        $this->assertTrue(BusinessHours::isOpen($this->berlin('2026-11-25 09:00'), $w));
        $this->assertTrue(BusinessHours::isOpen($this->berlin('2026-11-25 17:59:59'), $w));
        $this->assertFalse(BusinessHours::isOpen($this->berlin('2026-11-25 18:00'), $w));
        $this->assertFalse(BusinessHours::isOpen($this->berlin('2026-11-28 10:00'), $w));
        $this->assertTrue(BusinessHours::isOpen($this->berlin('2026-11-28 10:00'), null));
    }

    public function test_the_next_opening(): void
    {
        $w = self::WEEKDAYS;
        $this->assertSame('Mon 2026-11-30 09:00:00', $this->show(BusinessHours::nextOpening($this->berlin('2026-11-28 12:00'), $w)));
        $this->assertSame('Thu 2026-11-26 09:00:00', $this->show(BusinessHours::nextOpening($this->berlin('2026-11-25 19:00'), $w)));
        $this->assertSame('Wed 2026-11-25 10:00:00', $this->show(BusinessHours::nextOpening($this->berlin('2026-11-25 10:00'), $w)));
    }

    public function test_an_instant_in_any_zone_is_read_in_the_windows_zone(): void
    {
        $utc = new DateTimeImmutable('2026-11-25 08:30:00', new DateTimeZone('UTC')); // 09:30 in Berlin

        $this->assertSame('Wed 2026-11-25 10:00:00', $this->show(BusinessHours::addWorkingSeconds($utc, 1800, self::WEEKDAYS)));

        $newYork = ['timezone' => 'America/New_York', 'days' => [1, 2, 3, 4, 5], 'start' => '09:00', 'end' => '17:00'];
        $nine = new DateTimeImmutable('2026-11-25 14:00:00', new DateTimeZone('UTC')); // 09:00 in New York
        $this->assertSame('14:30', BusinessHours::addWorkingSeconds($nine, 1800, $newYork)->setTimezone(new DateTimeZone('UTC'))->format('H:i'));
    }

    public function test_a_clock_change_does_not_move_the_local_hours(): void
    {
        // Berlin goes forward at 02:00 on Sunday 29 March 2026: 09:30 stays 09:30 on the wall.
        $everyDay = ['timezone' => 'Europe/Berlin', 'days' => [1, 2, 3, 4, 5, 6, 7], 'start' => '09:00', 'end' => '18:00'];

        $this->assertSame(
            'Sun 2026-03-29 09:30:00',
            $this->show(BusinessHours::addWorkingSeconds($this->berlin('2026-03-28 17:30'), 3600, $everyDay))
        );
    }

    public function test_elapsed_time_spanning_a_clock_change_inside_the_window_is_counted_in_full(): void
    {
        // The window opens at 01:30 on the night Berlin skips 02:00-03:00 (Sunday 29 March 2026). Two hours
        // of working time from 01:30 CET end at 04:30 CEST, not 03:30: the skipped hour passed.
        $overnight = ['timezone' => 'Europe/Berlin', 'days' => [7], 'start' => '01:30', 'end' => '23:00'];

        $this->assertSame(
            'Sun 2026-03-29 04:30:00',
            $this->show(BusinessHours::addWorkingSeconds($this->berlin('2026-03-29 01:30'), 2 * 3600, $overnight))
        );
        $this->assertSame(
            2 * 3600,
            BusinessHours::workingSecondsBetween($this->berlin('2026-03-29 01:30'), $this->berlin('2026-03-29 04:30'), $overnight)
        );
    }

    public function test_the_tightest_valid_window_still_reaches_a_seven_day_deadline(): void
    {
        // One minute a week: seven days of SLA is 10,080 weeks away. It is reached, and not by falling
        // back to a round-the-clock deadline.
        $tiny = ['timezone' => 'UTC', 'days' => [1], 'start' => '09:00', 'end' => '09:01'];
        $from = new DateTimeImmutable('2026-11-23 09:00:00', new DateTimeZone('UTC'));

        $due = BusinessHours::addWorkingSeconds($from, 7 * 24 * 3600, $tiny);

        $this->assertSame('Mon', $due->format('D'));
        $this->assertGreaterThan(9999 * 7 * 86400, $due->getTimestamp() - $from->getTimestamp());
    }

    public function test_a_window_with_no_time_to_count_fails_loudly(): void
    {
        $this->expectException(\LogicException::class);

        BusinessHours::addWorkingSeconds(
            $this->berlin('2026-11-25 10:00'),
            60,
            ['timezone' => 'Europe/Berlin', 'days' => [1], 'start' => '09:00', 'end' => '09:00']
        );
    }

    public function test_the_closing_time_of_the_period_that_contains_a_moment(): void
    {
        $w = self::WEEKDAYS;

        $this->assertSame('Wed 2026-11-25 18:00:00', $this->show(BusinessHours::closingAt($this->berlin('2026-11-25 10:00'), $w)));
        $this->assertSame('Wed 2026-11-25 18:00:00', $this->show(BusinessHours::closingAt($this->berlin('2026-11-25 09:00'), $w)));
        // Closed: before opening, at closing, after it, at the weekend.
        foreach (['2026-11-25 08:59', '2026-11-25 18:00', '2026-11-25 20:00', '2026-11-28 12:00'] as $closed) {
            $this->assertNull(BusinessHours::closingAt($this->berlin($closed), $w), $closed);
        }
        $this->assertNull(BusinessHours::closingAt($this->berlin('2026-11-25 10:00'), null));
    }

    public function test_an_interval_too_long_to_count_fails_loudly_instead_of_returning_a_partial_total(): void
    {
        $this->expectException(\LogicException::class);

        BusinessHours::workingSecondsBetween(
            $this->berlin('2026-11-25 10:00'),
            $this->berlin('2026-11-25 10:00')->modify('+80000 days'),
            self::WEEKDAYS
        );
    }
}
