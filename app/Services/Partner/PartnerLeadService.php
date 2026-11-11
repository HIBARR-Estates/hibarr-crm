<?php

namespace App\Services\Partner;

use App\Enums\OutcomeStatus;
use App\Enums\PackageCommissionType;
use App\Models\AgentPackageCommissionRate;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\PartnerFlag;
use App\Services\MlmCommissionService;
use App\Support\PartnerRole;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * A partner's own referrals, as the partner is allowed to see them.
 *
 * Scoped to leads whose referred_by_agent_id is the partner's agent — a query,
 * not a UI choice — and never selecting email, phone, the handling agent, or
 * anyone else's leads. The partner sees the client's full name, and where the
 * lead came from: the first-touch UTM source when there is one, otherwise the
 * lead source.
 *
 * Deals that pay this partner nothing are left out of every figure here: a deal
 * whose attached packages all resolve to no commission for them (a configured
 * "none", or a payout of zero). A deal with no commission package pays through
 * the level-based split, so it stays in. The rule is MlmCommissionService's own
 * (resolvePackageCommission), not a copy of it.
 */
class PartnerLeadService
{
    public function __construct(private MlmCommissionService $commissions) {}

    public function agentFor(int $userId): ?LeadAgent
    {
        return LeadAgent::where('user_id', $userId)->first();
    }

    /**
     * The partner's leads, filtered and paged, with the options the filters offer.
     *
     * Every one of the partner's own leads is loaded (name, source, status, date) so the
     * deal-based filters see the same payout-adjusted deals as the counts do —
     * a deal that pays the partner nothing never makes a lead match "has an
     * open, won or lost deal". Filtering and paging then happen on the rows.
     *
     * @param  array{search?: string|null, status?: array<int, int>, source?: array<int, string>, deals?: array<int, string>, added_from?: string|null, added_to?: string|null, sort?: string}  $filters
     * @return array{page: LengthAwarePaginator, options: array{statuses: array<int, array<string, mixed>>, sources: array<int, string>}}
     */
    public function index(LeadAgent $agent, array $filters, int $page = 1, int $perPage = 25): array
    {
        $leads = $this->referredLeads($agent)
            ->get(['leads.id', 'leads.client_name', 'leads.source_id', 'leads.created_at', 'leads.lead_lifecycle_status_id']);

        $deals = $this->payableDeals($leads->pluck('id')->all(), $agent);

        $rows = $leads->map(function (Lead $lead) use ($deals) {
            $leadDeals = $deals->get($lead->id, collect());

            return [
                'id' => $lead->id,
                'name' => PartnerRole::fullName($lead->client_name),
                ...$this->sourceLabels($lead),
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
            // The strings the table shows: the preferred source, and the lead
            // source when it differs. Built before filtering so a chosen source
            // does not disappear from the list.
            'sources' => $rows
                ->flatMap(fn (array $row) => array_values(array_filter(
                    [$row['source'] ?? null, $row['lead_source'] ?? null],
                    fn ($source) => is_string($source) && $source !== ''
                )))
                ->unique()
                ->sortBy(fn (string $source) => mb_strtolower($source))
                ->values()
                ->all(),
        ];

        $filtered = self::sortRows(
            self::filterRows($rows, $filters),
            (string) ($filters['sort'] ?? 'added_desc'),
        );

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
     * Pure: applies the filters to already-built rows. Public so it can be
     * tested without a database.
     *
     * - search: a case-insensitive part of the client's name
     * - status: lifecycle status ids; a lead matches any of them
     * - source: the preferred source, or the lead source when it differs; a
     *   lead matches any of the ones chosen
     * - deals: any of "open", "won", "lost" (the lead has at least one deal in
     *   that outcome) or "none" (it has no deals at all); a lead matches any
     *   of the ones chosen
     * - added_from / added_to: calendar days (Y-m-d), inclusive. A lead with
     *   no added date never matches a bounded range
     *
     * @param  Collection<int, array<string, mixed>>  $rows
     * @param  array{search?: string|null, status?: array<int, int>, source?: array<int, string>, deals?: array<int, string>, added_from?: string|null, added_to?: string|null}  $filters
     * @return Collection<int, array<string, mixed>>
     */
    public static function filterRows(Collection $rows, array $filters): Collection
    {
        $search = mb_strtolower(trim((string) ($filters['search'] ?? '')));
        $statuses = array_values(array_filter((array) ($filters['status'] ?? []), fn ($v) => $v !== null && $v !== ''));
        $sources = array_values(array_filter((array) ($filters['source'] ?? []), fn ($v) => $v !== null && $v !== ''));
        $deals = array_values(array_filter((array) ($filters['deals'] ?? []), fn ($v) => $v !== null && $v !== ''));
        $addedFrom = self::day($filters['added_from'] ?? null);
        $addedTo = self::day($filters['added_to'] ?? null);

        return $rows
            ->when($search !== '', fn (Collection $c) => $c->filter(
                fn (array $r) => str_contains((string) $r['_search'], $search)
            ))
            ->when($statuses !== [], fn (Collection $c) => $c->filter(
                fn (array $r) => in_array($r['status']['id'] ?? null, $statuses, true)
            ))
            ->when($sources !== [], fn (Collection $c) => $c->filter(
                fn (array $r) => in_array($r['source'] ?? null, $sources, true)
                    || in_array($r['lead_source'] ?? null, $sources, true)
            ))
            ->when($addedFrom || $addedTo, fn (Collection $c) => $c->filter(
                function (array $r) use ($addedFrom, $addedTo) {
                    $day = self::day($r['created_at'] ?? null);
                    if ($day === null) {
                        return false;
                    }

                    return ($addedFrom === null || $day >= $addedFrom)
                        && ($addedTo === null || $day <= $addedTo);
                }
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
     * Newest added first unless $sort is "added_asc". The same added time
     * breaks by id in the same direction, so the order is stable.
     *
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return Collection<int, array<string, mixed>>
     */
    public static function sortRows(Collection $rows, string $sort = 'added_desc'): Collection
    {
        $desc = $sort !== 'added_asc';

        return $rows->sort(function (array $a, array $b) use ($desc) {
            $cmp = strcmp((string) ($a['created_at'] ?? ''), (string) ($b['created_at'] ?? ''));
            if ($cmp === 0) {
                $cmp = ($a['id'] <=> $b['id']);
            }

            return $desc ? -$cmp : $cmp;
        })->values();
    }

    /** Y-m-d, or null when the value is not a date. */
    private static function day(mixed $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1) {
            return $value;
        }

        try {
            return Carbon::parse($value)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * One lead in full, or null when it is not this partner's.
     *
     * @return array<string, mixed>|null
     */
    public function detail(LeadAgent $agent, int $leadId): ?array
    {
        $lead = $this->referredLeads($agent)
            ->where('leads.id', $leadId)
            ->first([
                'leads.id',
                'leads.client_name',
                'leads.source_id',
                'leads.created_at',
                'leads.updated_at',
                'leads.first_contacted_at',
                'leads.lead_lifecycle_status_id',
            ]);

        if (is_null($lead)) {
            return null;
        }

        $deals = $this->payableDeals([$lead->id], $agent)->get($lead->id, collect());
        $active = $deals->filter(fn (Deal $d) => $d->outcome_status === null)->values();
        $closed = $deals->filter(fn (Deal $d) => $d->outcome_status !== null)->values();

        return [
            'id' => $lead->id,
            'name' => PartnerRole::fullName($lead->client_name),
            ...$this->sourceLabels($lead),
            ...$this->attribution($lead),
            'status' => $this->status($lead),
            'added_at' => $lead->created_at?->toIso8601String(),
            'updated_at' => $lead->updated_at?->toIso8601String(),
            'first_contacted_at' => $lead->first_contacted_at?->toIso8601String(),
            'first_meeting_at' => $this->firstMeetingAt($lead->id),
            'flags' => $this->flags($agent, $lead->id),
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
     * First-touch medium and campaign, beside the source the tables already
     * show. Empty strings are dropped. Email, phone and the handling agent
     * are not part of this.
     *
     * @return array{utm_medium: string|null, utm_campaign: string|null}
     */
    private function attribution(Lead $lead): array
    {
        $touch = $lead->utmTouches->first();

        $pick = function (string $field) use ($lead, $touch): ?string {
            $value = trim((string) ($touch?->{$field} ?: $lead->marketing?->{$field}));

            return $value !== '' ? $value : null;
        };

        return [
            'utm_medium' => $pick('utm_medium'),
            'utm_campaign' => $pick('utm_campaign'),
        ];
    }

    /**
     * The earliest past, non-cancelled meeting on the lead or one of its
     * deals — the same reading the partner dashboard uses for "Meeting held".
     */
    private function firstMeetingAt(int $leadId): ?string
    {
        $at = DB::table('lead_follow_up as f')
            ->leftJoin('deals as fd', 'fd.id', '=', 'f.deal_id')
            ->where('f.status', '<>', 'cancelled')
            ->whereNotNull('f.next_follow_up_date')
            ->where('f.next_follow_up_date', '<=', now())
            ->where(function ($query) use ($leadId) {
                $query->where('f.lead_id', $leadId)->orWhere('fd.lead_id', $leadId);
            })
            ->min('f.next_follow_up_date');

        return $at ? Carbon::parse($at)->toIso8601String() : null;
    }

    /**
     * Flags this partner raised on this lead, newest first, including replies.
     * The staff member who answered is not included.
     *
     * @return array<int, array<string, mixed>>
     */
    private function flags(LeadAgent $agent, int $leadId): array
    {
        return PartnerFlag::query()
            ->where('lead_agent_id', $agent->id)
            ->where('lead_id', $leadId)
            ->orderByDesc('id')
            ->get(['id', 'reason', 'message', 'status', 'response', 'created_at', 'resolved_at'])
            ->map(fn (PartnerFlag $flag) => [
                'id' => $flag->id,
                'reason' => $flag->reason,
                'message' => $flag->message,
                'status' => $flag->status,
                'response' => $flag->response,
                'created_at' => $flag->created_at?->toIso8601String(),
                'resolved_at' => $flag->resolved_at?->toIso8601String(),
            ])
            ->all();
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

    /**
     * This partner's own leads, with the status, lead source, and first-touch
     * UTM the tables display. Email and phone are not loaded.
     *
     * @return \Illuminate\Database\Eloquent\Builder<Lead>
     */
    private function referredLeads(LeadAgent $agent)
    {
        return Lead::query()
            ->where('referred_by_agent_id', $agent->id)
            ->with([
                'lifecycleStatus:id,label,label_color',
                'leadSource:id,type',
                'marketing:id,lead_id,utm_source,utm_medium,utm_campaign',
                'utmTouches' => fn ($query) => $query
                    ->where('is_first_touch', true)
                    ->orderBy('id')
                    ->select(['id', 'lead_id', 'utm_source', 'utm_medium', 'utm_campaign']),
            ]);
    }

    /**
     * First-touch UTM when the lead has one (the touch row, then the marketing
     * row that stores the same first set), otherwise the lead source.
     *
     * @return array{source: string|null, lead_source: string|null}
     */
    private function sourceLabels(Lead $lead): array
    {
        $touch = $lead->utmTouches->first(fn ($row) => filled($row->utm_source));

        return PartnerRole::sourceLabels(
            $touch?->utm_source ?? $lead->marketing?->utm_source,
            $lead->leadSource?->type,
        );
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
