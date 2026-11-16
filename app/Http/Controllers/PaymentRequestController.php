<?php

namespace App\Http\Controllers;

use App\Models\Currency;
use App\Models\Payment;
use App\Scopes\CompanyScope;
use App\Services\DealPaymentService;
use App\Services\DealPaymentUiStateMapper;
use App\Support\FeatureFlags;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PaymentRequestController extends AccountBaseController
{
    public function __construct(
        private readonly DealPaymentService $dealPaymentService,
    ) {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            abort_unless(FeatureFlags::enabled('packages.online-payment'), 404);
            abort_403(! DealPaymentService::canConfirmTransfer(user()));

            return $next($request);
        });
    }

    public function index(Request $request)
    {
        foreach (['ui_state', 'date_from', 'date_to', 'search', 'lead', 'lead_id', 'agent_id', 'currency_id'] as $key) {
            if ($request->input($key) === '') {
                $request->merge([$key => null]);
            }
        }

        $filters = $request->validate([
            'ui_state' => 'nullable|string|max:40',
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => 'nullable|date_format:Y-m-d',
            // `lead` is the previous name of this box. Bookmarked links still work.
            'search' => 'nullable|string|max:120',
            'lead' => 'nullable|string|max:120',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        if (!empty($filters['date_from']) && !empty($filters['date_to']) && $filters['date_from'] > $filters['date_to']) {
            abort(422, 'date_from must be on or before date_to.');
        }

        $search = trim((string) ($filters['search'] ?? $filters['lead'] ?? ''));

        $slice = [
            'date_from' => $filters['date_from'] ?? null,
            'date_to' => $filters['date_to'] ?? null,
            'search' => $search !== '' ? $search : null,
            'lead_id' => $this->idList($request->input('lead_id')),
            'agent_id' => $this->idList($request->input('agent_id')),
            'currency_id' => $this->idList($request->input('currency_id')),
        ];

        $query = $this->scopedQuery($slice);
        $this->applyUiStateFilter($query, $filters['ui_state'] ?? null);
        $query->with([
            'deal:id,name,agent_id,value,lead_id',
            'deal.leadAgent.user:id,name',
            'deal.contact:id,client_name,company_name',
        ])->orderByDesc('created_at')->orderByDesc('id');

        $paginated = $query->paginate((int) ($filters['per_page'] ?? 15));
        $paginated->through(fn (Payment $payment) => $this->serializeRow($payment));

        return Inertia::render('PaymentRequests/Index', [
            'pageTitle' => 'Payment Requests',
            'paymentRequests' => [
                'data' => $paginated->items(),
                'current_page' => $paginated->currentPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                'last_page' => $paginated->lastPage(),
                'from' => $paginated->firstItem(),
                'to' => $paginated->lastItem(),
            ],
            'filters' => [
                'ui_state' => $filters['ui_state'] ?? null,
                'date_from' => $slice['date_from'],
                'date_to' => $slice['date_to'],
                'search' => $slice['search'],
                'lead_id' => $slice['lead_id'],
                'agent_id' => $slice['agent_id'],
                'currency_id' => $slice['currency_id'],
            ],
            // Counts and the accountant totals follow the date range, search,
            // and the lead, agent, and currency filters. Status only narrows
            // the list, so the cards stay a picture of the whole slice.
            'counts' => Inertia::defer(fn () => $this->stateCounts($slice)),
            'stats' => Inertia::defer(fn () => $this->stats($slice)),
            'filterOptions' => Inertia::defer(fn () => $this->filterOptions()),
        ]);
    }

    /**
     * @param  array{date_from: ?string, date_to: ?string, search: ?string, lead_id: array<int, int>, agent_id: array<int, int>, currency_id: array<int, int>}  $slice
     * @return Builder<Payment>
     */
    private function scopedQuery(array $slice): Builder
    {
        $query = $this->baseQuery();

        if (!empty($slice['date_from'])) {
            $query->where('payments.created_at', '>=', Carbon::parse($slice['date_from'])->startOfDay());
        }
        if (!empty($slice['date_to'])) {
            $query->where('payments.created_at', '<=', Carbon::parse($slice['date_to'])->endOfDay());
        }
        if ($slice['lead_id'] !== []) {
            $query->whereHas('deal', fn ($deal) => $deal->whereIn('deals.lead_id', $slice['lead_id']));
        }
        if ($slice['agent_id'] !== []) {
            $query->whereHas('deal.leadAgent', fn ($agent) => $agent->whereIn('lead_agents.user_id', $slice['agent_id']));
        }
        if ($slice['currency_id'] !== []) {
            $query->whereIn('payments.currency_id', $slice['currency_id']);
        }

        $this->applySearch($query, $slice['search'] ?? null);

        return $query;
    }

    /**
     * @return array<int, int>
     */
    private function idList(mixed $value): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        $items = is_array($value) ? $value : explode(',', (string) $value);
        $ids = [];
        foreach ($items as $item) {
            if (is_int($item) || (is_string($item) && preg_match('/^\d+$/', $item) === 1)) {
                $ids[] = (int) $item;
            }
        }

        return array_slice(array_values(array_unique($ids)), 0, 50);
    }

    /**
     * Leads, agents, and currencies that actually appear on a payment request.
     *
     * @return array{leads: array<int, array{value: int, label: string}>, agents: array<int, array{value: int, label: string}>, currencies: array<int, array{value: int, label: string}>}
     */
    private function filterOptions(): array
    {
        $deals = DB::table('deals')
            ->whereIn('id', $this->baseQuery()->whereNotNull('payments.deal_id')->distinct()->pluck('payments.deal_id'))
            ->get(['lead_id', 'agent_id']);

        $leads = DB::table('leads')
            ->whereIn('id', $deals->pluck('lead_id')->filter()->unique()->values())
            ->whereNull('deleted_at')
            ->orderBy('client_name')
            ->get(['id', 'client_name', 'company_name']);

        $agents = DB::table('lead_agents')
            ->join('users', 'users.id', '=', 'lead_agents.user_id')
            ->whereIn('lead_agents.id', $deals->pluck('agent_id')->filter()->unique()->values())
            ->orderBy('users.name')
            ->get(['users.id as id', 'users.name as name'])
            ->unique('id')
            ->values();

        $currencies = DB::table('currencies')
            ->whereIn('id', $this->baseQuery()->whereNotNull('payments.currency_id')->distinct()->pluck('payments.currency_id'))
            ->orderBy('currency_code')
            ->get(['id', 'currency_code', 'currency_symbol']);

        return [
            'leads' => $leads->map(function ($lead) {
                $name = trim((string) $lead->client_name);
                $company = trim((string) $lead->company_name);
                $label = $name !== '' && $company !== '' ? $name.' · '.$company : ($name !== '' ? $name : $company);

                return ['value' => (int) $lead->id, 'label' => $label !== '' ? $label : '#'.$lead->id];
            })->values()->all(),
            'agents' => $agents->map(fn ($agent) => [
                'value' => (int) $agent->id,
                'label' => trim((string) $agent->name) !== '' ? trim((string) $agent->name) : '#'.$agent->id,
            ])->values()->all(),
            'currencies' => $currencies->map(function ($currency) {
                $code = trim((string) $currency->currency_code);
                $symbol = trim((string) $currency->currency_symbol);

                return [
                    'value' => (int) $currency->id,
                    'label' => $symbol !== '' ? trim($code.' '.$symbol) : ($code !== '' ? $code : '#'.$currency->id),
                ];
            })->values()->all(),
        ];
    }

    /**
     * One box matches the deal name, the lead, the agent, or the reference.
     */
    private function applySearch(Builder $query, ?string $search): void
    {
        $term = trim((string) $search);
        if ($term === '') {
            return;
        }

        $like = '%' . addcslashes($term, '%_\\') . '%';
        $query->where(function ($outer) use ($like, $term) {
            $outer->where('payments.external_reference', 'like', $like)
                ->orWhereHas('deal', function ($deal) use ($like, $term) {
                    $deal->where('deals.name', 'like', $like)
                        ->orWhereHas('contact', function ($lead) use ($like, $term) {
                            $lead->where('leads.client_name', 'like', $like)
                                ->orWhere('leads.company_name', 'like', $like);
                            if (ctype_digit($term)) {
                                $lead->orWhere('leads.id', (int) $term);
                            }
                        })
                        ->orWhereHas('leadAgent.user', function ($user) use ($like) {
                            $user->where('users.name', 'like', $like);
                        });
                });
        });
    }

    /**
     * @return Builder<Payment>
     */
    private function baseQuery(): Builder
    {
        return Payment::query()
            ->without('order')
            ->whereNotNull('payments.external_reference')
            ->where('payments.external_reference', '!=', '');
    }

    /**
     * @param  array{date_from: ?string, date_to: ?string, search: ?string, lead_id: array<int, int>, agent_id: array<int, int>, currency_id: array<int, int>}  $slice
     * @return array<string, int>
     */
    private function stateCounts(array $slice): array
    {
        $counts = ['all' => $this->scopedQuery($slice)->count()];

        foreach (DealPaymentUiStateMapper::queryScopes() as $uiState => $scope) {
            $query = $this->scopedQuery($slice);
            $scope($query);
            $counts[$uiState] = $query->count();
        }

        return $counts;
    }

    /**
     * Money is summed in company currency (base_amount), the figure the
     * request was converted from, so a mixed-currency list still adds up.
     *
     * @param  array{date_from: ?string, date_to: ?string, search: ?string, lead_id: array<int, int>, agent_id: array<int, int>, currency_id: array<int, int>}  $slice
     * @return array<string, mixed>
     */
    private function stats(array $slice): array
    {
        $currency = $this->companyCurrency();

        return [
            'currency' => $currency?->currency_code,
            'currency_symbol' => $currency?->currency_symbol,
            'count' => $this->scopedQuery($slice)->count(),
            'requested' => $this->sumBase($slice),
            'collected' => $this->sumBase($slice, ['confirmed', 'paid_online']),
            'outstanding' => $this->sumBase($slice, ['pending_payment', 'bank_transfer_pending', 'processing_online']),
            'cancelled' => $this->sumBase($slice, ['invalidated']),
        ];
    }

    /**
     * @param  array{date_from: ?string, date_to: ?string, search: ?string, lead_id: array<int, int>, agent_id: array<int, int>, currency_id: array<int, int>}  $slice
     * @param  array<int, string>  $states
     */
    private function sumBase(array $slice, array $states = []): float
    {
        $query = $this->scopedQuery($slice);

        if ($states !== []) {
            $scopes = DealPaymentUiStateMapper::queryScopes();
            $query->where(function ($outer) use ($states, $scopes) {
                foreach ($states as $index => $state) {
                    $method = $index === 0 ? 'where' : 'orWhere';
                    $outer->{$method}(function ($inner) use ($scopes, $state) {
                        $scopes[$state]($inner);
                    });
                }
            });
        }

        return round((float) $query->sum('payments.base_amount'), 2);
    }

    private function companyCurrency(): ?Currency
    {
        $company = company();
        $currencyId = $company->currency_id ?? null;
        if (!$currencyId && $company) {
            $currencyId = \App\Models\Company::withoutGlobalScopes()->whereKey($company->id)->value('currency_id');
        }

        return $currencyId
            ? Currency::withoutGlobalScope(CompanyScope::class)->find($currencyId)
            : null;
    }

    private function applyUiStateFilter($query, ?string $uiState): void
    {
        if (!$uiState) {
            return;
        }

        $scopes = DealPaymentUiStateMapper::queryScopes();
        abort_unless(isset($scopes[$uiState]), 422, 'Unknown ui_state filter.');

        $scopes[$uiState]($query);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeRow(Payment $payment): array
    {
        $base = $this->dealPaymentService->serializeDealPayment($payment);
        $lead = $payment->deal?->contact;

        return array_merge($base, [
            'deal' => $payment->deal ? [
                'id' => $payment->deal->id,
                'name' => $payment->deal->name,
                'url' => route('deals.show', $payment->deal->id),
            ] : null,
            // The deal's value now, in company currency — it can differ from
            // base_amount (what this request was converted from) once the
            // value changes and the request is invalidated.
            'deal_value' => $payment->deal?->value !== null ? (float) $payment->deal->value : null,
            'agent_name' => $payment->deal?->leadAgent?->user?->name,
            'agent_user_id' => $payment->deal?->leadAgent?->user?->id,
            'lead_name' => $lead?->client_name,
            'lead_company' => $lead?->company_name,
            'lead_id' => $lead?->id,
        ]);
    }
}
