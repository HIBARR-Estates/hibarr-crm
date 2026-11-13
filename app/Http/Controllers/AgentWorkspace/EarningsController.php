<?php

namespace App\Http\Controllers\AgentWorkspace;

use App\Enums\MlmCommissionStatus;
use App\Enums\MlmCommissionType;
use App\Http\Controllers\AccountBaseController;
use App\Models\AgentHierarchy;
use App\Models\AgentLevelHistory;
use App\Models\AgentMetric;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Models\MlmLevel;
use App\Services\AgentWorkspace\EarningsPresenter;
use App\Services\CycleService;
use App\Services\LevelService;
use App\Support\PartnerRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Earnings for the agent workspace: Overview, Ledger and Network. All of it is
 * the MLM module's own data (commissions, disputes, levels, cycles and the
 * agent hierarchy); the classic Affiliate pages read the same rows. Lists
 * arrive deferred and the pages themselves are light shells.
 */
class EarningsController extends AccountBaseController
{
    /** Most commission lines the Ledger loads for the year; more is noted on the page. */
    public const LEDGER_LIMIT = 500;

    /** Most agents the Network lists, across the generations the classic tree shows. */
    public const NETWORK_LIMIT = 300;

    public const NETWORK_DEPTH = 5;

    /** Latest commissions on the Overview. */
    public const LATEST_LIMIT = 6;

    /** Downline deals the agent panel lists. */
    public const PANEL_DEALS_LIMIT = 10;

    /** Commissions that count as earned: never the system's own, never a reverted one. */
    private function earned(LeadAgent $agent)
    {
        return MlmCommission::query()
            ->where('agent_id', $agent->id)
            ->where('type', '!=', MlmCommissionType::System->value)
            ->where('status', '!=', MlmCommissionStatus::Reverted->value);
    }

    private function base(string $view): array
    {
        return [
            'view' => $view,
            'pageTitle' => __('pages.agent_workspace.nav.earnings'),
            'currencySymbol' => EarningsPresenter::currencySymbol(),
        ];
    }

    /** Overview (L7-21): this month's earnings, what is pending, the latest lines and the level card. */
    public function overview(): Response
    {
        $agent = EarningsPresenter::agentFor(user());

        return Inertia::render('AgentWorkspace/Earnings', $this->base('overview') + [
            'isAgent' => $agent !== null,
            'month' => now()->startOfMonth()->toDateString(),
            'summary' => Inertia::defer(fn () => $agent ? $this->summary($agent) : null, 'summary'),
            'latest' => Inertia::defer(fn () => $agent ? $this->latest($agent) : [], 'latest'),
            'level' => Inertia::defer(fn () => $agent ? $this->levelCard($agent) : null, 'level'),
        ]);
    }

    /** Ledger (L7-22): every commission line of the year. */
    public function ledger(): Response
    {
        $agent = EarningsPresenter::agentFor(user());

        return Inertia::render('AgentWorkspace/Earnings', $this->base('ledger') + [
            'isAgent' => $agent !== null,
            'year' => now()->year,
            'ledger' => Inertia::defer(fn () => $agent ? $this->ledgerLines($agent) : ['items' => [], 'truncated' => false], 'ledger'),
        ]);
    }

    /** Network (L7-37): the upline, the agent and everyone below, with the numbers the classic network shows. */
    public function network(): Response
    {
        $agent = EarningsPresenter::agentFor(user());

        return Inertia::render('AgentWorkspace/Earnings', $this->base('network') + [
            'isAgent' => $agent !== null,
            'selfId' => $agent?->id,
            'network' => Inertia::defer(fn () => $agent ? $this->networkRows($agent) : ['rows' => [], 'truncated' => false], 'network'),
        ]);
    }

    /** The panel for one downline: all-time metrics, level history and what the agent earned on their deals. */
    public function agentPanel(int $agent): JsonResponse
    {
        $me = EarningsPresenter::agentFor(user());
        abort_if($me === null, 403);

        $isDownline = AgentHierarchy::query()
            ->where('ancestor_id', $me->id)
            ->where('descendant_id', $agent)
            ->exists();
        abort_unless($isDownline, 403);

        $downline = LeadAgent::query()
            ->with(['user:id,name', 'currentLevelHistory.level', 'metrics'])
            ->findOrFail($agent);
        $partnerOnly = PartnerRole::isPartnerOnly(user());
        $metrics = $downline->metrics ?? AgentMetric::query()->where('agent_id', $downline->id)->first();

        $history = AgentLevelHistory::query()
            ->where('agent_id', $downline->id)
            ->with(['level', 'triggerDeal:id,name'])
            ->orderByDesc('assigned_at')
            ->orderByDesc('id')
            ->get();
        $oldestId = $history->last()?->id;

        $deals = MlmCommission::query()
            ->where('agent_id', $me->id)
            ->where('source_agent_id', $downline->id)
            ->where('type', MlmCommissionType::Upline->value)
            ->with([$partnerOnly ? 'deal:id,name' : 'deal:id,name,value'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(self::PANEL_DEALS_LIMIT)
            ->get();

        return response()->json([
            'id' => $downline->id,
            'name' => $downline->user?->name,
            'level' => $this->visibleLevelName($downline->currentLevelHistory?->level),
            'direct' => LeadAgent::query()->where('parent_agent_id', $downline->id)->count(),
            'metrics' => [
                'nsa' => (int) ($metrics?->nsa ?? 0),
                'nsd' => (int) ($metrics?->nsd ?? 0),
                'vsa' => (float) ($metrics?->vsa ?? 0),
                'vsd' => (float) ($metrics?->vsd ?? 0),
            ],
            // A hidden level is never named to an agent, so its entries are left out.
            'history' => $history
                ->filter(fn (AgentLevelHistory $entry) => $entry->level && ! $entry->level->is_hidden)
                ->map(fn (AgentLevelHistory $entry) => [
                    'assigned_at' => $entry->assigned_at?->toIso8601String(),
                    'level' => $entry->level->name,
                    'system' => (bool) $entry->system_assigned,
                    'joined' => $entry->id === $oldestId && ! $entry->trigger_deal_id,
                    'deal' => $entry->triggerDeal?->name,
                ])
                ->values(),
            'deals' => $deals->map(fn (MlmCommission $c) => [
                'id' => $c->id,
                'deal_id' => $c->deal_id,
                'deal_name' => $c->deal?->name,
                'deal_value' => $partnerOnly ? null : (float) ($c->deal?->value ?? 0),
                'amount' => (float) $c->amount,
                'created_at' => $c->created_at?->toIso8601String(),
            ])->values(),
        ]);
    }

    // ── Overview ─────────────────────────────────────────────────

    private function summary(LeadAgent $agent): array
    {
        $monthStart = now()->startOfMonth();
        $prevStart = $monthStart->copy()->subMonth();
        $yearStart = now()->startOfYear();

        $earnedThisMonth = (float) $this->earned($agent)->where('created_at', '>=', $monthStart)->sum('amount');
        $earnedLastMonth = (float) $this->earned($agent)
            ->where('created_at', '>=', $prevStart)
            ->where('created_at', '<', $monthStart)
            ->sum('amount');

        $pending = $this->earned($agent)->where('status', MlmCommissionStatus::Pending->value);

        // A paid line counts in the year it was paid; one with no paid date falls back to when it was created.
        $paid = $this->earned($agent)
            ->where('status', MlmCommissionStatus::Paid->value)
            ->whereRaw('COALESCE(paid_at, created_at) >= ?', [$yearStart]);
        $lastPayout = $this->earned($agent)
            ->where('status', MlmCommissionStatus::Paid->value)
            ->selectRaw('MAX(COALESCE(paid_at, created_at)) as last_paid')
            ->value('last_paid');

        return [
            'earned_month' => $earnedThisMonth,
            'earned_prev_month' => $earnedLastMonth,
            'prev_month' => $prevStart->toDateString(),
            'pending_amount' => (float) (clone $pending)->sum('amount'),
            'pending_count' => (clone $pending)->count(),
            'paid_year' => (float) (clone $paid)->sum('amount'),
            'paid_count' => (clone $paid)->count(),
            'last_payout' => $lastPayout ? Carbon::parse($lastPayout)->toDateString() : null,
        ];
    }

    private function latest(LeadAgent $agent): array
    {
        $commissions = MlmCommission::query()
            ->where('agent_id', $agent->id)
            ->where('type', '!=', MlmCommissionType::System->value)
            ->with(EarningsPresenter::commissionRelations())
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(self::LATEST_LIMIT)
            ->get();

        return $this->presentCommissions($commissions);
    }

    /** The level, the cycle and how far the next level's criteria are met: the numbers the classic dashboard shows. */
    private function levelCard(LeadAgent $agent): array
    {
        $levels = app(LevelService::class);
        $current = $levels->getCurrentLevel($agent);
        $enrollment = app(CycleService::class)->getActiveEnrollment($agent);
        $cycle = $enrollment?->cycle;
        $metrics = $enrollment?->metrics ?? AgentMetric::query()->where('agent_id', $agent->id)->first();

        // A hidden level is never named to an agent, and nothing is measured against the next one.
        $hidden = (bool) $current?->is_hidden;
        $next = $hidden ? null : $levels->getNextVisibleLevel($agent->company_id, $current?->rank ?? -1);

        $criteria = [];
        if ($next && $metrics) {
            foreach ($next->criteria as $criterion) {
                $value = $criterion->metric->resolveValue($metrics);
                $target = (float) $criterion->threshold;
                $criteria[] = [
                    'metric' => $criterion->metric->value,
                    'operator' => $criterion->operator,
                    'current' => $value,
                    'target' => $target,
                    'met' => $criterion->evaluate($metrics),
                    'percent' => $target > 0 ? round(min(100, ($value / $target) * 100), 1) : 0,
                ];
            }
        }

        return [
            'level' => $hidden ? null : $current?->name,
            'next_level' => $next?->name,
            'criteria' => $criteria,
            'cycle' => $cycle ? [
                'name' => $cycle->name,
                'number' => $cycle->cycle_number,
                'end_date' => $cycle->end_date?->toDateString(),
            ] : null,
            'enrollment' => $enrollment ? [
                'status' => $enrollment->status->value,
                'days_remaining' => $enrollment->daysRemaining(),
            ] : null,
        ];
    }

    // ── Ledger ───────────────────────────────────────────────────

    private function ledgerLines(LeadAgent $agent): array
    {
        $commissions = MlmCommission::query()
            ->where('agent_id', $agent->id)
            ->where('type', '!=', MlmCommissionType::System->value)
            ->where('created_at', '>=', now()->startOfYear())
            ->with(EarningsPresenter::commissionRelations())
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(self::LEDGER_LIMIT + 1)
            ->get();

        $truncated = $commissions->count() > self::LEDGER_LIMIT;

        return [
            'items' => $this->presentCommissions($commissions->take(self::LEDGER_LIMIT)),
            'truncated' => $truncated,
        ];
    }

    /** @param  Collection<int, MlmCommission>  $commissions */
    private function presentCommissions(Collection $commissions): array
    {
        $disputes = EarningsPresenter::latestDisputes($commissions);
        $partnerOnly = PartnerRole::isPartnerOnly(user());

        return $commissions
            ->map(fn (MlmCommission $c) => EarningsPresenter::commission($c, $disputes, $partnerOnly))
            ->values()
            ->all();
    }

    // ── Network ──────────────────────────────────────────────────

    /**
     * The direct upline (if any), the agent, then every agent below in the order the tree reads, with the
     * numbers the classic network shows for each.
     */
    private function networkRows(LeadAgent $agent): array
    {
        $with = ['user:id,name', 'currentLevelHistory.level', 'metrics'];
        $upline = $agent->parent_agent_id ? LeadAgent::query()->with($with)->find($agent->parent_agent_id) : null;

        // Generation by generation, so one query serves each level of the tree.
        $byParent = [];
        $ids = [$agent->id];
        $count = 0;
        $truncated = false;
        for ($depth = 1; $depth <= self::NETWORK_DEPTH && $ids && ! $truncated; $depth++) {
            $children = LeadAgent::query()->with($with)->whereIn('parent_agent_id', $ids)->orderBy('created_at')->orderBy('id')->get();
            $ids = [];
            foreach ($children as $child) {
                if ($count >= self::NETWORK_LIMIT) {
                    $truncated = true;
                    break;
                }
                $byParent[$child->parent_agent_id][] = $child;
                $ids[] = $child->id;
                $count++;
            }
        }

        $everyone = collect($byParent)->flatten(1)->push($agent);
        if ($upline) {
            $everyone->push($upline);
        }
        $direct = LeadAgent::query()
            ->whereIn('parent_agent_id', $everyone->pluck('id'))
            ->selectRaw('parent_agent_id, COUNT(*) as total')
            ->groupBy('parent_agent_id')
            ->pluck('total', 'parent_agent_id');

        $rows = [];
        if ($upline) {
            $rows[] = $this->networkRow($upline, 'upline', 0, $direct);
        }
        $rows[] = $this->networkRow($agent, 'self', $upline ? 1 : 0, $direct);
        $walk = function (LeadAgent $parent, int $depth, int $generation) use (&$walk, &$rows, $byParent, $direct) {
            foreach ($byParent[$parent->id] ?? [] as $child) {
                $rows[] = $this->networkRow($child, 'downline', $depth, $direct, $generation);
                $walk($child, $depth + 1, $generation + 1);
            }
        };
        $walk($agent, ($upline ? 1 : 0) + 1, 1);

        return ['rows' => $rows, 'truncated' => $truncated];
    }

    private function networkRow(LeadAgent $agent, string $kind, int $depth, Collection $direct, int $generation = 0): array
    {
        $metrics = $agent->metrics;

        return [
            'id' => $agent->id,
            'name' => $agent->user?->name,
            'kind' => $kind,
            'depth' => $depth,
            // 1 for someone the agent brought in directly, 2 for their recruits, and so on; 0 for the agent and the upline.
            'generation' => $generation,
            'level' => $this->visibleLevelName($agent->currentLevelHistory?->level),
            'direct' => (int) ($direct[$agent->id] ?? 0),
            'nsa' => (int) ($metrics?->nsa ?? 0),
            'nsd' => (int) ($metrics?->nsd ?? 0),
            'joined_at' => $agent->created_at?->toDateString(),
        ];
    }

    /** A hidden level is never named to an agent. */
    private function visibleLevelName(?MlmLevel $level): ?string
    {
        return $level && ! $level->is_hidden ? $level->name : null;
    }
}
