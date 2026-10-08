<?php

namespace App\Email\Sending;

use App\Email\Data\Draft;
use App\Email\Files\EmailFiles;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailFile;
use Throwable;

/**
 * Decides whether a draft may be handed to a provider at all. A draft that
 * fails here is kept on its attempt and never leaves the CRM.
 */
class DraftValidator
{
    public const MISSING_TO = 'validation_missing_to';

    public const WRONG_SENDER = 'validation_wrong_sender';

    public const EMPTY_MESSAGE = 'validation_empty_message';

    public const ATTACHMENT_UNAVAILABLE = 'validation_attachment_unavailable';

    public function __construct(private readonly EmailFiles $files) {}

    /** @return string|null A validation code, or null when the draft may be sent. */
    public function check(EmailConnection $connection, Draft $draft): ?string
    {
        if (! $draft->hasRecipients()) {
            return self::MISSING_TO;
        }

        // Mail goes out as the connected mailbox, never as an address typed into a draft.
        if ($draft->from->address !== strtolower(trim($connection->from_email))) {
            return self::WRONG_SENDER;
        }

        if (trim($draft->subject) === '' && trim((string) $draft->textBody) === '' && trim(strip_tags((string) $draft->htmlBody)) === '' && $draft->attachments === []) {
            return self::EMPTY_MESSAGE;
        }

        // One file that cannot go out stops the whole message: it is never sent without it.
        foreach ($draft->attachments as $attachment) {
            if (! $this->maySend($connection, $attachment->storageKey)) {
                return self::ATTACHMENT_UNAVAILABLE;
            }
        }

        return null;
    }

    /** An email file uploaded to this very mailbox, stored and fit to hand out. */
    private function maySend(EmailConnection $connection, string $storageKey): bool
    {
        try {
            $file = EmailFile::withoutGlobalScopes()
                ->where('company_id', $connection->company_id)
                ->where('connection_id', $connection->id)
                ->where('storage_key', $storageKey)
                ->first();

            return $file !== null && $this->files->isUsable($file);
        } catch (Throwable) {
            return false;
        }
    }
}
