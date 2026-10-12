<?php

namespace App\Email\Reads;

use App\Email\Authorization\EmailAccess;
use App\Email\Data\MessageDirection;
use App\Email\Enums\ReviewStatus;
use App\Email\Models\EmailMessage;
use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Who has read what, per user. A message is unread for a user when it was
 * received in one of their own mailboxes and they have not opened it.
 *
 * - Opening marks it read for that user only: a colleague holding the same
 *   message still has it unread, and the provider is never told (\Seen).
 * - It is the message that is read, not the copy, so a second copy or a
 *   repeated sync cannot make it unread twice.
 * - Mail that reaches a user only through a record — a new lead owner, say —
 *   is never unread for them, and what someone has read stays read if a lead
 *   is passed away and back.
 */
class ReadState
{
    private const TABLE = 'email_user_reads';

    public function __construct(private readonly EmailAccess $access) {}

    /** Idempotent. The caller has already checked the user may read the message. */
    public function markRead(User $user, EmailMessage $message): void
    {
        DB::table(self::TABLE)->insertOrIgnore([
            'company_id' => $message->company_id,
            'user_id' => $user->id,
            'message_id' => $message->id,
            'read_at' => now(),
        ]);
    }

    public function unreadCount(User $user): int
    {
        return $this->unreadMessages($user)->count();
    }

    /**
     * Which of these messages are unread for the user.
     *
     * @param  list<int>  $messageIds
     * @return list<int>
     */
    public function unreadAmong(User $user, array $messageIds): array
    {
        if ($messageIds === []) {
            return [];
        }

        return $this->unreadMessages($user)
            ->whereIn('id', $messageIds)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    private function unreadMessages(User $user)
    {
        // Received in the user's own mailbox, and not something they dismissed.
        $received = $this->access->ownCopies($user)
            ->setEagerLoads([])
            ->where('direction', MessageDirection::Inbound)
            ->where('review_status', '!=', ReviewStatus::Dismissed)
            ->select('message_id');

        return EmailMessage::withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->whereIn('id', $received)
            ->whereNotIn('id', fn (Builder $query) => $query
                ->from(self::TABLE)
                ->where('user_id', $user->id)
                ->select('message_id'));
    }
}
