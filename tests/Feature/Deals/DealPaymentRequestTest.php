<?php

namespace Tests\Feature\Deals;

use App\Enums\OutcomeStatus;
use App\Models\Deal;
use App\Models\Payment;
use App\Models\User;
use App\Scopes\CompanyScope;
use App\Services\ApiV2\CrmWriteService;
use App\Services\Deal\DealOutcomeService;
use App\Services\Deal\DealPaymentValueGuard;
use App\Services\DealPaymentService;
use App\Services\DealPaymentUiStateMapper;
use App\Services\OlWebhook\OlPayloadMapper;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class DealPaymentRequestTest extends TestCase
{
    use SetsFeatureFlags;

    private int $companyId = 1;

    private int $dealId = 10;

    private int $currencyId = 5;

    private int $usdCurrencyId = 6;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('database.default', 'sqlite');
        config()->set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();
        $this->seedBaseData();

        Payment::flushEventListeners();

        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.crm_webhook_api_key', 'crm-webhook-key');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);
        config()->set('services.ol.deal_payment_request_path', '/internal/payments/deal-requests');
        config()->set('services.ol.payment_review_decision_path', '/internal/payments/review-decision');

        $this->setFeatureFlag('packages.online-payment', true);
    }

    protected function tearDown(): void
    {
        $this->resetSchema();

        parent::tearDown();
    }

    public function test_create_persists_checkout_url_and_external_reference(): void
    {
        Http::fake([
            'https://ol.test/v1/internal/payments/deal-requests' => Http::response([
                'data' => [
                    'paymentId' => '501',
                    'status' => 'pending',
                    'checkoutUrl' => 'https://checkout.test/pay/501',
                    'expiresAt' => '2026-09-01T00:00:00.000Z',
                    'amount' => 2500,
                ],
            ], 201),
        ]);

        $deal = $this->makeDeal();
        $user = $this->makeUser();

        $result = app(DealPaymentService::class)->createForDeal($deal, $user, [
            'currency' => 'EUR',
            'provider_key' => 'manual-bank-transfer',
        ]);

        $this->assertSame('501', $result['payment_id']);
        $this->assertSame('https://checkout.test/pay/501', $result['checkout_url']);
        $this->assertSame('pending_payment', $result['ui_state']);

        $this->assertDatabaseHas('payments', [
            'deal_id' => $this->dealId,
            'external_reference' => '501',
            'checkout_url' => 'https://checkout.test/pay/501',
            'ol_status' => 'pending',
            'ol_payment_type' => 'manual',
            'currency_id' => $this->currencyId,
            'default_currency_id' => $this->currencyId,
            'base_amount' => 2500,
        ]);
    }

    public function test_create_converts_deal_value_into_the_selected_currency(): void
    {
        Http::fake([
            'https://api.frankfurter.app/*' => Http::response(['rates' => ['USD' => 1.1]], 200),
            'https://ol.test/v1/internal/payments/deal-requests' => Http::response([
                'data' => [
                    'paymentId' => '520',
                    'status' => 'pending',
                    'checkoutUrl' => 'https://checkout.test/pay/520',
                ],
            ], 201),
        ]);

        $result = app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), [
            'currency' => 'usd',
        ]);

        // Deal value 2500 (company currency, EUR) at 1 EUR = 1.1 USD.
        Http::assertSent(fn ($request) => $request->url() === 'https://ol.test/v1/internal/payments/deal-requests'
            && (float) $request['amount'] === 2750.0
            && $request['currency'] === 'USD');

        $payment = Payment::withoutGlobalScope(CompanyScope::class)->where('external_reference', '520')->firstOrFail();
        $this->assertSame($this->usdCurrencyId, (int) $payment->currency_id);
        $this->assertSame($this->currencyId, (int) $payment->default_currency_id);
        $this->assertEqualsWithDelta(1 / 1.1, (float) $payment->exchange_rate, 0.000001);
        $this->assertEquals(2500, (float) $payment->base_amount);
        $this->assertEquals(2750, (float) $payment->amount);

        $this->assertSame('USD', $result['currency']);
        $this->assertSame('EUR', $result['base_currency']);
        $this->assertEqualsWithDelta(1.1, $result['rate'], 0.000001);
    }

    public function test_create_is_refused_when_no_live_rate_is_available(): void
    {
        Http::fake([
            'https://api.frankfurter.app/*' => Http::response('down', 503),
            'https://ol.test/*' => Http::response([], 500),
        ]);

        try {
            app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), ['currency' => 'USD']);
            $this->fail('Expected the request to be refused.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
        }

        Http::assertNotSent(fn ($request) => str_starts_with($request->url(), 'https://ol.test/'));
    }

    public function test_create_is_refused_for_a_currency_the_company_does_not_have(): void
    {
        Http::fake();

        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);

        app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), ['currency' => 'GBP']);
    }

    public function test_create_is_refused_while_an_active_request_exists(): void
    {
        $this->insertPayment(['external_reference' => '530', 'ol_status' => 'pending']);
        Http::fake();

        try {
            app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), ['currency' => 'EUR']);
            $this->fail('Expected a conflict.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(409, $e->getStatusCode());
        }
    }

    public function test_a_new_request_can_be_created_once_the_previous_one_was_invalidated(): void
    {
        $this->insertPayment(['external_reference' => '531', 'ol_status' => 'cancelled', 'status' => 'failed']);

        Http::fake([
            'https://ol.test/v1/internal/payments/deal-requests' => Http::response([
                'data' => ['paymentId' => '532', 'status' => 'pending', 'checkoutUrl' => 'https://checkout.test/pay/532'],
            ], 201),
            'https://ol.test/v1/internal/payments/deal-requests/532' => Http::response([
                'data' => ['paymentId' => '532', 'status' => 'pending'],
            ], 200),
        ]);

        $result = app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), ['currency' => 'EUR']);

        $this->assertSame('532', $result['payment_id']);

        $state = app(DealPaymentService::class)->getForDeal($this->makeDeal());
        $this->assertSame('532', $state['active']['payment_id']);
        $this->assertCount(2, $state['requests']);
        $this->assertSame('invalidated', $state['requests'][1]['ui_state']);
    }

    public function test_invalidate_cancels_at_ol_then_marks_the_request_invalidated(): void
    {
        $paymentId = $this->insertPayment(['external_reference' => '540', 'ol_status' => 'pending', 'ol_payment_type' => 'manual']);

        Http::fake([
            'https://ol.test/v1/internal/payments/deal-requests/540/cancel' => Http::response([
                'data' => ['id' => 540, 'status' => 'cancelled'],
            ], 200),
        ]);

        $user = $this->makeUser();
        $result = app(DealPaymentService::class)->invalidatePending($this->makeDeal(), $user, 'Deal value changed');

        Http::assertSent(fn ($request) => $request->url() === 'https://ol.test/v1/internal/payments/deal-requests/540/cancel'
            && $request['reason'] === 'Deal value changed'
            && $request['cancelled_by']['id'] === $user->id);

        $this->assertSame('invalidated', $result['ui_state']);

        $payment = Payment::withoutGlobalScope(CompanyScope::class)->find($paymentId);
        $this->assertSame('cancelled', $payment->ol_status);
        $this->assertSame('failed', $payment->status);
        $this->assertNotNull($payment->invalidated_at);
        $this->assertSame($user->id, (int) $payment->invalidated_by_user_id);
    }

    public function test_invalidate_leaves_the_request_untouched_when_ol_is_unreachable(): void
    {
        $paymentId = $this->insertPayment(['external_reference' => '541', 'ol_status' => 'pending']);

        Http::fake([
            'https://ol.test/*' => Http::response(['message' => 'boom'], 500),
        ]);

        try {
            app(DealPaymentService::class)->invalidatePending($this->makeDeal(), $this->makeUser(), 'Deal value changed');
            $this->fail('Expected the OL failure to propagate.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(500, $e->getStatusCode());
        }

        $payment = Payment::withoutGlobalScope(CompanyScope::class)->find($paymentId);
        $this->assertSame('pending', $payment->ol_status);
        $this->assertNull($payment->invalidated_at);
    }

    public function test_invalidate_refuses_once_the_client_has_started_paying(): void
    {
        $this->insertPayment(['external_reference' => '542', 'ol_status' => 'confirming', 'ol_payment_type' => 'manual']);
        Http::fake();

        try {
            app(DealPaymentService::class)->invalidatePending($this->makeDeal(), $this->makeUser(), 'Deal value changed');
            $this->fail('Expected a conflict.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(409, $e->getStatusCode());
        }

        Http::assertNothingSent();
    }

    public function test_value_guard_requires_confirmation_for_an_unpaid_request(): void
    {
        $this->insertPayment(['external_reference' => '550', 'ol_status' => 'pending']);
        Http::fake();

        $block = app(DealPaymentValueGuard::class)->check($this->makeDeal(), true, false, $this->makeUser());

        $this->assertSame(409, $block['status']);
        $this->assertSame(DealPaymentValueGuard::CODE_INVALIDATION_REQUIRED, $block['code']);
        Http::assertNothingSent();
    }

    public function test_value_guard_invalidates_once_confirmed(): void
    {
        $this->insertPayment(['external_reference' => '551', 'ol_status' => 'pending']);
        Http::fake([
            'https://ol.test/v1/internal/payments/deal-requests/551/cancel' => Http::response(['data' => ['status' => 'cancelled']], 200),
        ]);

        $block = app(DealPaymentValueGuard::class)->check($this->makeDeal(), true, true, $this->makeUser());

        $this->assertNull($block);
        $this->assertNull(app(DealPaymentService::class)->findActiveRequest($this->makeDeal()));
    }

    public function test_value_guard_freezes_the_value_once_payment_is_under_way(): void
    {
        foreach ([
            ['ol_status' => 'confirming', 'ol_payment_type' => 'manual'],
            ['ol_status' => 'confirming', 'ol_payment_type' => 'crypto'],
            ['ol_status' => 'completed', 'ol_payment_type' => 'crypto'],
        ] as $index => $state) {
            DB::table('payments')->delete();
            $this->insertPayment(['external_reference' => (string) (560 + $index)] + $state);
            Http::fake();

            $block = app(DealPaymentValueGuard::class)->check($this->makeDeal(), true, true, $this->makeUser());

            $this->assertSame(403, $block['status'], "state {$state['ol_status']}/{$state['ol_payment_type']}");
            $this->assertSame(DealPaymentValueGuard::CODE_LOCKED, $block['code']);
        }
    }

    public function test_value_guard_ignores_writes_that_do_not_touch_the_value(): void
    {
        $this->insertPayment(['external_reference' => '570', 'ol_status' => 'pending']);

        $this->assertNull(app(DealPaymentValueGuard::class)->check($this->makeDeal(), false, false, $this->makeUser()));
    }

    public function test_has_paid_request_only_for_completed_requests(): void
    {
        $service = app(DealPaymentService::class);

        $this->insertPayment(['external_reference' => '580', 'ol_status' => 'pending']);
        $this->assertFalse($service->hasPaidRequest($this->makeDeal()));

        $this->insertPayment(['external_reference' => '581', 'ol_status' => 'completed', 'ol_payment_type' => 'crypto']);
        $this->assertTrue($service->hasPaidRequest($this->makeDeal()));
    }

    public function test_create_omits_provider_key_when_not_supplied(): void
    {
        Http::fake([
            'https://ol.test/v1/internal/payments/deal-requests' => Http::response([
                'data' => [
                    'paymentId' => '510',
                    'status' => 'pending',
                    'checkoutUrl' => 'https://checkout.test/pay/510',
                    'amount' => 1000,
                ],
            ], 201),
        ]);

        $deal = $this->makeDeal();
        $user = $this->makeUser();

        $result = app(DealPaymentService::class)->createForDeal($deal, $user, [
            'currency' => 'EUR',
        ]);

        Http::assertSent(function ($request) {
            $data = $request->data();

            return $request->url() === 'https://ol.test/v1/internal/payments/deal-requests'
                && !array_key_exists('provider_key', $data);
        });

        $this->assertSame('510', $result['payment_id']);
        $this->assertSame('https://checkout.test/pay/510', $result['checkout_url']);
    }

    public function test_create_sends_deal_snapshot_matching_webhook_entity_data(): void
    {
        Http::fake([
            'https://ol.test/v1/internal/payments/deal-requests' => Http::response([
                'data' => [
                    'paymentId' => '511',
                    'status' => 'pending',
                    'checkoutUrl' => 'https://checkout.test/pay/511',
                    'amount' => 1000,
                ],
            ], 201),
        ]);

        $deal = $this->makeDeal();
        $user = $this->makeUser();

        app(DealPaymentService::class)->createForDeal($deal, $user, [
            'currency' => 'EUR',
        ]);

        $expectedEntityData = app(OlPayloadMapper::class)->mapDealEntityData($deal->fresh());

        Http::assertSent(function ($request) use ($deal, $expectedEntityData) {
            $snapshot = $request->data()['deal'] ?? null;

            return is_array($snapshot)
                && $snapshot['title'] === $expectedEntityData['title']
                && $snapshot['assignedTo'] === $expectedEntityData['assignedTo']
                && ($snapshot['occurredAt'] ?? null) === $deal->fresh()->updated_at->toIso8601String();
        });
    }

    public function test_get_merges_local_checkout_url_with_ol_pull_status(): void
    {
        $paymentId = $this->insertPayment([
            'external_reference' => '502',
            'checkout_url' => 'https://checkout.test/pay/502',
            'ol_status' => 'pending',
            'ol_payment_type' => 'manual',
        ]);

        Http::fake([
            'https://ol.test/v1/internal/payments/deal-requests/502' => Http::response([
                'data' => [
                    'paymentId' => '502',
                    'status' => 'confirming',
                    'paymentType' => 'manual',
                ],
            ], 200),
        ]);

        $result = app(DealPaymentService::class)->getForDeal($this->makeDeal())['active'];

        $this->assertSame('https://checkout.test/pay/502', $result['checkout_url']);
        $this->assertSame('bank_transfer_pending', $result['ui_state']);
        $this->assertTrue($result['can_confirm']);

        $this->assertSame(
            'confirming',
            Payment::withoutGlobalScope(CompanyScope::class)->find($paymentId)?->ol_status
        );
    }

    public function test_confirm_calls_review_decision_and_updates_local_state(): void
    {
        $this->insertPayment([
            'external_reference' => '503',
            'ol_status' => 'confirming',
            'ol_payment_type' => 'manual',
            'status' => 'pending',
        ]);

        Http::fake([
            'https://ol.test/v1/internal/payments/review-decision' => Http::response(['success' => true], 200),
            'https://ol.test/v1/internal/payments/deal-requests/503' => Http::response([
                'data' => [
                    'paymentId' => '503',
                    'status' => 'completed',
                    'paymentType' => 'manual',
                    'verifiedByUserId' => 99,
                    'verifiedAt' => '2026-08-27T09:00:00.000Z',
                ],
            ], 200),
        ]);

        $this->expectDealWon();

        $user = $this->makeUser();
        $result = app(DealPaymentService::class)->confirmBankTransfer($this->makeDeal(), $user);

        Http::assertSent(function ($request) use ($user) {
            return $request->url() === 'https://ol.test/v1/internal/payments/review-decision'
                && ($request['external_reference'] ?? null) === '503'
                && ($request['decision'] ?? null) === 'approved'
                && ($request['decided_by']['id'] ?? null) === $user->id;
        });

        $this->assertSame('confirmed', $result['ui_state']);
        $this->assertSame(99, $result['verified_by_user_id']);
    }

    public function test_confirm_rejects_non_bank_transfer_pending_state(): void
    {
        $this->insertPayment([
            'external_reference' => '504',
            'ol_status' => 'completed',
            'ol_payment_type' => 'manual',
            'verified_by_user_id' => 1,
            'verified_at' => now(),
            'status' => 'complete',
        ]);

        Http::fake();

        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);
        $this->expectExceptionMessage('cannot be confirmed');

        app(DealPaymentService::class)->confirmBankTransfer($this->makeDeal(), $this->makeUser());
    }

    public function test_ui_state_mapper_maps_expected_states(): void
    {
        $this->assertSame('pending_payment', DealPaymentUiStateMapper::map('pending', 'manual', null, null)['ui_state']);
        $this->assertSame('bank_transfer_pending', DealPaymentUiStateMapper::map('confirming', 'manual', null, null)['ui_state']);
        $this->assertSame('processing_online', DealPaymentUiStateMapper::map('confirming', 'crypto', null, null)['ui_state']);
        $this->assertSame('confirmed', DealPaymentUiStateMapper::map('completed', 'manual', 1, now()->toIso8601String())['ui_state']);
        $this->assertSame('paid_online', DealPaymentUiStateMapper::map('completed', 'crypto', null, null)['ui_state']);
        $this->assertSame('failed', DealPaymentUiStateMapper::map('expired', 'manual', null, null)['ui_state']);
        $this->assertSame('invalidated', DealPaymentUiStateMapper::map('cancelled', 'manual', null, null)['ui_state']);
    }

    public function test_confirmed_payment_wins_a_lost_deal(): void
    {
        DB::table('deals')->where('id', $this->dealId)->update(['outcome_status' => OutcomeStatus::Lost->value]);
        $payment = Payment::withoutGlobalScope(CompanyScope::class)->findOrFail(
            $this->insertPayment(['external_reference' => '590', 'ol_status' => 'completed', 'status' => 'complete'])
        );

        $this->expectDealWon();

        app(DealPaymentService::class)->markConfirmed($payment);
    }

    public function test_mark_confirmed_leaves_an_already_won_deal_alone(): void
    {
        DB::table('deals')->where('id', $this->dealId)->update(['outcome_status' => OutcomeStatus::Won->value]);
        $payment = Payment::withoutGlobalScope(CompanyScope::class)->findOrFail(
            $this->insertPayment(['external_reference' => '591', 'ol_status' => 'completed', 'status' => 'complete'])
        );

        $this->mock(DealOutcomeService::class, fn ($mock) => $mock->shouldNotReceive('apply'));

        app(DealPaymentService::class)->markConfirmed($payment);
    }

    public function test_ol_completion_push_wins_the_deal_once(): void
    {
        $this->insertPayment(['external_reference' => '592', 'ol_status' => 'confirming', 'status' => 'pending']);
        Http::fake();

        $this->expectDealWon();

        $push = [
            'deal_id' => $this->dealId,
            'external_reference' => '592',
            'amount' => 100,
            'currency_id' => $this->currencyId,
            'status' => 'complete',
            'gateway' => 'nowpayments',
        ];

        app(CrmWriteService::class)->upsertPayment($this->companyId, $push);
        // A redelivered push for an already-complete payment doesn't re-win.
        app(CrmWriteService::class)->upsertPayment($this->companyId, $push);
    }

    /** DealOutcomeService is mocked: the real Won path (observer, commission job) is covered elsewhere. */
    private function expectDealWon(): void
    {
        $this->mock(DealOutcomeService::class, fn ($mock) => $mock->shouldReceive('apply')
            ->once()
            ->with(
                Mockery::on(fn ($deal) => $deal instanceof Deal && $deal->id === $this->dealId),
                OutcomeStatus::Won,
                Mockery::type('string'),
            )
            ->andReturn(['changed' => true]));
    }

    public function test_write_back_upsert_preserves_checkout_url(): void
    {
        $this->insertPayment([
            'external_reference' => '505',
            'checkout_url' => 'https://checkout.test/pay/505',
            'expires_at' => now()->addDay(),
            'ol_status' => 'pending',
            'ol_payment_type' => 'manual',
        ]);

        Http::fake([
            'https://proof.test/receipt.pdf' => Http::response('%PDF-1.4 proof', 200, [
                'Content-Type' => 'application/pdf',
            ]),
        ]);

        app(CrmWriteService::class)->upsertPayment($this->companyId, [
            'deal_id' => $this->dealId,
            'external_reference' => '505',
            'amount' => 1500,
            'currency' => 'USD',
            'currency_id' => $this->currencyId,
            'status' => 'proof_submitted',
            'gateway' => 'manual-bank-transfer',
            'proof_url' => 'https://proof.test/receipt.pdf',
        ]);

        $payment = Payment::withoutGlobalScope(CompanyScope::class)
            ->where('external_reference', '505')
            ->first();

        $this->assertSame('https://checkout.test/pay/505', $payment?->checkout_url);
        $this->assertSame('confirming', $payment?->ol_status);
        $this->assertSame('manual', $payment?->ol_payment_type);
        $this->assertNotNull($payment?->bill);
    }

    private function makeDeal(): Deal
    {
        return Deal::withoutGlobalScope(CompanyScope::class)->findOrFail($this->dealId);
    }

    private function makeUser(): User
    {
        $user = new User();
        $user->forceFill([
            'id' => 99,
            'name' => 'Review Admin',
            'email' => 'admin@example.com',
            'company_id' => $this->companyId,
        ]);

        return $user;
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function insertPayment(array $overrides): int
    {
        return (int) DB::table('payments')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'deal_id' => $this->dealId,
            'amount' => 100,
            'gateway' => 'manual-bank-transfer',
            'transaction_id' => null,
            'external_reference' => null,
            'checkout_url' => null,
            'expires_at' => null,
            'ol_status' => null,
            'ol_payment_type' => null,
            'verified_by_user_id' => null,
            'verified_at' => null,
            'currency_id' => $this->currencyId,
            'status' => 'pending',
            'paid_on' => null,
            'bill' => null,
            'added_by' => null,
            'last_updated_by' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('deals');
        Schema::dropIfExists('currencies');
        Schema::dropIfExists('companies');
        Schema::dropIfExists('users');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->unsignedInteger('currency_id')->nullable();
            $table->timestamps();
        });

        Schema::create('currencies', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('currency_code', 10);
            $table->string('currency_symbol', 10)->nullable();
            $table->decimal('exchange_rate', 16, 4)->default(1);
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('currency_id')->nullable();
            $table->string('name')->nullable();
            $table->double('value', 30, 2)->default(0);
            $table->string('outcome_status')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('deal_id')->nullable();
            $table->double('amount', 30, 2)->nullable();
            $table->string('gateway')->nullable();
            $table->string('transaction_id')->nullable();
            $table->string('external_reference')->nullable();
            $table->string('checkout_url', 2048)->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->string('status')->default('pending');
            $table->string('ol_status', 64)->nullable();
            $table->string('ol_payment_type', 32)->nullable();
            $table->unsignedBigInteger('verified_by_user_id')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('invalidated_at')->nullable();
            $table->unsignedBigInteger('invalidated_by_user_id')->nullable();
            $table->string('invalidation_reason')->nullable();
            $table->decimal('base_amount', 16, 2)->nullable();
            $table->unsignedInteger('currency_id')->nullable();
            $table->unsignedInteger('default_currency_id')->nullable();
            $table->double('exchange_rate')->nullable();
            $table->dateTime('paid_on')->nullable();
            $table->string('bill')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->timestamps();
        });
    }

    private function seedBaseData(): void
    {
        DB::table('companies')->insert([
            'id' => $this->companyId,
            'company_name' => 'Test Co',
            'currency_id' => $this->currencyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('currencies')->insert([
            'id' => $this->currencyId,
            'company_id' => $this->companyId,
            'currency_code' => 'EUR',
            'currency_symbol' => '€',
            'exchange_rate' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('currencies')->insert([
            'id' => $this->usdCurrencyId,
            'company_id' => $this->companyId,
            'currency_code' => 'USD',
            'currency_symbol' => '$',
            'exchange_rate' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('deals')->insert([
            'id' => $this->dealId,
            'company_id' => $this->companyId,
            'currency_id' => $this->currencyId,
            'name' => 'Test Deal',
            'value' => 2500,
            'added_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
