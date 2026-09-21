<?php

namespace Tests\Feature\LeadSettings;

use App\Models\LeadLifecycleStatus;
use App\Models\LeadSetting;
use App\Models\LeadSource;
use App\Models\User;
use App\Services\Dashboard\DashboardMetricsService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class LeadSettingsHubTest extends TestCase
{
    private int $companyId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('cache.default', 'array');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();
        DB::table('companies')->insert([
            'id' => $this->companyId,
            'company_name' => 'Test Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_saving_the_sla_creates_a_company_row(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $this->putJson('/account/settings/leads', [
            'first_contact_sla_hours' => 48,
        ])->assertOk()->assertJsonPath('status', 'success');

        $this->assertSame(48, (int) LeadSetting::value('first_contact_sla_hours'));
    }

    public function test_saving_the_sla_updates_an_existing_row(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        DB::table('lead_setting')->insert([
            'company_id' => $this->companyId,
            'user_id' => 99,
            'status' => 0,
            'first_contact_sla_hours' => 24,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->putJson('/account/settings/leads', [
            'first_contact_sla_hours' => 4,
        ])->assertOk();

        $this->assertSame(4, (int) LeadSetting::value('first_contact_sla_hours'));
        $this->assertSame(1, LeadSetting::count());
    }

    public function test_out_of_range_hours_are_rejected(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $this->putJson('/account/settings/leads', [
            'first_contact_sla_hours' => DashboardMetricsService::SLA_HOURS_MAX + 1,
        ])->assertStatus(422);

        $this->putJson('/account/settings/leads', [
            'first_contact_sla_hours' => 0,
        ])->assertStatus(422);
    }

    public function test_creating_a_source_persists_the_row(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $this->postJson('/account/settings/leads/sources', [
            'type' => 'Website',
        ])->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('source.type', 'Website');

        $this->assertSame(1, LeadSource::count());
        $this->assertSame('Website', LeadSource::first()->type);
    }

    public function test_duplicate_source_names_are_rejected(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $this->insertSource('Website', 1);

        $this->postJson('/account/settings/leads/sources', [
            'type' => 'Website',
        ])->assertStatus(422);
    }

    public function test_updating_a_source_renames_it(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $id = $this->insertSource('Website', 1);

        $this->putJson("/account/settings/leads/sources/{$id}", [
            'type' => 'Referral',
        ])->assertOk()->assertJsonPath('source.type', 'Referral');

        $this->assertSame('Referral', LeadSource::find($id)->type);
    }

    public function test_deleting_a_source_removes_the_row(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $id = $this->insertSource('Website', 1);

        $this->deleteJson("/account/settings/leads/sources/{$id}")
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertSame(0, LeadSource::count());
    }

    public function test_sources_can_be_reordered(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $first = $this->insertSource('Website', 1);
        $second = $this->insertSource('Referral', 2);
        $third = $this->insertSource('Walk-in', 3);

        $this->postJson('/account/settings/leads/sources/reorder', [
            'sourceIds' => [$third, $first, $second],
        ])->assertOk()->assertJsonPath('status', 'success');

        $this->assertSame(1, (int) LeadSource::find($third)->sort_order);
        $this->assertSame(2, (int) LeadSource::find($first)->sort_order);
        $this->assertSame(3, (int) LeadSource::find($second)->sort_order);
    }

    public function test_creating_a_lead_status_persists_the_row(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $this->postJson('/account/settings/leads/statuses', [
            'key' => 'vip_lead',
            'label' => 'VIP',
            'description' => 'Priority inbound',
            'label_color' => '#112233',
            'sort_order' => 10,
        ])->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('lead_status.key', 'vip_lead')
            ->assertJsonPath('lead_status.label', 'VIP')
            ->assertJsonPath('lead_status.is_system', false);

        $this->assertSame(1, LeadLifecycleStatus::count());
        $this->assertSame('VIP', LeadLifecycleStatus::first()->label);
    }

    public function test_reserved_status_keys_are_rejected(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $this->postJson('/account/settings/leads/statuses', [
            'key' => 'new',
            'label' => 'New',
            'label_color' => '#6c757d',
        ])->assertStatus(422);
    }

    public function test_updating_a_lead_status_renames_it(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $id = $this->insertStatus('qualifying', 'Qualifying', 3);

        $this->putJson("/account/settings/leads/statuses/{$id}", [
            'label' => 'In review',
            'description' => 'Still qualifying',
            'label_color' => '#ffc107',
            'sort_order' => 3,
        ])->assertOk()->assertJsonPath('lead_status.label', 'In review');

        $this->assertSame('In review', LeadLifecycleStatus::find($id)->label);
        $this->assertSame('qualifying', LeadLifecycleStatus::find($id)->key);
    }

    public function test_built_in_lead_statuses_cannot_be_deleted(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $id = $this->insertStatus('new', 'New', 1);

        $this->deleteJson("/account/settings/leads/statuses/{$id}")
            ->assertStatus(422);

        $this->assertSame(1, LeadLifecycleStatus::count());
    }

    public function test_custom_unused_lead_statuses_can_be_deleted(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $id = $this->insertStatus('vip_lead', 'VIP', 10);

        $this->deleteJson("/account/settings/leads/statuses/{$id}")
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertSame(0, LeadLifecycleStatus::count());
    }

    public function test_lead_statuses_can_be_reordered(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $first = $this->insertStatus('new', 'New', 1);
        $second = $this->insertStatus('contacted', 'Contacted', 2);
        $third = $this->insertStatus('vip_lead', 'VIP', 3);

        $this->postJson('/account/settings/leads/statuses/reorder', [
            'statusIds' => [$third, $first, $second],
        ])->assertOk()->assertJsonPath('status', 'success');

        $this->assertSame(1, (int) LeadLifecycleStatus::find($third)->sort_order);
        $this->assertSame(2, (int) LeadLifecycleStatus::find($first)->sort_order);
        $this->assertSame(3, (int) LeadLifecycleStatus::find($second)->sort_order);
    }

    // ── Authorization ──────────────────────────────────────────────────────
    //
    // Every test above calls withoutMiddleware(), which bypasses the
    // controller's own permission gate entirely — none of them would fail if
    // that gate were deleted. These two run with middleware left on.

    public function test_requests_are_rejected_without_the_manage_lead_setting_permission(): void
    {
        $this->actingAsUser(['manage_lead_setting' => 'no']);

        $this->putJson('/account/settings/leads', [
            'first_contact_sla_hours' => 48,
        ])->assertStatus(403);
    }

    public function test_add_lead_sources_is_enforced_even_when_manage_lead_setting_is_granted(): void
    {
        $this->actingAsUser([
            'manage_lead_setting' => 'all',
            'add_lead_sources' => 'no',
        ]);

        $this->postJson('/account/settings/leads/sources', [
            'type' => 'Referral',
        ])->assertStatus(403);

        $this->assertSame(0, DB::table('lead_sources')->count());
    }

    private function insertSource(string $type, int $sortOrder): int
    {
        return (int) DB::table('lead_sources')->insertGetId([
            'company_id' => $this->companyId,
            'type' => $type,
            'sort_order' => $sortOrder,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertStatus(string $key, string $label, int $sortOrder): int
    {
        return (int) DB::table('lead_lifecycle_statuses')->insertGetId([
            'company_id' => $this->companyId,
            'key' => $key,
            'label' => $label,
            'sort_order' => $sortOrder,
            'label_color' => '#6c757d',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
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
     * Like actingAsEditor(), but leaves the controller's own middleware
     * running and lets the caller pin individual permission keys — so a test
     * can assert on the gate itself instead of the withoutMiddleware() tests
     * above, which bypass it entirely and would pass even if the gate were
     * deleted.
     *
     * @param  array<string, string>  $permissions  permission key => value;
     *                                              anything not listed answers 'all'.
     */
    private function actingAsUser(array $permissions = []): void
    {
        DB::table('module_settings')->insert([
            'company_id' => $this->companyId,
            'module_name' => 'leads',
            'status' => 'active',
            'type' => 'admin',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = 99;
        $user->company_id = $this->companyId;

        foreach ($permissions as $key => $value) {
            $user->shouldReceive('permission')->with($key)->andReturn($value);
        }
        $user->shouldReceive('permission')->andReturn('all');

        $this->actingAs($user);
        session([
            'user' => $user,
            'company' => (object) ['id' => $this->companyId],
            // user_roles() and user_modules() both short-circuit on a
            // session hit before touching the user's actual role
            // relationship or the module cache — set directly so this test
            // only has to model the one thing it's actually about.
            'user_roles' => ['admin'],
        ]);
        cache()->forget('user_modules_'.$user->id);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('leads');
        Schema::dropIfExists('lead_lifecycle_statuses');
        Schema::dropIfExists('lead_sources');
        Schema::dropIfExists('lead_setting');
        Schema::dropIfExists('module_settings');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_setting', function (Blueprint $table) {
            $table->id();
            $table->boolean('status')->default(false);
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedSmallInteger('first_contact_sla_hours')->default(24);
            $table->timestamps();
        });

        Schema::create('lead_sources', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('type');
            $table->integer('sort_order')->default(0);
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_lifecycle_statuses', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('key', 50);
            $table->string('label');
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('label_color', 20)->nullable();
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('lead_lifecycle_status_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('module_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('module_name');
            $table->string('status');
            $table->string('type')->default('admin');
            $table->timestamps();
        });
    }
}
