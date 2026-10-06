<?php

namespace App\Email\Matching;

use App\Email\Enums\LinkAuditAction;
use App\Email\Enums\ReviewStatus;
use App\Email\Linking\ConversationLinker;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailConversation;
use App\Email\Models\EmailLinkAudit;
use App\Email\Models\EmailMailboxCopy;

/**
 * Decides where a newly arrived mailbox copy belongs, after it has been
 * threaded:
 *
 *  1. its conversation is already on a record → it rides along;
 *  2. the other party's address belongs to exactly one lead the mailbox owner
 *     may see → the conversation is linked to that lead;
 *  3. anything else — unknown address, several leads, a lead the owner may
 *     not see — goes to the owner's private review. A winner is never picked.
 *
 * Leads and their contact methods are only read here, never written.
 */
class ContactMatcher
{
    public function __construct(
        private readonly ConversationLinker $linker,
        private readonly LeadDirectory $leads,
        private readonly LeadVisibility $visibility,
    ) {}

    public function match(EmailConnection $connection, EmailMailboxCopy $copy): MatchResult
    {
        $message = $copy->message;
        $conversation = $message?->conversation_id !== null
            ? EmailConversation::withoutGlobalScopes()->find($message->conversation_id)
            : null;

        if ($message === null || $conversation === null) {
            return $this->review($copy);
        }

        if ($this->linker->isLinked($conversation)) {
            return MatchResult::AlreadyLinked;
        }

        // Someone took this conversation off a record on purpose; matching does not put it back.
        if ($this->wasUnlinked($conversation)) {
            return $this->review($copy);
        }

        $leads = $this->leads->matching(
            (int) $connection->company_id,
            $this->leads->counterpartAddresses($connection, $copy, $message),
        );

        if ($leads->count() !== 1) {
            return $this->review($copy);
        }

        $lead = $leads->first();
        $owner = $connection->user;

        if ($owner === null || ! $this->visibility->canSee($owner, $lead)) {
            return $this->review($copy);
        }

        $this->linker->link($conversation, $lead);

        return MatchResult::Linked;
    }

    private function review(EmailMailboxCopy $copy): MatchResult
    {
        if ($copy->review_status === ReviewStatus::None) {
            $copy->review_status = ReviewStatus::Unlinked;
            $copy->save();
        }

        return MatchResult::Review;
    }

    private function wasUnlinked(EmailConversation $conversation): bool
    {
        return EmailLinkAudit::withoutGlobalScopes()
            ->where('company_id', $conversation->company_id)
            ->where('conversation_id', $conversation->id)
            ->where('action', LinkAuditAction::Unlink)
            ->exists();
    }
}
