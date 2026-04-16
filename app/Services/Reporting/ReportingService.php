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

    public function getKpiSummary(Carbon $start, Carbon $end, array $agentIds): array
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
     * @return int[] Array of LeadAgent IDs
     */
    public function resolveAgentIds(?int $agentId, string $viewType, User $user): array
    {
        // Agent view with explicit agent_id (admin switching)
        if ($viewType === 'agent' && $agentId) {
            return [$agentId];
        }

        // Agent view without agent_id — use the logged-in user's own agent
        if ($viewType === 'agent') {
            $ownAgent = LeadAgent::where('user_id', $user->id)->first();

            return $ownAgent ? [$ownAgent->id] : [];
        }

        // Department view — get all agents in the user's department
        $departmentId = EmployeeDetails::where('user_id', $user->id)->value('department_id');

        if (!$departmentId) {
            // Fallback: user has no department, show only own agent
            $ownAgent = LeadAgent::where('user_id', $user->id)->first();

            return $ownAgent ? [$ownAgent->id] : [];
        }

        $userIds = EmployeeDetails::where('department_id', $departmentId)
            ->pluck('user_id')
            ->toArray();

        return LeadAgent::whereIn('user_id', $userIds)
            ->pluck('id')
            ->toArray();
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
