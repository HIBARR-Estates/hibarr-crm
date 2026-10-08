<?php

namespace App\Email\Review;

use App\Email\Enums\ReviewStatus;
use App\Email\Exceptions\DuplicateLeadException;
use App\Email\Matching\LeadDirectory;
use App\Email\Models\EmailMailboxCopy;
use App\Models\Lead;
use App\Models\User;
use App\Services\LeadDuplicateDetectionService;
use DomainException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * The explicit review action "create lead": a new lead for the other party's
 * address, with the copy's conversation linked to it. This is the only place
 * the Email module creates a lead, and only when a user asks for it.
 *
 * An address a lead already holds is refused — the existing duplicate check
 * decides — and the copy is left exactly as it was, to be linked instead.
 */
class CreateLeadFromCopy
{
    public function __construct(
        private readonly LeadDirectory $leads,
        private readonly LeadDuplicateDetectionService $duplicates,
        private readonly LeadCreator $creator,
        private readonly ReviewActions $actions,
    ) {}

    /**
     * @throws DomainException when the copy does not name exactly one other party, or is already on a record.
     * @throws DuplicateLeadException when a lead already holds the address.
     */
    public function handle(User $actor, EmailMailboxCopy $copy, ?string $name = null): Lead
    {
        $onARecord = $this->actions->isLinked($copy);

        if ($onARecord && $copy->review_status === ReviewStatus::None) {
            throw new DomainException('already_linked');
        }

        $message = $copy->message;
        $addresses = $message !== null && $copy->connection !== null
            ? $this->leads->counterpartAddresses($copy->connection, $copy, $message)
            : [];

        // Sent mail to several people does not say who the lead is.
        if (count($addresses) !== 1) {
            throw new DomainException('no_single_address');
        }

        $email = $addresses[0];
        $name = trim((string) $name) ?: (trim((string) $message->from_name) ?: strstr($email, '@', true));

        // Two agents holding the same email may ask at the same moment; one at a time per address.
        return Cache::lock('email:create-lead:'.$actor->company_id.':'.sha1($email), 30)
            ->block(10, function () use ($actor, $copy, $email, $name, $onARecord) {
                $existing = $this->duplicates->findDuplicates(
                    (new Lead)->forceFill(['company_id' => $actor->company_id, 'client_email' => $email]),
                );

                if ($existing->isNotEmpty()) {
                    throw new DuplicateLeadException($existing);
                }

                // A colleague already put this conversation on some other record; a new lead is not the answer.
                if ($onARecord) {
                    throw new DomainException('already_linked');
                }

                try {
                    return DB::transaction(function () use ($actor, $copy, $email, $name) {
                        $lead = $this->creator->create($actor, $email, (string) $name);
                        $this->actions->link($actor, $copy, $lead);

                        return $lead;
                    });
                } catch (QueryException $exception) {
                    // leads.client_email is unique across everything, including what the check above cannot see.
                    if ((string) $exception->getCode() === '23000') {
                        throw new DuplicateLeadException(new Collection);
                    }

                    throw $exception;
                }
            });
    }
}
