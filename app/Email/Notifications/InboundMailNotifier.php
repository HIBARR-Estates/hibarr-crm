<?php

namespace App\Email\Notifications;

use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * Tells the mailbox owner that a new inbound copy arrived.
 * A later sync of the same provider message does not call this.
 */
class InboundMailNotifier
{
    private const SENDER_LIMIT = 120;

    private const SUBJECT_LIMIT = 180;

    public function notify(EmailConnection $connection, EmailMailboxCopy $copy): void
    {
        $user = User::withoutGlobalScopes()->find($connection->user_id);

        if ($user === null) {
            return;
        }

        $copy->loadMissing('message');
        $message = $copy->message;

        $user->notify(new InboundMailNotification(
            copyId: (string) $copy->uuid,
            sender: Str::limit($this->sender($message?->from_name, $message?->from_email), self::SENDER_LIMIT, ''),
            subject: Str::limit((string) ($message?->subject ?? ''), self::SUBJECT_LIMIT, ''),
        ));
    }

    private function sender(?string $name, ?string $email): string
    {
        $name = trim((string) $name);
        $email = trim((string) $email);

        if ($name !== '' && $email !== '') {
            return $name.' <'.$email.'>';
        }

        return $name !== '' ? $name : $email;
    }
}
