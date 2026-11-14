<?php

namespace Tests\Unit\Dashboard;

use App\Services\Dashboard\DashboardMetricsService;
use ReflectionMethod;
use Tests\TestCase;

class PartnerReferralStalledTest extends TestCase
{
    public function test_flag_is_registered(): void
    {
        $this->assertContains(
            DashboardMetricsService::PARTNER_LEAD_STALLED_FLAG,
            config('features.known_flags'),
        );
    }

    public function test_an_untouched_lead_is_not_stalled_when_the_flag_is_on(): void
    {
        $this->assertFalse($this->stalled(touched: false, idleDays: 45, requireTouch: true));
    }

    public function test_a_touched_idle_lead_is_stalled_when_the_flag_is_on(): void
    {
        $this->assertTrue($this->stalled(touched: true, idleDays: 30, requireTouch: true));
    }

    public function test_a_recently_touched_lead_is_not_stalled(): void
    {
        $this->assertFalse($this->stalled(touched: true, idleDays: 29, requireTouch: true));
    }

    public function test_flag_off_keeps_the_age_only_rule(): void
    {
        $this->assertTrue($this->stalled(touched: false, idleDays: 30, requireTouch: false));
        $this->assertFalse($this->stalled(touched: false, idleDays: 29, requireTouch: false));
    }

    private function stalled(bool $touched, int $idleDays, bool $requireTouch): bool
    {
        $method = new ReflectionMethod(DashboardMetricsService::class, 'referralIsStalled');

        return $method->invoke(null, $touched, $idleDays, 30, $requireTouch);
    }
}
