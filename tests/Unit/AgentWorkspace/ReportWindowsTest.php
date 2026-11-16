<?php

namespace Tests\Unit\AgentWorkspace;

use App\Services\AgentWorkspace\ReportWindows;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\TestCase;

/** The five My report periods and the period each is compared with. */
class ReportWindowsTest extends TestCase
{
    private function at(string $date): Carbon
    {
        return Carbon::parse($date);
    }

    public function test_week_runs_monday_to_sunday_and_compares_with_the_week_before(): void
    {
        // Tuesday 10 Nov 2026.
        $w = ReportWindows::for('week', $this->at('2026-11-10 09:00'));

        $this->assertSame('2026-11-09', $w['start']);
        $this->assertSame('2026-11-15', $w['end']);
        $this->assertSame('2026-11-02', $w['prev_start']);
        $this->assertSame('2026-11-08', $w['prev_end']);
    }

    public function test_month_and_last_month(): void
    {
        $now = $this->at('2026-03-31 12:00');

        $month = ReportWindows::for('month', $now);
        $this->assertSame(['2026-03-01', '2026-03-31', '2026-02-01', '2026-02-28'], [$month['start'], $month['end'], $month['prev_start'], $month['prev_end']]);

        $last = ReportWindows::for('last_month', $now);
        $this->assertSame(['2026-02-01', '2026-02-28', '2026-01-01', '2026-01-31'], [$last['start'], $last['end'], $last['prev_start'], $last['prev_end']]);
    }

    public function test_quarter_and_year_cross_the_year_boundary(): void
    {
        $now = $this->at('2026-01-15 12:00');

        $quarter = ReportWindows::for('quarter', $now);
        $this->assertSame(['2026-01-01', '2026-03-31', '2025-10-01', '2025-12-31'], [$quarter['start'], $quarter['end'], $quarter['prev_start'], $quarter['prev_end']]);

        $year = ReportWindows::for('year', $now);
        $this->assertSame(['2026-01-01', '2026-12-31', '2025-01-01', '2025-12-31'], [$year['start'], $year['end'], $year['prev_start'], $year['prev_end']]);
    }

    public function test_unknown_key_falls_back_to_the_month(): void
    {
        $w = ReportWindows::for('decade', $this->at('2026-11-10'));

        $this->assertSame('month', $w['key']);
        $this->assertSame('month', ReportWindows::normalise('decade'));
        $this->assertSame('month', ReportWindows::normalise(null));
        $this->assertSame('week', ReportWindows::normalise('week'));
    }

    public function test_all_returns_every_period_keyed(): void
    {
        $all = ReportWindows::all($this->at('2026-11-10'));

        $this->assertSame(ReportWindows::KEYS, array_keys($all));
    }
}
