<?php

namespace App\Services\Reporting;

use App\Models\EmployeeDetails;
use App\Models\LeadAgent;
use App\Models\User;
use Carbon\Carbon;

class ReportingService
{
    public function __construct(
        private LeadMetricsService $leadMetrics,
        private DealMetricsService $dealMetrics,
        private MeetingMetricsService $meetingMetrics,
        private NoteMetricsService $noteMetrics,
    ) {}

    public function getKpiSummary(Carbon $start, Carbon $end, ?array $agentIds): array
    {
        return [
            'leads_count' => $this->leadMetrics->count($agentIds, $start, $end),
            'deals_created_count' => $this->dealMetrics->countCreated($agentIds, $start, $end),
            'deals_closed_count' => $this->dealMetrics->countClosed($agentIds, $start, $end),
            'deals_closed_value' => $this->dealMetrics->totalClosedValue($agentIds, $start, $end),
            'meetings_count' => $this->meetingMetrics->count($agentIds, $start, $end),
            'meetings_by_type' => $this->meetingMetrics->countByType($agentIds, $start, $end),
            'notes_count' => $this->noteMetrics->count($agentIds, $start, $end),
        ];
    }

    /**
     * Resolve which agent IDs to query based on view type and permissions.
     *
     * @return int[]|null Array of LeadAgent IDs, or null for "all records" (department view)
     */
    public function resolveAgentIds(?int $agentId, string $viewType, User $user): ?array
    {
        // Department view — show all records (no agent filter)
        if ($viewType === 'department') {
            return null;
        }

        // Agent view with explicit agent_id (admin switching)
        if ($agentId) {
            return [$agentId];
        }

        // Agent view — use the logged-in user's own agent
        $ownAgent = LeadAgent::where('user_id', $user->id)->first();

        return $ownAgent ? [$ownAgent->id] : [];
    }

    /**
     * Get the department name for the current user (for AI context).
     */
    public function getDepartmentName(User $user): ?string
    {
        return EmployeeDetails::where('user_id', $user->id)
            ->with('department:id,team_name')
            ->first()
            ?->department
            ?->team_name;
    }

    public function leadMetrics(): LeadMetricsService
    {
        return $this->leadMetrics;
    }

    public function dealMetrics(): DealMetricsService
    {
        return $this->dealMetrics;
    }

    public function meetingMetrics(): MeetingMetricsService
    {
        return $this->meetingMetrics;
    }

    public function noteMetrics(): NoteMetricsService
    {
        return $this->noteMetrics;
    }
}
