<?php

namespace Tests\Unit\Http\Controllers\Api;

use App\Http\Controllers\Api\DealContactApiController;
use App\Models\DealAutomation;
use App\Models\Lead;
use App\Services\DealAutomationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use ReflectionMethod;
use Tests\TestCase;

/**
 * fireLeadApiTrigger() is the only thing standing between the external API's
 * saveQuietly() writes (which never fire LeadObserver) and an automation
 * built on lead_created_api/lead_updated_api ever seeing them — see
 * DealContactApiController::saveContact()/resolveContact().
 */
class DealContactApiControllerTriggerTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_it_fires_lead_created_api_for_a_new_lead(): void
    {
        $lead = Lead::factory()->create();
        // Eloquent sets this on the instance during the insert itself, so a
        // freshly created factory record already reflects it correctly.
        $this->assertTrue($lead->wasRecentlyCreated);

        $mock = Mockery::mock(DealAutomationService::class);
        $mock->shouldReceive('processLead')
            ->once()
            ->with($lead, DealAutomation::TRIGGER_LEAD_CREATED_API);
        $this->app->instance(DealAutomationService::class, $mock);

        $this->invokeFireLeadApiTrigger($lead);
    }

    public function test_it_fires_lead_updated_api_for_an_existing_lead(): void
    {
        $lead = Lead::factory()->create();
        $lead = Lead::find($lead->id); // fresh load — wasRecentlyCreated is false
        $this->assertFalse($lead->wasRecentlyCreated);

        $mock = Mockery::mock(DealAutomationService::class);
        $mock->shouldReceive('processLead')
            ->once()
            ->with($lead, DealAutomation::TRIGGER_LEAD_UPDATED_API);
        $this->app->instance(DealAutomationService::class, $mock);

        $this->invokeFireLeadApiTrigger($lead);
    }

    private function invokeFireLeadApiTrigger(Lead $lead): void
    {
        $controller = new DealContactApiController;
        $method = new ReflectionMethod($controller, 'fireLeadApiTrigger');
        $method->setAccessible(true);
        $method->invoke($controller, $lead);
    }
}
