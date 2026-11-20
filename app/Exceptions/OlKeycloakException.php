<?php

namespace App\Exceptions;

use RuntimeException;

class OlKeycloakException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $httpStatus = 502,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, $httpStatus, $previous);
    }
}
