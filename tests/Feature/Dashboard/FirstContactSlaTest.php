<?php

namespace Tests\Feature\Dashboard;

use App\Services\Dashboard\DashboardMetricsService;
use Tests\TestCase;

/**
 * The first-contact SLA is now configurable per company, down to the second,
 * which means the value reaching the metrics layer is user input rather than
 * a constant.
 *
 * It is interpolated straight into raw SQL (`INTERVAL {$slaSeconds} SECOND`),
 * so the cast to int is load-bearing, not cosmetic.
 */
class FirstContactSlaTest extends TestCase
{
    public function test_a_configured_value_inside_the_bounds_is_used_as_is(): void
    {
        $this->assertSame(4 * 3600, DashboardMetricsService::clampSlaSeconds(4 * 3600));
        $this->assertSame(90, DashboardMetricsService::clampSlaSeconds(90));
        $this->assertSame(
            DashboardMetricsService::SLA_SECONDS_MAX,
            DashboardMetricsService::clampSlaSeconds(DashboardMetricsService::SLA_SECONDS_MAX)
        );
    }

    public function test_an_unset_value_falls_back_to_the_default(): void
    {
        // A company that has never opened the settings screen has no row at all.
        $this->assertSame(DashboardMetricsService::SLA_SECONDS_DEFAULT, DashboardMetricsService::clampSlaSeconds(null));
        $this->assertSame(DashboardMetricsService::SLA_SECONDS_DEFAULT, DashboardMetricsService::clampSlaSeconds(''));
        $this->assertSame(DashboardMetricsService::SLA_SECONDS_DEFAULT, DashboardMetricsService::clampSlaSeconds(0));
    }

    public function test_an_out_of_range_value_falls_back_rather_than_clamping_to_the_edge(): void
    {
        // Deliberate: reading a bad 0 or -1 as "1 minute" would turn the whole
        // team's SLA red on a value nobody chose. The default is the safer lie.
        $this->assertSame(DashboardMetricsService::SLA_SECONDS_DEFAULT, DashboardMetricsService::clampSlaSeconds(-5));
        $this->assertSame(
            DashboardMetricsService::SLA_SECONDS_DEFAULT,
            DashboardMetricsService::clampSlaSeconds(DashboardMetricsService::SLA_SECONDS_MAX + 1)
        );
    }

    public function test_the_value_is_cast_to_an_integer_before_it_reaches_raw_sql(): void
    {
        $this->assertSame(120, DashboardMetricsService::clampSlaSeconds('120'));

        // The one that matters. Asserting the *type* rather than the value:
        // (int) '86400 OR 1=1' is 86400, which equals the default by
        // coincidence, so an equality check here would pass without proving
        // anything. What makes the INTERVAL clause safe is that a string can
        // never come back.
        $this->assertIsInt(DashboardMetricsService::clampSlaSeconds('86400 OR 1=1'));
        $this->assertIsInt(DashboardMetricsService::clampSlaSeconds('nonsense'));
        $this->assertIsInt(DashboardMetricsService::clampSlaSeconds('2592000; DROP TABLE leads'));

        // Non-numeric text casts to 0, which is out of range, so it lands on
        // the default rather than becoming a zero-second SLA.
        $this->assertSame(
            DashboardMetricsService::SLA_SECONDS_DEFAULT,
            DashboardMetricsService::clampSlaSeconds('nonsense')
        );
    }
}
