<?php

namespace App\Services;

use App\Models\Deal;
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
        return $query->where(function ($q) use ($userId) {
            $q->where('added_by', $userId)
                ->orWhereJsonContains('participants', $userId)
                ->orWhereJsonContains('participants', (string) $userId);
        });
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
}
