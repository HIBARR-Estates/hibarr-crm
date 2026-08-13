<?php

namespace Tests\Feature\Dashboard;

use App\Services\Dashboard\DashboardMetricsService;
use Tests\TestCase;

/**
 * The first-contact SLA is now configurable per company, which means the value
 * reaching the metrics layer is user input rather than a constant.
 *
 * It is interpolated straight into raw SQL (`INTERVAL {$slaHours} HOUR`), so
 * the cast to int is load-bearing, not cosmetic.
 */
class FirstContactSlaTest extends TestCase
{
    public function test_a_configured_value_inside_the_bounds_is_used_as_is(): void
    {
        $this->assertSame(4, DashboardMetricsService::clampSlaHours(4));
        $this->assertSame(48, DashboardMetricsService::clampSlaHours(48));
        $this->assertSame(
            DashboardMetricsService::SLA_HOURS_MAX,
            DashboardMetricsService::clampSlaHours(DashboardMetricsService::SLA_HOURS_MAX)
        );
    }

    public function test_an_unset_value_falls_back_to_the_default(): void
    {
        // A company that has never opened the settings screen has no row at all.
        $this->assertSame(DashboardMetricsService::SLA_HOURS_DEFAULT, DashboardMetricsService::clampSlaHours(null));
        $this->assertSame(DashboardMetricsService::SLA_HOURS_DEFAULT, DashboardMetricsService::clampSlaHours(''));
        $this->assertSame(DashboardMetricsService::SLA_HOURS_DEFAULT, DashboardMetricsService::clampSlaHours(0));
    }

    public function test_an_out_of_range_value_falls_back_rather_than_clamping_to_the_edge(): void
    {
        // Deliberate: reading a bad 0 or -1 as "1 hour" would turn the whole
        // team's SLA red on a value nobody chose. The default is the safer lie.
        $this->assertSame(DashboardMetricsService::SLA_HOURS_DEFAULT, DashboardMetricsService::clampSlaHours(-5));
        $this->assertSame(
            DashboardMetricsService::SLA_HOURS_DEFAULT,
            DashboardMetricsService::clampSlaHours(DashboardMetricsService::SLA_HOURS_MAX + 1)
        );
    }

    public function test_the_value_is_cast_to_an_integer_before_it_reaches_raw_sql(): void
    {
        $this->assertSame(12, DashboardMetricsService::clampSlaHours('12'));

        // The one that matters. Asserting the *type* rather than the value:
        // (int) '24 OR 1=1' is 24, which equals the default by coincidence, so
        // an equality check here would pass without proving anything. What
        // makes the INTERVAL clause safe is that a string can never come back.
        $this->assertIsInt(DashboardMetricsService::clampSlaHours('24 OR 1=1'));
        $this->assertIsInt(DashboardMetricsService::clampSlaHours('nonsense'));
        $this->assertIsInt(DashboardMetricsService::clampSlaHours('720; DROP TABLE leads'));

        // Non-numeric text casts to 0, which is out of range, so it lands on
        // the default rather than becoming a zero-hour SLA.
        $this->assertSame(
            DashboardMetricsService::SLA_HOURS_DEFAULT,
            DashboardMetricsService::clampSlaHours('nonsense')
        );
    }
}
