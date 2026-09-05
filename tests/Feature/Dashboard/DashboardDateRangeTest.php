<?php

namespace Tests\Feature\Dashboard;

use App\Support\DashboardDateRange;
use Illuminate\Http\Request;
use Tests\TestCase;

/**
 * The window a dashboard is read over, as parsed off the query string.
 *
 * Worth its own suite because it is the one place on these pages where user
 * input reaches date arithmetic inside aggregate queries. Everything that
 * isn't two real dates has to fall back to a known-good window rather than be
 * coerced into something plausible-looking.
 *
 * Pure — no database, no schema.
 */
class DashboardDateRangeTest extends TestCase
{
    public function test_a_whitelisted_preset_is_honoured(): void
    {
        $range = $this->fromQuery(['days' => 90]);

        $this->assertSame(90, $range->preset);
        $this->assertSame(90, $range->days());
        $this->assertFalse($range->isCustom());
    }

    public function test_an_unknown_preset_falls_back_to_the_default(): void
    {
        // Not clamped to the nearest option: an out-of-range value is a mistake
        // or a probe, and silently answering a different question is worse than
        // answering the default one.
        $this->assertSame(
            DashboardDateRange::DEFAULT_DAYS,
            $this->fromQuery(['days' => 7])->preset
        );
    }

    public function test_no_parameters_at_all_gives_the_default_window(): void
    {
        $range = $this->fromQuery([]);

        $this->assertSame(DashboardDateRange::DEFAULT_DAYS, $range->preset);
    }

    public function test_a_custom_range_is_taken_as_given(): void
    {
        $range = $this->fromQuery(['from' => '2026-01-10', 'to' => '2026-01-20']);

        $this->assertTrue($range->isCustom());
        $this->assertNull($range->preset);
        $this->assertSame('2026-01-10', $range->from->toDateString());
        $this->assertSame('2026-01-20', $range->to->toDateString());
        // Inclusive of both ends — 10th to 20th is eleven days, not ten.
        $this->assertSame(11, $range->days());
    }

    public function test_the_window_covers_whole_days_at_both_ends(): void
    {
        $range = $this->fromQuery(['from' => '2026-01-10', 'to' => '2026-01-20']);

        // A row stamped at 18:00 on the last day is inside the range the user
        // drew; truncating to midnight would silently drop that day.
        $this->assertSame('00:00:00', $range->from->format('H:i:s'));
        $this->assertSame('23:59:59', $range->to->format('H:i:s'));
    }

    public function test_a_backwards_range_is_read_as_the_span_between_the_dates(): void
    {
        $range = $this->fromQuery(['from' => '2026-01-20', 'to' => '2026-01-10']);

        // Dragging a calendar backwards means the range between the two dates.
        // Refusing it would be pedantry.
        $this->assertSame('2026-01-10', $range->from->toDateString());
        $this->assertSame('2026-01-20', $range->to->toDateString());
    }

    /** @dataProvider rejectedRanges */
    public function test_unusable_dates_fall_back_to_the_default(array $query, string $why): void
    {
        $range = $this->fromQuery($query);

        $this->assertFalse($range->isCustom(), $why);
        $this->assertSame(DashboardDateRange::DEFAULT_DAYS, $range->preset, $why);
    }

    public static function rejectedRanges(): array
    {
        return [
            'not a date' => [['from' => 'yesterday', 'to' => 'today'], 'Free text parsed as a range'],
            'wrong format' => [['from' => '10/01/2026', 'to' => '20/01/2026'], 'A non-ISO format was accepted'],
            // createFromFormat is lenient about overflow and would turn this
            // into 3 March, answering a question nobody asked.
            'overflowing day' => [['from' => '2026-02-31', 'to' => '2026-03-05'], 'An impossible date was invented into a real one'],
            'only one end' => [['from' => '2026-01-10'], 'A half-specified range was accepted'],
            'empty strings' => [['from' => '', 'to' => ''], 'Empty input was accepted'],
            'array injection' => [['from' => ['2026-01-10'], 'to' => '2026-01-20'], 'A non-string was accepted'],
            'absurdly long' => [['from' => '1990-01-01', 'to' => '2026-01-01'], 'A range past the cap was accepted'],
        ];
    }

    public function test_a_custom_range_round_trips_through_the_payload(): void
    {
        $payload = $this->fromQuery(['from' => '2026-01-10', 'to' => '2026-01-20'])->toArray();

        $this->assertSame(
            ['from' => '2026-01-10', 'to' => '2026-01-20', 'days' => 11, 'preset' => null],
            $payload,
            'The picker round-trips this shape, so it has to stay exact'
        );
    }

    public function test_a_preset_reports_its_own_length_in_the_payload(): void
    {
        $payload = $this->fromQuery(['days' => 30])->toArray();

        // `days` is populated for both shapes so copy like "last N days" reads
        // correctly whichever the user picked.
        $this->assertSame(30, $payload['days']);
        $this->assertSame(30, $payload['preset']);
    }

    private function fromQuery(array $query): DashboardDateRange
    {
        return DashboardDateRange::fromRequest(Request::create('/dashboard-v2', 'GET', $query));
    }
}
