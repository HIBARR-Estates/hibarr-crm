<?php

namespace App\Http\Controllers;

use App\Enums\MlmCommissionStatus;
use App\Enums\MlmCommissionType;
use App\Models\AgentHierarchy;
use App\Models\AgentLevelHistory;
use App\Models\AgentMetric;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Models\MlmLevel;
use App\Services\CycleService;
use App\Services\LevelService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class MlmAdminController extends AccountBaseController
{
    protected CycleService $cycleService;
    protected LevelService $levelService;

    public function __construct(CycleService $cycleService, LevelService $levelService)
    {
        parent::__construct();
        $this->cycleService = $cycleService;
        $this->levelService = $levelService;
    }

    /**
     * MLM Admin Dashboard
     */
    public function dashboard()
    {
        $companyId = company()->id;

        $stats = [
            'total_agents' => LeadAgent::where('company_id', $companyId)->count(),
            'total_deals_won' => \App\Models\Deal::where('company_id', $companyId)->where('outcome_status', 'won')->count(),
            'total_commissions_paid' => (float) MlmCommission::where('company_id', $companyId)->where('status', MlmCommissionStatus::Paid->value)->sum('amount'),
            'pending_commissions' => (float) MlmCommission::where('company_id', $companyId)->where('status', MlmCommissionStatus::Pending->value)->sum('amount'),
        ];

        return Inertia::render('Mlm/Admin/Dashboard', [
            'stats' => $stats,
        ]);
    }

    /**
     * MLM Levels Management
     */
    public function levels()
    {
        $levels = MlmLevel::where('company_id', company()->id)
            ->ordered()
            ->with('criteria')
            ->get();

        return Inertia::render('Mlm/Admin/Levels', [
            'levels' => $levels,
        ]);
    }

    /**
     * Level Qualification Rules
     */
    public function levelRules(Request $request, $level)
    {
        $mlmLevel = MlmLevel::where('company_id', company()->id)
            ->with('criteria')
            ->findOrFail($level);

        return Inertia::render('Mlm/Admin/LevelRules', [
            'level' => $mlmLevel,
            'criteria' => $mlmLevel->criteria ?? [],
        ]);
    }

    /**
     * Commission Settings
     */
    public function commissionSettings()
    {
        return Inertia::render('Mlm/Admin/CommissionSettings', [
            'settings' => [
                'max_commission_percentage' => (float) config('mlm.max_commission_percentage'),
                'auto_evaluate_ancestors' => (bool) config('mlm.auto_evaluate_ancestors'),
                'enable_commission_reversal' => true,
            ],
            'agents' => LeadAgent::where('company_id', company()->id)
            ->with('user:id,name,email,image')
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'name' => $a->user?->name ?? 'Unknown',
                'email' => $a->user?->email,
            ]),
        ]);
    }

    /**
     * Agent Hierarchy
     */
    public function agentHierarchy()
    {
        return Inertia::render('Mlm/Admin/AgentHierarchy', [
            'agents' => LeadAgent::where('company_id', company()->id)
                ->with('user:id,name,email,image')
                ->get()
                ->map(fn ($a) => [
                    'id' => $a->id,
                    'name' => $a->user?->name ?? 'Unknown',
                    'email' => $a->user?->email,
                ]),
        ]);
    }

    /**
     * Commission Ledger
     */
    public function commissionLedger()
    {
        return Inertia::render('Mlm/Admin/CommissionLedger', [
            'agents' => LeadAgent::where('company_id', company()->id)
                ->with('user:id,name')
                ->get()
                ->map(fn ($a) => ['id' => $a->id, 'name' => $a->user?->name ?? 'Unknown']),
            'levels' => MlmLevel::where('company_id', company()->id)->ordered()->get(['id', 'name']),
        ]);
    }

    /**
     * Agent Metrics
     */
    public function agentMetrics()
    {
        return Inertia::render('Mlm/Admin/AgentMetrics');
    }

    /**
     * Level Assignment History
     */
    public function levelHistory()
    {
        $levels = MlmLevel::where('company_id', company()->id)->ordered()->get(['id', 'name']);
        $agents = LeadAgent::where('company_id', company()->id)
            ->with('user:id,name')
            ->get()
            ->map(fn ($a) => ['id' => $a->id, 'name' => $a->user?->name ?? 'Unknown']);

        return Inertia::render('Mlm/Admin/LevelHistory', [
            'levels' => $levels,
            'agents' => $agents,
        ]);
    }

    /**
     * Cycle Management
     */
    public function cycleManagement()
    {
        return Inertia::render('Mlm/Admin/CycleManagement');
    }

    /**
     * View a specific agent's dashboard (admin view).
     */
    public function agentDashboard(int $agentId)
    {
        $agent = LeadAgent::where('company_id', company()->id)
            ->with('user:id,name,email,image')
            ->findOrFail($agentId);

        return Inertia::render('Mlm/Admin/AgentDashboard', [
            'agent' => [
                'id' => $agent->id,
                'name' => $agent->user?->name ?? 'Unknown',
                'email' => $agent->user?->email,
                'image' => $agent->user?->image,
            ],
            'stats' => $this->buildAgentDashboardStats($agent),
        ]);
    }

    /**
     * Build dashboard stats for a specific agent (reused by page and API).
     */
    public function buildAgentDashboardStats(LeadAgent $agent): array
    {
        $allTimeMetrics = AgentMetric::where('agent_id', $agent->id)->first();
        $currentLevel = $this->levelService->getCurrentLevel($agent);

        $enrollment = $this->cycleService->getActiveEnrollment($agent);
        $cycleMetrics = $enrollment?->metrics;
        $activeCycle = $enrollment?->cycle;
        $metricsForEvaluation = $cycleMetrics ?? $allTimeMetrics;

        $nextLevel = null;
        if ($currentLevel) {
            $nextLevel = MlmLevel::where('company_id', $agent->company_id)
                ->where('rank', '>', $currentLevel->rank)
                ->ordered()
                ->with('criteria')
                ->first();
        } else {
            $nextLevel = MlmLevel::where('company_id', $agent->company_id)
                ->ordered()
                ->with('criteria')
                ->first();
        }

        $criteriaProgress = [];
        $overallProgress = 0;

        if ($nextLevel && $nextLevel->criteria->count() > 0 && $metricsForEvaluation) {
            $totalCriteria = $nextLevel->criteria->count();
            $metCount = 0;

            foreach ($nextLevel->criteria as $criterion) {
                $currentValue = $criterion->metric->resolveValue($metricsForEvaluation);
                $targetValue = (float) $criterion->threshold;
                $met = $criterion->evaluate($metricsForEvaluation);
                $percentage = $targetValue > 0 ? min(100, ($currentValue / $targetValue) * 100) : 0;

                if ($met) $metCount++;

                $criteriaProgress[] = [
                    'criterion' => $criterion,
                    'current_value' => $currentValue,
                    'target_value' => $targetValue,
                    'met' => $met,
                    'percentage' => round($percentage, 1),
                ];
            }

            $overallProgress = $totalCriteria > 0 ? round(($metCount / $totalCriteria) * 100, 1) : 0;
        }

        $commissionQuery = MlmCommission::where('agent_id', $agent->id)
            ->where('type', '!=', MlmCommissionType::System->value);

        $totalEarnings = (float) (clone $commissionQuery)->sum('amount');
        $pendingEarnings = (float) (clone $commissionQuery)->where('status', MlmCommissionStatus::Pending->value)->sum('amount');
        $paidEarnings = (float) MlmCommission::where('agent_id', $agent->id)
            ->where('type', '!=', MlmCommissionType::System->value)
            ->where('status', MlmCommissionStatus::Paid->value)
            ->sum('amount');

        $totalDownlines = AgentHierarchy::where('ancestor_id', $agent->id)->count();

        $monthlyCommissions = MlmCommission::where('agent_id', $agent->id)
            ->where('type', '!=', MlmCommissionType::System->value)
            ->where('created_at', '>=', now()->subMonths(12))
            ->select(
                DB::raw("DATE_FORMAT(created_at, '%Y-%m') as month"),
                DB::raw('SUM(amount) as amount')
            )
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $recentCommissions = MlmCommission::where('agent_id', $agent->id)
            ->where('type', '!=', MlmCommissionType::System->value)
            ->with(['deal:id,name,value', 'sourceAgent.user:id,name', 'level:id,name'])
            ->orderByDesc('created_at')
            ->limit(5)
            ->get();

        return [
            'current_level' => $currentLevel,
            'next_level' => $nextLevel,
            'progress_percentage' => $overallProgress,
            'criteria_progress' => $criteriaProgress,
            'total_earnings' => $totalEarnings,
            'pending_earnings' => $pendingEarnings,
            'paid_earnings' => $paidEarnings,
            'total_downlines' => $totalDownlines,
            'total_sales' => $allTimeMetrics?->nsa ?? 0,
            'total_sales_value' => (float) ($allTimeMetrics?->vsa ?? 0),
            'all_time_metrics' => $allTimeMetrics ? [
                'nsa' => $allTimeMetrics->nsa,
                'nsd' => $allTimeMetrics->nsd,
                'vsa' => (float) $allTimeMetrics->vsa,
                'vsd' => (float) $allTimeMetrics->vsd,
            ] : null,
            'monthly_commissions' => $monthlyCommissions,
            'network_growth' => [],
            'recent_commissions' => $recentCommissions,
            'enrollment' => $enrollment ? [
                'id' => $enrollment->id,
                'status' => $enrollment->status->value,
                'effective_start_date' => $enrollment->effective_start_date?->format('Y-m-d'),
                'effective_end_date' => $enrollment->effective_end_date?->format('Y-m-d'),
                'overflow_start_date' => $enrollment->overflow_start_date?->format('Y-m-d'),
                'max_overflow_date' => $enrollment->max_overflow_date?->format('Y-m-d'),
                'days_remaining' => $enrollment->daysRemaining(),
                'is_overflowing' => $enrollment->isOverflowing(),
            ] : null,
            'cycle_metrics' => $cycleMetrics ? [
                'nsa' => $cycleMetrics->nsa,
                'nsd' => $cycleMetrics->nsd,
                'vsa' => (float) $cycleMetrics->vsa,
                'vsd' => (float) $cycleMetrics->vsd,
            ] : null,
            'active_cycle' => $activeCycle ? [
                'cycle_number' => $activeCycle->cycle_number,
                'name' => $activeCycle->name,
                'start_date' => $activeCycle->start_date->format('Y-m-d'),
                'end_date' => $activeCycle->end_date->format('Y-m-d'),
                'days_remaining' => max(0, (int) now()->startOfDay()->diffInDays($activeCycle->end_date, false)),
            ] : null,
        ];
    }
}
