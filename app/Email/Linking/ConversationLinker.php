<?php

namespace App\Email\Linking;

use App\Email\Enums\LinkableType;
use App\Email\Enums\LinkAuditAction;
use App\Email\Enums\ReviewStatus;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailConversation;
use App\Email\Models\EmailLinkAudit;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailRecordLink;
use App\Models\User;
use DomainException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Links and unlinks conversations to leads and deals. A link is a projection:
 * removing it never deletes a message, a mailbox copy, or anything at the
 * provider.
 *
 * This is the domain rule only. Whether the actor may do it is decided
 * before calling (EmailAccess).
 */
class ConversationLinker
{
    /**
     * Idempotent: linking an already-linked record returns the existing link
     * and writes no second audit row.
     *
     * With a mailbox, only that mailbox's copies leave review: linking brings
     * its own earlier messages onto the record, never a colleague's private
     * ones. Doing so for a second mailbox on an existing link is audited too.
     *
     * @param  Model  $record  A Lead or Deal in the conversation's company.
     */
    public function link(EmailConversation $conversation, Model $record, ?User $actor = null, ?EmailConnection $mailbox = null): EmailRecordLink
    {
        $type = $this->guard($conversation, $record, $actor);

        return DB::transaction(function () use ($conversation, $record, $type, $actor, $mailbox) {
            $link = EmailRecordLink::withoutGlobalScopes()->createOrFirst(
                [
                    'conversation_id' => $conversation->id,
                    'linkable_type' => $type,
                    'linkable_id' => $record->getKey(),
                ],
                [
                    'company_id' => $conversation->company_id,
                    'linked_by' => $actor?->id,
                    'linked_at' => now(),
                ],
            );

            $moved = $link->wasRecentlyCreated || $mailbox !== null
                ? $this->moveCopies($conversation, ReviewStatus::Unlinked, ReviewStatus::None, $mailbox)
                : 0;

            if ($link->wasRecentlyCreated || $moved > 0) {
                $this->audit(LinkAuditAction::Link, $conversation, $type, $record, $actor);
            }

            return $link;
        });
    }

    /**
     * @return bool False when the record was not linked (nothing changed, nothing audited).
     */
    public function unlink(EmailConversation $conversation, Model $record, ?User $actor = null): bool
    {
        $type = $this->guard($conversation, $record, $actor);

        return DB::transaction(function () use ($conversation, $record, $type, $actor) {
            $removed = EmailRecordLink::withoutGlobalScopes()
                ->where('conversation_id', $conversation->id)
                ->where('linkable_type', $type)
                ->where('linkable_id', $record->getKey())
                ->delete();

            if ($removed === 0) {
                return false;
            }

            $this->audit(LinkAuditAction::Unlink, $conversation, $type, $record, $actor);

            // With no record left to project onto, the mail goes back to its owners' review.
            if (! $this->isLinked($conversation)) {
                $this->moveCopies($conversation, ReviewStatus::None, ReviewStatus::Unlinked);
            }

            return true;
        });
    }

    public function isLinked(EmailConversation $conversation): bool
    {
        return EmailRecordLink::withoutGlobalScopes()->where('conversation_id', $conversation->id)->exists();
    }

    private function guard(EmailConversation $conversation, Model $record, ?User $actor): LinkableType
    {
        $type = LinkableType::tryFromModel($record);

        if ($type === null || ! $record->exists) {
            throw new DomainException('Email conversations can only be linked to a saved lead or deal.');
        }

        if ((int) $record->getAttribute('company_id') !== (int) $conversation->company_id) {
            throw new DomainException('Record and email conversation belong to different companies.');
        }

        if ($actor !== null && (int) $actor->company_id !== (int) $conversation->company_id) {
            throw new DomainException('Actor and email conversation belong to different companies.');
        }

        return $type;
    }

    private function audit(LinkAuditAction $action, EmailConversation $conversation, LinkableType $type, Model $record, ?User $actor): void
    {
        EmailLinkAudit::withoutGlobalScopes()->create([
            'company_id' => $conversation->company_id,
            'action' => $action,
            'conversation_id' => $conversation->id,
            'linkable_type' => $type,
            'linkable_id' => $record->getKey(),
            'actor_id' => $actor?->id,
        ]);
    }

    /** Only copies in exactly the $from state move; dismissed and handed-off copies keep theirs. */
    private function moveCopies(EmailConversation $conversation, ReviewStatus $from, ReviewStatus $to, ?EmailConnection $mailbox = null): int
    {
        return EmailMailboxCopy::withoutGlobalScopes()
            ->where('review_status', $from)
            ->when($mailbox !== null, fn ($query) => $query->where('connection_id', $mailbox->id))
            ->whereIn('message_id', EmailMessage::withoutGlobalScopes()->where('conversation_id', $conversation->id)->select('id'))
            ->update(['review_status' => $to]);
    }
}
