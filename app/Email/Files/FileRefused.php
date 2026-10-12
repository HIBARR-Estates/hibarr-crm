<?php

namespace App\Email\Files;

use RuntimeException;

/** A file the CRM will not hold: too large, a blocked type, empty, or not accepted by storage. */
class FileRefused extends RuntimeException
{
    public function __construct(public readonly string $reason)
    {
        parent::__construct("Email file refused: {$reason}");
    }
}
