<?php

namespace Tests\Feature\Api;

use App\Models\ApiToken;
use App\Models\DeveloperProject;
use App\Models\ExposeSnapshot;
use App\Models\Lead;
use App\Models\ProjectLocation;
use App\Models\User;
use App\Services\ApiTokenScopeService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ExposeSnapshotApiTest extends TestCase
{
    private const TOKEN = 'test-expose-snapshot-token';

    private const COMPANY_ID = 1;

    private const OTHER_COMPANY_ID = 2;

    private const OTHER_TOKEN = 'test-expose-snapshot-other-company';

    /** @var list<string> */
    private const ALL_SCOPES = [
        'api.expose-snapshots.create',
        'api.expose-snapshots.show',
        'api.expose-snapshots.index',
        'api.developer-projects.expose',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureSchema();
        $this->seedScopedToken(self::COMPANY_ID, self::TOKEN, self::ALL_SCOPES);
    }

    public function test_mint_requires_agent_and_lead(): void
    {
        $project = $this->createProject(['name' => 'Needs People', 'slug' => 'needs-people']);

        $response = $this->postJson('/api/v1/expose-snapshots', [
            'entity_type' => 'developer_project',
            'entity_id' => $project->id,
        ], $this->authHeaders());

        $response->assertStatus(422)
            ->assertJsonPath('status', 'fail');

        $errors = $response->json('errors');
        $this->assertArrayHasKey('agent_id', $errors);
        $this->assertArrayHasKey('lead_id', $errors);
    }

    public function test_mint_returns_agent_lead_names_and_full_expose(): void
    {
        $project = $this->createProject(['name' => 'Mint Project', 'slug' => 'mint-project']);
        $agent = $this->createAgent(['name' => 'Jane Agent', 'email' => 'jane@hibarr.test']);
        $lead = $this->createLead(['client_name' => 'Ada Lovelace', 'client_email' => 'ada@example.com']);

        $response = $this->postJson('/api/v1/expose-snapshots', [
            'entity_type' => 'developer_project',
            'entity_id' => $project->id,
            'agent_id' => $agent->id,
            'lead_id' => $lead->id,
        ], $this->authHeaders());

        $response->assertStatus(201)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.entity_type', 'developer_project')
            ->assertJsonPath('data.entity_id', $project->id)
            ->assertJsonPath('data.agent_id', $agent->id)
            ->assertJsonPath('data.agent.name', 'Jane Agent')
            ->assertJsonPath('data.lead_id', $lead->id)
            ->assertJsonPath('data.lead.name', 'Ada Lovelace')
            ->assertJsonPath('data.expose.schema_version', 1)
            ->assertJsonPath('data.expose.client.name', 'Ada Lovelace')
            ->assertJsonPath('data.expose.agent.name', 'Jane Agent');

        $token = $response->json('data.token');
        $this->assertIsString($token);
        $this->assertStringStartsWith('exp_', $token);
        $this->assertDatabaseCount('expose_snapshots', 1);
        $this->assertNotSame($token, DB::table('expose_snapshots')->value('token_hash'));
        $this->assertSame(ExposeSnapshot::hashToken($token), DB::table('expose_snapshots')->value('token_hash'));
    }

    public function test_mint_includes_project_location_title_description_and_image(): void
    {
        $location = $this->createLocation([
            'name' => 'lapta',
            'description' => 'Coastal living in Lapta',
            'image_url' => 'https://cdn.example/location.jpg',
        ]);
        $project = $this->createProject([
            'name' => 'Located Project',
            'slug' => 'located-project',
            'project_location_id' => $location->id,
        ]);
        $agent = $this->createAgent();
        $lead = $this->createLead();

        $response = $this->postJson('/api/v1/expose-snapshots', [
            'entity_type' => 'developer_project',
            'entity_id' => $project->id,
            'agent_id' => $agent->id,
            'lead_id' => $lead->id,
        ], $this->authHeaders());

        $response->assertStatus(201)
            ->assertJsonPath('data.expose.location.title', 'lapta')
            ->assertJsonPath('data.expose.location.description', 'Coastal living in Lapta')
            ->assertJsonPath('data.expose.location.image_url', 'https://cdn.example/location.jpg');
    }

    public function test_get_by_token_returns_frozen_payload_after_entity_mutation(): void
    {
        $project = $this->createProject(['name' => 'Frozen Title', 'slug' => 'frozen-title']);
        $agent = $this->createAgent();
        $lead = $this->createLead();

        $mint = $this->postJson('/api/v1/expose-snapshots', [
            'entity_type' => 'developer_project',
            'entity_id' => $project->id,
            'agent_id' => $agent->id,
            'lead_id' => $lead->id,
        ], $this->authHeaders());

        $mint->assertStatus(201);
        $token = $mint->json('data.token');
        $frozenTitle = $mint->json('data.expose.title');

        $project->update(['name' => 'Live Changed Title']);

        $show = $this->getJson('/api/v1/expose-snapshots/' . $token, $this->authHeaders());
        $show->assertStatus(200)
            ->assertJsonPath('data.token', $token)
            ->assertJsonPath('data.expose.title', $frozenTitle)
            ->assertJsonPath('data.agent.name', $mint->json('data.agent.name'))
            ->assertJsonPath('data.lead.name', $mint->json('data.lead.name'));

        $live = $this->getJson(
            '/api/v1/developer-projects/' . $project->id . '/expose',
            $this->authHeaders()
        );
        $live->assertStatus(200);
        $this->assertNotSame($frozenTitle, $live->json('data.title'));
        $this->assertSame('Live Changed Title', $live->json('data.title'));
    }

    public function test_list_filters_by_lead_and_agent_and_omits_full_expose_by_default(): void
    {
        $project = $this->createProject(['name' => 'List Project', 'slug' => 'list-project']);
        $agentA = $this->createAgent(['name' => 'Agent A', 'email' => 'a@test.com']);
        $agentB = $this->createAgent(['name' => 'Agent B', 'email' => 'b@test.com']);
        $leadA = $this->createLead(['client_name' => 'Lead A', 'client_email' => 'la@test.com']);
        $leadB = $this->createLead(['client_name' => 'Lead B', 'client_email' => 'lb@test.com']);

        $this->postJson('/api/v1/expose-snapshots', [
            'entity_type' => 'developer_project',
            'entity_id' => $project->id,
            'agent_id' => $agentA->id,
            'lead_id' => $leadA->id,
        ], $this->authHeaders())->assertStatus(201);

        $this->postJson('/api/v1/expose-snapshots', [
            'entity_type' => 'developer_project',
            'entity_id' => $project->id,
            'agent_id' => $agentB->id,
            'lead_id' => $leadB->id,
        ], $this->authHeaders())->assertStatus(201);

        $byLead = $this->getJson(
            '/api/v1/expose-snapshots?lead_id=' . $leadA->id,
            $this->authHeaders()
        );
        $byLead->assertStatus(200)
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.lead.name', 'Lead A')
            ->assertJsonPath('data.0.agent.name', 'Agent A');
        $this->assertArrayNotHasKey('expose', $byLead->json('data.0'));

        $byAgent = $this->getJson(
            '/api/v1/expose-snapshots?agent_id=' . $agentB->id,
            $this->authHeaders()
        );
        $byAgent->assertStatus(200)
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.agent.name', 'Agent B');

        $withExpose = $this->getJson(
            '/api/v1/expose-snapshots?lead_id=' . $leadA->id . '&include=expose',
            $this->authHeaders()
        );
        $withExpose->assertStatus(200);
        $this->assertArrayHasKey('expose', $withExpose->json('data.0'));
        $this->assertSame(1, $withExpose->json('data.0.expose.schema_version'));
    }

    public function test_rejects_token_without_scope(): void
    {
        DB::table('api_tokens')->where('company_id', self::COMPANY_ID)->delete();
        $this->seedScopedToken(self::COMPANY_ID, self::TOKEN, ['api.developer-projects.show']);

        $response = $this->getJson('/api/v1/expose-snapshots', $this->authHeaders());
        $response->assertStatus(403);
    }

    public function test_rejects_missing_api_token(): void
    {
        $response = $this->getJson('/api/v1/expose-snapshots', [
            'X-COMPANY-ID' => (string) self::COMPANY_ID,
        ]);

        $response->assertStatus(401);
    }

    public function test_cross_company_token_returns_404(): void
    {
        $project = $this->createProject(['name' => 'Co1 Project', 'slug' => 'co1-project']);
        $agent = $this->createAgent();
        $lead = $this->createLead();

        $mint = $this->postJson('/api/v1/expose-snapshots', [
            'entity_type' => 'developer_project',
            'entity_id' => $project->id,
            'agent_id' => $agent->id,
            'lead_id' => $lead->id,
        ], $this->authHeaders());
        $mint->assertStatus(201);
        $token = $mint->json('data.token');

        $this->seedScopedToken(self::OTHER_COMPANY_ID, self::OTHER_TOKEN, self::ALL_SCOPES);

        $response = $this->getJson('/api/v1/expose-snapshots/' . $token, [
            'X-API-TOKEN' => self::OTHER_TOKEN,
            'X-COMPANY-ID' => (string) self::OTHER_COMPANY_ID,
        ]);

        $response->assertStatus(404)
            ->assertJsonPath('status', 'fail');
    }

    public function test_invalid_agent_or_lead_returns_422(): void
    {
        $project = $this->createProject(['name' => 'Bad People', 'slug' => 'bad-people']);

        $response = $this->postJson('/api/v1/expose-snapshots', [
            'entity_type' => 'developer_project',
            'entity_id' => $project->id,
            'agent_id' => 99999,
            'lead_id' => 99999,
        ], $this->authHeaders());

        $response->assertStatus(422)
            ->assertJsonPath('status', 'fail');
        $this->assertArrayHasKey('agent_id', $response->json('errors'));
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
    private function seedScopedToken(int $companyId, string $plainToken, array $scopes): void
    {
        DB::table('api_tokens')->where('token', ApiToken::hashToken($plainToken))->delete();

        DB::table('api_tokens')->insert([
            'token' => ApiToken::hashToken($plainToken),
            'name' => 'Expose Snapshot Test Token ' . $companyId,
            'permissions' => json_encode(ApiTokenScopeService::encodeScopes($scopes)),
            'revoked' => false,
            'company_id' => $companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createProject(array $overrides = []): DeveloperProject
    {
        $attrs = array_merge([
            'company_id' => self::COMPANY_ID,
            'name' => 'Test Project',
            'description' => null,
            'project_location_id' => null,
            'facilities' => null,
            'distances' => null,
            'payment_plan' => null,
            'is_hidden' => false,
            'rental_guarantee' => false,
        ], $overrides);

        return DeveloperProject::create($attrs);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createLocation(array $overrides = []): ProjectLocation
    {
        $attrs = array_merge([
            'company_id' => self::COMPANY_ID,
            'name' => 'Test Location',
            'description' => null,
            'image_url' => null,
        ], $overrides);

        return ProjectLocation::withoutGlobalScopes()->create($attrs);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createAgent(array $overrides = []): User
    {
        $id = (int) DB::table('users')->insertGetId(array_merge([
            'company_id' => self::COMPANY_ID,
            'name' => 'Default Agent',
            'email' => 'agent' . uniqid('', true) . '@test.com',
            'status' => 'active',
            'is_client_contact' => null,
            'image' => null,
            'mobile' => null,
            'salutation' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));

        return User::withoutGlobalScopes()->findOrFail($id);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createLead(array $overrides = []): Lead
    {
        $id = (int) DB::table('leads')->insertGetId(array_merge([
            'company_id' => self::COMPANY_ID,
            'client_name' => 'Default Lead',
            'client_email' => 'lead' . uniqid('', true) . '@test.com',
            'company_name' => null,
            'mobile' => null,
            'salutation' => null,
            'office' => null,
            'lead_lifecycle_status_id' => null,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));

        return Lead::withoutGlobalScopes()->findOrFail($id);
    }

    private function ensureSchema(): void
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
        } else {
            DB::table('api_tokens')->delete();
        }

        if (!Schema::hasTable('companies')) {
            Schema::create('companies', function (Blueprint $table) {
                $table->id();
                $table->string('company_name')->nullable();
                $table->string('app_name')->nullable();
                $table->string('company_email')->nullable();
                $table->string('company_phone')->nullable();
                $table->string('website')->nullable();
                $table->string('logo')->nullable();
                $table->string('light_logo')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('sessions')) {
            Schema::create('sessions', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->unsignedInteger('user_id')->nullable();
                $table->text('payload')->nullable();
                $table->integer('last_activity')->nullable();
            });
        }

        if (!Schema::hasTable('client_contacts')) {
            Schema::create('client_contacts', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('user_id')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('company_id')->nullable();
                $table->string('name')->nullable();
                $table->string('email')->nullable();
                $table->string('status')->default('active');
                $table->unsignedInteger('is_client_contact')->nullable();
                $table->string('image')->nullable();
                $table->string('mobile')->nullable();
                $table->string('salutation')->nullable();
                $table->timestamps();
            });
        } else {
            DB::table('users')->delete();
        }

        if (!Schema::hasTable('leads')) {
            Schema::create('leads', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('company_id')->nullable();
                $table->string('client_name')->nullable();
                $table->string('client_email')->nullable();
                $table->string('company_name')->nullable();
                $table->string('mobile')->nullable();
                $table->string('salutation')->nullable();
                $table->string('office')->nullable();
                $table->unsignedBigInteger('lead_lifecycle_status_id')->nullable();
                $table->softDeletes();
                $table->timestamps();
            });
        } else {
            DB::table('leads')->delete();
        }

        if (!Schema::hasTable('employee_details')) {
            Schema::create('employee_details', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('user_id');
                $table->unsignedInteger('designation_id')->nullable();
                $table->timestamps();
            });
        } else {
            DB::table('employee_details')->delete();
        }

        if (!Schema::hasTable('designations')) {
            Schema::create('designations', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('company_id')->nullable();
                $table->string('name')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('company_addresses')) {
            Schema::create('company_addresses', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('company_id')->nullable();
                $table->boolean('is_default')->default(0);
                $table->string('address')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('company_expose_configurations')) {
            Schema::create('company_expose_configurations', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->boolean('outro_enabled')->default(false);
                $table->string('outro_title')->nullable();
                $table->text('outro_description')->nullable();
                $table->string('outro_primary_image_url')->nullable();
                $table->string('outro_secondary_image_url')->nullable();
                $table->boolean('qr_enabled')->default(false);
                $table->string('qr_code_link')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('project_facilities')) {
            Schema::create('project_facilities', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('name');
                $table->string('label')->nullable();
                $table->string('image_url')->nullable();
                $table->timestamps();
            });
        } else {
            DB::table('project_facilities')->delete();
        }

        if (!Schema::hasTable('project_locations')) {
            Schema::create('project_locations', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('name')->nullable();
                $table->text('description')->nullable();
                $table->string('city')->nullable();
                $table->string('area')->nullable();
                $table->json('address')->nullable();
                $table->string('map_url')->nullable();
                $table->string('image_url', 500)->nullable();
                $table->decimal('latitude', 10, 7)->nullable();
                $table->decimal('longitude', 10, 7)->nullable();
                $table->json('attractions')->nullable();
                $table->json('infrastructure')->nullable();
                $table->json('airports')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        } else {
            if (!Schema::hasColumn('project_locations', 'description')) {
                Schema::table('project_locations', function (Blueprint $table) {
                    $table->text('description')->nullable();
                });
            }
            if (!Schema::hasColumn('project_locations', 'image_url')) {
                Schema::table('project_locations', function (Blueprint $table) {
                    $table->string('image_url', 500)->nullable();
                });
            }
            DB::table('project_locations')->delete();
        }

        if (!Schema::hasTable('developer_projects')) {
            Schema::create('developer_projects', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->unsignedBigInteger('developer_id')->nullable();
                $table->string('name');
                $table->string('slug', 255)->nullable();
                $table->string('reference_code', 50)->nullable();
                $table->text('description')->nullable();
                $table->unsignedBigInteger('project_location_id')->nullable();
                $table->decimal('starting_price', 12, 2)->nullable();
                $table->json('primary_categories')->nullable();
                $table->string('title_deed_type')->nullable();
                $table->json('unit_types')->nullable();
                $table->unsignedInteger('number_of_units')->nullable();
                $table->unsignedInteger('number_of_blocks')->nullable();
                $table->unsignedInteger('number_of_phases')->nullable();
                $table->decimal('project_total_area_sqm', 12, 2)->nullable();
                $table->string('construction_status')->nullable();
                $table->date('completion_date')->nullable();
                $table->string('furniture_package')->nullable();
                $table->boolean('rental_guarantee')->default(false);
                $table->json('payment_plan')->nullable();
                $table->json('facilities')->nullable();
                $table->json('distances')->nullable();
                $table->boolean('is_hidden')->default(false);
                $table->timestamps();
                $table->softDeletes();
            });
        } else {
            DB::table('developer_projects')->delete();
        }

        if (!Schema::hasTable('developer_project_assets')) {
            Schema::create('developer_project_assets', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('developer_project_id');
                $table->unsignedInteger('company_id');
                $table->string('name')->nullable();
                $table->string('asset_type')->nullable();
                $table->string('file_path')->nullable();
                $table->string('external_url')->nullable();
                $table->json('tags')->nullable();
                $table->unsignedInteger('order')->default(0);
                $table->timestamps();
                $table->softDeletes();
            });
        } else {
            DB::table('developer_project_assets')->delete();
        }

        if (!Schema::hasTable('developer_project_unit_types')) {
            Schema::create('developer_project_unit_types', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->unsignedBigInteger('developer_project_id');
                $table->string('reference_code', 50)->nullable();
                $table->string('primary_category')->nullable();
                $table->string('property_type')->nullable();
                $table->unsignedInteger('order')->default(0);
                $table->string('currency')->default('GBP');
                $table->timestamps();
                $table->softDeletes();
            });
        } else {
            DB::table('developer_project_unit_types')->delete();
        }

        if (!Schema::hasTable('developer_project_unit_type_assets')) {
            Schema::create('developer_project_unit_type_assets', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('unit_type_id');
                $table->unsignedInteger('company_id');
                $table->string('name')->nullable();
                $table->string('asset_type')->nullable();
                $table->string('file_path')->nullable();
                $table->string('external_url')->nullable();
                $table->json('tags')->nullable();
                $table->unsignedInteger('order')->default(0);
                $table->timestamps();
                $table->softDeletes();
            });
        } else {
            DB::table('developer_project_unit_type_assets')->delete();
        }

        if (!Schema::hasTable('expose_snapshots')) {
            Schema::create('expose_snapshots', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('company_id');
                $table->string('token_hash', 64)->unique();
                $table->string('token_prefix', 16);
                $table->string('entity_type');
                $table->unsignedBigInteger('entity_id');
                $table->unsignedBigInteger('sub_entity_id')->nullable();
                $table->unsignedBigInteger('agent_user_id');
                $table->unsignedBigInteger('lead_id');
                $table->string('layout')->nullable();
                $table->json('request_payload');
                $table->json('agent_snapshot');
                $table->json('lead_snapshot');
                $table->json('expose_payload');
                $table->unsignedSmallInteger('schema_version')->default(1);
                $table->json('warnings')->nullable();
                $table->timestamps();
            });
        } else {
            DB::table('expose_snapshots')->delete();
        }
    }
}
