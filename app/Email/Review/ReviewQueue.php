<?php

namespace App\Email\Review;

use App\Email\Authorization\EmailAccess;
use App\Email\Enums\ReviewStatus;
use App\Email\Files\EmailFiles;
use App\Email\Matching\LeadDirectory;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Reads\ReadState;
use App\Email\Search\MessageSearch;
use App\Email\Support\SafePreview;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * A mailbox owner's private review: their own copies that are on no record.
 * Nobody else can reach these — every query starts from EmailAccess's own-copies
 * scope.
 */
class ReviewQueue
{
    public function __construct(
        private readonly LeadDirectory $leads,
        private readonly EmailAccess $access,
        private readonly EmailFiles $files,
        private readonly MessageSearch $search,
        private readonly ReadState $reads,
    ) {}

    public function for(User $owner): Builder
    {
        return $this->owned($owner)->where('review_status', ReviewStatus::Unlinked);
    }

    /**
     * The owner's review, narrowed to a search term. The search runs inside
     * their own copies, so it cannot reach anyone else's unlinked mail.
     */
    public function search(User $owner, string $term): Builder
    {
        $matching = $this->search->filter(
            EmailMessage::withoutGlobalScopes()->where('company_id', $owner->company_id),
            $term,
        )->select('id');

        return $this->for($owner)->whereIn('message_id', $matching);
    }

    /** Every copy in the user's own mailboxes, in review or not. */
    public function owned(User $owner): Builder
    {
        return $this->access->ownCopies($owner);
    }

    /**
     * Headers and a plain-text preview only: no body, no raw HTML, and no
     * provider ids. When the other party is on a record the owner may not
     * see, that is flagged — with nothing about the record itself.
     *
     * @param  iterable<EmailMailboxCopy>  $copies
     * @return list<array<string, mixed>>
     */
    public function present(User $owner, iterable $copies, ?string $term = null): array
    {
        $counterparts = [];

        foreach ($copies as $copy) {
            $counterparts[$copy->id] = $copy->message !== null && $copy->connection !== null
                ? $this->leads->counterpartAddresses($copy->connection, $copy, $copy->message)
                : [];
        }

        $addresses = array_values(array_unique(array_merge([], ...array_values($counterparts))));
        $hidden = $addresses !== []
            ? $this->leads->addressesHiddenFrom($owner, (int) $owner->company_id, $addresses)
            : [];

        $messageIds = [];

        foreach ($copies as $copy) {
            $messageIds[] = (int) $copy->message_id;
        }

        $messageIds = array_values(array_unique($messageIds));
        $files = $this->files->summaries($messageIds);
        $unread = $this->reads->unreadAmong($owner, $messageIds);
        $items = [];

        foreach ($copies as $copy) {
            $message = $copy->message;

            $items[] = ($term !== null && $message !== null ? ['snippet' => $this->search->snippet($message, $term)] : []) + [
                'id' => $copy->uuid,
                'message_uuid' => $message?->uuid,
                'unread' => in_array((int) $copy->message_id, $unread, true),
                'connection_id' => $copy->connection?->uuid,
                'direction' => $copy->direction->value,
                'folder' => $copy->folder,
                'from' => $message?->from_email !== null
                    ? ['address' => $message->from_email, 'name' => $message->from_name]
                    : null,
                'to' => $message?->to_recipients ?? [],
                'cc' => $message?->cc_recipients ?? [],
                'subject' => $message?->subject,
                'sent_at' => $message?->sent_at?->toIso8601String(),
                'preview' => SafePreview::from($message?->text_body, $message?->html_raw),
                'has_attachments' => (bool) $message?->has_attachments,
                'files' => $files->get($copy->message_id, []),
                'record_exists' => array_intersect($counterparts[$copy->id], $hidden) !== [],
            ];
        }

        return $items;
    }
}
