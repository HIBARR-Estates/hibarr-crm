<?php

namespace App\Email\Contracts;

/**
 * Reads the stored bytes of an outbound attachment by its storage key.
 * Adapters use this instead of touching a disk or the file gateway directly.
 */
interface AttachmentStore
{
    /** Null when the file is missing or may not be sent (not scanned, unreadable). */
    public function read(string $storageKey): ?string;
}
