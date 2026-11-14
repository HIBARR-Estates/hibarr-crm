<?php

namespace Tests\Feature\LeadSettings;

use App\Models\LeadOrigin;
use App\Models\User;
use App\Support\MarketingLeadIntake;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

/**
 * The marketing lead flow's access rule (department membership), the origin
 * it stamps, and the Lead settings endpoints that manage both.
 */
class MarketingLeadIntakeTest extends TestCase
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
        DB::table('teams')->insert([
            ['id' => 10, 'company_id' => $this->companyId, 'team_name' => 'Marketing', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 11, 'company_id' => $this->companyId, 'team_name' => 'Sales', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_nobody_has_access_until_a_department_is_picked(): void
    {
        $this->addEmployee(5, 10);

        $this->assertFalse(MarketingLeadIntake::allows($this->userModel(5)));
    }

    public function test_members_of_a_picked_department_have_access(): void
    {
        $this->addEmployee(5, 10);
        $this->addEmployee(6, 11);
        $this->pickDepartments([10]);

        $this->assertTrue(MarketingLeadIntake::allows($this->userModel(5)));
        $this->assertFalse(MarketingLeadIntake::allows($this->userModel(6)));
    }

    public function test_extra_team_membership_counts_too(): void
    {
        $this->addEmployee(7, 11);
        DB::table('employee_teams')->insert([
            'company_id' => $this->companyId,
            'user_id' => 7,
            'team_id' => 10,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->pickDepartments([10]);

        $this->assertTrue(MarketingLeadIntake::allows($this->userModel(7)));
    }

    public function test_the_stamped_origin_defaults_to_marketing(): void
    {
        session(['company' => (object) ['id' => $this->companyId]]);

        $originId = MarketingLeadIntake::originId($this->companyId);

        $this->assertSame(
            LeadOrigin::MARKETING,
            DB::table('lead_origins')->where('id', $originId)->value('name'),
        );
        // Asking again reuses it rather than creating a second one.
        $this->assertSame($originId, MarketingLeadIntake::originId($this->companyId));
        $this->assertSame(1, DB::table('lead_origins')->count());
    }

    public function test_origins_can_be_created_and_renamed(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $id = $this->postJson('/account/settings/leads/origins', ['name' => 'Referral'])
            ->assertOk()
            ->assertJsonPath('origin.name', 'Referral')
            ->json('origin.id');

        $this->putJson("/account/settings/leads/origins/{$id}", ['name' => 'Partner referral'])
            ->assertOk()
            ->assertJsonPath('origin.name', 'Partner referral');

        $this->postJson('/account/settings/leads/origins', ['name' => 'Partner referral'])
            ->assertStatus(422);
    }

    public function test_the_origin_the_flow_stamps_cannot_be_deleted(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $marketingId = MarketingLeadIntake::originId($this->companyId);
        $otherId = DB::table('lead_origins')->insertGetId([
            'company_id' => $this->companyId,
            'name' => 'Events',
            'sort_order' => 2,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->deleteJson("/account/settings/leads/origins/{$marketingId}")->assertStatus(422);
        $this->deleteJson("/account/settings/leads/origins/{$otherId}")->assertOk();

        $this->assertSame(1, DB::table('lead_origins')->count());
    }

    public function test_saving_the_flow_settings_persists_departments_and_origin(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $eventsId = DB::table('lead_origins')->insertGetId([
            'company_id' => $this->companyId,
            'name' => 'Events',
            'sort_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->putJson('/account/settings/leads/marketing-intake', [
            'department_ids' => [10],
            'origin_id' => $eventsId,
        ])->assertOk()
            ->assertJsonPath('marketingIntake.department_ids', [10])
            ->assertJsonPath('marketingIntake.origin_id', $eventsId);

        $this->assertSame([10], MarketingLeadIntake::departmentIds($this->companyId));
        $this->assertSame($eventsId, MarketingLeadIntake::originId($this->companyId));
    }

    public function test_a_default_owner_must_be_someone_who_can_own_leads(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $this->addEmployee(5, 10);
        $this->addEmployee(6, 10);
        DB::table('lead_agents')->insert([
            ['company_id' => $this->companyId, 'user_id' => 5, 'status' => 'enabled', 'created_at' => now(), 'updated_at' => now()],
            ['company_id' => $this->companyId, 'user_id' => 6, 'status' => 'disabled', 'created_at' => now(), 'updated_at' => now()],
        ]);
        $originId = MarketingLeadIntake::originId($this->companyId);

        $this->putJson('/account/settings/leads/marketing-intake', [
            'department_ids' => [10],
            'origin_id' => $originId,
            'owner_id' => 6,
        ])->assertStatus(422);

        $this->putJson('/account/settings/leads/marketing-intake', [
            'department_ids' => [10],
            'origin_id' => $originId,
            'owner_id' => 5,
        ])->assertOk()
            ->assertJsonPath('marketingIntake.owner_id', 5);

        $this->assertSame(5, MarketingLeadIntake::ownerId($this->companyId));
        $this->assertSame([['id' => 5, 'name' => 'User 5']], MarketingLeadIntake::ownerOptions($this->companyId));

        // An owner who stops being an enabled agent is no longer suggested.
        DB::table('lead_agents')->where('user_id', 5)->update(['status' => 'disabled']);
        $this->assertNull(MarketingLeadIntake::ownerId($this->companyId));
    }

    public function test_an_unknown_department_is_rejected(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $this->putJson('/account/settings/leads/marketing-intake', [
            'department_ids' => [999],
            'origin_id' => MarketingLeadIntake::originId($this->companyId),
        ])->assertStatus(422);
    }

    private function pickDepartments(array $ids): void
    {
        DB::table('lead_setting')->insert([
            'company_id' => $this->companyId,
            'user_id' => 1,
            'status' => 0,
            'marketing_intake_department_ids' => json_encode($ids),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function addEmployee(int $userId, int $departmentId): void
    {
        DB::table('users')->insert([
            'id' => $userId,
            'company_id' => $this->companyId,
            'name' => "User {$userId}",
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('employee_details')->insert([
            'company_id' => $this->companyId,
            'user_id' => $userId,
            'department_id' => $departmentId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function userModel(int $id): User
    {
        $user = new User;
        $user->id = $id;
        $user->company_id = $this->companyId;
        // Not a partner: PartnerRole reads the loaded roles relation.
        $user->setRelation('roles', collect());

        return $user;
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

    private function resetSchema(): void
    {
        foreach (['lead_agents', 'employee_teams', 'employee_details', 'teams', 'leads', 'lead_origins', 'lead_setting', 'users', 'companies'] as $table) {
            Schema::dropIfExists($table);
        }
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
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id');
            $table->string('status')->default('enabled');
            $table->timestamps();
        });

        Schema::create('lead_setting', function (Blueprint $table) {
            $table->id();
            $table->boolean('status')->default(false);
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedSmallInteger('first_contact_sla_hours')->default(24);
            $table->json('marketing_intake_department_ids')->nullable();
            $table->unsignedBigInteger('marketing_intake_origin_id')->nullable();
            $table->unsignedInteger('marketing_intake_owner_id')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_origins', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('name');
            $table->integer('sort_order')->default(0);
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('lead_origin_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('teams', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('team_name');
            $table->timestamps();
        });

        Schema::create('employee_details', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('department_id')->nullable();
            $table->timestamps();
        });

        Schema::create('employee_teams', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('team_id');
            $table->timestamps();
        });
    }
}
