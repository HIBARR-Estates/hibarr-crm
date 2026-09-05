<?php

namespace App\Services\Dashboard;

use App\Enums\MlmCommissionStatus;
use App\Enums\MlmCommissionType;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadLifecycleStatus;
use App\Models\MlmCommission;
use App\Services\HierarchyService;
use App\Services\LevelService;
use App\Support\DashboardDateRange;
use Illuminate\Support\Facades\DB;

/**
 * The team dashboard: everything your network is doing, and nothing you are.
 *
 * "Team" here means every agent below you in the hierarchy, at any depth —
 * your direct reports, their reports, and so on. You are deliberately not in
 * any figure on this page. A manager reading it is asking how their people are
 * performing, and folding their own deals into the total is the fastest way to
 * make that number unreadable: a strong manager's personal book can hide an
 * idle team completely.
 *
 * Nothing here recalculates commission. Paid and pending come from
 * mlm_commissions rows as MlmCommissionService wrote them. The legacy flat
 * `commissions` table (employee_id-keyed, no company scope) is deliberately
 * not read — it has no writer and no reader anywhere in the app, and a
 * dual-read would make two disagreeing numbers possible.
 *
 * Money is always in the company's own currency: MlmCommissionService converts
 * a deal's value through its snapshotted exchange rate before writing a leg, so
 * unlike deal value there is no per-currency split to carry.
 */
class TeamDownlineService
{
    /** System legs are the house's retained cut, never an agent's to see. */
    private const EARNABLE_TYPES = [
        MlmCommissionType::Agent->value,
        MlmCommissionType::Upline->value,
    ];

    /**
     * Lifecycle statuses that mean a lead is finished, by key.
     *
     * Everything else counts as in play, including keys a company added
     * itself: treating an unrecognised status as open under-claims progress
     * rather than inventing it, which is the safer direction to be wrong in.
     */
    private const CLOSED_LEAD_KEYS = ['converted', 'lost', 'not_fit'];

    public function __construct(
        private HierarchyService $hierarchy,
        private LevelService $levels,
    ) {}

    /**
     * The viewer's own agent record — the anchor the team hangs off.
     *
     * Null for an account with no lead_agent row, which is most employees. The
     * caller renders an empty state rather than widening the scope: this view
     * sits on financial data, so "no root" must never fall back to "everyone".
     */
    public function rootAgent(int $userId): ?LeadAgent
    {
        return $this->once(
            'root:'.$userId,
            fn () => LeadAgent::where('user_id', $userId)->first()
        );
    }

    /**
     * The team as [agent id => depth], depth 1 being a direct report.
     *
     * The root is absent by construction — it is not part of its own team.
     *
     * @return array<int, int>
     */
    public function teamDepths(LeadAgent $root): array
    {
        return $this->once(
            'depths:'.$root->id,
            fn () => $this->hierarchy->getSubtreeDepths($root)
        );
    }

    /**
     * The headline row: how big the team is, what it is working, what it earns.
     *
     * `paid` is windowed on paid_at — what the team was actually paid in this
     * period. `pending` is not: an unpaid commission is a standing balance, and
     * a manager asking what their team is owed does not mean "owed since a date
     * I picked from a dropdown". Both say so on the tile.
     */
    public function summary(LeadAgent $root, DashboardDateRange $range): array
    {
        $depths = $this->teamDepths($root);
        $agentIds = array_keys($depths);

        $commissions = $this->commissionTotals($agentIds, $range);
        $deals = $this->dealTotals($agentIds, $range);
        $leads = $this->leadTotals($agentIds);

        return [
            'agents' => count($depths),
            'direct_reports' => count(array_filter($depths, fn ($d) => $d === 1)),
            'generations' => $depths ? max($depths) : 0,
            // Network growth, as a number: agents who joined the team inside
            // the window. The growth panel plots the same thing over time.
            'joined' => $this->joinedInRange($agentIds, $range),
            'active_deals' => $this->sumOf($deals, 'open'),
            'deals_won' => $this->sumOf($deals, 'won'),
            'leads_active' => $this->sumOf($leads, 'active'),
            'leads_untouched' => $this->sumOf($leads, 'untouched'),
            'paid' => round($this->sumOf($commissions, 'paid'), 2),
            'pending' => round($this->sumOf($commissions, 'pending'), 2),
            'currency' => $this->currencyCode(),
            'range' => $range->toArray(),
        ];
    }

    /**
     * How the network grew, month by month.
     *
     * Two series rather than one: joins per month is the recruiting signal, and
     * the running total is the size that produces everything else on the page.
     * A month with no joins is emitted as a zero rather than skipped, so a
     * stall reads as a flat line instead of a gap the eye closes over.
     *
     * Counted from lead_agents.created_at — when the agent record was made,
     * which is the only join date this schema records.
     */
    public function growth(LeadAgent $root, DashboardDateRange $range): array
    {
        $agentIds = array_keys($this->teamDepths($root));

        if (empty($agentIds)) {
            return ['points' => [], 'joined' => 0, 'before' => 0];
        }

        $byMonth = LeadAgent::query()
            ->whereIn('id', $agentIds)
            ->whereBetween('created_at', [$range->from, $range->to])
            ->groupBy('period')
            ->toBase()
            ->get([
                DB::raw("DATE_FORMAT(created_at, '%Y-%m') as period"),
                DB::raw('COUNT(*) as total'),
            ])
            ->keyBy('period');

        // The team already had this many members when the window opened —
        // without it the running total starts at zero and reads as a team
        // built from nothing inside the period.
        $before = LeadAgent::query()
            ->whereIn('id', $agentIds)
            ->where('created_at', '<', $range->from)
            ->count();

        $points = [];
        $running = $before;
        $cursor = $range->from->copy()->startOfMonth();
        $last = $range->to->copy()->startOfMonth();

        while ($cursor->lessThanOrEqualTo($last)) {
            $key = $cursor->format('Y-m');
            $joined = (int) ($byMonth->get($key)->total ?? 0);
            $running += $joined;

            $points[] = [
                'period' => $key,
                'label' => $cursor->format('M Y'),
                'joined' => $joined,
                'total' => $running,
            ];

            $cursor->addMonth();
        }

        return [
            'points' => $points,
            'joined' => $running - $before,
            'before' => $before,
        ];
    }

    /**
     * The team as a tree, each node carrying its own numbers and its network's.
     *
     * Both halves matter and they answer different questions. "Own" is what
     * this person did. "Network" is what everything under them did, themselves
     * included — which is how you tell a strong closer from someone who has
     * built a team that closes without them.
     *
     * @return array<string, mixed>
     */
    public function tree(LeadAgent $root, DashboardDateRange $range): array
    {
        $depths = $this->teamDepths($root);
        $agentIds = array_keys($depths);

        if (empty($agentIds)) {
            return ['nodes' => [], 'currency' => $this->currencyCode(), 'range' => $range->toArray()];
        }

        $agents = LeadAgent::with(['user:id,name,image', 'currentLevelHistory.level'])
            ->whereIn('id', $agentIds)
            ->get()
            ->keyBy('id');

        $commissions = $this->commissionTotals($agentIds, $range);
        $deals = $this->dealTotals($agentIds, $range);
        $leads = $this->leadTotals($agentIds);

        // Children keyed by parent. An agent whose parent is outside the team —
        // possible when the walk stopped at MAX_SUBTREE_DEPTH — is attached to
        // the root instead of being dropped: a missing person is worse than a
        // person shown one level too high.
        $childrenOf = [];

        foreach ($agentIds as $id) {
            $parent = (int) ($agents->get($id)?->parent_agent_id ?? 0);
            $key = isset($depths[$parent]) || $parent === (int) $root->id ? $parent : (int) $root->id;
            $childrenOf[$key][] = $id;
        }

        $build = function (int $id) use (
            &$build, $agents, $depths, $childrenOf, $commissions, $deals, $leads
        ): array {
            $agent = $agents->get($id);

            $own = [
                'active_deals' => $deals[$id]['open'] ?? 0,
                'deals_won' => $deals[$id]['won'] ?? 0,
                'leads_active' => $leads[$id]['active'] ?? 0,
                'leads_untouched' => $leads[$id]['untouched'] ?? 0,
                'paid' => round($commissions[$id]['paid'] ?? 0.0, 2),
                'pending' => round($commissions[$id]['pending'] ?? 0.0, 2),
            ];

            $children = array_map($build, $childrenOf[$id] ?? []);

            // Network includes this person: "their network" is the branch they
            // head, and excluding its head would make the branch totals fail to
            // add up against the tile row.
            $network = array_merge(['agents' => 1], $own);

            foreach ($children as $child) {
                foreach ($child['network'] as $key => $value) {
                    $network[$key] += $value;
                }
            }

            return [
                'agent_id' => $id,
                'user_id' => $agent?->user_id ? (int) $agent->user_id : null,
                // An agent row with no user attached is a data fault, not a
                // person — named as such rather than dropped, because dropping
                // it would silently lose their numbers from the totals above.
                'name' => $agent?->user?->name ?? 'Unknown agent',
                'image' => $agent?->user?->image_url,
                'level' => $agent?->current_level?->name,
                'depth' => $depths[$id] ?? 1,
                'own' => $own,
                'network' => array_map(
                    fn ($value) => is_float($value) ? round($value, 2) : $value,
                    $network
                ),
                'children' => $children,
            ];
        };

        return [
            'nodes' => array_map($build, $childrenOf[(int) $root->id] ?? []),
            'currency' => $this->currencyCode(),
            'range' => $range->toArray(),
            // The viewer's own level still belongs on the page: it sets the
            // differential they earn on everything below.
            'your_level' => $this->levels->getCurrentLevel($root)?->name,
        ];
    }

    // ── Internals ────────────────────────────────────────────────

    /**
     * Per-instance memo for the resolvers on this class.
     *
     * Deferred props in the same group are resolved inside one request, so the
     * tile row and the tree both ask for the same team and the same rollups.
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
     * @param  array<int, array<string, int|float>>  $rows
     */
    private function sumOf(array $rows, string $key): float
    {
        return array_sum(array_column($rows, $key));
    }

    /** How many of these agents joined inside the window. */
    private function joinedInRange(array $agentIds, DashboardDateRange $range): int
    {
        if (empty($agentIds)) {
            return 0;
        }

        return LeadAgent::query()
            ->whereIn('id', $agentIds)
            ->whereBetween('created_at', [$range->from, $range->to])
            ->count();
    }

    /**
     * Paid and pending commission per agent, in one query for the whole team.
     *
     * Reverted legs are excluded from both: a clawed-back commission is neither
     * owed nor earned, and counting it as either would overstate the team.
     *
     * @return array<int, array{paid: float, pending: float}>
     */
    private function commissionTotals(array $agentIds, DashboardDateRange $range): array
    {
        if (empty($agentIds)) {
            return [];
        }

        return $this->once('commissions:'.$this->key($agentIds, $range), function () use ($agentIds, $range) {
            return MlmCommission::query()
                ->whereIn('agent_id', $agentIds)
                ->whereIn('type', self::EARNABLE_TYPES)
                ->groupBy('agent_id')
                ->toBase()
                ->selectRaw('agent_id')
                ->selectRaw(
                    'SUM(CASE WHEN status = ? AND paid_at BETWEEN ? AND ? THEN amount ELSE 0 END) as paid',
                    [MlmCommissionStatus::Paid->value, $range->from, $range->to]
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
     * Open deals and deals won inside the window, per agent.
     *
     * "Active" is deliberately not windowed: a deal opened last year and still
     * running is active today, and a manager asking what their team is working
     * on right now does not mean "started inside my date filter".
     *
     * won_at is the truthful timestamp but is not backfilled on every historic
     * row, so updated_at stands in where it is missing — the same COALESCE
     * DashboardMetricsService::teamAgents() already uses, so the two screens
     * cannot disagree about what "won this month" means.
     *
     * @return array<int, array{open: int, won: int}>
     */
    private function dealTotals(array $agentIds, DashboardDateRange $range): array
    {
        if (empty($agentIds)) {
            return [];
        }

        return $this->once('deals:'.$this->key($agentIds, $range), function () use ($agentIds, $range) {
            return Deal::query()
                ->whereIn('agent_id', $agentIds)
                ->groupBy('agent_id')
                ->toBase()
                ->selectRaw('agent_id')
                ->selectRaw('SUM(outcome_status IS NULL) as open_deals')
                ->selectRaw(
                    "SUM(outcome_status = 'won' AND COALESCE(won_at, updated_at) BETWEEN ? AND ?) as won_deals",
                    [$range->from, $range->to]
                )
                ->get()
                ->mapWithKeys(fn ($row) => [
                    (int) $row->agent_id => [
                        'open' => (int) $row->open_deals,
                        'won' => (int) $row->won_deals,
                    ],
                ])
                ->all();
        });
    }

    /**
     * Leads the team is working, per agent.
     *
     * `active` is what the request calls "currently being interacted with":
     * contact has started and the lead has not reached a terminal lifecycle
     * status. `untouched` is the same open set with no first contact logged —
     * shipped alongside because a team with a hundred live leads and eighty
     * untouched ones is not the same team as one with twenty of each, and a
     * single "leads" number cannot tell those apart.
     *
     * Neither is windowed, for the same reason active deals aren't: a lead
     * sitting untouched since before the window is still untouched now.
     *
     * Ownership is leads.lead_owner (a user id), matching how the manager view
     * already counts a team's leads — reading a different column here would
     * make the two screens disagree about whose lead it is.
     *
     * @return array<int, array{active: int, untouched: int}>
     */
    private function leadTotals(array $agentIds): array
    {
        if (empty($agentIds)) {
            return [];
        }

        return $this->once('leads:'.$this->key($agentIds), function () use ($agentIds) {
            $ownerToAgent = LeadAgent::query()
                ->whereIn('id', $agentIds)
                ->whereNotNull('user_id')
                ->pluck('id', 'user_id')
                ->all();

            if (empty($ownerToAgent)) {
                return [];
            }

            // Through the model so the company scope applies: statuses are
            // seeded per company, and the same key exists once per tenant.
            $closed = LeadLifecycleStatus::whereIn('key', self::CLOSED_LEAD_KEYS)
                ->pluck('id')
                ->all();

            $rows = Lead::query()
                ->whereIn('lead_owner', array_keys($ownerToAgent))
                ->when(
                    ! empty($closed),
                    fn ($query) => $query->where(
                        fn ($q) => $q->whereNull('lead_lifecycle_status_id')
                            ->orWhereNotIn('lead_lifecycle_status_id', $closed)
                    )
                )
                ->groupBy('lead_owner')
                ->toBase()
                ->get([
                    'lead_owner',
                    DB::raw('SUM(first_contacted_at IS NOT NULL) as active'),
                    DB::raw('SUM(first_contacted_at IS NULL) as untouched'),
                ]);

            $totals = [];

            foreach ($rows as $row) {
                $agentId = $ownerToAgent[$row->lead_owner] ?? null;

                if ($agentId === null) {
                    continue;
                }

                // A user can hold more than one lead_agent row, so this adds
                // rather than assigns.
                $totals[(int) $agentId] = [
                    'active' => ($totals[(int) $agentId]['active'] ?? 0) + (int) $row->active,
                    'untouched' => ($totals[(int) $agentId]['untouched'] ?? 0) + (int) $row->untouched,
                ];
            }

            return $totals;
        });
    }

    /** Memo key for a set of agents, optionally over a window. */
    private function key(array $agentIds, ?DashboardDateRange $range = null): string
    {
        $window = $range ? $range->from->toDateString().':'.$range->to->toDateString() : 'all';

        return $window.':'.md5(implode(',', $agentIds));
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
