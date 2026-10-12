<?php

namespace App\Email\Review;

use App\Email\Enums\LinkAuditAction;
use App\Email\Enums\ReviewStatus;
use App\Email\Linking\ConversationLinker;
use App\Email\Models\EmailConversation;
use App\Email\Models\EmailLinkAudit;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailRecordLink;
use App\Models\User;
use DomainException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * What a mailbox owner can do with one of their copies: put its conversation
 * on a record, take it off again, or dismiss it. Every action is audited and
 * none of them touches the provider — mail is never deleted or moved there.
 *
 * Callers have already established that the copy is the actor's own and that
 * they may see the record.
 */
class ReviewActions
{
    public function __construct(private readonly ConversationLinker $linker) {}

    /**
     * Links the copy's whole conversation, which brings this mailbox's
     * earlier messages in the thread onto the record with it.
     */
    public function link(User $actor, EmailMailboxCopy $copy, Model $record): EmailMailboxCopy
    {
        $conversation = $this->conversation($copy);

        return DB::transaction(function () use ($actor, $copy, $record, $conversation) {
            $this->linker->link($conversation, $record, $actor, $copy->connection);

            $copy->refresh();

            // The linker leaves dismissed copies alone; this one was picked on purpose.
            if ($copy->review_status !== ReviewStatus::None) {
                $copy->review_status = ReviewStatus::None;
                $copy->save();
            }

            return $copy;
        });
    }

    /** Removes the projection only. Copies and messages stay where they are. */
    public function unlink(User $actor, EmailMailboxCopy $copy, Model $record): EmailMailboxCopy
    {
        $this->linker->unlink($this->conversation($copy), $record, $actor);

        return $copy->refresh();
    }

    /**
     * Takes a copy out of review without putting it anywhere. It stays in the
     * CRM and in the provider mailbox.
     *
     * @throws DomainException when the copy is not waiting in review.
     */
    public function dismiss(User $actor, EmailMailboxCopy $copy): EmailMailboxCopy
    {
        if ($copy->review_status === ReviewStatus::Dismissed) {
            return $copy;
        }

        if ($copy->review_status !== ReviewStatus::Unlinked) {
            throw new DomainException('Only a copy waiting in review can be dismissed.');
        }

        return DB::transaction(function () use ($actor, $copy) {
            $copy->review_status = ReviewStatus::Dismissed;
            $copy->save();

            EmailLinkAudit::withoutGlobalScopes()->create([
                'company_id' => $copy->company_id,
                'action' => LinkAuditAction::Dismiss,
                'conversation_id' => $copy->message?->conversation_id,
                'mailbox_copy_id' => $copy->id,
                'actor_id' => $actor->id,
            ]);

            return $copy;
        });
    }

    public function isLinked(EmailMailboxCopy $copy): bool
    {
        $conversationId = $copy->message?->conversation_id;

        return $conversationId !== null
            && EmailRecordLink::withoutGlobalScopes()->where('conversation_id', $conversationId)->exists();
    }

    private function conversation(EmailMailboxCopy $copy): EmailConversation
    {
        $conversationId = $copy->message?->conversation_id;

        $conversation = $conversationId !== null
            ? EmailConversation::withoutGlobalScopes()->find($conversationId)
            : null;

        return $conversation ?? throw new DomainException('The copy has no conversation to act on.');
    }
}
