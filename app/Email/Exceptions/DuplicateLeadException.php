<?php

namespace App\Email\Exceptions;

use App\Models\Lead;
use Illuminate\Support\Collection;
use RuntimeException;

/**
 * A lead already holds this email address, so a second one was not created.
 * Nothing about the mailbox copy changed.
 */
class DuplicateLeadException extends RuntimeException
{
    /**
     * @param  Collection<int, Lead>  $duplicates  Empty when the database refused the address
     *                                             without the CRM being able to say which lead has it.
     */
    public function __construct(public readonly Collection $duplicates)
    {
        parent::__construct('A lead with this email address already exists.');
    }
}
