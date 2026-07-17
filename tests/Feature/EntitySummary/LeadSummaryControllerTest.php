<?php

namespace Tests\Feature\EntitySummary;

use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class LeadSummaryControllerTest extends TestCase
{
    use SetsFeatureFlags;

    public function test_ai_summary_routes_return_404_when_flag_disabled(): void
    {
        $this->setFeatureFlag('crm.lead-ai-summary', false);
        $this->withoutMiddleware();

        $response = $this->get('/account/lead-contact/1/ai-summary');

        $response->assertStatus(404);
    }

    public function test_lead_ai_summary_flag_is_known(): void
    {
        $this->assertContains('crm.lead-ai-summary', config('features.known_flags'));
    }
}
