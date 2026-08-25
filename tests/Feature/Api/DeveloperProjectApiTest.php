<?php

namespace Tests\Feature\Api;

use App\Models\ApiToken;
use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Models\ProjectLocation;
use App\Services\ApiTokenScopeService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DeveloperProjectApiTest extends TestCase
{
    private const TOKEN = 'test-developer-projects-token';

    private const COMPANY_ID = 1;

    private const OTHER_COMPANY_ID = 2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureSchema();
        $this->seedScopedToken(self::COMPANY_ID, [
            'api.developer-projects.index',
            'api.developer-projects.show',
        ]);
    }

    public function test_index_returns_paginated_list_in_standard_envelope(): void
    {
        $this->createProject(['name' => 'Alpha Towers', 'is_hidden' => false]);
        $this->createProject(['name' => 'Hidden Heights', 'is_hidden' => true]);

        $response = $this->getJson('/api/v1/developer-projects', $this->authHeaders());

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonStructure([
                'status',
                'data',
                'current_page',
                'last_page',
                'per_page',
                'total',
                'from',
                'to',
                'next_page_url',
                'prev_page_url',
            ]);

        $this->assertCount(2, $response->json('data'));
        $this->assertTrue(collect($response->json('data'))->contains(fn ($row) => ($row['is_hidden'] ?? null) === true));
        $this->assertTrue(collect($response->json('data'))->every(fn ($row) => array_key_exists('is_hidden', $row)));
    }

    public function test_index_respects_fields_parameter(): void
    {
        $this->createProject(['name' => 'Field Select Project']);

        $response = $this->getJson('/api/v1/developer-projects?fields=id,name,is_hidden', $this->authHeaders());

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $row = $response->json('data.0');
        $this->assertSame(['id', 'name', 'is_hidden'], array_keys($row));
    }

    public function test_index_returns_empty_data_when_company_has_no_projects(): void
    {
        $response = $this->getJson('/api/v1/developer-projects', $this->authHeaders());

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data', [])
            ->assertJsonPath('total', 0);
    }

    public function test_index_returns_correct_page_when_beyond_last_page(): void
    {
        $this->createProject(['name' => 'Only Project']);

        $response = $this->getJson('/api/v1/developer-projects?page=99&per_page=10', $this->authHeaders());

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data', [])
            ->assertJsonPath('current_page', 99)
            ->assertJsonPath('last_page', 1)
            ->assertJsonPath('total', 1);
    }

    public function test_index_scopes_results_to_x_company_id(): void
    {
        $this->createProject(['name' => 'Company One Project', 'company_id' => self::COMPANY_ID]);
        $this->createProject(['name' => 'Company Two Project', 'company_id' => self::OTHER_COMPANY_ID]);

        $response = $this->getJson('/api/v1/developer-projects', $this->authHeaders());

        $response->assertStatus(200);
        $names = collect($response->json('data'))->pluck('name')->all();
        $this->assertSame(['Company One Project'], $names);
    }

    public function test_index_rejects_missing_api_token(): void
    {
        $response = $this->getJson('/api/v1/developer-projects', [
            'X-COMPANY-ID' => (string) self::COMPANY_ID,
        ]);

        $response->assertStatus(401);
    }

    public function test_index_rejects_token_without_developer_projects_scope(): void
    {
        DB::table('api_tokens')->where('company_id', self::COMPANY_ID)->delete();
        $this->seedScopedToken(self::COMPANY_ID, ['api.properties.index']);

        $response = $this->getJson('/api/v1/developer-projects', $this->authHeaders());

        $response->assertStatus(403);
    }

    public function test_index_rejects_company_mismatch(): void
    {
        $response = $this->getJson('/api/v1/developer-projects', [
            'X-API-TOKEN' => self::TOKEN,
            'X-COMPANY-ID' => (string) self::OTHER_COMPANY_ID,
        ]);

        $response->assertStatus(401);
    }

    public function test_show_by_numeric_id_returns_full_record(): void
    {
        $location = $this->createLocation();
        $project = $this->createProject([
            'name' => 'Show By Id Project',
            'project_location_id' => $location->id,
            'facilities' => ['pool', 'gym'],
            'distances' => ['sea_km' => 1.5],
            'payment_plan' => ['enabled' => true, 'period_months' => 24],
            'is_hidden' => true,
        ]);
        $this->createUnitType($project->id);

        $response = $this->getJson('/api/v1/developer-projects/' . $project->id, $this->authHeaders());

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.id', $project->id)
            ->assertJsonPath('data.is_hidden', true)
            ->assertJsonPath('data.facilities', ['pool', 'gym'])
            ->assertJsonPath('data.distances.sea_km', 1.5)
            ->assertJsonPath('data.payment_plan.period_months', 24)
            ->assertJsonPath('data.location.id', $location->id);

        $this->assertNotEmpty($response->json('data.unit_type_details'));
        $this->assertArrayHasKey('is_hidden', $response->json('data'));
    }

    public function test_show_by_slug_returns_full_record(): void
    {
        $project = $this->createProject(['name' => 'Slug Lookup Project']);

        $response = $this->getJson('/api/v1/developer-projects/' . $project->slug, $this->authHeaders());

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.id', $project->id)
            ->assertJsonPath('data.slug', $project->slug);
    }

    public function test_show_returns_404_for_unknown_identifier(): void
    {
        $response = $this->getJson('/api/v1/developer-projects/does-not-exist', $this->authHeaders());

        $response->assertStatus(404)
            ->assertJsonPath('status', 'fail');
    }

    public function test_show_returns_404_for_soft_deleted_project(): void
    {
        $project = $this->createProject(['name' => 'Deleted Project']);
        $project->delete();

        $response = $this->getJson('/api/v1/developer-projects/' . $project->id, $this->authHeaders());

        $response->assertStatus(404);
    }

    public function test_show_rejects_missing_api_token(): void
    {
        $project = $this->createProject(['name' => 'Auth Show Project']);

        $response = $this->getJson('/api/v1/developer-projects/' . $project->id, [
            'X-COMPANY-ID' => (string) self::COMPANY_ID,
        ]);

        $response->assertStatus(401);
    }

    public function test_show_rejects_token_without_developer_projects_scope(): void
    {
        $project = $this->createProject(['name' => 'Scope Show Project']);
        DB::table('api_tokens')->where('company_id', self::COMPANY_ID)->delete();
        $this->seedScopedToken(self::COMPANY_ID, ['api.properties.show']);

        $response = $this->getJson('/api/v1/developer-projects/' . $project->id, $this->authHeaders());

        $response->assertStatus(403);
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
            'name' => 'Developer Projects Test Token',
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

    private function createLocation(): ProjectLocation
    {
        return ProjectLocation::create([
            'company_id' => self::COMPANY_ID,
            'name' => 'Test Location',
            'city' => 'Famagusta',
            'area' => 'Iskele',
        ]);
    }

    private function createUnitType(int $projectId): DeveloperProjectUnitType
    {
        return DeveloperProjectUnitType::create([
            'company_id' => self::COMPANY_ID,
            'developer_project_id' => $projectId,
            'primary_category' => 'residential',
            'property_type' => 'apartment',
            'order' => 1,
            'currency' => 'GBP',
        ]);
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

        if (!Schema::hasTable('project_locations')) {
            Schema::create('project_locations', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('name')->nullable();
                $table->string('city')->nullable();
                $table->string('area')->nullable();
                $table->json('address')->nullable();
                $table->string('map_url')->nullable();
                $table->decimal('latitude', 10, 7)->nullable();
                $table->decimal('longitude', 10, 7)->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        } else {
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
                $table->string('map_url', 2048)->nullable();
                $table->decimal('latitude', 10, 7)->nullable();
                $table->decimal('longitude', 10, 7)->nullable();
                $table->json('address')->nullable();
                $table->string('google_drive_link', 500)->nullable();
                $table->string('availability_link', 500)->nullable();
                $table->decimal('starting_price', 12, 2)->nullable();
                $table->json('primary_categories')->nullable();
                $table->string('title_deed_type')->nullable();
                $table->json('unit_types')->nullable();
                $table->unsignedInteger('number_of_units')->nullable();
                $table->unsignedInteger('total_units')->nullable();
                $table->unsignedInteger('total_units_sold')->nullable();
                $table->unsignedInteger('number_of_blocks')->nullable();
                $table->decimal('project_total_area_sqm', 12, 2)->nullable();
                $table->string('construction_status')->nullable();
                $table->date('completion_date')->nullable();
                $table->unsignedInteger('number_of_phases')->nullable();
                $table->string('furniture_package')->nullable();
                $table->boolean('rental_guarantee')->default(false);
                $table->json('payment_plan')->nullable();
                $table->json('facilities')->nullable();
                $table->json('distances')->nullable();
                $table->boolean('is_hidden')->default(false);
                $table->timestamps();
                $table->softDeletes();
                $table->unique(['company_id', 'slug'], 'developer_projects_company_id_slug_unique');
            });
        } else {
            if (!Schema::hasColumn('developer_projects', 'slug')) {
                Schema::table('developer_projects', function (Blueprint $table) {
                    $table->string('slug', 255)->nullable()->after('name');
                });
            }
            if (!Schema::hasColumn('developer_projects', 'map_url')) {
                Schema::table('developer_projects', function (Blueprint $table) {
                    $table->string('map_url', 2048)->nullable()->after('project_location_id');
                    $table->decimal('latitude', 10, 7)->nullable()->after('map_url');
                    $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
                    $table->json('address')->nullable()->after('longitude');
                });
            }
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
                $table->string('mime_type')->nullable();
                $table->unsignedBigInteger('file_size')->nullable();
                $table->json('tags')->nullable();
                $table->json('metadata')->nullable();
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
                $table->unsignedInteger('quantity')->nullable();
                $table->unsignedInteger('total_sold')->nullable();
                $table->boolean('is_sold_out')->default(false);
                $table->json('unit_style')->nullable();
                $table->json('view_types')->nullable();
                $table->string('furniture_status')->nullable();
                $table->decimal('starting_price', 12, 2)->nullable();
                $table->string('currency')->default('GBP');
                $table->unsignedInteger('bedrooms')->nullable();
                $table->unsignedInteger('bathrooms')->nullable();
                $table->string('floor')->nullable();
                $table->unsignedInteger('floors_in_building')->nullable();
                $table->decimal('total_area_sqm', 12, 2)->nullable();
                $table->decimal('living_area_sqm', 12, 2)->nullable();
                $table->decimal('terrace_balcony_sqm', 12, 2)->nullable();
                $table->decimal('plot_size_sqm', 12, 2)->nullable();
                $table->date('completion_date')->nullable();
                $table->json('outside_features')->nullable();
                $table->json('inside_features')->nullable();
                $table->text('description')->nullable();
                $table->decimal('military_base_distance_km', 8, 2)->nullable();
                $table->unsignedInteger('order')->default(0);
                $table->timestamps();
                $table->softDeletes();
            });
        } else {
            DB::table('developer_project_unit_types')->delete();
        }

        if (!Schema::hasTable('developer_project_unit_type_assets')) {
            Schema::create('developer_project_unit_type_assets', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('developer_project_unit_type_id');
                $table->unsignedInteger('company_id');
                $table->string('name')->nullable();
                $table->string('asset_type')->nullable();
                $table->string('file_path')->nullable();
                $table->string('external_url')->nullable();
                $table->string('mime_type')->nullable();
                $table->unsignedBigInteger('file_size')->nullable();
                $table->json('tags')->nullable();
                $table->json('metadata')->nullable();
                $table->unsignedInteger('order')->default(0);
                $table->timestamps();
                $table->softDeletes();
            });
        } else {
            DB::table('developer_project_unit_type_assets')->delete();
        }

        if (!Schema::hasTable('properties')) {
            Schema::create('properties', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id')->nullable();
                $table->unsignedBigInteger('developer_project_id')->nullable();
                $table->string('status')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }
    }
}
