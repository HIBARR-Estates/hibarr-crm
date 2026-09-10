<?php

namespace Tests\Feature\Api;

use App\Models\ApiToken;
use App\Models\Deal;
use App\Models\Lead;
use App\Services\ApiTokenScopeService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomFieldApiTest extends TestCase
{
    private const TOKEN = 'test-custom-fields-token';

    private const COMPANY_ID = 1;

    private const OTHER_COMPANY_ID = 2;

    private int $dealGroupId;

    private int $leadGroupId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureSchema();
        $this->seedScopedToken(self::COMPANY_ID, ['api.custom-fields.index']);

        $this->dealGroupId = $this->createGroup('Deal', Deal::CUSTOM_FIELD_MODEL);
        $this->leadGroupId = $this->createGroup('Lead', Lead::CUSTOM_FIELD_MODEL);
    }

    public function test_index_without_model_returns_all_company_custom_fields(): void
    {
        $this->createField($this->dealGroupId, ['label' => 'Budget', 'name' => 'budget']);
        $this->createField($this->leadGroupId, ['label' => 'Source', 'name' => 'source']);

        $response = $this->getJson('/api/v1/custom-fields', $this->authHeaders());

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('model', null)
            ->assertJsonPath('total', 2)
            ->assertJsonStructure([
                'status',
                'model',
                'total',
                'data' => [[
                    'model', 'id', 'custom_field_group_id', 'custom_field_group_name', 'module', 'label', 'name', 'type',
                    'values', 'required', 'export', 'visible', 'custom_field_category_id',
                    'category_name', 'display_order',
                ]],
            ]);

        $this->assertEqualsCanonicalizing(['budget', 'source'], collect($response->json('data'))->pluck('name')->all());
        $this->assertArrayNotHasKey('show_rule_set', $response->json('data.0'));
    }

    public function test_index_filters_by_model_name_basename_or_class(): void
    {
        $this->createField($this->dealGroupId, ['label' => 'Budget', 'name' => 'budget']);
        $this->createField($this->leadGroupId, ['label' => 'Source', 'name' => 'source']);

        foreach (['deal', 'Deal', 'App\\Models\\Deal'] as $model) {
            $response = $this->getJson('/api/v1/custom-fields?model=' . urlencode($model), $this->authHeaders());

            $response->assertStatus(200)
                ->assertJsonPath('model', Deal::CUSTOM_FIELD_MODEL)
                ->assertJsonPath('total', 1)
                ->assertJsonPath('data.0.name', 'budget')
                ->assertJsonPath('data.0.custom_field_group_name', 'Deal')
                ->assertJsonPath('data.0.module', 'Deal');
        }
    }

    public function test_index_decodes_option_values_and_includes_category(): void
    {
        $categoryId = DB::table('custom_field_categories')->insertGetId([
            'company_id' => self::COMPANY_ID,
            'custom_field_group_id' => $this->dealGroupId,
            'name' => 'Financials',
        ]);

        $this->createField($this->dealGroupId, [
            'label' => 'Stage',
            'name' => 'stage',
            'type' => 'select',
            'values' => json_encode(['Cold', 'Warm', 'Hot']),
            'custom_field_category_id' => $categoryId,
        ]);

        $response = $this->getJson('/api/v1/custom-fields?model=deal', $this->authHeaders());

        $response->assertStatus(200)
            ->assertJsonPath('data.0.values', ['Cold', 'Warm', 'Hot'])
            ->assertJsonPath('data.0.category_name', 'Financials');
    }

    public function test_index_rejects_unknown_model(): void
    {
        $response = $this->getJson('/api/v1/custom-fields?model=spaceship', $this->authHeaders());

        $response->assertStatus(422)
            ->assertJsonPath('status', 'fail');

        $this->assertContains('Deal', $response->json('allowed_models'));
    }

    public function test_index_scopes_results_to_x_company_id(): void
    {
        $this->createField($this->dealGroupId, ['label' => 'Mine', 'name' => 'mine']);
        $this->createField($this->dealGroupId, ['label' => 'Theirs', 'name' => 'theirs', 'company_id' => self::OTHER_COMPANY_ID]);

        $response = $this->getJson('/api/v1/custom-fields', $this->authHeaders());

        $response->assertStatus(200);
        $this->assertSame(['mine'], collect($response->json('data'))->pluck('name')->all());
    }

    public function test_index_rejects_missing_api_token(): void
    {
        $this->getJson('/api/v1/custom-fields', ['X-COMPANY-ID' => (string) self::COMPANY_ID])
            ->assertStatus(401);
    }

    public function test_index_rejects_token_without_custom_fields_scope(): void
    {
        DB::table('api_tokens')->delete();
        $this->seedScopedToken(self::COMPANY_ID, ['api.leads.index']);

        $this->getJson('/api/v1/custom-fields', $this->authHeaders())
            ->assertStatus(403);
    }

    /**
     * @return array<string, string>
     */
    private function authHeaders(): array
    {
        return [
            'X-API-TOKEN' => self::TOKEN,
            'X-COMPANY-ID' => (string) self::COMPANY_ID,
        ];
    }

    /**
     * @param  list<string>  $scopes
     */
    private function seedScopedToken(int $companyId, array $scopes): void
    {
        DB::table('api_tokens')->insert([
            'token' => ApiToken::hashToken(self::TOKEN),
            'name' => 'Custom Fields Test Token',
            'permissions' => json_encode(ApiTokenScopeService::encodeScopes($scopes)),
            'revoked' => false,
            'company_id' => $companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function createGroup(string $name, string $model): int
    {
        return DB::table('custom_field_groups')->insertGetId([
            'company_id' => self::COMPANY_ID,
            'name' => $name,
            'model' => $model,
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createField(int $groupId, array $overrides = []): int
    {
        return DB::table('custom_fields')->insertGetId(array_merge([
            'company_id' => self::COMPANY_ID,
            'custom_field_group_id' => $groupId,
            'label' => 'Field',
            'name' => 'field',
            'type' => 'text',
            'required' => 'no',
        ], $overrides));
    }

    private function ensureSchema(): void
    {
        Schema::dropIfExists('api_tokens');
        Schema::create('api_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('token', 64)->unique();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->json('permissions')->nullable();
            $table->boolean('revoked')->default(false);
            $table->timestamps();
        });

        Schema::dropIfExists('custom_field_groups');
        Schema::create('custom_field_groups', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('model')->nullable();
        });

        Schema::dropIfExists('custom_field_categories');
        Schema::create('custom_field_categories', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('custom_field_group_id')->nullable();
            $table->string('name');
            $table->unsignedInteger('order')->default(0);
            $table->timestamps();
        });

        Schema::dropIfExists('custom_fields');
        Schema::create('custom_fields', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('custom_field_group_id')->nullable();
            $table->unsignedBigInteger('custom_field_category_id')->nullable();
            $table->unsignedInteger('linked_field_id')->nullable();
            $table->string('label');
            $table->string('name');
            $table->string('type')->default('text');
            $table->string('required')->default('no');
            $table->text('values')->nullable();
            $table->boolean('export')->default(false);
            $table->string('visible')->nullable();
            $table->unsignedInteger('display_order')->default(0);
            $table->json('display_config')->nullable();
            $table->boolean('show_in_lead')->default(false);
            $table->boolean('show_in_deal')->default(true);
        });
    }
}
