<?php

namespace Tests\Unit\Automation;

use App\Models\Deal;
use App\Models\DealAutomation;
use App\Models\DealAutomationAction;
use App\Models\Lead;
use App\Services\DealAutomationService;
use App\Services\DealPaymentService;
use App\Support\AutomationV2Feature;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Mockery;
use ReflectionMethod;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

/**
 * The Meta "Purchase" conversion: an optional "use the deal's value" source on
 * the meta_conversion action, and a deal_payment_received trigger that — unlike
 * every other deal trigger — still runs for a deal that has already been paid.
 */
class MetaPurchaseAutomationTest extends TestCase
{
    use SetsFeatureFlags;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');
    }

    public function test_fixed_source_sends_the_fixed_value(): void
    {
        $deal = $this->deal(value: 9000);

        $this->assertSame(1500.0, $this->resolve($deal, $this->action(source: null, fixed: 1500)));
        $this->assertSame(1500.0, $this->resolve($deal, $this->action(source: 'fixed', fixed: 1500)));
    }

    public function test_deal_value_source_sends_the_deals_value(): void
    {
        $this->assertSame(
            9000.5,
            $this->resolve($this->deal(value: 9000.5), $this->action(source: 'deal_value', fixed: 1500)),
        );
    }

    public function test_deal_value_source_falls_back_to_the_fixed_value_when_the_deal_has_none(): void
    {
        $this->assertSame(1500.0, $this->resolve($this->deal(value: null), $this->action(source: 'deal_value', fixed: 1500)));
        $this->assertSame(1500.0, $this->resolve($this->deal(value: 0), $this->action(source: 'deal_value', fixed: 1500)));
        $this->assertSame(0.0, $this->resolve($this->deal(value: null), $this->action(source: 'deal_value', fixed: null)));
    }

    public function test_deal_value_source_on_a_lead_subject_uses_the_fixed_value(): void
    {
        $lead = new Lead;
        $lead->id = 3;

        $this->assertSame(1500.0, $this->resolve($lead, $this->action(source: 'deal_value', fixed: 1500)));
    }

    public function test_paid_deals_are_excluded_from_automations_except_the_payment_received_trigger(): void
    {
        $this->setFeatureFlag('packages.online-payment', true);
        $payments = Mockery::mock(DealPaymentService::class);
        $payments->shouldReceive('hasPaidRequest')->andReturn(true);
        $this->app->instance(DealPaymentService::class, $payments);

        $deal = $this->deal(value: 9000);

        $this->assertTrue($this->excluded($deal, 'deal_updated'));
        $this->assertTrue($this->excluded($deal, null));
        $this->assertFalse(
            $this->excluded($deal, DealAutomation::TRIGGER_DEAL_PAYMENT_RECEIVED),
            'The payment-received trigger exists for the moment a deal becomes paid and must not be skipped for it.'
        );
    }

    public function test_locked_deals_are_excluded_even_for_the_payment_received_trigger(): void
    {
        $deal = $this->deal(value: 9000);
        $deal->is_locked = true;

        $this->assertTrue($this->excluded($deal, DealAutomation::TRIGGER_DEAL_PAYMENT_RECEIVED));
    }

    public function test_payment_received_trigger_is_v2_only(): void
    {
        $this->setFeatureFlag(AutomationV2Feature::FLAG, false);
        $automation = new DealAutomation([
            'trigger' => DealAutomation::TRIGGER_DEAL_PAYMENT_RECEIVED,
            'subject_type' => DealAutomation::SUBJECT_DEAL,
        ]);

        $this->assertFalse(AutomationV2Feature::supportsAutomation($automation));

        $this->setFeatureFlag(AutomationV2Feature::FLAG, true);
        $this->assertTrue(AutomationV2Feature::supportsAutomation($automation));
    }

    private function deal(float|int|null $value): Deal
    {
        $deal = new Deal;
        $deal->id = 7;
        $deal->value = $value;
        $deal->is_locked = false;

        return $deal;
    }

    private function action(?string $source, float|int|null $fixed): DealAutomationAction
    {
        return new DealAutomationAction([
            'action_type' => 'meta_conversion',
            'meta_event_name' => 'Purchase',
            'meta_event_value' => $fixed,
            'meta_event_value_source' => $source,
        ]);
    }

    private function resolve(Deal|Lead $subject, DealAutomationAction $action): float
    {
        $method = new ReflectionMethod(DealAutomationService::class, 'resolveMetaEventValue');
        $method->setAccessible(true);

        return $method->invoke(app(DealAutomationService::class), $subject, $action);
    }

    private function excluded(Deal $deal, ?string $trigger): bool
    {
        $method = new ReflectionMethod(DealAutomationService::class, 'isExcludedFromAutomations');
        $method->setAccessible(true);

        return $method->invoke(app(DealAutomationService::class), $deal, $trigger);
    }
}
