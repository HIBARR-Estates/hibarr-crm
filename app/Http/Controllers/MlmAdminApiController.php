<?php

namespace App\Http\Controllers;

use App\Enums\MlmCommissionStatus;
use App\Enums\MlmCommissionType;
use App\Enums\MlmMetric;
use App\Enums\CycleDurationType;
use App\Enums\CycleStatus;
use App\Models\AgentCycleEnrollment;
use App\Models\AgentHierarchy;
use App\Models\AgentLevelHistory;
use App\Models\AgentMetric;
use App\Models\Deal;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Models\MlmCycle;
use App\Models\MlmSetting;
use App\Models\MlmLevel;
use App\Models\MlmLevelCriterion;
use App\Services\CycleService;
use App\Services\CycleLevelSnapshotService;
use App\Services\HierarchyService;
use App\Services\LevelService;
use App\Services\AgentCommissionProfileService;
use App\Services\MlmCommissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class MlmAdminApiController extends AccountBaseController
{
    protected HierarchyService $hierarchyService;
    protected LevelService $levelService;
    protected MlmCommissionService $commissionService;
    protected CycleService $cycleService;
    protected CycleLevelSnapshotService $snapshotService;
    protected AgentCommissionProfileService $commissionProfileService;

    public function __construct(
        HierarchyService $hierarchyService,
        LevelService $levelService,
        MlmCommissionService $commissionService,
        CycleService $cycleService,
        CycleLevelSnapshotService $snapshotService,
        AgentCommissionProfileService $commissionProfileService
    ) {
        parent::__construct();
        $this->hierarchyService = $hierarchyService;
        $this->levelService = $levelService;
        $this->commissionService = $commissionService;
        $this->cycleService = $cycleService;
        $this->snapshotService = $snapshotService;
        $this->commissionProfileService = $commissionProfileService;
    }

    // ══════════════════════════════════════════════════════════════
    //  DASHBOARD STATS
    // ══════════════════════════════════════════════════════════════

    public function dashboardStats(): JsonResponse
    {
        $companyId = company()->id;

        $totalAgents = LeadAgent::where('company_id', $companyId)->count();
        $totalDealsWon = Deal::where('company_id', $companyId)
            ->where('outcome_status', 'won')
            ->count();

        $commissionQuery = MlmCommission::where('company_id', $companyId);

        $totalCommissionsPaid = (clone $commissionQuery)
            ->where('status', MlmCommissionStatus::Paid->value)
            ->sum('amount');

        $pendingCommissions = (clone $commissionQuery)
            ->where('status', MlmCommissionStatus::Pending->value)
            ->sum('amount');

        $totalCommissionValue = (clone $commissionQuery)->sum('amount');

        $totalSalesValue = Deal::where('company_id', $companyId)
            ->where('outcome_status', 'won')
            ->sum(DB::raw('COALESCE(value, 0)'));

        // Top 10 agents by total earned
        $topAgents = MlmCommission::where('mlm_commissions.company_id', $companyId)
            ->where('mlm_commissions.type', '!=', MlmCommissionType::System->value)
            ->select('agent_id', DB::raw('SUM(amount) as total_earned'), DB::raw('COUNT(DISTINCT deal_id) as deals_count'))
            ->groupBy('agent_id')
            ->orderByDesc('total_earned')
            ->limit(10)
            ->with(['agent.user:id,name,email,image', 'agent.currentLevelHistory.level'])
            ->get();

        // Recent promotions (exclude base-level assignments)
        $baseLevelId = MlmLevel::where('company_id', $companyId)->ordered()->value('id');

        $recentPromotions = AgentLevelHistory::where('company_id', $companyId)
            ->when($baseLevelId, fn ($q) => $q->where('level_id', '!=', $baseLevelId))
            ->orderByDesc('assigned_at')
            ->limit(10)
            ->with(['agent.user:id,name,email,image', 'level'])
            ->get();

        // Monthly commissions (last 12 months)
        $monthlyCommissions = MlmCommission::where('company_id', $companyId)
            ->where('created_at', '>=', now()->subMonths(12))
            ->select(
                DB::raw("DATE_FORMAT(created_at, '%Y-%m') as month"),
                DB::raw('SUM(amount) as amount'),
                DB::raw('COUNT(*) as count')
            )
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        return response()->json([
            'total_agents' => $totalAgents,
            'total_deals_won' => $totalDealsWon,
            'total_commissions_paid' => (float) $totalCommissionsPaid,
            'pending_commissions' => (float) $pendingCommissions,
            'total_commission_value' => (float) $totalCommissionValue,
            'total_sales_value' => (float) $totalSalesValue,
            'top_agents' => $topAgents,
            'recent_promotions' => $recentPromotions,
            'monthly_commissions' => $monthlyCommissions,
        ]);
    }

    // ══════════════════════════════════════════════════════════════
    //  MLM LEVELS
    // ══════════════════════════════════════════════════════════════

    public function getLevels(): JsonResponse
    {
        $levels = MlmLevel::where('company_id', company()->id)
            ->ordered()
            ->with('criteria')
            ->get();

        $hasActiveCycle = MlmCycle::where('company_id', company()->id)
            ->active()
            ->exists();

        return response()->json([
            'status' => 'success',
            'data' => $levels,
            'has_active_cycle' => $hasActiveCycle,
        ]);
    }

    public function getLevel(int $id): JsonResponse
    {
        $level = MlmLevel::where('company_id', company()->id)
            ->with('criteria')
            ->findOrFail($id);

        $hasActiveCycle = MlmCycle::where('company_id', company()->id)
            ->active()
            ->exists();

        return response()->json([
            'status' => 'success',
            'data' => $level,
            'has_active_cycle' => $hasActiveCycle,
        ]);
    }

    public function storeLevel(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'rank' => 'required|integer|min:1',
            'commission_percentage' => 'required|numeric|min:0|max:100',
            'direct_rate' => 'nullable|numeric|min:0|max:100',
            'override_rate' => 'nullable|numeric|min:0|max:100',
            'is_hidden' => 'sometimes|boolean',
        ]);

        $commissionPct = $validated['commission_percentage'];

        $level = MlmLevel::create([
            'company_id' => company()->id,
            'name' => $validated['name'],
            'slug' => \Str::slug($validated['name']),
            'rank' => $validated['rank'],
            'commission_percentage' => $commissionPct,
            'direct_rate' => $validated['direct_rate'] ?? $commissionPct,
            'override_rate' => $validated['override_rate'] ?? $commissionPct,
            'is_hidden' => $validated['is_hidden'] ?? false,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Level created successfully.',
            'data' => $level->load('criteria'),
        ], 201);
    }

    public function updateLevel(Request $request, int $id): JsonResponse
    {
        $level = MlmLevel::where('company_id', company()->id)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'rank' => 'required|integer|min:1',
            'commission_percentage' => 'required|numeric|min:0|max:100',
            'direct_rate' => 'nullable|numeric|min:0|max:100',
            'override_rate' => 'nullable|numeric|min:0|max:100',
            'is_hidden' => 'sometimes|boolean',
        ]);

        $commissionPct = $validated['commission_percentage'];

        $level->update([
            'name' => $validated['name'],
            'slug' => \Str::slug($validated['name']),
            'rank' => $validated['rank'],
            'commission_percentage' => $commissionPct,
            'direct_rate' => $validated['direct_rate'] ?? $commissionPct,
            'override_rate' => $validated['override_rate'] ?? $commissionPct,
            'is_hidden' => $validated['is_hidden'] ?? $level->is_hidden,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Level updated successfully.',
            'data' => $level->fresh()->load('criteria'),
        ]);
    }

    public function destroyLevel(int $id): JsonResponse
    {
        $level = MlmLevel::where('company_id', company()->id)->findOrFail($id);
        $level->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Level deleted successfully.',
        ]);
    }

    public function reorderLevels(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'levels' => 'required|array',
            'levels.*.id' => 'required|integer|exists:mlm_levels,id',
            'levels.*.rank' => 'required|integer|min:1',
        ]);

        DB::transaction(function () use ($validated) {
            foreach ($validated['levels'] as $item) {
                MlmLevel::where('id', $item['id'])
                    ->where('company_id', company()->id)
                    ->update(['rank' => $item['rank']]);
            }
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Levels reordered successfully.',
        ]);
    }

    // ══════════════════════════════════════════════════════════════
    //  LEVEL CRITERIA
    // ══════════════════════════════════════════════════════════════

    public function getLevelCriteria(int $levelId): JsonResponse
    {
        $level = MlmLevel::where('company_id', company()->id)->findOrFail($levelId);

        return response()->json([
            'status' => 'success',
            'data' => $level->criteria,
        ]);
    }

    public function storeCriterion(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mlm_level_id' => 'required|integer|exists:mlm_levels,id',
            'logic_group' => 'required|integer|min:1',
            'metric' => 'required|string|in:' . implode(',', MlmMetric::toArray()),
            'operator' => 'required|string|in:>=,>,<=,<,=',
            'threshold' => 'required|numeric|min:0',
            'description' => 'nullable|string|max:500',
        ]);

        // Verify the level belongs to this company
        MlmLevel::where('company_id', company()->id)
            ->findOrFail($validated['mlm_level_id']);

        $criterion = MlmLevelCriterion::create($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Criterion created successfully.',
            'data' => $criterion,
        ], 201);
    }

    public function updateCriterion(Request $request, int $id): JsonResponse
    {
        $criterion = MlmLevelCriterion::findOrFail($id);

        // Verify ownership via level
        MlmLevel::where('company_id', company()->id)
            ->findOrFail($criterion->mlm_level_id);

        $validated = $request->validate([
            'logic_group' => 'sometimes|integer|min:1',
            'metric' => 'sometimes|string|in:' . implode(',', MlmMetric::toArray()),
            'operator' => 'sometimes|string|in:>=,>,<=,<,=',
            'threshold' => 'sometimes|numeric|min:0',
            'description' => 'nullable|string|max:500',
        ]);

        $criterion->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Criterion updated successfully.',
            'data' => $criterion->fresh(),
        ]);
    }

    public function destroyCriterion(int $id): JsonResponse
    {
        $criterion = MlmLevelCriterion::findOrFail($id);

        MlmLevel::where('company_id', company()->id)
            ->findOrFail($criterion->mlm_level_id);

        $criterion->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Criterion deleted successfully.',
        ]);
    }

    // ══════════════════════════════════════════════════════════════
    //  COMMISSIONS
    // ══════════════════════════════════════════════════════════════

    public function getCommissions(Request $request): JsonResponse
    {
        $query = MlmCommission::where('company_id', company()->id)
            ->with(['deal:id,name,value', 'agent.user:id,name,email,image', 'sourceAgent.user:id,name,email,image', 'level'])
            ->orderByDesc('created_at');

        // Filters
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('agent_id')) {
            $query->where(function ($q) use ($request) {
                $q->where('agent_id', $request->input('agent_id'))
                    ->orWhere('source_agent_id', $request->input('agent_id'));
            });
        }

        if ($request->filled('deal_id')) {
            $query->where('deal_id', $request->input('deal_id'));
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

    public function markCommissionPaid(int $id): JsonResponse
    {
        $commission = MlmCommission::where('company_id', company()->id)->findOrFail($id);

        try {
            $commission->markPaid();
        } catch (\DomainException $e) {
            return response()->json([
                'status' => 'fail',
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Commission marked as paid.',
            'data' => $commission->fresh()->load(['deal', 'agent.user', 'level']),
        ]);
    }

    public function bulkMarkPaid(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:mlm_commissions,id',
        ]);

        $count = MlmCommission::where('company_id', company()->id)
            ->whereIn('id', $validated['ids'])
            ->where('status', MlmCommissionStatus::Pending->value)
            ->update([
                'status' => MlmCommissionStatus::Paid->value,
                'paid_at' => now(),
            ]);

        return response()->json([
            'status' => 'success',
            'message' => "{$count} commission(s) marked as paid.",
        ]);
    }

    public function revertCommission(Request $request, int $id): JsonResponse
    {
        $commission = MlmCommission::where('company_id', company()->id)->findOrFail($id);

        $validated = $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        try {
            $commission->revert($validated['reason']);
        } catch (\DomainException $e) {
            return response()->json([
                'status' => 'fail',
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Commission reverted.',
            'data' => $commission->fresh()->load(['deal', 'agent.user', 'level']),
        ]);
    }

    public function exportCommissions(Request $request)
    {
        $query = MlmCommission::where('company_id', company()->id)
            ->with(['deal:id,name,value', 'agent.user:id,name,email', 'sourceAgent.user:id,name,email', 'level:id,name'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $commissions = $query->get();

        $csv = "Deal,Source Agent,Recipient,Level,Percentage,Amount,Type,Status,Date\n";

        foreach ($commissions as $c) {
            $csv .= sprintf(
                '"%s","%s","%s","%s","%.2f%%","%.2f","%s","%s","%s"' . "\n",
                $c->deal?->name ?? '',
                $c->sourceAgent?->user?->name ?? '',
                $c->agent?->user?->name ?? '',
                $c->level?->name ?? 'System',
                $c->percentage,
                $c->amount,
                $c->type->value ?? $c->type,
                $c->status->value ?? $c->status,
                $c->created_at->format('Y-m-d H:i:s')
            );
        }

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="commissions_export_' . now()->format('Y-m-d') . '.csv"',
        ]);
    }

    // ══════════════════════════════════════════════════════════════
    //  AGENT METRICS
    // ══════════════════════════════════════════════════════════════

    public function getAgentMetrics(Request $request): JsonResponse
    {
        $query = AgentMetric::where('company_id', company()->id)
            ->with(['agent.user:id,name,email,image', 'agent.currentLevelHistory.level'])
            ->whereHas('agent.user', fn ($q) => $q->where('users.status', 'active'));

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->whereHas('agent.user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%");
            });
        }

        $sortBy = $request->input('sort_by', 'vsa');
        $sortDir = $request->input('sort_direction', 'desc');
        $query->orderBy($sortBy, $sortDir);

        $perPage = min($request->input('per_page', 15), 100);

        $paginated = $query->paginate($perPage);

        // Batch-load active cycle metrics for all agents on this page
        $agentIds = $paginated->pluck('agent_id')->toArray();
        $cycleMetricsMap = AgentCycleEnrollment::whereIn('agent_id', $agentIds)
            ->receiving()
            ->with('metrics')
            ->get()
            ->keyBy('agent_id');

        // Inject cycle metrics so the model's appended attributes use them
        $paginated->getCollection()->each(function (AgentMetric $metric) use ($cycleMetricsMap) {
            $cycleMetrics = $cycleMetricsMap->get($metric->agent_id)?->metrics;
            if ($cycleMetrics) {
                $metric->metricsSourceOverride = $cycleMetrics;
            }
        });

        return response()->json($paginated);
    }

    /**
     * Manually assign a level to an agent.
     */
    public function assignAgentLevel(Request $request, int $agentId): JsonResponse
    {
        $agent = LeadAgent::where('company_id', company()->id)->findOrFail($agentId);

        $validated = $request->validate([
            'level_id' => 'required|integer|exists:mlm_levels,id',
        ]);

        $level = MlmLevel::where('company_id', company()->id)
            ->findOrFail($validated['level_id']);

        $currentLevel = $this->levelService->getCurrentLevel($agent);

        if ($currentLevel?->id === $level->id) {
            return response()->json([
                'status' => 'fail',
                'message' => 'Agent is already assigned to this level.',
            ], 422);
        }

        $history = $this->levelService->assignLevel(
            $agent,
            $level,
            assignedBy: auth()->id(),
            systemAssigned: false
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Level assigned successfully.',
            'data' => $history->load(['agent.user:id,name,email,image', 'level', 'assignedByUser:id,name']),
        ]);
    }

    public function getAgentCommissionProfile(Request $request, int $agentId): JsonResponse
    {
        if (!config('features.sales.per-agent-commission-override')) {
            abort(404);
        }

        $perPage = min((int) $request->input('audit_per_page', 15), 100);

        return response()->json([
            'status' => 'success',
            'data' => $this->commissionProfileService->getProfile($agentId, company()->id, $perPage),
        ]);
    }

    public function updateAgentCommissionProfile(Request $request, int $agentId): JsonResponse
    {
        if (!config('features.sales.per-agent-commission-override')) {
            abort(404);
        }

        $validated = $request->validate([
            'custom_commission_rate' => 'nullable|numeric|min:0|max:100',
            'reason' => 'nullable|string|max:1000',
        ]);

        $result = $this->commissionProfileService->updateProfile(
            $agentId,
            company()->id,
            auth()->id(),
            $validated
        );

        if (!empty($result['errors'])) {
            return response()->json([
                'status' => 'fail',
                'message' => 'Commission rate validation failed.',
                'errors' => $result['errors'],
            ], 422);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Commission profile updated successfully.',
            'data' => $result['profile'],
        ]);
    }

    // ══════════════════════════════════════════════════════════════
    //  LEVEL HISTORY
    // ══════════════════════════════════════════════════════════════

    public function getLevelHistory(Request $request): JsonResponse
    {
        $query = AgentLevelHistory::where('company_id', company()->id)
            ->with(['agent.user:id,name,email,image', 'level', 'assignedByUser:id,name', 'triggerDeal:id,name,value'])
            ->orderByDesc('assigned_at');

        if ($request->filled('agent_id')) {
            $query->where('agent_id', $request->input('agent_id'));
        }

        if ($request->filled('level_id')) {
            $query->where('level_id', $request->input('level_id'));
        }

        if ($request->filled('method')) {
            $query->where('system_assigned', $request->input('method') === 'system');
        }

        if ($request->filled('date_from')) {
            $query->where('assigned_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->where('assigned_at', '<=', $request->input('date_to') . ' 23:59:59');
        }

        $perPage = min($request->input('per_page', 15), 100);

        return response()->json($query->paginate($perPage));
    }

    // ══════════════════════════════════════════════════════════════
    //  HIERARCHY
    // ══════════════════════════════════════════════════════════════

    public function getHierarchy(Request $request): JsonResponse
    {
        $companyId = company()->id;

        // Get root agents (no parent) — only those with an active user
        $rootAgents = LeadAgent::where('company_id', $companyId)
            ->whereNull('parent_agent_id')
            ->whereHas('user', fn ($q) => $q->where('users.status', 'active'))
            ->with(['user:id,name,email,image', 'currentLevelHistory.level', 'metrics'])
            ->get();

        $tree = $rootAgents->map(function ($agent) {
            return $this->buildHierarchyNode($agent, 0, 5); // Max 5 depth
        });

        return response()->json(['status' => 'success', 'data' => $tree]);
    }

    private function buildHierarchyNode(LeadAgent $agent, int $depth, int $maxDepth): array
    {
        $level = $agent->currentLevelHistory?->level;
        $metrics = $agent->metrics;

        $node = [
            'id' => $agent->id,
            'name' => $agent->user?->name ?? 'Unknown',
            'email' => $agent->user?->email,
            'image_url' => $agent->user?->image_url ?? null,
            'level_name' => $level?->name,
            'level_rank' => $level?->rank,
            'nsa' => $metrics?->nsa ?? 0,
            'nsd' => $metrics?->nsd ?? 0,
            'vsa' => (float) ($metrics?->vsa ?? 0),
            'vsd' => (float) ($metrics?->vsd ?? 0),
            'total_sales' => ($metrics?->nsa ?? 0) + ($metrics?->nsd ?? 0),
            'joined_date' => $agent->created_at?->format('Y-m-d'),
            'children' => [],
        ];

        if ($depth < $maxDepth) {
            $children = LeadAgent::where('parent_agent_id', $agent->id)
                ->whereHas('user', fn ($q) => $q->where('users.status', 'active'))
                ->with(['user:id,name,email,image', 'currentLevelHistory.level', 'metrics'])
                ->get();

            $node['children'] = $children->map(function ($child) use ($depth, $maxDepth) {
                return $this->buildHierarchyNode($child, $depth + 1, $maxDepth);
            })->toArray();
        }

        return $node;
    }

    public function assignDownline(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'child_agent_id' => 'required|integer|exists:lead_agents,id',
            'parent_agent_id' => 'required|integer|exists:lead_agents,id|different:child_agent_id',
        ]);

        $child = LeadAgent::where('company_id', company()->id)
            ->findOrFail($validated['child_agent_id']);
        $parent = LeadAgent::where('company_id', company()->id)
            ->findOrFail($validated['parent_agent_id']);

        $this->hierarchyService->setParent($child, $parent);

        return response()->json([
            'status' => 'success',
            'message' => 'Downline assigned successfully.',
        ]);
    }

    public function removeHierarchy(int $agentId): JsonResponse
    {
        $agent = LeadAgent::where('company_id', company()->id)->findOrFail($agentId);
        $this->hierarchyService->removeParent($agent);

        return response()->json([
            'status' => 'success',
            'message' => 'Agent removed from hierarchy.',
        ]);
    }

    // ══════════════════════════════════════════════════════════════
    //  SETTINGS
    // ══════════════════════════════════════════════════════════════

    public function getSettings(): JsonResponse
    {
        $settings = MlmSetting::forCompany(company()->id);

        return response()->json([
            'status' => 'success',
            'data' => [
                'max_commission_percentage' => (float) $settings->max_commission_percentage,
                'auto_evaluate_ancestors' => (bool) $settings->auto_evaluate_ancestors,
                'enable_commission_reversal' => (bool) $settings->enable_commission_reversal,
                'auto_generate_cycles' => (bool) $settings->auto_generate_cycles,
                'default_cycle_duration_type' => $settings->default_cycle_duration_type?->value ?? 'monthly',
                'default_cycle_duration_days' => $settings->default_cycle_duration_days,
                'default_overflow_multiplier' => (float) $settings->default_overflow_multiplier,
            ],
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'max_commission_percentage' => 'required|numeric|min:0|max:100',
            'auto_evaluate_ancestors' => 'required|boolean',
            'enable_commission_reversal' => 'required|boolean',
            'auto_generate_cycles' => 'sometimes|boolean',
            'default_cycle_duration_type' => 'sometimes|string|in:monthly,quarterly,custom',
            'default_cycle_duration_days' => 'nullable|integer|min:1|max:365',
            'default_overflow_multiplier' => 'sometimes|numeric|min:0|max:5',
        ]);

        $settings = MlmSetting::forCompany(company()->id);
        $settings->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'MLM settings updated successfully.',
            'data' => [
                'max_commission_percentage' => (float) $settings->max_commission_percentage,
                'auto_evaluate_ancestors' => (bool) $settings->auto_evaluate_ancestors,
                'enable_commission_reversal' => (bool) $settings->enable_commission_reversal,
                'auto_generate_cycles' => (bool) $settings->auto_generate_cycles,
                'default_cycle_duration_type' => $settings->default_cycle_duration_type?->value ?? 'monthly',
                'default_cycle_duration_days' => $settings->default_cycle_duration_days,
                'default_overflow_multiplier' => (float) $settings->default_overflow_multiplier,
            ],
        ]);
    }

    // ══════════════════════════════════════════════════════════════
    //  SIMULATION
    // ══════════════════════════════════════════════════════════════

    public function simulate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'deal_value' => 'required|numeric|min:1',
            'agent_id' => 'required|integer|exists:lead_agents,id',
        ]);

        $agent = LeadAgent::where('company_id', company()->id)
            ->with(['currentLevelHistory.level'])
            ->findOrFail($validated['agent_id']);

        $dealValue = (float) $validated['deal_value'];
        $maxCommission = (float) config('mlm.max_commission_percentage');

        $agentLevel = $agent->currentLevelHistory?->level;
        $agentPct = $agentLevel ? (float) $agentLevel->commission_percentage : 0;

        $entries = [];
        $cumulativePct = 0;

        // 1. Agent's own commission
        if ($agentPct > 0) {
            $effectivePct = min($agentPct, $maxCommission);
            $entries[] = [
                'agent_name' => $agent->user?->name ?? 'Unknown',
                'agent_id' => $agent->id,
                'level_name' => $agentLevel->name,
                'type' => 'agent',
                'percentage' => $effectivePct,
                'amount' => round($dealValue * $effectivePct / 100, 2),
            ];
            $cumulativePct = $effectivePct;
        }

        // 2. Upline commissions
        if ($cumulativePct < $maxCommission) {
            $ancestors = $this->hierarchyService->getAncestorsWithLevels($agent);

            foreach ($ancestors as $ancestor) {
                if ($cumulativePct >= $maxCommission) break;

                $ancestorLevel = $ancestor->currentLevelHistory?->level;
                if (!$ancestorLevel) continue;

                $ancestorPct = (float) $ancestorLevel->commission_percentage;
                if ($ancestorPct > $cumulativePct) {
                    $differential = $ancestorPct - $cumulativePct;
                    $effectivePct = min($differential, $maxCommission - $cumulativePct);

                    if ($effectivePct > 0) {
                        $entries[] = [
                            'agent_name' => $ancestor->user?->name ?? 'Unknown',
                            'agent_id' => $ancestor->id,
                            'level_name' => $ancestorLevel->name,
                            'type' => 'upline',
                            'percentage' => round($effectivePct, 2),
                            'amount' => round($dealValue * $effectivePct / 100, 2),
                        ];
                        $cumulativePct += $effectivePct;
                    }
                }
            }
        }

        // 3. System commission
        $remainingPct = $maxCommission - $cumulativePct;
        $systemAmount = 0;

        if ($remainingPct > 0.001) {
            $systemAmount = round($dealValue * $remainingPct / 100, 2);
            $entries[] = [
                'agent_name' => 'System',
                'agent_id' => 0,
                'level_name' => 'N/A',
                'type' => 'system',
                'percentage' => round($remainingPct, 2),
                'amount' => $systemAmount,
            ];
        }

        $totalDistributed = array_sum(array_column($entries, 'amount'));

        return response()->json([
            'status' => 'success',
            'data' => [
                'entries' => $entries,
                'total_distributed' => $totalDistributed,
                'system_commission' => $systemAmount,
                'deal_value' => $dealValue,
            ],
        ]);
    }

    // ══════════════════════════════════════════════════════════════
    //  CYCLE MANAGEMENT
    // ══════════════════════════════════════════════════════════════

    /**
     * List all cycles with enrollment counts.
     */
    public function getCycles(Request $request): JsonResponse
    {
        $query = MlmCycle::where('company_id', company()->id)
            ->withCount('enrollments')
            ->orderByDesc('cycle_number');

        $perPage = min($request->input('per_page', 15), 100);

        return response()->json($query->paginate($perPage));
    }

    /**
     * Get the currently active cycle with summary.
     */
    public function getActiveCycle(): JsonResponse
    {
        $cycle = $this->cycleService->getOrCreateCurrentCycle(company()->id);
        $settings = MlmSetting::where('company_id', company()->id)->first();

        $enrollmentCount = 0;
        $daysRemaining = 0;

        if ($cycle) {
            $enrollmentCount = AgentCycleEnrollment::where('cycle_id', $cycle->id)->count();
            $daysRemaining = max(0, (int) now()->startOfDay()->diffInDays($cycle->end_date, false));
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'cycle' => $cycle ? [
                    'id' => $cycle->id,
                    'cycle_number' => $cycle->cycle_number,
                    'name' => $cycle->name,
                    'start_date' => $cycle->start_date->format('Y-m-d'),
                    'end_date' => $cycle->end_date->format('Y-m-d'),
                    'status' => $cycle->status->value,
                    'duration_days' => $cycle->duration_days,
                    'max_overflow_multiplier' => (float) $cycle->max_overflow_multiplier,
                ] : null,
                'default_overflow_multiplier' => $settings ? (float) $settings->default_overflow_multiplier : 1.0,
                'days_remaining' => $daysRemaining,
                'enrollment_count' => $enrollmentCount,
            ],
        ]);
    }

    /**
     * Create a new cycle (manual).
     */
    public function createCycle(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'max_overflow_multiplier' => 'sometimes|numeric|min:0|max:5',
        ]);

        $companyId = company()->id;
        $startDate = \Carbon\Carbon::parse($validated['start_date'])->startOfDay();
        $endDate = \Carbon\Carbon::parse($validated['end_date'])->startOfDay();

        // Validate no overlap
        $overlapError = $this->cycleService->validateNoOverlap($companyId, $startDate, $endDate);
        if ($overlapError) {
            return response()->json([
                'status' => 'fail',
                'message' => $overlapError,
            ], 422);
        }

        // Determine cycle number
        $lastNumber = MlmCycle::where('company_id', $companyId)->max('cycle_number') ?? 0;

        // Determine default overflow from settings
        $settings = MlmSetting::forCompany($companyId);

        // Determine initial status
        $today = now()->startOfDay();
        $status = 'upcoming';
        if ($today->between($startDate, $endDate)) {
            $status = 'active';
        } elseif ($today->gt($endDate)) {
            $status = 'completed';
        }


        $cycle = MlmCycle::create([
            'company_id' => $companyId,
            'cycle_number' => $lastNumber + 1,
            'name' => $validated['name'],
            'start_date' => $startDate,
            'end_date' => $endDate,
            'status' => $status,
            'max_overflow_multiplier' => $validated['max_overflow_multiplier'] ?? $settings->default_overflow_multiplier,

        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Cycle created successfully.',
            'data' => $cycle->loadCount('enrollments'),
        ], 201);
    }

    /**
     * Update an existing cycle (only if upcoming).
     */
    public function updateCycle(Request $request, int $id): JsonResponse
    {
        $cycle = MlmCycle::where('company_id', company()->id)->findOrFail($id);

        if ($cycle->status !== \App\Enums\CycleStatus::Upcoming) {
            return response()->json([
                'status' => 'fail',
                'message' => 'Only upcoming cycles can be edited.',
            ], 422);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date',
            'max_overflow_multiplier' => 'sometimes|numeric|min:0|max:5',
        ]);

        $startDate = isset($validated['start_date'])
            ? \Carbon\Carbon::parse($validated['start_date'])->startOfDay()
            : $cycle->start_date;
        $endDate = isset($validated['end_date'])
            ? \Carbon\Carbon::parse($validated['end_date'])->startOfDay()
            : $cycle->end_date;

        if ($endDate->lte($startDate)) {
            return response()->json([
                'status' => 'fail',
                'message' => 'End date must be after start date.',
            ], 422);
        }

        // Validate no overlap (exclude self)
        $overlapError = $this->cycleService->validateNoOverlap(company()->id, $startDate, $endDate, $cycle->id);
        if ($overlapError) {
            return response()->json([
                'status' => 'fail',
                'message' => $overlapError,
            ], 422);
        }

        $cycle->update(array_filter([
            'name' => $validated['name'] ?? null,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'max_overflow_multiplier' => $validated['max_overflow_multiplier'] ?? null,
        ], fn($v) => $v !== null));

        return response()->json([
            'status' => 'success',
            'message' => 'Cycle updated successfully.',
            'data' => $cycle->fresh()->loadCount('enrollments'),
        ]);
    }

    /**
     * Delete a cycle (only if upcoming and zero enrollments).
     */
    public function deleteCycle(int $id): JsonResponse
    {
        $cycle = MlmCycle::where('company_id', company()->id)
            ->withCount('enrollments')
            ->findOrFail($id);

        if ($cycle->status !== \App\Enums\CycleStatus::Upcoming) {
            return response()->json([
                'status' => 'fail',
                'message' => 'Only upcoming cycles can be deleted.',
            ], 422);
        }

        if ($cycle->enrollments_count > 0) {
            return response()->json([
                'status' => 'fail',
                'message' => 'Cannot delete a cycle that has enrollments.',
            ], 422);
        }

        $cycle->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Cycle deleted successfully.',
        ]);
    }

    /**
     * Get detailed cycle info with enrollments.
     */
    public function getCycleDetail(int $id): JsonResponse
    {
        $cycle = MlmCycle::where('company_id', company()->id)
            ->withCount('enrollments')
            ->findOrFail($id);

        $enrollments = AgentCycleEnrollment::where('cycle_id', $cycle->id)
            ->with(['agent.user:id,name,email,image', 'agent.currentLevelHistory.level', 'metrics', 'levelAchieved'])
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($enrollment) {
                return [
                    'id' => $enrollment->id,
                    'agent_id' => $enrollment->agent_id,
                    'agent_name' => $enrollment->agent?->user?->name ?? 'Unknown',
                    'agent_email' => $enrollment->agent?->user?->email,
                    'status' => $enrollment->status->value,
                    'effective_start_date' => $enrollment->effective_start_date?->format('Y-m-d'),
                    'effective_end_date' => $enrollment->effective_end_date?->format('Y-m-d'),
                    'overflow_start_date' => $enrollment->overflow_start_date?->format('Y-m-d'),
                    'max_overflow_date' => $enrollment->max_overflow_date?->format('Y-m-d'),
                    'criteria_met_at' => $enrollment->criteria_met_at?->format('Y-m-d H:i:s'),
                    'level_achieved' => $enrollment->levelAchieved?->name ?? $enrollment->agent?->currentLevelHistory?->level?->name,
                    'days_remaining' => $enrollment->daysRemaining(),
                    'is_overflowing' => $enrollment->isOverflowing(),
                    'metrics' => $enrollment->metrics ? [
                        'nsa' => $enrollment->metrics->nsa,
                        'nsd' => $enrollment->metrics->nsd,
                        'vsa' => (float) $enrollment->metrics->vsa,
                        'vsd' => (float) $enrollment->metrics->vsd,
                    ] : null,
                ];
            });

        return response()->json([
            'status' => 'success',
            'data' => [
                'cycle' => [
                    'id' => $cycle->id,
                    'cycle_number' => $cycle->cycle_number,
                    'name' => $cycle->name,
                    'start_date' => $cycle->start_date->format('Y-m-d'),
                    'end_date' => $cycle->end_date->format('Y-m-d'),
                    'status' => $cycle->status->value,
                    'duration_days' => $cycle->duration_days,
                    'enrollments_count' => $cycle->enrollments_count,
                ],
                'enrollments' => $enrollments,
            ],
        ]);
    }

    /**
     * Force-complete an extended enrollment.
     */
    public function forceCompleteEnrollment(int $cycleId, int $enrollmentId): JsonResponse
    {
        $cycle = MlmCycle::where('company_id', company()->id)->findOrFail($cycleId);

        $enrollment = AgentCycleEnrollment::where('cycle_id', $cycle->id)
            ->findOrFail($enrollmentId);

        if (!$enrollment->status->isReceivingMetrics()) {
            return response()->json([
                'status' => 'fail',
                'message' => 'This enrollment is not currently active or extended.',
            ], 422);
        }

        $this->cycleService->forceCompleteEnrollment($enrollment);

        return response()->json([
            'status' => 'success',
            'message' => 'Enrollment force-completed. Agent has been re-enrolled in the current cycle.',
        ]);
    }

    /**
     * Re-snapshot levels for an active cycle (emergency correction).
     */
    public function resnapshot(int $cycleId): JsonResponse
    {
        $cycle = MlmCycle::where('company_id', company()->id)->findOrFail($cycleId);

        if ($cycle->status !== CycleStatus::Active) {
            return response()->json([
                'status' => 'fail',
                'message' => 'Only active cycles can be re-snapshotted.',
            ], 422);
        }

        $this->snapshotService->reSnapshot($cycle);

        return response()->json([
            'status' => 'success',
            'message' => 'Levels have been re-snapshotted for this cycle. New commissions will use the updated rules.',
        ]);
    }

    /**
     * Dashboard stats for a specific agent (admin view).
     */
    public function getAgentDashboardStats(int $agentId): JsonResponse
    {
        $agent = LeadAgent::where('company_id', company()->id)->findOrFail($agentId);

        $adminController = app(MlmAdminController::class);

        return response()->json(['data' => $adminController->buildAgentDashboardStats($agent)]);
    }
}
