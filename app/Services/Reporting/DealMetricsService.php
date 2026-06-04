<?php

namespace App\Services\Reporting;

use App\Enums\OutcomeStatus;
use App\Models\Deal;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class DealMetricsService
{
    public function __construct(
        private AgentReportScope $scope,
    ) {}

    public function countCreated(?array $agentIds, Carbon $start, Carbon $end): int
    {
        return $this->createdQuery($agentIds, $start, $end)->count();
    }

    public function listCreated(?array $agentIds, Carbon $start, Carbon $end, int $perPage = 15): LengthAwarePaginator
    {
        return $this->createdQuery($agentIds, $start, $end)
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
        return $this->closedQuery($agentIds, $start, $end)->count();
    }

    public function listClosed(?array $agentIds, Carbon $start, Carbon $end, int $perPage = 15): LengthAwarePaginator
    {
        return $this->closedQuery($agentIds, $start, $end)
            ->with([
                'leadAgent.user:id,name',
                'contact:id,client_name,client_email',
            ])
            ->select(['id', 'name', 'value', 'agent_id', 'lead_id', 'close_date', 'outcome_status'])
            ->orderByDesc('close_date')
            ->paginate($perPage);
    }

    public function totalClosedValue(?array $agentIds, Carbon $start, Carbon $end): float
    {
        return (float) $this->scope->scopeDeals(Deal::query(), $agentIds)
            ->where('outcome_status', OutcomeStatus::Won)
            ->whereNotNull('close_date')
            ->whereBetween('close_date', [
                $start->copy()->startOfDay(),
                $end->copy()->endOfDay(),
            ])
            ->sum('value');
    }

    private function createdQuery(?array $agentIds, Carbon $start, Carbon $end)
    {
        return $this->scope->scopeDeals(Deal::query(), $agentIds)
            ->whereBetween('created_at', [
                $start->copy()->startOfDay(),
                $end->copy()->endOfDay(),
            ]);
    }

    private function closedQuery(?array $agentIds, Carbon $start, Carbon $end)
    {
        return $this->scope->scopeDeals(Deal::query(), $agentIds)
            ->whereIn('outcome_status', [OutcomeStatus::Won, OutcomeStatus::Lost])
            ->whereNotNull('close_date')
            ->whereBetween('close_date', [
                $start->copy()->startOfDay(),
                $end->copy()->endOfDay(),
            ]);
    }
}
