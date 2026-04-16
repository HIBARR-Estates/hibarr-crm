<?php

namespace App\Services\Reporting;

use App\Models\DealFollowUp;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class MeetingMetricsService
{
    public function count(array $agentIds, Carbon $start, Carbon $end): int
    {
        return DealFollowUp::whereHas('deal', fn ($q) => $q->whereIn('agent_id', $agentIds))
            ->whereBetween('next_follow_up_date', [$start->startOfDay(), $end->endOfDay()])
            ->count();
    }

    public function list(array $agentIds, Carbon $start, Carbon $end, int $perPage = 15): LengthAwarePaginator
    {
        return DealFollowUp::whereHas('deal', fn ($q) => $q->whereIn('agent_id', $agentIds))
            ->whereBetween('next_follow_up_date', [$start->startOfDay(), $end->endOfDay()])
            ->with([
                'deal:id,name,agent_id',
                'deal.leadAgent.user:id,name',
                'meetingType:id,name',
            ])
            ->select([
                'id', 'deal_id', 'meeting_type_id', 'next_follow_up_date',
                'status', 'remark', 'duration',
            ])
            ->orderByDesc('next_follow_up_date')
            ->paginate($perPage);
    }

    public function countByType(array $agentIds, Carbon $start, Carbon $end): array
    {
        return DealFollowUp::whereHas('deal', fn ($q) => $q->whereIn('agent_id', $agentIds))
            ->whereBetween('next_follow_up_date', [$start->startOfDay(), $end->endOfDay()])
            ->join('meeting_types', 'lead_follow_up.meeting_type_id', '=', 'meeting_types.id')
            ->selectRaw('meeting_types.name as meeting_type, count(*) as total')
            ->groupBy('meeting_types.name')
            ->pluck('total', 'meeting_type')
            ->toArray();
    }
}
