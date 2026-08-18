<?php

namespace App\Exceptions;

use InvalidArgumentException;

class LeadContactMethodException extends InvalidArgumentException
{
    /**
     * @param  list<array{lead_id: int, client_name: string|null, match: 'primary'|'alternate'}>  $conflicts
     */
    public function __construct(
        string $message,
        public readonly array $conflicts = [],
    ) {
        parent::__construct($message, 422);
    }
}
