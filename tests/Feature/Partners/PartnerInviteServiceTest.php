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

        // Through a real save: the UserObserver syncs after the write.
        $invite['agent']->user->update(['status' => 'deactive']);

        $this->assertNotEmpty($this->keycloak->updates);
        $this->assertFalse($this->keycloak->updates[array_key_last($this->keycloak->updates)]['patch']['enabled']);
    }

    public function test_lifecycle_reenables_identity_when_partner_is_reactivated(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $user = $invite['agent']->user;
        $user->update(['status' => 'deactive']);
        $user->update(['status' => 'active']);

        $this->assertCount(2, $this->keycloak->updates);
        $this->assertTrue($this->keycloak->updates[1]['patch']['enabled']);
    }

    public function test_lifecycle_does_not_reenable_a_removed_partner(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $user = $invite['agent']->user;
        $user->update(['status' => 'deactive']);
        app(PartnerInviteService::class)->destroy($invite['agent']->fresh(['user', 'user.roles']));
        $updatesBefore = count($this->keycloak->updates);

        $user->update(['status' => 'active']);

        $this->assertCount($updatesBefore, $this->keycloak->updates);
    }

    public function test_lifecycle_pushes_email_changes_for_partners(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $invite['agent']->user->update(['email' => 'Ada.New@Example.test']);

        $this->assertSame(['email' => 'ada.new@example.test'], $this->keycloak->updates[0]['patch']);
    }

    public function test_lifecycle_never_touches_staff_who_share_the_identity_realm(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $staff = $this->insertStaffWithKeycloakLogin();

        $staff->update(['status' => 'deactive']);
        $staff->update(['email' => 'renamed@example.test']);

        $this->assertSame([], $this->keycloak->updates);
    }

    public function test_lifecycle_is_not_sent_when_the_save_rolls_back(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);
        $user = $invite['agent']->user;

        try {
            DB::transaction(function () use ($user) {
                $user->update(['status' => 'deactive']);

                throw new \RuntimeException('roll back');
            });
        } catch (\RuntimeException) {
        }

        $this->assertSame([], $this->keycloak->updates);
        $this->assertSame('active', User::withoutGlobalScopes()->find($user->id)->status);
    }

    public function test_removing_a_staff_partner_leaves_their_identity_alone(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $staff = $this->insertStaffWithKeycloakLogin();
        $agent = LeadAgent::create([
            'company_id' => 1,
            'user_id' => $staff->id,
            'status' => 'enabled',
            'is_partner' => true,
            'added_by' => $this->admin->id,
        ]);

        app(PartnerInviteService::class)->destroy($agent->load('user'));

        $this->assertFalse((bool) $agent->fresh()->is_partner);
        $this->assertSame([], $this->keycloak->updates);
    }

    public function test_resend_is_refused_once_the_invitation_was_accepted(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);
        $staleAgent = $invite['agent']->fresh(['user', 'user.roles']);
        $this->keycloak->actionsEmails = [];

        // The partner signs in after the roster was loaded.
        DB::table('users')->where('id', $staleAgent->user_id)
            ->update(['partner_invite_status' => PartnerInviteService::STATUS_ACCEPTED]);

        $result = app(PartnerInviteService::class)->resend($staleAgent, $this->admin);

        $this->assertFalse($result['ok']);
        $this->assertSame(__('pages.partners.msg_resend_accepted'), $result['message']);
        $this->assertSame([], $this->keycloak->actionsEmails);
        $this->assertSame(
            PartnerInviteService::STATUS_ACCEPTED,
            DB::table('users')->where('id', $staleAgent->user_id)->value('partner_invite_status'),
        );
    }

    public function test_accepted_is_never_moved_back_by_a_late_invite(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);
        $user = $invite['agent']->user;

        app(PartnerInviteService::class)->markAccepted($user);
        $this->assertSame(PartnerInviteService::STATUS_ACCEPTED, $user->partner_invite_status);

        $method = new \ReflectionMethod(PartnerInviteService::class, 'setInviteStatus');
        $method->setAccessible(true);
        $method->invoke(app(PartnerInviteService::class), $user, PartnerInviteService::STATUS_INVITED);

        $this->assertSame(
            PartnerInviteService::STATUS_ACCEPTED,
            DB::table('users')->where('id', $user->id)->value('partner_invite_status'),
        );
        $this->assertSame(PartnerInviteService::STATUS_ACCEPTED, $user->partner_invite_status);
    }

    public function test_nothing_is_provisioned_for_a_partner_removed_before_enrolment(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, false);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);
        $agent = $invite['agent']->fresh(['user', 'user.roles']);

        // Removed in the meantime; provisioning is switched on afterwards.
        DB::table('lead_agents')->where('id', $agent->id)->update(['is_partner' => false]);
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);

        $result = app(PartnerInviteService::class)->resend($agent, $this->admin);

        $this->assertFalse($result['ok']);
        $this->assertSame(__('pages.partners.msg_removed_while_inviting'), $result['message']);
        $this->assertNull($this->keycloak->idForEmail('ada@example.test'));
        $this->assertNull(Social::where('user_id', $agent->user_id)->first());
    }

    public function test_resend_failure_message_is_a_translated_string(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $this->keycloak->failNextProvision(new OlKeycloakException('Keycloak down'));
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);
        $this->assertSame(__('pages.partners.msg_enrolment_failed_created'), $invite['message']);

        $this->keycloak->failNextProvision(new OlKeycloakException('Still down'));
        $result = app(PartnerInviteService::class)->resend($invite['agent']->fresh(['user', 'user.roles']), $this->admin);

        $this->assertFalse($result['ok']);
        $this->assertSame(__('pages.partners.msg_enrolment_failed_retry'), $result['message']);
        $this->assertStringNotContainsString('pages.partners', $result['message']);
    }

    public function test_presented_agent_keeps_company_so_the_invite_email_resolves_it(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);

        $result = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $this->assertSame(1, (int) $result['agent']->user->company_id);
        $this->assertNotNull($result['agent']->user->company);
    }

    public function test_decorating_a_loaded_roster_row_runs_no_queries(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $agent = LeadAgent::query()
            ->withCount('referredLeads')
            ->with(PartnerInviteService::AGENT_RELATIONS)
            ->findOrFail($invite['agent']->id);

        DB::flushQueryLog();
        DB::enableQueryLog();
        app(PartnerInviteService::class)->decorate($agent);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertSame([], $queries);
        $this->assertTrue($agent->can_resend);
        $this->assertSame(PartnerInviteService::STATUS_INVITED, $agent->partner_invite_status);
    }

    /** A staff member (admin role) who signs in with Keycloak SSO like everyone else. */
    private function insertStaffWithKeycloakLogin(): User
    {
        $staff = $this->insertUser('Staff', 'staff@example.test');
        $staff->attachRole(Role::withoutGlobalScopes()->where('name', 'admin')->first()->id);
        Social::create([
            'user_id' => $staff->id,
            'social_id' => 'kc-staff-1',
            'social_service' => 'keycloak',
        ]);

        return $staff->load('roles');
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
