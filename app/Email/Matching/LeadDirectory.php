<?php

namespace App\Email\Matching;

use App\Email\Data\MessageDirection;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Enums\LeadContactMethodType;
use App\Models\Lead;
use App\Models\LeadContactMethod;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Looks leads up by email address: their main email or an extra contact
 * method. Read only — leads and contact methods are never written here.
 */
class LeadDirectory
{
    /** Upper bound when checking visibility, so a placeholder address on thousands of leads stays cheap. */
    private const HIDDEN_CHECK_LIMIT = 500;

    public function __construct(private readonly LeadVisibility $visibility) {}

    /**
     * Who the mailbox owner is corresponding with: the sender of mail they
     * received, the To/Cc of mail they sent. Their own addresses never count.
     *
     * @return list<string>
     */
    public function counterpartAddresses(EmailConnection $connection, EmailMailboxCopy $copy, EmailMessage $message): array
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
     * Leads in the company holding any of the addresses. Callers that only
     * need to know whether there is exactly one ask for two.
     *
     * @param  list<string>  $addresses
     * @return Collection<int, Lead>
     */
    public function matching(int $companyId, array $addresses, int $limit = 2): Collection
    {
        if ($addresses === []) {
            return new Collection;
        }

        return $this->query($companyId, $addresses)
            ->orderBy('id')
            ->limit($limit)
            ->get(['id', 'company_id', 'client_email', 'lead_owner', 'added_by']);
    }

    /**
     * Of the given addresses, those held by a lead this user may not see.
     * Says only that such a record exists — never which one.
     *
     * @param  list<string>  $addresses
     * @return list<string>
     */
    public function addressesHiddenFrom(User $user, int $companyId, array $addresses): array
    {
        $hidden = $this->matching($companyId, $addresses, self::HIDDEN_CHECK_LIMIT)
            ->reject(fn (Lead $lead) => $this->visibility->canSee($user, $lead));

        if ($hidden->isEmpty()) {
            return [];
        }

        $viaMainEmail = $hidden
            ->map(fn (Lead $lead) => strtolower(trim((string) $lead->client_email)))
            ->all();

        $viaContactMethods = LeadContactMethod::withoutGlobalScopes()
            ->where('type', LeadContactMethodType::Email->value)
            ->whereIn('lead_id', $hidden->modelKeys())
            ->whereIn('normalized', $addresses)
            ->pluck('normalized')
            ->all();

        return array_values(array_intersect($addresses, [...$viaMainEmail, ...$viaContactMethods]));
    }

    /**
     * @param  list<string>  $addresses
     */
    private function query(int $companyId, array $addresses): Builder
    {
        $viaContactMethods = LeadContactMethod::withoutGlobalScopes()
            ->where('type', LeadContactMethodType::Email->value)
            ->whereIn('normalized', $addresses)
            ->select('lead_id');

        return Lead::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->where(fn ($query) => $query
                ->whereIn('client_email', $addresses)
                ->orWhereIn('id', $viaContactMethods));
    }
}
