<?php

namespace App\Email\Data;

final class ConnectionHealth
{
    /**
     * @param  string|null  $errorCode  Short CRM code, never a raw provider response.
     */
    public function __construct(
        public readonly HealthState $state,
        public readonly ?string $errorCode = null,
        public readonly ?int $retryAfterSeconds = null,
    ) {}

    public static function ok(): self
    {
        return new self(HealthState::Ok);
    }

    public static function needsReconnect(?string $errorCode = null): self
    {
        return new self(HealthState::NeedsReconnect, $errorCode);
    }

    public static function quotaBackoff(?int $retryAfterSeconds = null, ?string $errorCode = null): self
    {
        return new self(HealthState::QuotaBackoff, $errorCode, $retryAfterSeconds);
    }

    public static function unreachable(?string $errorCode = null): self
    {
        return new self(HealthState::Unreachable, $errorCode);
    }

    public function isOk(): bool
    {
        return $this->state === HealthState::Ok;
    }
}
