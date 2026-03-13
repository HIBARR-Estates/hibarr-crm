<?php

namespace App\Http\Controllers;

use App\Enums\MlmCommissionStatus;
use App\Enums\MlmCommissionType;
use App\Enums\MlmMetric;
use App\Models\AgentLevelHistory;
use App\Models\AgentMetric;
use App\Models\Deal;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Models\MlmLevel;
use App\Models\MlmLevelCriterion;
use App\Services\HierarchyService;
use App\Services\LevelService;
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

    public function __construct(
        HierarchyService $hierarchyService,
        LevelService $levelService,
        MlmCommissionService $commissionService
    ) {
        parent::__construct();
        $this->hierarchyService = $hierarchyService;
        $this->levelService = $levelService;
        $this->commissionService = $commissionService;
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

        // Recent promotions
        $recentPromotions = AgentLevelHistory::where('company_id', $companyId)
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

        return response()->json(['status' => 'success', 'data' => $levels]);
    }

    public function getLevel(int $id): JsonResponse
    {
        $level = MlmLevel::where('company_id', company()->id)
            ->with('criteria')
            ->findOrFail($id);

        return response()->json(['status' => 'success', 'data' => $level]);
    }

    public function storeLevel(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'rank' => 'required|integer|min:1',
            'commission_percentage' => 'required|numeric|min:0|max:100',
        ]);

        $level = MlmLevel::create([
            'company_id' => company()->id,
            'name' => $validated['name'],
            'slug' => \Str::slug($validated['name']),
            'rank' => $validated['rank'],
            'commission_percentage' => $validated['commission_percentage'],
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
        ]);

        $level->update([
            'name' => $validated['name'],
            'slug' => \Str::slug($validated['name']),
            'rank' => $validated['rank'],
            'commission_percentage' => $validated['commission_percentage'],
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
            ->with(['agent.user:id,name,email,image', 'agent.currentLevelHistory.level']);

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

        // The model's $appends automatically includes:
        // current_level, next_level, progress_percentage, criteria_progress
        return response()->json($query->paginate($perPage));
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

        // Get root agents (no parent)
        $rootAgents = LeadAgent::where('company_id', $companyId)
            ->whereNull('parent_agent_id')
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
        return response()->json([
            'status' => 'success',
            'data' => [
                'max_commission_percentage' => (float) config('mlm.max_commission_percentage'),
                'auto_evaluate_ancestors' => (bool) config('mlm.auto_evaluate_ancestors'),
                'enable_commission_reversal' => true,
            ],
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'max_commission_percentage' => 'required|numeric|min:0|max:100',
            'auto_evaluate_ancestors' => 'required|boolean',
            'enable_commission_reversal' => 'required|boolean',
        ]);

        // Update the .env values or store in a settings table
        // For now, we update environment variables via helper
        $this->updateEnvValue('MLM_MAX_COMMISSION_PCT', $validated['max_commission_percentage']);
        $this->updateEnvValue('MLM_AUTO_EVALUATE_ANCESTORS', $validated['auto_evaluate_ancestors'] ? 'true' : 'false');

        return response()->json([
            'status' => 'success',
            'message' => 'MLM settings updated successfully.',
            'data' => $validated,
        ]);
    }

    private function updateEnvValue(string $key, $value): void
    {
        $path = base_path('.env');

        if (file_exists($path)) {
            $content = file_get_contents($path);

            if (str_contains($content, $key . '=')) {
                $content = preg_replace(
                    "/^{$key}=.*/m",
                    "{$key}={$value}",
                    $content
                );
            } else {
                $content .= "\n{$key}={$value}";
            }

            file_put_contents($path, $content);
        }
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
}
