<?php

namespace App\Services\Reporting;

use App\Models\DealFollowUp;
use App\Models\LeadAgent;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class MeetingMetricsService
{
    /**
     * Convert lead_agents.id → users.id so we can scope by participant/creator.
     */
    private function resolveUserIds(array $agentIds): array
    {
        if (empty($agentIds)) {
            return [];
        }

        return LeadAgent::whereIn('id', $agentIds)->pluck('user_id')->toArray();
    }

    /**
     * Scope meetings to those where the user is a participant OR the creator.
     * Matches the scoping used in MeetingsController.
     */
    private function scopeByUser(Builder $query, array $userIds): Builder
    {
        return $query->where(function (Builder $q) use ($userIds) {
            foreach ($userIds as $userId) {
                $q->orWhereJsonContains('participants', (int) $userId);
            }
            $q->orWhereIn('added_by', $userIds);
        });
    }

    public function count(?array $agentIds, Carbon $start, Carbon $end): int
    {
        $query = DealFollowUp::whereBetween('next_follow_up_date', [$start->startOfDay(), $end->endOfDay()]);

        if ($agentIds !== null) {
            $userIds = $this->resolveUserIds($agentIds);

            if (empty($userIds)) {
                return 0;
            }

            $this->scopeByUser($query, $userIds);
        }

        return $query->count();
    }

    public function list(?array $agentIds, Carbon $start, Carbon $end, int $perPage = 15): LengthAwarePaginator
    {
        $query = DealFollowUp::whereBetween('next_follow_up_date', [$start->startOfDay(), $end->endOfDay()]);

        if ($agentIds !== null) {
            $userIds = $this->resolveUserIds($agentIds);

            if (empty($userIds)) {
                return new \Illuminate\Pagination\LengthAwarePaginator([], 0, $perPage);
            }

            $this->scopeByUser($query, $userIds);
        }

        return $query->with([
                'deal:id,name,agent_id,value,currency_id,pipeline_stage_id',
                'deal.leadStage',
                'deal.contact',
                'deal.currency',
                'deal.leadAgent.user:id,name',
                'addedBy:id,name',
                'meetingType:id,name',
                'meetingSummary',
            ])
            ->select([
                'id', 'deal_id', 'meeting_type_id', 'next_follow_up_date',
                'status', 'remark', 'duration', 'added_by', 'participants',
            ])
            ->orderByDesc('next_follow_up_date')
            ->paginate($perPage);
    }

    public function countByType(?array $agentIds, Carbon $start, Carbon $end): array
    {
        $query = DealFollowUp::whereBetween('next_follow_up_date', [$start->startOfDay(), $end->endOfDay()]);

        if ($agentIds !== null) {
            $userIds = $this->resolveUserIds($agentIds);

            if (empty($userIds)) {
                return [];
            }

            $this->scopeByUser($query, $userIds);
        }

        return $query->join('meeting_types', 'lead_follow_up.meeting_type_id', '=', 'meeting_types.id')
            ->selectRaw('meeting_types.name as meeting_type, count(*) as total')
            ->groupBy('meeting_types.name')
            ->pluck('total', 'meeting_type')
            ->toArray();
    }
}
