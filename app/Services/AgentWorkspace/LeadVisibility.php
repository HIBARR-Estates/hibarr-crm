<?php

namespace App\Services\AgentWorkspace;

use App\Models\Lead;
use App\Models\User;
use App\Services\PermissionService;

/**
 * Who may see a lead's own details, for the agent workspace's deal page. A
 * deal can be visible to someone the lead is not (they created it, or work on
 * it, while another agent owns the lead). That person gets the deal only: the
 * lead's phone, email, answers and other records stay out of what is sent to
 * the browser, not merely out of what is drawn.
 */
class LeadVisibility
{
    /** The lead page's own view check (LeadContactController::showProps). */
    public static function canView(User $viewer, Lead $lead): bool
    {
        return PermissionService::checkAccess($viewer, 'view_lead', $lead, [
            'added' => 'added_by',
            'owned' => 'lead_owner',
        ])['canAccess'];
    }

    /**
     * The deal page's props with everything that belongs to the lead taken out.
     * What stays of the person is their name, to say whose deal this is, and who
     * owns the lead. `leadRestricted` tells the page to draw the deal-only view.
     *
     * @param  array<string, mixed>  $props
     * @return array<string, mixed>
     */
    public static function withoutLeadDetails(array $props, ?string $ownerName, int $viewerId): array
    {
        $deal = is_array($props['deal'] ?? null) ? $props['deal'] : [];
        $contact = is_array($deal['contact'] ?? null) ? $deal['contact'] : [];

        $deal['contact'] = [
            'id' => $contact['id'] ?? ($deal['lead_id'] ?? null),
            'client_name' => $contact['client_name'] ?? null,
            'lead_owner' => ['id' => $contact['lead_owner'] ?? null, 'name' => $ownerName],
        ];
        $props['deal'] = $deal;

        // The lead's own custom fields (household, finances, ...) and consents.
        $props['leadCustomFields'] = [];
        $props['leadCustomFieldsData'] = [];
        $props['visibleLeadFieldKeys'] = [];
        $props['consents'] = [];

        $props['leadRestricted'] = [
            'owner_name' => $ownerName,
            'created_by_me' => isset($deal['added_by']) && (int) $deal['added_by'] === $viewerId,
        ];

        return $props;
    }
}
