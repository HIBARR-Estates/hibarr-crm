<?php

namespace App\Email\Matching;

use App\Models\Lead;
use App\Models\User;
use Throwable;

/**
 * Whether a mailbox owner may see a lead, by the CRM's own view_lead scope.
 * This only decides if mail may be attached to the lead automatically; who
 * may read the mail once it is there is EmailAccess's call, not this one's.
 */
class LeadVisibility
{
    public function canSee(User $user, Lead $lead): bool
    {
        if ($user->company_id === null || (int) $user->company_id !== (int) $lead->company_id) {
            return false;
        }

        try {
            $scope = $user->permission('view_lead');
        } catch (Throwable) {
            // Fail closed: permissions that cannot be read grant nothing.
            return false;
        }

        $owns = $lead->lead_owner !== null && (int) $lead->lead_owner === (int) $user->id;
        $added = $lead->added_by !== null && (int) $lead->added_by === (int) $user->id;

        return match ($scope) {
            'all' => true,
            'owned' => $owns,
            'added' => $added,
            'both' => $owns || $added,
            default => false,
        };
    }
}
