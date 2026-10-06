<?php

namespace App\Email\Review;

use App\Email\Enums\ReviewStatus;
use App\Email\Matching\LeadDirectory;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Support\SafePreview;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * A mailbox owner's private review: their own copies that are on no record.
 * Until EmailAccess exists (E-20) nobody else can reach these — every query
 * starts from the connections the user owns.
 */
class ReviewQueue
{
    public function __construct(private readonly LeadDirectory $leads) {}

    public function for(User $owner): Builder
    {
        $connections = EmailConnection::withoutGlobalScopes()
            ->where('user_id', $owner->id)
            ->where('company_id', $owner->company_id)
            ->select('id');

        return EmailMailboxCopy::withoutGlobalScopes()
            ->with(['message', 'connection'])
            ->where('company_id', $owner->company_id)
            ->whereIn('connection_id', $connections)
            ->where('review_status', ReviewStatus::Unlinked);
    }

    /**
     * Headers and a plain-text preview only: no body, no raw HTML, and no
     * provider ids. When the other party is on a record the owner may not
     * see, that is flagged — with nothing about the record itself.
     *
     * @param  iterable<EmailMailboxCopy>  $copies
     * @return list<array<string, mixed>>
     */
    public function present(User $owner, iterable $copies): array
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

        $items = [];

        foreach ($copies as $copy) {
            $message = $copy->message;

            $items[] = [
                'id' => $copy->uuid,
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
                'record_exists' => array_intersect($counterparts[$copy->id], $hidden) !== [],
            ];
        }

        return $items;
    }
}
