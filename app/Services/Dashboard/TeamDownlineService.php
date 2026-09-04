<?php

namespace App\Services\Dashboard;

use App\Enums\MlmCommissionStatus;
use App\Enums\MlmCommissionType;
use App\Models\Deal;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Services\HierarchyService;
use App\Services\LevelService;
use App\Services\MlmCommissionService;
use Illuminate\Support\Facades\DB;

/**
 * The team dashboard's downline rollup.
 *
 * The manager view answers "how is my team doing" over one flat level of
 * direct reports. This answers the question a manager with sub-agents actually
 * has: what does my *whole* downline look like, generation by generation, and
 * what has it earned.
 *
 * Nothing here recalculates commission. Paid and pending come from
 * mlm_commissions rows as written by MlmCommissionService; forecast comes from
 * that same service's preview() over open deals. The legacy flat `commissions`
 * table (employee_id-keyed, no company scope) is deliberately not read — it has
 * no writer and no reader anywhere in the app, and a dual-read would make two
 * disagreeing numbers possible. MlmCommission is the only source of truth.
 *
 * Money is always in the company's own currency: MlmCommissionService converts
 * a deal's value through its snapshotted exchange rate before writing a leg, so
 * unlike deal value there is no per-currency split to carry.
 */
class TeamDownlineService
{
    /**
     * Open deals the forecast will price, most recently touched first.
     *
     * preview() resolves levels, cycle snapshots and the full ancestor chain
     * per deal — a handful of queries each — so a large downline would turn one
     * panel into thousands of round trips. Past this many the panel says so
     * (`forecast_truncated`) rather than quietly reporting a partial number as
     * the whole picture.
     */
    private const FORECAST_MAX_DEALS = 150;

    /** System legs are the house's retained cut, never an agent's to see. */
    private const EARNABLE_TYPES = [
        MlmCommissionType::Agent->value,
        MlmCommissionType::Upline->value,
    ];

    public function __construct(
        private HierarchyService $hierarchy,
        private LevelService $levels,
        private MlmCommissionService $commissions,
    ) {}

    /**
     * The manager's own agent record — the root of the tree this view shows.
     *
     * Null for an account with no lead_agent row, which is most employees. The
     * caller renders an empty state rather than widening the scope: this view
     * sits on financial data, so "no root" must never fall back to "everyone".
     */
    public function rootAgent(int $userId): ?LeadAgent
    {
        // Memoised: the panels in one deferred group each ask for the root
        // before they can do anything, and it is the same row every time.
        return $this->once(
            'root:'.$userId,
            fn () => LeadAgent::where('user_id', $userId)->first()
        );
    }

    /**
     * The full tree as [agent id => depth], the root itself at depth 0.
     *
     * @return array<int, int>
     */
    public function downlineDepths(LeadAgent $root): array
    {
        return [(int) $root->id => 0] + $this->hierarchy->getSubtreeDepths($root);
    }

    /**
     * Headline figures for the tile row: how big the tree is and what it has
     * earned. Cheap enough to land before the tables.
     *
     * `paid` is windowed on paid_at — it answers "what did this downline earn
     * in this period". `pending` deliberately is not: an unpaid commission is a
     * standing balance, and a manager asking what is owed to their team does
     * not mean "owed since a date I picked from a dropdown".
     */
    public function summary(LeadAgent $root, int $days): array
    {
        $depths = $this->downlineDepths($root);
        $agentIds = array_keys($depths);
        $totals = $this->commissionTotals($agentIds, $days);

        $paid = 0.0;
        $pending = 0.0;

        foreach ($totals as $row) {
            $paid += $row['paid'];
            $pending += $row['pending'];
        }

        $rootLevel = $this->levels->getCurrentLevel($root);

        return [
            // The root is not part of their own downline.
            'agents' => count($depths) - 1,
            'direct_reports' => count(array_filter($depths, fn ($depth) => $depth === 1)),
            'generations' => $depths ? max($depths) : 0,
            'root' => [
                'agent_id' => (int) $root->id,
                'name' => $root->user?->name,
                'level' => $rootLevel?->name,
            ],
            'deals_won' => array_sum(array_column($this->dealTotals($agentIds, $days), 'won')),
            'paid' => round($paid, 2),
            'pending' => round($pending, 2),
            'currency' => $this->currencyCode(),
            'days' => $days,
        ];
    }

    /**
     * One row per generation: depth 1 is the direct reports, 2 their reports.
     *
     * Rolled up by the agent who *receives* each leg, not the agent whose deal
     * produced it. That is what makes the depths add up to the tree total
     * without double counting — an upline leg belongs to the ancestor it pays,
     * and appears at that ancestor's depth once.
     *
     * @return array<int, array<string, mixed>>
     */
    public function levelRollup(LeadAgent $root, int $days): array
    {
        $depths = $this->downlineDepths($root);
        $agentIds = array_keys($depths);

        $commissions = $this->commissionTotals($agentIds, $days);
        $deals = $this->dealTotals($agentIds, $days);
        $forecast = $this->forecast($agentIds);

        $rows = [];

        foreach ($depths as $agentId => $depth) {
            $row = $rows[$depth] ?? [
                'depth' => $depth,
                'agents' => 0,
                'deals_won' => 0,
                'deals_open' => 0,
                'paid' => 0.0,
                'pending' => 0.0,
                'forecast' => 0.0,
            ];

            $row['agents']++;
            $row['deals_won'] += $deals[$agentId]['won'] ?? 0;
            $row['deals_open'] += $deals[$agentId]['open'] ?? 0;
            $row['paid'] += $commissions[$agentId]['paid'] ?? 0.0;
            $row['pending'] += $commissions[$agentId]['pending'] ?? 0.0;
            $row['forecast'] += $forecast['byAgent'][$agentId] ?? 0.0;

            $rows[$depth] = $row;
        }

        ksort($rows);

        return [
            'rows' => array_map(
                fn (array $row) => [
                    ...$row,
                    'paid' => round($row['paid'], 2),
                    'pending' => round($row['pending'], 2),
                    'forecast' => round($row['forecast'], 2),
                ],
                array_values($rows)
            ),
            'currency' => $this->currencyCode(),
            'forecast_truncated' => $forecast['truncated'],
            'forecast_deals' => $forecast['deal_count'],
            'days' => $days,
        ];
    }

    /**
     * One row per agent in the tree, the root included and marked at depth 0.
     *
     * Ordered by depth then name rather than by earnings — see the sort below.
     *
     * @return array<string, mixed>
     */
    public function agentRollup(LeadAgent $root, int $days): array
    {
        $depths = $this->downlineDepths($root);
        $agentIds = array_keys($depths);

        // The level accessor reads currentLevelHistory, the same relation
        // LevelService::getCurrentLevel() resolves — eager-loaded here rather
        // than called per agent, which would be one query per row.
        $agents = LeadAgent::with(['user:id,name,image', 'currentLevelHistory.level'])
            ->whereIn('id', $agentIds)
            ->get()
            ->keyBy('id');

        $commissions = $this->commissionTotals($agentIds, $days);
        $deals = $this->dealTotals($agentIds, $days);
        $forecast = $this->forecast($agentIds);
        $childCounts = $this->directReportCounts($agentIds);

        $rows = collect($depths)
            ->map(function (int $depth, int $agentId) use ($agents, $commissions, $deals, $forecast, $childCounts) {
                $agent = $agents->get($agentId);

                return [
                    'agent_id' => $agentId,
                    'user_id' => $agent?->user_id ? (int) $agent->user_id : null,
                    // An agent row with no user attached is a data fault, not a
                    // person — named as such rather than dropped, because
                    // dropping it would silently lose their commissions from
                    // the totals above.
                    'name' => $agent?->user?->name ?? 'Unknown agent',
                    'image' => $agent?->user?->image_url,
                    'depth' => $depth,
                    'parent_agent_id' => $agent?->parent_agent_id ? (int) $agent->parent_agent_id : null,
                    'level' => $agent?->current_level?->name,
                    'direct_reports' => $childCounts[$agentId] ?? 0,
                    'deals_won' => $deals[$agentId]['won'] ?? 0,
                    'deals_open' => $deals[$agentId]['open'] ?? 0,
                    'paid' => round($commissions[$agentId]['paid'] ?? 0.0, 2),
                    'pending' => round($commissions[$agentId]['pending'] ?? 0.0, 2),
                    'forecast' => round($forecast['byAgent'][$agentId] ?? 0.0, 2),
                ];
            })
            // Depth first, then name: this is a map of a hierarchy, so who
            // sits under whom has to be readable before the numbers are.
            ->sortBy(fn (array $row) => [$row['depth'], mb_strtolower($row['name'])])
            ->values()
            ->all();

        return [
            'rows' => $rows,
            'currency' => $this->currencyCode(),
            'forecast_truncated' => $forecast['truncated'],
            'forecast_deals' => $forecast['deal_count'],
            'days' => $days,
        ];
    }

    // ── Internals ────────────────────────────────────────────────

    /**
     * Per-instance memo for the resolvers on this class.
     *
     * Deferred props in the same group are resolved inside one request, so the
     * level and agent panels both ask for the same root, tree and rollups — and
     * forecast() runs the commission engine over every open deal in the tree.
     * Without this, landing them together would pay for it twice.
     *
     * A null result is not memoised (`??=`), which only costs a repeat of the
     * one cheap lookup that can return null.
     *
     * @var array<string, mixed>
     */
    private array $memo = [];

    /** @param  callable(): mixed  $resolve */
    private function once(string $key, callable $resolve)
    {
        return $this->memo[$key] ??= $resolve();
    }

    /**
     * Paid and pending commission per agent, in one query for the whole tree.
     *
     * Reverted legs are excluded by both branches: a clawed-back commission is
     * neither owed nor earned, and counting it as either would overstate the
     * downline.
     *
     * @param  array<int, int>  $agentIds
     * @return array<int, array{paid: float, pending: float}>
     */
    private function commissionTotals(array $agentIds, int $days): array
    {
        if (empty($agentIds)) {
            return [];
        }

        return $this->once('commissions:'.$days.':'.md5(implode(',', $agentIds)), function () use ($agentIds, $days) {
            $since = now()->subDays($days)->startOfDay();

            return MlmCommission::query()
                ->whereIn('agent_id', $agentIds)
                ->whereIn('type', self::EARNABLE_TYPES)
                ->groupBy('agent_id')
                ->toBase()
                ->selectRaw('agent_id')
                ->selectRaw(
                    'SUM(CASE WHEN status = ? AND paid_at >= ? THEN amount ELSE 0 END) as paid',
                    [MlmCommissionStatus::Paid->value, $since]
                )
                ->selectRaw(
                    'SUM(CASE WHEN status = ? THEN amount ELSE 0 END) as pending',
                    [MlmCommissionStatus::Pending->value]
                )
                ->get()
                ->mapWithKeys(fn ($row) => [
                    (int) $row->agent_id => [
                        'paid' => (float) $row->paid,
                        'pending' => (float) $row->pending,
                    ],
                ])
                ->all();
        });
    }

    /**
     * Deals won inside the window and deals still open, per agent.
     *
     * won_at is the truthful timestamp but is not backfilled on every historic
     * row, so updated_at stands in where it is missing — the same COALESCE
     * DashboardMetricsService::teamAgents() already uses, so the two screens
     * cannot disagree about what "won this month" means.
     *
     * @param  array<int, int>  $agentIds
     * @return array<int, array{won: int, open: int}>
     */
    private function dealTotals(array $agentIds, int $days): array
    {
        if (empty($agentIds)) {
            return [];
        }

        return $this->once('deals:'.$days.':'.md5(implode(',', $agentIds)), function () use ($agentIds, $days) {
            $since = now()->subDays($days)->startOfDay();

            return Deal::query()
                ->whereIn('agent_id', $agentIds)
                ->groupBy('agent_id')
                ->toBase()
                ->selectRaw('agent_id')
                ->selectRaw('SUM(outcome_status IS NULL) as open_deals')
                ->selectRaw(
                    "SUM(outcome_status = 'won' AND COALESCE(won_at, updated_at) >= ?) as won_deals",
                    [$since]
                )
                ->get()
                ->mapWithKeys(fn ($row) => [
                    (int) $row->agent_id => [
                        'won' => (int) $row->won_deals,
                        'open' => (int) $row->open_deals,
                    ],
                ])
                ->all();
        });
    }

    /**
     * What the tree's open deals would pay each of its members, per
     * MlmCommissionService::preview().
     *
     * Legs are attributed to the agent that would *receive* them and then
     * filtered to the tree, which is the whole point of a downline forecast: a
     * manager's own upline differential on a sub-agent's deal is theirs, and
     * shows up on their row, not the seller's.
     *
     * @param  array<int, int>  $agentIds
     * @return array{byAgent: array<int, float>, deal_count: int, truncated: bool}
     */
    private function forecast(array $agentIds): array
    {
        if (empty($agentIds)) {
            return ['byAgent' => [], 'deal_count' => 0, 'truncated' => false];
        }

        return $this->once('forecast:'.md5(implode(',', $agentIds)), fn () => $this->resolveForecast($agentIds));
    }

    /**
     * @param  array<int, int>  $agentIds
     * @return array{byAgent: array<int, float>, deal_count: int, truncated: bool}
     */
    private function resolveForecast(array $agentIds): array
    {
        $openDeals = Deal::query()
            ->whereIn('agent_id', $agentIds)
            ->whereNull('outcome_status')
            ->count();

        $deals = Deal::query()
            ->whereIn('agent_id', $agentIds)
            ->whereNull('outcome_status')
            ->orderByDesc('updated_at')
            ->limit(self::FORECAST_MAX_DEALS)
            ->get();

        $inTree = array_flip($agentIds);
        $byAgent = [];

        foreach ($deals as $deal) {
            foreach ($this->commissions->preview($deal) as $leg) {
                $agentId = (int) ($leg['agent_id'] ?? 0);

                if (! isset($inTree[$agentId]) || ! in_array($leg['type'] ?? null, self::EARNABLE_TYPES, true)) {
                    continue;
                }

                $byAgent[$agentId] = ($byAgent[$agentId] ?? 0.0) + (float) $leg['amount'];
            }
        }

        return [
            'byAgent' => $byAgent,
            'deal_count' => min($openDeals, self::FORECAST_MAX_DEALS),
            'truncated' => $openDeals > self::FORECAST_MAX_DEALS,
        ];
    }

    /**
     * How many agents report directly to each member of the tree.
     *
     * Counted across all agents rather than only those in the tree so the
     * bottom generation still reports its own reports — the walk stops at
     * MAX_SUBTREE_DEPTH, and a leaf row reading "0 reports" when it has three
     * would be a lie rather than a truncation.
     *
     * @param  array<int, int>  $agentIds
     * @return array<int, int>
     */
    private function directReportCounts(array $agentIds): array
    {
        if (empty($agentIds)) {
            return [];
        }

        return LeadAgent::query()
            ->whereIn('parent_agent_id', $agentIds)
            ->groupBy('parent_agent_id')
            ->toBase()
            ->get(['parent_agent_id', DB::raw('COUNT(*) as total')])
            ->mapWithKeys(fn ($row) => [(int) $row->parent_agent_id => (int) $row->total])
            ->all();
    }

    /** Memoised: company() is session-cached but the relation is not. */
    private ?string $currency = null;

    private bool $currencyResolved = false;

    private function currencyCode(): ?string
    {
        if (! $this->currencyResolved) {
            $this->currencyResolved = true;
            $this->currency = company()?->currency?->currency_code;
        }

        return $this->currency;
    }
}
