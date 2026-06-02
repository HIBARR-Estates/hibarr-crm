<?php

namespace App\Services\Reporting;

use App\Models\DealFollowUp;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class MeetingMetricsService
{
    public function __construct(
        private AgentReportScope $scope,
    ) {}

    public function count(?array $agentIds, Carbon $start, Carbon $end): int
    {
        return $this->baseQuery($agentIds, $start, $end)->count();
    }

    public function list(?array $agentIds, Carbon $start, Carbon $end, int $perPage = 15): LengthAwarePaginator
    {
        return $this->baseQuery($agentIds, $start, $end)
            ->with([
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
        return $this->baseQuery($agentIds, $start, $end)
            ->join('meeting_types', 'lead_follow_up.meeting_type_id', '=', 'meeting_types.id')
            ->selectRaw('meeting_types.name as meeting_type, count(*) as total')
            ->groupBy('meeting_types.name')
            ->pluck('total', 'meeting_type')
            ->toArray();
    }

    private function baseQuery(?array $agentIds, Carbon $start, Carbon $end)
    {
        return $this->scope->scopeMeetings(DealFollowUp::query(), $agentIds)
            ->whereBetween('next_follow_up_date', [
                $start->copy()->startOfDay(),
                $end->copy()->endOfDay(),
            ]);
    }
}
