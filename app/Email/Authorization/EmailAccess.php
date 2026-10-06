<?php

namespace App\Email\Authorization;

use App\Email\EmailFeature;
use App\Email\Enums\LinkableType;
use App\Email\Enums\ReviewStatus;
use App\Email\Linking\RecordFeed;
use App\Email\Matching\RecordVisibility;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailFile;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailRecordLink;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * The one place that decides who may read which email. Everything that
 * returns a message, a copy, a preview or (later) a file, search hit or
 * export asks here. See docs/email/access-matrix.md.
 *
 * What is allowed today:
 *  - a mailbox owner: every copy in their own mailboxes, linked or not;
 *  - a lead's owner, if not a partner: mail linked to that lead;
 *  - a deal's agent or participant, if not a partner: mail linked to that deal.
 *
 * Everything else is denied — other people's unlinked mail always, and every
 * cell the matrix leaves "TBD" (managers, successors, deal watchers, deal
 * participants reading the lead's mail). A wide view_lead permission grants
 * nothing here. Anything that cannot be determined is a denial.
 */
class EmailAccess
{
    /** @var array<int, bool> */
    private array $partners = [];

    public function __construct(
        private readonly RecordFeed $feed,
        private readonly RecordVisibility $visibility,
    ) {}

    /** Flag and pilot allowlist; without them nobody reads anything. */
    public function enabledFor(?User $user): bool
    {
        return $user !== null && $user->company_id !== null && EmailFeature::enabledFor($user);
    }

    /**
     * Copies in the user's own mailboxes — the only unlinked mail anyone can reach.
     */
    public function ownCopies(User $user): Builder
    {
        $connections = EmailConnection::withoutGlobalScopes()
            ->where('user_id', $user->id)
            ->where('company_id', $user->company_id)
            ->select('id');

        return EmailMailboxCopy::withoutGlobalScopes()
            ->with(['message', 'connection'])
            ->when(! $this->enabledFor($user), fn ($query) => $query->whereRaw('1 = 0'))
            ->where('company_id', $user->company_id)
            ->whereIn('connection_id', $connections);
    }

    public function canViewCopy(?User $user, EmailMailboxCopy $copy): bool
    {
        return $this->enabledFor($user)
            && $this->ownCopies($user)->whereKey($copy->getKey())->exists();
    }

    /**
     * A message is readable by whoever holds a copy of it, and — once it is
     * projected onto a record — by whoever has communications access to that
     * record. Unlinking, or the last copy going back to review, ends the latter.
     */
    public function canViewMessage(?User $user, EmailMessage $message): bool
    {
        if (! $this->enabledFor($user) || (int) $message->company_id !== (int) $user->company_id) {
            return false;
        }

        if ($this->ownCopies($user)->where('message_id', $message->id)->exists()) {
            return true;
        }

        if ($message->conversation_id === null || ! $this->isProjected($message)) {
            return false;
        }

        $links = EmailRecordLink::withoutGlobalScopes()
            ->where('company_id', $message->company_id)
            ->where('conversation_id', $message->conversation_id)
            ->get();

        foreach ($links as $link) {
            $record = $this->linkedRecord($link);

            if ($record !== null && $this->hasCommunicationsAccess($user, $record)) {
                return true;
            }
        }

        return false;
    }

    /**
     * A file on a message follows the message. A file uploaded for sending
     * and not yet on any message is its uploader's and the mailbox owner's.
     */
    public function canViewFile(?User $user, EmailFile $file): bool
    {
        if (! $this->enabledFor($user) || (int) $file->company_id !== (int) $user->company_id) {
            return false;
        }

        if ($file->message_id !== null) {
            $message = EmailMessage::withoutGlobalScopes()->find($file->message_id);

            return $message !== null && $this->canViewMessage($user, $message);
        }

        if ($file->uploaded_by !== null && (int) $file->uploaded_by === (int) $user->id) {
            return true;
        }

        return $file->connection_id !== null && EmailConnection::withoutGlobalScopes()
            ->whereKey($file->connection_id)
            ->where('user_id', $user->id)
            ->where('company_id', $user->company_id)
            ->exists();
    }

    /** Looks a file up by its CRM uuid. Finding it grants nothing; ask canViewFile(). */
    public function findFile(string $uuid): ?EmailFile
    {
        return EmailFile::withoutGlobalScopes()->where('uuid', $uuid)->first();
    }

    /** A mailbox of the user's own, by its CRM uuid. */
    public function ownConnection(?User $user, string $uuid): ?EmailConnection
    {
        if (! $this->enabledFor($user)) {
            return null;
        }

        return EmailConnection::withoutGlobalScopes()
            ->where('uuid', $uuid)
            ->where('user_id', $user->id)
            ->where('company_id', $user->company_id)
            ->first();
    }

    /**
     * The messages on a record this user may read, oldest first: their own
     * projected copies, plus what their role on the record opens up.
     */
    public function messagesOnRecord(User $user, Model $record): Builder
    {
        $messages = $this->feed->messages($record);

        if (! $this->enabledFor($user) || (int) $record->getAttribute('company_id') !== (int) $user->company_id) {
            return $messages->whereRaw('1 = 0');
        }

        $own = $this->ownCopies($user)
            ->where('review_status', ReviewStatus::None)
            ->setEagerLoads([])
            ->select('message_id');

        $opened = $this->conversationsOpenedBy($user, $record);

        return $messages->where(fn ($query) => $query
            ->whereIn('id', $own)
            ->when($opened !== [], function ($query) use ($opened) {
                foreach ($opened as $conversations) {
                    $query->orWhereIn('conversation_id', $conversations);
                }
            }));
    }

    /**
     * The "communications ACL": may this user read mail linked to this record
     * without holding a copy of it? Needs ordinary record access as well, and
     * is never true for a partner.
     */
    public function hasCommunicationsAccess(?User $user, Model $record): bool
    {
        if (! $this->enabledFor($user)
            || (int) $record->getAttribute('company_id') !== (int) $user->company_id
            || $this->isPartner($user)
            || ! $this->visibility->canSee($user, $record)) {
            return false;
        }

        return match (true) {
            $record instanceof Lead => $record->lead_owner !== null && (int) $record->lead_owner === (int) $user->id,
            $record instanceof Deal => $this->isDealAgentOrParticipant($user, $record),
            default => false,
        };
    }

    /**
     * Sets of conversations the user's role on the record lets them read.
     * On a deal, the deal's own links and its lead's links are opened
     * separately: a deal participant does not get the lead's mail.
     *
     * @return list<Builder>
     */
    private function conversationsOpenedBy(User $user, Model $record): array
    {
        $opened = [];

        if ($this->hasCommunicationsAccess($user, $record)) {
            $opened[] = $this->feed->directConversations($record);
        }

        if ($record instanceof Deal && $record->lead_id !== null) {
            $lead = Lead::withoutGlobalScopes()
                ->where('company_id', $record->company_id)
                ->whereNull('deleted_at')
                ->find($record->lead_id);

            if ($lead !== null && $this->hasCommunicationsAccess($user, $lead)) {
                $opened[] = $this->feed->directConversations($lead);
            }
        }

        return $opened;
    }

    private function isProjected(EmailMessage $message): bool
    {
        return EmailMailboxCopy::withoutGlobalScopes()
            ->where('message_id', $message->id)
            ->where('review_status', ReviewStatus::None)
            ->exists();
    }

    private function linkedRecord(EmailRecordLink $link): ?Model
    {
        $class = $link->linkable_type->modelClass();

        return $class::withoutGlobalScopes()
            ->where('company_id', $link->company_id)
            ->when($link->linkable_type === LinkableType::Lead, fn ($query) => $query->whereNull('deleted_at'))
            ->find($link->linkable_id);
    }

    /** A user with a partner agent profile. Unknown counts as partner: deny. */
    private function isPartner(User $user): bool
    {
        return $this->partners[$user->id] ??= $this->lookUpPartner($user);
    }

    private function lookUpPartner(User $user): bool
    {
        try {
            return DB::table('lead_agents')
                ->where('company_id', $user->company_id)
                ->where('user_id', $user->id)
                ->where('is_partner', true)
                ->exists();
        } catch (Throwable) {
            return true;
        }
    }

    private function isDealAgentOrParticipant(User $user, Deal $deal): bool
    {
        try {
            $isAgent = $deal->agent_id !== null && DB::table('lead_agents')
                ->where('id', $deal->agent_id)
                ->where('user_id', $user->id)
                ->exists();

            return $isAgent || DB::table('deal_participants')
                ->where('deal_id', $deal->id)
                ->where('user_id', $user->id)
                ->exists();
        } catch (Throwable) {
            return false;
        }
    }
}
