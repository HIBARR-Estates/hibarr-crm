<?php

namespace Tests\Unit\OlWebhook;

use App\Services\OlWebhook\OlDeliveryDecision;
use Tests\TestCase;

class OlDeliveryDecisionTest extends TestCase
{
    public function test_it_identifies_success_status_codes(): void
    {
        $decision = new OlDeliveryDecision();

        $this->assertTrue($decision->isSuccess(200));
        $this->assertTrue($decision->isSuccess(204));
        $this->assertFalse($decision->isSuccess(429));
    }

    public function test_it_identifies_retryable_status_codes(): void
    {
        $decision = new OlDeliveryDecision();

        $this->assertTrue($decision->isRetryableStatus(408));
        $this->assertTrue($decision->isRetryableStatus(429));
        $this->assertTrue($decision->isRetryableStatus(500));
        $this->assertFalse($decision->isRetryableStatus(400));
        $this->assertFalse($decision->isRetryableStatus(422));
    }
}

