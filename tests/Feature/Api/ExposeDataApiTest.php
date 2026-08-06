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

class ExposeDataApiTest extends TestCase
{
    private const TOKEN = 'test-expose-data-token';

    private const COMPANY_ID = 1;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureSchema();
        $this->seedScopedToken(self::COMPANY_ID, [
            'api.developer-projects.expose',
            'api.developer-projects.unit-types.expose',
            'api.properties.expose',
        ]);
    }

    public function test_project_expose_returns_presentation_dto_envelope(): void
    {
        $project = $this->createProject([
            'name' => 'Expose Project',
            'slug' => 'expose-project',
            'facilities' => ['pool'],
        ]);

        $response = $this->getJson(
            '/api/v1/developer-projects/' . $project->slug . '/expose?client_name=Ada',
            $this->authHeaders()
        );

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.schema_version', 1)
            ->assertJsonPath('data.entity_id', $project->id)
            ->assertJsonPath('data.client.name', 'Ada')
            ->assertJsonStructure([
                'status',
                'data' => [
                    'schema_version',
                    'facility_items',
                    'infrastructure_items',
                    'airport_items',
                    'assets',
                    'presence',
                    'agent',
                    'client',
                    'company',
                ],
                'warnings',
            ]);

        $this->assertIsArray($response->json('data.facility_items'));
        $this->assertIsArray($response->json('data.assets.hero'));
        $this->assertCount(3, $response->json('data.airport_items'));
        $this->assertSame([], $response->json('data.infrastructure_items'));
    }

    public function test_unit_type_expose_returns_dto_for_project_unit(): void
    {
        $project = $this->createProject(['name' => 'UT Project', 'slug' => 'ut-project']);
        $unitType = $this->createUnitType($project->id);

        $response = $this->getJson(
            "/api/v1/developer-projects/{$project->id}/unit-types/{$unitType->id}/expose",
            $this->authHeaders()
        );

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.schema_version', 1)
            ->assertJsonPath('data.entity_id', $unitType->id);

        $this->assertArrayHasKey('facility_items', $response->json('data'));
        $this->assertArrayHasKey('presence', $response->json('data'));
    }

    public function test_unit_type_expose_returns_404_for_unknown_unit(): void
    {
        $project = $this->createProject(['name' => 'Missing UT', 'slug' => 'missing-ut']);

        $response = $this->getJson(
            "/api/v1/developer-projects/{$project->id}/unit-types/99999/expose",
            $this->authHeaders()
        );

        $response->assertStatus(404)
            ->assertJsonPath('status', 'fail');
    }

    public function test_project_expose_rejects_token_without_scope(): void
    {
        $project = $this->createProject(['name' => 'Scoped', 'slug' => 'scoped']);
        DB::table('api_tokens')->where('company_id', self::COMPANY_ID)->delete();
        $this->seedScopedToken(self::COMPANY_ID, ['api.developer-projects.show']);

        $response = $this->getJson(
            '/api/v1/developer-projects/' . $project->id . '/expose',
            $this->authHeaders()
        );

        $response->assertStatus(403);
    }

    public function test_project_expose_rejects_missing_token(): void
    {
        $project = $this->createProject(['name' => 'No Token', 'slug' => 'no-token']);

        $response = $this->getJson('/api/v1/developer-projects/' . $project->id . '/expose', [
            'X-COMPANY-ID' => (string) self::COMPANY_ID,
        ]);

        $response->assertStatus(401);
    }

    public function test_property_expose_returns_404_for_unknown_property(): void
    {
        $response = $this->getJson('/api/v1/properties/missing-property/expose', $this->authHeaders());

        $response->assertStatus(404)
            ->assertJsonPath('status', 'fail');
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
            'name' => 'Expose Data Test Token',
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

        if (!Schema::hasTable('companies')) {
            Schema::create('companies', function (Blueprint $table) {
                $table->id();
                $table->string('company_name')->nullable();
                $table->string('app_name')->nullable();
                $table->string('company_email')->nullable();
                $table->string('company_phone')->nullable();
                $table->string('website')->nullable();
                $table->string('logo')->nullable();
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
                $table->string('city')->nullable();
                $table->string('area')->nullable();
                $table->json('address')->nullable();
                $table->string('map_url')->nullable();
                $table->decimal('latitude', 10, 7)->nullable();
                $table->decimal('longitude', 10, 7)->nullable();
                $table->json('attractions')->nullable();
                $table->json('infrastructure')->nullable();
                $table->json('airports')->nullable();
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
                $table->unsignedInteger('order')->default(0);
                $table->boolean('has_restrictions')->default(false);
                $table->text('restriction_notes')->nullable();
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
            if (!Schema::hasColumn('developer_project_unit_type_assets', 'unit_type_id')) {
                Schema::drop('developer_project_unit_type_assets');
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
        }

        if (!Schema::hasTable('properties')) {
            Schema::create('properties', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->unsignedBigInteger('developer_project_id')->nullable();
                $table->string('slug')->nullable();
                $table->string('title')->nullable();
                $table->string('reference_code')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        } else {
            DB::table('properties')->delete();
        }
    }
}
