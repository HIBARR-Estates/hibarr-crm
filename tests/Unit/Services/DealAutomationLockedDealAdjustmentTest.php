<?php

namespace Tests\Unit\Services;

use App\Models\Deal;
use App\Models\DealAutomationAction;
use App\Services\CrmEventService;
use App\Services\DealAutomationService;
use App\Services\DealValueResolver;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use ReflectionMethod;
use Tests\TestCase;

/**
 * set_field_value writes with saveQuietly(), which skips DealObserver::updating
 * — the guard that reverts value-affecting edits on a locked deal. The deal
 * adjustment fields therefore have to honour the lock themselves, otherwise an
 * automation (e.g. one running after a lock_deal action in the same sequence)
 * silently rewrites the discount/deduction and the derived value.
 */
class DealAutomationLockedDealAdjustmentTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');
    }

    /**
     * @dataProvider adjustmentFields
     */
    public function test_adjustment_fields_are_not_written_to_a_locked_deal(string $field, string $value): void
    {
        $deal = $this->partialDeal(['is_locked' => true]);

        $this->setFieldValue($deal, $field, $value);

        $this->assertSame(0, $deal->saveQuietlyCalls, 'A locked deal must not be saved by the automation.');
        $this->assertNotSame($value, (string) $deal->{$field});
        $this->assertSame(1000.0, (float) $deal->value);
    }

    /**
     * @dataProvider adjustmentFields
     */
    public function test_adjustment_fields_are_not_written_to_a_commission_locked_deal(string $field, string $value): void
    {
        $deal = $this->partialDeal(['commission_locked' => true]);

        $this->setFieldValue($deal, $field, $value);

        $this->assertSame(0, $deal->saveQuietlyCalls);
        $this->assertSame(1000.0, (float) $deal->value);
    }

    public function test_adjustment_fields_are_written_to_an_unlocked_deal(): void
    {
        $deal = $this->partialDeal([]);

        // The unlocked path recomputes the value and records a CRM event, both
        // of which query tables this unit test doesn't create.
        $this->mock(DealValueResolver::class, function ($mock) {
            $mock->shouldReceive('getBreakdown')->andReturn([
                'calculated_value' => 1000.0,
                'computed_value' => 1000.0,
            ]);
        });
        $this->mock(CrmEventService::class, function ($mock) {
            $mock->shouldReceive('record')->andReturnNull();
        });

        $this->setFieldValue($deal, 'deduction_note', 'Agreed on call');

        $this->assertSame(1, $deal->saveQuietlyCalls);
        $this->assertSame('Agreed on call', $deal->deduction_note);
    }

    public static function adjustmentFields(): array
    {
        return [
            'discount_value' => ['discount_value', '10%'],
            'deduction_amount' => ['deduction_amount', '250'],
            'deduction_note' => ['deduction_note', 'Rewritten by automation'],
        ];
    }

    /**
     * A Deal that records saves instead of hitting the database.
     */
    private function partialDeal(array $attributes): Deal
    {
        $deal = new class extends Deal
        {
            public int $saveQuietlyCalls = 0;

            public function saveQuietly(array $options = []): bool
            {
                $this->saveQuietlyCalls++;

                return true;
            }
        };

        $deal->forceFill(array_merge([
            'value' => 1000,
            'discount_value' => null,
            'deduction_amount' => null,
            'deduction_note' => null,
            'is_locked' => false,
            'commission_locked' => false,
        ], $attributes));

        return $deal;
    }

    private function setFieldValue(Deal $deal, string $field, string $value): void
    {
        $method = new ReflectionMethod(DealAutomationService::class, 'performSetFieldValue');
        $method->setAccessible(true);

        $method->invoke(
            app(DealAutomationService::class),
            $deal,
            new DealAutomationAction(['action_type' => 'set_field_value', 'field_name' => $field, 'field_value' => $value]),
            null,
        );
    }
}
