<?php

namespace App\Services;

use App\Enums\MlmCommissionStatus;
use App\Enums\MlmCommissionType;
use App\Enums\PackageCommissionType;
use App\Models\AgentPackageCommissionRate;
use App\Models\Currency;
use App\Models\Deal;
use App\Models\DeveloperProject;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Models\MlmCycleLevelSnapshot;
use App\Models\MlmLevel;
use App\Models\Package;
use App\Models\Property;
use App\Support\FeatureFlags;
use Illuminate\Support\Facades\Log;

class MlmCommissionService
{
    protected HierarchyService $hierarchyService;

    protected LevelService $levelService;

    protected CycleService $cycleService;

    protected CycleLevelSnapshotService $snapshotService;

    public function __construct(
        HierarchyService $hierarchyService,
        LevelService $levelService,
        CycleService $cycleService,
        CycleLevelSnapshotService $snapshotService,
        protected MlmNotificationService $mlmNotifications,
    ) {
        $this->hierarchyService = $hierarchyService;
        $this->levelService = $levelService;
        $this->cycleService = $cycleService;
        $this->snapshotService = $snapshotService;
    }

    /**
     * Distribute commissions for a won deal using the Differential Commission Model.
     *
     * A persist loop over preview(), deliberately: the dashboard shows partners
     * a forecast of what their open referrals would pay, and a forecast
     * computed by a parallel implementation is a forecast that drifts. This one
     * is shown to people outside the company, so it has to be the same
     * arithmetic that later writes the money.
     *
     * @return array<int, MlmCommission> the persisted records
     */
    public function distribute(Deal $deal): array
    {
        $records = [];

        foreach ($this->preview($deal) as $leg) {
            $record = MlmCommission::create($leg);
            $records[] = $record;

            if (($leg['type'] ?? null) !== MlmCommissionType::System->value) {
                $this->mlmNotifications->afterCommit(
                    fn () => $this->mlmNotifications->notifyCommissionEarned($record->fresh())
                );
            }
        }

        return $records;
    }

    /**
     * The commission legs a deal would produce, without writing any of them.
     *
     * Commission flow:
     * 1. Agent receives their level's commission %
     * 2. Each ancestor receives (their_level% - previous_cumulative%)
     * 3. Remaining up to max_commission% goes to system
     *
     * @return array<int, array<string, mixed>>
     */
    public function preview(Deal $deal): array
    {
        $agent = LeadAgent::find($deal->agent_id);

        if (! $agent) {
            Log::warning("MlmCommissionService: No agent found for deal {$deal->id}");

            return [];
        }

        // A deal sold on a configured package pays from that package's own
        // settings and nothing else: no upline legs, no system leg.
        $packageLegs = $this->packageLegs($deal, $agent);

        if ($packageLegs !== null) {
            return $packageLegs;
        }

        // Commissions are always in the company's currency: deals.value is
        // stored in the deal's OWN currency (deals.currency_id), and
        // deals.exchange_rate is the snapshotted rate to convert that into
        // company currency — the same convention Payment/Expense/Invoice
        // already use (`amount * exchange_rate`). A same-currency or
        // unmaintained-rate deal has exchange_rate = 1, so this is a no-op
        // for the common case.
        $dealValue = (float) ($deal->value ?? 0) * (float) ($deal->exchange_rate ?? 1);

        // Resolve cycle context for snapshot-aware distribution
        $enrollment = $this->cycleService->getActiveEnrollment($agent);
        $cycle = $enrollment?->cycle;
        $useSnapshots = $cycle && $cycle->hasSnapshots();

        $maxCommission = $this->getMaxCommissionPercentage($deal, $cycle);

        if ($dealValue <= 0 || $maxCommission <= 0) {
            Log::info("MlmCommissionService: Skipping deal {$deal->id} - zero value or max commission");

            return [];
        }

        // Resolve agent's commission percentage from snapshot or live level
        $agentLevel = $this->levelService->getCurrentLevel($agent);
        $agentSnapshotLevel = null;
        $agentCommissionPct = 0;

        if ($useSnapshots && $agentLevel) {
            $agentSnapshotLevel = $this->snapshotService->getSnapshotLevelBySourceId($cycle, $agentLevel->id);
            $agentCommissionPct = $this->isPerAgentOverrideEnabled()
                ? $this->resolveDirectRate($agent, $agentLevel, $agentSnapshotLevel)
                : ($agentSnapshotLevel
                    ? (float) $agentSnapshotLevel->commission_percentage
                    : (float) $agentLevel->commission_percentage);
        } elseif ($agentLevel) {
            $agentCommissionPct = $this->isPerAgentOverrideEnabled()
                ? $this->resolveDirectRate($agent, $agentLevel, null)
                : (float) $agentLevel->commission_percentage;
        }

        $records = [];
        $cumulativePct = 0;

        // 1. Agent's own commission
        if ($agentCommissionPct > 0) {
            $effectivePct = min($agentCommissionPct, $maxCommission);
            $records[] = $this->leg(
                deal: $deal,
                agent: $agent,
                sourceAgent: $agent,
                level: $agentLevel,
                percentage: $effectivePct,
                amount: $this->calculateAmount($dealValue, $effectivePct),
                type: MlmCommissionType::Agent,
                cycleLevelSnapshotId: $agentSnapshotLevel?->id
            );
            $cumulativePct = $effectivePct;
        }

        // 2. Upline commissions (differential model)
        if ($cumulativePct < $maxCommission) {
            $ancestors = $this->hierarchyService->getAncestorsWithLevels($agent);

            foreach ($ancestors as $ancestor) {
                if ($cumulativePct >= $maxCommission) {
                    break;
                }

                $ancestorLevel = $ancestor->currentLevelHistory?->level;

                if (! $ancestorLevel) {
                    continue;
                }

                // Resolve commission % from snapshot or live
                $ancestorSnapshotLevel = null;
                $ancestorPct = $this->isPerAgentOverrideEnabled()
                    ? $this->resolveOverrideRate($ancestor, $ancestorLevel, null)
                    : (float) $ancestorLevel->commission_percentage;

                if ($useSnapshots) {
                    $ancestorSnapshotLevel = $this->snapshotService->getSnapshotLevelBySourceId($cycle, $ancestorLevel->id);
                    if ($ancestorSnapshotLevel) {
                        $ancestorPct = $this->isPerAgentOverrideEnabled()
                            ? $this->resolveOverrideRate($ancestor, $ancestorLevel, $ancestorSnapshotLevel)
                            : (float) $ancestorSnapshotLevel->commission_percentage;
                    }
                }

                // Differential: only pay if their level's % is higher than cumulative
                if ($ancestorPct > $cumulativePct) {
                    $differential = $ancestorPct - $cumulativePct;
                    $effectivePct = min($differential, $maxCommission - $cumulativePct);

                    if ($effectivePct > 0) {
                        $records[] = $this->leg(
                            deal: $deal,
                            agent: $ancestor,
                            sourceAgent: $agent,
                            level: $ancestorLevel,
                            percentage: $effectivePct,
                            amount: $this->calculateAmount($dealValue, $effectivePct),
                            type: MlmCommissionType::Upline,
                            cycleLevelSnapshotId: $ancestorSnapshotLevel?->id
                        );
                        $cumulativePct += $effectivePct;
                    }
                }
            }
        }

        // 3. System commission (remaining %)
        $remainingPct = $maxCommission - $cumulativePct;

        if ($remainingPct > 0.001) {
            $records[] = $this->leg(
                deal: $deal,
                agent: $agent,
                sourceAgent: $agent,
                level: null,
                percentage: round($remainingPct, 2),
                amount: $this->calculateAmount($dealValue, $remainingPct),
                type: MlmCommissionType::System
            );
        }

        Log::info('MlmCommissionService: Resolved '.count($records)." commission legs for deal {$deal->id} (total {$cumulativePct}% of {$maxCommission}% max)".($useSnapshots ? ' [snapshot]' : ''));

        return $records;
    }

    /**
     * Revert all commissions for a deal.
     */
    public function revert(Deal $deal, string $reason): int
    {
        $count = MlmCommission::where('deal_id', $deal->id)
            ->where('status', MlmCommissionStatus::Pending->value)
            ->update([
                'status' => MlmCommissionStatus::Reverted->value,
                'reverted_at' => now(),
                'reverted_reason' => $reason,
            ]);

        Log::info("MlmCommissionService: Reverted {$count} commissions for deal {$deal->id}: {$reason}");

        return $count;
    }

    /**
     * A deal is package-priced when any attached package carries a configured
     * commission_type — see packageLegs() for what that implies about how the
     * deal pays out. Public because the value-breakdown panel needs the same
     * classification to label "revenue to company" correctly.
     */
    public function isPackageDeal(Deal $deal): bool
    {
        return $this->commissionPackages($deal)->isNotEmpty();
    }

    /**
     * The deal's packages that actually configure a commission.
     *
     * Deliberately re-queries instead of reading $deal->packages: callers
     * eager-load that relation with whatever columns they happen to need
     * (DealController::show() uses `packages:id,name,value`), and a package
     * whose commission_type was never selected reads as null — indistinguishable
     * from "no commission configured". That made an identical deal classify as
     * package-priced or not depending on which controller loaded it, so the
     * classification reads the column itself rather than trusting the caller.
     *
     * @return \Illuminate\Support\Collection<int, Package>
     */
    protected function commissionPackages(Deal $deal): \Illuminate\Support\Collection
    {
        return $deal->packages()->get()->filter(
            fn (Package $package) => $package->commission_type !== null
        );
    }

    /**
     * Commission totals for the deal value-breakdown panel.
     *
     * "Revenue to company" means different things depending on what the deal's
     * value represents:
     * - Package deal: the value IS what the client pays the company, so
     *   revenue is that value minus whatever commission left the building.
     * - Property deal: the value is the property price, most of which goes to
     *   the seller/developer rather than the company — the company's own cut
     *   there is exactly the System-type leg, the referral % nobody in the
     *   agent hierarchy claimed.
     *
     * Everything here is in COMPANY currency. Commission amounts are already
     * stored that way, while deals.value is in the deal's own currency, so the
     * deal value is converted before the subtraction — mixing the two produced
     * a revenue figure that was simply the wrong scale on any deal not already
     * in the company's currency.
     *
     * Reverted legs are excluded throughout: a reverted commission never paid
     * out and isn't part of what the deal actually cost or earned.
     *
     * Nothing is written to `mlm_commissions` until distribute() runs on a won
     * deal (see ProcessDealWonJob) — so an open deal has zero persisted legs
     * even when its package has a commission fully configured. Rather than
     * report a false "no commission" (and therefore "100% revenue"), fall
     * back to preview() — the same arithmetic distribute() will eventually
     * persist, already relied on elsewhere for pre-win forecasts (see
     * DashboardMetricsService::partnerForecast()).
     *
     * When a $viewer is given, their own share is isolated alongside the
     * totals — an agent or upline is shown what they personally earned even
     * though the deal-wide figures are not theirs to see.
     *
     * @return array{is_package_deal: bool, paid_total: float, paid_percentage: float|null, revenue_to_company: float, is_projected: bool, own_total: float|null, own_percentage: float|null}
     */
    public function getCommissionSummary(Deal $deal, ?\App\Models\User $viewer = null): array
    {
        $isPackageDeal = $this->isPackageDeal($deal);

        $persistedLegs = MlmCommission::where('deal_id', $deal->id)
            ->where('status', '!=', MlmCommissionStatus::Reverted->value)
            ->get(['type', 'amount', 'percentage', 'agent_id'])
            ->map(fn (MlmCommission $leg) => [
                'type' => $leg->type->value,
                'amount' => (float) $leg->amount,
                'percentage' => $leg->percentage !== null ? (float) $leg->percentage : null,
                'agent_id' => (int) $leg->agent_id,
            ]);

        $isProjected = $persistedLegs->isEmpty();

        $legs = $isProjected
            ? collect($this->preview($deal))->map(fn (array $leg) => [
                'type' => $leg['type'],
                'amount' => (float) $leg['amount'],
                'percentage' => isset($leg['percentage']) && $leg['percentage'] !== null
                    ? (float) $leg['percentage']
                    : null,
                'agent_id' => (int) $leg['agent_id'],
            ])
            : $persistedLegs;

        // The System leg is the share no one in the agent hierarchy claimed —
        // the company keeps it. Counting it as "commission paid" overstated
        // what a property deal cost by the company's own retained cut, and on
        // a package deal would have subtracted that cut from its own revenue.
        $systemLegs = $legs->where('type', MlmCommissionType::System->value);
        $paidLegs = $legs->reject(fn (array $leg) => $leg['type'] === MlmCommissionType::System->value);

        $systemTotal = (float) $systemLegs->sum('amount');
        $paidTotal = (float) $paidLegs->sum('amount');

        $dealValueInCompanyCurrency = (float) ($deal->value ?? 0)
            * app(DealValueResolver::class)->exchangeRate($deal);

        $revenueToCompany = $isPackageDeal
            ? max(0, $dealValueInCompanyCurrency - $paidTotal)
            : $systemTotal;

        $ownLegs = $viewer ? $this->legsEarnedBy($paidLegs, $viewer) : null;

        return [
            'is_package_deal' => $isPackageDeal,
            'paid_percentage' => $this->paidPercentage($paidLegs, $isPackageDeal),
            'paid_total' => round($paidTotal, 2),
            'revenue_to_company' => round($revenueToCompany, 2),
            'is_projected' => $isProjected,
            // Every leg that paid a person, in engine order (agent first, then
            // uplines outward). Excludes the system leg, so these always sum to
            // paid_total rather than to something the reader has to unpick.
            'legs' => $paidLegs->values()->all(),
            'own_total' => $ownLegs && $ownLegs->isNotEmpty()
                ? round((float) $ownLegs->sum('amount'), 2)
                : null,
            'own_percentage' => $ownLegs && $ownLegs->isNotEmpty()
                ? $this->paidPercentage($ownLegs, $isPackageDeal)
                : null,
        ];
    }

    /**
     * The subset of legs this user personally earned.
     *
     * Matched on the viewer's lead_agent rows rather than on the deal's agent,
     * which is what lets an upline see their own differential without any
     * separate hierarchy lookup: if the engine wrote them a leg, it is theirs.
     *
     * @param  \Illuminate\Support\Collection<int, array{agent_id: int}>  $paidLegs
     * @return \Illuminate\Support\Collection<int, array>
     */
    protected function legsEarnedBy(\Illuminate\Support\Collection $paidLegs, \App\Models\User $viewer): \Illuminate\Support\Collection
    {
        $agentIds = $this->viewerAgentIds($viewer);

        if ($agentIds === []) {
            return collect();
        }

        return $paidLegs->whereIn('agent_id', $agentIds);
    }

    /**
     * Every lead_agent row belonging to this user. A user can hold more than
     * one (they are per lead category), so all of them count as "them".
     *
     * @return array<int, int>
     */
    protected function viewerAgentIds(\App\Models\User $viewer): array
    {
        return LeadAgent::where('user_id', $viewer->id)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /**
     * Name each paying leg and flag the viewer's own.
     *
     * Shown only to viewers cleared for the deal-wide picture: it names other
     * people and what they earned. Their own leg is marked rather than
     * repeated as a separate figure — a "your commission" line above a "total
     * commission" line reads as two competing totals, when one is a part of
     * the other.
     *
     * @param  array<int, array{type: string, amount: float, percentage: float|null, agent_id: int}>  $legs
     * @return array<int, array<string, mixed>>
     */
    protected function describeLegs(array $legs, \App\Models\User $viewer): array
    {
        if ($legs === []) {
            return [];
        }

        $names = LeadAgent::with('user:id,name')
            ->whereIn('id', array_column($legs, 'agent_id'))
            ->get(['id', 'user_id'])
            ->mapWithKeys(fn (LeadAgent $agent) => [$agent->id => $agent->user?->name]);

        $mine = $this->viewerAgentIds($viewer);

        // A leg's role is its type and nothing more. Sitting at the top of the
        // hierarchy does not make an upline the company — they are still an
        // upline earning an upline's differential.
        return array_map(fn (array $leg) => [
            'agent_name' => $names->get($leg['agent_id']) ?: 'Unknown agent',
            'type' => $leg['type'],
            'percentage' => $leg['percentage'],
            'amount' => round((float) $leg['amount'], 2),
            'is_you' => in_array($leg['agent_id'], $mine, true),
        ], $legs);
    }

    /**
     * Adds the commission summary to an existing value breakdown array, cut to
     * what this particular viewer is entitled to.
     *
     * Two independent entitlements, and a viewer can hold either, both, or
     * neither:
     *
     * - `legs` / `paid` / `percentage` / `revenue_to_company` — the deal-wide
     *   picture: who earned what, the total, and the company's margin. For
     *   partner-network managers and admins only.
     * - `own` / `own_percentage` — what this viewer personally earned, shown to
     *   whoever the engine actually wrote a leg for. That is the deal's agent
     *   and every upline who took a differential, with no permission needed:
     *   an agent seeing their own commission is not privileged access.
     *
     * A viewer holding both gets the leg list with their own row flagged, and
     * `own` suppressed — otherwise their share would appear twice, once as a
     * line item and again as a total-shaped figure that does not total anything.
     *
     * `commission` is null outright when neither applies, so the figures never
     * reach the browser rather than being hidden there.
     *
     * @see \App\Support\PermissionGates::canViewFullDealCommission()
     */
    public function attachCommissionSummary(array $breakdown, Deal $deal, ?\App\Models\User $viewer): array
    {
        if (! $viewer) {
            $breakdown['commission'] = null;

            return $breakdown;
        }

        $seesEverything = \App\Support\PermissionGates::canViewFullDealCommission($viewer);
        $summary = $this->getCommissionSummary($deal, $viewer);
        $earnedOnThisDeal = $summary['own_total'] !== null;

        if (! $seesEverything && ! $earnedOnThisDeal) {
            $breakdown['commission'] = null;

            return $breakdown;
        }

        $breakdown['commission'] = [
            'legs' => $seesEverything ? $this->describeLegs($summary['legs'], $viewer) : null,
            'paid' => $seesEverything ? $summary['paid_total'] : null,
            'percentage' => $seesEverything ? $summary['paid_percentage'] : null,
            'revenue_to_company' => $seesEverything ? $summary['revenue_to_company'] : null,
            // Already flagged within the legs above for a privileged viewer;
            // repeating it there would read as a second, smaller total.
            'own' => $seesEverything ? null : $summary['own_total'],
            'own_percentage' => $seesEverything ? null : $summary['own_percentage'],
            'deal_type' => $summary['is_package_deal'] ? 'package' : 'property',
            'is_projected' => $summary['is_projected'],
        ];

        return $breakdown;
    }

    /**
     * The rate behind `paid_total`, or null when no single rate describes it.
     *
     * Level-based legs are each a percentage of the same deal value, so they
     * genuinely add up: a 4% agent plus a 2% upline differential is 6% of the
     * deal. Package legs are not comparable that way — each is a percentage of
     * its own package's value — so two of them summed would print a number
     * that is true of nothing, and a fixed fee has no rate at all. In those
     * cases the label simply carries no percentage.
     *
     * @param  \Illuminate\Support\Collection<int, array{percentage: float|null}>  $paidLegs
     */
    protected function paidPercentage(\Illuminate\Support\Collection $paidLegs, bool $isPackageDeal): ?float
    {
        if ($paidLegs->isEmpty() || $paidLegs->contains(fn (array $leg) => $leg['percentage'] === null)) {
            return null;
        }

        if ($isPackageDeal) {
            return $paidLegs->count() === 1
                ? round((float) $paidLegs->first()['percentage'], 2)
                : null;
        }

        return round((float) $paidLegs->sum('percentage'), 2);
    }

    /**
     * The legs a package-based deal produces, or null when this is not one.
     *
     * Package mode is decided by *configuration*, not by output: if any attached
     * package carries a commission_type, the package settings own the whole
     * distribution and an empty array is a legitimate answer. Deciding on
     * whether legs came out instead would mean a package deliberately set to
     * zero silently paid the full agent+upline+system split.
     *
     * @return array<int, array<string, mixed>>|null null = not a package deal, fall through
     */
    protected function packageLegs(Deal $deal, LeadAgent $agent): ?array
    {
        $packages = $this->commissionPackages($deal);

        if ($packages->isEmpty()) {
            return null;
        }

        $overrides = AgentPackageCommissionRate::query()
            ->where('agent_id', $agent->id)
            ->whereIn('package_id', $packages->pluck('id'))
            ->get()
            ->keyBy('package_id');

        $legs = [];

        foreach ($packages as $package) {
            $resolved = $this->resolvePackageCommission($package, $agent, $overrides->get($package->id));

            if ($resolved === null) {
                continue;
            }

            $legs[] = $this->leg(
                deal: $deal,
                agent: $agent,
                sourceAgent: $agent,
                // Not earned via a level, so nothing is claimed about one.
                level: null,
                percentage: $resolved['percentage'],
                amount: $resolved['amount'],
                type: MlmCommissionType::Agent,
                packageId: $package->id,
            );
        }

        Log::info('MlmCommissionService: Resolved '.count($legs)." package commission legs for deal {$deal->id}");

        return $legs;
    }

    /**
     * What one package pays this agent: the per-agent override if there is one,
     * otherwise the package default.
     *
     * The percentage comes back alongside the amount because a fixed fee has no
     * percentage at all, and the leg has to record that difference rather than
     * store a derived figure that stops being true when the package is repriced.
     *
     * @return array{amount: float, percentage: float|null}|null null when nothing is payable
     */
    public function resolvePackageCommission(
        Package $package,
        LeadAgent $agent,
        ?AgentPackageCommissionRate $override = null
    ): ?array {
        $override ??= AgentPackageCommissionRate::query()
            ->where('agent_id', $agent->id)
            ->where('package_id', $package->id)
            ->first();

        $type = $override?->commission_type ?? $package->commission_type;

        // Distinct from $type === null (fall through to the level-based split):
        // None is a configured zero, so no leg is written and nothing falls
        // through. Checked before touching commission_value at all — that value
        // is meaningless for None and never trusted to already be zero.
        if ($type === null || $type === PackageCommissionType::None) {
            return null;
        }

        $value = (float) ($override?->commission_value ?? $package->commission_value);

        // Percentage is computed against packages.value, which is stored in
        // the package's OWN currency (packages.currency) — not necessarily
        // the company's. Converted here so the written amount is always
        // company currency, matching the level-based path. A fixed fee is
        // NOT converted: it's entered directly in company currency by the
        // settings-page convention (the input is labelled with the
        // company's symbol, not the package's — see PackageFormModal.tsx),
        // so applying a rate to it would double-convert an already-correct number.
        $amount = $type === PackageCommissionType::Percentage
            ? round((float) $package->value * ($value / 100) * $this->packageCurrencyRate($package), 2)
            : round($value, 2);

        if ($amount <= 0) {
            return null;
        }

        return [
            'amount' => $amount,
            'percentage' => $type === PackageCommissionType::Percentage ? $value : null,
        ];
    }

    /**
     * Rate to convert one unit of $package's own currency into the company's
     * currency — same convention as Currency::exchange_rate everywhere else
     * in the app (Payment, Expense, Invoice: amount * exchange_rate). Looked
     * up live rather than snapshotted: a package is catalog pricing, not a
     * completed transaction, so there is no "rate at the time" to freeze.
     *
     * Explicitly company-scoped rather than relying on CompanyScope: this
     * runs inside a queued job, where there is no authenticated user and so
     * no session-resolved company() for the global scope to filter by.
     */
    protected function packageCurrencyRate(Package $package): float
    {
        if (! $package->currency) {
            return 1.0;
        }

        $rate = Currency::withoutGlobalScopes()
            ->where('company_id', $package->company_id)
            ->where('currency_code', $package->currency)
            ->value('exchange_rate');

        return $rate !== null ? (float) $rate : 1.0;
    }

    /**
     * Calculate the monetary amount from deal value and percentage.
     */
    protected function calculateAmount(float $dealValue, float $percentage): float
    {
        return round($dealValue * ($percentage / 100), 2);
    }

    protected function isPerAgentOverrideEnabled(): bool
    {
        return FeatureFlags::enabled('sales.per-agent-commission-override');
    }

    protected function resolveDirectRate(
        LeadAgent $agent,
        ?MlmLevel $level,
        ?MlmCycleLevelSnapshot $snapshot
    ): float {
        if ($agent->custom_direct_rate !== null) {
            return (float) $agent->custom_direct_rate;
        }

        if ($snapshot) {
            return (float) ($snapshot->direct_rate ?? $snapshot->commission_percentage);
        }

        if ($level) {
            return (float) ($level->direct_rate ?? $level->commission_percentage);
        }

        return 0;
    }

    protected function resolveOverrideRate(
        LeadAgent $agent,
        ?MlmLevel $level,
        ?MlmCycleLevelSnapshot $snapshot
    ): float {
        if ($agent->custom_override_rate !== null) {
            return (float) $agent->custom_override_rate;
        }

        if ($snapshot) {
            return (float) ($snapshot->override_rate ?? $snapshot->commission_percentage);
        }

        if ($level) {
            return (float) ($level->override_rate ?? $level->commission_percentage);
        }

        return 0;
    }

    /**
     * The ceiling on total commission for a deal, most specific source first:
     * per-deal override, then the project or its developer, then the cycle
     * snapshot, then global config.
     *
     * The project/developer tier sits where it does because it is negotiated
     * per counterparty: the company agrees a rate with a developer across their
     * portfolio, and sometimes a different one for a single project. That is
     * more specific than a company-wide setting and less specific than an
     * override typed onto one deal.
     */
    protected function getMaxCommissionPercentage(Deal $deal, ?\App\Models\MlmCycle $cycle = null): float
    {
        // Per-deal override takes highest priority
        if ($deal->max_commission_percentage !== null && $deal->max_commission_percentage > 0) {
            return (float) $deal->max_commission_percentage;
        }

        $negotiated = $this->projectMaxCommission($deal);

        if ($negotiated !== null) {
            return $negotiated;
        }

        // Use cycle snapshot if available
        if ($cycle && $cycle->max_commission_snapshot !== null) {
            return (float) $cycle->max_commission_snapshot;
        }

        // Fall back to config
        return (float) config('mlm.max_commission_percentage', 10);
    }

    /**
     * The commission ceiling agreed for the projects this deal's properties
     * belong to, or null when none of them set one.
     *
     * Per project, an explicit percentage wins over its developer's — that is
     * what "the project overrides the developer" means. A project with no rate
     * of its own inherits the developer's, and a developer with none defers
     * outward to the cycle/global setting rather than capping the deal at zero.
     *
     * Where a deal spans several projects the lowest configured rate wins.
     * These are ceilings, and honouring the highest would pay a rate one of the
     * counterparties never agreed to; the conservative reading is the only one
     * that cannot overpay. Deals spanning projects are rare enough that this is
     * a tie-break, not a policy anyone should be planning around.
     */
    protected function projectMaxCommission(Deal $deal): ?float
    {
        $projectIds = Property::query()
            ->whereIn('product_id', $deal->products()->select('products.id'))
            ->whereNotNull('developer_project_id')
            ->distinct()
            ->pluck('developer_project_id');

        if ($projectIds->isEmpty()) {
            return null;
        }

        $rates = DeveloperProject::query()
            ->with('developer:id,commission_percentage')
            ->whereIn('id', $projectIds)
            ->get(['id', 'developer_id', 'commission_percentage'])
            ->map(fn (DeveloperProject $project) => $project->commission_percentage
                ?? $project->developer?->commission_percentage)
            ->filter(fn ($rate) => $rate !== null && (float) $rate > 0)
            ->map(fn ($rate) => (float) $rate);

        return $rates->isEmpty() ? null : (float) $rates->min();
    }

    /**
     * Describe one commission leg, without writing it.
     *
     * @return array<string, mixed>
     */
    protected function leg(
        Deal $deal,
        LeadAgent $agent,
        LeadAgent $sourceAgent,
        ?MlmLevel $level,
        ?float $percentage,
        float $amount,
        MlmCommissionType $type,
        ?int $cycleLevelSnapshotId = null,
        ?int $packageId = null
    ): array {
        return [
            'company_id' => $deal->company_id,
            'deal_id' => $deal->id,
            'agent_id' => $agent->id,
            'source_agent_id' => $sourceAgent->id,
            'level_id' => $level?->id,
            'package_id' => $packageId,
            'cycle_level_snapshot_id' => $cycleLevelSnapshotId,
            'percentage' => $percentage,
            'amount' => $amount,
            'type' => $type->value,
            'status' => MlmCommissionStatus::Pending->value,
        ];
    }
}
