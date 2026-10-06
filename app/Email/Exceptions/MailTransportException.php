<?php

namespace App\Email\Exceptions;

use RuntimeException;
use Throwable;

/**
 * A provider call failed. Carries a short CRM error code only — never a raw
 * provider response, message body or token, so it is safe to log and store.
 */
class MailTransportException extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        public readonly bool $retryable = true,
        ?Throwable $previous = null,
    ) {
        parent::__construct("Mail transport failed: {$errorCode}", 0, $previous);
    }
}
