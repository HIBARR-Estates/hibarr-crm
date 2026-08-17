<?php

namespace Tests\Feature;

use App\Models\DeveloperProject;
use App\Models\ExposeSnapshot;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class ExposeSnapshotShareTest extends TestCase
{
    use SetsFeatureFlags;

    private const COMPANY_ID = 1;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureSchema();
        config(['expose.share_base_url' => 'https://hibarr-os-expose.vercel.app']);
        // Avoid FeatureFlagService remote fetch hang in tests.
        $this->setFeatureFlag('crm.expose-share-links', false);
        // Base Controller middleware runs migrate/company boot (needs full schema).
        $this->withoutMiddleware();
        session(['check_migrate_status' => 'Good']);
    }

    public function test_share_flag_is_known(): void
    {
        $this->assertContains('crm.expose-share-links', config('features.known_flags'));
    }

    public function test_share_route_is_registered(): void
    {
        $this->assertTrue(Route::has('expose-snapshots.share'));
    }

    public function test_share_returns_404_when_flag_disabled(): void
    {
        $this->setFeatureFlag('crm.expose-share-links', false);

        $agent = $this->createAgent();
        $project = $this->createProject();
        $lead = $this->createLead();

        $this->beAgent($agent);

        $response = $this->postJson(route('expose-snapshots.share'), [
            'entity_type' => 'developer_project',
            'entity_id' => $project->id,
            'lead_id' => $lead->id,
        ]);

        $response->assertStatus(404);
    }

    public function test_share_mints_snapshot_and_returns_share_url(): void
    {
        $this->setFeatureFlag('crm.expose-share-links', true);

        $agent = $this->createAgent(['name' => 'Jane Agent', 'email' => 'jane-share@hibarr.test']);
        $project = $this->createProject(['name' => 'Share Project', 'slug' => 'share-project']);
        $lead = $this->createLead(['client_name' => 'Ada Lovelace', 'client_email' => 'ada@example.com']);

        $this->beAgent($agent);

        $response = $this->postJson(route('expose-snapshots.share'), [
            'entity_type' => 'developer_project',
            'entity_id' => $project->id,
            'lead_id' => $lead->id,
        ]);

        if ($response->status() !== 201) {
            dump($response->exception?->getMessage() ?? $response->json());
        }

        $response->assertStatus(201)
            ->assertJsonPath('status', 'success');

        $snapshotId = $response->json('data.snapshot_id');
        $this->assertIsInt($snapshotId);
        $this->assertGreaterThan(0, $snapshotId);

        $token = $response->json('data.token');
        $shareUrl = $response->json('data.share_url');

        $this->assertIsString($token);
        $this->assertStringStartsWith('exp_', $token);
        $this->assertSame('https://hibarr-os-expose.vercel.app/'.$token, $shareUrl);
        $this->assertDatabaseCount('expose_snapshots', 1);
        $this->assertSame(ExposeSnapshot::hashToken($token), DB::table('expose_snapshots')->value('token_hash'));
        $this->assertSame($agent->id, (int) DB::table('expose_snapshots')->value('agent_user_id'));
        $this->assertSame($lead->id, (int) DB::table('expose_snapshots')->value('lead_id'));
    }

    public function test_share_requires_lead_id(): void
    {
        $this->setFeatureFlag('crm.expose-share-links', true);

        $agent = $this->createAgent();
        $project = $this->createProject();

        $this->beAgent($agent);

        $response = $this->postJson(route('expose-snapshots.share'), [
            'entity_type' => 'developer_project',
            'entity_id' => $project->id,
        ]);

        $response->assertStatus(422);
        $this->assertArrayHasKey('lead_id', $response->json('errors'));
    }

    private function beAgent(User $agent): void
    {
        // Prefer session user over actingAs so CompanyScope does not require full schema.
        // withSession ensures the value reaches the HTTP request under withoutMiddleware().
        $this->withSession([
            'user' => $agent,
            'check_migrate_status' => 'Good',
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createProject(array $overrides = []): DeveloperProject
    {
        return DeveloperProject::create(array_merge([
            'company_id' => self::COMPANY_ID,
            'name' => 'Test Project',
            'slug' => 'test-project-'.uniqid('', true),
            'description' => null,
            'project_location_id' => null,
            'facilities' => null,
            'distances' => null,
            'payment_plan' => null,
            'is_hidden' => false,
            'rental_guarantee' => false,
        ], $overrides));
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createAgent(array $overrides = []): User
    {
        $id = (int) DB::table('users')->insertGetId(array_merge([
            'company_id' => self::COMPANY_ID,
            'name' => 'Default Agent',
            'email' => 'agent'.uniqid('', true).'@test.com',
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
            'client_email' => 'lead'.uniqid('', true).'@test.com',
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
        if (! Schema::hasTable('companies')) {
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

        if (! Schema::hasTable('sessions')) {
            Schema::create('sessions', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->unsignedInteger('user_id')->nullable();
                $table->text('payload')->nullable();
                $table->integer('last_activity')->nullable();
            });
        }

        if (! Schema::hasTable('client_contacts')) {
            Schema::create('client_contacts', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('user_id')->nullable();
                $table->unsignedInteger('company_id')->nullable();
                $table->timestamps();
            });
        } else {
            if (! Schema::hasColumn('client_contacts', 'company_id')) {
                Schema::table('client_contacts', function (Blueprint $table) {
                    $table->unsignedInteger('company_id')->nullable();
                });
            }
        }

        if (DB::table('companies')->where('id', self::COMPANY_ID)->doesntExist()) {
            DB::table('companies')->insert([
                'id' => self::COMPANY_ID,
                'company_name' => 'Test Co',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if (! Schema::hasTable('users')) {
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

        if (! Schema::hasTable('leads')) {
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

        if (! Schema::hasTable('employee_details')) {
            Schema::create('employee_details', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('user_id');
                $table->unsignedInteger('designation_id')->nullable();
                $table->timestamps();
            });
        } else {
            DB::table('employee_details')->delete();
        }

        if (! Schema::hasTable('designations')) {
            Schema::create('designations', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('company_id')->nullable();
                $table->string('name')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('company_addresses')) {
            Schema::create('company_addresses', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('company_id')->nullable();
                $table->boolean('is_default')->default(0);
                $table->string('address')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('company_expose_configurations')) {
            Schema::create('company_expose_configurations', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('outro_title')->nullable();
                $table->text('outro_description')->nullable();
                $table->string('outro_primary_image_url')->nullable();
                $table->string('outro_secondary_image_url')->nullable();
                $table->boolean('qr_enabled')->default(false);
                $table->string('qr_code_link')->nullable();
                $table->timestamps();
            });
        } else {
            DB::table('company_expose_configurations')->delete();
        }

        if (! Schema::hasTable('project_facilities')) {
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

        if (! Schema::hasTable('project_locations')) {
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
            DB::table('project_locations')->delete();
        }

        if (! Schema::hasTable('developer_projects')) {
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

        if (! Schema::hasTable('developer_project_assets')) {
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

        if (! Schema::hasTable('developer_project_unit_types')) {
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

        if (! Schema::hasTable('developer_project_unit_type_assets')) {
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

        if (! Schema::hasTable('expose_snapshots')) {
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
