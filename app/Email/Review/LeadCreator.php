<?php

namespace App\Email\Review;

use App\Models\Lead;
use App\Models\LeadSource;
use App\Models\User;
use Throwable;

/**
 * Saves a new lead for an email address through the Lead model itself, so
 * the CRM's own lead lifecycle (observers, defaults, contact methods) runs
 * exactly as it does for a lead created anywhere else.
 */
class LeadCreator
{
    public function create(User $owner, string $email, string $name): Lead
    {
        $lead = new Lead;
        $lead->company_id = $owner->company_id;
        $lead->client_name = $name;
        $lead->client_email = $email;
        $lead->lead_owner = $owner->id;
        $lead->added_by = $owner->id;

        if (($sourceId = $this->emailSourceId((int) $owner->company_id)) !== null) {
            $lead->source_id = $sourceId;
        }

        $lead->save();

        return $lead;
    }

    /** The company's "Email" lead source when it has one; never created here. */
    private function emailSourceId(int $companyId): ?int
    {
        try {
            return LeadSource::resolveFromText($companyId, 'email')?->id;
        } catch (Throwable) {
            return null;
        }
    }
}
