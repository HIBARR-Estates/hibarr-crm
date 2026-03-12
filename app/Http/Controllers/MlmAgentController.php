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
use App\Models\MlmLevelCriterion;
use App\Services\HierarchyService;
use App\Services\LevelService;
use App\Services\MetricsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class MlmAgentController extends AccountBaseController
{
    protected HierarchyService $hierarchyService;
    protected LevelService $levelService;

    public function __construct(HierarchyService $hierarchyService, LevelService $levelService)
    {
        parent::__construct();
        $this->hierarchyService = $hierarchyService;
        $this->levelService = $levelService;
    }

    /**
     * Get the current user's LeadAgent record.
     */
    private function getAgent(): ?LeadAgent
    {
        return LeadAgent::where('user_id', user()->id)
            ->where('company_id', company()->id)
            ->first();
    }

    /**
     * Agent MLM Dashboard
     */
    public function dashboard()
    {
        $agent = $this->getAgent();

        if (!$agent) {
            return Inertia::render('Mlm/Agent/Dashboard', [
                'stats' => null,
                'noAgent' => true,
            ]);
        }

        $metrics = AgentMetric::where('agent_id', $agent->id)->first();
        $currentLevel = $this->levelService->getCurrentLevel($agent);

        // Get next level
        $nextLevel = null;
        if ($currentLevel) {
            $nextLevel = MlmLevel::where('company_id', company()->id)
                ->where('rank', '>', $currentLevel->rank)
                ->ordered()
                ->with('criteria')
                ->first();
        } else {
            $nextLevel = MlmLevel::where('company_id', company()->id)
                ->ordered()
                ->with('criteria')
                ->first();
        }

        // Calculate progress
        $criteriaProgress = [];
        $overallProgress = 0;

        if ($nextLevel && $nextLevel->criteria->count() > 0 && $metrics) {
            $totalCriteria = $nextLevel->criteria->count();
            $metCount = 0;

            foreach ($nextLevel->criteria as $criterion) {
                $currentValue = $criterion->metric->resolveValue($metrics);
                $targetValue = (float) $criterion->threshold;
                $met = $criterion->evaluate($metrics);
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

        // Earnings
        $commissionQuery = MlmCommission::where('agent_id', $agent->id)
            ->where('type', '!=', MlmCommissionType::System->value);

        $totalEarnings = (float) (clone $commissionQuery)->sum('amount');
        $pendingEarnings = (float) (clone $commissionQuery)->where('status', MlmCommissionStatus::Pending->value)->sum('amount');
        $paidEarnings = (float) MlmCommission::where('agent_id', $agent->id)
            ->where('type', '!=', MlmCommissionType::System->value)
            ->where('status', MlmCommissionStatus::Paid->value)
            ->sum('amount');

        // Downlines count
        $totalDownlines = AgentHierarchy::where('ancestor_id', $agent->id)->count();

        // Monthly commissions (last 12 months)
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

        // Recent commissions
        $recentCommissions = MlmCommission::where('agent_id', $agent->id)
            ->where('type', '!=', MlmCommissionType::System->value)
            ->with(['deal:id,name,value', 'sourceAgent.user:id,name', 'level:id,name'])
            ->orderByDesc('created_at')
            ->limit(5)
            ->get();

        return Inertia::render('Mlm/Agent/Dashboard', [
            'stats' => [
                'current_level' => $currentLevel,
                'next_level' => $nextLevel,
                'progress_percentage' => $overallProgress,
                'criteria_progress' => $criteriaProgress,
                'total_earnings' => $totalEarnings,
                'pending_earnings' => $pendingEarnings,
                'paid_earnings' => $paidEarnings,
                'total_downlines' => $totalDownlines,
                'total_sales' => $metrics?->nsa ?? 0,
                'total_sales_value' => (float) ($metrics?->vsa ?? 0),
                'monthly_commissions' => $monthlyCommissions,
                'network_growth' => [],
                'recent_commissions' => $recentCommissions,
            ],
        ]);
    }

    /**
     * My Commissions — JSON API
     */
    public function commissionsApi(Request $request): JsonResponse
    {
        $agent = $this->getAgent();

        if (!$agent) {
            return response()->json(['data' => [], 'total' => 0]);
        }

        $query = MlmCommission::where('agent_id', $agent->id)
            ->where('type', '!=', MlmCommissionType::System->value)
            ->with(['deal:id,name,value,total_value', 'sourceAgent.user:id,name,email,image', 'level:id,name'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('date_from')) {
            $query->where('created_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->where('created_at', '<=', $request->input('date_to') . ' 23:59:59');
        }

        $perPage = min($request->input('per_page', 15), 100);

        return response()->json($query->paginate($perPage));
    }

    /**
     * My Commissions page
     */
    public function commissions()
    {
        $agent = $this->getAgent();

        $summary = ['total' => 0, 'pending' => 0, 'paid' => 0];

        if ($agent) {
            $base = MlmCommission::where('agent_id', $agent->id)
                ->where('type', '!=', MlmCommissionType::System->value);

            $summary['total'] = (float) (clone $base)->sum('amount');
            $summary['pending'] = (float) (clone $base)->where('status', MlmCommissionStatus::Pending->value)->sum('amount');
            $summary['paid'] = (float) MlmCommission::where('agent_id', $agent->id)
                ->where('type', '!=', MlmCommissionType::System->value)
                ->where('status', MlmCommissionStatus::Paid->value)
                ->sum('amount');
        }

        return Inertia::render('Mlm/Agent/MyCommissions', [
            'summary' => $summary,
        ]);
    }

    /**
     * My Network page
     */
    public function network()
    {
        return Inertia::render('Mlm/Agent/MyNetwork');
    }

    /**
     * My Network — JSON API
     */
    public function networkApi(): JsonResponse
    {
        $agent = $this->getAgent();

        if (!$agent) {
            return response()->json(['status' => 'success', 'data' => null]);
        }

        $tree = $this->buildNetworkNode($agent, 0, 5);

        return response()->json(['status' => 'success', 'data' => $tree]);
    }

    private function buildNetworkNode(LeadAgent $agent, int $depth, int $maxDepth): array
    {
        $level = $agent->currentLevelHistory?->level;
        $metrics = $agent->metrics ?? AgentMetric::where('agent_id', $agent->id)->first();

        $node = [
            'id' => $agent->id,
            'name' => $agent->user?->name ?? 'Unknown',
            'email' => $agent->user?->email,
            'image_url' => $agent->user?->image_url ?? null,
            'level_name' => $level?->name,
            'level_rank' => $level?->rank,
            'total_sales' => ($metrics?->nsa ?? 0) + ($metrics?->nsd ?? 0),
            'joined_date' => $agent->created_at?->format('Y-m-d'),
            'children' => [],
        ];

        if ($depth < $maxDepth) {
            $children = LeadAgent::where('parent_agent_id', $agent->id)
                ->with(['user:id,name,email,image', 'currentLevelHistory.level', 'metrics'])
                ->get();

            $node['children'] = $children->map(function ($child) use ($depth, $maxDepth) {
                return $this->buildNetworkNode($child, $depth + 1, $maxDepth);
            })->toArray();
        }

        return $node;
    }

    /**
     * My Uplines page
     */
    public function uplines()
    {
        return Inertia::render('Mlm/Agent/MyUplines');
    }

    /**
     * My Uplines — JSON API
     */
    public function uplinesApi(): JsonResponse
    {
        $agent = $this->getAgent();

        if (!$agent) {
            return response()->json(['status' => 'success', 'data' => []]);
        }

        $ancestors = $this->hierarchyService->getAncestors($agent)
            ->load(['user:id,name,email,image', 'currentLevelHistory.level']);

        $uplines = $ancestors->map(function ($ancestor, $index) {
            $level = $ancestor->currentLevelHistory?->level;
            return [
                'depth' => $index + 1,
                'id' => $ancestor->id,
                'name' => $ancestor->user?->name ?? 'Unknown',
                'email' => $ancestor->user?->email,
                'image_url' => $ancestor->user?->image_url ?? null,
                'level_name' => $level?->name,
                'level_rank' => $level?->rank,
            ];
        });

        return response()->json(['status' => 'success', 'data' => $uplines]);
    }

    /**
     * My Level page
     */
    public function myLevel()
    {
        return Inertia::render('Mlm/Agent/MyLevel');
    }

    /**
     * My Level — JSON API
     */
    public function myLevelApi(): JsonResponse
    {
        $agent = $this->getAgent();

        if (!$agent) {
            return response()->json(['status' => 'success', 'data' => null]);
        }

        $currentLevel = $this->levelService->getCurrentLevel($agent);
        $metrics = AgentMetric::where('agent_id', $agent->id)->first();

        // Next level
        $nextLevel = null;
        if ($currentLevel) {
            $nextLevel = MlmLevel::where('company_id', company()->id)
                ->where('rank', '>', $currentLevel->rank)
                ->ordered()
                ->with('criteria')
                ->first();
        } else {
            $nextLevel = MlmLevel::where('company_id', company()->id)
                ->ordered()
                ->with('criteria')
                ->first();
        }

        // Criteria progress
        $criteriaProgress = [];
        if ($nextLevel && $metrics) {
            foreach ($nextLevel->criteria as $criterion) {
                $currentValue = $criterion->metric->resolveValue($metrics);
                $targetValue = (float) $criterion->threshold;
                $met = $criterion->evaluate($metrics);
                $percentage = $targetValue > 0 ? min(100, ($currentValue / $targetValue) * 100) : 0;

                $criteriaProgress[] = [
                    'criterion' => $criterion,
                    'current_value' => $currentValue,
                    'target_value' => $targetValue,
                    'met' => $met,
                    'percentage' => round($percentage, 1),
                ];
            }
        }

        // Level history
        $levelHistory = AgentLevelHistory::where('agent_id', $agent->id)
            ->with(['level', 'triggerDeal:id,name'])
            ->orderByDesc('assigned_at')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'current_level' => $currentLevel,
                'next_level' => $nextLevel,
                'metrics' => [
                    'nsa' => $metrics?->nsa ?? 0,
                    'nsd' => $metrics?->nsd ?? 0,
                    'vsa' => (float) ($metrics?->vsa ?? 0),
                    'vsd' => (float) ($metrics?->vsd ?? 0),
                ],
                'criteria_progress' => $criteriaProgress,
                'level_history' => $levelHistory,
            ],
        ]);
    }

    /**
     * Deal Contributions page
     */
    public function dealContributions()
    {
        return Inertia::render('Mlm/Agent/MyDeals');
    }

    /**
     * Deal Contributions — JSON API
     */
    public function dealContributionsApi(Request $request): JsonResponse
    {
        $agent = $this->getAgent();

        if (!$agent) {
            return response()->json(['data' => [], 'total' => 0]);
        }

        $query = MlmCommission::where('agent_id', $agent->id)
            ->where('type', '!=', MlmCommissionType::System->value)
            ->with(['deal:id,name,value,total_value', 'sourceAgent.user:id,name'])
            ->orderByDesc('created_at');

        $perPage = min($request->input('per_page', 15), 100);
        $paginated = $query->paginate($perPage);

        $data = collect($paginated->items())->map(function ($c) use ($agent) {
            return [
                'deal_id' => $c->deal_id,
                'deal_name' => $c->deal?->name ?? 'Unknown Deal',
                'closed_by' => $c->sourceAgent?->user?->name ?? 'Unknown',
                'closed_by_self' => $c->source_agent_id === $agent->id,
                'deal_value' => (float) ($c->deal?->total_value ?? $c->deal?->value ?? 0),
                'commission_amount' => (float) $c->amount,
                'commission_type' => $c->type->value ?? $c->type,
                'date' => $c->created_at->format('Y-m-d'),
            ];
        });

        return response()->json([
            'data' => $data,
            'current_page' => $paginated->currentPage(),
            'last_page' => $paginated->lastPage(),
            'per_page' => $paginated->perPage(),
            'total' => $paginated->total(),
            'from' => $paginated->firstItem(),
            'to' => $paginated->lastItem(),
        ]);
    }
}
