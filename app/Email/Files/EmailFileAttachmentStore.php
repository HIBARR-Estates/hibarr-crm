<?php

namespace App\Email\Files;

use App\Email\Contracts\AttachmentStore;
use App\Email\Models\EmailFile;
use Throwable;

/**
 * Hands adapters the bytes of an outbound attachment. Only a stored, usable
 * email file is ever returned; for anything else the answer is null, and the
 * adapter refuses the whole send rather than sending without it.
 */
class EmailFileAttachmentStore implements AttachmentStore
{
    public function __construct(private readonly EmailFiles $files) {}

    public function read(string $storageKey): ?string
    {
        try {
            $file = EmailFile::withoutGlobalScopes()->where('storage_key', $storageKey)->first();

            return $file !== null ? $this->files->bytes($file) : null;
        } catch (Throwable) {
            return null;
        }
    }
}
