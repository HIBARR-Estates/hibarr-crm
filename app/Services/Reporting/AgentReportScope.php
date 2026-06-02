<?php

namespace App\Services\Reporting;

use App\Models\LeadAgent;
use Illuminate\Database\Eloquent\Builder;

/**
 * Resolves agent-report filters from LeadAgent IDs to user relationships.
 */
class AgentReportScope
{
    /**
     * @return int[]|null User IDs for the given agents, null when no agent filter (department view).
     */
    public function resolveUserIds(?array $agentIds): ?array
    {
        if ($agentIds === null) {
            return null;
        }

        if ($agentIds === []) {
            return [];
        }

        return LeadAgent::whereIn('id', $agentIds)
            ->pluck('user_id')
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    public function scopeLeads(Builder $query, ?array $agentIds): Builder
    {
        if ($agentIds === null) {
            return $query;
        }

        $userIds = $this->resolveUserIds($agentIds);

        if ($userIds === []) {
            return $query->whereRaw('0 = 1');
        }

        return $query->where(function (Builder $q) use ($userIds) {
            $q->whereIn('added_by', $userIds)
                ->orWhereIn('lead_owner', $userIds);
        });
    }

    public function scopeDeals(Builder $query, ?array $agentIds): Builder
    {
        if ($agentIds === null) {
            return $query;
        }

        if ($agentIds === []) {
            return $query->whereRaw('0 = 1');
        }

        $userIds = $this->resolveUserIds($agentIds);

        return $query->where(function (Builder $q) use ($agentIds, $userIds) {
            $this->applyDealUserRelationship($q, $agentIds, $userIds);
        });
    }

    public function scopeMeetings(Builder $query, ?array $agentIds): Builder
    {
        if ($agentIds === null) {
            return $query;
        }

        if ($agentIds === []) {
            return $query->whereRaw('0 = 1');
        }

        $userIds = $this->resolveUserIds($agentIds);

        return $query->where(function (Builder $q) use ($agentIds, $userIds) {
            if ($userIds !== []) {
                foreach ($userIds as $userId) {
                    $q->orWhereJsonContains('participants', (int) $userId);
                }

                $q->orWhereIn('added_by', $userIds);
            }

            $q->orWhereHas('deal', function (Builder $dealQuery) use ($agentIds, $userIds) {
                $dealQuery->where(function (Builder $sub) use ($agentIds, $userIds) {
                    $this->applyDealUserRelationship($sub, $agentIds, $userIds);
                });
            });
        });
    }

    public function scopeNotesByAuthor(Builder $query, ?array $agentIds): Builder
    {
        if ($agentIds === null) {
            return $query;
        }

        $userIds = $this->resolveUserIds($agentIds);

        if ($userIds === []) {
            return $query->whereRaw('0 = 1');
        }

        return $query->whereIn('added_by', $userIds);
    }

    /**
     * @param  int[]  $agentIds
     * @param  int[]  $userIds
     */
    private function applyDealUserRelationship(Builder $query, array $agentIds, array $userIds): void
    {
        $hasAgent = $agentIds !== [];
        $hasUser = $userIds !== [];

        if (!$hasAgent && !$hasUser) {
            $query->whereRaw('0 = 1');

            return;
        }

        if ($hasAgent) {
            $query->whereIn('agent_id', $agentIds);
        }

        if ($hasUser) {
            $method = $hasAgent ? 'orWhere' : 'where';

            $query->{$method}(function (Builder $q) use ($userIds) {
                $q->whereIn('added_by', $userIds)
                    ->orWhereHas('dealParticipants', fn (Builder $pq) => $pq->whereIn('users.id', $userIds))
                    ->orWhereHas('dealWatchers', fn (Builder $wq) => $wq->whereIn('users.id', $userIds));
            });
        }
    }
}
