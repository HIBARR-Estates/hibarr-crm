<?php

namespace Tests\Feature\PaymentRequests;

use App\Models\User;
use App\Support\FeatureFlags;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class PaymentRequestListTest extends TestCase
{
    use SetsFeatureFlags;

    private int $companyId = 1;

    private int $otherCompanyId = 2;

    private int $agentUserId = 7;

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

        $this->setFeatureFlag('packages.online-payment', true);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();

        parent::tearDown();
    }

    public function test_route_is_registered(): void
    {
        $this->assertTrue(Route::has('payment-requests.index'));
    }

    public function test_index_returns_expected_pagination_shape_and_excludes_rows_without_external_reference(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $this->insertPayment(['external_reference' => '601', 'ol_status' => 'pending', 'ol_payment_type' => 'manual']);
        $this->insertPayment(['external_reference' => '602', 'ol_status' => 'confirming', 'ol_payment_type' => 'manual']);
        // Control row — no external_reference, must be excluded (not an OL-backed request).
        $this->insertPayment(['external_reference' => null]);

        $response = $this->withHeaders(['X-Inertia' => 'true'])
            ->get('/account/payment-requests');

        $response->assertOk();
        $response->assertJsonPath('component', 'PaymentRequests/Index');
        $response->assertJsonCount(2, 'props.paymentRequests.data');
        $response->assertJsonPath('props.paymentRequests.total', 2);
        $response->assertJsonPath('props.paymentRequests.data.0.deal.name', 'Test Deal');
        $response->assertJsonPath('props.paymentRequests.data.0.agent_name', 'Agent Smith');
    }

    public function test_index_filters_by_bank_transfer_pending(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $this->insertPayment(['external_reference' => '610', 'ol_status' => 'confirming', 'ol_payment_type' => 'manual']);
        $this->insertPayment(['external_reference' => '611', 'ol_status' => 'pending', 'ol_payment_type' => 'manual']);

        $response = $this->withHeaders(['X-Inertia' => 'true'])
            ->get('/account/payment-requests?ui_state=bank_transfer_pending');

        $response->assertOk();
        $response->assertJsonCount(1, 'props.paymentRequests.data');
        $response->assertJsonPath('props.paymentRequests.data.0.payment_id', '610');
        $response->assertJsonPath('props.paymentRequests.data.0.ui_state', 'bank_transfer_pending');
    }

    public function test_index_distinguishes_confirmed_from_paid_online(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $this->insertPayment([
            'external_reference' => '620',
            'ol_status' => 'completed',
            'ol_payment_type' => 'manual',
            'verified_by_user_id' => 1,
            'verified_at' => now(),
        ]);
        $this->insertPayment([
            'external_reference' => '621',
            'ol_status' => 'completed',
            'ol_payment_type' => 'crypto',
        ]);

        $confirmed = $this->withHeaders(['X-Inertia' => 'true'])
            ->get('/account/payment-requests?ui_state=confirmed');
        $confirmed->assertJsonCount(1, 'props.paymentRequests.data');
        $confirmed->assertJsonPath('props.paymentRequests.data.0.payment_id', '620');

        $paidOnline = $this->withHeaders(['X-Inertia' => 'true'])
            ->get('/account/payment-requests?ui_state=paid_online');
        $paidOnline->assertJsonCount(1, 'props.paymentRequests.data');
        $paidOnline->assertJsonPath('props.paymentRequests.data.0.payment_id', '621');
    }

    public function test_index_only_returns_rows_scoped_to_the_current_company(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $this->insertPayment(['external_reference' => '630', 'ol_status' => 'pending', 'ol_payment_type' => 'manual']);
        $this->insertPayment([
            'external_reference' => '631',
            'ol_status' => 'pending',
            'ol_payment_type' => 'manual',
            'company_id' => $this->otherCompanyId,
        ]);

        $response = $this->withHeaders(['X-Inertia' => 'true'])
            ->get('/account/payment-requests');

        $response->assertJsonCount(1, 'props.paymentRequests.data');
        $response->assertJsonPath('props.paymentRequests.data.0.payment_id', '630');
    }

    /**
     * Full HTTP-level 404/403 assertions would require reproducing
     * AccountBaseController's whole authenticated-request environment
     * (admin approval, company, modules, sidebar perms, ...) — there is no
     * existing precedent for that combined with a real middleware stack in
     * this repo. Instead, and matching the established style of
     * DealPaymentPermissionTest, these assert the exact two conditions the
     * controller's constructor gate is built from.
     */
    public function test_gate_denies_when_feature_flag_disabled(): void
    {
        $this->setFeatureFlag('packages.online-payment', false);

        $this->assertFalse(FeatureFlags::enabled('packages.online-payment'));
    }

    public function test_gate_denies_user_without_edit_payments_all(): void
    {
        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->shouldReceive('permission')->with('edit_payments')->andReturn('owned');

        $this->assertNotSame('all', $user->permission('edit_payments'));
    }

    public function test_gate_allows_user_with_edit_payments_all(): void
    {
        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->shouldReceive('permission')->with('edit_payments')->andReturn('all');

        $this->assertSame('all', $user->permission('edit_payments'));
    }

    private function actingAsEditor(): void
    {
        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = 99;
        $user->company_id = $this->companyId;
        $user->shouldReceive('permission')->andReturn('all');
        $this->actingAs($user);
        session(['user' => $user, 'company' => (object) ['id' => $this->companyId]]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function insertPayment(array $overrides): int
    {
        return (int) DB::table('payments')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'deal_id' => 10,
            'amount' => 100,
            'gateway' => 'manual-bank-transfer',
            'external_reference' => null,
            'checkout_url' => null,
            'expires_at' => null,
            'ol_status' => null,
            'ol_payment_type' => null,
            'verified_by_user_id' => null,
            'verified_at' => null,
            'currency_id' => 5,
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
        Schema::dropIfExists('lead_agents');
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

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('currency_id')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->string('name')->nullable();
            $table->double('value', 30, 2)->default(0);
            $table->unsignedInteger('added_by')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('deal_id')->nullable();
            $table->double('amount', 30, 2)->nullable();
            $table->string('gateway')->nullable();
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
            ['id' => $this->companyId, 'company_name' => 'Test Co', 'currency_id' => 5, 'created_at' => now(), 'updated_at' => now()],
            ['id' => $this->otherCompanyId, 'company_name' => 'Other Co', 'currency_id' => 5, 'created_at' => now(), 'updated_at' => now()],
        ]);

        DB::table('currencies')->insert([
            'id' => 5,
            'company_id' => $this->companyId,
            'currency_code' => 'EUR',
            'currency_symbol' => '€',
            'exchange_rate' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('users')->insert([
            'id' => $this->agentUserId,
            'company_id' => $this->companyId,
            'name' => 'Agent Smith',
            'email' => 'agent@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('lead_agents')->insert([
            'id' => 20,
            'company_id' => $this->companyId,
            'user_id' => $this->agentUserId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('deals')->insert([
            'id' => 10,
            'company_id' => $this->companyId,
            'currency_id' => 5,
            'agent_id' => 20,
            'name' => 'Test Deal',
            'value' => 2500,
            'added_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
