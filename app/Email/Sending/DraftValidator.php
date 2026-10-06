<?php

namespace App\Email\Sending;

use App\Email\Data\Draft;
use App\Email\Models\EmailConnection;

/**
 * Decides whether a draft may be handed to a provider at all. A draft that
 * fails here is kept on its attempt and never leaves the CRM.
 */
class DraftValidator
{
    public const MISSING_TO = 'validation_missing_to';

    public const WRONG_SENDER = 'validation_wrong_sender';

    public const EMPTY_MESSAGE = 'validation_empty_message';

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

        return null;
    }
}
