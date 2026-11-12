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
use App\Services\DealPaymentDocumentService;
use App\Services\DealPaymentService;
use App\Services\DealPaymentUiStateMapper;
use App\Services\OlWebhook\OlPayloadMapper;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Symfony\Component\HttpKernel\Exception\HttpException;
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

    public function test_create_uses_the_exchange_rate_the_user_confirmed(): void
    {
        Http::fake([
            'https://api.frankfurter.app/*' => Http::response(['rates' => ['USD' => 9.9]], 200),
            'https://ol.test/v1/internal/payments/deal-requests' => Http::response([
                'data' => [
                    'paymentId' => '521',
                    'status' => 'pending',
                    'checkoutUrl' => 'https://checkout.test/pay/521',
                ],
            ], 201),
        ]);

        $result = app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), [
            'currency' => 'USD',
            'exchange_rate' => 1.25,
        ]);

        // The confirmed rate wins over the live one: 2500 EUR × 1.25 = 3125 USD.
        Http::assertSent(fn ($request) => $request->url() === 'https://ol.test/v1/internal/payments/deal-requests'
            && (float) $request['amount'] === 3125.0
            && $request['currency'] === 'USD');
        Http::assertNotSent(fn ($request) => str_contains($request->url(), 'frankfurter.app'));

        $payment = Payment::withoutGlobalScope(CompanyScope::class)->where('external_reference', '521')->firstOrFail();
        $this->assertEqualsWithDelta(1 / 1.25, (float) $payment->exchange_rate, 0.000001);
        $this->assertEquals(3125.0, (float) $payment->amount);
        $this->assertEquals(2500.0, (float) $payment->base_amount);
        $this->assertEqualsWithDelta(1.25, $result['rate'], 0.000001);
    }

    public function test_create_accepts_a_confirmed_rate_when_the_live_rate_is_down(): void
    {
        Http::fake([
            'https://api.frankfurter.app/*' => Http::response('down', 503),
            'https://ol.test/v1/internal/payments/deal-requests' => Http::response([
                'data' => [
                    'paymentId' => '523',
                    'status' => 'pending',
                    'checkoutUrl' => 'https://checkout.test/pay/523',
                ],
            ], 201),
        ]);

        $result = app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), [
            'currency' => 'USD',
            'exchange_rate' => '1.5',
        ]);

        $this->assertEquals(3750.0, (float) $result['amount']);
        $this->assertEqualsWithDelta(1.5, $result['rate'], 0.000001);
        Http::assertNotSent(fn ($request) => str_contains($request->url(), 'frankfurter.app'));
    }

    public function test_create_ignores_a_custom_rate_when_paying_in_company_currency(): void
    {
        Http::fake([
            'https://ol.test/v1/internal/payments/deal-requests' => Http::response([
                'data' => [
                    'paymentId' => '522',
                    'status' => 'pending',
                    'checkoutUrl' => 'https://checkout.test/pay/522',
                    'amount' => 2500,
                ],
            ], 201),
        ]);

        $result = app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), [
            'currency' => 'EUR',
            'exchange_rate' => 4,
        ]);

        Http::assertSent(fn ($request) => $request->url() === 'https://ol.test/v1/internal/payments/deal-requests'
            && (float) $request['amount'] === 2500.0);
        $this->assertEqualsWithDelta(1.0, $result['rate'], 0.000001);

        $payment = Payment::withoutGlobalScope(CompanyScope::class)->where('external_reference', '522')->firstOrFail();
        $this->assertEquals(1.0, (float) $payment->exchange_rate);
        $this->assertEquals(2500.0, (float) $payment->amount);
    }

    public function test_create_rejects_a_non_positive_exchange_rate(): void
    {
        Http::fake();

        foreach ([0, -2, 'nope'] as $rate) {
            try {
                app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), [
                    'currency' => 'USD',
                    'exchange_rate' => $rate,
                ]);
                $this->fail('Expected a rejection for rate '.var_export($rate, true));
            } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
                $this->assertSame(422, $e->getStatusCode());
            }
        }

        Http::assertNothingSent();
    }

    public function test_create_rejects_an_exchange_rate_that_rounds_the_amount_to_zero(): void
    {
        Http::fake();

        try {
            app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), [
                'currency' => 'USD',
                'exchange_rate' => 0.0000001,
            ]);
            $this->fail('Expected a zero amount to be refused.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            $this->assertStringContainsString('too small', $e->getMessage());
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

    public function test_create_requests_part_of_the_deal_value(): void
    {
        Http::fake([
            'https://ol.test/v1/internal/payments/deal-requests' => Http::response([
                'data' => [
                    'paymentId' => '540',
                    'status' => 'pending',
                    'checkoutUrl' => 'https://checkout.test/pay/540',
                    'amount' => 1000,
                ],
            ], 201),
        ]);

        $result = app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), [
            'currency' => 'EUR',
            'base_amount' => 1000,
        ]);

        Http::assertSent(fn ($request) => $request->url() === 'https://ol.test/v1/internal/payments/deal-requests'
            && (float) $request['amount'] === 1000.0);
        $this->assertEquals(1000.0, (float) $result['base_amount']);
        $this->assertEquals(1000.0, (float) $result['amount']);
    }

    public function test_create_refuses_an_amount_above_the_remaining_deal_value(): void
    {
        Http::fake();

        try {
            app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), [
                'currency' => 'EUR',
                'base_amount' => 3000,
            ]);
            $this->fail('Expected the amount to be refused.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            $this->assertStringContainsString('remaining', $e->getMessage());
        }

        Http::assertNothingSent();
    }

    public function test_create_allows_another_request_after_a_partial_confirmation(): void
    {
        $this->insertPayment([
            'external_reference' => '541',
            'ol_status' => 'completed',
            'ol_payment_type' => 'manual',
            'verified_by_user_id' => 99,
            'verified_at' => now(),
            'status' => 'complete',
            'amount' => 1000,
            'base_amount' => 1000,
            'exchange_rate' => 1,
        ]);

        Http::fake([
            'https://ol.test/v1/internal/payments/deal-requests' => Http::response([
                'data' => [
                    'paymentId' => '542',
                    'status' => 'pending',
                    'checkoutUrl' => 'https://checkout.test/pay/542',
                    'amount' => 1500,
                ],
            ], 201),
        ]);

        $result = app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), [
            'currency' => 'EUR',
        ]);

        Http::assertSent(fn ($request) => $request->url() === 'https://ol.test/v1/internal/payments/deal-requests'
            && (float) $request['amount'] === 1500.0);
        $this->assertEquals(1500.0, (float) $result['base_amount']);
    }

    public function test_create_is_refused_when_confirmed_payments_cover_the_deal(): void
    {
        $this->insertPayment([
            'external_reference' => '543',
            'ol_status' => 'completed',
            'ol_payment_type' => 'crypto',
            'status' => 'complete',
            'amount' => 2500,
            'base_amount' => 2500,
            'exchange_rate' => 1,
        ]);
        Http::fake();

        try {
            app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), ['currency' => 'EUR']);
            $this->fail('Expected a fully covered deal to refuse another request.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
        }

        Http::assertNothingSent();
    }

    public function test_create_cash_request_stays_in_the_crm(): void
    {
        Http::fake();

        $result = app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), [
            'currency' => 'EUR',
            'provider_key' => 'cash',
            'base_amount' => 400,
        ]);

        Http::assertNothingSent();
        $this->assertSame('cash_pending', $result['ui_state']);
        $this->assertTrue($result['can_confirm']);
        $this->assertFalse($result['show_checkout_url']);
        $this->assertNull($result['checkout_url']);
        $this->assertStringStartsWith('cash-', (string) $result['payment_id']);
        $this->assertEquals(400.0, (float) $result['base_amount']);

        $this->assertDatabaseHas('payments', [
            'deal_id' => $this->dealId,
            'gateway' => 'cash',
            'ol_status' => 'pending',
            'ol_payment_type' => 'cash',
            'amount' => 400,
            'base_amount' => 400,
        ]);
    }

    public function test_open_cash_request_blocks_another_until_it_is_confirmed(): void
    {
        $this->insertPayment([
            'external_reference' => 'cash-open',
            'gateway' => 'cash',
            'ol_status' => 'pending',
            'ol_payment_type' => 'cash',
            'amount' => 400,
            'base_amount' => 400,
        ]);
        Http::fake();

        try {
            app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), [
                'currency' => 'EUR',
                'provider_key' => 'cash',
            ]);
            $this->fail('Expected an open cash request to block another.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(409, $e->getStatusCode());
        }

        Http::assertNothingSent();
    }

    public function test_confirm_cash_does_not_call_ol_or_win_the_deal(): void
    {
        $this->insertPayment([
            'external_reference' => 'cash-confirm',
            'gateway' => 'cash',
            'ol_status' => 'pending',
            'ol_payment_type' => 'cash',
            'status' => 'pending',
            'amount' => 400,
            'base_amount' => 400,
        ]);
        Http::fake();

        $result = app(DealPaymentService::class)->confirmBankTransfer($this->makeDeal(), $this->makeUser());

        Http::assertNothingSent();
        $this->assertSame('confirmed', $result['ui_state']);
        $this->assertFalse($result['can_confirm']);
        $this->assertSame(99, $result['verified_by_user_id']);

        $payment = Payment::withoutGlobalScope(CompanyScope::class)
            ->where('external_reference', 'cash-confirm')
            ->firstOrFail();
        $this->assertSame('complete', $payment->status);
        $this->assertSame('completed', $payment->ol_status);
        $this->assertNotNull($payment->paid_on);
        $this->assertNull(DB::table('deals')->where('id', $this->dealId)->value('outcome_status'));
    }

    public function test_confirm_cash_wins_the_deal_when_it_covers_the_value(): void
    {
        $this->insertPayment([
            'external_reference' => 'cash-cover',
            'gateway' => 'cash',
            'ol_status' => 'pending',
            'ol_payment_type' => 'cash',
            'status' => 'pending',
            'amount' => 2500,
            'base_amount' => 2500,
        ]);
        Http::fake();
        $this->expectDealWon();

        $result = app(DealPaymentService::class)->confirmBankTransfer($this->makeDeal(), $this->makeUser());

        $this->assertSame('confirmed', $result['ui_state']);
        Http::assertNothingSent();
    }

    public function test_invalidate_cash_does_not_call_ol(): void
    {
        $this->insertPayment([
            'external_reference' => 'cash-cancel',
            'gateway' => 'cash',
            'ol_status' => 'pending',
            'ol_payment_type' => 'cash',
        ]);
        Http::fake();

        $result = app(DealPaymentService::class)->invalidatePending($this->makeDeal(), $this->makeUser(), 'Deal value changed');

        Http::assertNothingSent();
        $this->assertSame('invalidated', $result['ui_state']);
        $this->assertSame('cancelled', $result['ol_status']);
    }

    public function test_get_for_deal_does_not_refresh_a_cash_request_from_ol(): void
    {
        $this->insertPayment([
            'external_reference' => 'cash-refresh',
            'gateway' => 'cash',
            'ol_status' => 'pending',
            'ol_payment_type' => 'cash',
        ]);
        Http::fake();

        $result = app(DealPaymentService::class)->getForDeal($this->makeDeal());

        Http::assertNothingSent();
        $this->assertSame('cash_pending', $result['active']['ui_state']);
    }

    public function test_create_propagates_ol_api_error_envelope_message(): void
    {
        Http::fake([
            'https://ol.test/v1/internal/payments/deal-requests' => Http::response([
                'success' => false,
                'error' => [
                    'code' => 'PAYMENT_PROVIDER_ERROR',
                    'message' => 'Failed to create payment with NowPayments. Amount below minimum.',
                ],
            ], 502),
        ]);

        try {
            app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), [
                'currency' => 'EUR',
                'provider_key' => 'nowpayments',
            ]);
            $this->fail('Expected OL provider failure to propagate.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(502, $e->getStatusCode());
            $this->assertStringContainsString(
                'Failed to create payment with NowPayments. Amount below minimum.',
                $e->getMessage()
            );
            $this->assertStringNotContainsString('Payment service request failed.', $e->getMessage());
        }
    }

    public function test_create_propagates_ol_joi_validation_field_details(): void
    {
        Http::fake([
            'https://ol.test/v1/internal/payments/deal-requests' => Http::response([
                'message' => 'Validation error.',
                'data' => [
                    'error' => [
                        [
                            'field' => 'amount',
                            'message' => '"amount" must be a positive number',
                        ],
                    ],
                ],
            ], 400),
        ]);

        try {
            app(DealPaymentService::class)->createForDeal($this->makeDeal(), $this->makeUser(), [
                'currency' => 'EUR',
            ]);
            $this->fail('Expected OL validation failure to propagate.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(400, $e->getStatusCode());
            $this->assertStringContainsString('"amount" must be a positive number', $e->getMessage());
            $this->assertStringNotContainsString('Payment service request failed.', $e->getMessage());
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

    public function test_reissue_cancels_an_expired_pending_link_and_creates_another_in_the_same_currency(): void
    {
        $this->insertPayment([
            'external_reference' => '560',
            'ol_status' => 'pending',
            'ol_payment_type' => 'manual',
            'gateway' => 'manual-bank-transfer',
            'checkout_url' => 'https://checkout.test/pay/560',
            'expires_at' => now()->subHour(),
        ]);

        Http::fake([
            'https://ol.test/v1/internal/payments/deal-requests/560/cancel' => Http::response([
                'data' => ['id' => 560, 'status' => 'cancelled'],
            ], 200),
            'https://ol.test/v1/internal/payments/deal-requests' => Http::response([
                'data' => [
                    'paymentId' => '561',
                    'status' => 'pending',
                    'checkoutUrl' => 'https://checkout.test/pay/561',
                    'amount' => 2500,
                ],
            ], 201),
        ]);

        $payment = Payment::withoutGlobalScope(CompanyScope::class)->where('external_reference', '560')->firstOrFail();
        $result = app(DealPaymentService::class)->reissueExpired($this->makeDeal(), $payment, $this->makeUser());

        $this->assertSame('561', $result['payment_id']);
        $this->assertSame('pending_payment', $result['ui_state']);

        Http::assertSent(fn ($request) => $request->url() === 'https://ol.test/v1/internal/payments/deal-requests/560/cancel'
            && $request['reason'] === 'Checkout link expired');
        Http::assertSent(fn ($request) => $request->url() === 'https://ol.test/v1/internal/payments/deal-requests'
            && $request['currency'] === 'EUR'
            && $request['provider_key'] === 'manual-bank-transfer');

        $expired = Payment::withoutGlobalScope(CompanyScope::class)->where('external_reference', '560')->firstOrFail();
        $this->assertSame('cancelled', $expired->ol_status);
        $this->assertNotNull($expired->invalidated_at);
    }

    public function test_reissue_of_an_already_expired_link_creates_a_new_request_without_cancelling(): void
    {
        $this->insertPayment([
            'external_reference' => '570',
            'ol_status' => 'expired',
            'gateway' => 'nowpayments',
            'expires_at' => now()->subDay(),
        ]);

        Http::fake([
            'https://ol.test/v1/internal/payments/deal-requests' => Http::response([
                'data' => [
                    'paymentId' => '571',
                    'status' => 'pending',
                    'checkoutUrl' => 'https://checkout.test/pay/571',
                    'amount' => 2500,
                ],
            ], 201),
        ]);

        $payment = Payment::withoutGlobalScope(CompanyScope::class)->where('external_reference', '570')->firstOrFail();
        $result = app(DealPaymentService::class)->reissueExpired($this->makeDeal(), $payment, $this->makeUser());

        $this->assertSame('571', $result['payment_id']);
        Http::assertNotSent(fn ($request) => str_contains($request->url(), '/cancel'));
        Http::assertSent(fn ($request) => $request->url() === 'https://ol.test/v1/internal/payments/deal-requests'
            && $request['currency'] === 'EUR'
            && $request['provider_key'] === 'nowpayments');
        $this->assertSame('expired', Payment::withoutGlobalScope(CompanyScope::class)->find($payment->id)->ol_status);
    }

    public function test_reissue_is_refused_when_the_link_has_not_expired(): void
    {
        $this->insertPayment([
            'external_reference' => '562',
            'ol_status' => 'pending',
            'expires_at' => now()->addDay(),
        ]);

        $payment = Payment::withoutGlobalScope(CompanyScope::class)->where('external_reference', '562')->firstOrFail();

        try {
            app(DealPaymentService::class)->reissueExpired($this->makeDeal(), $payment, $this->makeUser());
            $this->fail('Expected a live checkout link to be refused.');
        } catch (HttpException $e) {
            $this->assertSame(409, $e->getStatusCode());
        }

        $this->assertSame('pending', Payment::withoutGlobalScope(CompanyScope::class)->find($payment->id)->ol_status);
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

    public function test_invalidate_treats_an_already_cancelled_request_at_ol_as_success(): void
    {
        // Our first cancel committed at OL but the response was lost; the
        // retry hits a 409 (older OL) and OL now reports the payment cancelled.
        $paymentId = $this->insertPayment(['external_reference' => '543', 'ol_status' => 'pending']);

        Http::fake([
            'https://ol.test/v1/internal/payments/deal-requests/543/cancel' => Http::response(['message' => 'no longer pending'], 409),
            'https://ol.test/v1/internal/payments/deal-requests/543' => Http::response([
                'data' => ['paymentId' => '543', 'status' => 'cancelled'],
            ], 200),
        ]);

        $user = $this->makeUser();
        $result = app(DealPaymentService::class)->invalidatePending($this->makeDeal(), $user, 'Deal value changed');

        $this->assertSame('invalidated', $result['ui_state']);

        $payment = Payment::withoutGlobalScope(CompanyScope::class)->find($paymentId);
        $this->assertSame('cancelled', $payment->ol_status);
        $this->assertNotNull($payment->invalidated_at);
        $this->assertSame('Deal value changed', $payment->invalidation_reason);
        $this->assertNull(app(DealPaymentService::class)->findActiveRequest($this->makeDeal()));
    }

    public function test_invalidate_stays_locked_when_ol_refuses_because_the_client_started_paying(): void
    {
        $paymentId = $this->insertPayment(['external_reference' => '544', 'ol_status' => 'pending', 'ol_payment_type' => 'manual']);

        Http::fake([
            'https://ol.test/v1/internal/payments/deal-requests/544/cancel' => Http::response(['message' => 'no longer pending'], 409),
            'https://ol.test/v1/internal/payments/deal-requests/544' => Http::response([
                'data' => ['paymentId' => '544', 'status' => 'confirming', 'paymentType' => 'manual'],
            ], 200),
        ]);

        try {
            app(DealPaymentService::class)->invalidatePending($this->makeDeal(), $this->makeUser(), 'Deal value changed');
            $this->fail('Expected the value to stay locked.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(409, $e->getStatusCode());
        }

        $payment = Payment::withoutGlobalScope(CompanyScope::class)->find($paymentId);
        $this->assertSame('confirming', $payment->ol_status);
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
                && ! array_key_exists('provider_key', $data);
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
        $this->assertNull(DB::table('deals')->where('id', $this->dealId)->value('outcome_status'));
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
        $cash = DealPaymentUiStateMapper::map('pending', 'cash', null, null);
        $this->assertSame('cash_pending', $cash['ui_state']);
        $this->assertTrue($cash['can_confirm']);
        $this->assertFalse($cash['show_checkout_url']);
        $this->assertSame('confirmed', DealPaymentUiStateMapper::map('completed', 'cash', 1, now()->toIso8601String())['ui_state']);
        $this->assertSame('bank_transfer_pending', DealPaymentUiStateMapper::map('confirming', 'manual', null, null)['ui_state']);
        $this->assertTrue(DealPaymentUiStateMapper::map('confirming', 'manual', null, null)['can_confirm']);
        $alreadyVerified = DealPaymentUiStateMapper::map('confirming', 'manual', 1, now()->toIso8601String());
        $this->assertSame('confirmed', $alreadyVerified['ui_state']);
        $this->assertFalse($alreadyVerified['can_confirm']);
        $this->assertSame('processing_online', DealPaymentUiStateMapper::map('confirming', 'crypto', null, null)['ui_state']);
        $this->assertSame('confirmed', DealPaymentUiStateMapper::map('completed', 'manual', 1, now()->toIso8601String())['ui_state']);
        $this->assertSame('paid_online', DealPaymentUiStateMapper::map('completed', 'crypto', null, null)['ui_state']);
        $this->assertSame('failed', DealPaymentUiStateMapper::map('expired', 'manual', null, null)['ui_state']);
        $this->assertSame('invalidated', DealPaymentUiStateMapper::map('cancelled', 'manual', null, null)['ui_state']);
    }

    public function test_confirmed_payment_leaves_a_lost_deal_lost(): void
    {
        DB::table('deals')->where('id', $this->dealId)->update(['outcome_status' => OutcomeStatus::Lost->value]);
        $payment = Payment::withoutGlobalScope(CompanyScope::class)->findOrFail(
            $this->insertPayment(['external_reference' => '590', 'ol_status' => 'completed', 'status' => 'complete'])
        );

        app(DealPaymentService::class)->markConfirmed($payment);

        $this->assertSame(
            OutcomeStatus::Lost->value,
            DB::table('deals')->where('id', $this->dealId)->value('outcome_status')
        );
    }

    public function test_mark_confirmed_wins_when_accepted_payments_equal_the_deal_value(): void
    {
        DB::table('deals')->where('id', $this->dealId)->update(['outcome_status' => OutcomeStatus::Lost->value]);
        $first = Payment::withoutGlobalScope(CompanyScope::class)->findOrFail(
            $this->insertPayment([
                'external_reference' => '593',
                'ol_status' => 'completed',
                'ol_payment_type' => 'manual',
                'verified_by_user_id' => 1,
                'verified_at' => now(),
                'status' => 'complete',
                'amount' => 1000,
                'base_amount' => 1000,
                'exchange_rate' => 1,
            ])
        );

        app(DealPaymentService::class)->markConfirmed($first);
        $this->assertSame(
            OutcomeStatus::Lost->value,
            DB::table('deals')->where('id', $this->dealId)->value('outcome_status')
        );

        $second = Payment::withoutGlobalScope(CompanyScope::class)->findOrFail(
            $this->insertPayment([
                'external_reference' => '594',
                'ol_status' => 'completed',
                'ol_payment_type' => 'cash',
                'verified_by_user_id' => 1,
                'verified_at' => now(),
                'status' => 'complete',
                'amount' => 1500,
                'base_amount' => 1500,
                'exchange_rate' => 1,
            ])
        );

        $this->expectDealWon();
        app(DealPaymentService::class)->markConfirmed($second);
    }

    public function test_mark_confirmed_does_not_win_when_accepted_payments_exceed_the_deal_value(): void
    {
        $payment = Payment::withoutGlobalScope(CompanyScope::class)->findOrFail(
            $this->insertPayment([
                'external_reference' => '596',
                'ol_status' => 'completed',
                'status' => 'complete',
                'amount' => 2600,
                'base_amount' => 2600,
            ])
        );

        $this->mock(DealOutcomeService::class, fn ($mock) => $mock->shouldNotReceive('apply'));

        app(DealPaymentService::class)->markConfirmed($payment);

        $this->assertNull(DB::table('deals')->where('id', $this->dealId)->value('outcome_status'));
    }

    public function test_mark_confirmed_leaves_an_already_won_deal_alone(): void
    {
        DB::table('deals')->where('id', $this->dealId)->update(['outcome_status' => OutcomeStatus::Won->value]);
        $payment = Payment::withoutGlobalScope(CompanyScope::class)->findOrFail(
            $this->insertPayment([
                'external_reference' => '591',
                'ol_status' => 'completed',
                'status' => 'complete',
                'amount' => 2500,
                'base_amount' => 2500,
            ])
        );

        $this->mock(DealOutcomeService::class, fn ($mock) => $mock->shouldNotReceive('apply'));

        app(DealPaymentService::class)->markConfirmed($payment);

        $this->assertSame(
            OutcomeStatus::Won->value,
            DB::table('deals')->where('id', $this->dealId)->value('outcome_status')
        );
    }

    public function test_ol_completion_push_does_not_win_the_deal(): void
    {
        $this->insertPayment(['external_reference' => '592', 'ol_status' => 'confirming', 'status' => 'pending']);
        Http::fake();

        $push = [
            'deal_id' => $this->dealId,
            'external_reference' => '592',
            'amount' => 100,
            'currency_id' => $this->currencyId,
            'status' => 'complete',
            'gateway' => 'nowpayments',
        ];

        app(CrmWriteService::class)->upsertPayment($this->companyId, $push);
        app(CrmWriteService::class)->upsertPayment($this->companyId, $push);

        $this->assertNull(DB::table('deals')->where('id', $this->dealId)->value('outcome_status'));
    }

    public function test_ol_completion_push_wins_once_when_the_amount_covers_the_deal(): void
    {
        $this->insertPayment(['external_reference' => '595', 'ol_status' => 'confirming', 'status' => 'pending']);
        Http::fake();
        $this->expectDealWon();

        $push = [
            'deal_id' => $this->dealId,
            'external_reference' => '595',
            'amount' => 2500,
            'currency_id' => $this->currencyId,
            'status' => 'complete',
            'gateway' => 'nowpayments',
        ];

        app(CrmWriteService::class)->upsertPayment($this->companyId, $push);
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

    public function test_invoice_document_names_the_company_deal_and_amount(): void
    {
        Http::fake(['https://api.frankfurter.app/*' => Http::response(['rates' => ['TRY' => 50]], 200)]);

        $id = $this->insertPayment([
            'external_reference' => '880',
            'ol_status' => 'pending',
            'amount' => 2500,
            'base_amount' => 2500,
            'currency_id' => $this->currencyId,
            'gateway' => 'manual-bank-transfer',
        ]);

        $payment = Payment::withoutGlobalScope(CompanyScope::class)->without(['order'])->findOrFail($id);
        $data = app(DealPaymentDocumentService::class)->viewData($payment, 'invoice');
        $html = view('payment-requests.document', $data)->render();

        $this->assertSame('invoice', $data['kind']);
        $this->assertSame('A 000001', $data['number']);
        $this->assertStringContainsString('Test Co', $html);
        $this->assertStringContainsString('Test Deal', $html);
        $this->assertStringContainsString('2.500,00', $html);
        $this->assertStringContainsString('FATURA', $html);
        // 16% KDV is inside the amount: 2500 / 1.16 = 2155.17, KDV 344.83.
        $this->assertSame('2.155,17', $data['subtotal_display']);
        $this->assertSame('344,83', $data['vat_display']);
        $this->assertSame('Yalnız: İkibinbeşyüz Avro', $data['amount_in_words']);
        $this->assertSame('125.000,00', $data['try_display']['amount']);
    }

    public function test_invoice_and_receipt_pdfs_render(): void
    {
        Http::fake(['https://api.frankfurter.app/*' => Http::response(['rates' => ['TRY' => 50]], 200)]);
        if (getenv('DUMP_PDFS')) {
            DB::table('payment_document_settings')->insert(['company_id' => $this->companyId, 'legal_name' => 'Örnek Emlak Ltd.', 'address' => "Ecevit Cad. 12\nGirne, KKTC", 'tax_office' => 'Girne', 'tax_number' => 'MŞ 23667', 'approval_number' => 'GVD/2026/0412', 'invoice_number_end' => 5000, 'receipt_number_end' => 5000, 'created_at' => now(), 'updated_at' => now()]);
        }
        $service = app(DealPaymentDocumentService::class);
        $id = $this->insertPayment(['external_reference' => '899', 'ol_status' => 'pending', 'amount' => 4350, 'currency_id' => $this->currencyId]);

        $invoice = $service->download(Payment::withoutGlobalScope(CompanyScope::class)->without(['order'])->findOrFail($id), 'invoice');
        $this->assertStringStartsWith('%PDF', $invoice->getContent());

        DB::table('payments')->where('id', $id)->update(['ol_status' => 'completed', 'status' => 'complete', 'paid_on' => now()]);
        $receipt = $service->download(Payment::withoutGlobalScope(CompanyScope::class)->without(['order'])->findOrFail($id), 'receipt');
        $this->assertStringStartsWith('%PDF', $receipt->getContent());
        if (getenv('DUMP_PDFS')) {
            file_put_contents(getenv('DUMP_PDFS').'/inv.pdf', $invoice->getContent());
            file_put_contents(getenv('DUMP_PDFS').'/rec.pdf', $receipt->getContent());
        }
    }

    public function test_tl_equivalent_uses_the_ecb_publication_date_and_the_printed_rate(): void
    {
        Http::fake(['https://api.frankfurter.app/*' => Http::response(['date' => '2026-11-06', 'rates' => ['TRY' => 50.00004]], 200)]);

        $payment = Payment::withoutGlobalScope(CompanyScope::class)->without(['order'])
            ->findOrFail($this->insertPayment(['external_reference' => '885', 'ol_status' => 'pending', 'amount' => 4350, 'currency_id' => $this->currencyId]));
        $data = app(DealPaymentDocumentService::class)->viewData($payment, 'invoice');

        $this->assertSame('06.11.2026', $data['try_display']['date']);
        $this->assertSame('50,0000', $data['try_display']['rate']);
        $this->assertSame('217.500,00', $data['try_display']['amount']);
    }

    public function test_receipt_repeats_the_invoice_kdv_after_the_rate_setting_changes(): void
    {
        Http::fake(['https://api.frankfurter.app/*' => Http::response(['rates' => ['TRY' => 50]], 200)]);

        $id = $this->insertPayment([
            'external_reference' => '886',
            'ol_status' => 'pending',
            'amount' => 2500,
        ]);
        $service = app(DealPaymentDocumentService::class);
        $invoice = $service->viewData(Payment::withoutGlobalScope(CompanyScope::class)->without(['order'])->findOrFail($id), 'invoice');
        $this->assertSame('344,83', $invoice['vat_display']);

        DB::table('payment_document_settings')->where('company_id', $this->companyId)->update(['vat_rate' => 20]);
        DB::table('payments')->where('id', $id)->update(['ol_status' => 'completed', 'status' => 'complete', 'paid_on' => now()->subDays(3)]);

        $payment = Payment::withoutGlobalScope(CompanyScope::class)->without(['order'])->findOrFail($id);
        $receipt = $service->viewData($payment, 'receipt');

        $this->assertSame('344,83', $receipt['vat_display']);
        $this->assertSame('16', $receipt['vat_rate_display']);
        // Printed with the collection date; the row records when it was issued.
        $this->assertSame(now()->subDays(3)->format('d.m.Y'), $receipt['issued_on']);
        $this->assertTrue(DB::table('payment_documents')->where('kind', 'receipt')->value('issued_at') >= now()->subMinute()->toDateTimeString());
    }

    public function test_invoice_numbers_follow_the_range_and_never_change_once_issued(): void
    {
        Http::fake(['https://api.frankfurter.app/*' => Http::response(['rates' => ['TRY' => 50]], 200)]);

        DB::table('payment_document_settings')->insert([
            'company_id' => $this->companyId,
            'legal_name' => 'Örnek Emlak Ltd.',
            'tax_office' => 'Girne',
            'tax_number' => 'MŞ 23667',
            'invoice_series' => 'B',
            'invoice_number_start' => 240,
            'invoice_number_end' => 241,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $service = app(DealPaymentDocumentService::class);
        $first = Payment::withoutGlobalScope(CompanyScope::class)->without(['order'])
            ->findOrFail($this->insertPayment(['external_reference' => '890', 'ol_status' => 'pending', 'amount' => 100]));
        $second = Payment::withoutGlobalScope(CompanyScope::class)->without(['order'])
            ->findOrFail($this->insertPayment(['external_reference' => '891', 'ol_status' => 'pending', 'amount' => 100]));
        $third = Payment::withoutGlobalScope(CompanyScope::class)->without(['order'])
            ->findOrFail($this->insertPayment(['external_reference' => '892', 'ol_status' => 'pending', 'amount' => 100]));

        $this->assertSame('B 000240', $service->viewData($first, 'invoice')['number']);
        $this->assertSame('B 000241', $service->viewData($second, 'invoice')['number']);

        // Settings changes never rewrite an issued invoice.
        DB::table('payment_document_settings')->update(['legal_name' => 'Renamed Ltd.']);
        $again = $service->viewData($first, 'invoice');
        $this->assertSame('B 000240', $again['number']);
        $this->assertSame('Örnek Emlak Ltd.', $again['seller']['legal_name']);

        // The range is used up.
        try {
            $service->viewData($third, 'invoice');
            $this->fail('Expected the used-up range to be refused.');
        } catch (HttpException $e) {
            $this->assertSame(409, $e->getStatusCode());
        }

        $this->assertSame(2, DB::table('payment_documents')->count());
    }

    public function test_settings_preview_shows_the_next_number_without_taking_it(): void
    {
        Http::fake(['https://api.frankfurter.app/*' => Http::response(['rates' => ['TRY' => 56.2]], 200)]);

        $settings = \App\Models\PaymentDocumentSetting::forCompany($this->companyId);
        $this->assertSame('Test Co', $settings->legal_name);

        $data = app(DealPaymentDocumentService::class)->previewData($settings, 'invoice');
        $html = view('payment-requests.document', $data)->render();

        $this->assertSame('A 000001', $data['number']);
        $this->assertSame('Yalnız: Dörtbinüçyüzelli İngiliz Sterlini', $data['amount_in_words']);
        $this->assertStringContainsString('ÖRNEK', $html);
        $this->assertSame(0, DB::table('payment_documents')->count());

        $receipt = app(DealPaymentDocumentService::class)->previewData($settings, 'receipt');
        $this->assertSame("Markus Weber'den", $receipt['payer_ablative']);
    }

    public function test_receipt_is_refused_until_the_payment_is_collected(): void
    {
        $id = $this->insertPayment([
            'external_reference' => '881',
            'ol_status' => 'pending',
        ]);
        $payment = Payment::withoutGlobalScope(CompanyScope::class)->without(['order'])->findOrFail($id);

        try {
            app(DealPaymentDocumentService::class)->viewData($payment, 'receipt');
            $this->fail('Expected a receipt to be refused.');
        } catch (HttpException $e) {
            $this->assertSame(409, $e->getStatusCode());
        }
    }

    public function test_receipt_document_is_available_once_paid_online(): void
    {
        $id = $this->insertPayment([
            'external_reference' => '882',
            'ol_status' => 'completed',
            'ol_payment_type' => 'crypto',
            'status' => 'complete',
            'amount' => 2500,
            'paid_on' => now(),
        ]);

        Http::fake(['https://api.frankfurter.app/*' => Http::response(['rates' => ['TRY' => 50]], 200)]);

        $payment = Payment::withoutGlobalScope(CompanyScope::class)->without(['order'])->findOrFail($id);
        $data = app(DealPaymentDocumentService::class)->viewData($payment, 'receipt');
        $html = view('payment-requests.document', $data)->render();

        $this->assertSame('receipt', $data['kind']);
        $this->assertSame('T 000001', $data['number']);
        // The receipt is issued against the request's invoice.
        $this->assertSame('A 000001', $data['invoice_number']);
        $this->assertStringContainsString('TAHSİLAT MAKBUZU', $html);
        $this->assertStringContainsString('A 000001 no.lu fatura', $html);
        $this->assertNull($data['stamp']);
    }

    private function makeDeal(): Deal
    {
        return Deal::withoutGlobalScope(CompanyScope::class)->findOrFail($this->dealId);
    }

    private function makeUser(): User
    {
        $user = new User;
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
        Schema::dropIfExists('payment_documents');
        Schema::dropIfExists('payment_document_settings');
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

        (require base_path('database/migrations/2026_11_12_000002_create_payment_document_settings_tables.php'))->up();
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
