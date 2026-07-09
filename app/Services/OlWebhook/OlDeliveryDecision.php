<?php

namespace App\Services\OlWebhook;

class OlDeliveryDecision
{
    public function isSuccess(int $statusCode): bool
    {
        return $statusCode >= 200 && $statusCode < 300;
    }

    public function isRetryableStatus(int $statusCode): bool
    {
        if ($statusCode === 408 || $statusCode === 429) {
            return true;
        }

        return $statusCode >= 500;
    }
}

