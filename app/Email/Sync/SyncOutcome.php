<?php

namespace App\Email\Sync;

/** What one sync run did, for callers and tests. Carries counts and a short code only. */
final class SyncOutcome
{
    private function __construct(
        public readonly bool $ran,
        public readonly int $ingested = 0,
        public readonly ?string $reason = null,
    ) {}

    public static function skipped(string $reason): self
    {
        return new self(false, 0, $reason);
    }

    public static function synced(int $ingested): self
    {
        return new self(true, $ingested);
    }

    public static function failed(int $ingested, string $errorCode): self
    {
        return new self(true, $ingested, $errorCode);
    }

    public function succeeded(): bool
    {
        return $this->ran && $this->reason === null;
    }
}
