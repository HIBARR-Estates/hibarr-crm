<?php

namespace App\Email\Matching;

use App\Email\Data\MessageDirection;
use App\Email\Enums\LinkAuditAction;
use App\Email\Enums\ReviewStatus;
use App\Email\Linking\ConversationLinker;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailConversation;
use App\Email\Models\EmailLinkAudit;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Enums\LeadContactMethodType;
use App\Models\Lead;
use App\Models\LeadContactMethod;
use Illuminate\Support\Collection;

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

        $leads = $this->leadsFor((int) $connection->company_id, $this->counterpartAddresses($connection, $copy, $message));

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

    /**
     * Who the mailbox owner is corresponding with: the sender of mail they
     * received, the To/Cc of mail they sent. Their own addresses never count.
     *
     * @return list<string>
     */
    private function counterpartAddresses(EmailConnection $connection, EmailMailboxCopy $copy, EmailMessage $message): array
    {
        $addresses = $copy->direction === MessageDirection::Outbound
            ? array_column([...($message->to_recipients ?? []), ...($message->cc_recipients ?? [])], 'address')
            : [$message->from_email];

        $own = array_filter([$connection->identity_email, $connection->from_email, $connection->reply_to_email]);

        $addresses = array_map(fn ($address) => strtolower(trim((string) $address)), $addresses);

        return array_values(array_unique(array_filter(
            $addresses,
            fn (string $address) => $address !== '' && ! in_array($address, $own, true),
        )));
    }

    /**
     * Leads in the company holding any of the addresses, as their main email
     * or as an extra contact method. At most two are fetched: all that
     * matters is whether there is exactly one.
     *
     * @param  list<string>  $addresses
     * @return Collection<int, Lead>
     */
    private function leadsFor(int $companyId, array $addresses): Collection
    {
        if ($addresses === []) {
            return new Collection;
        }

        $viaContactMethods = LeadContactMethod::withoutGlobalScopes()
            ->where('type', LeadContactMethodType::Email->value)
            ->whereIn('normalized', $addresses)
            ->select('lead_id');

        return Lead::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->where(fn ($query) => $query
                ->whereIn('client_email', $addresses)
                ->orWhereIn('id', $viaContactMethods))
            ->orderBy('id')
            ->limit(2)
            ->get(['id', 'company_id', 'lead_owner', 'added_by']);
    }
}
