<?php

namespace Tests\Feature\Deals;

use App\Models\Deal;
use App\Models\Payment;
use App\Models\User;
use App\Scopes\CompanyScope;
use App\Services\ApiV2\CrmWriteService;
use App\Services\DealPaymentService;
use App\Services\DealPaymentUiStateMapper;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class DealPaymentRequestTest extends TestCase
{
    use SetsFeatureFlags;

    private int $companyId = 1;

    private int $dealId = 10;

    private int $currencyId = 5;

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
            'amount' => 2500,
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
        ]);
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

        $result = app(DealPaymentService::class)->getForDeal($this->makeDeal());

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
            $table->unsignedInteger('added_by')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
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
            $table->unsignedInteger('currency_id')->nullable();
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
