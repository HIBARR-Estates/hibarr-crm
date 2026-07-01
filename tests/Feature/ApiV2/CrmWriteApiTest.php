<?php

namespace Tests\Feature\ApiV2;

use App\Services\FeatureFlagService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CrmWriteApiTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureApiTokensTable();

        app(FeatureFlagService::class)->setTestingOverrides([
            'sally.crm-write-client' => true,
        ]);
    }

    protected function tearDown(): void
    {
        app(FeatureFlagService::class)->clearTestingOverrides();

        parent::tearDown();
    }

    public function test_create_task_returns_401_when_api_key_is_missing(): void
    {
        $response = $this->postJson('/api/v2/tasks', [
            'heading' => 'Follow up with client',
            'lead_id' => 1,
        ], [
            'X-COMPANY-ID' => '1',
        ]);

        $response->assertStatus(401);
    }

    public function test_create_task_returns_401_when_api_key_is_invalid(): void
    {
        $response = $this->postJson('/api/v2/tasks', [
            'heading' => 'Follow up with client',
            'lead_id' => 1,
        ], [
            'X-API-TOKEN' => 'invalid-token',
            'X-COMPANY-ID' => '1',
        ]);

        $response->assertStatus(401);
    }

    public function test_create_endpoints_return_404_when_feature_flag_disabled(): void
    {
        app(FeatureFlagService::class)->setTestingOverrides([
            'sally.crm-write-client' => false,
        ]);

        $this->insertApiToken('test-crm-write-token');

        $headers = [
            'X-API-TOKEN' => 'test-crm-write-token',
            'X-COMPANY-ID' => '1',
        ];

        $this->postJson('/api/v2/tasks', ['heading' => 'Test', 'lead_id' => 1], $headers)
            ->assertStatus(404);

        $this->getJson('/api/v2/tasks/1', $headers)->assertStatus(404);

        $this->postJson('/api/v2/notes', ['title' => 'Test', 'details' => 'Body', 'lead_id' => 1], $headers)
            ->assertStatus(404);

        $this->postJson('/api/v2/meetings', [
            'scheduled_at' => now()->addDay()->toIso8601String(),
            'location' => 'office',
            'lead_id' => 1,
        ], $headers)->assertStatus(404);
    }

    public function test_get_note_requires_type_query_parameter(): void
    {
        $this->insertApiToken('test-crm-write-token');

        $response = $this->getJson('/api/v2/notes/1', [
            'X-API-TOKEN' => 'test-crm-write-token',
            'X-COMPANY-ID' => '1',
        ]);

        $response->assertStatus(422);
    }

    public function test_create_task_returns_validation_error_when_targets_missing(): void
    {
        $this->insertApiToken('test-crm-write-token');

        $response = $this->postJson('/api/v2/tasks', [
            'heading' => 'Follow up with client',
        ], [
            'X-API-TOKEN' => 'test-crm-write-token',
            'X-COMPANY-ID' => '1',
        ]);

        $response->assertStatus(422);

        $payload = $response->json();
        $details = $payload['error']['details'] ?? $payload['errors'] ?? [];
        $this->assertArrayHasKey('lead_id', $details);
        $this->assertArrayHasKey('deal_id', $details);
    }

    private function ensureApiTokensTable(): void
    {
        if (Schema::hasTable('api_tokens')) {
            return;
        }

        Schema::create('api_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('token', 64)->unique();
            $table->string('name');
            $table->json('permissions')->nullable();
            $table->boolean('revoked')->default(false);
            $table->unsignedBigInteger('company_id')->nullable();
            $table->timestamps();
        });
    }

    private function insertApiToken(string $token): void
    {
        DB::table('api_tokens')->insert([
            'token' => $token,
            'name' => 'Test Token',
            'permissions' => json_encode([]),
            'revoked' => false,
            'company_id' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
