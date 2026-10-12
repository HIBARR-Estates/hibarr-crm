<?php

namespace App\Email\Data;

final class SendResult
{
    /**
     * @param  string|null  $providerSubmissionId  Provider's handle for this submission, when it gave one.
     * @param  string|null  $errorCode  Short CRM code, never a raw provider response.
     */
    public function __construct(
        public readonly SendStatus $status,
        public readonly ?string $providerSubmissionId = null,
        public readonly ?string $errorCode = null,
        public readonly ?int $retryAfterSeconds = null,
    ) {}

    public static function accepted(?string $providerSubmissionId = null): self
    {
        return new self(SendStatus::Accepted, $providerSubmissionId);
    }

    public static function rejected(string $errorCode): self
    {
        return new self(SendStatus::Rejected, null, $errorCode);
    }

    /**
     * The provider may or may not have taken it (timeout, dropped connection).
     * The caller must check before resubmitting.
     */
    public static function unknown(?string $errorCode = null, ?string $providerSubmissionId = null): self
    {
        return new self(SendStatus::Unknown, $providerSubmissionId, $errorCode);
    }

    public static function throttled(?int $retryAfterSeconds = null, ?string $errorCode = null): self
    {
        return new self(SendStatus::Throttled, null, $errorCode, $retryAfterSeconds);
    }

    public function isAccepted(): bool
    {
        return $this->status === SendStatus::Accepted;
    }
}
