<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\Lead;
use App\Models\User;
use App\Services\PermissionService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;

class MeetingVisibilityService
{
    /**
     * Meetings visible to a user as creator or JSON participant.
     */
    public static function scopeVisibleToUser(Builder|Relation $query, int $userId): Builder|Relation
    {
        return $query->visibleToUser($userId);
    }

    /**
     * Ensure the meeting creator is included in the participants list.
     *
     * @param  array<int|string>  $participants
     * @return array<int>
     */
    public static function ensureCreatorIsParticipant(array $participants, int $creatorId): array
    {
        $normalized = array_values(array_unique(array_map('intval', array_filter($participants, 'is_numeric'))));

        if (!in_array($creatorId, $normalized, true)) {
            array_unshift($normalized, $creatorId);
        }

        return $normalized;
    }

    /**
     * Force the deal's agent (or the lead's owner) into the participants list
     * when they are NOT the chosen host, so the person actually accountable
     * for the deal/lead is never silently excluded from a meeting they
     * didn't explicitly opt into hosting. Callers are responsible for also
     * marking this id non-removable in the UI — this only guarantees
     * server-side inclusion, not client-side immutability.
     *
     * @param  array<int|string>  $participants
     * @return array<int>
     */
    public static function ensureHostOwnerIsParticipant(array $participants, ?int $hostId, ?int $ownerUserId): array
    {
        $normalized = array_values(array_unique(array_map('intval', array_filter($participants, 'is_numeric'))));

        if ($ownerUserId === null || $ownerUserId === $hostId) {
            return $normalized;
        }

        if (!in_array($ownerUserId, $normalized, true)) {
            array_unshift($normalized, $ownerUserId);
        }

        return $normalized;
    }

    /**
     * The host is tracked separately from participants — never list them
     * twice. Applied last, after ensureCreatorIsParticipant()/
     * ensureHostOwnerIsParticipant(), so it always wins even when the host
     * happens to be the creator or the forced-in deal agent/lead owner.
     *
     * @param  array<int|string>  $participants
     * @return array<int>
     */
    public static function withoutHost(array $participants, ?int $hostId): array
    {
        $normalized = array_values(array_unique(array_map('intval', array_filter($participants, 'is_numeric'))));

        if ($hostId === null) {
            return $normalized;
        }

        return array_values(array_diff($normalized, [$hostId]));
    }

    /**
     * Deals the user may attach when scheduling a meeting from the dashboard or meetings page.
     */
    public static function schedulableDealsQuery(): Builder
    {
        $dealsQuery = Deal::select('id', 'name')
            ->where('next_follow_up', 'yes');

        $viewDealsPermission = user()->permission('view_deals');
        if ($viewDealsPermission !== 'all') {
            $dealRules = [
                'added' => 'deals.added_by',
                'owned' => function ($q, User $user) {
                    $q->where(function ($query) use ($user) {
                        $query->whereHas('leadAgent', function ($q) use ($user) {
                            $q->where('user_id', $user->id);
                        })->orWhereHas('dealParticipants', function ($q) use ($user) {
                            $q->where('users.id', $user->id);
                        })->orWhereHas('dealWatchers', function ($q) use ($user) {
                            $q->where('users.id', $user->id);
                        });
                    });
                },
            ];
            PermissionService::applyScope($dealsQuery, user(), 'view_deals', $dealRules);
        }

        return $dealsQuery->orderBy('name');
    }

    /**
     * Leads the user may attach when scheduling a meeting from the dashboard or meetings page.
     *
     * Note: unlike deals, leads do not have a next_follow_up column — that flag lives on
     * the deals table after the lead/deal schema split. Lead eligibility is permission-scoped only.
     */
    public static function schedulableLeadsQuery(): Builder
    {
        $leadsQuery = Lead::select('id', 'client_name', 'company_name');

        $viewLeadPermission = user()->permission('view_lead');

        if ($viewLeadPermission === 'none') {
            return $leadsQuery->whereRaw('1 = 0');
        }

        if ($viewLeadPermission === 'owned') {
            $leadsQuery->where('lead_owner', user()->id);
        } elseif ($viewLeadPermission === 'added') {
            $leadsQuery->where('added_by', user()->id);
        } elseif ($viewLeadPermission === 'both') {
            $leadsQuery->where(function ($query) {
                $query->where('lead_owner', user()->id)
                    ->orWhere('added_by', user()->id);
            });
        }

        return $leadsQuery->orderBy('client_name');
    }
}
