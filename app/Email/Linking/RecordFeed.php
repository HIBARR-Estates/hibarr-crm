<?php

namespace App\Email\Linking;

use App\Email\Enums\LinkableType;
use App\Email\Enums\ReviewStatus;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailRecordLink;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * The mail projected onto a lead or deal: messages of the conversations
 * linked to it, oldest first. A message appears once however many mailboxes
 * hold it, and only while at least one of those copies is out of review —
 * a copy still in someone's private review, or dismissed, projects nothing.
 *
 * This is the query only. Who may read what it returns is EmailAccess's call.
 */
class RecordFeed
{
    public function messages(Model $record): Builder
    {
        $type = LinkableType::tryFromModel($record);

        $conversations = EmailRecordLink::withoutGlobalScopes()
            ->where('company_id', $record->getAttribute('company_id'))
            ->where('linkable_type', $type)
            ->where('linkable_id', $record->getKey())
            ->select('conversation_id');

        $projected = EmailMailboxCopy::withoutGlobalScopes()
            ->where('company_id', $record->getAttribute('company_id'))
            ->where('review_status', ReviewStatus::None)
            ->select('message_id');

        return EmailMessage::withoutGlobalScopes()
            ->where('company_id', $record->getAttribute('company_id'))
            // No record type we know of means nothing is linked to it.
            ->when($type === null, fn ($query) => $query->whereRaw('1 = 0'))
            ->whereIn('conversation_id', $conversations)
            ->whereIn('id', $projected)
            ->orderBy('sent_at')
            ->orderBy('id');
    }
}
