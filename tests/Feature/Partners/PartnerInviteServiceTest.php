<?php

namespace Tests\Feature\Partners;

use App\Contracts\KeycloakIdentityClient;
use App\Exceptions\OlKeycloakException;
use App\Models\LeadAgent;
use App\Models\Permission;
use App\Models\PermissionType;
use App\Models\Role;
use App\Models\Social;
use App\Models\User;
use App\Notifications\PartnerInvited;
use App\Services\Keycloak\FakeOlKeycloakIdentityClient;
use App\Services\PartnerInviteService;
use App\Support\PartnerRole;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class PartnerInviteServiceTest extends TestCase
{
    use SetsFeatureFlags;

    private FakeOlKeycloakIdentityClient $keycloak;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->createSchema();
        LeadAgent::unsetEventDispatcher();

        $this->keycloak = new FakeOlKeycloakIdentityClient;
        $this->app->instance(KeycloakIdentityClient::class, $this->keycloak);

        Notification::fake();

        $this->admin = $this->insertUser('Admin', 'admin@example.test');
        $adminRole = new Role;
        $adminRole->name = 'admin';
        $adminRole->company_id = 1;
        $adminRole->display_name = 'Admin';
        $adminRole->saveQuietly();
        DB::table('role_user')->insert(['user_id' => $this->admin->id, 'role_id' => $adminRole->id]);

        $employeeRole = new Role;
        $employeeRole->name = 'employee';
        $employeeRole->company_id = 1;
        $employeeRole->display_name = 'Employee';
        $employeeRole->saveQuietly();

        Permission::query()->create(['name' => 'view_partner_dashboard']);
        Permission::query()->create(['name' => 'view_lead']);
    }

    public function test_split_name_uses_first_token_and_rest(): void
    {
        $this->assertSame(['Ada', 'Lovelace'], PartnerInviteService::splitName('Ada Lovelace'));
        $this->assertSame(['Madonna', 'Madonna'], PartnerInviteService::splitName('Madonna'));
    }

    public function test_invite_with_flag_on_provisions_and_links_social(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);

        $service = app(PartnerInviteService::class);
        $result = $service->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $this->assertTrue($result['invite_sent']);
        $user = User::withoutGlobalScopes()->where('email', 'ada@example.test')->firstOrFail();
        $this->assertSame(PartnerInviteService::STATUS_INVITED, $user->partner_invite_status);
        $this->assertNotNull($user->partner_invited_at);

        $social = Social::where('user_id', $user->id)->first();
        $this->assertNotNull($social);
        $this->assertSame('keycloak', $social->social_service);
        $this->assertSame($this->keycloak->idForEmail('ada@example.test'), $social->social_id);

        $this->assertTrue($result['agent']->can_resend);
        $this->assertSame(PartnerInviteService::STATUS_INVITED, $result['agent']->partner_invite_status);

        Notification::assertSentTo($user, PartnerInvited::class);
        $this->assertCount(1, $this->keycloak->actionsEmails);
    }

    public function test_invite_is_idempotent_when_keycloak_user_already_exists(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $existing = $this->keycloak->provision('ada@example.test', 'Ada', 'Lovelace', false);

        $result = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $this->assertTrue($result['invite_sent']);
        $user = User::withoutGlobalScopes()->where('email', 'ada@example.test')->firstOrFail();
        $this->assertSame($existing->keycloakUserId, Social::where('user_id', $user->id)->value('social_id'));
        $this->assertFalse(
            $this->keycloak->provision('ada@example.test', 'Ada', 'Lovelace', false)->created
        );
    }

    public function test_invite_keeps_local_user_when_provision_fails(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $this->keycloak->failNextProvision(new OlKeycloakException('Keycloak down'));

        $result = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $this->assertFalse($result['invite_sent']);
        $user = User::withoutGlobalScopes()->where('email', 'ada@example.test')->firstOrFail();
        $this->assertSame(PartnerInviteService::STATUS_FAILED, $user->partner_invite_status);
        $this->assertNull(Social::where('user_id', $user->id)->first());
        $this->assertTrue($result['agent']->can_resend);
        Notification::assertNothingSent();
    }

    public function test_resend_uses_actions_email_when_identity_exists(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $this->keycloak->actionsEmails = [];

        $result = app(PartnerInviteService::class)->resend($invite['agent']->fresh(['user', 'user.roles']), $this->admin);

        $this->assertTrue($result['ok']);
        $this->assertCount(1, $this->keycloak->actionsEmails);
    }

    public function test_destroy_disables_keycloak_best_effort(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $agent = $invite['agent']->fresh(['user']);
        app(PartnerInviteService::class)->destroy($agent);

        $this->assertFalse((bool) $agent->fresh()->is_partner);
        $this->assertSame(['enabled' => false], $this->keycloak->updates[0]['patch']);
    }

    public function test_flag_off_skips_keycloak_and_still_emails(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, false);

        $result = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $this->assertTrue($result['invite_sent']);
        $user = User::withoutGlobalScopes()->where('email', 'ada@example.test')->firstOrFail();
        $this->assertNull($user->partner_invite_status);
        $this->assertNull(Social::where('user_id', $user->id)->first());
        $this->assertSame([], $this->keycloak->actionsEmails);
        Notification::assertSentTo($user, PartnerInvited::class);
    }

    public function test_staff_flagged_as_partner_cannot_resend(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $staff = $this->insertUser('Staff', 'staff@example.test');
        $adminRole = Role::withoutGlobalScopes()->where('name', 'admin')->first();
        $staff->attachRole($adminRole->id);

        $agent = LeadAgent::create([
            'company_id' => 1,
            'user_id' => $staff->id,
            'status' => 'enabled',
            'is_partner' => true,
            'added_by' => $this->admin->id,
        ]);

        $this->assertFalse(PartnerRole::isPartnerOnly($staff->load('roles')));
        $this->assertFalse(app(PartnerInviteService::class)->canResend($agent->load(['user', 'user.roles'])));
    }

    public function test_lifecycle_disable_on_deactive(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $user = $invite['agent']->user;
        $user->status = 'deactive';
        app(PartnerInviteService::class)->syncLifecycle($user);

        $this->assertNotEmpty($this->keycloak->updates);
        $this->assertFalse($this->keycloak->updates[array_key_last($this->keycloak->updates)]['patch']['enabled']);
    }

    private function insertUser(string $name, string $email): User
    {
        $user = new User;
        $user->company_id = 1;
        $user->name = $name;
        $user->email = $email;
        $user->password = bcrypt('secret-secret');
        $user->status = 'active';
        $user->save();

        return $user;
    }

    private function createSchema(): void
    {
        Schema::create('companies', function (Blueprint $t) {
            $t->increments('id');
            $t->string('company_name')->nullable();
            $t->timestamps();
        });
        DB::table('companies')->insert(['id' => 1, 'company_name' => 'Acme', 'created_at' => now(), 'updated_at' => now()]);

        Schema::create('users', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('company_id')->nullable();
            $t->string('name')->nullable();
            $t->string('email')->nullable();
            $t->string('password')->nullable();
            $t->string('mobile')->nullable();
            $t->string('image')->nullable();
            $t->string('status')->default('active');
            $t->string('login')->default('enable');
            $t->string('partner_invite_status', 16)->nullable();
            $t->timestamp('partner_invited_at')->nullable();
            $t->text('headers')->nullable();
            $t->string('register_ip')->nullable();
            $t->text('location_details')->nullable();
            $t->timestamps();
        });

        Schema::create('roles', function (Blueprint $t) {
            $t->increments('id');
            $t->string('name');
            $t->unsignedInteger('company_id')->nullable();
            $t->string('display_name')->nullable();
            $t->string('description')->nullable();
            $t->timestamps();
        });
        Schema::create('role_user', function (Blueprint $t) {
            $t->unsignedInteger('user_id');
            $t->unsignedInteger('role_id');
            $t->primary(['user_id', 'role_id']);
        });
        Schema::create('permissions', function (Blueprint $t) {
            $t->increments('id');
            $t->string('name');
            $t->string('display_name')->nullable();
            $t->unsignedInteger('module_id')->nullable();
            $t->string('allowed_permissions')->nullable();
            $t->boolean('is_custom')->default(0);
            $t->timestamps();
        });
        Schema::create('permission_role', function (Blueprint $t) {
            $t->unsignedInteger('permission_id');
            $t->unsignedInteger('role_id');
            $t->unsignedInteger('permission_type_id');
        });
        Schema::create('user_permissions', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('user_id');
            $t->unsignedInteger('permission_id');
            $t->unsignedInteger('permission_type_id');
        });
        Schema::create('lead_agents', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('company_id')->nullable();
            $t->unsignedInteger('user_id');
            $t->unsignedInteger('lead_category_id')->nullable();
            $t->unsignedInteger('added_by')->nullable();
            $t->unsignedInteger('last_updated_by')->nullable();
            $t->string('status')->default('enabled');
            $t->boolean('is_partner')->default(false);
            $t->timestamps();
        });
        Schema::create('leads', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('company_id')->nullable();
            $t->unsignedInteger('referred_by_agent_id')->nullable();
            $t->softDeletes();
        });
        Schema::create('socials', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('user_id')->nullable();
            $t->text('social_id')->nullable();
            $t->text('social_service')->nullable();
            $t->timestamps();
        });
    }
}
