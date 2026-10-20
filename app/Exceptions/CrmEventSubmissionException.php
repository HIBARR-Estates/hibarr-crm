<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * A CRM event submission was refused.
 *
 * Carries the HTTP status the API should answer with, so the controller can
 * report the reason instead of a generic success. Thrown before anything is
 * written, so a refused submission creates no event, stamps no first contact
 * and dispatches nothing.
 */
class CrmEventSubmissionException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 422)
    {
        parent::__construct($message);
    }
}
