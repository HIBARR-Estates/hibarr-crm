<?php

namespace Tests\Feature\EntitySummary;

use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class DealSummaryControllerTest extends TestCase
{
    use SetsFeatureFlags;

    public function test_ai_summary_routes_return_404_when_flag_disabled(): void
    {
        $this->setFeatureFlag('sales.ai-entity-summary', false);
        $this->withoutMiddleware();

        $response = $this->get('/account/deals/1/ai-summary');

        $response->assertStatus(404);
    }

    public function test_deal_ai_summary_flag_is_known(): void
    {
        $this->assertContains('sales.ai-entity-summary', config('features.known_flags'));
    }
}
