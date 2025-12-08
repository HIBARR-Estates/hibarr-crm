<?php

namespace App\Exceptions;

use Exception;

class MeetingSummaryException extends Exception
{
    protected $errorCode;
    protected $additionalData;

    public function __construct(string $message, string $errorCode = null, array $additionalData = [], int $code = 400, Exception $previous = null)
    {
        parent::__construct($message, $code, $previous);
        $this->errorCode = $errorCode;
        $this->additionalData = $additionalData;
    }

    public function getErrorCode(): ?string
    {
        return $this->errorCode;
    }

    public function getAdditionalData(): array
    {
        return $this->additionalData;
    }
}
