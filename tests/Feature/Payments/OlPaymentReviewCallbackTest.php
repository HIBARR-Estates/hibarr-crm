<?php

namespace Tests\Feature\Payments;

use App\Models\Payment;
use App\Models\User;
use App\Scopes\CompanyScope;
use App\Services\OlPaymentReviewDecisionService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class OlPaymentReviewCallbackTest extends TestCase
{
    use SetsFeatureFlags;

    private int $companyId = 1;

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
        config()->set('services.ol.payment_review_decision_path', '/internal/payments/review-decision');

        $this->setFeatureFlag('packages.online-payment', true);
    }

    protected function tearDown(): void
    {
        $this->resetSchema();

        parent::tearDown();
    }

    public function test_it_calls_ol_review_decision_when_approving_ol_origin_payment(): void
    {
        $payment = $this->insertPayment([
            'external_reference' => 'ol-pay-100',
            'gateway' => 'manual-bank-transfer',
            'status' => 'pending',
        ]);
        $admin = $this->makeAdmin();

        $captured = null;
        Http::fake(function ($request) use (&$captured) {
            $captured = $request;

            return Http::response(['success' => true], 200);
        });

        Payment::withoutGlobalScope(CompanyScope::class)
            ->where('id', $payment->id)
            ->update(['status' => 'complete']);

        app(OlPaymentReviewDecisionService::class)->notifyEligibleAfterStatusChange(
            [$payment->id],
            'complete',
            $admin
        );

        Http::assertSent(function ($request) use ($admin) {
            return $request->url() === 'https://ol.test/v1/internal/payments/review-decision'
                && $request->method() === 'POST'
                && $request->hasHeader('X-Api-Key', 'ol-test-key')
                && ($request['external_reference'] ?? null) === 'ol-pay-100'
                && ($request['decision'] ?? null) === 'approved'
                && ($request['decided_by']['id'] ?? null) === $admin->id
                && ($request['decided_by']['email'] ?? null) === $admin->email;
        });

        $this->assertSame(
            'complete',
            Payment::withoutGlobalScope(CompanyScope::class)->find($payment->id)?->status
        );
        $this->assertNotNull($captured);
    }

    public function test_it_calls_ol_review_decision_when_rejecting_ol_origin_payment(): void
    {
        $payment = $this->insertPayment([
            'external_reference' => 'ol-pay-200',
            'gateway' => 'manual-bank-transfer',
            'status' => 'pending',
        ]);
        $admin = $this->makeAdmin();

        Http::fake([
            'https://ol.test/v1/internal/payments/review-decision' => Http::response(['success' => true], 200),
        ]);

        Payment::withoutGlobalScope(CompanyScope::class)
            ->where('id', $payment->id)
            ->update(['status' => 'failed']);

        app(OlPaymentReviewDecisionService::class)->notifyEligibleAfterStatusChange(
            [$payment->id],
            'failed',
            $admin
        );

        Http::assertSent(function ($request) {
            return $request->url() === 'https://ol.test/v1/internal/payments/review-decision'
                && ($request['external_reference'] ?? null) === 'ol-pay-200'
                && ($request['decision'] ?? null) === 'rejected';
        });

        $this->assertSame(
            'failed',
            Payment::withoutGlobalScope(CompanyScope::class)->find($payment->id)?->status
        );
    }

    public function test_it_does_not_call_ol_for_native_crm_payment(): void
    {
        $payment = $this->insertPayment([
            'external_reference' => null,
            'gateway' => 'Offline',
            'status' => 'pending',
        ]);
        $admin = $this->makeAdmin();

        Http::fake();

        Payment::withoutGlobalScope(CompanyScope::class)
            ->where('id', $payment->id)
            ->update(['status' => 'complete']);

        app(OlPaymentReviewDecisionService::class)->notifyEligibleAfterStatusChange(
            [$payment->id],
            'complete',
            $admin
        );

        Http::assertNothingSent();
        $this->assertSame(
            'complete',
            Payment::withoutGlobalScope(CompanyScope::class)->find($payment->id)?->status
        );
    }

    public function test_it_does_not_call_ol_when_feature_flag_is_off(): void
    {
        $this->setFeatureFlag('packages.online-payment', false);

        $payment = $this->insertPayment([
            'external_reference' => 'ol-pay-300',
            'status' => 'pending',
        ]);
        $admin = $this->makeAdmin();

        Http::fake();

        Payment::withoutGlobalScope(CompanyScope::class)
            ->where('id', $payment->id)
            ->update(['status' => 'complete']);

        app(OlPaymentReviewDecisionService::class)->notifyEligibleAfterStatusChange(
            [$payment->id],
            'complete',
            $admin
        );

        Http::assertNothingSent();
        $this->assertSame(
            'complete',
            Payment::withoutGlobalScope(CompanyScope::class)->find($payment->id)?->status
        );
    }

    public function test_it_does_not_call_ol_when_status_is_pending(): void
    {
        $payment = $this->insertPayment([
            'external_reference' => 'ol-pay-400',
            'status' => 'complete',
        ]);
        $admin = $this->makeAdmin();

        Http::fake();

        Payment::withoutGlobalScope(CompanyScope::class)
            ->where('id', $payment->id)
            ->update(['status' => 'pending']);

        app(OlPaymentReviewDecisionService::class)->notifyEligibleAfterStatusChange(
            [$payment->id],
            'pending',
            $admin
        );

        Http::assertNothingSent();
    }

    public function test_it_persists_local_status_and_logs_when_ol_returns_error(): void
    {
        Log::spy();

        $payment = $this->insertPayment([
            'external_reference' => 'ol-pay-500',
            'status' => 'pending',
        ]);
        $admin = $this->makeAdmin();

        Http::fake([
            'https://ol.test/v1/internal/payments/review-decision' => Http::response(['message' => 'down'], 500),
        ]);

        Payment::withoutGlobalScope(CompanyScope::class)
            ->where('id', $payment->id)
            ->update(['status' => 'complete']);

        app(OlPaymentReviewDecisionService::class)->notifyEligibleAfterStatusChange(
            [$payment->id],
            'complete',
            $admin
        );

        $this->assertSame(
            'complete',
            Payment::withoutGlobalScope(CompanyScope::class)->find($payment->id)?->status
        );

        Log::shouldHaveReceived('error')
            ->withArgs(function ($message, $context = []) {
                return str_contains((string) $message, 'OlPaymentReviewDecisionService: OL returned non-2xx')
                    && ($context['external_reference'] ?? null) === 'ol-pay-500'
                    && ($context['decision'] ?? null) === 'approved'
                    && ($context['status'] ?? null) === 500;
            })
            ->atLeast()
            ->once();
    }

    public function test_it_persists_local_status_and_logs_when_ol_request_throws(): void
    {
        Log::spy();

        $payment = $this->insertPayment([
            'external_reference' => 'ol-pay-600',
            'status' => 'pending',
        ]);
        $admin = $this->makeAdmin();

        Http::fake(function () {
            throw new \Illuminate\Http\Client\ConnectionException('OL unreachable');
        });

        Payment::withoutGlobalScope(CompanyScope::class)
            ->where('id', $payment->id)
            ->update(['status' => 'failed']);

        app(OlPaymentReviewDecisionService::class)->notifyEligibleAfterStatusChange(
            [$payment->id],
            'failed',
            $admin
        );

        $this->assertSame(
            'failed',
            Payment::withoutGlobalScope(CompanyScope::class)->find($payment->id)?->status
        );

        Log::shouldHaveReceived('error')
            ->withArgs(function ($message) {
                return str_contains((string) $message, 'OlPaymentReviewDecisionService: OL request failed');
            })
            ->atLeast()
            ->once();
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function insertPayment(array $overrides): Payment
    {
        $id = DB::table('payments')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'deal_id' => null,
            'amount' => 100,
            'gateway' => 'manual-bank-transfer',
            'transaction_id' => null,
            'external_reference' => null,
            'currency_id' => null,
            'status' => 'pending',
            'paid_on' => null,
            'bill' => null,
            'added_by' => null,
            'last_updated_by' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));

        return Payment::withoutGlobalScope(CompanyScope::class)
            ->without(['order', 'currency'])
            ->findOrFail($id);
    }

    private function makeAdmin(): User
    {
        $user = new User();
        $user->forceFill([
            'id' => 99,
            'name' => 'Review Admin',
            'email' => 'admin@example.com',
        ]);

        return $user;
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('companies');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
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
            $table->unsignedInteger('currency_id')->nullable();
            $table->string('status')->default('pending');
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
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
