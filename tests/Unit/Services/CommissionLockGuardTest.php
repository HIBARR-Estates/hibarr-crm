<?php

namespace Tests\Unit\Services;

use App\Models\Deal;
use App\Services\ConditionEvaluatorService;
use App\Services\DealActivityEventService;
use App\Services\DealAutomationService;
use App\Services\DealNotificationService;
use App\Services\DealOfferService;
use App\Services\DealPropertyService;
use App\Services\DealValueResolver;
use App\Services\FieldResolverService;
use App\Services\Notifications\MailDeliveryRecorder;
use App\Services\PackagePipelineRouterService;
use App\Services\PackageRoutingFieldCatalog;
use App\Services\PipelineScopeResolverService;
use Mockery;
use Tests\TestCase;

class CommissionLockGuardTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_apply_and_remove_offers_do_not_touch_a_commission_locked_deal(): void
    {
        $this->expectNotToPerformAssertions();

        $deal = Mockery::mock(Deal::class)->makePartial();
        $deal->shouldReceive('isCommissionLocked')->andReturn(true);
        $deal->shouldNotReceive('loadMissing');
        $deal->shouldNotReceive('offerApplications');

        $resolver = Mockery::mock(DealValueResolver::class);
        $resolver->shouldNotReceive('resolveAndPersist');

        $service = new DealOfferService($resolver);
        $service->applyOffersToDeal($deal);
        $service->removeOffersFromDeal($deal);
    }

    public function test_property_mutations_are_refused_when_commission_locked(): void
    {
        $deal = new Deal(['commission_locked' => true]);

        $service = new DealPropertyService(
            Mockery::mock(DealValueResolver::class),
            Mockery::mock(PackagePipelineRouterService::class),
            Mockery::mock(PackageRoutingFieldCatalog::class),
            Mockery::mock(DealNotificationService::class),
        );

        $this->assertSame('fail', $service->attachExistingProperty($deal, 1)['status']);
        $this->assertSame('fail', $service->detachProperty($deal, 1)['status']);
        $this->assertSame('fail', $service->createFromUnitType($deal, 1, [])['status']);
    }

    public function test_process_skips_commission_locked_deals(): void
    {
        $this->expectNotToPerformAssertions();

        $deal = new Deal;
        $deal->id = 1;
        $deal->is_locked = false;
        $deal->commission_locked = true;

        $service = Mockery::mock(DealAutomationService::class, [
            Mockery::mock(FieldResolverService::class),
            Mockery::mock(ConditionEvaluatorService::class),
            Mockery::mock(MailDeliveryRecorder::class),
        ])->makePartial();
        $service->shouldAllowMockingProtectedMethods();
        $service->shouldNotReceive('getAutomations');

        $service->process($deal, 'deal_updated');
    }

    public function test_routing_skips_commission_locked_deals(): void
    {
        $deal = Mockery::mock(Deal::class)->makePartial();
        $deal->setRawAttributes(['id' => 1, 'is_locked' => false, 'commission_locked' => true]);
        $deal->shouldReceive('loadMissing')->andReturnSelf();
        $deal->shouldReceive('isCommissionLocked')->andReturn(true);

        $router = new PackagePipelineRouterService(
            Mockery::mock(PipelineScopeResolverService::class),
            Mockery::mock(DealActivityEventService::class),
            Mockery::mock(PackageRoutingFieldCatalog::class),
        );

        $this->assertSame('deal_locked', $router->getRoutingSkipReason($deal));
    }
}
