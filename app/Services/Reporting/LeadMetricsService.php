<?php

namespace App\Services\Reporting;

use App\Models\Deal;
use App\Models\Lead;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class LeadMetricsService
{
    /**
     * Count leads (contacts) that have at least one deal owned by the given agents,
     * scoped by the lead's created_at date.
     */
    public function count(array $agentIds, Carbon $start, Carbon $end): int
    {
        return Lead::whereHas('deals', fn ($q) => $q->whereIn('agent_id', $agentIds))
            ->whereBetween('created_at', [$start->startOfDay(), $end->endOfDay()])
            ->count();
    }

    public function list(array $agentIds, Carbon $start, Carbon $end, int $perPage = 15): LengthAwarePaginator
    {
        return Lead::whereHas('deals', fn ($q) => $q->whereIn('agent_id', $agentIds))
            ->whereBetween('created_at', [$start->startOfDay(), $end->endOfDay()])
            ->with(['leadSource:id,type'])
            ->select(['id', 'client_name', 'client_email', 'source_id', 'created_at'])
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }
}
