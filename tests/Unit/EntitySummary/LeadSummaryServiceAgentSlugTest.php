<?php

namespace Tests\Unit\EntitySummary;

use App\Services\AiSummary\MockAiSummaryService;
use App\Services\EntitySummary\EntitySummaryValidator;
use App\Services\EntitySummary\LeadSummaryService;
use Tests\TestCase;

class LeadSummaryServiceAgentSlugTest extends TestCase
{
    private function slug(): string
    {
        $service = (new \ReflectionClass(LeadSummaryService::class))->newInstanceWithoutConstructor();
        $method = new \ReflectionMethod(LeadSummaryService::class, 'agentSlug');
        $method->setAccessible(true);

        return $method->invoke($service);
    }

    public function test_the_slug_defaults_to_lead_summary_v1(): void
    {
        config(['services.ai.lead_summary_slug' => 'lead-summary-v1']);

        $this->assertSame('lead-summary-v1', $this->slug());
    }

    public function test_the_slug_can_be_overridden_by_config(): void
    {
        config(['services.ai.lead_summary_slug' => 'lead-summary-v2']);

        $this->assertSame('lead-summary-v2', $this->slug());
    }

    /**
     * The mock stands in for the AI service in local development, so it has to
     * produce something the real validator accepts.
     */
    public function test_the_mock_agent_returns_a_valid_lead_summary(): void
    {
        $summary = (new MockAiSummaryService())->executeAgentBySlug('lead-summary-v1', [
            'lead' => ['type' => 'buyer'],
            'sections' => [],
        ]);

        (new EntitySummaryValidator())->validateLeadSummary($summary);

        $this->assertSame('lead', $summary['primary_risk_source']);
    }
}
