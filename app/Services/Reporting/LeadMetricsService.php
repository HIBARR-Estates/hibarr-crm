<?php

namespace App\Services\Reporting;

use App\Models\Lead;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class LeadMetricsService
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
            ->with(['leadSource:id,type', 'leadOwner:id,name'])
            ->select(['id', 'client_name', 'client_email', 'source_id', 'lead_owner', 'created_at'])
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    private function baseQuery(?array $agentIds, Carbon $start, Carbon $end)
    {
        return $this->scope->scopeLeads(Lead::query(), $agentIds)
            ->whereBetween('created_at', [
                $start->copy()->startOfDay(),
                $end->copy()->endOfDay(),
            ]);
    }
}
