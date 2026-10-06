<?php

namespace App\Email\Exceptions;

use RuntimeException;

/**
 * Email may not be used here right now: the feature is off, the user is not
 * in the pilot, or the mailbox is not active. Nothing was sent or stored.
 */
class EmailUnavailableException extends RuntimeException
{
    public function __construct(public readonly string $reason)
    {
        parent::__construct("Email is unavailable: {$reason}");
    }
}
