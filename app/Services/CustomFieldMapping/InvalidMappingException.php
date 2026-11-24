<?php

namespace App\Services\CustomFieldMapping;

use RuntimeException;

/**
 * A mapping request that can never run as asked (unsupported combination,
 * missing target, destructive option without confirmation, ...). The message
 * is safe to show to the admin as-is.
 */
class InvalidMappingException extends RuntimeException
{
    /** @param  array<string, mixed>  $report  Dry-run report to hand back with the error, when there is one. */
    public function __construct(string $message, public readonly array $report = [])
    {
        parent::__construct($message);
    }
}
