<?php

namespace App\Services\Partner;

use App\Enums\OutcomeStatus;
use App\Enums\PackageCommissionType;
use App\Models\AgentPackageCommissionRate;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Services\MlmCommissionService;
use App\Support\PartnerRole;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

/**
 * A partner's own referrals, as the partner is allowed to see them.
 *
 * Scoped to leads whose referred_by_agent_id is the partner's agent — a query,
 * not a UI choice — and never selecting contact fields, the handling agent, or
 * anyone else's leads. Names are abbreviated, as everywhere else a partner sees
 * a client.
 *
 * Deals that pay this partner nothing are left out of every figure here: a deal
 * whose attached packages all resolve to no commission for them (a configured
 * "none", or a payout of zero). A deal with no commission package pays through
 * the level-based split, so it stays in. The rule is MlmCommissionService's own
 * (resolvePackageCommission), not a copy of it.
 */
class PartnerLeadService
{
    public function __construct(private MlmCommissionService $commissions)
    {
    }

    public function agentFor(int $userId): ?LeadAgent
    {
        return LeadAgent::where('user_id', $userId)->first();
    }

    /**
     * The partner's leads, filtered and paged, with the options the filters offer.
     *
     * Every one of the partner's own leads is loaded (four columns each) so the
     * deal-based filters see the same payout-adjusted deals as the counts do —
     * a deal that pays the partner nothing never makes a lead match "has an
     * open, won or lost deal". Filtering and paging then happen on the rows.
     *
     * @param  array{search?: string|null, status?: array<int, int>, deals?: array<int, string>}  $filters
     * @return array{page: LengthAwarePaginator, options: array{statuses: array<int, array<string, mixed>>}}
     */
    public function index(LeadAgent $agent, array $filters, int $page = 1, int $perPage = 25): array
    {
        $leads = Lead::query()
            ->where('referred_by_agent_id', $agent->id)
            ->with('lifecycleStatus:id,label,label_color')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get(['leads.id', 'leads.client_name', 'leads.created_at', 'leads.lead_lifecycle_status_id']);

        $deals = $this->payableDeals($leads->pluck('id')->all(), $agent);

        $rows = $leads->map(function (Lead $lead) use ($deals) {
            $leadDeals = $deals->get($lead->id, collect());

            return [
                'id' => $lead->id,
                'name' => PartnerRole::abbreviateName($lead->client_name),
                'status' => $this->status($lead),
                'created_at' => $lead->created_at?->toIso8601String(),
                // Outcome, not pipeline stage: stages differ from one pipeline
                // to the next, open/won/lost mean the same everywhere.
                'deals' => [
                    'open' => $leadDeals->filter(fn (Deal $d) => $d->outcome_status === null)->count(),
                    'won' => $leadDeals->filter(fn (Deal $d) => $d->outcome_status === OutcomeStatus::Won)->count(),
                    'lost' => $leadDeals->filter(fn (Deal $d) => $d->outcome_status === OutcomeStatus::Lost)->count(),
                ],
                // Matched against, never sent: removed before the row leaves here.
                '_search' => mb_strtolower((string) $lead->client_name),
            ];
        });

        $options = [
            'statuses' => $rows->pluck('status')->filter()->unique('id')->sortBy('label')->values()->all(),
        ];

        $filtered = self::filterRows($rows, $filters);

        $paginator = new LengthAwarePaginator(
            $filtered->forPage($page, $perPage)->map(function (array $row) {
                unset($row['_search']);

                return $row;
            })->values(),
            $filtered->count(),
            $perPage,
            $page,
        );

        return ['page' => $paginator, 'options' => $options];
    }

    /**
     * Pure: applies the four filters to already-built rows. Public so it can be
     * tested without a database.
     *
     * - search: a case-insensitive part of the client's name
     * - status: lifecycle status ids; a lead matches any of them
     * - deals: any of "open", "won", "lost" (the lead has at least one deal in
     *   that outcome) or "none" (it has no deals at all); a lead matches any
     *   of the ones chosen
     *
     * @param  Collection<int, array<string, mixed>>  $rows
     * @param  array{search?: string|null, status?: array<int, int>, deals?: array<int, string>}  $filters
     * @return Collection<int, array<string, mixed>>
     */
    public static function filterRows(Collection $rows, array $filters): Collection
    {
        $search = mb_strtolower(trim((string) ($filters['search'] ?? '')));
        $statuses = array_values(array_filter((array) ($filters['status'] ?? []), fn ($v) => $v !== null && $v !== ''));
        $deals = array_values(array_filter((array) ($filters['deals'] ?? []), fn ($v) => $v !== null && $v !== ''));

        return $rows
            ->when($search !== '', fn (Collection $c) => $c->filter(
                fn (array $r) => str_contains((string) $r['_search'], $search)
            ))
            ->when($statuses !== [], fn (Collection $c) => $c->filter(
                fn (array $r) => in_array($r['status']['id'] ?? null, $statuses, true)
            ))
            ->when($deals !== [], fn (Collection $c) => $c->filter(function (array $r) use ($deals) {
                $counts = $r['deals'];

                foreach ($deals as $condition) {
                    $matches = $condition === 'none'
                        ? array_sum($counts) === 0
                        : ($counts[$condition] ?? 0) > 0;

                    if ($matches) {
                        return true;
                    }
                }

                return false;
            }))
            ->values();
    }

    /**
     * One lead in full, or null when it is not this partner's.
     *
     * @return array<string, mixed>|null
     */
    public function detail(LeadAgent $agent, int $leadId): ?array
    {
        $lead = Lead::query()
            ->where('id', $leadId)
            ->where('referred_by_agent_id', $agent->id)
            ->with('lifecycleStatus:id,label,label_color')
            ->first(['leads.id', 'leads.client_name', 'leads.created_at', 'leads.lead_lifecycle_status_id']);

        if (is_null($lead)) {
            return null;
        }

        $deals = $this->payableDeals([$lead->id], $agent)->get($lead->id, collect());
        $active = $deals->filter(fn (Deal $d) => $d->outcome_status === null)->values();
        $closed = $deals->filter(fn (Deal $d) => $d->outcome_status !== null)->values();

        return [
            'id' => $lead->id,
            'name' => PartnerRole::abbreviateName($lead->client_name),
            'status' => $this->status($lead),
            'active_deals' => $active->map(fn (Deal $d) => $this->dealRow($d))->all(),
            'closed_deals' => $closed->map(fn (Deal $d) => $this->dealRow($d))->all(),
            // What this lead has brought: open deals and won deals. A lost deal
            // brought nothing, so it is listed but not counted.
            'totals' => $this->totals($deals->filter(
                fn (Deal $d) => $d->outcome_status !== OutcomeStatus::Lost
            )),
        ];
    }

    /**
     * Deals on the given leads that pay this partner something, grouped by lead.
     *
     * @param  array<int, int>  $leadIds
     * @return Collection<int, Collection<int, Deal>>
     */
    private function payableDeals(array $leadIds, LeadAgent $agent): Collection
    {
        if ($leadIds === []) {
            return collect();
        }

        $overrides = AgentPackageCommissionRate::query()
            ->where('agent_id', $agent->id)
            ->get()
            ->keyBy('package_id');

        return Deal::query()
            ->whereIn('lead_id', $leadIds)
            ->with([
                'currency:id,currency_code,currency_symbol',
                'packages:id,value,currency,commission_type,commission_value',
            ])
            ->orderByDesc('created_at')
            ->get(['id', 'name', 'lead_id', 'value', 'currency_id', 'outcome_status', 'won_at', 'close_date', 'created_at'])
            ->reject(fn (Deal $deal) => $this->paysNothing($deal, $agent, $overrides))
            ->groupBy('lead_id');
    }

    /**
     * Mirrors MlmCommissionService::packageLegs(): package pricing applies when
     * any attached package carries a commission_type, and then it owns the whole
     * payout — so the deal pays nothing only if every such package does.
     *
     * @param  Collection<int, AgentPackageCommissionRate>  $overrides  keyed by package_id
     */
    private function paysNothing(Deal $deal, LeadAgent $agent, Collection $overrides): bool
    {
        $configured = $deal->packages->filter(fn ($package) => $package->commission_type !== null);

        if ($configured->isEmpty()) {
            return false;
        }

        return $configured->every(function ($package) use ($agent, $overrides) {
            $override = $overrides->get($package->id);
            $type = $override?->commission_type ?? $package->commission_type;

            // Cheap and common: a configured zero needs no further lookup.
            if ($type === null || $type === PackageCommissionType::None) {
                return true;
            }

            return $this->commissions->resolvePackageCommission($package, $agent, $override) === null;
        });
    }

    /** @return array{id: int, label: string, color: string|null}|null */
    private function status(Lead $lead): ?array
    {
        $status = $lead->lifecycleStatus;

        return $status ? ['id' => (int) $status->id, 'label' => $status->label, 'color' => $status->label_color] : null;
    }

    /** @return array<string, mixed> */
    private function dealRow(Deal $deal): array
    {
        return [
            'id' => $deal->id,
            'name' => $deal->name,
            // open, won or lost — never the pipeline stage, which differs per pipeline.
            'status' => $deal->outcome_status?->value ?? 'open',
            'value' => (float) ($deal->value ?? 0),
            'currency' => $this->currencyOf($deal),
            'date' => ($deal->won_at ?? $deal->close_date ?? $deal->created_at)?->toDateString(),
        ];
    }

    /**
     * Sums per currency: two currencies are never added together.
     *
     * @param  Collection<int, Deal>  $deals
     * @return array<int, array{code: string|null, symbol: string|null, amount: float}>
     */
    private function totals(Collection $deals): array
    {
        return $deals
            ->groupBy(fn (Deal $d) => $this->currencyOf($d)['code'] ?? '')
            ->map(function (Collection $group) {
                $currency = $this->currencyOf($group->first());

                return [
                    'code' => $currency['code'],
                    'symbol' => $currency['symbol'],
                    'amount' => round((float) $group->sum(fn (Deal $d) => (float) ($d->value ?? 0)), 2),
                ];
            })
            ->values()
            ->all();
    }

    /** @return array{code: string|null, symbol: string|null} */
    private function currencyOf(Deal $deal): array
    {
        if ($deal->currency) {
            return ['code' => $deal->currency->currency_code, 'symbol' => $deal->currency->currency_symbol];
        }

        $company = company();
        $fallback = is_object($company) ? $company->currency : null;

        return ['code' => $fallback?->currency_code, 'symbol' => $fallback?->currency_symbol];
    }
}
