<?php

namespace Tests\Feature\ApiV2;

use App\Models\ApiToken;
use App\Models\Payment;
use App\Services\FeatureFlagService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CrmWritePaymentsApiTest extends TestCase
{
    private int $companyId = 1;

    private int $dealId = 10;

    private int $currencyId = 5;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();
        $this->seedBaseData();

        Payment::flushEventListeners();

        Storage::fake(config('filesystems.default', 'local'));

        app(FeatureFlagService::class)->setTestingOverrides([
            'sally.crm-write-client' => true,
        ]);
    }

    protected function tearDown(): void
    {
        app(FeatureFlagService::class)->clearTestingOverrides();
        $this->resetSchema();

        parent::tearDown();
    }

    public function test_upsert_returns_401_when_api_token_missing(): void
    {
        $response = $this->postJson('/api/v2/payments', $this->validPayload(), [
            'X-COMPANY-ID' => (string) $this->companyId,
        ]);

        $response->assertStatus(401);
    }

    public function test_upsert_returns_403_when_token_lacks_payment_scope(): void
    {
        $this->insertApiToken('restricted-token', ['scopes' => ['api.v2.tasks.index']]);

        $response = $this->postJson('/api/v2/payments', $this->validPayload(), $this->authHeaders('restricted-token'));

        $response->assertStatus(403);
    }

    public function test_endpoints_return_404_when_feature_flag_disabled(): void
    {
        app(FeatureFlagService::class)->setTestingOverrides([
            'sally.crm-write-client' => false,
        ]);

        $this->insertApiToken('test-crm-write-token');

        $this->postJson('/api/v2/payments', $this->validPayload(), $this->authHeaders())
            ->assertStatus(404);

        $this->getJson('/api/v2/payments', $this->authHeaders())->assertStatus(404);
        $this->getJson('/api/v2/payments/1', $this->authHeaders())->assertStatus(404);
    }

    public function test_upsert_creates_payment_against_deal(): void
    {
        $this->insertApiToken('test-crm-write-token');

        $response = $this->postJson('/api/v2/payments', $this->validPayload([
            'status' => 'proof_submitted',
        ]), $this->authHeaders());

        $response->assertStatus(201)
            ->assertJsonPath('data.external_reference', 'ol-pay-100')
            ->assertJsonPath('data.deal_id', $this->dealId)
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.gateway', 'manual-bank-transfer')
            ->assertJsonPath('data.currency', 'USD')
            ->assertJsonPath('data.amount', 1500);

        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseHas('payments', [
            'external_reference' => 'ol-pay-100',
            'deal_id' => $this->dealId,
            'status' => 'pending',
            'company_id' => $this->companyId,
        ]);
    }

    public function test_upsert_updates_existing_payment_for_same_external_reference(): void
    {
        $this->insertApiToken('test-crm-write-token');

        $this->postJson('/api/v2/payments', $this->validPayload([
            'status' => 'pending',
            'amount' => 100,
        ]), $this->authHeaders())->assertStatus(201);

        $response = $this->postJson('/api/v2/payments', $this->validPayload([
            'status' => 'approved',
            'amount' => 100,
        ]), $this->authHeaders());

        $response->assertStatus(200)
            ->assertJsonPath('data.status', 'complete')
            ->assertJsonPath('data.external_reference', 'ol-pay-100');

        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseHas('payments', [
            'external_reference' => 'ol-pay-100',
            'status' => 'complete',
        ]);
    }

    public function test_upsert_stores_bill_from_multipart_file(): void
    {
        $this->insertApiToken('test-crm-write-token');

        $file = UploadedFile::fake()->create('receipt.pdf', 100, 'application/pdf');

        $response = $this->post('/api/v2/payments', array_merge($this->validPayload(), [
            'bill' => $file,
        ]), $this->authHeaders());

        $response->assertStatus(201);
        $bill = $response->json('data.bill');
        $this->assertNotEmpty($bill);
        $this->assertDatabaseHas('payments', [
            'external_reference' => 'ol-pay-100',
            'bill' => $bill,
        ]);
    }

    public function test_list_and_get_return_paginated_shape(): void
    {
        $this->insertApiToken('test-crm-write-token');

        $create = $this->postJson('/api/v2/payments', $this->validPayload(), $this->authHeaders());
        $create->assertStatus(201);
        $paymentId = (int) $create->json('data.id');

        $list = $this->getJson('/api/v2/payments?deal_id=' . $this->dealId, $this->authHeaders());
        $list->assertStatus(200)
            ->assertJsonStructure([
                'data',
                'current_page',
                'last_page',
                'per_page',
                'total',
                'from',
                'to',
            ])
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $paymentId);

        $show = $this->getJson('/api/v2/payments/' . $paymentId, $this->authHeaders());
        $show->assertStatus(200)
            ->assertJsonPath('data.id', $paymentId)
            ->assertJsonPath('data.external_reference', 'ol-pay-100');
    }

    public function test_upsert_returns_404_when_deal_does_not_exist(): void
    {
        $this->insertApiToken('test-crm-write-token');

        $response = $this->postJson('/api/v2/payments', $this->validPayload([
            'deal_id' => 99999,
        ]), $this->authHeaders());

        $response->assertStatus(404);
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_upsert_returns_422_when_required_fields_missing(): void
    {
        $this->insertApiToken('test-crm-write-token');

        $response = $this->postJson('/api/v2/payments', [
            'deal_id' => $this->dealId,
        ], $this->authHeaders());

        $response->assertStatus(422);

        $payload = $response->json();
        $errors = $payload['error']['details'] ?? $payload['errors'] ?? [];
        $this->assertNotEmpty($errors, 'Expected validation errors, got: ' . json_encode($payload));
        $this->assertTrue(
            isset($errors['amount'])
            || isset($errors['currency'])
            || isset($errors['status'])
            || isset($errors['external_reference'])
            || isset($errors['gateway']),
            'Expected required-field validation errors, got: ' . json_encode($errors)
        );
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'deal_id' => $this->dealId,
            'external_reference' => 'ol-pay-100',
            'amount' => 1500,
            'currency' => 'USD',
            'status' => 'pending',
            'gateway' => 'manual-bank-transfer',
        ], $overrides);
    }

    /**
     * @return array<string, string>
     */
    private function authHeaders(string $token = 'test-crm-write-token'): array
    {
        return [
            'X-API-TOKEN' => $token,
            'X-COMPANY-ID' => (string) $this->companyId,
        ];
    }

    /**
     * @param  list<string>|array{scopes: list<string>}|null  $permissions
     */
    private function insertApiToken(string $token, mixed $permissions = []): void
    {
        if (!Schema::hasTable('api_tokens')) {
            Schema::create('api_tokens', function (Blueprint $table) {
                $table->id();
                $table->string('token', 64)->unique();
                $table->unsignedInteger('company_id')->nullable();
                $table->string('name');
                $table->json('permissions')->nullable();
                $table->boolean('revoked')->default(false);
                $table->timestamps();
            });
        }

        DB::table('api_tokens')->insert([
            'token' => ApiToken::hashToken($token),
            'name' => 'Test Token',
            'permissions' => json_encode($permissions),
            'revoked' => false,
            'company_id' => $this->companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('file_storage');
        Schema::dropIfExists('file_storage_settings');
        Schema::dropIfExists('deals');
        Schema::dropIfExists('pipeline_stages');
        Schema::dropIfExists('lead_pipelines');
        Schema::dropIfExists('currencies');
        Schema::dropIfExists('api_tokens');
        Schema::dropIfExists('companies');
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
            $table->string('currency_name')->nullable();
            $table->string('currency_symbol')->nullable();
            $table->string('currency_code')->nullable();
            $table->string('currency_position')->nullable();
            $table->integer('no_of_decimal')->default(2);
            $table->string('thousand_separator')->nullable();
            $table->string('decimal_separator')->nullable();
            $table->string('is_cryptocurrency')->default('no');
            $table->timestamps();
        });

        Schema::create('lead_pipelines', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('pipeline_stages', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_pipeline_id')->nullable();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->string('name')->nullable();
            $table->unsignedInteger('lead_pipeline_id')->nullable();
            $table->unsignedInteger('pipeline_stage_id')->nullable();
            $table->decimal('value', 15, 2)->nullable();
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
            $table->unique(['company_id', 'external_reference'], 'payments_company_external_reference_unique');
        });

        Schema::create('file_storage_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->string('filesystem');
            $table->text('auth_keys')->nullable();
            $table->string('status')->default('disabled');
            $table->timestamps();
        });

        Schema::create('file_storage', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('path');
            $table->string('filename');
            $table->string('type', 50)->nullable();
            $table->unsignedInteger('size');
            $table->string('storage_location')->default('local');
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
            'currency_name' => 'US Dollar',
            'currency_symbol' => '$',
            'currency_code' => 'USD',
            'currency_position' => 'left',
            'no_of_decimal' => 2,
            'is_cryptocurrency' => 'no',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('lead_pipelines')->insert([
            'id' => 1,
            'company_id' => $this->companyId,
            'name' => 'Default',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('pipeline_stages')->insert([
            'id' => 1,
            'company_id' => $this->companyId,
            'lead_pipeline_id' => 1,
            'name' => 'New',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('deals')->insert([
            'id' => $this->dealId,
            'company_id' => $this->companyId,
            'name' => 'Package Deal',
            'lead_pipeline_id' => 1,
            'pipeline_stage_id' => 1,
            'value' => 1500,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('file_storage_settings')->insert([
            'filesystem' => 'local',
            'auth_keys' => null,
            'status' => 'enabled',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
