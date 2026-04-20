<?php

namespace App\Services\Reporting;

use App\Enums\OutcomeStatus;
use App\Models\Deal;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class DealMetricsService
{
    public function countCreated(?array $agentIds, Carbon $start, Carbon $end): int
    {
        return Deal::when($agentIds !== null, fn ($q) => $q->whereIn('agent_id', $agentIds))
            ->whereBetween('created_at', [$start->startOfDay(), $end->endOfDay()])
            ->count();
    }

    public function listCreated(?array $agentIds, Carbon $start, Carbon $end, int $perPage = 15): LengthAwarePaginator
    {
        return Deal::when($agentIds !== null, fn ($q) => $q->whereIn('agent_id', $agentIds))
            ->whereBetween('created_at', [$start->startOfDay(), $end->endOfDay()])
            ->with([
                'leadAgent.user:id,name',
                'contact:id,client_name,client_email',
                'leadStage:id,name',
            ])
            ->select(['id', 'name', 'value', 'agent_id', 'lead_id', 'pipeline_stage_id', 'created_at'])
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    public function countClosed(?array $agentIds, Carbon $start, Carbon $end): int
    {
        return Deal::when($agentIds !== null, fn ($q) => $q->whereIn('agent_id', $agentIds))
            ->where('outcome_status', OutcomeStatus::Won)
            ->whereBetween('won_at', [$start->startOfDay(), $end->endOfDay()])
            ->count();
    }

    public function listClosed(?array $agentIds, Carbon $start, Carbon $end, int $perPage = 15): LengthAwarePaginator
    {
        return Deal::when($agentIds !== null, fn ($q) => $q->whereIn('agent_id', $agentIds))
            ->where('outcome_status', OutcomeStatus::Won)
            ->whereBetween('won_at', [$start->startOfDay(), $end->endOfDay()])
            ->with([
                'leadAgent.user:id,name',
                'contact:id,client_name,client_email',
            ])
            ->select(['id', 'name', 'value', 'agent_id', 'lead_id', 'won_at'])
            ->orderByDesc('won_at')
            ->paginate($perPage);
    }

    public function totalClosedValue(?array $agentIds, Carbon $start, Carbon $end): float
    {
        return (float) Deal::when($agentIds !== null, fn ($q) => $q->whereIn('agent_id', $agentIds))
            ->where('outcome_status', OutcomeStatus::Won)
            ->whereBetween('won_at', [$start->startOfDay(), $end->endOfDay()])
            ->sum('value');
    }
}
