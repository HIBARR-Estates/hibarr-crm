<?php

namespace App\Email\Linking;

use App\Email\Enums\LinkableType;
use App\Email\Enums\ReviewStatus;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailRecordLink;
use App\Models\Deal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * The mail projected onto a lead or deal: messages of the conversations
 * linked to it, oldest first. A message appears once however many mailboxes
 * hold it, and only while at least one of those copies is out of review —
 * a copy still in someone's private review, or dismissed, projects nothing.
 *
 * A deal also shows what is linked to its lead. Nothing is copied or
 * re-linked for that: the deal's lead_id is read at query time, so a deal
 * created after the mail arrived shows it straight away, and a conversation
 * linked to both the lead and the deal still appears once.
 *
 * This is the query only. Who may read what it returns is EmailAccess's call.
 */
class RecordFeed
{
    /** Ids of the conversations on the record, each once. */
    public function conversations(Model $record): Builder
    {
        $type = LinkableType::tryFromModel($record);
        $leadId = $record instanceof Deal ? $record->getAttribute('lead_id') : null;

        return EmailRecordLink::withoutGlobalScopes()
            ->where('company_id', $record->getAttribute('company_id'))
            // No record type we know of means nothing is linked to it.
            ->when($type === null, fn ($query) => $query->whereRaw('1 = 0'))
            ->where(fn ($query) => $query
                ->where(fn ($direct) => $direct
                    ->where('linkable_type', $type)
                    ->where('linkable_id', $record->getKey()))
                ->when($leadId !== null, fn ($query) => $query->orWhere(fn ($viaLead) => $viaLead
                    ->where('linkable_type', LinkableType::Lead)
                    ->where('linkable_id', $leadId))))
            ->select('conversation_id')
            ->distinct();
    }

    public function messages(Model $record): Builder
    {
        $conversations = $this->conversations($record);

        $projected = EmailMailboxCopy::withoutGlobalScopes()
            ->where('company_id', $record->getAttribute('company_id'))
            ->where('review_status', ReviewStatus::None)
            ->select('message_id');

        return EmailMessage::withoutGlobalScopes()
            ->where('company_id', $record->getAttribute('company_id'))
            ->whereIn('conversation_id', $conversations)
            ->whereIn('id', $projected)
            ->orderBy('sent_at')
            ->orderBy('id');
    }
}
