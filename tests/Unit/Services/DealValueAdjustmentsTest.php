<?php

namespace Tests\Unit\Services;

use App\Models\Deal;
use App\Services\DealValueResolver;
use Tests\TestCase;

/**
 * The discount and deduction arithmetic, independent of where the base came from.
 *
 * The base is the point: a manual deal is priced on the figure someone typed,
 * so a percentage discount there has to come off that figure rather than off
 * product and package totals the deal was never priced on. Both sources run
 * through the same method so the two can't drift.
 */
class DealValueAdjustmentsTest extends TestCase
{
    private function resolver(): DealValueResolver
    {
        return app(DealValueResolver::class);
    }

    private function deal(array $attributes = []): Deal
    {
        return new Deal($attributes);
    }

    public function test_a_percentage_discount_comes_off_whatever_base_it_is_given(): void
    {
        $deal = $this->deal(['discount_type' => 'percent', 'discount_value' => 10]);

        $this->assertSame(200.0, $this->resolver()->applyAdjustments($deal, 2000)['discount']);
        $this->assertSame(150.0, $this->resolver()->applyAdjustments($deal, 1500)['discount']);
    }

    public function test_discount_and_deduction_both_apply(): void
    {
        $deal = $this->deal([
            'discount_type' => 'percent',
            'discount_value' => 10,
            'deduction_amount' => 100,
        ]);

        // 2000 - 200 - 100
        $this->assertSame(1700.0, $this->resolver()->applyAdjustments($deal, 2000)['net']);
    }

    public function test_a_fixed_discount_is_capped_at_the_base(): void
    {
        $deal = $this->deal(['discount_type' => 'fixed', 'discount_value' => 500]);
        $result = $this->resolver()->applyAdjustments($deal, 50);

        $this->assertSame(50.0, $result['discount']);
        $this->assertSame(0.0, $result['net']);
    }

    /** A deal can be discounted to nothing, but never to less than nothing. */
    public function test_adjustments_never_drive_the_value_negative(): void
    {
        $deal = $this->deal([
            'discount_type' => 'fixed',
            'discount_value' => 500,
            'deduction_amount' => 900,
        ]);
        $result = $this->resolver()->applyAdjustments($deal, 50);

        $this->assertSame(0.0, $result['net']);
        $this->assertGreaterThanOrEqual(0.0, $result['deduction']);
    }

    public function test_a_percentage_over_one_hundred_is_clamped(): void
    {
        $deal = $this->deal(['discount_type' => 'percent', 'discount_value' => 250]);

        $this->assertSame(1000.0, $this->resolver()->applyAdjustments($deal, 1000)['discount']);
    }

    public function test_no_configured_discount_leaves_the_base_untouched(): void
    {
        $result = $this->resolver()->applyAdjustments($this->deal(), 1234.56);

        $this->assertSame(0.0, $result['discount']);
        $this->assertSame(0.0, $result['deduction']);
        $this->assertSame(1234.56, $result['net']);
    }
}
