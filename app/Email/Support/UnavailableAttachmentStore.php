<?php

namespace App\Email\Support;

use App\Email\Contracts\AttachmentStore;

/**
 * Stand-in until email files exist: no attachment can be read, so a draft
 * that carries one is refused rather than sent without it.
 */
class UnavailableAttachmentStore implements AttachmentStore
{
    public function read(string $storageKey): ?string
    {
        return null;
    }
}
