<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LeadFileStoreFromExternalTest extends TestCase
{
    private const COMPANY_ID = 1;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureSchema();
        $this->withoutMiddleware();
        session(['check_migrate_status' => 'Good']);
    }

    public function test_store_external_route_is_registered(): void
    {
        $this->assertTrue(Route::has('deal-files.store-external'));
    }

    public function test_store_from_external_creates_deal_file_rows(): void
    {
        $agent = $this->createAgent();
        $this->grantPermission($agent, 'add_lead_files', 'all');
        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);

        $this->beAgent($agent);

        $this->postJson(route('deal-files.store-external'), [
            'deal_id' => $dealId,
            'files' => [
                [
                    'downloadUrl' => 'https://cdn.example.test/deal-files/1/brochure.pdf',
                    'objectPath' => 'deal-files/1/brochure.pdf',
                    'originalName' => 'brochure.pdf',
                    'size' => 204800,
                ],
                [
                    'downloadUrl' => 'https://cdn.example.test/deal-files/1/plan.zip',
                    'objectPath' => 'deal-files/1/plan.zip',
                    'originalName' => 'plan.zip',
                    'size' => 4096,
                ],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.0.filename', 'brochure.pdf')
            ->assertJsonPath('data.0.external_url', 'https://cdn.example.test/deal-files/1/brochure.pdf')
            ->assertJsonPath('data.0.object_path', 'deal-files/1/brochure.pdf')
            ->assertJsonPath('data.0.size', 204800)
            ->assertJsonPath('data.1.filename', 'plan.zip')
            ->assertJsonPath('data.1.size', 4096);

        $this->assertDatabaseHas('deal_files', [
            'deal_id' => $dealId,
            'filename' => 'brochure.pdf',
            'external_url' => 'https://cdn.example.test/deal-files/1/brochure.pdf',
            'object_path' => 'deal-files/1/brochure.pdf',
            'size' => 204800,
            'user_id' => $agent->id,
            'added_by' => $agent->id,
            'hashname' => '',
        ]);
        $this->assertDatabaseHas('deal_files', [
            'deal_id' => $dealId,
            'filename' => 'plan.zip',
            'size' => 4096,
        ]);
    }

    public function test_store_from_external_is_forbidden_without_add_lead_files(): void
    {
        $agent = $this->createAgent();
        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);

        $this->beAgent($agent);

        $this->postJson(route('deal-files.store-external'), [
            'deal_id' => $dealId,
            'files' => [
                [
                    'downloadUrl' => 'https://cdn.example.test/deal-files/1/brochure.pdf',
                    'objectPath' => 'deal-files/1/brochure.pdf',
                    'originalName' => 'brochure.pdf',
                    'size' => 204800,
                ],
            ],
        ])->assertStatus(403);

        $this->assertDatabaseMissing('deal_files', ['deal_id' => $dealId]);
    }

    private function beAgent(User $agent): void
    {
        $this->withSession([
            'user' => $agent,
            'check_migrate_status' => 'Good',
        ]);
    }

    private function createAgent(): User
    {
        $id = (int) DB::table('users')->insertGetId([
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
        ]);

        return User::query()->withoutGlobalScopes()->findOrFail($id);
    }

    private function grantPermission(User $user, string $permission, string $type): void
    {
        $permissionId = (int) DB::table('permissions')->insertGetId([
            'name' => $permission,
        ]);
        $typeId = (int) DB::table('permission_types')->insertGetId([
            'name' => $type,
        ]);
        DB::table('user_permissions')->insert([
            'user_id' => $user->id,
            'permission_id' => $permissionId,
            'permission_type_id' => $typeId,
        ]);
    }

    private function createLead(): int
    {
        return (int) DB::table('leads')->insertGetId([
            'company_id' => self::COMPANY_ID,
            'client_name' => 'Default Lead',
            'client_email' => 'lead'.uniqid('', true).'@test.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function createDeal(int $leadId): int
    {
        return (int) DB::table('deals')->insertGetId([
            'company_id' => self::COMPANY_ID,
            'lead_id' => $leadId,
            'name' => 'Test Deal',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function ensureSchema(): void
    {
        if (! Schema::hasTable('companies')) {
            Schema::create('companies', function (Blueprint $table) {
                $table->id();
                $table->string('company_name')->nullable();
                $table->timestamps();
            });
        }

        if (DB::table('companies')->where('id', self::COMPANY_ID)->doesntExist()) {
            DB::table('companies')->insert([
                'id' => self::COMPANY_ID,
                'company_name' => 'Test Co',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if (! Schema::hasTable('sessions')) {
            Schema::create('sessions', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->unsignedInteger('user_id')->nullable();
                $table->text('payload')->nullable();
                $table->integer('last_activity')->nullable();
            });
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
                $table->softDeletes();
                $table->timestamps();
            });
        } else {
            DB::table('leads')->delete();
        }

        if (! Schema::hasTable('deals')) {
            Schema::create('deals', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('company_id')->nullable();
                $table->unsignedInteger('lead_id')->nullable();
                $table->string('name')->nullable();
                $table->boolean('is_locked')->default(false);
                $table->softDeletes();
                $table->timestamps();
            });
        } else {
            DB::table('deals')->delete();
        }

        foreach (['permissions', 'permission_types'] as $table) {
            if (! Schema::hasTable($table)) {
                Schema::create($table, function (Blueprint $blueprint) {
                    $blueprint->increments('id');
                    $blueprint->string('name')->nullable();
                });
            } else {
                DB::table($table)->delete();
            }
        }

        if (! Schema::hasTable('user_permissions')) {
            Schema::create('user_permissions', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('user_id');
                $table->unsignedInteger('permission_id');
                $table->unsignedInteger('permission_type_id');
            });
        } else {
            DB::table('user_permissions')->delete();
        }

        if (! Schema::hasTable('deal_files')) {
            Schema::create('deal_files', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('deal_id');
                $table->unsignedBigInteger('user_id')->nullable();
                $table->string('filename')->nullable();
                $table->string('hashname')->nullable();
                $table->string('external_url')->nullable();
                $table->string('object_path')->nullable();
                $table->unsignedBigInteger('size')->nullable();
                $table->string('description')->nullable();
                $table->unsignedBigInteger('added_by')->nullable();
                $table->unsignedBigInteger('last_updated_by')->nullable();
                $table->timestamps();
            });
        } else {
            DB::table('deal_files')->delete();
        }
    }
}
