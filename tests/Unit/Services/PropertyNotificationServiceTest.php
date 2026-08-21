<?php

namespace Tests\Unit\Services;

use App\Models\Property;
use App\Services\PropertyNotificationService;
use Tests\TestCase;

class PropertyNotificationServiceTest extends TestCase
{
    public function test_deal_linked_agents_returns_empty_without_product(): void
    {
        $property = new Property(['company_id' => 1]);
        $property->id = 12;
        $property->product_id = null;

        $recipients = app(PropertyNotificationService::class)->dealLinkedAgents($property);

        $this->assertTrue($recipients->isEmpty());
    }
}
