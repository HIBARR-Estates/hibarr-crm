<?php

namespace App\Email\Linking;

use App\Email\Authorization\EmailAccess;
use App\Email\Enums\ReviewStatus;
use App\Email\Models\EmailConversation;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Support\SafePreview;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;

/**
 * The email history of a lead or deal as one user sees it: one event per
 * message, however many mailboxes hold a copy of it.
 *
 * Which messages a user gets is EmailAccess's decision, not this class's.
 */
class RecordHistory
{
    public function __construct(private readonly EmailAccess $access) {}

    public function for(User $viewer, Model $record, int $perPage): LengthAwarePaginator
    {
        return $this->access->messagesOnRecord($viewer, $record)->paginate($perPage);
    }

    /**
     * Headers and a plain-text preview. The headers are the message's own, so
     * every To/Cc participant shows — not just the viewer's mailbox.
     *
     * @param  iterable<EmailMessage>  $messages
     * @return list<array<string, mixed>>
     */
    public function present(User $viewer, iterable $messages): array
    {
        $messages = collect($messages);

        // A user can hold one message more than once (two mailboxes, or moved copies); the first stands for it.
        $copies = $this->ownProjectedCopies($viewer)
            ->whereIn('message_id', $messages->pluck('id')->all())
            ->orderBy('id')
            ->get()
            ->unique('message_id')
            ->keyBy('message_id');

        $conversations = EmailConversation::withoutGlobalScopes()
            ->whereIn('id', $messages->pluck('conversation_id')->filter()->unique()->all())
            ->pluck('uuid', 'id');

        return $messages->map(function (EmailMessage $message) use ($copies, $conversations) {
            /** @var EmailMailboxCopy|null $copy */
            $copy = $copies->get($message->id);

            return [
                'id' => $message->uuid,
                'conversation_id' => $conversations->get($message->conversation_id),
                'copy_id' => $copy?->uuid,
                'direction' => $copy?->direction->value,
                'from' => $message->from_email !== null
                    ? ['address' => $message->from_email, 'name' => $message->from_name]
                    : null,
                'to' => $message->to_recipients ?? [],
                'cc' => $message->cc_recipients ?? [],
                'subject' => $message->subject,
                'sent_at' => $message->sent_at?->toIso8601String(),
                'preview' => SafePreview::from($message->text_body, $message->html_raw),
                'has_attachments' => (bool) $message->has_attachments,
            ];
        })->values()->all();
    }

    private function ownProjectedCopies(User $viewer)
    {
        return $this->access->ownCopies($viewer)->where('review_status', ReviewStatus::None);
    }
}
