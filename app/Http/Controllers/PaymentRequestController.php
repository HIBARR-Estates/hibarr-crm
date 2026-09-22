<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Services\DealPaymentService;
use App\Services\DealPaymentUiStateMapper;
use App\Support\FeatureFlags;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PaymentRequestController extends AccountBaseController
{
    public function __construct(
        private readonly DealPaymentService $dealPaymentService,
    ) {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            abort_unless(FeatureFlags::enabled('packages.online-payment'), 404);
            abort_403(user()->permission('edit_payments') != 'all');

            return $next($request);
        });
    }

    public function index(Request $request)
    {
        $query = Payment::query()
            ->without('order')
            ->whereNotNull('external_reference')
            ->where('external_reference', '!=', '')
            ->with(['deal:id,name,agent_id', 'deal.leadAgent.user:id,name']);

        $this->applyUiStateFilter($query, $request->get('ui_state'));

        $query->orderByDesc('created_at');

        $paginated = $query->paginate($request->get('per_page', 15));
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
            'filters' => $request->only(['ui_state']),
        ]);
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

        return array_merge($base, [
            'deal' => $payment->deal ? [
                'id' => $payment->deal->id,
                'name' => $payment->deal->name,
                'url' => route('deals.show', $payment->deal->id),
            ] : null,
            'agent_name' => $payment->deal?->leadAgent?->user?->name,
            'currency_symbol' => $payment->currency?->currency_symbol,
        ]);
    }
}
